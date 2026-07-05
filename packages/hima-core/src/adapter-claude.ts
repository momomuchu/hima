import type { ForceAction } from "@norm/schemas";

/**
 * adapter-claude — translate a ForceAction into the Claude Code runtime response shape.
 *
 * Mapping (from KEY DATA):
 *   hard-block / skill-force → { decision: "block", reason, exitCode: 2 }
 *   rich-inject              → { decision: "continue", additionalContext: content, exitCode: 0 }
 *   constrained-inject       → { decision: "continue", additionalContext: systemMessage, exitCode: 0 }
 *   deferred-block           → { decision: "continue", exitCode: 0 }  (verdict already persisted)
 *   observe-only / noop      → { decision: "continue", exitCode: 0 }
 *
 * See: .planning/architecture/ARCHITECTURE-v3.md §3.2, ARCHITECTURE-FLOW-v3.md §3.
 */

export type ClaudeResponse = {
  decision: "block" | "continue";
  reason?: string;
  additionalContext?: string;
  exitCode: 0 | 2;
};

/**
 * translateClaude — convert a ForceAction into a Claude Code hook-response payload.
 */
export function translateClaude(action: ForceAction): ClaudeResponse {
  switch (action.kind) {
    case "hard-block":
      return {
        decision: "block",
        reason: action.reason,
        exitCode: 2,
      };

    case "skill-force":
      return {
        decision: "block",
        reason: action.reason,
        exitCode: 2,
      };

    case "rich-inject":
      return {
        decision: "continue",
        additionalContext: action.content,
        exitCode: 0,
      };

    case "constrained-inject":
      return {
        decision: "continue",
        additionalContext: action.systemMessage,
        exitCode: 0,
      };

    case "deferred-block":
      // Verdict already written to disk by caller; Claude gate continues.
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
  }
}
