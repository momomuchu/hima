/**
 * BEH-000 — Behavior Dispatch Registry
 *
 * A minimal registry where each behavior exposes { id, gates, classify(ctx)->verdict }
 * and evaluate-gate.ts iterates registered behaviors at each gate.
 *
 * Design constraints:
 *   - Behaviors are registered once at module init (no dynamic mutation at runtime).
 *   - Each behavior declares which GateTypes it fires on; the evaluator only calls
 *     behaviors whose gate list includes the current event's gateType.
 *   - A behavior returns null to abstain (no violation); a non-null verdict is appended
 *     to GateResult violations. The evaluator returns the first block verdict it finds,
 *     or the first warn verdict if no block, following existing gate evaluation policy.
 *
 * Spec: docs/conception/12-behaviors-catalog-spec.md §3 (behavior entry schema)
 */

import type { GateEvent } from "../schemas/gate-event.schema.js";
import type { BehaviorOverride } from "../schemas/run-set.schema.js";
import type { GateType } from "../types/canonical.js";
import { type OverrideResolution, resolveOverride } from "./behavior-override.js";
import type { GateEvaluationContext, GateResult } from "./evaluate-gate.js";

// ── Behavior verdict ──────────────────────────────────────────────────────────

/**
 * The result a behavior's classify function returns.
 * null means the behavior abstains (no finding for this event).
 */
export type BehaviorVerdict = Pick<
  GateResult,
  "decision" | "reason" | "violationType" | "finalState" | "qualityDimension" | "abortReport"
> | null;

// ── Behavior descriptor ───────────────────────────────────────────────────────

export interface BehaviorDescriptor {
  /** Catalog identifier, e.g. "BEH-000". */
  readonly id: string;
  /** Human-readable name. */
  readonly name: string;
  /** Gate types this behavior fires on. The evaluator skips other gate types. */
  readonly gates: readonly GateType[];
  /**
   * Classification function. Receives the full evaluation context and the gate
   * event; returns a verdict or null to abstain.
   *
   * MUST NOT scan event.toolOutput or event.promptContent as raw output text for
   * keyword matches — all signal reading must come from tool_type, tool_args,
   * file_diff, evidence_state, or prompt_pattern per BEH-000 spec §3.
   */
  readonly classify: (context: GateEvaluationContext, event: GateEvent) => BehaviorVerdict;
}

// ── Registry ──────────────────────────────────────────────────────────────────

const _registry: BehaviorDescriptor[] = [];

/**
 * Registers a behavior. Called once per behavior module at import time.
 * Duplicate id registrations are silently ignored (idempotent).
 */
export function registerBehavior(descriptor: BehaviorDescriptor): void {
  if (_registry.some((b) => b.id === descriptor.id)) {
    return;
  }
  _registry.push(descriptor);
}

/**
 * Returns all registered behaviors whose gate list includes gateType.
 * Returns a snapshot — callers must not mutate the result.
 */
export function getBehaviorsForGate(gateType: GateType): readonly BehaviorDescriptor[] {
  return _registry.filter((b) => b.gates.includes(gateType));
}

/**
 * Returns all registered behaviors. Primarily for introspection/testing.
 */
export function getAllBehaviors(): readonly BehaviorDescriptor[] {
  return [..._registry];
}

/**
 * Evaluates all registered behaviors for the given gate event and returns the
 * first blocking verdict found, or the first warning verdict, or null if all
 * behaviors abstain.
 *
 * The evaluator in evaluate-gate.ts calls this after its own gate-specific
 * logic to layer behavior verdicts on top.
 */
export function evaluateBehaviors(
  context: GateEvaluationContext,
  event: GateEvent,
): BehaviorVerdict {
  const behaviors = getBehaviorsForGate(event.gateType);

  let firstWarn: BehaviorVerdict = null;

  for (const behavior of behaviors) {
    const verdict = behavior.classify(context, event);
    if (verdict === null) {
      continue;
    }
    if (verdict.decision === "block") {
      return verdict;
    }
    if (verdict.decision === "warn" && firstWarn === null) {
      firstWarn = verdict;
    }
  }

  return firstWarn;
}

// ── Override-aware evaluation ─────────────────────────────────────────────────

/**
 * Extended verdict that carries override metadata for the gate-decision record.
 */
export interface BehaviorVerdictWithMeta {
  behaviorId: string;
  verdict: BehaviorVerdict;
  overrideResolution: OverrideResolution;
}

/**
 * Evaluates all registered behaviors with override support.
 *
 * For each behavior:
 *   - Resolves the override from policy.behaviorOverrides
 *   - If disabled and override is permitted: skips enforcement, emits allow record
 *   - If warn-only: caps block verdict to warn
 *   - If override is forbidden (H/C floor): full enforcement, forbidden event emitted
 *
 * Returns an array of per-behavior results for audit/observability, plus the
 * net verdict (highest severity: block > warn > null).
 */
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
    const overrideResolution = resolveOverride(
      behavior.id,
      overrides,
      context.currentRisk.risk_class,
    );

    let effectiveVerdict: BehaviorVerdict;

    if (overrideResolution.skip && !overrideResolution.forbiddenReason) {
      // Behavior is disabled and the override is permitted.
      // Skip enforcement — emit an allow record with overrideMode=disabled.
      effectiveVerdict = null;
      perBehavior.push({ behaviorId: behavior.id, verdict: null, overrideResolution });
      continue;
    }

    // Classify normally.
    const rawVerdict = behavior.classify(context, event);

    if (rawVerdict === null) {
      perBehavior.push({ behaviorId: behavior.id, verdict: null, overrideResolution });
      continue;
    }

    // Apply capAtWarn: downgrade block to warn when override is warn-only and permitted.
    if (
      overrideResolution.capAtWarn &&
      !overrideResolution.forbiddenReason &&
      rawVerdict.decision === "block"
    ) {
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

  return {
    perBehavior,
    netVerdict: firstBlock ?? firstWarn,
  };
}
