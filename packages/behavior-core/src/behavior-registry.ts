// Ported from packages/core/src/gates/behavior-registry.ts — no logic changes
// Dependencies updated to local behavior-core imports

import type { GateEvent } from "./gate-event.js";
import type { BehaviorOverride, CurrentRiskFile, RunSetFile } from "./run-set-types.js";
import type { GateDecision, FinalState, QualityDimension } from "./types.js";
import type { GateType } from "./types.js";
import { type OverrideResolution, resolveOverride } from "./behavior-override.js";

// ── Violation types ───────────────────────────────────────────────────────────

export type GateViolationType =
  | "SECRET_IN_PLAINTEXT"
  | "FORBIDDEN_WRITE_ZONE"
  | "BYPASS_ATTEMPTED"
  | "MIGRATION_WITHOUT_ADR"
  | "MISSING_FALSIFIES_IF"
  | "DONE_WITHOUT_EVIDENCE"
  | "AI_SLOP_CLEANUP_EVIDENCE_MISSING"
  | "MISSING_HUMAN_VALIDATION"
  | "SUBAGENT_WITHOUT_TRACE"
  | "SUBAGENT_DELIVERABLES_MISSING"
  | "SUBAGENT_SPAWN_LIMIT"
  | "SUBAGENT_TOOL_DENIED"
  | "COMPACTION_CONTINUITY_MISMATCH"
  | "BLOCKED_COMMAND_PATTERN"
  | "CLASS_UNDERESTIMATED"
  | "PROMPT_INJECTION_DETECTED"
  | "RUNTIME_BINDING_UNAVAILABLE"
  | "UNRESOLVED_POLICY_VIOLATION"
  | "INVALID_PHASE_TRANSITION"
  | "PRE_BUILD_DISCIPLINE"
  | "SUBAGENT_CONTRACT_INCOMPLETE"
  | "WATCHER_NOT_REGISTERED"
  | "CYCLE_ABORT"
  | "OVERRIDE_FORBIDDEN_FOR_RISK_CLASS"
  | "OVERRIDE_FORBIDDEN_FLOOR_REDUCTION";

// ── Gate result ────────────────────────────────────────────────────────────────

export interface GateResult {
  decision: GateDecision;
  gateType?: GateType;
  reason: string;
  contextInjection?: string;
  violationType?: GateViolationType;
  qualityDimension?: QualityDimension;
  finalState?: FinalState;
  missingEvidenceItems?: string[];
  abortReport?: unknown;
}

// ── Evaluation context ─────────────────────────────────────────────────────────

export interface GateEvaluationContext {
  projectRoot: string;
  currentRisk: CurrentRiskFile;
  runSet: RunSetFile;
  sessionReadSet?: ReadonlySet<string>;
  sessionReadHashMap?: ReadonlyMap<string, string>;
}

// ── Behavior verdict ──────────────────────────────────────────────────────────

export type BehaviorVerdict = Pick<
  GateResult,
  "decision" | "reason" | "violationType" | "finalState" | "qualityDimension" | "abortReport"
> | null;

// ── Behavior descriptor ───────────────────────────────────────────────────────

export interface BehaviorDescriptor {
  readonly id: string;
  readonly name: string;
  readonly gates: readonly GateType[];
  readonly classify: (context: GateEvaluationContext, event: GateEvent) => BehaviorVerdict;
}

// ── Registry ──────────────────────────────────────────────────────────────────

const _registry: BehaviorDescriptor[] = [];

export function registerBehavior(descriptor: BehaviorDescriptor): void {
  if (_registry.some((b) => b.id === descriptor.id)) return;
  _registry.push(descriptor);
}

export function getBehaviorsForGate(gateType: GateType): readonly BehaviorDescriptor[] {
  return _registry.filter((b) => b.gates.includes(gateType));
}

export function getAllBehaviors(): readonly BehaviorDescriptor[] {
  return [..._registry];
}

export function evaluateBehaviors(
  context: GateEvaluationContext,
  event: GateEvent,
): BehaviorVerdict {
  const behaviors = getBehaviorsForGate(event.gateType);
  let firstWarn: BehaviorVerdict = null;

  for (const behavior of behaviors) {
    const verdict = behavior.classify(context, event);
    if (verdict === null) continue;
    if (verdict.decision === "block") return verdict;
    if (verdict.decision === "warn" && firstWarn === null) firstWarn = verdict;
  }

  return firstWarn;
}

// ── Override-aware evaluation ─────────────────────────────────────────────────

export interface BehaviorVerdictWithMeta {
  behaviorId: string;
  verdict: BehaviorVerdict;
  overrideResolution: OverrideResolution;
}

export function evaluateBehaviorsWithOverrides(
  context: GateEvaluationContext,
  event: GateEvent,
): {
  perBehavior: BehaviorVerdictWithMeta[];
  netVerdict: BehaviorVerdict;
} {
  const behaviors = getBehaviorsForGate(event.gateType);
  const overrides: readonly BehaviorOverride[] = context.runSet.policy.behaviorOverrides ?? [];

  const perBehavior: BehaviorVerdictWithMeta[] = [];
  let firstBlock: BehaviorVerdict = null;
  let firstWarn: BehaviorVerdict = null;

  for (const behavior of behaviors) {
    const overrideResolution = resolveOverride(behavior.id, overrides, context.currentRisk.risk_class);

    if (overrideResolution.skip && !overrideResolution.forbiddenReason) {
      perBehavior.push({ behaviorId: behavior.id, verdict: null, overrideResolution });
      continue;
    }

    const rawVerdict = behavior.classify(context, event);

    if (rawVerdict === null) {
      perBehavior.push({ behaviorId: behavior.id, verdict: null, overrideResolution });
      continue;
    }

    let effectiveVerdict: BehaviorVerdict;
    if (overrideResolution.capAtWarn && !overrideResolution.forbiddenReason && rawVerdict.decision === "block") {
      effectiveVerdict = { ...rawVerdict, decision: "warn" };
    } else {
      effectiveVerdict = rawVerdict;
    }

    perBehavior.push({ behaviorId: behavior.id, verdict: effectiveVerdict, overrideResolution });

    if (effectiveVerdict.decision === "block" && firstBlock === null) {
      firstBlock = effectiveVerdict;
    } else if (effectiveVerdict.decision === "warn" && firstWarn === null) {
      firstWarn = effectiveVerdict;
    }
  }

  return { perBehavior, netVerdict: firstBlock ?? firstWarn };
}
