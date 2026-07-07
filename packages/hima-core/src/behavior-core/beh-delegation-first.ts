/**
 * BEH_DELEGATION_FIRST — Delegation-First gate (SPEC-018, V-012a).
 *
 * ISO/SWEBOK-grade production separates duties: one actor never writes,
 * reviews, and signs off its own work. This behavior forces that at the
 * pre_tool gate — a solo main-thread implementation write at a work-bearing
 * stage on a High+ task is blocked; the agent must fan out to parallel
 * role-based lanes (≥1 implementer + ≥1 INDEPENDENT verifier) first.
 *
 * It is a FORCING-FUNCTION, not an authenticated control: like the planner
 * write-guard, a determined agent can waive it (HIMA_SOLO_OK) or self-seal
 * (`norm delegate`). Its value is interrupting the solo-write reflex and
 * recording an explicit, traced delegation claim.
 *
 * Decision tree (pure, in decideDelegationFirst):
 *   0. soloWaiver (HIMA_SOLO_OK)                → allow (escape hatch, D-009)
 *   1. non-write tool                          → allow
 *   2. stage not work-bearing                  → allow
 *   3. target is not an implementation file     → allow (.md / <root>/.hima / unknown)
 *   4. delegation active                        → allow (lane sealed OR sub-agent spawned at this stage)
 *   5. riskClass ∈ {H,C}                        → block DELEGATION_FIRST
 *   6. riskClass ∈ {M,L,T}                      → allow (inert; block threshold is High+)
 *
 * Work-bearing stages = design / impl / test / verify — the "build + review/qa"
 * of the cycle (SPEC-018 §1). Planner stages (discovery/analysis/spec) are
 * covered by BEH_PLANNER_WRITE_GUARD.
 *
 * "Delegation active" is resolved from two runtime signals (SPEC-018 D-004):
 *   - a per-session lane marker (explicit `norm delegate` seal, or auto on
 *     sub-agent start for the child session), and
 *   - a stage-delegation marker stamped when hima observes a real SubagentStart
 *     at this ward+stage — the auto, no-bookkeeping signal (spawning a sub-agent
 *     IS the signal). Once the agent has delegated at a stage, writes flow.
 *
 * violationType: DELEGATION_FIRST
 * gates:         ["pre_tool"]
 *
 * NOTE (M-criticality): SPEC-018 D-007 envisaged an advisory *warn* at M. The
 * pre_tool router surfaces only block verdicts today, so a warn would be silently
 * dropped; rather than emit an invisible verdict, M is INERT here and the advisory
 * is deferred until pre_tool warn-surfacing lands (tracked in SPEC-018 §5).
 *
 * See: docs/specs/SPEC-018-delegation-first-gate.md, SPEC-VISION V-002/V-012a.
 */

import path from "node:path";
import type { RiskClass } from "@norm/schemas";
import { RISK_ORDER } from "@norm/schemas";
import { isLaneActive, isStageDelegationActive } from "./delegation-lane.js";
import {
  canonicalWriteTool,
  extractWriteTargets,
  isUnknownWriteTarget,
  pickRepresentativeTarget,
} from "./tool-classify.js";
import type { BehaviorContext, BehaviorDescriptor, BehaviorVerdict } from "./types.js";

const BEHAVIOR_ID = "BEH-DELEGATION-FIRST";
const VIOLATION = "DELEGATION_FIRST";

/**
 * Work-bearing (build + review/qa) stages the gate covers. Not reused from
 * role-for-stage's EXECUTOR_STAGES: SPEC-018 §1 includes the review/qa stage
 * (DEV_CYCLE id "verify"), which the executor-role set excludes.
 */
const WORK_BEARING_STAGES = new Set(["design", "impl", "test", "verify"]);

/** True when absPath is inside absDir (equal, or under it with a separator). */
function isUnderDir(absPath: string, absDir: string): boolean {
  return absPath === absDir || absPath.startsWith(absDir + path.sep);
}

/**
 * True when the write target is an *implementation* file — i.e. not a doc
 * (.md) and not under the project's <root>/.hima/** state tree. The .hima
 * check is ANCHORED to root (path.resolve + isUnderDir), so a decoy segment
 * like "src/.hima/evil.ts" is correctly classified as an implementation write.
 * Undefined path → not an implementation write (allow defensively — no
 * extraction was even attempted, e.g. a direct pure-function call).
 * UNKNOWN_WRITE_TARGET (a write tool fired but its path could not be parsed,
 * e.g. an unparseable Codex apply_patch body) → ALWAYS an implementation
 * target: fail closed, never silently allow an ambiguous write.
 */
function isImplementationTarget(rawPath: string | undefined, root?: string): boolean {
  if (rawPath === undefined) return false;
  if (isUnknownWriteTarget(rawPath)) return true;
  const absPath = root && !path.isAbsolute(rawPath) ? path.resolve(root, rawPath) : rawPath;
  if (path.extname(absPath) === ".md") return false;
  const himaDir = root ? path.resolve(root, ".hima") : ".hima";
  if (isUnderDir(absPath, himaDir)) return false;
  return true;
}

export type DelegationFirstInput = {
  stage: string;
  riskClass: RiskClass;
  toolName: string;
  targetPath?: string;
  root?: string;
  delegationActive: boolean;
  soloWaiver?: boolean;
};

export type DelegationFirstDecision = {
  decision: "allow" | "warn" | "block";
  reason: string;
  violationType?: string;
};

const allow = (reason: string): DelegationFirstDecision => ({ decision: "allow", reason });

/**
 * Pure Delegation-First decision — no filesystem, no environment. Every input
 * that matters is an explicit argument, so the full truth table is unit-testable.
 */
export function decideDelegationFirst(input: DelegationFirstInput): DelegationFirstDecision {
  const { stage, riskClass, toolName, targetPath, root, delegationActive, soloWaiver } = input;

  // 0. Escape hatch (D-009) — explicit operator waiver.
  if (soloWaiver) {
    return allow("HIMA_SOLO_OK set — Delegation-First waived for this session");
  }
  // 1. Non-write tool.
  if (!canonicalWriteTool(toolName)) {
    return allow("non-write tool — Delegation-First not applicable");
  }
  // 2. Not a work-bearing stage.
  if (!WORK_BEARING_STAGES.has(stage)) {
    return allow(`stage "${stage}" is not a work-bearing stage — Delegation-First not applicable`);
  }
  // 3. Not an implementation file (doc / plan / spec / .hima).
  if (!isImplementationTarget(targetPath, root)) {
    return allow("target is not an implementation file — Delegation-First not applicable");
  }
  // 4. Delegation active — a lane is sealed, or a sub-agent was spawned at this stage.
  if (delegationActive) {
    return allow("delegation active — implementation write permitted");
  }
  // 5–6. Criticality gate: block at High+, inert below.
  if (RISK_ORDER[riskClass] >= RISK_ORDER["H"]) {
    return {
      decision: "block",
      violationType: VIOLATION,
      reason:
        `[${BEHAVIOR_ID}] BLOCKED — solo implementation at the "${stage}" stage on a ` +
        `${riskClass}-criticality task is a norm violation. ISO/SWEBOK-grade production ` +
        `separates duties: this stage SHALL be executed by parallel role-based lanes — at ` +
        `least 1 implementer + 1 INDEPENDENT verifier (author is not reviewer). To unblock: ` +
        `spawn a delegated sub-agent / team lane for this stage (hima auto-detects it), or run ` +
        `\`norm delegate\` inside the lane. Escape hatch: set HIMA_SOLO_OK=1 to waive.`,
    };
  }
  return allow(`criticality "${riskClass}" is below High — Delegation-First inert`);
}

export const BEH_DELEGATION_FIRST: BehaviorDescriptor = {
  id: BEHAVIOR_ID,
  gates: ["pre_tool"],

  // Synchronous: reads marker files via existsSync, everything else in-memory.
  evaluate(ctx: BehaviorContext): BehaviorVerdict {
    const { event, root, ward, riskClass, sessionId } = ctx;

    // No ward → no stage context → not applicable.
    if (ward === undefined || ward === null) {
      return {
        decision: "allow",
        reason: "no ward in context — Delegation-First not applicable",
        behaviorId: BEHAVIOR_ID,
      };
    }

    const soloWaiver = process.env.HIMA_SOLO_OK === "1";
    // Delegation active if THIS session sealed a lane, OR a sub-agent has started
    // at this ward+stage (the auto, no-bookkeeping signal).
    const laneActive = typeof sessionId === "string" && isLaneActive(root, sessionId);
    const stageActive = isStageDelegationActive(root, ward.id, ward.openStage);
    const delegationActive = laneActive || stageActive;

    const toolName = event.toolName ?? "";
    // extractWriteTargets recognizes Codex's real apply_patch write tool (no
    // file_path/path field — the path is parsed out of the patch command
    // text) alongside Claude Write/Edit/MultiEdit. A multi-file apply_patch
    // is reduced to one representative path: the first implementation-file
    // target when any exists, else the first target (e.g. an all-.md patch).
    const targets = canonicalWriteTool(toolName)
      ? extractWriteTargets(toolName, event.toolInput)
      : [];
    const targetPath = pickRepresentativeTarget(targets, (t) => isImplementationTarget(t, root));

    const d = decideDelegationFirst({
      stage: ward.openStage,
      riskClass,
      toolName,
      targetPath,
      root,
      delegationActive,
      soloWaiver,
    });

    return {
      decision: d.decision,
      reason: d.reason,
      behaviorId: BEHAVIOR_ID,
      ...(d.violationType && d.decision !== "allow" ? { violationType: d.violationType } : {}),
    };
  },
};
