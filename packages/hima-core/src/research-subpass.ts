/**
 * research-subpass.ts — compressed research sub-pass injection for "run" entry (R-041).
 *
 * When a ward is opened with entryPoint="run", the ENTRYPOINTS-v3 spec mandates a
 * compressed research sub-pass that injects corpus-technical-analysis-discovery.
 * The injection is advisory at floor M (inject, not block) and forced (added to the
 * skill register requirement) at floor H+.
 *
 * This module provides the pure context string for the canary/advisory injection so
 * that the router and tests can share a single, testable source of truth. No side
 * effects — the caller is responsible for emitting the string as an additionalContext
 * or trace event.
 *
 * Usage (in handleUserPromptSubmit, after ward create/resume at entryPoint="run"):
 *   const ctx = runResearchSubpassContext(ward.entryPoint, ward.floor);
 *   if (ctx !== null) emit(ctx);
 *
 * See: .planning/architecture/V3-COMPLETENESS-AUDIT.md R-041,
 *      ENTRYPOINTS-v3.md §ENTRY 2: 'corpus-technical-analysis-discovery injected'.
 */

import type { RiskClass } from "@hima/schemas";

/**
 * Return the research sub-pass canary/context string when the ward's entry point
 * is "run", null for all other entry points.
 *
 * The returned string is intended for injection as an additionalContext advisory or
 * as a trace canary. At floor M the injection is advisory; at floor H+ it is forced
 * (the distinction is carried in the message and must be enforced by the caller).
 *
 * @param entryPoint  The ward entry point: "run" | "full" | "spec".
 * @param floor       The effective risk floor of the ward (used for documentation;
 *                    the caller may additionally gate on this value to enforce the
 *                    forced vs advisory distinction at H+).
 * @returns           The injection string for "run" entries, null otherwise.
 */
export function runResearchSubpassContext(
  entryPoint: string,
  // floor is part of the public contract so callers can branch on it;
  // the returned string describes both cases for use as a static canary.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  floor: RiskClass,
): string | null {
  if (entryPoint === "run") {
    return "[HIMA] run research sub-pass: corpus-technical-analysis-discovery (advisory at M, forced at H+)";
  }
  return null;
}
