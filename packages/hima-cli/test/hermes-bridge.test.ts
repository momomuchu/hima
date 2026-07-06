/**
 * hermes-bridge.test.ts — unit tests for
 * packages/hima-cli/src/hermes-bridge/norm-hermes-hook.mjs.
 *
 * Two layers:
 *   1. Pure-function tests (parseHermesPayload, buildClaudePayload,
 *      resolveRoot, interpretNormResult) — no process I/O at all.
 *   2. `runBridge` tests with an injected `spawn` — covers payload mapping,
 *      norm exit-2 → {action:block,message}, norm error → allow (fail-open),
 *      and the subagent_start "ignored by Hermes" path.
 *   3. One real end-to-end spawn test using a temp stub script as `NORM_BIN`
 *      (task ask: "Mock norm with a stub"), proving the actual spawnSync
 *      wiring in the real CLI entry point behaves identically.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  EVENT_MAP,
  ALLOW_BODY,
  HERMES_TOOL_MAP,
  parseHermesPayload,
  resolveEventMapping,
  normalizeHermesTool,
  buildClaudePayload,
  resolveRoot,
  interpretNormResult,
  runBridge,
} from "../src/hermes-bridge/norm-hermes-hook.mjs";

/** Mirrors router.ts WRITE_TOOL_NAMES — kept local so this test doesn't need
 * to import a .ts file into a .mjs-consuming suite; just a plain assertion
 * helper for "this tool name would trip Norm's write gate". */
const CLAUDE_WRITE_TOOL_NAMES = new Set(["Write", "Edit", "MultiEdit"]);

// ---------------------------------------------------------------------------
// parseHermesPayload
// ---------------------------------------------------------------------------

describe("parseHermesPayload", () => {
  it("parses a valid pre_tool_call envelope", () => {
    const result = parseHermesPayload(
      JSON.stringify({
        hook_event_name: "pre_tool_call",
        tool_name: "terminal",
        tool_input: { command: "rm -rf /" },
        session_id: "sess_abc123",
        cwd: "/home/user/project",
        extra: {},
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.tool_name).toBe("terminal");
      expect(result.payload.session_id).toBe("sess_abc123");
    }
  });

  it("fails open on empty stdin", () => {
    const result = parseHermesPayload("");
    expect(result.ok).toBe(false);
  });

  it("fails open on malformed JSON", () => {
    const result = parseHermesPayload("{{not valid json}}");
    expect(result.ok).toBe(false);
  });

  it("fails open on a JSON array (not an object)", () => {
    const result = parseHermesPayload("[1,2,3]");
    expect(result.ok).toBe(false);
  });

  it("fails open on JSON null", () => {
    const result = parseHermesPayload("null");
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveEventMapping / EVENT_MAP
// ---------------------------------------------------------------------------

describe("resolveEventMapping", () => {
  it("maps pre_tool_call -> pre-tool-use / PreToolUse", () => {
    const mapping = resolveEventMapping("pre_tool_call");
    expect(mapping).toEqual(EVENT_MAP.pre_tool_call);
    expect(mapping?.normEvent).toBe("pre-tool-use");
    expect(mapping?.claudeHookEventName).toBe("PreToolUse");
  });

  it("maps subagent_start -> subagent-start / SubagentStart", () => {
    const mapping = resolveEventMapping("subagent_start");
    expect(mapping?.normEvent).toBe("subagent-start");
    expect(mapping?.claudeHookEventName).toBe("SubagentStart");
  });

  it("returns undefined for an unregistered event (e.g. pre_llm_call)", () => {
    expect(resolveEventMapping("pre_llm_call")).toBeUndefined();
  });

  it("returns undefined for an empty/unknown event name", () => {
    expect(resolveEventMapping("")).toBeUndefined();
    expect(resolveEventMapping("bogus_event")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// normalizeHermesTool — Hermes native tool names/inputs -> Claude vocabulary
// ---------------------------------------------------------------------------
//
// Ground truth (see norm-hermes-hook.mjs HERMES_TOOL_MAP header comment for
// full citation): Hermes's file toolset registers FOUR distinct top-level
// tools (read_file, write_file, patch, search_files) — not one "file" tool
// with a read/write flag — so there is no schema ambiguity between a read and
// a write call; only `patch`'s two internal modes need a documented
// assumption (see PATCH_ASSUMPTION in the source).

describe("normalizeHermesTool", () => {
  it("write_file -> Write, with file_path carried from 'path' (content untouched)", () => {
    const result = normalizeHermesTool("write_file", { path: "src/util.ts", content: "export {}" });
    expect(result.tool_name).toBe("Write");
    expect(CLAUDE_WRITE_TOOL_NAMES.has(result.tool_name)).toBe(true);
    expect(result.tool_input).toEqual({
      path: "src/util.ts",
      content: "export {}",
      file_path: "src/util.ts",
    });
  });

  it("patch (mode='replace') -> Edit, with file_path carried from 'path'", () => {
    const result = normalizeHermesTool("patch", {
      mode: "replace",
      path: "src/util.ts",
      old_string: "foo",
      new_string: "bar",
    });
    expect(result.tool_name).toBe("Edit");
    expect(CLAUDE_WRITE_TOOL_NAMES.has(result.tool_name)).toBe(true);
    expect(result.tool_input.file_path).toBe("src/util.ts");
  });

  it("patch (mode='patch', multi-file V4A, no top-level path) -> Edit, file_path best-effort extracted from the patch header", () => {
    const v4aPatch = [
      "*** Begin Patch",
      "*** Update File: src/a.ts",
      "@@ context @@",
      "-old",
      "+new",
      "*** End Patch",
    ].join("\n");
    const result = normalizeHermesTool("patch", { mode: "patch", patch: v4aPatch });
    expect(result.tool_name).toBe("Edit");
    expect(CLAUDE_WRITE_TOOL_NAMES.has(result.tool_name)).toBe(true);
    expect(result.tool_input.file_path).toBe("src/a.ts");
  });

  it("patch (mode='patch') with no parsable header still maps to Edit (write gate stays live), file_path left undefined", () => {
    const result = normalizeHermesTool("patch", { mode: "patch", patch: "*** Begin Patch\nnonsense\n*** End Patch" });
    expect(result.tool_name).toBe("Edit");
    expect(result.tool_input.file_path).toBeUndefined();
  });

  it("read_file -> Read (non-write name), file_path carried from 'path' — MUST NOT be treated as a write", () => {
    const result = normalizeHermesTool("read_file", { path: "README.md", offset: 1, limit: 500 });
    expect(result.tool_name).toBe("Read");
    expect(CLAUDE_WRITE_TOOL_NAMES.has(result.tool_name)).toBe(false);
    expect(result.tool_input.file_path).toBe("README.md");
  });

  it("search_files -> passthrough unchanged (non-write, no Claude equivalent claimed)", () => {
    const result = normalizeHermesTool("search_files", { pattern: "TODO", target: "content" });
    expect(result.tool_name).toBe("search_files");
    expect(CLAUDE_WRITE_TOOL_NAMES.has(result.tool_name)).toBe(false);
    expect(result.tool_input).toEqual({ pattern: "TODO", target: "content" });
  });

  it("terminal -> Bash, 'command' field carried through unchanged (already matches Claude's Bash shape)", () => {
    const result = normalizeHermesTool("terminal", { command: "rm -rf /", background: false });
    expect(result.tool_name).toBe("Bash");
    expect(result.tool_input).toEqual({ command: "rm -rf /", background: false });
  });

  it("unknown/unmapped tool name -> passthrough unchanged", () => {
    const result = normalizeHermesTool("some_future_tool", { anything: 1 });
    expect(result.tool_name).toBe("some_future_tool");
    expect(result.tool_input).toEqual({ anything: 1 });
  });

  it("null tool_name/tool_input (non-tool events, e.g. subagent_start) -> passthrough null/null", () => {
    const result = normalizeHermesTool(null, null);
    expect(result.tool_name).toBeNull();
    expect(result.tool_input).toBeNull();
  });

  it("already-Claude-shaped tool_name (e.g. 'Write') is not double-mapped — passthrough", () => {
    const result = normalizeHermesTool("Write", { file_path: "a.ts", content: "x" });
    expect(result.tool_name).toBe("Write");
    expect(result.tool_input).toEqual({ file_path: "a.ts", content: "x" });
  });

  it("HERMES_TOOL_MAP contains exactly the ground-truthed Hermes tool names", () => {
    expect(HERMES_TOOL_MAP).toEqual({
      read_file: "Read",
      write_file: "Write",
      patch: "Edit",
      terminal: "Bash",
    });
  });
});

// ---------------------------------------------------------------------------
// buildClaudePayload
// ---------------------------------------------------------------------------

describe("buildClaudePayload", () => {
  it("maps a pre_tool_call payload to Claude shape", () => {
    const mapping = resolveEventMapping("pre_tool_call")!;
    const claudePayload = buildClaudePayload(
      {
        hook_event_name: "pre_tool_call",
        tool_name: "Write",
        tool_input: { file_path: "src/util.ts", content: "export {}" },
        session_id: "sess_abc123",
        cwd: "/project",
        extra: {},
      },
      mapping,
    );
    expect(claudePayload).toEqual({
      hook_event_name: "PreToolUse",
      tool_name: "Write",
      tool_input: { file_path: "src/util.ts", content: "export {}" },
      session_id: "sess_abc123",
    });
  });

  it("maps subagent_start's parent_session_id-derived session_id through unchanged", () => {
    // Per agent/shell_hooks.py::_serialize_payload, Hermes already resolves
    // session_id = kwargs.session_id || kwargs.parent_session_id — so the
    // wire payload's top-level session_id is already correct; the bridge
    // must not re-derive it from `extra`.
    const mapping = resolveEventMapping("subagent_start")!;
    const claudePayload = buildClaudePayload(
      {
        hook_event_name: "subagent_start",
        tool_name: null,
        tool_input: null,
        session_id: "parent-sess-1",
        cwd: "/project",
        extra: { child_role: "executor", child_session_id: "child-sess-2" },
      },
      mapping,
    );
    expect(claudePayload.hook_event_name).toBe("SubagentStart");
    expect(claudePayload.session_id).toBe("parent-sess-1");
    expect(claudePayload.tool_name).toBeNull();
    expect(claudePayload.tool_input).toBeNull();
  });

  it("normalizes a real Hermes write_file tool call to Write/file_path (the bug this fixes: without normalization the write gate was dark for Hermes)", () => {
    const mapping = resolveEventMapping("pre_tool_call")!;
    const claudePayload = buildClaudePayload(
      {
        hook_event_name: "pre_tool_call",
        tool_name: "write_file",
        tool_input: { path: "src/util.ts", content: "export {}" },
        session_id: "sess_abc123",
        cwd: "/project",
        extra: {},
      },
      mapping,
    );
    expect(claudePayload.tool_name).toBe("Write");
    expect(claudePayload.tool_input).toEqual({
      path: "src/util.ts",
      content: "export {}",
      file_path: "src/util.ts",
    });
  });

  it("normalizes a real Hermes read_file tool call to Read — must NOT become Write/Edit", () => {
    const mapping = resolveEventMapping("pre_tool_call")!;
    const claudePayload = buildClaudePayload(
      {
        hook_event_name: "pre_tool_call",
        tool_name: "read_file",
        tool_input: { path: "README.md" },
        session_id: "sess_abc123",
      },
      mapping,
    );
    expect(claudePayload.tool_name).toBe("Read");
    expect(claudePayload.tool_name).not.toBe("Write");
    expect(claudePayload.tool_name).not.toBe("Edit");
  });

  it("normalizes a real Hermes terminal tool call to Bash", () => {
    const mapping = resolveEventMapping("pre_tool_call")!;
    const claudePayload = buildClaudePayload(
      {
        hook_event_name: "pre_tool_call",
        tool_name: "terminal",
        tool_input: { command: "ls -la" },
        session_id: "sess_abc123",
      },
      mapping,
    );
    expect(claudePayload.tool_name).toBe("Bash");
    expect(claudePayload.tool_input).toEqual({ command: "ls -la" });
  });

  it("falls back to 'unknown-session' when session_id is missing/empty", () => {
    const mapping = resolveEventMapping("pre_tool_call")!;
    const claudePayload = buildClaudePayload(
      { hook_event_name: "pre_tool_call", tool_name: "Read", tool_input: {}, session_id: "" },
      mapping,
    );
    expect(claudePayload.session_id).toBe("unknown-session");
  });
});

// ---------------------------------------------------------------------------
// resolveRoot
// ---------------------------------------------------------------------------

describe("resolveRoot", () => {
  it("prefers HIMA_PROJECT_ROOT over payload.cwd and process cwd", () => {
    const root = resolveRoot({ cwd: "/from/payload" }, { HIMA_PROJECT_ROOT: "/from/env" }, "/from/process");
    expect(root).toBe("/from/env");
  });

  it("falls back to payload.cwd when HIMA_PROJECT_ROOT is unset", () => {
    const root = resolveRoot({ cwd: "/from/payload" }, {}, "/from/process");
    expect(root).toBe("/from/payload");
  });

  it("falls back to the bridge process cwd when neither is set", () => {
    const root = resolveRoot({}, {}, "/from/process");
    expect(root).toBe("/from/process");
  });

  it("ignores an empty-string HIMA_PROJECT_ROOT", () => {
    const root = resolveRoot({ cwd: "/from/payload" }, { HIMA_PROJECT_ROOT: "" }, "/from/process");
    expect(root).toBe("/from/payload");
  });
});

// ---------------------------------------------------------------------------
// interpretNormResult
// ---------------------------------------------------------------------------

describe("interpretNormResult", () => {
  it("pre_tool_call + norm exit 2 -> {action:block,message:<reason>}", () => {
    const { body, warning } = interpretNormResult("pre_tool_call", {
      status: 2,
      stdout: JSON.stringify({ decision: "block", reason: "skill required" }),
      stderr: "",
    });
    expect(JSON.parse(body)).toEqual({ action: "block", message: "skill required" });
    expect(warning).toBeNull();
  });

  it("pre_tool_call + norm exit 2 with unparsable stdout -> generic block message", () => {
    const { body } = interpretNormResult("pre_tool_call", { status: 2, stdout: "not json", stderr: "" });
    const parsed = JSON.parse(body);
    expect(parsed.action).toBe("block");
    expect(typeof parsed.message).toBe("string");
    expect(parsed.message.length).toBeGreaterThan(0);
  });

  it("pre_tool_call + norm exit 0 -> allow", () => {
    const { body, warning } = interpretNormResult("pre_tool_call", { status: 0, stdout: "", stderr: "" });
    expect(body).toBe(ALLOW_BODY);
    expect(warning).toBeNull();
  });

  it("pre_tool_call + spawn error -> allow (fail-open) with a warning", () => {
    const { body, warning } = interpretNormResult("pre_tool_call", {
      error: new Error("spawn norm ENOENT"),
      status: null,
      stdout: "",
      stderr: "",
    });
    expect(body).toBe(ALLOW_BODY);
    expect(warning).toContain("ENOENT");
  });

  it("pre_tool_call + norm exit 1 (internal error) -> allow (fail-open) with a warning", () => {
    const { body, warning } = interpretNormResult("pre_tool_call", {
      status: 1,
      stdout: "",
      stderr: "boom",
    });
    expect(body).toBe(ALLOW_BODY);
    expect(warning).toContain("1");
  });

  it("subagent_start ALWAYS allows, even if norm somehow returned exit 2", () => {
    // Hermes ignores subagent_start's return value entirely (fire-and-forget
    // observer hook per agent/shell_hooks.py::_parse_response) — the bridge
    // must never emit a block body for this event.
    const { body, warning } = interpretNormResult("subagent_start", {
      status: 2,
      stdout: JSON.stringify({ decision: "block", reason: "should be ignored" }),
      stderr: "",
    });
    expect(body).toBe(ALLOW_BODY);
    expect(warning).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// runBridge — injected I/O, full pipeline
// ---------------------------------------------------------------------------

describe("runBridge — payload mapping end to end (injected spawn)", () => {
  it("maps stdin -> Claude-shaped payload and passes it as spawn input", async () => {
    let capturedArgs: string[] = [];
    let capturedInput = "";

    const result = await runBridge({
      readStdin: async () =>
        JSON.stringify({
          hook_event_name: "pre_tool_call",
          tool_name: "Write",
          tool_input: { file_path: "src/util.ts" },
          session_id: "sess_1",
          cwd: "/proj",
        }),
      spawn: (bin, args, opts) => {
        capturedArgs = args;
        capturedInput = opts.input;
        return { status: 0, stdout: "", stderr: "" };
      },
      env: {},
      cwd: "/fallback",
    });

    expect(capturedArgs).toEqual(["hook", "pre-tool-use", "--format", "claude", "--root", "/proj"]);
    expect(JSON.parse(capturedInput)).toEqual({
      hook_event_name: "PreToolUse",
      tool_name: "Write",
      tool_input: { file_path: "src/util.ts" },
      session_id: "sess_1",
    });
    expect(result.body).toBe(ALLOW_BODY);
  });

  it("a real Hermes write_file payload reaches norm as tool_name Write (regression test for the dark-gate bug)", async () => {
    let capturedInput = "";
    const result = await runBridge({
      readStdin: async () =>
        JSON.stringify({
          hook_event_name: "pre_tool_call",
          tool_name: "write_file",
          tool_input: { path: "src/util.ts", content: "export {}" },
          session_id: "sess_1",
          cwd: "/proj",
        }),
      spawn: (bin, args, opts) => {
        capturedInput = opts.input;
        return { status: 0, stdout: "", stderr: "" };
      },
      env: {},
      cwd: "/fallback",
    });

    const sentToNorm = JSON.parse(capturedInput);
    expect(sentToNorm.tool_name).toBe("Write");
    expect(sentToNorm.tool_input.file_path).toBe("src/util.ts");
    expect(result.body).toBe(ALLOW_BODY);
  });

  it("a real Hermes read_file payload reaches norm as tool_name Read, never Write/Edit", async () => {
    let capturedInput = "";
    await runBridge({
      readStdin: async () =>
        JSON.stringify({
          hook_event_name: "pre_tool_call",
          tool_name: "read_file",
          tool_input: { path: "README.md" },
          session_id: "sess_1",
          cwd: "/proj",
        }),
      spawn: (bin, args, opts) => {
        capturedInput = opts.input;
        return { status: 0, stdout: "", stderr: "" };
      },
      env: {},
      cwd: "/fallback",
    });

    const sentToNorm = JSON.parse(capturedInput);
    expect(sentToNorm.tool_name).toBe("Read");
    expect(sentToNorm.tool_name).not.toBe("Write");
  });

  it("norm exit-2 -> {action:block,message:<reason>}", async () => {
    const result = await runBridge({
      readStdin: async () =>
        JSON.stringify({ hook_event_name: "pre_tool_call", tool_name: "Bash", tool_input: { command: "rm -rf /" }, session_id: "s" }),
      spawn: () => ({
        status: 2,
        stdout: JSON.stringify({ decision: "block", reason: "pre_tool blocked: destructive op" }),
        stderr: "",
      }),
      env: {},
      cwd: "/proj",
    });
    expect(JSON.parse(result.body)).toEqual({
      action: "block",
      message: "pre_tool blocked: destructive op",
    });
  });

  it("norm spawn error -> allow (fail-open)", async () => {
    const result = await runBridge({
      readStdin: async () => JSON.stringify({ hook_event_name: "pre_tool_call", tool_name: "Read", tool_input: {}, session_id: "s" }),
      spawn: () => {
        throw new Error("spawn norm ENOENT");
      },
      env: {},
      cwd: "/proj",
    });
    expect(result.body).toBe(ALLOW_BODY);
    expect(result.warning).toContain("ENOENT");
  });

  it("malformed stdin -> allow (fail-open), spawn never called", async () => {
    let spawnCalled = false;
    const result = await runBridge({
      readStdin: async () => "{{not valid json}}",
      spawn: () => {
        spawnCalled = true;
        return { status: 0, stdout: "", stderr: "" };
      },
      env: {},
      cwd: "/proj",
    });
    expect(result.body).toBe(ALLOW_BODY);
    expect(spawnCalled).toBe(false);
  });

  it("unmapped hook_event_name -> allow (fail-open), spawn never called", async () => {
    let spawnCalled = false;
    const result = await runBridge({
      readStdin: async () => JSON.stringify({ hook_event_name: "pre_llm_call" }),
      spawn: () => {
        spawnCalled = true;
        return { status: 0, stdout: "", stderr: "" };
      },
      env: {},
      cwd: "/proj",
    });
    expect(result.body).toBe(ALLOW_BODY);
    expect(spawnCalled).toBe(false);
  });

  it("subagent_start invokes norm hook subagent-start but always allows", async () => {
    let capturedArgs: string[] = [];
    const result = await runBridge({
      readStdin: async () =>
        JSON.stringify({
          hook_event_name: "subagent_start",
          tool_name: null,
          tool_input: null,
          session_id: "parent-sess",
          extra: { child_role: "executor" },
        }),
      spawn: (bin, args) => {
        capturedArgs = args;
        // Simulate norm returning a block (should still be ignored for this event).
        return { status: 2, stdout: JSON.stringify({ decision: "block", reason: "n/a" }), stderr: "" };
      },
      env: {},
      cwd: "/proj",
    });
    expect(capturedArgs).toEqual(["hook", "subagent-start", "--format", "claude", "--root", "/proj"]);
    expect(result.body).toBe(ALLOW_BODY);
  });

  it("resolves root from HIMA_PROJECT_ROOT env over payload.cwd", async () => {
    let capturedArgs: string[] = [];
    await runBridge({
      readStdin: async () =>
        JSON.stringify({ hook_event_name: "pre_tool_call", tool_name: "Read", tool_input: {}, session_id: "s", cwd: "/payload-cwd" }),
      spawn: (bin, args) => {
        capturedArgs = args;
        return { status: 0, stdout: "", stderr: "" };
      },
      env: { HIMA_PROJECT_ROOT: "/env-root" },
      cwd: "/process-cwd",
    });
    expect(capturedArgs).toContain("/env-root");
  });

  it("uses NORM_BIN override when present", async () => {
    let capturedBin = "";
    await runBridge({
      readStdin: async () => JSON.stringify({ hook_event_name: "pre_tool_call", tool_name: "Read", tool_input: {}, session_id: "s" }),
      spawn: (bin) => {
        capturedBin = bin;
        return { status: 0, stdout: "", stderr: "" };
      },
      env: { NORM_BIN: "/custom/path/to/norm" },
      cwd: "/proj",
    });
    expect(capturedBin).toBe("/custom/path/to/norm");
  });
});

// ---------------------------------------------------------------------------
// Real end-to-end spawn test — stub `norm` binary, real CLI entry point
// ---------------------------------------------------------------------------

describe("norm-hermes-hook.mjs — real process, stubbed norm binary", () => {
  let dir: string;
  let bridgePath: string;
  let stubNormPath: string;

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "hermes-bridge-e2e-"));
    bridgePath = path.resolve(import.meta.dirname, "../src/hermes-bridge/norm-hermes-hook.mjs");

    // A stub `norm` binary: reads stdin, and decides block/allow based on
    // whether the Claude-shaped payload's tool_input.command contains
    // "BLOCK_ME". Mirrors the real norm CLI's exit-2-on-block contract.
    stubNormPath = path.join(dir, "stub-norm.mjs");
    writeFileSync(
      stubNormPath,
      `#!/usr/bin/env node
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const raw = Buffer.concat(chunks).toString("utf8");
let payload = {};
try { payload = JSON.parse(raw); } catch {}
const cmd = payload?.tool_input?.command ?? "";
if (typeof cmd === "string" && cmd.includes("BLOCK_ME")) {
  process.stdout.write(JSON.stringify({ decision: "block", reason: "stub-norm: blocked BLOCK_ME" }));
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

  function spawnBridge(hermesPayload: Record<string, unknown>) {
    return spawnSync("node", [bridgePath], {
      input: JSON.stringify(hermesPayload),
      encoding: "utf8",
      timeout: 15_000,
      env: { ...process.env, NORM_BIN: stubNormPath, HIMA_PROJECT_ROOT: dir },
    });
  }

  it("exits 0 and prints {action:block,message} when the stub norm blocks", () => {
    const result = spawnBridge({
      hook_event_name: "pre_tool_call",
      tool_name: "Bash",
      tool_input: { command: "BLOCK_ME rm -rf /" },
      session_id: "sess-e2e-1",
      cwd: dir,
    });
    expect(result.status).toBe(0); // bridge itself always exits 0
    const parsed = JSON.parse((result.stdout ?? "").trim());
    expect(parsed).toEqual({ action: "block", message: "stub-norm: blocked BLOCK_ME" });
  });

  it("exits 0 and prints an allow body when the stub norm allows", () => {
    const result = spawnBridge({
      hook_event_name: "pre_tool_call",
      tool_name: "Read",
      tool_input: { file_path: "README.md" },
      session_id: "sess-e2e-2",
      cwd: dir,
    });
    expect(result.status).toBe(0);
    const parsed = JSON.parse((result.stdout ?? "").trim());
    expect(parsed.action).not.toBe("block");
  });

  it("fails open (exit 0, allow body) when NORM_BIN points at a nonexistent binary", () => {
    const result = spawnSync("node", [bridgePath], {
      input: JSON.stringify({
        hook_event_name: "pre_tool_call",
        tool_name: "Bash",
        tool_input: { command: "BLOCK_ME" },
        session_id: "s",
      }),
      encoding: "utf8",
      timeout: 15_000,
      env: { ...process.env, NORM_BIN: "/definitely/does/not/exist/norm", HIMA_PROJECT_ROOT: dir },
    });
    expect(result.status).toBe(0);
    const parsed = JSON.parse((result.stdout ?? "").trim());
    expect(parsed.action).not.toBe("block");
    expect(result.stderr ?? "").toMatch(/norm-hermes-hook/);
  });

  it("fails open on malformed stdin (exit 0, allow body)", () => {
    const result = spawnSync("node", [bridgePath], {
      input: "{{not valid json}}",
      encoding: "utf8",
      timeout: 15_000,
      env: { ...process.env, NORM_BIN: stubNormPath, HIMA_PROJECT_ROOT: dir },
    });
    expect(result.status).toBe(0);
    const parsed = JSON.parse((result.stdout ?? "").trim());
    expect(parsed.action).not.toBe("block");
  });

  it("subagent_start always allows even though it invokes the stub norm", () => {
    const result = spawnBridge({
      hook_event_name: "subagent_start",
      tool_name: null,
      tool_input: null,
      session_id: "parent-sess",
      extra: { child_role: "executor" },
    });
    expect(result.status).toBe(0);
    const parsed = JSON.parse((result.stdout ?? "").trim());
    expect(parsed.action).not.toBe("block");
  });
});
