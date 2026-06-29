/**
 * behavior-core/types.ts — typed contracts for the BehaviorDescriptor engine.
 *
 * A BehaviorDescriptor is the unit of policy in the hima gate system. Each
 * descriptor declares which gate types it covers and supplies a pure evaluate()
 * function that receives a BehaviorContext and returns a BehaviorVerdict.
 *
 * See: .planning/architecture/ARCHITECTURE-v3.md §3.4,
 *      .planning/architecture/V3-COMPLETENESS-AUDIT.md R-001
 */

import type { GateEvent, GateType, RiskClass, Ward } from "@hima/schemas";

// ---------------------------------------------------------------------------
// BehaviorVerdict — the per-behavior decision emitted by evaluate()
// ---------------------------------------------------------------------------

/**
 * The outcome of a single BehaviorDescriptor evaluation. The aggregator in
 * evaluateGate() combines all verdicts from active behaviors into a final
 * GateVerdict.
 *
 * Fields:
 *   decision      — "allow" (proceed), "warn" (proceed with advisory), or
 *                   "block" (halt; the gate must not continue).
 *   reason        — human-readable explanation surfaced to the agent/adapter.
 *   behaviorId    — the id of the BehaviorDescriptor that produced this verdict.
 *   violationType — optional machine-readable violation code (e.g.
 *                   "DONE_WITHOUT_EVIDENCE") used by downstream tooling.
 */
export type BehaviorVerdict = {
  decision: "allow" | "warn" | "block";
  reason: string;
  behaviorId: string;
  violationType?: string;
};

// ---------------------------------------------------------------------------
// BehaviorContext — inbound context passed to every evaluate() call
// ---------------------------------------------------------------------------

/**
 * The evaluation context supplied by the gate router to each BehaviorDescriptor.
 *
 * Fields:
 *   event        — the full GateEvent arriving at this gate position.
 *   riskClass    — the effective risk class for this run (resolved from the ward
 *                  floor or the router's classify step).
 *   root         — absolute path to the project root (used by behaviors that
 *                  need filesystem access via @hima/storage-core).
 *   ward         — the live execution context, if a ward exists for this session.
 *                  Null/undefined when no ward has been created yet (e.g. early
 *                  session_start events before sigil detection).
 *   agentOutput  — the raw text the agent emitted (relevant for stop-gate
 *                  behaviors that scan completion lexemes).
 */
export type BehaviorContext = {
  event: GateEvent;
  riskClass: RiskClass;
  root: string;
  ward?: Ward | null;
  agentOutput?: string;
};

// ---------------------------------------------------------------------------
// BehaviorDescriptor — the policy unit registered with the engine
// ---------------------------------------------------------------------------

/**
 * A BehaviorDescriptor encapsulates a single policy check. The evaluate()
 * function may be async (e.g. for behaviors that read filesystem state) but
 * must NEVER throw: the evaluateGate() aggregator wraps each call in
 * try/catch and treats an unexpected throw as an "allow" with a logged note.
 *
 * Fields:
 *   id     — stable, unique identifier used in audit logs and wave entries.
 *   gates  — the set of GateType positions at which this behavior is active.
 *            evaluateGate() skips the descriptor when the incoming event's
 *            gateType is not in this list.
 *   evaluate — pure (or async) evaluation function returning a BehaviorVerdict.
 */
export type BehaviorDescriptor = {
  id: string;
  gates: GateType[];
  evaluate: (ctx: BehaviorContext) => BehaviorVerdict | Promise<BehaviorVerdict>;
};
