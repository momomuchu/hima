/**
 * core.mjs — pure + injectable-I/O logic for the Norm OpenCode bridge
 * (norm-opencode-plugin.mjs, sibling file, is the thin @opencode-ai/plugin
 * factory that wires this module's exports into real OpenCode hooks).
 *
 * WHY THIS SPLIT IS LOAD-BEARING, NOT JUST TIDINESS (empirically discovered,
 * 2026-07-06 — do not re-merge these files):
 *
 *   OpenCode's plugin loader (traced from the installed opencode 1.16.2
 *   binary's own bundled source, via `strings` on the Mach-O executable —
 *   grep for "Plugin export is not a function") does NOT simply call a
 *   default export. When it cannot cleanly detect a single canonical export,
 *   it falls back to iterating EVERY value in the module's export namespace
 *   (`Object.values(mod)`, deduplicated by reference) and requires EACH ONE
 *   to independently satisfy `typeof x === "function"` OR `typeof x.server
 *   === "function"`. If ANY exported value fails that check, the loader
 *   THROWS and the ENTIRE plugin — every hook it defines — is silently
 *   discarded (the caller wraps the load in try/catch, logs
 *   `service=plugin error="Plugin export is not a function" failed to load
 *   plugin`, and swallows the failure — no hook from the file ever fires).
 *
 *   Concretely: an earlier version of this bridge exported helper constants
 *   like WRITE_TOOL_MAP (a frozen plain object, not a function) directly from
 *   the file OpenCode loads as a plugin. Live-verified on a real `opencode
 *   run` session: this produced exactly that "Plugin export is not a
 *   function" error in ~/.local/share/opencode/log/*.log, and NO
 *   SubagentStart trace entry was ever written for a real task-tool
 *   delegation in that session — evidence the loader discarded the whole
 *   plugin object rather than partially wiring it. The fix: this module
 *   (core.mjs) holds every pure/testable export; norm-opencode-plugin.mjs —
 *   the file actually installed into `.opencode/plugins/` — exports ONLY the
 *   single plugin factory function (as both a named export and `export
 *   default` of the SAME reference, which the loader's de-dup-by-reference
 *   Set collapses to one candidate either way).
 *
 * Ground truth this file is built against (verified live against the
 * installed opencode 1.16.2 binary + @opencode-ai/plugin 1.17.14 types,
 * NOT assumption — see docs/research/runtime-capabilities.sot.json §opencode
 * and docs/research/runtime-capabilities-2026-07.md for the doc-reading pass
 * that preceded this live-empirical pass):
 *
 *   - Plugin shape (@opencode-ai/plugin dist/index.d.ts):
 *       export type Plugin = (input: PluginInput, options?) => Promise<Hooks>;
 *     A NAMED export (opencode.ai/docs/plugins confirms named, not default —
 *     this file exports both, for maximum compatibility with either loading
 *     convention).
 *   - `input.directory` is the REAL invoking project directory. `input.worktree`
 *     was observed to be "/" in a plain (non-git-worktree) `opencode run` —
 *     do NOT use worktree as the project root.
 *   - `tool.execute.before(input, output)`:
 *       input  = { tool: string, sessionID: string, callID: string }
 *       output = { args: any }
 *     Blocking = THROW an Error (opencode.ai/docs/plugins example: `throw new
 *     Error("...")`). There is no other block channel.
 *   - CRITICAL, empirically discovered mismatch (live probe, 2026-07-06,
 *     `opencode run "...write hello.txt..."` with a diagnostic logging
 *     plugin installed): OpenCode's real built-in tool ids are LOWERCASE
 *     ("write", "edit", "read", "bash", "task", ...) — NOT Claude's
 *     PascalCase ("Write"/"Edit"/"MultiEdit"). And `output.args` uses
 *     camelCase keys (`filePath`), NOT Claude's `file_path`. Norm's core
 *     (packages/hima-cli/src/router.ts WRITE_TOOL_NAMES, beh-delegation-first.ts
 *     WRITE_TOOL_NAMES + extractTargetPath) is hardcoded to Claude's
 *     PascalCase/`file_path` convention. Forwarding OpenCode's raw
 *     `{tool:"write", args:{filePath:...}}` unmodified would silently NEVER
 *     match the write-tool gate — Delegation-First would be permanently inert
 *     on OpenCode. This bridge NORMALIZES both (see normalizeToolName /
 *     normalizeToolInput) before calling norm. Live-verified real payload:
 *       { tool: "write", sessionID: "ses_...", callID: "tool_..." }
 *       { args: { filePath: "/abs/path/hello.txt", content: "hello world" } }
 *   - Subagent/delegation detection (live-verified, 2026-07-06, `opencode run`
 *     with "use the task tool to delegate..."): a `task` tool call on the
 *     PARENT session is followed by an `event` hook firing `session.created`
 *     whose `properties.info.parentID` is set to the PARENT session id — this
 *     is OpenCode's native delegation signal. Sequence observed:
 *       1. tool.execute.before  {tool:"task", sessionID:<parent>, ...}
 *       2. event "session.created" {info:{id:<child>, parentID:<parent>}}
 *       3. tool.execute.before  {tool:"write", sessionID:<child>, ...}
 *     No poll-file/compensation mechanism is needed (unlike Codex R-049) —
 *     OpenCode's session.created is a native push event.
 *   - Auto-discovery claim in opencode.ai/docs/plugins ("files in
 *     .opencode/plugins/ or ~/.config/opencode/plugins/ are automatically
 *     loaded at startup") was NOT OBSERVED live on opencode 1.16.2: a plugin
 *     file merely present in `.opencode/plugins/` was never loaded (confirmed
 *     via opencode's own startup log at ~/.local/share/opencode/log/*.log,
 *     which only ever logged plugins explicitly present in `opencode.json`'s
 *     "plugin" array). install.mjs (sibling file) therefore both writes the
 *     plugin file AND registers it in opencode.json — see its header for
 *     detail.
 *
 * SAFETY CONTRACT (matches norm-hermes-hook.mjs's fail-open contract): this
 * bridge must NEVER throw except for a genuine norm exit-2 block, signalled
 * exclusively via NormBlockError. Any other failure — norm not on PATH, spawn
 * error, timeout, malformed norm output, a bug in this file's own normalization
 * logic — fails OPEN (allows the tool call). Governance must never break the
 * host agent.
 *
 * Layering (mirrors packages/hima-cli/src/hermes-bridge/norm-hermes-hook.mjs):
 *   1. Pure helpers (normalizeToolName, normalizeToolInput, buildPreToolPayload,
 *      extractBlockReason, interpretPreToolResult, extractSessionCreatedInfo)
 *      — no process I/O, fully unit-testable.
 *   2. Injectable-I/O cores (runToolExecuteBefore, runSessionEvent) — take a
 *      `spawnNorm` function as a parameter, so tests can stub `norm` entirely.
 *   3. `createRealSpawnNorm` — the real `node:child_process.spawn` wiring.
 *   4. `NormOpenCodePlugin` — the actual @opencode-ai/plugin factory OpenCode
 *      loads, wiring (1)-(3) together.
 */

import { spawn } from "node:child_process";

// ---------------------------------------------------------------------------
// NormBlockError — the ONLY throw this bridge ever performs deliberately.
// ---------------------------------------------------------------------------

export class NormBlockError extends Error {}

// ---------------------------------------------------------------------------
// 1. Pure helpers
// ---------------------------------------------------------------------------

/**
 * Map OpenCode's lowercase built-in write-tool ids to Norm's Claude-style
 * PascalCase names, so packages/hima-cli/src/router.ts's WRITE_TOOL_NAMES and
 * beh-delegation-first.ts's WRITE_TOOL_NAMES actually recognize the call as a
 * write. Tool ids not in this map (bash, read, task, grep, glob, list,
 * todowrite, question, ...) pass through unchanged — norm's other pre_tool
 * safety behaviors (BEH_FALSIFIES_IF, BEH_SECRET_GUARD, ...) do not depend on
 * exact tool-name casing the way the write-tool gate does.
 */
export const WRITE_TOOL_MAP = Object.freeze({
  write: "Write",
  edit: "Edit",
  patch: "MultiEdit",
  multiedit: "MultiEdit",
  // apply_patch (OpenAI/opencode's diff-writer, used by custom agents e.g.
  // "Sisyphus ultraworker") IS a write — map it so the write-gate bites there too.
  apply_patch: "MultiEdit",
  applypatch: "MultiEdit",
});

export function normalizeToolName(rawTool) {
  const lower = String(rawTool ?? "").toLowerCase();
  return WRITE_TOOL_MAP[lower] ?? rawTool;
}

/**
 * Normalize OpenCode's camelCase tool args so Norm's extractTargetPath /
 * extractWritePath (which look for `file_path` then `path`) find the target
 * file. Additive only — never removes the original `filePath` key, so any
 * OpenCode-side consumer of `output.args` is unaffected (this function is
 * only ever applied to the COPY sent to norm, never to opencode's real
 * `output.args`).
 */
export function normalizeToolInput(args) {
  if (args === null || typeof args !== "object" || Array.isArray(args)) {
    return args;
  }
  if (typeof args.filePath === "string" && args.file_path === undefined) {
    return { ...args, file_path: args.filePath };
  }
  return args;
}

/** Build the Claude-shaped PreToolUse payload norm's stdin reader expects. */
export function buildPreToolPayload(toolExecInput, toolExecOutput) {
  return {
    hook_event_name: "PreToolUse",
    tool_name: normalizeToolName(toolExecInput?.tool),
    tool_input: normalizeToolInput(toolExecOutput?.args),
    session_id: toolExecInput?.sessionID,
  };
}

/** Best-effort extraction of the `reason` field from norm's block stdout. */
export function extractBlockReason(stdout, fallback) {
  const trimmed = (stdout ?? "").trim();
  if (trimmed !== "") {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed.reason === "string" && parsed.reason !== "") {
        return parsed.reason;
      }
    } catch {
      // stdout wasn't valid JSON — fall through to the generic fallback.
    }
  }
  return fallback;
}

/**
 * interpretPreToolResult — turn a `norm hook pre-tool-use` spawn result into
 * a block/allow verdict. Never throws. Fails open (block:false) on a spawn
 * error or any non-2 exit code — only a real, well-formed exit code 2 blocks.
 *
 * @param {{ error?: Error, status: number|null, stdout: string, stderr: string }} normResult
 */
export function interpretPreToolResult(normResult) {
  if (normResult.error) {
    return { block: false, warning: `spawn error: ${normResult.error?.message ?? String(normResult.error)}` };
  }
  if (normResult.status === 2) {
    return { block: true, reason: extractBlockReason(normResult.stdout, "blocked by Norm governance (see `norm trace`)") };
  }
  if (normResult.status !== 0) {
    return { block: false, warning: `norm exited ${String(normResult.status)}; stderr: ${(normResult.stderr ?? "").slice(0, 200)}` };
  }
  return { block: false, warning: null };
}

/**
 * extractSessionCreatedInfo — pull `{id, parentID}` out of an OpenCode plugin
 * `event` payload when it is a `session.created` event, or return null for
 * every other event / malformed payload (defensive — never throws).
 */
export function extractSessionCreatedInfo(event) {
  if (!event || event.type !== "session.created") return null;
  const info = event.properties?.info;
  if (!info || typeof info.id !== "string" || info.id === "") return null;
  return {
    id: info.id,
    parentID: typeof info.parentID === "string" && info.parentID !== "" ? info.parentID : undefined,
  };
}

// ---------------------------------------------------------------------------
// 2. Injectable-I/O cores
// ---------------------------------------------------------------------------

/**
 * runToolExecuteBefore — the testable core of the "tool.execute.before" hook.
 * `spawnNorm(event, payload, root) => Promise<{error?,status,stdout,stderr}>`
 * is injected so unit tests never need a real `norm` binary.
 *
 * Throws NormBlockError ONLY on a genuine norm exit-2 block. Any spawnNorm
 * rejection is caught here and converted into a fail-open `interpretPreToolResult`
 * verdict — this function never lets a bridge-internal error escape as a throw.
 */
export async function runToolExecuteBefore({ input, output, root, spawnNorm }) {
  const payload = buildPreToolPayload(input, output);
  let normResult;
  try {
    normResult = await spawnNorm("pre-tool-use", payload, root);
  } catch (err) {
    normResult = { error: err, status: null, stdout: "", stderr: "" };
  }
  const verdict = interpretPreToolResult(normResult);
  if (verdict.block) {
    throw new NormBlockError(verdict.reason);
  }
}

/**
 * runSessionEvent — the testable core of the "event" hook, scoped to
 * `session.created`. A child session (parentID set) marks stage-delegation
 * via `norm hook subagent-start`; a top-level session calls `norm hook
 * session-start` for tracing/ward-resume advisory purposes. Always resolves
 * (never throws) — this hook has no output channel to act on anyway.
 *
 * Returns which norm event was invoked (or null when the plugin event wasn't
 * a session.created event) purely so tests can assert on it.
 */
export async function runSessionEvent({ event, root, spawnNorm }) {
  const info = extractSessionCreatedInfo(event);
  if (info === null) return { called: null };

  if (info.parentID !== undefined) {
    // SPEC-018 D-004: a child session appearing IS the delegation signal.
    await safeSpawn(spawnNorm, "subagent-start", {
      hook_event_name: "SubagentStart",
      session_id: info.id,
    }, root);
    return { called: "subagent-start" };
  }

  await safeSpawn(spawnNorm, "session-start", {
    hook_event_name: "SessionStart",
    session_id: info.id,
  }, root);
  return { called: "session-start" };
}

async function safeSpawn(spawnNorm, event, payload, root) {
  try {
    await spawnNorm(event, payload, root);
  } catch {
    // Advisory only — a tracing/marker call failing must never break the session.
  }
}

// ---------------------------------------------------------------------------
// 3. Real spawnNorm — node:child_process wiring
// ---------------------------------------------------------------------------

/**
 * createRealSpawnNorm — build a spawnNorm(event, payload, root) function that
 * shells out to the real `norm hook <event> --format <format> --root <root>`,
 * feeding `payload` as JSON on stdin. Resolves `{status, stdout, stderr}` on
 * completion, or `{error}` on any spawn failure/timeout. Never rejects.
 *
 * Env overrides (read at CALL time, not module-load time, so tests can mutate
 * process.env between cases):
 *   NORM_BIN               — the `norm` binary to invoke (default "norm", must
 *                             resolve via PATH or be an absolute path).
 *   NORM_OPENCODE_FORMAT   — the --format value (default "opencode").
 *   NORM_HOOK_TIMEOUT_MS   — spawn timeout in ms (default 10000).
 */
export function createRealSpawnNorm() {
  return function spawnNorm(event, payload, root) {
    const bin = process.env.NORM_BIN || "norm";
    const format = process.env.NORM_OPENCODE_FORMAT || "opencode";
    const timeoutMs = Number(process.env.NORM_HOOK_TIMEOUT_MS || 10000);

    return new Promise((resolvePromise) => {
      let settled = false;
      const resolveOnce = (result) => {
        if (settled) return;
        settled = true;
        resolvePromise(result);
      };

      let child;
      try {
        child = spawn(bin, ["hook", event, "--format", format, "--root", root], {
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch (err) {
        resolveOnce({ error: err, status: null, stdout: "", stderr: "" });
        return;
      }

      const timer = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          // process may have already exited — ignore.
        }
        resolveOnce({
          error: new Error(`norm hook ${event} timed out after ${timeoutMs}ms`),
          status: null,
          stdout: "",
          stderr: "",
        });
      }, timeoutMs);
      timer.unref?.();

      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (d) => {
        stdout += d.toString("utf8");
      });
      child.stderr?.on("data", (d) => {
        stderr += d.toString("utf8");
      });

      child.on("error", (err) => {
        clearTimeout(timer);
        resolveOnce({ error: err, status: null, stdout, stderr });
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        resolveOnce({ status: code ?? 0, stdout, stderr });
      });

      try {
        child.stdin.write(JSON.stringify(payload));
        child.stdin.end();
      } catch {
        // A write failure here will also surface via the 'error' handler for
        // real spawn failures; a lone EPIPE is not fatal to the promise above.
      }
    });
  };
}

// NOTE: the actual @opencode-ai/plugin factory that wires (1)-(3) together
// lives in the SIBLING file norm-opencode-plugin.mjs, not here — see that
// file's header for why the split is load-bearing (not just tidiness).
