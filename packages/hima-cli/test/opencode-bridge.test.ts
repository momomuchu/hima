/**
 * opencode-bridge.test.ts — unit tests for
 * packages/hima-cli/src/opencode-bridge/core.mjs (pure + injectable-I/O logic)
 * and norm-opencode-plugin.mjs (the thin @opencode-ai/plugin factory).
 *
 * Three layers:
 *   1. Pure-function tests (normalizeToolName, normalizeToolInput,
 *      buildPreToolPayload, extractBlockReason, interpretPreToolResult,
 *      extractSessionCreatedInfo) — no process I/O at all.
 *   2. Injected-spawnNorm tests (runToolExecuteBefore, runSessionEvent) —
 *      covers payload mapping, norm exit-2 -> NormBlockError throw, norm
 *      error -> does NOT throw (fail-open), and delegation-event marking.
 *   3. One real end-to-end spawn test using a temp stub script as NORM_BIN
 *      (task ask: "Mock norm with a tiny stub script for determinism"),
 *      proving createRealSpawnNorm's actual node:child_process wiring behaves
 *      identically through the full NormOpenCodePlugin factory.
 *
 * NOTE (2026-07-06 live-verified bug fix): the plugin logic is split across
 * two files — core.mjs (everything below) and norm-opencode-plugin.mjs (the
 * factory only) — because OpenCode's real plugin loader throws and discards
 * the WHOLE plugin if ANY export in the file it loads isn't a function (see
 * core.mjs's header for the full empirical trace). This test file therefore
 * imports pure/injectable helpers from core.mjs and the actual factory from
 * norm-opencode-plugin.mjs, mirroring the real module boundary.
 */

import { mkdtempSync, rmSync, writeFileSync, chmodSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  NormBlockError,
  WRITE_TOOL_MAP,
  normalizeToolName,
  normalizeToolInput,
  buildPreToolPayload,
  extractBlockReason,
  interpretPreToolResult,
  extractSessionCreatedInfo,
  runToolExecuteBefore,
  runSessionEvent,
  createRealSpawnNorm,
} from "../src/opencode-bridge/core.mjs";
import { NormOpenCodePlugin } from "../src/opencode-bridge/norm-opencode-plugin.mjs";

// ---------------------------------------------------------------------------
// normalizeToolName
// ---------------------------------------------------------------------------

describe("normalizeToolName", () => {
  it("maps OpenCode's lowercase write-tool ids to Claude's PascalCase names", () => {
    expect(normalizeToolName("write")).toBe("Write");
    expect(normalizeToolName("edit")).toBe("Edit");
    expect(normalizeToolName("patch")).toBe("MultiEdit");
    expect(normalizeToolName("multiedit")).toBe("MultiEdit");
    expect(normalizeToolName("apply_patch")).toBe("MultiEdit");
    expect(normalizeToolName("ApplyPatch")).toBe("MultiEdit");
  });

  it("is case-insensitive on the input", () => {
    expect(normalizeToolName("WRITE")).toBe("Write");
    expect(normalizeToolName("Edit")).toBe("Edit");
  });

  it("passes non-write tool ids through unchanged", () => {
    expect(normalizeToolName("bash")).toBe("bash");
    expect(normalizeToolName("read")).toBe("read");
    expect(normalizeToolName("task")).toBe("task");
  });

  it("handles undefined/null defensively — passes the original value through unchanged (not in the map)", () => {
    expect(normalizeToolName(undefined)).toBeUndefined();
    expect(normalizeToolName(null)).toBeNull();
  });

  it("WRITE_TOOL_MAP covers exactly the expected keys", () => {
    expect(Object.keys(WRITE_TOOL_MAP).sort()).toEqual(["apply_patch", "applypatch", "edit", "multiedit", "patch", "write"]);
  });
});

// ---------------------------------------------------------------------------
// normalizeToolInput
// ---------------------------------------------------------------------------

describe("normalizeToolInput", () => {
  it("adds file_path alongside filePath (live-verified OpenCode write-tool arg shape)", () => {
    const result = normalizeToolInput({ filePath: "/abs/hello.txt", content: "hi" });
    expect(result).toEqual({ filePath: "/abs/hello.txt", content: "hi", file_path: "/abs/hello.txt" });
  });

  it("does not overwrite an existing file_path key", () => {
    const result = normalizeToolInput({ filePath: "/abs/a.txt", file_path: "/abs/b.txt" });
    expect(result.file_path).toBe("/abs/b.txt");
  });

  it("passes args without filePath through unchanged", () => {
    const args = { command: "ls -la" };
    expect(normalizeToolInput(args)).toEqual(args);
  });

  it("handles null/undefined/non-object args defensively", () => {
    expect(normalizeToolInput(null)).toBeNull();
    expect(normalizeToolInput(undefined)).toBeUndefined();
    expect(normalizeToolInput("weird")).toBe("weird");
    expect(normalizeToolInput([1, 2])).toEqual([1, 2]);
  });
});

// ---------------------------------------------------------------------------
// buildPreToolPayload
// ---------------------------------------------------------------------------

describe("buildPreToolPayload", () => {
  it("maps a real-shaped OpenCode write tool.execute.before call to the Claude-style payload", () => {
    const payload = buildPreToolPayload(
      { tool: "write", sessionID: "ses_abc", callID: "tool_1" },
      { args: { filePath: "/proj/src/util.ts", content: "export {}" } },
    );
    expect(payload).toEqual({
      hook_event_name: "PreToolUse",
      tool_name: "Write",
      tool_input: { filePath: "/proj/src/util.ts", content: "export {}", file_path: "/proj/src/util.ts" },
      session_id: "ses_abc",
    });
  });

  it("maps a Bash-equivalent (opencode 'bash') call, tool name unchanged", () => {
    const payload = buildPreToolPayload(
      { tool: "bash", sessionID: "ses_xyz", callID: "tool_2" },
      { args: { command: "echo hi" } },
    );
    expect(payload.tool_name).toBe("bash");
    expect(payload.tool_input).toEqual({ command: "echo hi" });
    expect(payload.session_id).toBe("ses_xyz");
    expect(payload.hook_event_name).toBe("PreToolUse");
  });
});

// ---------------------------------------------------------------------------
// extractBlockReason
// ---------------------------------------------------------------------------

describe("extractBlockReason", () => {
  it("extracts the reason field from norm's block stdout", () => {
    expect(extractBlockReason(JSON.stringify({ decision: "block", reason: "skill required" }), "fallback")).toBe(
      "skill required",
    );
  });

  it("falls back on unparsable stdout", () => {
    expect(extractBlockReason("not json", "fallback")).toBe("fallback");
  });

  it("falls back on empty stdout", () => {
    expect(extractBlockReason("", "fallback")).toBe("fallback");
    expect(extractBlockReason(undefined, "fallback")).toBe("fallback");
  });

  it("falls back when reason is missing or not a string", () => {
    expect(extractBlockReason(JSON.stringify({ decision: "block" }), "fallback")).toBe("fallback");
    expect(extractBlockReason(JSON.stringify({ reason: 123 }), "fallback")).toBe("fallback");
  });
});

// ---------------------------------------------------------------------------
// interpretPreToolResult
// ---------------------------------------------------------------------------

describe("interpretPreToolResult", () => {
  it("exit 2 -> block with extracted reason", () => {
    const verdict = interpretPreToolResult({
      status: 2,
      stdout: JSON.stringify({ decision: "block", reason: "DELEGATION_FIRST" }),
      stderr: "",
    });
    expect(verdict).toEqual({ block: true, reason: "DELEGATION_FIRST" });
  });

  it("exit 0 -> allow, no warning", () => {
    const verdict = interpretPreToolResult({ status: 0, stdout: "", stderr: "" });
    expect(verdict).toEqual({ block: false, warning: null });
  });

  it("spawn error -> allow (fail-open) with a warning", () => {
    const verdict = interpretPreToolResult({ error: new Error("spawn norm ENOENT"), status: null, stdout: "", stderr: "" });
    expect(verdict.block).toBe(false);
    expect(verdict.warning).toContain("ENOENT");
  });

  it("unexpected non-zero, non-2 exit code -> allow (fail-open) with a warning", () => {
    const verdict = interpretPreToolResult({ status: 1, stdout: "", stderr: "boom" });
    expect(verdict.block).toBe(false);
    expect(verdict.warning).toContain("1");
  });
});

// ---------------------------------------------------------------------------
// extractSessionCreatedInfo
// ---------------------------------------------------------------------------

describe("extractSessionCreatedInfo", () => {
  it("extracts {id, parentID} from a child session.created event (live-verified shape)", () => {
    const info = extractSessionCreatedInfo({
      type: "session.created",
      properties: { info: { id: "ses_child", parentID: "ses_parent", title: "..." } },
    });
    expect(info).toEqual({ id: "ses_child", parentID: "ses_parent" });
  });

  it("extracts {id, parentID:undefined} for a top-level session (no parentID)", () => {
    const info = extractSessionCreatedInfo({
      type: "session.created",
      properties: { info: { id: "ses_top" } },
    });
    expect(info).toEqual({ id: "ses_top", parentID: undefined });
  });

  it("returns null for a non-session.created event", () => {
    expect(extractSessionCreatedInfo({ type: "tui.toast.show", properties: {} })).toBeNull();
  });

  it("returns null defensively on malformed/missing payloads", () => {
    expect(extractSessionCreatedInfo(undefined)).toBeNull();
    expect(extractSessionCreatedInfo({ type: "session.created" })).toBeNull();
    expect(extractSessionCreatedInfo({ type: "session.created", properties: { info: {} } })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// runToolExecuteBefore — injected spawnNorm
// ---------------------------------------------------------------------------

describe("runToolExecuteBefore — injected spawnNorm", () => {
  it("does not throw on allow (exit 0)", async () => {
    let capturedEvent = "";
    let capturedRoot = "";
    await expect(
      runToolExecuteBefore({
        input: { tool: "write", sessionID: "s1" },
        output: { args: { filePath: "/proj/a.ts" } },
        root: "/proj",
        spawnNorm: async (event, payload, root) => {
          capturedEvent = event;
          capturedRoot = root;
          return { status: 0, stdout: "", stderr: "" };
        },
      }),
    ).resolves.toBeUndefined();
    expect(capturedEvent).toBe("pre-tool-use");
    expect(capturedRoot).toBe("/proj");
  });

  it("throws NormBlockError on norm exit-2, with the extracted reason as the message", async () => {
    await expect(
      runToolExecuteBefore({
        input: { tool: "write", sessionID: "s1" },
        output: { args: { filePath: "/proj/a.ts" } },
        root: "/proj",
        spawnNorm: async () => ({
          status: 2,
          stdout: JSON.stringify({ decision: "block", reason: "[BEH-DELEGATION-FIRST] BLOCKED" }),
          stderr: "",
        }),
      }),
    ).rejects.toThrow(NormBlockError);

    await expect(
      runToolExecuteBefore({
        input: { tool: "write", sessionID: "s1" },
        output: { args: { filePath: "/proj/a.ts" } },
        root: "/proj",
        spawnNorm: async () => ({
          status: 2,
          stdout: JSON.stringify({ decision: "block", reason: "[BEH-DELEGATION-FIRST] BLOCKED" }),
          stderr: "",
        }),
      }),
    ).rejects.toThrow("[BEH-DELEGATION-FIRST] BLOCKED");
  });

  it("does NOT throw when spawnNorm rejects (norm not found / crashed) — fails open", async () => {
    await expect(
      runToolExecuteBefore({
        input: { tool: "write", sessionID: "s1" },
        output: { args: { filePath: "/proj/a.ts" } },
        root: "/proj",
        spawnNorm: async () => {
          throw new Error("spawn norm ENOENT");
        },
      }),
    ).resolves.toBeUndefined();
  });

  it("passes the normalized payload (Write + file_path) to spawnNorm", async () => {
    let capturedPayload: any = null;
    await runToolExecuteBefore({
      input: { tool: "write", sessionID: "s1" },
      output: { args: { filePath: "/proj/src/util.ts", content: "x" } },
      root: "/proj",
      spawnNorm: async (_event, payload) => {
        capturedPayload = payload;
        return { status: 0, stdout: "", stderr: "" };
      },
    });
    expect(capturedPayload).toEqual({
      hook_event_name: "PreToolUse",
      tool_name: "Write",
      tool_input: { filePath: "/proj/src/util.ts", content: "x", file_path: "/proj/src/util.ts" },
      session_id: "s1",
    });
  });
});

// ---------------------------------------------------------------------------
// runSessionEvent — injected spawnNorm, scoped delegation marking
// ---------------------------------------------------------------------------

describe("runSessionEvent — delegation marking via session.created", () => {
  it("a child session.created (parentID set) calls norm hook subagent-start", async () => {
    let capturedEvent = "";
    let capturedPayload: any = null;
    const result = await runSessionEvent({
      event: { type: "session.created", properties: { info: { id: "ses_child", parentID: "ses_parent" } } },
      root: "/proj",
      spawnNorm: async (event, payload) => {
        capturedEvent = event;
        capturedPayload = payload;
        return { status: 0, stdout: "", stderr: "" };
      },
    });
    expect(result).toEqual({ called: "subagent-start" });
    expect(capturedEvent).toBe("subagent-start");
    expect(capturedPayload).toEqual({ hook_event_name: "SubagentStart", session_id: "ses_child" });
  });

  it("a top-level session.created (no parentID) calls norm hook session-start", async () => {
    let capturedEvent = "";
    const result = await runSessionEvent({
      event: { type: "session.created", properties: { info: { id: "ses_top" } } },
      root: "/proj",
      spawnNorm: async (event) => {
        capturedEvent = event;
        return { status: 0, stdout: "", stderr: "" };
      },
    });
    expect(result).toEqual({ called: "session-start" });
    expect(capturedEvent).toBe("session-start");
  });

  it("a non-session.created event calls norm nothing", async () => {
    let called = false;
    const result = await runSessionEvent({
      event: { type: "tui.toast.show", properties: {} },
      root: "/proj",
      spawnNorm: async () => {
        called = true;
        return { status: 0, stdout: "", stderr: "" };
      },
    });
    expect(result).toEqual({ called: null });
    expect(called).toBe(false);
  });

  it("never throws even when spawnNorm rejects", async () => {
    await expect(
      runSessionEvent({
        event: { type: "session.created", properties: { info: { id: "ses_child", parentID: "ses_parent" } } },
        root: "/proj",
        spawnNorm: async () => {
          throw new Error("boom");
        },
      }),
    ).resolves.toEqual({ called: "subagent-start" });
  });
});

// ---------------------------------------------------------------------------
// NormOpenCodePlugin — the full factory, injected root, real spawnNorm swapped
// for an inline stub via monkeypatched process.env (exercises the actual
// tool.execute.before/event closures wired together).
// ---------------------------------------------------------------------------

describe("NormOpenCodePlugin — factory wiring (stub norm via NORM_BIN)", () => {
  let dir: string;
  let stubNormPath: string;
  const savedEnv: Record<string, string | undefined> = {};

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "opencode-bridge-plugin-"));
    stubNormPath = path.join(dir, "stub-norm.mjs");
    writeFileSync(
      stubNormPath,
      `#!/usr/bin/env node
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const raw = Buffer.concat(chunks).toString("utf8");
let payload = {};
try { payload = JSON.parse(raw); } catch {}
const toolName = payload.tool_name ?? "";
if (toolName === "Write") {
  process.stdout.write(JSON.stringify({ decision: "block", reason: "stub-norm: Delegation-First block" }));
  process.exit(2);
}
process.exit(0);
`,
      "utf8",
    );
    chmodSync(stubNormPath, 0o755);
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  beforeEach(() => {
    savedEnv.NORM_BIN = process.env.NORM_BIN;
    savedEnv.NORM_OPENCODE_FORMAT = process.env.NORM_OPENCODE_FORMAT;
    process.env.NORM_BIN = stubNormPath;
  });

  afterEach(() => {
    // Use delete (not assignment) for a previously-unset var: assigning
    // `undefined` to a process.env key coerces it to the STRING "undefined",
    // which would leak into later tests' `process.env.X || default` checks.
    if (savedEnv.NORM_BIN === undefined) delete process.env.NORM_BIN;
    else process.env.NORM_BIN = savedEnv.NORM_BIN;
    if (savedEnv.NORM_OPENCODE_FORMAT === undefined) delete process.env.NORM_OPENCODE_FORMAT;
    else process.env.NORM_OPENCODE_FORMAT = savedEnv.NORM_OPENCODE_FORMAT;
  });

  it("uses input.directory (not worktree) as the project root", async () => {
    const hooks = await NormOpenCodePlugin({ directory: dir, worktree: "/", client: {}, project: {}, $: {} } as any);
    // A read tool call should allow (stub only blocks Write).
    await expect(hooks["tool.execute.before"]!({ tool: "read", sessionID: "s" } as any, { args: { filePath: "/x" } } as any)).resolves.toBeUndefined();
  });

  it("throws on a write tool call (Delegation-First-style block simulated by the stub)", async () => {
    const hooks = await NormOpenCodePlugin({ directory: dir, worktree: "/", client: {}, project: {}, $: {} } as any);
    await expect(
      hooks["tool.execute.before"]!({ tool: "write", sessionID: "s" } as any, { args: { filePath: "/x/hello.ts", content: "x" } } as any),
    ).rejects.toThrow(/Delegation-First/);
  });

  it("does not throw for a non-write tool even through the real spawn path", async () => {
    const hooks = await NormOpenCodePlugin({ directory: dir, worktree: "/", client: {}, project: {}, $: {} } as any);
    await expect(
      hooks["tool.execute.before"]!({ tool: "bash", sessionID: "s" } as any, { args: { command: "ls" } } as any),
    ).resolves.toBeUndefined();
  });

  it("fails open when NORM_BIN points at a nonexistent binary", async () => {
    process.env.NORM_BIN = "/definitely/does/not/exist/norm";
    const hooks = await NormOpenCodePlugin({ directory: dir, worktree: "/", client: {}, project: {}, $: {} } as any);
    await expect(
      hooks["tool.execute.before"]!({ tool: "write", sessionID: "s" } as any, { args: { filePath: "/x/hello.ts" } } as any),
    ).resolves.toBeUndefined();
  });

  it("event hook never throws for a session.created event, even with a blocking stub", async () => {
    const hooks = await NormOpenCodePlugin({ directory: dir, worktree: "/", client: {}, project: {}, $: {} } as any);
    await expect(
      hooks.event!({ event: { type: "session.created", properties: { info: { id: "c1", parentID: "p1" } } } } as any),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// createRealSpawnNorm — real process, stub norm binary (task ask: "mock norm
// with a tiny stub script for determinism")
// ---------------------------------------------------------------------------

describe("createRealSpawnNorm — real child_process.spawn, stubbed norm binary", () => {
  let dir: string;
  let stubNormPath: string;
  let logPath: string;
  const savedEnv: Record<string, string | undefined> = {};

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "opencode-bridge-spawn-"));
    logPath = path.join(dir, "stub.log");
    stubNormPath = path.join(dir, "stub-norm.mjs");
    writeFileSync(
      stubNormPath,
      `#!/usr/bin/env node
import { appendFileSync } from "node:fs";
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const raw = Buffer.concat(chunks).toString("utf8");
appendFileSync(${JSON.stringify(logPath)}, JSON.stringify({ argv: process.argv.slice(2), stdin: raw }) + "\\n");
let payload = {};
try { payload = JSON.parse(raw); } catch {}
if (payload.tool_name === "Write") {
  process.stdout.write(JSON.stringify({ decision: "block", reason: "stub blocked Write" }));
  process.exit(2);
}
process.exit(0);
`,
      "utf8",
    );
    chmodSync(stubNormPath, 0o755);
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  beforeEach(() => {
    savedEnv.NORM_BIN = process.env.NORM_BIN;
    process.env.NORM_BIN = stubNormPath;
  });

  afterEach(() => {
    if (savedEnv.NORM_BIN === undefined) delete process.env.NORM_BIN;
    else process.env.NORM_BIN = savedEnv.NORM_BIN;
  });

  it("spawns the stub, feeds JSON stdin, and resolves {status:2, stdout} on block", async () => {
    const spawnNorm = createRealSpawnNorm();
    const result = await spawnNorm("pre-tool-use", { hook_event_name: "PreToolUse", tool_name: "Write" }, dir);
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout)).toEqual({ decision: "block", reason: "stub blocked Write" });
  });

  it("resolves {status:0} on allow", async () => {
    const spawnNorm = createRealSpawnNorm();
    const result = await spawnNorm("pre-tool-use", { hook_event_name: "PreToolUse", tool_name: "bash" }, dir);
    expect(result.status).toBe(0);
  });

  it("passes the correct CLI args: hook <event> --format opencode --root <root>", async () => {
    const spawnNorm = createRealSpawnNorm();
    await spawnNorm("subagent-start", { hook_event_name: "SubagentStart", session_id: "s1" }, dir);
    const lines = readFileSync(logPath, "utf8").trim().split("\n");
    const last = JSON.parse(lines[lines.length - 1]!);
    expect(last.argv).toEqual(["hook", "subagent-start", "--format", "opencode", "--root", dir]);
    expect(JSON.parse(last.stdin)).toEqual({ hook_event_name: "SubagentStart", session_id: "s1" });
  });

  it("honors NORM_OPENCODE_FORMAT override", async () => {
    process.env.NORM_OPENCODE_FORMAT = "claude";
    try {
      const spawnNorm = createRealSpawnNorm();
      await spawnNorm("pre-tool-use", { hook_event_name: "PreToolUse", tool_name: "bash" }, dir);
      const lines = readFileSync(logPath, "utf8").trim().split("\n");
      const last = JSON.parse(lines[lines.length - 1]!);
      expect(last.argv).toContain("claude");
    } finally {
      delete process.env.NORM_OPENCODE_FORMAT;
    }
  });

  it("resolves {error} (never rejects) when NORM_BIN is nonexistent", async () => {
    process.env.NORM_BIN = "/definitely/does/not/exist/norm-xyz";
    const spawnNorm = createRealSpawnNorm();
    const result = await spawnNorm("pre-tool-use", { hook_event_name: "PreToolUse" }, dir);
    expect(result.status).toBeNull();
    expect(result.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// REGRESSION GUARD — every export of norm-opencode-plugin.mjs must be a
// function (or {server: fn}).
//
// Live-verified 2026-07-06: OpenCode's real plugin loader (traced from the
// installed opencode 1.16.2 binary via `strings` — see core.mjs's header)
// falls back to iterating EVERY exported value of the loaded module and
// THROWS — discarding the entire plugin, silently, with only a log line —
// if any single exported value fails `typeof x === "function"` (and isn't
// `{server: fn}`). An earlier version of this bridge exported a plain object
// constant (WRITE_TOOL_MAP) directly from the plugin file and failed to load
// for exactly this reason. This test encodes that exact constraint so a
// future edit that reintroduces a non-function export from
// norm-opencode-plugin.mjs fails LOUDLY here instead of silently bricking
// governance in a live OpenCode session.
// ---------------------------------------------------------------------------

describe("REGRESSION GUARD — norm-opencode-plugin.mjs export shape", () => {
  it("every exported value from the installed plugin file is a function (mirrors OpenCode's loader check)", async () => {
    const mod = await import("../src/opencode-bridge/norm-opencode-plugin.mjs");
    const values = Object.values(mod);
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      const isFunction = typeof value === "function";
      const isServerObject =
        value !== null && typeof value === "object" && "server" in value && typeof (value as any).server === "function";
      expect(isFunction || isServerObject).toBe(true);
    }
  });

  it("exports exactly one distinct function value (named + default are the same reference)", async () => {
    const mod = await import("../src/opencode-bridge/norm-opencode-plugin.mjs");
    const distinctValues = new Set(Object.values(mod));
    expect(distinctValues.size).toBe(1);
    expect(mod.default).toBe(mod.NormOpenCodePlugin);
  });
});
