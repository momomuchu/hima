// gate: stop — fixed implementation for requiresEvidenceBeforeStop bug.
//
// Bug (diagnosed in PROPOSITION.md §8 / amendement §12):
//   baseline-policy.ts declares requiresEvidenceBeforeStop: false for T and L,
//   but the original evaluateStop() in @harness/core never reads that field —
//   it calls hasSufficientEvidence() unconditionally for all non-full-bypass
//   modes, causing riskClass=T runs with no written code to be blocked with
//   DONE_WITHOUT_EVIDENCE. This file fixes that by gating the evidence-
//   sufficiency check behind RISK_POLICY[riskClass].requiresEvidenceBeforeStop.

import { isEvidenceSufficient } from "@harness/core";
import { assessRuntimeBinding } from "@harness/core";
import { RISK_POLICY } from "@harness/core";
import { riskAtLeast } from "@harness/core";
import type { GateEvaluationContext, GateResult } from "@harness/core";
import type { GateEvent } from "@harness/core";
import type { RunSetFile } from "@harness/core";

export function evaluateStop(
  context: GateEvaluationContext,
  event: GateEvent,
): GateResult {
  // HARD-always: policy-event blockers fire in ALL modes including M0.
  const policyEventBlockers = getPolicyEventBlockers(context.runSet);
  if (policyEventBlockers.length > 0) {
    return {
      decision: "block",
      gateType: event.gateType,
      reason: `stop blocked by unresolved policy violations: ${policyEventBlockers.join("; ")}`,
      violationType: "UNRESOLVED_POLICY_VIOLATION",
      finalState: "BLOCKED_POLICY",
    };
  }

  // M2: checkpoint injection before architecture/build boundary.
  const mode = context.state.mode;
  if (mode === "checkpoint") {
    const PRE_ARCH_PHASES = new Set(["discovery", "cadrage"]);
    const hasHookDecision = context.runSet.evidence.some(
      (item) =>
        item.status === "accepted" &&
        (item.key === "hook_decision" || item.id === "hook_decision"),
    );
    if (PRE_ARCH_PHASES.has(context.state.phase) && !hasHookDecision) {
      return {
        decision: "block",
        gateType: event.gateType,
        reason:
          "M2 checkpoint-gated: human decision required before architecture/build phase; inject hook_decision evidence to resume",
        violationType: "MISSING_HUMAN_VALIDATION",
        finalState: "BLOCKED_NEEDS_USER",
        missingEvidenceItems: ["hook_decision"],
        contextInjection: buildMinimalContextInjection(context),
      };
    }
  }

  // M0: skip evidence-sufficiency and requiresHumanCheckpoint checks.
  const isFullBypass = mode === "bypass" || mode === "full-bypass";
  if (isFullBypass) {
    const runtimeBinding = enforceBlockingRuntimeBinding(context, "stop");
    if (runtimeBinding) return runtimeBinding;
    return {
      decision: "allow",
      gateType: event.gateType,
      reason:
        "stop allowed (M0 full-bypass: evidence-sufficiency check skipped; policy blockers clear)",
      finalState: "DONE_VERIFIED",
    };
  }

  // BUG FIX: only enforce evidence sufficiency when the policy requires it.
  // For riskClass T and L, requiresEvidenceBeforeStop is false — skip the check.
  const policy = RISK_POLICY[context.currentRisk.risk_class];

  if (policy.requiresEvidenceBeforeStop) {
    const sufficiency = isEvidenceSufficient(
      context.runSet.evidence,
      context.currentRisk.risk_class,
    );

    if (
      policy.requiresHumanCheckpoint &&
      sufficiency.missingEvidenceKeys.length === 1 &&
      sufficiency.missingEvidenceKeys.includes("human_validation")
    ) {
      return {
        decision: "block",
        gateType: event.gateType,
        reason: `stop requires human validation evidence for risk class ${context.currentRisk.risk_class}`,
        violationType: "MISSING_HUMAN_VALIDATION",
        finalState: "BLOCKED_POLICY",
        missingEvidenceItems: ["human_validation"],
      };
    }

    if (!sufficiency.sufficient) {
      return {
        decision: riskAtLeast(context.currentRisk.risk_class, "M") ? "block" : "warn",
        gateType: event.gateType,
        reason: `stop cannot reach DONE_VERIFIED for risk class ${context.currentRisk.risk_class}; missing evidence: ${[...sufficiency.missingEvidenceKeys].join(", ")}`,
        violationType: "DONE_WITHOUT_EVIDENCE",
        finalState: riskAtLeast(context.currentRisk.risk_class, "M")
          ? "BLOCKED_POLICY"
          : "DONE_WITH_GAPS",
        missingEvidenceItems: [...sufficiency.missingEvidenceKeys],
      };
    }

    if (
      policy.requiresHumanCheckpoint &&
      !context.runSet.evidence.some(
        (item) =>
          item.status === "accepted" &&
          (item.key === "human_validation" ||
            item.id === "human_validation" ||
            item.key === "explicit_human_signature" ||
            item.id === "explicit_human_signature"),
      )
    ) {
      return {
        decision: "block",
        gateType: event.gateType,
        reason: `stop requires human validation evidence for risk class ${context.currentRisk.risk_class}`,
        violationType: "MISSING_HUMAN_VALIDATION",
        finalState: "BLOCKED_POLICY",
        missingEvidenceItems: ["human_validation"],
      };
    }
  }

  const runtimeBinding = enforceBlockingRuntimeBinding(context, "stop");
  if (runtimeBinding) return runtimeBinding;

  return {
    decision: "allow",
    gateType: event.gateType,
    reason: policy.requiresEvidenceBeforeStop
      ? `stop allowed: evidence set is sufficient for risk class ${context.currentRisk.risk_class}`
      : `stop allowed: riskClass ${context.currentRisk.risk_class} does not require evidence before stop`,
    finalState: "DONE_VERIFIED",
  };
}

// Inlined from @harness/core/gates/policy-event-blockers (not re-exported from root index).
function getPolicyEventBlockers(runSet: RunSetFile): string[] {
  const currentCycleStartedAt = getLatestDevelopmentEntryTimestamp(runSet);

  return runSet.events.flatMap((event) => {
    if (
      event.type !== "GATE_EVALUATED" ||
      event.gateType !== "post_tool" ||
      event.payload?.finalState !== "BLOCKED_POLICY" ||
      (currentCycleStartedAt !== undefined && event.ts < currentCycleStartedAt)
    ) {
      return [];
    }

    const policyEvent =
      event.payload.policyEvent &&
      typeof event.payload.policyEvent === "object" &&
      !Array.isArray(event.payload.policyEvent)
        ? (event.payload.policyEvent as Record<string, unknown>)
        : undefined;
    const violationType = policyEvent?.violationType ?? event.payload.violationType;
    if (typeof violationType !== "string") {
      return [];
    }

    if (policyEvent) {
      if (policyEvent.status !== "unresolved" || policyEvent.severity !== "critical") {
        return [];
      }
      if (hasAcceptedEvidenceSince(runSet, event.ts)) {
        return policyEvent.resolvableByEvidence === true ? [] : blocker(event, violationType);
      }
      return blocker(event, violationType);
    }

    if (["DONE_WITHOUT_EVIDENCE", "MIGRATION_WITHOUT_ADR"].includes(violationType)) {
      if (hasAcceptedEvidenceSince(runSet, event.ts)) {
        return [];
      }
    } else if (!["SECRET_IN_PLAINTEXT", "BYPASS_ATTEMPTED"].includes(violationType)) {
      return [];
    }

    return blocker(event, violationType);
  });
}

function hasAcceptedEvidenceSince(runSet: RunSetFile, sinceTimestamp: string): boolean {
  return runSet.evidence.some(
    (item) => item.status === "accepted" && item.createdAt > sinceTimestamp,
  );
}

function blocker(event: RunSetFile["events"][number], violationType: string): string[] {
  const reason = event.reason ? `: ${event.reason}` : "";
  return [`critical post_tool policy violation (${violationType})${reason}`];
}

function getLatestDevelopmentEntryTimestamp(runSet: RunSetFile): string | undefined {
  return [...runSet.events].reverse().find((e) => e.type === "DEVELOPMENT_MODE_ENTERED")?.ts;
}

function enforceBlockingRuntimeBinding(
  context: GateEvaluationContext,
  gateType: "stop",
): GateResult | null {
  const assessment = assessRuntimeBinding(context.runSet.runtimeBindings, gateType, {
    requireBlockingCapability: true,
  });
  if (!assessment.blockingProblem) return null;
  if (!riskAtLeast(context.currentRisk.risk_class, "M")) return null;
  return {
    decision: "block",
    gateType,
    reason: `runtime binding for ${gateType} is not enforceable for risk class ${context.currentRisk.risk_class}: ${assessment.binding.status}; canBlock=${assessment.binding.canBlock}`,
    violationType: "RUNTIME_BINDING_UNAVAILABLE",
    finalState: "BLOCKED_RUNTIME_MISSING",
  };
}

function buildMinimalContextInjection(context: GateEvaluationContext): string {
  return JSON.stringify({
    runId: context.state.run_id,
    riskClass: context.currentRisk.risk_class,
    phase: context.state.phase,
    subPhase: context.state.sub_phase,
    mode: context.state.mode,
  });
}
