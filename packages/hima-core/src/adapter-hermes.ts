import type { ForceAction } from "@norm/schemas";
import type { ClaudeResponse } from "./adapter-claude.js";

/**
 * adapter-hermes — translate a ForceAction into the Hermes ACP runtime response shape.
 *
 * Hermes uses the Agent Control Protocol (ACP) format where the hook must emit
 * a JSON object with {action:"block"|"continue", message?|content?} on stdout.
 *
 * Mapping (from ARCHITECTURE-v3 §3.2/§3.5, gap register R-011):
 *   hard-block / skill-force  → {decision:"block", reason, raw:{action:"block",message:<reason>}, exitCode:2}
 *   rich-inject               → DOWNGRADE to constrained-inject:
 *                               {decision:"continue", raw:{action:"continue",content:truncate(content,1800)}, additionalContext:content, exitCode:0}
 *   constrained-inject        → {decision:"continue", raw:{action:"continue",content:truncate(systemMessage,1800)}, additionalContext:systemMessage, exitCode:0}
 *   deferred-block            → {decision:"continue", raw:{action:"continue"}, exitCode:0}
 *   observe-only / noop       → {decision:"continue", raw:{action:"continue"}, exitCode:0}
 *
 * The returned shape is compatible with DispatchResponse (from dispatch.ts).
 */

/** Maximum bytes Hermes accepts in a constrained injection. */
const HERMES_MAX_INJECT_BYTES = 1800;

/** Raw ACP object emitted on Hermes stdout. */
export type AcpObject =
  | { action: "block"; message: string }
  | { action: "continue"; content?: string };

/** Hermes response — a DispatchResponse-compatible object with an ACP raw payload. */
export type HermesResponse = ClaudeResponse & { raw: AcpObject };

/** Truncate a string to at most maxBytes UTF-8 bytes. */
function truncateUtf8(text: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  if (bytes.length <= maxBytes) return text;
  // Decode back from byte-truncated slice; TextDecoder ignores incomplete
  // multi-byte sequences at the end when fatal=false (the default).
  const decoder = new TextDecoder("utf-8");
  return decoder.decode(bytes.slice(0, maxBytes));
}

/**
 * translateHermes — convert a ForceAction into a Hermes ACP hook-response payload.
 *
 * Export includes the raw ACP object so dispatchTranslate (and tests) can inspect it.
 */
export function translateHermes(action: ForceAction): HermesResponse {
  switch (action.kind) {
    case "hard-block": {
      const raw: AcpObject = { action: "block", message: action.reason };
      return {
        decision: "block",
        reason: action.reason,
        raw,
        exitCode: 2,
      };
    }

    case "skill-force": {
      const message = action.reason;
      const raw: AcpObject = { action: "block", message };
      return {
        decision: "block",
        reason: action.reason,
        raw,
        exitCode: 2,
      };
    }

    case "rich-inject": {
      // Downgrade: Hermes cannot render rich system-reminders; treat as constrained.
      const content = truncateUtf8(action.content, HERMES_MAX_INJECT_BYTES);
      const raw: AcpObject = { action: "continue", content };
      return {
        decision: "continue",
        additionalContext: action.content,
        raw,
        exitCode: 0,
      };
    }

    case "constrained-inject": {
      const content = truncateUtf8(action.systemMessage, HERMES_MAX_INJECT_BYTES);
      const raw: AcpObject = { action: "continue", content };
      return {
        decision: "continue",
        additionalContext: action.systemMessage,
        raw,
        exitCode: 0,
      };
    }

    case "deferred-block": {
      // Hermes stop is deferred; continue so the gate does not prematurely halt.
      const raw: AcpObject = { action: "continue" };
      return {
        decision: "continue",
        raw,
        exitCode: 0,
      };
    }

    case "observe-only": {
      const raw: AcpObject = { action: "continue" };
      return {
        decision: "continue",
        raw,
        exitCode: 0,
      };
    }

    case "noop": {
      const raw: AcpObject = { action: "continue" };
      return {
        decision: "continue",
        raw,
        exitCode: 0,
      };
    }

    default: {
      // TypeScript never-check — exhaustiveness guard.
      const _exhaustive: never = action;
      throw new Error(
        `translateHermes: unhandled ForceAction kind: ${String((_exhaustive as { kind: string }).kind)}`,
      );
    }
  }
}
