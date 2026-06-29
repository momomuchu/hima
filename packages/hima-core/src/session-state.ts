import { resumeWard } from "./ward-store.js";
import { readRegister } from "./skill-state.js";

/**
 * session-state — advisory context builders for session-start and pre-compact events.
 *
 * Both functions are non-blocking: they return a string to inject as additionalContext
 * (or null when no ward exists). They never throw — callers should guard accordingly.
 *
 * Addresses gaps:
 *   R-030 — session-start handler + ward restore (buildSessionResumeContext)
 *   R-036 — pre_compact ward-state injection (buildPreCompactContext)
 *
 * See: BEHAVIOR-CATALOG-v3.md §1 S-04, S-07, S-08; ARCHITECTURE-v3.md §7.2.
 */

/**
 * buildSessionResumeContext — produce a re-entry canary string when a ward exists.
 *
 * Calls resumeWard(root). When a ward is found, returns the canonical "[HIMA] resuming
 * ward:..." string for injection into the session-start additionalContext so the agent
 * knows it is resuming a prior run and which stage was last sealed.
 *
 * @param root  Project root (the directory containing .hima/state/ward.json).
 * @returns     Advisory context string, or null when no ward file exists.
 */
export async function buildSessionResumeContext(root: string): Promise<string | null> {
  const ward = await resumeWard(root);
  if (!ward) return null;

  const lastVerdict = ward.verdicts.at(-1);
  const lastVerdictStage = lastVerdict?.stage ?? "none";

  return (
    `[HIMA] resuming ward:${ward.id}` +
    ` stage:${ward.openStage}` +
    ` floor:${ward.floor}` +
    ` (last-sealed: ${lastVerdictStage})`
  );
}

/**
 * buildPreCompactContext — emit a governance-state preservation block for compaction.
 *
 * On Claude, the pre_compact hook fires before context is summarised. This function
 * produces a compact block that carries the critical ward state and skill register so
 * the agent retains governance context across compaction (preventing context drift).
 *
 * @param root  Project root.
 * @returns     Advisory context string, or null when no ward file exists.
 */
export async function buildPreCompactContext(root: string): Promise<string | null> {
  const ward = await resumeWard(root);
  if (!ward) return null;

  const register = await readRegister(root);
  const ids = register.map((r) => `${r.source}:${r.id}`).join(",");

  return (
    `[HIMA pre-compact] preserve:` +
    ` ward ${ward.id}` +
    ` stage ${ward.openStage}` +
    ` floor ${ward.floor}` +
    ` skillRegister:[${ids}]`
  );
}
