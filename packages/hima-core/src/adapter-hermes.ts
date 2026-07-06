import type { ForceAction } from "@norm/schemas";
import type { ClaudeResponse } from "./adapter-claude.js";

/**
 * adapter-hermes — translate a ForceAction into the Hermes hook-response shape.
 *
 * CORRECTION (SOT C4, docs/research/runtime-capabilities.sot.json): Hermes does
 * NOT use ACP (Agent Client Protocol) for delegation or hooks. ACP is Zed's
 * editor<->agent protocol (LSP-like), used by Hermes ONLY in optional
 * editor-integration mode, and it defines no sub-agent/delegation primitive at
 * all. Hermes's actual delegation (`delegate_task`) and hook system
 * (pre_tool_call / post_tool_call / subagent_start / ...) are NATIVE PYTHON,
 * unrelated to ACP. The `{action, message?|content?}` object shape below is
 * Hermes's own native hook-response payload — it is kept as-is (it is what the
 * native hook contract needs); only the "ACP" label describing it was wrong.
 * The `AcpObject` type name is kept for now to avoid a wider rename; treat it
 * as "the Hermes native hook payload", not an ACP artifact. See also
 * SPEC-007-adapter-hermes.md.
 *
 * The hook emits a JSON object with {action:"block"|"continue", message?|content?}
 * on stdout.
 *
 * Mapping (from ARCHITECTURE-v3 §3.2/§3.5, gap register R-011):
 *   hard-block / skill-force  → {decision:"block", reason, raw:{action:"block",message:<reason>}, exitCode:2}
 *   rich-inject               → DOWNGRADE to constrained-inject:
 *                               {decision:"continue", raw:{action:"continue",content:truncate(content,20000)}, additionalContext:content, exitCode:0}
 *   constrained-inject        → {decision:"continue", raw:{action:"continue",content:truncate(systemMessage,20000)}, additionalContext:systemMessage, exitCode:0}
 *   deferred-block            → {decision:"continue", raw:{action:"continue"}, exitCode:0}
 *   observe-only / noop       → {decision:"continue", raw:{action:"continue"}, exitCode:0}
 *
 * The returned shape is compatible with DispatchResponse (from dispatch.ts).
 */

/**
 * Maximum size Hermes accepts in a constrained injection.
 *
 * SOT correction C1 (docs/research/runtime-capabilities.sot.json): the real
 * Hermes cap is `context_file_max_chars` = 20000 chars/file. The previous
 * value of 1800 was a myth — it was actually `HERMES_API_TIMEOUT`, a
 * 1800-SECOND timeout, not a byte/char cap. truncateUtf8 below operates on
 * UTF-8 bytes, which is a safe (slightly conservative) proxy for a chars cap.
 */
const HERMES_MAX_INJECT_BYTES = 20000;

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
