#!/usr/bin/env node
/**
 * @hima/cli — hima hook dispatcher + trace viewer + setup
 *
 * Subcommands:
 *   hima hook <event> [--format claude] [--root <dir>]
 *   hima trace [--session <id>] [--root <dir>] [--gate <g>] [--decision <d>]
 *              [--only-blocks] [--json] [--watch]
 *   hima observe  (alias for hima trace)
 *   hima setup [--runtime claude|codex|hermes] [--fresh] [--root <dir>]
 *
 * Supported hook events:
 *   session-start | user-prompt-submit | pre-tool-use | post-tool-use |
 *   pre-compact   | post-compact       | subagent-start
 *
 * Reads a JSON payload from stdin (Claude hook format). Tolerates empty or
 * invalid stdin — treated as {}.
 *
 * Output (stdout) follows the Claude Code hook response protocol:
 *   BLOCK   → {"decision":"block","reason":"..."} + exit 2
 *   CONTEXT → {"hookSpecificOutput":{...}} + exit 0
 *   ALLOW   → exit 0 (no stdout)
 *
 * Root resolution order: --root flag > HIMA_PROJECT_ROOT env > cwd.
 *
 * SAFETY: any error at any level → exit 0 (allow). The CLI must never crash
 * or block a live session on unexpected input.
 *
 * EXPORTS:
 *   route(event, payload, root) — testable helper that returns {stdout, exitCode}
 *     without writing to the real process streams. Used by router.test.ts.
 */

import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readStdinPayload } from "./stdin.js";
import {
  handleUserPromptSubmit,
  handlePreToolUse,
  handleNoOp,
} from "./router.js";
import type { StdinPayload } from "./stdin.js";
import { renderObserve, filterTrace, type TraceFilter } from "./observe.js";
import { runSetup } from "./setup.js";

// Lazy import of readTrace from @hima/core to avoid loading it for hook commands
async function getReadTrace() {
  const { readTrace } = await import("@hima/core");
  return readTrace;
}

// ---------------------------------------------------------------------------
// Supported hook events
// ---------------------------------------------------------------------------

const KNOWN_EVENTS = new Set([
  "session-start",
  "user-prompt-submit",
  "pre-tool-use",
  "post-tool-use",
  "pre-compact",
  "post-compact",
  "subagent-start",
]);

// ---------------------------------------------------------------------------
// Arg parsing — intentionally minimal, no third-party parser needed
// ---------------------------------------------------------------------------

type ParsedArgs = {
  subcommand: "hook" | "trace" | "setup" | null;
  event: string | null;
  root: string | null;
  format: string;
  // trace-specific flags
  session: string | null;
  gate: string | null;
  decision: string | null;
  onlyBlocks: boolean;
  json: boolean;
  watch: boolean;
  // setup-specific flags
  runtime: "claude" | "codex" | "hermes" | null;
  fresh: boolean;
};

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);

  let subcommand: "hook" | "trace" | "setup" | null = null;
  let event: string | null = null;
  let root: string | null = null;
  let format = "claude";
  let session: string | null = null;
  let gate: string | null = null;
  let decision: string | null = null;
  let onlyBlocks = false;
  let json = false;
  let watch = false;
  let runtime: "claude" | "codex" | "hermes" | null = null;
  let fresh = false;

  let i = 0;
  while (i < args.length) {
    const arg = args[i] ?? "";
    if ((arg === "hook") && subcommand === null) {
      subcommand = "hook";
    } else if ((arg === "trace" || arg === "observe") && subcommand === null) {
      subcommand = "trace";
    } else if (arg === "setup" && subcommand === null) {
      subcommand = "setup";
    } else if (arg === "--root" && i + 1 < args.length) {
      root = args[i + 1] ?? null;
      i += 1;
    } else if (arg.startsWith("--root=")) {
      root = arg.slice("--root=".length);
    } else if (arg === "--format" && i + 1 < args.length) {
      format = args[i + 1] ?? "claude";
      i += 1;
    } else if (arg.startsWith("--format=")) {
      format = arg.slice("--format=".length);
    } else if (arg === "--session" && i + 1 < args.length) {
      session = args[i + 1] ?? null;
      i += 1;
    } else if (arg.startsWith("--session=")) {
      session = arg.slice("--session=".length);
    } else if (arg === "--gate" && i + 1 < args.length) {
      gate = args[i + 1] ?? null;
      i += 1;
    } else if (arg.startsWith("--gate=")) {
      gate = arg.slice("--gate=".length);
    } else if (arg === "--decision" && i + 1 < args.length) {
      decision = args[i + 1] ?? null;
      i += 1;
    } else if (arg.startsWith("--decision=")) {
      decision = arg.slice("--decision=".length);
    } else if (arg === "--only-blocks") {
      onlyBlocks = true;
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--watch") {
      watch = true;
    } else if (arg === "--fresh") {
      fresh = true;
    } else if (arg === "--runtime" && i + 1 < args.length) {
      const rv = args[i + 1] ?? "";
      if (rv === "claude" || rv === "codex" || rv === "hermes") {
        runtime = rv;
      }
      i += 1;
    } else if (arg.startsWith("--runtime=")) {
      const rv = arg.slice("--runtime=".length);
      if (rv === "claude" || rv === "codex" || rv === "hermes") {
        runtime = rv;
      }
    } else if (!arg.startsWith("--") && subcommand === "hook" && event === null) {
      event = arg;
    }
    i += 1;
  }

  return { subcommand, event, root, format, session, gate, decision, onlyBlocks, json, watch, runtime, fresh };
}

// ---------------------------------------------------------------------------
// Root resolution
// ---------------------------------------------------------------------------

function resolveRoot(flagRoot: string | null): string {
  if (flagRoot !== null && flagRoot.length > 0) {
    return path.resolve(flagRoot);
  }
  const envRoot = process.env["HIMA_PROJECT_ROOT"];
  if (typeof envRoot === "string" && envRoot.length > 0) {
    return path.resolve(envRoot);
  }
  return process.cwd();
}

// ---------------------------------------------------------------------------
// Trace viewer helpers
// ---------------------------------------------------------------------------

/**
 * findLatestSessionId — list trace files and return the sessionId of the most
 * recently modified one. Returns null if none exist.
 */
async function findLatestSessionId(root: string): Promise<string | null> {
  const traceDir = path.join(root, ".hima", "state", "trace");
  let files: string[];
  try {
    files = await readdir(traceDir);
  } catch {
    return null;
  }

  const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"));
  if (jsonlFiles.length === 0) return null;

  let latestFile = "";
  let latestMtime = 0;

  for (const f of jsonlFiles) {
    try {
      const s = await stat(path.join(traceDir, f));
      if (s.mtimeMs > latestMtime) {
        latestMtime = s.mtimeMs;
        latestFile = f;
      }
    } catch {
      // skip unreadable files
    }
  }

  if (latestFile === "") return null;
  // Strip .jsonl extension to get sessionId
  return latestFile.slice(0, -".jsonl".length);
}

/**
 * runTraceCommand — read and render the trace for a session.
 * Used by both the one-shot and --watch paths.
 */
async function runTraceCommand(
  root: string,
  sessionId: string,
  args: ParsedArgs,
): Promise<void> {
  const readTrace = await getReadTrace();
  const events = await readTrace(root, sessionId);

  if (args.json) {
    process.stdout.write(JSON.stringify(events, null, 2) + "\n");
    return;
  }

  const filter: TraceFilter = {
    gate: args.gate ?? undefined,
    decision: args.decision ?? undefined,
    onlyBlocks: args.onlyBlocks,
  };

  process.stdout.write(renderObserve(events, filter) + "\n");
}

// ---------------------------------------------------------------------------
// route — testable core dispatcher (exported for unit tests)
//
// Intercepts stdout writes and the process.exitCode so tests can assert on
// the emitted output without spawning a subprocess.
// ---------------------------------------------------------------------------

export type RouteResult = { stdout: string; exitCode: number };

/**
 * route — dispatch a hook event and return {stdout, exitCode} without touching
 * the real process streams.
 *
 * This is the canonical logic shared between the CLI entry-point (main) and
 * the unit-test suite (router.test.ts). It temporarily monkey-patches
 * process.stdout.write and process.exitCode so handlers in router.ts can call
 * the same emitBlock/emitContext/emitAllow helpers unmodified.
 */
export async function route(
  event: string,
  payload: StdinPayload,
  root: string,
): Promise<RouteResult> {
  // Buffer for captured stdout output.
  let captured = "";

  // Save originals so we can restore them unconditionally.
  const originalWrite = process.stdout.write.bind(process.stdout);
  const originalExitCode = process.exitCode;

  // Intercept stdout.
  process.stdout.write = (
    chunk: string | Uint8Array,
    encodingOrCb?: BufferEncoding | ((err?: Error | null) => void),
    cb?: (err?: Error | null) => void,
  ): boolean => {
    captured += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    // Call the callback if provided (mirrors the real write signature).
    const callback = typeof encodingOrCb === "function" ? encodingOrCb : cb;
    if (callback !== undefined) callback();
    return true;
  };

  // Reset exitCode for this invocation.
  process.exitCode = 0;

  const sessionId = payload.sessionId ?? "unknown-session";

  try {
    if (!KNOWN_EVENTS.has(event)) {
      // Unknown event — safety net, exit 0
      process.stderr.write(
        `[hima] unknown or missing event: ${String(event)} — allowing\n`,
      );
    } else {
      switch (event) {
        case "user-prompt-submit":
          await handleUserPromptSubmit(root, payload);
          break;

        case "pre-tool-use":
          await handlePreToolUse(root, payload);
          break;

        case "session-start":
        case "post-tool-use":
        case "pre-compact":
        case "post-compact":
        case "subagent-start":
          await handleNoOp(event, root, sessionId);
          break;

        default:
          await handleNoOp(event, root, sessionId);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[hima] error in handler for "${event}": ${msg} — allowing\n`);
    process.exitCode = 0;
  } finally {
    // Always restore stdout.write.
    process.stdout.write = originalWrite;
  }

  const exitCode = process.exitCode ?? 0;

  // Restore the original exitCode so repeated calls don't accumulate state.
  process.exitCode = originalExitCode;

  return { stdout: captured, exitCode };
}

// ---------------------------------------------------------------------------
// Main entry point (CLI)
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv);
  const root = resolveRoot(parsed.root);

  // -------------------------------------------------------------------------
  // hima setup subcommand
  // -------------------------------------------------------------------------
  if (parsed.subcommand === "setup") {
    // Derive the absolute path to this CLI's dist entry so the wired hooks
    // point at the real installed binary (not a global "hima" shim).
    const himaBinPath = fileURLToPath(import.meta.url);

    try {
      const result = await runSetup({
        root,
        runtime: parsed.runtime ?? undefined,
        fresh: parsed.fresh,
        himaBinPath,
      });

      for (const msg of result.messages) {
        process.stdout.write(`[hima setup] ${msg}\n`);
      }

      const wiredCount = result.wired.length;
      const scaffoldedCount = result.scaffolded.length;
      const resetCount = result.reset.length;

      process.stdout.write(
        `[hima setup] Done — runtime: ${result.runtime}` +
          `, wired: ${wiredCount}` +
          `, scaffolded: ${scaffoldedCount}` +
          `, reset: ${resetCount}\n`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[hima setup] error: ${msg}\n`);
      process.exitCode = 1;
    }
    return;
  }

  // -------------------------------------------------------------------------
  // hima trace / hima observe subcommand
  // -------------------------------------------------------------------------
  if (parsed.subcommand === "trace") {
    // Determine sessionId: explicit --session or most-recently-modified file.
    let sessionId = parsed.session;
    if (sessionId === null || sessionId === "") {
      sessionId = await findLatestSessionId(root);
      if (sessionId === null) {
        process.stderr.write("[hima] trace: no trace files found in .hima/state/trace/\n");
        process.exitCode = 1;
        return;
      }
    }

    if (parsed.watch) {
      // --watch: poll every ~1s and print new events as they arrive.
      const readTrace = await getReadTrace();
      let lastCount = 0;

      process.stderr.write(`[hima] watching trace for session: ${sessionId}\n`);

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const events = await readTrace(root, sessionId);
        if (events.length > lastCount) {
          const newEvents = events.slice(lastCount);
          lastCount = events.length;
          const filter: TraceFilter = {
            gate: parsed.gate ?? undefined,
            decision: parsed.decision ?? undefined,
            onlyBlocks: parsed.onlyBlocks,
          };
          const filtered = filterTrace(newEvents, filter);
          if (filtered.length > 0) {
            const { renderTimeline } = await import("./observe.js");
            process.stdout.write(renderTimeline(filtered) + "\n");
          }
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      }
    } else {
      await runTraceCommand(root, sessionId, parsed);
    }
    return;
  }

  // -------------------------------------------------------------------------
  // hima hook subcommand
  // -------------------------------------------------------------------------
  const { event } = parsed;

  // Unknown or missing event → exit 0 (allow, do not block session)
  if (event === null || !KNOWN_EVENTS.has(event)) {
    process.stderr.write(
      `[hima] unknown or missing event: ${String(event)} — allowing\n`,
    );
    return;
  }

  // Read stdin payload — always tolerates failures
  const payload = await readStdinPayload();
  const sessionId = payload.sessionId ?? "unknown-session";

  // Dispatch to the appropriate handler
  // Each handler is wrapped here so any error results in exit 0 (allow)
  try {
    switch (event) {
      case "user-prompt-submit":
        await handleUserPromptSubmit(root, payload);
        break;

      case "pre-tool-use":
        await handlePreToolUse(root, payload);
        break;

      // All other events: no-op
      case "session-start":
      case "post-tool-use":
      case "pre-compact":
      case "post-compact":
      case "subagent-start":
        await handleNoOp(event, root, sessionId);
        break;

      default:
        // Type-exhaustiveness safety net (already guarded by KNOWN_EVENTS above)
        await handleNoOp(event, root, sessionId);
    }
  } catch (err: unknown) {
    // SAFETY: never let an error block the session
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[hima] error in handler for "${event}": ${msg} — allowing\n`);
    // exit 0 (default) — do not set exitCode = 2
  }
}

main().catch((err: unknown) => {
  // Top-level safety net: even if main() itself throws, exit 0
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[hima] fatal: ${msg} — allowing\n`);
  process.exitCode = 0;
});
