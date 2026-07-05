/**
 * delegation-lane.ts — the lane-marker mechanism for SPEC-018 Delegation-First.
 *
 * A "lane marker" is a small file that records: *this session is operating
 * inside a delegated lane* (a sub-agent / team member spawned to do work), as
 * opposed to the main orchestrator thread.
 *
 *   marker present → the write is coming from a delegated lane → allow
 *   marker absent  → the write is a solo main-thread write     → block at H+
 *
 * The live PreToolUse payload carries no field that distinguishes main-thread
 * from sub-agent context (confirmed by integration survey), so this marker IS
 * the signal. It is written by:
 *   (a) `hima delegate` — the explicit, runtime-agnostic seal a lane runs at
 *       its start (SPEC-018 D-004), and
 *   (b) auto, on sub-agent start, for the child session id.
 *
 * Marker path: <root>/.hima/state/lane-<sanitized-sessionId>.json
 * Synchronous fs so a behavior's evaluate() can stay synchronous.
 */

import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";

/**
 * Sanitize a session id into a single safe filename segment: any character
 * that is not [A-Za-z0-9._-] becomes "_". This prevents path traversal
 * ("a/b/../c" cannot escape .hima/state) and keeps the marker one flat file.
 */
function sanitize(sessionId: string): string {
  return sessionId.replace(/[^A-Za-z0-9._-]/g, "_");
}

/** Absolute path of the lane marker for a given session. */
export function laneMarkerPath(root: string, sessionId: string): string {
  return path.join(root, ".hima", "state", `lane-${sanitize(sessionId)}.json`);
}

/**
 * Mark the given session as an active delegated lane. Idempotent.
 * `meta.roles` records the roles the lane was spawned to fill (advisory).
 */
export function markLane(
  root: string,
  sessionId: string,
  meta: { roles?: string[]; ts?: string } = {},
): void {
  if (sessionId.trim() === "") return;
  const target = laneMarkerPath(root, sessionId);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(
    target,
    JSON.stringify(
      { sessionId, roles: meta.roles ?? [], ts: meta.ts ?? "" },
      null,
      2,
    ),
  );
}

/** True when the given session is a marked delegated lane. */
export function isLaneActive(root: string, sessionId: string): boolean {
  if (sessionId.trim() === "") return false;
  return existsSync(laneMarkerPath(root, sessionId));
}

/** Remove a session's lane marker. No-op when absent (never throws). */
export function clearLane(root: string, sessionId: string): void {
  if (sessionId.trim() === "") return;
  rmSync(laneMarkerPath(root, sessionId), { force: true });
}

// ---------------------------------------------------------------------------
// Stage-level delegation marker — the AUTO signal (no manual bookkeeping)
// ---------------------------------------------------------------------------
//
// A per-session lane marker requires the lane to know + seal its own session id.
// The stronger, runtime-agnostic AUTO signal is: *has the agent spawned at least
// one delegated sub-agent at this ward+stage?* When hima observes a real
// SubagentStart (which every runtime emits when the agent delegates), it stamps a
// stage-delegation marker. Delegation-First then treats the stage as satisfied —
// once you have delegated at a stage, implementation writes flow (parent
// integrating lane results included). This is the "detectable from existing
// signals, no new operator bookkeeping" mechanism SPEC-018 D-004 requires: the
// act of spawning a sub-agent IS the signal.

/**
 * Absolute path of the stage-delegation marker for a ward+stage.
 *
 * Filename shape `delegation-<wardId>-<stage>.json` is unambiguous in practice:
 * `stage` is always drawn from the closed DEV_CYCLE id enum (discovery/analysis/
 * spec/design/impl/test/verify/maintenance) — none contain "-" — so a `wardId`
 * containing "-" cannot alias a different ward+stage split.
 */
export function stageDelegationPath(root: string, wardId: string, stage: string): string {
  return path.join(
    root,
    ".hima",
    "state",
    `delegation-${sanitize(wardId)}-${sanitize(stage)}.json`,
  );
}

/** Stamp that ≥1 delegated sub-agent has started at this ward+stage. Idempotent. */
export function markStageDelegation(root: string, wardId: string, stage: string): void {
  if (wardId.trim() === "" || stage.trim() === "") return;
  const target = stageDelegationPath(root, wardId, stage);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify({ wardId, stage }, null, 2));
}

/** True when delegation has been observed at this ward+stage. */
export function isStageDelegationActive(root: string, wardId: string, stage: string): boolean {
  if (wardId.trim() === "" || stage.trim() === "") return false;
  return existsSync(stageDelegationPath(root, wardId, stage));
}

/** Remove a ward+stage delegation marker. No-op when absent (never throws). */
export function clearStageDelegation(root: string, wardId: string, stage: string): void {
  if (wardId.trim() === "" || stage.trim() === "") return;
  rmSync(stageDelegationPath(root, wardId, stage), { force: true });
}
