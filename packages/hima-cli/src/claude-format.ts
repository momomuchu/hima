/**
 * claude-format — helpers for emitting the Claude Code hook response shapes.
 *
 * Claude reads stdout from hook processes and parses it as JSON.
 * Three shapes are used by this CLI:
 *
 *   BLOCK   → { "decision": "block", "reason": "<text>" }
 *             process.exitCode = 2
 *
 *   CONTEXT → { "hookSpecificOutput": {
 *                 "hookEventName": "<event>",
 *                 "additionalContext": "<text>"
 *               }}
 *             exit 0
 *
 *   ALLOW   → exit 0, no stdout (or {"continue":true})
 *
 * See: Claude Code hook documentation, adapter-claude.ts in @hima/core.
 */

/** Write a BLOCK response to stdout and set exitCode=2. */
export function emitBlock(reason: string): void {
  process.stdout.write(
    JSON.stringify({ decision: "block", reason }) + "\n",
  );
  process.exitCode = 2;
}

/** Write a CONTEXT (additionalContext) response to stdout (exit 0). */
export function emitContext(eventName: string, additionalContext: string): void {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: eventName,
        additionalContext,
      },
    }) + "\n",
  );
}

/** Silent allow — exit 0, nothing written to stdout. */
export function emitAllow(): void {
  // No-op: exit 0 is the default.
}
