// Ported from packages/core/src/behaviors/beh-014-anti-sycophancy.ts — no logic changes

import type { BehaviorDescriptor, BehaviorVerdict, GateEvaluationContext } from "../behavior-registry.js";
import type { GateEvent } from "../gate-event.js";
import { riskAtLeast, type RiskClass } from "../risk-class.js";
import type { RunSetEvent } from "../run-set-types.js";

const REVERSAL_INTENT_PATTERNS: RegExp[] = [
  /\b(?:just\s+)?(?:do\s+it|proceed|continue|go\s+ahead|override|ignore(?:\s+the\s+block)?)\b/i,
  /\b(?:it['']?s\s+fine|it\s+doesn['']?t\s+matter|skip\s+(?:the\s+)?(?:check|gate|block))\b/i,
  /\b(?:do|run|execute|write|delete|apply)\s+(?:it|that|this|anyway|regardless)\b/i,
  /\bjust\s+(?:do|run|write|delete|apply|proceed|continue)\b/i,
];

interface BlockEventPayload {
  violationType?: string;
  qualityDimension?: string;
}

function findMostRecentBlock(context: GateEvaluationContext): { epochMs: number; ts: string; payload: BlockEventPayload } | null {
  const events = context.runSet?.events ?? [];
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i] as RunSetEvent | undefined;
    if (!ev) continue;
    if (ev.decision === "block" && (ev.type === "GATE_EVALUATED" || ev.gateType !== undefined)) {
      const epochMs = Date.parse(ev.ts);
      if (!Number.isFinite(epochMs)) continue;
      const payload = (ev.payload ?? {}) as BlockEventPayload;
      return { epochMs, ts: ev.ts, payload };
    }
  }
  return null;
}

function promptIndicatesReversalIntent(prompt: string): boolean {
  return REVERSAL_INTENT_PATTERNS.some((p) => p.test(prompt));
}

function hasOverrideOrNewEvidence(context: GateEvaluationContext, blockEpochMs: number): boolean {
  const evidence = context.runSet?.evidence ?? [];
  for (const item of evidence) {
    if (item.key === "human_validation" && item.status === "accepted" && item.source === "human") {
      const rationale = (item.metadata as Record<string, unknown> | undefined)?.rationale;
      if (typeof rationale === "string" && rationale.trim().length > 0) return true;
    }
    if (item.status === "accepted") {
      const itemEpochMs = Date.parse(item.createdAt);
      if (Number.isFinite(itemEpochMs) && itemEpochMs > blockEpochMs) return true;
    }
  }
  return false;
}

export const antiSycophancy: BehaviorDescriptor = {
  id: "BEH-014",
  name: "Anti-Sycophancy — Re-Verify on Challenge",
  gates: ["user_prompt"],

  classify(context: GateEvaluationContext, event: GateEvent): BehaviorVerdict {
    const recentBlock = findMostRecentBlock(context);
    if (recentBlock === null) return null;

    const prompt = event.promptContent ?? "";
    if (!promptIndicatesReversalIntent(prompt)) return null;

    if (hasOverrideOrNewEvidence(context, recentBlock.epochMs)) return null;

    const riskClass = (context.currentRisk?.risk_class ?? "T") as RiskClass;
    const isBlock = riskAtLeast(riskClass, "L");
    return {
      decision: isBlock ? "block" : "warn",
      reason:
        "BEH-014: The run has a recent block verdict and the current prompt indicates intent to proceed without new evidence. To resume: either supply a new accepted EvidenceRecord post-dating the block, or add a human_validation record (source=human, status=accepted) with a non-empty rationale in the Evidence Set.",
      violationType: "BYPASS_ATTEMPTED",
      qualityDimension: "evidence",
    };
  },
};
