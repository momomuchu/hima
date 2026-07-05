/**
 * setup.test.ts — unit + integration tests for the norm setup onboarding module.
 *
 * Tests cover:
 *   §1  mergeClaudeHooks — pure function, no fs (unit tests)
 *   §2  runSetup: runtime detection
 *   §3  runSetup: hook wiring (claude)
 *   §4  runSetup: scaffold (.hima/state/, config.json, current-risk.json)
 *   §5  runSetup: fresh reset
 *   §6  runSetup: idempotency
 *   §7  runSetup: return-value shape
 *   §8  runSetup: tolerance for a brand-new empty root
 *
 * All fs tests use real tmp directories — no mocks.
 */

import { access, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { mergeClaudeHooks, runSetup, codexHookBlock } from "../src/setup.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readJson(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as unknown;
}

/** Returns true when the path exists (works for files and directories). */
async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** @deprecated Alias kept for test readability; prefer pathExists for directories. */
const fileExists = pathExists;

// ---------------------------------------------------------------------------
// §1 — mergeClaudeHooks (pure function)
// ---------------------------------------------------------------------------

describe("mergeClaudeHooks — pure function", () => {
  const ALL_EVENTS = [
    { pascal: "SessionStart", kebab: "session-start" },
    { pascal: "UserPromptSubmit", kebab: "user-prompt-submit" },
    { pascal: "PreToolUse", kebab: "pre-tool-use" },
    { pascal: "PostToolUse", kebab: "post-tool-use" },
    { pascal: "PreCompact", kebab: "pre-compact" },
    { pascal: "PostCompact", kebab: "post-compact" },
    { pascal: "SubagentStart", kebab: "subagent-start" },
    { pascal: "Stop", kebab: "stop" },
    { pascal: "SubagentStop", kebab: "subagent-stop" },
  ] as const;

  it("empty settings → 9 events wired with global 'hima' bin", () => {
    const result = mergeClaudeHooks({});
    const hooks = result["hooks"] as Record<string, unknown>;

    for (const { pascal, kebab } of ALL_EVENTS) {
      const matchers = hooks[pascal] as Array<{
        matcher: string;
        hooks: Array<{ type: string; command: string }>;
      }>;
      expect(matchers).toHaveLength(1);
      const entry = matchers[0];
      expect(entry).toBeDefined();
      expect(entry?.matcher).toBe("");
      expect(entry?.hooks).toHaveLength(1);
      const cmd = entry?.hooks[0]?.command ?? "";
      expect(cmd).toBe(`norm hook ${kebab} --format claude`);
    }
  });

  it("himaBinPath provided → command uses 'node <path> hook <event> --format claude'", () => {
    const binPath = "/some/path/to/dist/index.js";
    const result = mergeClaudeHooks({}, binPath);
    const hooks = result["hooks"] as Record<string, unknown>;

    for (const { pascal, kebab } of ALL_EVENTS) {
      const matchers = hooks[pascal] as Array<{
        hooks: Array<{ command: string }>;
      }>;
      const cmd = matchers[0]?.hooks[0]?.command ?? "";
      expect(cmd).toBe(`node ${binPath} hook ${kebab} --format claude`);
    }
  });

  it("idempotent: calling twice with the same settings yields no duplicates", () => {
    const first = mergeClaudeHooks({});
    const second = mergeClaudeHooks(first);
    const hooks = second["hooks"] as Record<string, unknown>;

    // Each event must have exactly 1 matcher entry (no duplication).
    for (const { pascal } of ALL_EVENTS) {
      const matchers = hooks[pascal] as unknown[];
      expect(matchers).toHaveLength(1);
    }
  });

  it("preserves non-hima entries in an existing event array", () => {
    const existing = {
      hooks: {
        PreToolUse: [
          {
            matcher: "some-tool",
            hooks: [{ type: "command", command: "my-other-tool do-something" }],
          },
        ],
      },
    };

    const result = mergeClaudeHooks(existing);
    const preToolUseMatchers = (
      result["hooks"] as Record<string, unknown>
    )["PreToolUse"] as unknown[];

    // Should have the original non-hima entry PLUS the new hima entry.
    expect(preToolUseMatchers).toHaveLength(2);
  });

  it("preserves unrelated top-level keys from existingSettings", () => {
    const existing = {
      env: { MY_VAR: "hello" },
      permissions: { allow: ["bash"] },
      hooks: {},
    };

    const result = mergeClaudeHooks(existing);

    expect(result["env"]).toEqual({ MY_VAR: "hello" });
    expect(result["permissions"]).toEqual({ allow: ["bash"] });
  });

  it("non-object existingSettings (null) → treated as {} without throwing", () => {
    const result = mergeClaudeHooks(null);
    const hooks = result["hooks"] as Record<string, unknown>;
    // All 9 events must be present.
    for (const { pascal } of ALL_EVENTS) {
      expect(hooks[pascal]).toBeDefined();
    }
  });

  it("non-object existingSettings (string) → treated as {}", () => {
    const result = mergeClaudeHooks("not-an-object");
    const hooks = result["hooks"] as Record<string, unknown>;
    expect(Object.keys(hooks)).toHaveLength(9);
  });

  it("non-object existingSettings (array) → treated as {}", () => {
    const result = mergeClaudeHooks([1, 2, 3]);
    const hooks = result["hooks"] as Record<string, unknown>;
    expect(Object.keys(hooks)).toHaveLength(9);
  });

  it("existing hima entries from a previous run are replaced (not accumulated)", () => {
    // Simulate an existing settings.json written by a previous run with an old bin path.
    const oldBin = "/old/dist/index.js";
    const firstRun = mergeClaudeHooks({}, oldBin);

    // New run with a different bin path.
    const newBin = "/new/dist/index.js";
    const secondRun = mergeClaudeHooks(firstRun, newBin);
    const hooks = secondRun["hooks"] as Record<string, unknown>;

    for (const { pascal, kebab } of ALL_EVENTS) {
      const matchers = hooks[pascal] as Array<{
        hooks: Array<{ command: string }>;
      }>;
      // Still exactly 1 matcher.
      expect(matchers).toHaveLength(1);
      // Command uses the new bin path.
      const cmd = matchers[0]?.hooks[0]?.command ?? "";
      expect(cmd).toBe(`node ${newBin} hook ${kebab} --format claude`);
      // Does NOT contain the old bin path.
      expect(cmd).not.toContain(oldBin);
    }
  });
});

// ---------------------------------------------------------------------------
// Shared tmp root setup
// ---------------------------------------------------------------------------

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "hima-setup-test-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// §2 — runSetup: runtime detection
// ---------------------------------------------------------------------------

describe("runSetup — runtime detection", () => {
  it(".claude dir present → runtime 'claude'", async () => {
    await mkdir(path.join(root, ".claude"), { recursive: true });
    const result = await runSetup({ root });
    expect(result.runtime).toBe("claude");
  });

  it(".codex dir present (no .claude) → runtime 'codex'", async () => {
    await mkdir(path.join(root, ".codex"), { recursive: true });
    const result = await runSetup({ root });
    expect(result.runtime).toBe("codex");
  });

  it("AGENTS.md present (no .claude, no .codex) → runtime 'codex'", async () => {
    await writeFile(path.join(root, "AGENTS.md"), "# Agents\n");
    const result = await runSetup({ root });
    expect(result.runtime).toBe("codex");
  });

  it("empty root (no markers) → default runtime 'claude'", async () => {
    const result = await runSetup({ root });
    expect(result.runtime).toBe("claude");
  });

  it("explicit runtime overrides auto-detect (.claude dir present, but 'codex' forced)", async () => {
    await mkdir(path.join(root, ".claude"), { recursive: true });
    const result = await runSetup({ root, runtime: "codex" });
    expect(result.runtime).toBe("codex");
  });

  it("explicit runtime 'hermes' is passed through", async () => {
    const result = await runSetup({ root, runtime: "hermes" });
    expect(result.runtime).toBe("hermes");
  });

  it(".claude takes precedence over AGENTS.md when both present", async () => {
    await mkdir(path.join(root, ".claude"), { recursive: true });
    await writeFile(path.join(root, "AGENTS.md"), "# Agents\n");
    const result = await runSetup({ root });
    expect(result.runtime).toBe("claude");
  });
});

// ---------------------------------------------------------------------------
// §3 — runSetup: hook wiring (claude)
// ---------------------------------------------------------------------------

describe("runSetup — hook wiring (claude runtime)", () => {
  it("creates .claude/settings.json with 9 hook events (global bin)", async () => {
    await mkdir(path.join(root, ".claude"), { recursive: true });
    await runSetup({ root });

    const settingsPath = path.join(root, ".claude", "settings.json");
    expect(await fileExists(settingsPath)).toBe(true);

    const settings = await readJson(settingsPath);
    const hooks = (settings as Record<string, unknown>)["hooks"] as Record<
      string,
      unknown
    >;

    for (const event of [
      "SessionStart",
      "UserPromptSubmit",
      "PreToolUse",
      "PostToolUse",
      "PreCompact",
      "PostCompact",
      "SubagentStart",
      "Stop",
      "SubagentStop",
    ]) {
      expect(hooks[event]).toBeDefined();
      const matchers = hooks[event] as Array<{ hooks: Array<{ command: string }> }>;
      expect(matchers.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("creates .claude/ directory if it does not exist", async () => {
    // root has no .claude dir; setup must create it
    await runSetup({ root });
    expect(await fileExists(path.join(root, ".claude", "settings.json"))).toBe(true);
  });

  it("with himaBinPath: commands use 'node <path> hook …'", async () => {
    const binPath = "/absolute/path/dist/index.js";
    await runSetup({ root, himaBinPath: binPath });

    const settingsPath = path.join(root, ".claude", "settings.json");
    const settings = await readJson(settingsPath);
    const hooks = (settings as Record<string, unknown>)["hooks"] as Record<
      string,
      unknown
    >;
    const matchers = hooks["SessionStart"] as Array<{
      hooks: Array<{ command: string }>;
    }>;
    const cmd = matchers[0]?.hooks[0]?.command ?? "";
    expect(cmd).toContain(`node ${binPath}`);
    expect(cmd).toContain("hook session-start --format claude");
  });

  it("merges into existing settings.json without destroying unrelated keys", async () => {
    await mkdir(path.join(root, ".claude"), { recursive: true });
    const settingsPath = path.join(root, ".claude", "settings.json");

    // Pre-populate with a non-hooks key.
    await writeFile(
      settingsPath,
      JSON.stringify({ env: { KEPT: "yes" }, hooks: {} }, null, 2),
    );

    await runSetup({ root });

    const settings = await readJson(settingsPath);
    expect((settings as Record<string, unknown>)["env"]).toEqual({
      KEPT: "yes",
    });
  });

  it("wired[] contains the absolute settings.json path", async () => {
    const result = await runSetup({ root });
    const expected = path.join(root, ".claude", "settings.json");
    expect(result.wired).toContain(expected);
  });

  it("codex runtime: wires .codex/config.toml (auto-wired as of 2026-07-04)", async () => {
    const result = await runSetup({ root, runtime: "codex" });
    expect(result.wired).toHaveLength(1);
    expect(result.wired[0]).toMatch(/\.codex[/\\]config\.toml$/);
    expect(result.messages.some((m) => m.includes("Codex hooks wired"))).toBe(true);
  });

  it("hermes runtime: wired[] is empty, messages contain best-effort note", async () => {
    const result = await runSetup({ root, runtime: "hermes" });
    expect(result.wired).toHaveLength(0);
    expect(result.messages.some((m) => m.includes("best-effort/manual"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// §4 — runSetup: scaffold
// ---------------------------------------------------------------------------

describe("runSetup — scaffold", () => {
  it("creates .hima/state/ directory", async () => {
    await runSetup({ root });
    const statePath = path.join(root, ".hima", "state");
    const s = await stat(statePath);
    expect(s.isDirectory()).toBe(true);
  });

  it("creates .hima/config.json with empty object {}", async () => {
    await runSetup({ root });
    const config = await readJson(path.join(root, ".hima", "config.json"));
    expect(config).toEqual({});
  });

  it("creates .hima/current-risk.json with {risk_class: 'T'}", async () => {
    await runSetup({ root });
    const risk = await readJson(path.join(root, ".hima", "current-risk.json"));
    expect(risk).toEqual({ risk_class: "T" });
  });

  it("scaffolded[] contains the paths of newly created files", async () => {
    const result = await runSetup({ root });
    expect(result.scaffolded).toContain(path.join(root, ".hima", "config.json"));
    expect(result.scaffolded).toContain(
      path.join(root, ".hima", "current-risk.json"),
    );
  });

  it("does NOT overwrite an existing .hima/config.json", async () => {
    await mkdir(path.join(root, ".hima"), { recursive: true });
    const configPath = path.join(root, ".hima", "config.json");
    const userConfig = JSON.stringify({ stageSkills: { discovery: {} } }, null, 2);
    await writeFile(configPath, userConfig);

    await runSetup({ root });

    const afterSetup = await readFile(configPath, "utf8");
    expect(afterSetup.trim()).toBe(userConfig.trim());
  });

  it("does NOT overwrite an existing .hima/current-risk.json", async () => {
    await mkdir(path.join(root, ".hima"), { recursive: true });
    const riskPath = path.join(root, ".hima", "current-risk.json");
    await writeFile(riskPath, JSON.stringify({ risk_class: "H" }, null, 2));

    await runSetup({ root });

    const risk = await readJson(riskPath);
    expect(risk).toEqual({ risk_class: "H" });
  });

  it("scaffold is idempotent: second run leaves scaffolded[] empty (files already exist)", async () => {
    await runSetup({ root });
    const second = await runSetup({ root });
    // No new files should have been created on the second run.
    expect(second.scaffolded).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// §5 — runSetup: fresh reset
// ---------------------------------------------------------------------------

describe("runSetup — fresh reset (opts.fresh)", () => {
  async function seedStateFiles(r: string): Promise<void> {
    const stateDir = path.join(r, ".hima", "state");
    await mkdir(path.join(stateDir, "trace"), { recursive: true });
    await writeFile(path.join(stateDir, "trace", "session-abc.jsonl"), "{}");
    await writeFile(path.join(stateDir, "ward.json"), JSON.stringify({ active: true }));
    await writeFile(path.join(stateDir, "events.jsonl"), "{}\n{}\n");
  }

  it("deletes .hima/state/trace/ (recursively)", async () => {
    await runSetup({ root }); // initial scaffold
    await seedStateFiles(root);

    await runSetup({ root, fresh: true });

    expect(await fileExists(path.join(root, ".hima", "state", "trace"))).toBe(false);
  });

  it("deletes .hima/state/ward.json", async () => {
    await runSetup({ root });
    await seedStateFiles(root);

    await runSetup({ root, fresh: true });

    expect(
      await fileExists(path.join(root, ".hima", "state", "ward.json")),
    ).toBe(false);
  });

  it("deletes .hima/state/events.jsonl", async () => {
    await runSetup({ root });
    await seedStateFiles(root);

    await runSetup({ root, fresh: true });

    expect(
      await fileExists(path.join(root, ".hima", "state", "events.jsonl")),
    ).toBe(false);
  });

  it("reset[] contains the deleted paths", async () => {
    await runSetup({ root });
    await seedStateFiles(root);

    const result = await runSetup({ root, fresh: true });

    expect(result.reset).toContain(path.join(root, ".hima", "state", "trace"));
    expect(result.reset).toContain(
      path.join(root, ".hima", "state", "ward.json"),
    );
    expect(result.reset).toContain(
      path.join(root, ".hima", "state", "events.jsonl"),
    );
  });

  it("does NOT delete .hima/config.json (user config is preserved)", async () => {
    await runSetup({ root });

    // Write a non-default config.
    const configPath = path.join(root, ".hima", "config.json");
    await writeFile(configPath, JSON.stringify({ stageSkills: { x: {} } }, null, 2));

    await seedStateFiles(root);
    await runSetup({ root, fresh: true });

    expect(await fileExists(configPath)).toBe(true);
    const config = await readJson(configPath);
    expect((config as Record<string, unknown>)["stageSkills"]).toBeDefined();
  });

  it("reset[] is empty when no state files exist (clean root)", async () => {
    const result = await runSetup({ root, fresh: true });
    expect(result.reset).toHaveLength(0);
  });

  it("fresh reset re-scaffolds: .hima/state/ still exists after reset", async () => {
    await runSetup({ root });
    await seedStateFiles(root);
    await runSetup({ root, fresh: true });

    // .hima/state/ must still be there for future state writes.
    const stateDir = path.join(root, ".hima", "state");
    // If state dir exists, readFile on ward.json (deleted above) fails with
    // ENOENT, not with ENOTDIR. We verify the dir itself by writing into it.
    await writeFile(path.join(stateDir, "canary.txt"), "ok");
    expect(await fileExists(path.join(stateDir, "canary.txt"))).toBe(true);
  });

  it("messages contain a fresh-reset summary line", async () => {
    const result = await runSetup({ root, fresh: true });
    expect(result.messages.some((m) => m.toLowerCase().includes("fresh"))).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// §6 — runSetup: idempotency of hook wiring
// ---------------------------------------------------------------------------

describe("runSetup — idempotency of hook wiring", () => {
  it("running setup twice does not duplicate hook entries in settings.json", async () => {
    await runSetup({ root });
    await runSetup({ root });

    const settingsPath = path.join(root, ".claude", "settings.json");
    const settings = await readJson(settingsPath);
    const hooks = (settings as Record<string, unknown>)["hooks"] as Record<
      string,
      unknown
    >;

    for (const event of [
      "SessionStart",
      "UserPromptSubmit",
      "PreToolUse",
      "PostToolUse",
      "PreCompact",
      "PostCompact",
      "SubagentStart",
      "Stop",
      "SubagentStop",
    ]) {
      const matchers = hooks[event] as unknown[];
      // Exactly 1 norm hook entry per event after repeated runs.
      expect(matchers).toHaveLength(1);
    }
  });
});

// ---------------------------------------------------------------------------
// §7 — runSetup: return-value shape
// ---------------------------------------------------------------------------

describe("runSetup — return-value shape", () => {
  it("returns an object with runtime, wired, scaffolded, reset, messages", async () => {
    const result = await runSetup({ root });

    expect(typeof result.runtime).toBe("string");
    expect(Array.isArray(result.wired)).toBe(true);
    expect(Array.isArray(result.scaffolded)).toBe(true);
    expect(Array.isArray(result.reset)).toBe(true);
    expect(Array.isArray(result.messages)).toBe(true);
  });

  it("messages contains at least one next-step / verification hint", async () => {
    const result = await runSetup({ root });
    // Expect at least a "setup complete" guidance message.
    expect(result.messages.some((m) => m.includes("Setup complete"))).toBe(true);
  });

  it("reset[] is empty when fresh is not set", async () => {
    const result = await runSetup({ root });
    expect(result.reset).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// §8 — runSetup: tolerance for a brand-new empty root
// ---------------------------------------------------------------------------

describe("runSetup — brand-new empty root", () => {
  it("succeeds without throwing on a completely empty directory", async () => {
    await expect(runSetup({ root })).resolves.not.toThrow();
  });

  it("succeeds even when .hima/ does not exist yet", async () => {
    // root is fresh from mkdtemp — no .hima dir
    const result = await runSetup({ root });
    expect(result.runtime).toBeDefined();
    expect(await fileExists(path.join(root, ".hima", "config.json"))).toBe(true);
  });

  it("fresh on a completely empty root does not throw", async () => {
    await expect(runSetup({ root, fresh: true })).resolves.not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §9 — Codex hook wiring (dogfound 2026-07-04: norm setup now auto-wires codex,
//      not just a manual note). Proven live: a real `codex exec` fires these hooks.
// ─────────────────────────────────────────────────────────────────────────────
describe("codex hook wiring", () => {
  it("codexHookBlock renders codex_hooks + all 5 events with --format codex", () => {
    const block = codexHookBlock("/abs/dist/index.js");
    expect(block).toContain("codex_hooks = true");
    for (const ev of [
      "session-start",
      "user-prompt-submit",
      "pre-tool-use",
      "post-tool-use",
      "stop",
    ]) {
      expect(block).toContain(`hook ${ev} --format codex`);
    }
    expect(block).toContain(`node "/abs/dist/index.js"`);
  });

  it("codexHookBlock uses the global hima bin when no path is given", () => {
    const block = codexHookBlock();
    expect(block).toContain("norm hook stop --format codex");
    expect(block).not.toContain('node "');
  });

  it("runSetup --runtime codex writes a .codex/config.toml with the hooks", async () => {
    const result = await runSetup({ root, runtime: "codex" });
    expect(result.runtime).toBe("codex");
    const cfg = await readFile(path.join(root, ".codex", "config.toml"), "utf8");
    expect(cfg).toContain("codex_hooks = true");
    expect(cfg).toMatch(/hook stop --format codex/);
  });

  it("does not clobber a pre-existing non-hima .codex/config.toml", async () => {
    await mkdir(path.join(root, ".codex"), { recursive: true });
    await writeFile(path.join(root, ".codex", "config.toml"), "model = 'gpt-5'\n");
    const result = await runSetup({ root, runtime: "codex" });
    const cfg = await readFile(path.join(root, ".codex", "config.toml"), "utf8");
    expect(cfg).toContain("model = 'gpt-5'"); // user config preserved
    expect(cfg).not.toContain("codex_hooks = true"); // not overwritten
    expect(result.messages.join("\n")).toMatch(/not clobbered|manually/);
  });
});
