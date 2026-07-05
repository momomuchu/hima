/**
 * dispatch.ts — runtime-aware ForceAction → adapter response dispatcher.
 *
 * dispatchTranslate() routes a ForceAction to the correct runtime adapter.
 * R-010 (codex), R-011 (hermes), R-050 (opencode): real adapter calls replace
 * the I8 fallback stubs.
 *
 * See: .planning/architecture/V3-COMPLETENESS-AUDIT.md R-012,
 *      ARCHITECTURE-v3.md §3.5 adapter-contract.
 */

import type { ForceAction } from "@norm/schemas";
import type { RuntimeTarget } from "./capability-map-v3.js";
import { translateClaude } from "./adapter-claude.js";
import type { ClaudeResponse } from "./adapter-claude.js";
import { translateCodex } from "./adapter-codex.js";
import { translateHermes } from "./adapter-hermes.js";
import { translateOpenCode } from "./adapter-opencode.js";

// ---------------------------------------------------------------------------
// DispatchResponse — canonical response type returned by dispatchTranslate.
//
// Superset of all adapter response shapes; runtime-specific fields are optional.
// Shape: { decision, reason?, additionalContext?, systemMessage?, exitCode, raw? }
// ---------------------------------------------------------------------------

export type DispatchResponse = ClaudeResponse & {
  /** Codex-specific: injected on stdout as the systemMessage field (≤1800 bytes). */
  systemMessage?: string;
  /** Runtime-native raw payload (e.g. Hermes ACP object). */
  raw?: unknown;
};

// ---------------------------------------------------------------------------
// dispatchTranslate — routes ForceAction to the correct adapter
// ---------------------------------------------------------------------------

/**
 * Translate a ForceAction to the native hook-response payload for the given
 * runtime target.
 *
 * @param runtime - The active runtime ("claude" | "codex" | "hermes" | "opencode").
 * @param action  - The ForceAction produced by pickAttack().
 * @returns       - A DispatchResponse compatible with all runtime adapter shapes.
 */
export function dispatchTranslate(
  runtime: RuntimeTarget,
  action: ForceAction,
): DispatchResponse {
  switch (runtime) {
    case "claude":
      return translateClaude(action);

    case "codex":
      // R-010: real Codex adapter — constrained injection, 1800-byte cap,
      // systemMessage channel, hard-block at pre_tool+stop only.
      return translateCodex(action);

    case "hermes":
      // R-011: real Hermes adapter — ACP format, deferred stop enforcement,
      // raw ACP object carried in response.raw.
      return translateHermes(action);

    case "opencode":
      // R-050: OpenCode adapter — rich-capable, semantics pending web verification.
      return translateOpenCode(action);
  }
}
