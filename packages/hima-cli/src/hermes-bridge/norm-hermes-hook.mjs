#!/usr/bin/env node
/**
 * norm-hermes-hook.mjs — Hermes shell-hook bridge that lets `norm` (the
 * @norm/cli hook dispatcher) govern a Hermes Agent (NousResearch/hermes-agent)
 * session.
 *
 * Ground truth this file is built against (verified against the vendored
 * Hermes source, not assumption):
 *   - docs/research/runtime-capabilities.sot.json §hermes
 *   - docs/research/runtime-capabilities-2026-07.md
 *   - .planning/external-harness-research/clones/hermes-agent/
 *       website/docs/user-guide/features/hooks.md ("JSON wire protocol")
 *       agent/shell_hooks.py (`_serialize_payload` / `_parse_response`)
 *
 * Hermes hook mechanism used here: a **shell hook** (language: any), declared
 * in the `hooks:` block of `~/.hermes/config.yaml` (or `$HERMES_HOME/config.yaml`)
 * — see install.mjs in this same directory. This is distinct from Hermes's
 * Python-only in-process plugin form; shell hooks are the only mechanism that
 * can run a Node.js script.
 *
 * Wire protocol (stdin — confirmed against agent/shell_hooks.py::_serialize_payload):
 *   {
 *     "hook_event_name": "pre_tool_call" | "subagent_start" | ...,
 *     "tool_name":       string | null,   // null for non-tool events
 *     "tool_input":      object | null,   // null for non-tool events
 *     "session_id":      string,          // parent_session_id for subagent_start
 *     "cwd":             string,
 *     "extra":           object           // event-specific kwargs (e.g. child_role)
 *   }
 *
 * Wire protocol (stdout — confirmed against agent/shell_hooks.py::_parse_response):
 *   - pre_tool_call is the ONLY event whose stdout is translated into a block
 *     directive. Both `{"decision":"block","reason":str}` (Claude-Code style)
 *     and `{"action":"block","message":str}` (Hermes-canonical) are accepted;
 *     this bridge always emits the Hermes-canonical shape per the task
 *     contract. Anything else (including `{}`) is a silent allow.
 *   - subagent_start's return value is IGNORED by Hermes (fire-and-forget
 *     observer hook — only `pre_tool_call` and `pre_llm_call` "affect
 *     behavior" per the Hermes hooks docs). We still invoke `norm hook
 *     subagent-start` for its side effect: markStageDelegation() persists the
 *     Delegation-First marker so a subsequent pre_tool_use write is not
 *     blocked. We never emit a block for this event.
 *
 * TOOL-NAME/TOOL-INPUT NORMALIZATION (added — closes a governance-efficacy
 * gap: this bridge previously passed Hermes's native tool_name/tool_input
 * THROUGH UNCHANGED. Norm's gates (packages/hima-cli/src/router.ts
 * WRITE_TOOL_NAMES / READ_TOOL_NAMES, extractWritePath/extractReadPath) key
 * on Claude's PascalCase tool names ("Write"/"Edit"/"MultiEdit") and Claude's
 * `file_path` input field. Hermes's real tool names are lowercase-snake and
 * use a `path` field, so every real Hermes write was silently invisible to
 * Norm's write-tool gate. See HERMES_TOOL_MAP below for the ground-truthed
 * mapping (verified against the vendored Hermes source, not assumption) and
 * normalizeHermesTool for the pure mapping function.
 *
 * FAIL-OPEN CONTRACT: this script must NEVER throw and NEVER exit non-zero.
 * Hermes treats "malformed JSON, non-zero exit codes, and timeouts" as
 * warn-and-continue conditions for the *hook script itself* — but relying on
 * that is fragile, so this bridge always exits 0 and always prints valid
 * JSON. A block is signalled ONLY via the printed `{"action":"block",...}`
 * body, never via this process's own exit code.
 */

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max time to wait for `norm hook ...` to respond. */
export const NORM_TIMEOUT_MS = 10_000;

/** Always-safe fallback body: Hermes treats any non-matching JSON as allow. */
export const ALLOW_BODY = "{}";

/**
 * Maps a Hermes native `hook_event_name` to the norm CLI event name and the
 * Claude-shaped `hook_event_name` norm expects on `--format claude`.
 */
export const EVENT_MAP = Object.freeze({
  pre_tool_call: Object.freeze({ normEvent: "pre-tool-use", claudeHookEventName: "PreToolUse" }),
  subagent_start: Object.freeze({ normEvent: "subagent-start", claudeHookEventName: "SubagentStart" }),
});

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit tests — no process I/O below this line)
// ---------------------------------------------------------------------------

/**
 * parseHermesPayload — parse the raw stdin text into the Hermes wire-protocol
 * object. Never throws: returns `{ ok:false, error }` on any problem.
 */
export function parseHermesPayload(raw) {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "") {
    return { ok: false, error: "empty stdin" };
  }
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    return { ok: false, error: `malformed stdin JSON: ${err?.message ?? String(err)}` };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: "stdin JSON was not an object" };
  }
  return { ok: true, payload: parsed };
}

/**
 * resolveEventMapping — look up the EVENT_MAP entry for a Hermes
 * `hook_event_name`. Returns `undefined` for any event this bridge is not
 * registered for (defensive — install.mjs only wires pre_tool_call and
 * subagent_start, but a stray config entry could still invoke us for
 * something else).
 */
export function resolveEventMapping(hookEventName) {
  return EVENT_MAP[hookEventName];
}

/**
 * HERMES_TOOL_MAP — maps Hermes's real native tool names to Norm's
 * Claude-vocabulary tool names. Ground-truthed against the vendored Hermes
 * source (NOT assumption) at
 * .planning/external-harness-research/clones/hermes-agent/:
 *   - tools/file_tools.py:1583-1586 (registry.register(...) calls) —
 *     Hermes's file toolset registers FOUR DISTINCT top-level tools, not one
 *     "file" tool with a read/write operation field:
 *       read_file    (line 1428 READ_FILE_SCHEMA)   { path, offset?, limit? }
 *       write_file   (line 1442 WRITE_FILE_SCHEMA)  { path, content, cross_profile? }
 *       patch        (line 1460 PATCH_SCHEMA)       — see PATCH note below
 *       search_files (line 1511 SEARCH_FILES_SCHEMA){ pattern, target, path?, ... }
 *   - tools/terminal_tool.py:2617/2676 (TERMINAL_SCHEMA / registry.register) —
 *     one "terminal" tool: { command, background?, workdir?, timeout?, ... }.
 *
 * Because read_file and search_files are genuinely SEPARATE tool names from
 * write_file/patch (never a shared tool with a hidden read/write flag), a
 * Hermes file READ can never be schema-confused with a WRITE — there is no
 * ambiguity to resolve for the read/write distinction itself. Both read_file
 * and search_files are therefore intentionally NOT mapped to a write name
 * here (read_file maps to Norm's "Read" for parity with router.ts's
 * READ_TOOL_NAMES read-set tracking; search_files has no Claude equivalent
 * claimed and passes through unchanged — either way, neither is a member of
 * WRITE_TOOL_NAMES, so neither can trip the write gate).
 *
 * PATCH_ASSUMPTION (the one place this mapping is NOT a direct schema fact,
 * per tools/file_tools.py:1460-1510 PATCH_SCHEMA): `patch` has two mutually
 * exclusive modes:
 *   - mode="replace" (default): { path, old_string, new_string, replace_all? }
 *     — a single-file path is directly available in `path`.
 *   - mode="patch": { patch } — a V4A-format multi-file patch string with NO
 *     top-level `path` field; file path(s) are embedded as
 *     "*** Update File: <path>" / "*** Add File: <path>" /
 *     "*** Delete File: <path>" headers inside the patch text.
 * Both modes are file-MUTATING by construction (there is no read-only patch
 * mode), so BOTH map to Norm's "Edit" — the safe default, since it can never
 * suppress the write gate for an actual write. For `file_path` extraction:
 * mode="replace" uses `path` directly; mode="patch" best-effort greps the
 * first "*** (Update|Add|Delete) File: <path>" header out of the patch text,
 * or leaves `file_path` undefined if no header is found. An undefined
 * `file_path` only degrades SECONDARY path-based checks (e.g. markdown-plan
 * auto-open, secret-guard path matching) — it does NOT weaken the primary
 * write-tool-name gate, which keys on tool_name alone regardless of path
 * (see packages/hima-cli/src/router.ts:776 and :828).
 */
export const HERMES_TOOL_MAP = Object.freeze({
  read_file: "Read",
  write_file: "Write",
  patch: "Edit",
  terminal: "Bash",
});

const PATCH_FILE_HEADER_RE = /\*\*\* (?:Update|Add|Delete) File:\s*(.+)/;

/**
 * extractPatchFilePath — best-effort single-path hint for a Hermes `patch`
 * tool call (see PATCH_ASSUMPTION above). Never throws.
 */
function extractPatchFilePath(toolInput) {
  if (typeof toolInput.path === "string" && toolInput.path.trim() !== "") {
    return toolInput.path.trim();
  }
  if (typeof toolInput.patch === "string") {
    const match = toolInput.patch.match(PATCH_FILE_HEADER_RE);
    if (match && typeof match[1] === "string" && match[1].trim() !== "") {
      return match[1].trim();
    }
  }
  return undefined;
}

/**
 * normalizeHermesTool — pure mapping from a Hermes native
 * `{tool_name, tool_input}` pair to the Claude-vocabulary pair Norm's gates
 * expect. Mirrors the shape of packages/hima-cli/src/opencode-bridge/core.mjs
 * normalizeToolName/normalizeToolInput. Additive only on tool_input (never
 * drops the original Hermes field) and NEVER throws.
 *
 * Tool names not present in HERMES_TOOL_MAP (including `null`, already
 * Claude-shaped names like "Write", and any future/unknown Hermes tool) pass
 * through completely unchanged — this is the safe default: an unmapped tool
 * simply isn't recognized as a write by Norm's WRITE_TOOL_NAMES gate, which
 * is no worse than today's behavior for tools this map doesn't yet know
 * about.
 */
export function normalizeHermesTool(toolName, toolInput) {
  const mappedName = HERMES_TOOL_MAP[toolName];
  if (mappedName === undefined) {
    return { tool_name: toolName ?? null, tool_input: toolInput ?? null };
  }

  if (toolInput === null || typeof toolInput !== "object" || Array.isArray(toolInput)) {
    return { tool_name: mappedName, tool_input: toolInput ?? null };
  }

  if (toolName === "patch") {
    const filePath = extractPatchFilePath(toolInput);
    return {
      tool_name: mappedName,
      tool_input: filePath === undefined ? { ...toolInput } : { ...toolInput, file_path: filePath },
    };
  }

  // read_file / write_file carry the path in Hermes's `path` field; Norm
  // reads `file_path` first (see router.ts extractWritePath/extractReadPath).
  // terminal's `command` field already matches Claude's Bash shape 1:1 — the
  // `path` check below is simply a no-op for it (no `path` key present).
  if (typeof toolInput.path === "string" && toolInput.file_path === undefined) {
    return { tool_name: mappedName, tool_input: { ...toolInput, file_path: toolInput.path } };
  }

  return { tool_name: mappedName, tool_input: { ...toolInput } };
}

/**
 * buildClaudePayload — map a Hermes wire-protocol payload to the
 * Claude-shaped payload norm's `--format claude` stdin reader expects
 * (see packages/hima-cli/src/stdin.ts::normalizePayload). Normalizes the
 * tool name/input via normalizeHermesTool so Norm's write/read gates
 * (which key on Claude's PascalCase tool names) actually recognize a real
 * Hermes tool call instead of silently treating every one as non-write.
 */
export function buildClaudePayload(hermesPayload, mapping) {
  const sessionId =
    typeof hermesPayload.session_id === "string" && hermesPayload.session_id !== ""
      ? hermesPayload.session_id
      : "unknown-session";
  const { tool_name, tool_input } = normalizeHermesTool(
    hermesPayload.tool_name ?? null,
    hermesPayload.tool_input ?? null,
  );
  return {
    hook_event_name: mapping.claudeHookEventName,
    tool_name,
    tool_input,
    session_id: sessionId,
  };
}

/**
 * resolveRoot — HIMA_PROJECT_ROOT env var, falling back to the Hermes
 * payload's `cwd` field, falling back to the bridge process's own cwd.
 * Mirrors the resolution order documented in SPEC-007-adapter-hermes.md.
 */
export function resolveRoot(hermesPayload, env, fallbackCwd) {
  if (typeof env.HIMA_PROJECT_ROOT === "string" && env.HIMA_PROJECT_ROOT !== "") {
    return env.HIMA_PROJECT_ROOT;
  }
  if (typeof hermesPayload.cwd === "string" && hermesPayload.cwd !== "") {
    return hermesPayload.cwd;
  }
  return fallbackCwd;
}

/**
 * interpretNormResult — turn a `norm hook <event> --format claude` process
 * result into the JSON body to print on this bridge's stdout.
 *
 * `hookEventName` (the ORIGINAL Hermes event name, not the mapped norm one)
 * decides whether a block is even possible: only "pre_tool_call" can block —
 * "subagent_start" always allows because Hermes ignores its return value.
 *
 * `normResult` — `{ error?: Error, status: number|null, stdout: string, stderr: string }`.
 */
export function interpretNormResult(hookEventName, normResult) {
  if (normResult.error) {
    return { body: ALLOW_BODY, warning: `spawn error: ${normResult.error.message}` };
  }

  if (hookEventName === "subagent_start") {
    // Ignored by Hermes regardless of content — norm hook subagent-start was
    // invoked above purely for its markStageDelegation side effect.
    return { body: ALLOW_BODY, warning: null };
  }

  if (normResult.status === 2) {
    let reason = "hima: blocked (no reason provided by norm)";
    const stdout = (normResult.stdout ?? "").trim();
    if (stdout !== "") {
      try {
        const parsed = JSON.parse(stdout);
        if (parsed && typeof parsed.reason === "string" && parsed.reason !== "") {
          reason = parsed.reason;
        }
      } catch {
        // stdout wasn't valid JSON — keep the generic reason, no warning:
        // this is an expected shape mismatch, not a bridge failure.
      }
    }
    return { body: JSON.stringify({ action: "block", message: reason }), warning: null };
  }

  if (normResult.status !== 0) {
    return {
      body: ALLOW_BODY,
      warning: `norm exited ${String(normResult.status)}; stderr: ${(normResult.stderr ?? "").slice(0, 200)}`,
    };
  }

  return { body: ALLOW_BODY, warning: null };
}

// ---------------------------------------------------------------------------
// runBridge — the full pipeline with injectable I/O (for unit tests)
// ---------------------------------------------------------------------------

/**
 * runBridge — read stdin, map the event, spawn `norm hook ... --format claude`,
 * and return the JSON body to print. All I/O is injected so this is fully
 * unit-testable without a real Hermes process or a real `norm` binary.
 *
 * @param {object} opts
 * @param {() => Promise<string>} opts.readStdin
 * @param {(bin: string, args: string[], spawnOpts: object) => {error?: Error, status: number|null, stdout: string, stderr: string}} opts.spawn
 * @param {Record<string,string|undefined>} opts.env
 * @param {string} opts.cwd
 * @returns {Promise<{ body: string, warning: string|null }>}
 */
export async function runBridge({ readStdin, spawn, env, cwd }) {
  let raw;
  try {
    raw = await readStdin();
  } catch (err) {
    return { body: ALLOW_BODY, warning: `stdin read error: ${err?.message ?? String(err)}` };
  }

  const parsedResult = parseHermesPayload(raw);
  if (!parsedResult.ok) {
    return { body: ALLOW_BODY, warning: parsedResult.error };
  }
  const hermesPayload = parsedResult.payload;

  const hookEventName =
    typeof hermesPayload.hook_event_name === "string" ? hermesPayload.hook_event_name : "";
  const mapping = resolveEventMapping(hookEventName);
  if (!mapping) {
    return { body: ALLOW_BODY, warning: `unmapped hook_event_name "${hookEventName}" — passing through` };
  }

  const claudePayload = buildClaudePayload(hermesPayload, mapping);
  const root = resolveRoot(hermesPayload, env, cwd);
  const normBin = env.NORM_BIN || "norm";

  let normResult;
  try {
    normResult = spawn(
      normBin,
      ["hook", mapping.normEvent, "--format", "claude", "--root", root],
      {
        input: JSON.stringify(claudePayload),
        timeout: NORM_TIMEOUT_MS,
        encoding: "utf8",
        maxBuffer: 4 * 1024 * 1024,
      },
    );
  } catch (err) {
    normResult = { error: err, status: null, stdout: "", stderr: "" };
  }

  return interpretNormResult(hookEventName, normResult);
}

// ---------------------------------------------------------------------------
// CLI entry point — real process I/O, only runs when executed directly.
// ---------------------------------------------------------------------------

async function readRealStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function realSpawn(bin, args, opts) {
  const result = spawnSync(bin, args, opts);
  return {
    error: result.error,
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

async function main() {
  const { body, warning } = await runBridge({
    readStdin: readRealStdin,
    spawn: realSpawn,
    env: process.env,
    cwd: process.cwd(),
  });
  if (warning) {
    try {
      process.stderr.write(`[norm-hermes-hook] ${warning}\n`);
    } catch {
      // ignore — stderr write failure must never crash the bridge
    }
  }
  process.stdout.write(body + "\n");
  process.exit(0);
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((err) => {
    try {
      process.stderr.write(`[norm-hermes-hook] unhandled error: ${err?.message ?? String(err)}\n`);
    } catch {
      // ignore
    }
    try {
      process.stdout.write(ALLOW_BODY + "\n");
    } catch {
      // ignore
    }
    process.exit(0);
  });
}
