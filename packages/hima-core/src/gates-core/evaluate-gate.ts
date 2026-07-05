/**
 * gates-core/evaluate-gate.ts — BehaviorDescriptor aggregator.
 *
 * evaluateGate() is the central policy combiner for the PFV4 runtime kernel.
 * It runs every BehaviorDescriptor whose `gates` array includes the current
 * event's gateType, then reduces the individual BehaviorVerdicts into a single
 * GateVerdict compatible with @norm/schemas.
 *
 * Aggregation rules:
 *   1. block  — first blocking verdict wins; remaining behaviors are still run
 *               (fail-fast short-circuit is intentional but the reason of the
 *               first block is what surfaces). A DeferredBlock forceIntent is
 *               attached when the block originates from a behavior whose
 *               violationType is "DONE_WITHOUT_EVIDENCE" (stop-gate pattern);
 *               otherwise forceIntent is left undefined (pickAttack chooses the
 *               mechanism from the capability cell).
 *   2. warn   — any warn (with no block) → verdict is warn.
 *   3. allow  — all allow → verdict is allow.
 *
 * Error safety: each behavior's evaluate() is wrapped in try/catch. An
 * unexpected throw is treated as allow + a warning note logged to stderr so
 * the gate is never silently broken by a misbehaving descriptor.
 *
 * See: .planning/architecture/V3-COMPLETENESS-AUDIT.md R-001,
 *      ARCHITECTURE-v3.md §3.4.
 */

import type { GateVerdict } from "@norm/schemas";
import type { BehaviorContext, BehaviorDescriptor, BehaviorVerdict } from "../behavior-core/types.js";

// ---------------------------------------------------------------------------
// evaluateGate
// ---------------------------------------------------------------------------

/**
 * Run all applicable behaviors and return a GateVerdict.
 *
 * @param behaviors - The set of BehaviorDescriptors to evaluate. Typically
 *   sourced from `Registry.getBehaviorsForGate(event.gateType)`. Passing an
 *   empty array always yields { decision: "allow", reason: "no behaviors" }.
 * @param ctx - The shared BehaviorContext for this gate invocation.
 */
export async function evaluateGate(
  behaviors: BehaviorDescriptor[],
  ctx: BehaviorContext,
): Promise<GateVerdict> {
  const { event } = ctx;

  // Fast-path: no behaviors registered for this gate.
  if (behaviors.length === 0) {
    return { decision: "allow", reason: "no behaviors registered for this gate" };
  }

  // Filter to descriptors that cover this gate type.
  const applicable = behaviors.filter((b) => b.gates.includes(event.gateType));

  if (applicable.length === 0) {
    return { decision: "allow", reason: "no behaviors applicable for gate type: " + event.gateType };
  }

  // Collect verdicts, wrapping each call in try/catch for safety.
  const verdicts: BehaviorVerdict[] = [];

  for (const descriptor of applicable) {
    let verdict: BehaviorVerdict;
    try {
      verdict = await descriptor.evaluate(ctx);
    } catch (err: unknown) {
      // Misbehaving descriptor: treat as allow, log the error.
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        `[hima][evaluate-gate] behavior ${descriptor.id} threw unexpectedly: ${message}. Treating as allow.\n`,
      );
      verdict = {
        decision: "allow",
        reason: `behavior ${descriptor.id} threw: ${message}`,
        behaviorId: descriptor.id,
      };
    }
    verdicts.push(verdict);
  }

  // ---------------------------------------------------------------------------
  // Aggregation
  // ---------------------------------------------------------------------------

  // First blocking verdict wins.
  const firstBlock = verdicts.find((v) => v.decision === "block");
  if (firstBlock) {
    return buildBlockVerdict(firstBlock);
  }

  // Any warn (with no block) → warn.
  const firstWarn = verdicts.find((v) => v.decision === "warn");
  if (firstWarn) {
    return {
      decision: "warn",
      reason: firstWarn.reason,
    };
  }

  // All allow.
  return {
    decision: "allow",
    reason: verdicts.map((v) => v.reason).join("; ") || "all behaviors passed",
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build a GateVerdict from a blocking BehaviorVerdict.
 *
 * When the violation is "DONE_WITHOUT_EVIDENCE" (the stop-gate fake-done
 * pattern), attach a DeferredBlock forceIntent so downstream adapters that
 * cannot synchronously block (e.g. Hermes) still persist the verdict to disk.
 * For all other block violations the forceIntent is left undefined and
 * pickAttack() derives the strongest available action from the capability cell.
 */
function buildBlockVerdict(verdict: BehaviorVerdict): GateVerdict {
  const base: GateVerdict = {
    decision: "block",
    reason: verdict.reason,
  };

  if (verdict.violationType === "DONE_WITHOUT_EVIDENCE") {
    return {
      ...base,
      forceIntent: {
        kind: "DeferredBlock",
        reason: verdict.reason,
        resolveOn: ["pre_tool", "user_prompt"],
      },
    };
  }

  return base;
}
