/**
 * dispatch.ts — runtime-aware ForceAction → adapter response dispatcher.
 *
 * dispatchTranslate() routes a ForceAction to the correct runtime adapter.
 * Currently only adapter-claude is implemented; adapter-codex and adapter-hermes
 * land in I10 (R-010, R-011). Until then, codex and hermes fall back to the
 * Claude response shape (safe: both runtimes accept JSON on stdout).
 *
 * See: .planning/architecture/V3-COMPLETENESS-AUDIT.md R-012,
 *      ARCHITECTURE-v3.md §3.5 adapter-contract.
 */

import type { ForceAction } from "@hima/schemas";
import type { RuntimeTarget } from "./capability-map-v3.js";
import { translateClaude } from "./adapter-claude.js";
import type { ClaudeResponse } from "./adapter-claude.js";

// ---------------------------------------------------------------------------
// DispatchResponse — canonical response type returned by dispatchTranslate.
// Until codex/hermes adapters exist, the shape is identical to ClaudeResponse.
// ---------------------------------------------------------------------------

export type DispatchResponse = ClaudeResponse;

// ---------------------------------------------------------------------------
// dispatchTranslate — routes ForceAction to the correct adapter
// ---------------------------------------------------------------------------

/**
 * Translate a ForceAction to the native hook-response payload for the given
 * runtime target.
 *
 * @param runtime - The active runtime ("claude" | "codex" | "hermes").
 * @param action  - The ForceAction produced by pickAttack().
 * @returns       - A response object with decision + optional context.
 *
 * TODO(I10-R-010): replace codex fallback with translateCodex()
 * TODO(I10-R-011): replace hermes fallback with translateHermes()
 */
export function dispatchTranslate(
  runtime: RuntimeTarget,
  action: ForceAction,
): DispatchResponse {
  switch (runtime) {
    case "claude":
      return translateClaude(action);

    case "codex":
      // TODO(I10-R-010): translateCodex — falls back to claude format for now.
      // Codex uses systemMessage injection (constrained, 1800 bytes max) but
      // the response shape is compatible enough for the I8 gate backbone.
      return translateClaude(action);

    case "hermes":
      // TODO(I10-R-011): translateHermes — falls back to claude format for now.
      // Hermes stop is deferred; deferred-block actions return {continue} which
      // is safe here. The writeDeferredVerdict side-effect lands in I10/R-027.
      return translateClaude(action);
  }
}
