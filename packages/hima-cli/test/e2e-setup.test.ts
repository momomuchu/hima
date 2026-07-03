/**
 * e2e-setup.test.ts — SPAWN e2e tests for `hima setup`.
 *
 * Spawns the built dist/index.js in a real tmp root to validate:
 *
 *   Scenario 1 — `hima setup --runtime claude --root <tmp>`
 *     • exits 0
 *     • <tmp>/.claude/settings.json contains 7 hook entries whose command
 *       references "hook" and the CLI dist path
 *     • <tmp>/.hima/state/ directory exists
 *     • <tmp>/.hima/config.json exists
 *
 *   Scenario 2 — `hima setup --fresh --root <tmp>` (after planting a trace file)
 *     • exits 0
 *     • the planted trace file is gone
 *     • <tmp>/.hima/config.json is still present (user data preserved)
 *
 * Pre-condition: `pnpm --filter @hima/cli build` must have run before this
 * suite executes (dist/index.js must exist).
 */

import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Absolute path to the built CLI entry-point.
 * The e2e suite requires a prior `pnpm build` in the @hima/cli package.
 */
const DIST_INDEX = path.resolve(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "../dist/index.js",
);

/** The 9 Claude hook events in PascalCase (settings.json keys). */
const CLAUDE_HOOK_EVENTS = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PreCompact",
  "PostCompact",
  "SubagentStart",
  "Stop",
  "SubagentStop",
] as const;

// ---------------------------------------------------------------------------
// Tmp root lifecycle
// ---------------------------------------------------------------------------

let root: string;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "hima-e2e-setup-"));
  // Pre-create .claude/ so the runtime auto-detects as "claude".
  mkdirSync(path.join(root, ".claude"), { recursive: true });
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helper: spawn dist/index.js synchronously
// ---------------------------------------------------------------------------

function spawnSetup(
  extraArgs: string[],
  overrideRoot?: string,
): { status: number | null; stdout: string; stderr: string } {
  const cliRoot = overrideRoot ?? root;

  const result = spawnSync(
    "node",
    [DIST_INDEX, "setup", "--root", cliRoot, ...extraArgs],
    { encoding: "utf8", timeout: 20_000 },
  );

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

// ---------------------------------------------------------------------------
// Scenario 1 — hima setup --runtime claude
// ---------------------------------------------------------------------------

describe("Scenario 1 — hima setup --runtime claude", () => {
  let setupResult: { status: number | null; stdout: string; stderr: string };

  beforeAll(() => {
    setupResult = spawnSetup(["--runtime", "claude"]);
  });

  it("exits 0", () => {
    expect(setupResult.status).toBe(0);
  });

  it("stdout contains a setup-complete message", () => {
    expect(setupResult.stdout).toContain("[hima setup]");
  });

  it("creates <root>/.claude/settings.json", () => {
    const settingsPath = path.join(root, ".claude", "settings.json");
    expect(existsSync(settingsPath)).toBe(true);
  });

  it("settings.json is valid JSON", () => {
    const settingsPath = path.join(root, ".claude", "settings.json");
    const raw = readFileSync(settingsPath, "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it("settings.json has exactly 9 hook events wired", () => {
    const settingsPath = path.join(root, ".claude", "settings.json");
    const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as Record<string, unknown>;
    const hooks = settings["hooks"] as Record<string, unknown>;

    for (const event of CLAUDE_HOOK_EVENTS) {
      const matchers = hooks[event] as Array<{ matcher: string; hooks: Array<{ type: string; command: string }> }>;
      expect(matchers, `Event ${event} should be wired`).toBeDefined();
      expect(matchers.length, `Event ${event} should have exactly 1 matcher`).toBe(1);
    }
  });

  it("each hook command references 'hook' and the CLI dist/index.js path", () => {
    const settingsPath = path.join(root, ".claude", "settings.json");
    const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as Record<string, unknown>;
    const hooks = settings["hooks"] as Record<string, unknown>;

    for (const event of CLAUDE_HOOK_EVENTS) {
      const matchers = hooks[event] as Array<{ hooks: Array<{ command: string }> }>;
      const cmd = matchers[0]?.hooks[0]?.command ?? "";
      // Command must reference "hook" (the hima hook subcommand)
      expect(cmd, `Event ${event} command should contain "hook"`).toContain("hook");
      // Command must reference the dist/index.js path (the CLI binary)
      expect(cmd, `Event ${event} command should reference dist/index.js`).toContain("dist/index.js");
      // Command must include --format claude
      expect(cmd, `Event ${event} command should include --format claude`).toContain("--format claude");
    }
  });

  it("creates <root>/.hima/state/ directory", () => {
    expect(existsSync(path.join(root, ".hima", "state"))).toBe(true);
  });

  it("creates <root>/.hima/config.json", () => {
    expect(existsSync(path.join(root, ".hima", "config.json"))).toBe(true);
  });

  it("config.json is valid JSON (empty object by default)", () => {
    const raw = readFileSync(path.join(root, ".hima", "config.json"), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    expect(parsed).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Scenario 2 — hima setup --fresh (trace file deleted, config.json preserved)
// ---------------------------------------------------------------------------

describe("Scenario 2 — hima setup --fresh", () => {
  /** Path to a planted trace file that --fresh must delete. */
  let tracePath: string;

  let freshResult: { status: number | null; stdout: string; stderr: string };

  beforeAll(() => {
    // Plant a fake trace file in .hima/state/trace/ so --fresh has something to delete.
    const traceDir = path.join(root, ".hima", "state", "trace");
    mkdirSync(traceDir, { recursive: true });
    tracePath = path.join(traceDir, "fake-session.jsonl");
    writeFileSync(tracePath, '{"event":"test"}\n');

    // Run --fresh.
    freshResult = spawnSetup(["--fresh"]);
  });

  it("exits 0", () => {
    expect(freshResult.status).toBe(0);
  });

  it("stdout mentions fresh reset", () => {
    // The setup module emits a message containing "fresh" or "Fresh".
    const combined = (freshResult.stdout + freshResult.stderr).toLowerCase();
    expect(combined).toContain("fresh");
  });

  it("the planted trace file is gone after --fresh", () => {
    expect(existsSync(tracePath)).toBe(false);
  });

  it("the trace directory itself is removed", () => {
    expect(existsSync(path.join(root, ".hima", "state", "trace"))).toBe(false);
  });

  it("config.json is still present (user data preserved)", () => {
    expect(existsSync(path.join(root, ".hima", "config.json"))).toBe(true);
  });

  it("config.json content is unchanged", () => {
    const raw = readFileSync(path.join(root, ".hima", "config.json"), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    // The first run wrote {}, --fresh must not overwrite it.
    expect(parsed).toEqual({});
  });

  it(".hima/state/ is re-created after --fresh (scaffold re-runs)", () => {
    expect(existsSync(path.join(root, ".hima", "state"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Safety — unknown runtime flag does not crash the CLI
// ---------------------------------------------------------------------------

describe("Safety — hima setup handles edge cases", () => {
  it("--runtime without value falls back to auto-detect (exit 0)", () => {
    // --runtime missing value: the parser ignores it and falls back to auto-detect.
    const r = mkdtempSync(path.join(tmpdir(), "hima-e2e-setup-safety-"));
    try {
      mkdirSync(path.join(r, ".claude"), { recursive: true });
      const result = spawnSync(
        "node",
        [DIST_INDEX, "setup", "--root", r, "--runtime"],
        { encoding: "utf8", timeout: 10_000 },
      );
      // Should still exit 0 — fallback to auto-detect.
      expect(result.status).toBe(0);
    } finally {
      rmSync(r, { recursive: true, force: true });
    }
  });

  it("setup on a brand-new empty root exits 0 and creates the scaffold", () => {
    const r = mkdtempSync(path.join(tmpdir(), "hima-e2e-setup-empty-"));
    try {
      const result = spawnSync(
        "node",
        [DIST_INDEX, "setup", "--root", r],
        { encoding: "utf8", timeout: 10_000 },
      );
      expect(result.status).toBe(0);
      expect(existsSync(path.join(r, ".hima", "config.json"))).toBe(true);
      expect(existsSync(path.join(r, ".hima", "state"))).toBe(true);
    } finally {
      rmSync(r, { recursive: true, force: true });
    }
  });
});
