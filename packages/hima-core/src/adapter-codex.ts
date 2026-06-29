import type { ForceAction } from "@hima/schemas";

/**
 * adapter-codex — translate a ForceAction into the Codex runtime response shape.
 *
 * Codex constraints (from ARCHITECTURE-v3.md §3.2/§3.5, gap register R-010/R-011):
 *   - Codex uses stdout JSON; there is no rich system-reminder channel.
 *   - systemMessage is the injection channel, capped at 1800 bytes.
 *   - Only pre_tool + stop hooks can hard-block (exit 2).
 *   - hard-block / skill-force → block exit 2; systemMessage carries skill id in first 100 chars.
 *   - rich-inject              → DOWNGRADED to constrained-inject (no rich channel).
 *   - constrained-inject       → continue exit 0; systemMessage truncated to 1800 bytes.
 *   - deferred-block           → continue exit 0 (verdict already persisted by caller).
 *   - observe-only / noop      → continue exit 0.
 *
 * See: ARCHITECTURE-v3.md §3.2, ARCHITECTURE-FLOW-v3.md §3, V3-COMPLETENESS-AUDIT.md R-010.
 */

/** Maximum byte length for a Codex systemMessage injection. */
const MAX_SYSTEM_MSG_BYTES = 1800;

/**
 * CodexResponse — the response payload returned by translateCodex.
 *
 * Structurally compatible with DispatchResponse from dispatch.ts (a superset of
 * ClaudeResponse extended with `systemMessage` and `raw`).
 */
export type CodexResponse = {
  decision: "block" | "continue";
  reason?: string;
  additionalContext?: string;
  /** Codex-specific: injected on stdout as the systemMessage field (≤1800 bytes). */
  systemMessage?: string;
  exitCode: 0 | 2;
  raw?: unknown;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Truncate `s` to at most `maxBytes` UTF-8 bytes.
 * Truncation walks back from the cut point to avoid splitting a multi-byte
 * code unit (continuation bytes have the form 10xxxxxx = 0x80–0xBF).
 */
function truncateToBytes(s: string, maxBytes: number): string {
  const buf = Buffer.from(s, "utf8");
  if (buf.length <= maxBytes) return s;
  let cut = maxBytes;
  // Walk back past any UTF-8 continuation bytes to find a safe boundary.
  while (cut > 0 && (buf[cut]! & 0xc0) === 0x80) {
    cut--;
  }
  return buf.subarray(0, cut).toString("utf8");
}

/**
 * Build a Codex systemMessage for a blocking action.
 *
 * For skill-force actions the skill id MUST appear within the first 100 characters
 * so that the Codex host can extract it from the truncated prefix without reading the
 * full message. Format: `[skill:<skillId>] <reason>`.
 *
 * For hard-block actions there is no skill id; the reason is the message directly.
 */
function buildBlockSystemMessage(reason: string, skillId?: string): string {
  if (skillId !== undefined) {
    // "[skill:<id>] <reason>" — skillId guaranteed in first 100 chars
    // as long as the id itself is ≤ 90 chars (prefix overhead is ~9 chars).
    return `[skill:${skillId}] ${reason}`;
  }
  return reason;
}

// ---------------------------------------------------------------------------
// translateCodex
// ---------------------------------------------------------------------------

/**
 * translateCodex — convert a ForceAction into a Codex hook-response payload.
 *
 * Exhaustive over all 7 ForceAction kinds; TypeScript never-check in the default
 * branch catches any future gap at compile time.
 */
export function translateCodex(action: ForceAction): CodexResponse {
  switch (action.kind) {
    case "hard-block":
      return {
        decision: "block",
        reason: action.reason,
        systemMessage: buildBlockSystemMessage(action.reason),
        exitCode: 2,
      };

    case "skill-force":
      return {
        decision: "block",
        reason: action.reason,
        systemMessage: buildBlockSystemMessage(action.reason, action.skillId),
        exitCode: 2,
      };

    case "rich-inject":
      // Codex has no rich system-reminder channel; downgrade to constrained-inject.
      // Content is emitted as a truncated systemMessage on stdout.
      return {
        decision: "continue",
        systemMessage: truncateToBytes(action.content, MAX_SYSTEM_MSG_BYTES),
        exitCode: 0,
      };

    case "constrained-inject":
      return {
        decision: "continue",
        systemMessage: truncateToBytes(action.systemMessage, MAX_SYSTEM_MSG_BYTES),
        exitCode: 0,
      };

    case "deferred-block":
      // Verdict is already written to disk by the caller; Codex gate continues.
      return {
        decision: "continue",
        exitCode: 0,
      };

    case "observe-only":
      return {
        decision: "continue",
        exitCode: 0,
      };

    case "noop":
      return {
        decision: "continue",
        exitCode: 0,
      };

    default: {
      // TypeScript exhaustiveness check — unreachable at runtime if the union is sound.
      const _exhaustiveCheck: never = action;
      throw new Error(
        `translateCodex: unhandled ForceAction kind: ${JSON.stringify(_exhaustiveCheck)}`,
      );
    }
  }
}
