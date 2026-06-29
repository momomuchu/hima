#!/usr/bin/env node
/**
 * @hima/cli — hima hook dispatcher
 *
 * Usage:
 *   hima hook <event> [--format claude] [--root <dir>]
 *
 * Supported events:
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

import path from "node:path";

import { readStdinPayload } from "./stdin.js";
import {
  handleUserPromptSubmit,
  handlePreToolUse,
  handleNoOp,
} from "./router.js";
import type { StdinPayload } from "./stdin.js";

// ---------------------------------------------------------------------------
// Supported events
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
  event: string | null;
  root: string | null;
  format: string;
};

function parseArgs(argv: string[]): ParsedArgs {
  // argv[0] = node, argv[1] = script, argv[2] = "hook", argv[3] = <event>, ...
  const args = argv.slice(2);

  let subcommand: string | null = null;
  let event: string | null = null;
  let root: string | null = null;
  let format = "claude";

  let i = 0;
  while (i < args.length) {
    const arg = args[i] ?? "";
    if (arg === "hook" && subcommand === null) {
      subcommand = "hook";
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
    } else if (!arg.startsWith("--") && subcommand === "hook" && event === null) {
      event = arg;
    }
    i += 1;
  }

  return { event, root, format };
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
          handleNoOp(event);
          break;

        default:
          handleNoOp(event);
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
  const { event, root: flagRoot } = parseArgs(process.argv);

  // Unknown or missing event → exit 0 (allow, do not block session)
  if (event === null || !KNOWN_EVENTS.has(event)) {
    process.stderr.write(
      `[hima] unknown or missing event: ${String(event)} — allowing\n`,
    );
    return;
  }

  const root = resolveRoot(flagRoot);

  // Read stdin payload — always tolerates failures
  const payload = await readStdinPayload();

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
        handleNoOp(event);
        break;

      default:
        // Type-exhaustiveness safety net (already guarded by KNOWN_EVENTS above)
        handleNoOp(event);
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
