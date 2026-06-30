#!/usr/bin/env node
/**
 * main.mjs — Hermes plugin bridge for hima governance.
 *
 * Hermes invokes this script once per hook event with the Hermes native hook
 * name as the first positional argument (process.argv[2]) and the event
 * payload as JSON on stdin.  The bridge:
 *
 *   1. Maps the Hermes native hook name to the hima kebab-case event name.
 *   2. Resolves HIMA_PROJECT_ROOT from the environment (fallback: process.cwd()).
 *   3. Verifies that `hima` is available in PATH and that `.hima/` exists at
 *      the resolved root.
 *   4. Spawns `hima hook <event> --format hermes --root <root>`, piping stdin
 *      through and printing stdout verbatim.
 *   5. On any failure (hima absent, .hima/ missing, spawn error, timeout) →
 *      emits {"action":"continue"} and exits 0.
 *
 * Graceful-degradation contract (SPEC-007 §HIGH – plugin configuration):
 *   This script NEVER crashes silently and NEVER emits a malformed response.
 *   If anything goes wrong the Hermes session continues uninterrupted.
 *
 * Hook name mapping (Hermes native → hima kebab-case):
 *   pre_tool_call    → pre-tool-use        (canBlock=true)
 *   pre_llm_call     → user-prompt-submit  (canBlock=true)
 *   on_session_start → session-start       (canBlock=false / degraded)
 *   on_session_end   → stop                (canBlock=false / deferred)
 *   post_tool_call   → post-tool-use       (canBlock=false / observer)
 *   pre_compact      → pre-compact         (canBlock=true)
 *   post_compact     → post-compact        (canBlock=false / observer)
 *   subagent_stop    → subagent-stop       (canBlock=false / observer)
 *
 * subagent_start is ABSENT on Hermes; compensated via pre_tool_call intercept
 * of delegate_task calls (R-028 / R-038 / SPEC-007 §HIGH).
 */

import { spawnSync, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Map Hermes native hook names → hima CLI event names. */
const HOOK_MAP = /** @type {Record<string,string>} */ ({
  pre_tool_call: "pre-tool-use",
  pre_llm_call: "user-prompt-submit",
  on_session_start: "session-start",
  on_session_end: "stop",
  post_tool_call: "post-tool-use",
  pre_compact: "pre-compact",
  post_compact: "post-compact",
  subagent_stop: "subagent-stop",
});

/** Safe fallback response — always valid Hermes ACP JSON. */
const CONTINUE = JSON.stringify({ action: "continue" });

/** Maximum ms to wait for `hima hook` to respond. */
const SPAWN_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Emit a safe continue response and exit 0.
 * @param {string} [reason] - optional diagnostic written to stderr
 */
function continueAndExit(reason) {
  if (reason) process.stderr.write(`[hima-bridge] ${reason}\n`);
  process.stdout.write(CONTINUE + "\n");
  process.exit(0);
}

/**
 * Check whether `hima` is resolvable in PATH.
 * @returns {boolean}
 */
function isHimaAvailable() {
  try {
    execFileSync("hima", ["--version"], { stdio: "ignore", timeout: 3_000 });
    return true;
  } catch {
    // hima absent or --version not recognised — treat as unavailable
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const hookName = process.argv[2] ?? "";
const himaEvent = HOOK_MAP[hookName];

if (!himaEvent) {
  // Unknown hook — not declared in plugin.toml; continue gracefully.
  continueAndExit(`unknown hook "${hookName}" — not in HOOK_MAP, passing through`);
}

const root = process.env["HIMA_PROJECT_ROOT"] ?? process.cwd();

// Warn (non-blocking) when HERMES_HOME is absent — profile switching will be
// disabled for this session (SPEC-007 §HIGH Profils et HERMES_HOME; R-055).
if (!process.env["HERMES_HOME"]) {
  process.stderr.write(
    "[hima-bridge] HERMES_HOME is not set — profile switching mid-session is disabled.\n",
  );
}

// Verify .hima/ exists at the resolved root.
if (!existsSync(join(root, ".hima"))) {
  continueAndExit(
    `.hima/ not found at root "${root}" — hima not initialised, passing through`,
  );
}

// Verify hima CLI is available in PATH.
if (!isHimaAvailable()) {
  continueAndExit("hima not found in PATH — passing through");
}

// ---------------------------------------------------------------------------
// Read stdin (event payload from Hermes) into a Buffer.
// spawnSync will re-pipe it to hima via the `input` option.
// ---------------------------------------------------------------------------

const chunks = /** @type {Buffer[]} */ ([]);
// stdin may already be paused; resume to collect data.
process.stdin.resume();
for await (const chunk of process.stdin) {
  chunks.push(/** @type {Buffer} */ (chunk));
}
const stdinPayload = Buffer.concat(chunks);

// ---------------------------------------------------------------------------
// Invoke: hima hook <event> --format hermes --root <root>
// ---------------------------------------------------------------------------

const result = spawnSync(
  "hima",
  ["hook", himaEvent, "--format", "hermes", "--root", root],
  {
    input: stdinPayload,
    timeout: SPAWN_TIMEOUT_MS,
    maxBuffer: 4 * 1024 * 1024, // 4 MiB
    encoding: "buffer",
  },
);

// Handle spawn-level errors (ENOENT, ETIMEDOUT, etc.).
if (result.error) {
  continueAndExit(`spawn error for "${himaEvent}": ${result.error.message}`);
}

// Handle non-zero exit from hima:
//   exit 2 → hard-block → propagate stdout (which contains the block JSON)
//   exit 1 → internal hima error → degrade gracefully
//   exit 0 → normal continue
if (result.status === 1) {
  const errText = result.stderr ? result.stderr.toString("utf8") : "";
  continueAndExit(`hima exited 1 for "${himaEvent}" — degrading. stderr: ${errText.slice(0, 200)}`);
}

const stdout = result.stdout ? result.stdout.toString("utf8").trim() : "";

// Validate that stdout is parsable JSON before forwarding.
if (!stdout) {
  continueAndExit(`empty stdout from hima for "${himaEvent}" — emitting continue`);
}

try {
  JSON.parse(stdout);
} catch {
  continueAndExit(`non-JSON stdout from hima for "${himaEvent}" — emitting continue`);
}

// Forward hima's response to Hermes.
process.stdout.write(stdout + "\n");
process.exit(result.status ?? 0);
