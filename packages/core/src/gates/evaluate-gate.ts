import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { isEvidenceSufficient } from "../evidence/evaluate-evidence.js";
import { RISK_POLICY } from "../policy/baseline-policy.js";
import { getAllowedWriteZones, isAllowedWriteTarget } from "../policy/write-zones.js";
import { assessRuntimeBinding } from "../runtime/runtime-bindings.js";
import type { CurrentRiskFile } from "../schemas/current-risk.schema.js";
import type { GateEvent } from "../schemas/gate-event.schema.js";
import type { RunSetFile, SubagentRunRecord } from "../schemas/run-set.schema.js";
import type { PlanningStateFile } from "../schemas/state.schema.js";
import { evaluateAiSlopCleaner } from "../security/ai-slop-cleaner.js";
import { evaluateAntiBypassClause } from "../security/anti-bypass-clause.js";
import { evaluateHardLimits } from "../security/hard-limits.js";
import { scanPromptInjectionText } from "../security/prompt-injection-scan.js";
import { redactUnknown } from "../security/redaction.js";
import type { FinalState, GateDecision, OperatingMode, RiskClass } from "../types/canonical.js";
import { compareRiskClass, isRiskClass, riskAtLeast } from "../types/canonical.js";
import {
  type CompactionCriticalState,
  evaluateCompactionContinuity,
} from "./compaction-continuity.js";
import { getPolicyEventBlockers } from "./policy-event-blockers.js";

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
  | "INVALID_PHASE_TRANSITION";

export interface GateEvaluationContext {
  projectRoot: string;
  state: PlanningStateFile;
  currentRisk: CurrentRiskFile;
  runSet: RunSetFile;
}

export interface GateResult {
  decision: GateDecision;
  gateType: GateEvent["gateType"];
  reason: string;
  contextInjection?: string;
  violationType?: GateViolationType;
  finalState?: FinalState;
  missingEvidenceItems?: string[];
  evidenceAnchors?: readonly string[];
  policyEvent?: {
    readonly source: "post_tool";
    readonly status: "unresolved";
    readonly severity: "critical";
    readonly violationType: GateViolationType;
    readonly resolvableByEvidence: boolean;
  };
  subagentRecord?: SubagentRunRecord;
}

interface SessionStartSnapshot {
  readonly gitStatus: {
    readonly state: "clean" | "dirty" | "unavailable";
    readonly entries: readonly string[];
  };
  readonly recentAdrs: readonly {
    readonly path: string;
    readonly title: string;
  }[];
  readonly inProgressFeatures: readonly {
    readonly id?: string;
    readonly title?: string;
    readonly status: string;
  }[];
}

const DEFAULT_DENIED_SUBAGENT_TOOLS = ["todowrite", "task"] as const;

// ── Mode-axis helpers (M0/M2/M3) ───────────────────────────────────────────
// M0: "bypass" (legacy) OR "full-bypass" (explicit) → full-bypass semantics.
// Safety law (GOAL-3 §10.2): HARD gates and getPolicyEventBlockers always
// fire regardless of mode — these helpers only govern discipline/soft gates.

function isFullBypassMode(mode: OperatingMode): boolean {
  return mode === "bypass" || mode === "full-bypass";
}

function isCheckpointMode(mode: OperatingMode): boolean {
  return mode === "checkpoint";
}

function isExplicitMode(mode: OperatingMode): boolean {
  return mode === "explicit";
}
// ────────────────────────────────────────────────────────────────────────────

// ── M0 Destructive-op pause (GOAL-3 §10.2 + mode-axis.md §4) ──────────────
// Called from evaluatePreTool before any write-zone check.
// Returns a block result if the event is a D-class destructive op AND mode is
// full-bypass. In all other modes returns null (caller continues normally).
// HARD-always invariant: this function only fires extra in M0; in M1/M2/M3
// the normal pre_tool pipeline handles destructive ops via write-zone + class.
function evaluateDestructiveOp(
  context: GateEvaluationContext,
  event: GateEvent,
): GateResult | null {
  if (!isFullBypassMode(context.state.mode)) {
    return null;
  }

  const command = readShellCommand(event);
  const targets = readTargetPaths(event);
  const haystack = [command, ...targets, toolInputText(event)].join("\n").toLowerCase();

  // D1 — persistent deletion (non-recoverable)
  const isD1 =
    /\brm\s+-rf?\b|\bremove-item\s+.*-recurse\b/i.test(command) ||
    /\b(drop\s+table|truncate\s+table|delete\s+from\s+\w+\s*;)/i.test(haystack) ||
    targets.some(
      (t) =>
        /s3:\/\/.*\/(prod|production|staging)/.test(t) ||
        /gcs:\/\/.*\/(prod|production|staging)/.test(t),
    );

  // D2 — credential / secret mutation
  const isD2 =
    targets.some((t) => /\.env\.(production|staging|prod)$/.test(t)) ||
    /\bgit\s+push\s+.*--force\b/.test(command);

  // D3 — infrastructure destruction
  const isD3 =
    /\bterraform\s+(destroy|apply)\b/.test(command) ||
    /\bkubectl\s+delete\s+(namespace|deployment)\b/.test(command);

  // D4 — irreversible data pipeline mutation (schema migration drop/rename)
  const isD4 =
    targets.some((t) => isMigrationTarget(t)) &&
    /\b(drop|rename)\s+(column|table)\b/i.test(haystack);

  // D5 — publication / broadcast
  const isD5 =
    /\bnpm\s+publish\b|\bpnpm\s+publish\b/.test(command) ||
    /\bpypi\b|\bmaven\s+deploy\b/.test(command);

  const dClass = isD1
    ? "D1"
    : isD2
      ? "D2"
      : isD3
        ? "D3"
        : isD4
          ? "D4"
          : isD5
            ? "D5"
            : null;

  if (!dClass) {
    return null;
  }

  return {
    decision: "block",
    gateType: "pre_tool",
    reason: `M0 full-bypass: destructive op class ${dClass} requires human confirmation before proceeding`,
    violationType: "BYPASS_ATTEMPTED",
    finalState: "BLOCKED_NEEDS_USER",
    contextInjection: buildContextInjection(context, []),
  };
}
// ────────────────────────────────────────────────────────────────────────────

export function evaluateGate(context: GateEvaluationContext, event: GateEvent): GateResult {
  switch (event.gateType) {
    case "session_start":
      return evaluateSessionStart(context, event);
    case "user_prompt":
      return evaluateUserPrompt(context, event);
    case "pre_tool":
      return evaluatePreTool(context, event);
    case "post_tool":
      return evaluatePostTool(context, event);
    case "pre_compact":
      return evaluatePreCompact(context, event);
    case "post_compact":
      return evaluatePostCompact(context, event);
    case "stop":
      return evaluateStop(context, event);
    case "subagent_start":
      return evaluateSubagentStart(context, event);
    case "subagent_stop":
      return evaluateSubagentStop(context, event);
    default:
      return {
        decision: "allow",
        gateType: event.gateType,
        reason: `${event.gateType} allowed by baseline policy`,
      };
  }
}

function evaluateSessionStart(context: GateEvaluationContext, event: GateEvent): GateResult {
  const routeMismatch =
    context.runSet.route.phase !== context.state.phase ||
    context.runSet.route.subPhase !== context.state.sub_phase ||
    context.runSet.route.mode !== context.state.mode ||
    context.runSet.route.riskClass !== context.currentRisk.risk_class;

  if (context.state.sub_phase === null) {
    return {
      decision: "warn",
      gateType: event.gateType,
      reason: "session_start found an invalid route: current sub-phase is missing",
      violationType: "INVALID_PHASE_TRANSITION",
      contextInjection: buildContextInjection(context, []),
    };
  }

  if (routeMismatch) {
    return {
      decision: "warn",
      gateType: event.gateType,
      reason: "session_start found planning state and run-set route out of sync",
      violationType: "INVALID_PHASE_TRANSITION",
      contextInjection: buildContextInjection(context, []),
    };
  }

  const promptInjectionScan = scanPromptInjectionText(collectSessionStartScanText(event));
  if (promptInjectionScan.status === "blocked") {
    const findingIds = uniqueFindingIds(promptInjectionScan.findings).slice(0, 5);

    return {
      decision: "warn",
      gateType: event.gateType,
      reason: `session_start detected prompt-injection indicators: ${findingIds.join(", ")}`,
      violationType: "PROMPT_INJECTION_DETECTED",
      evidenceAnchors: promptInjectionScan.findings
        .slice(0, 5)
        .map((finding) => `session_start:${finding.line}:${finding.column}:${finding.id}`),
      contextInjection: buildContextInjection(context, []),
    };
  }

  return {
    decision: "allow",
    gateType: event.gateType,
    reason: "session_start context loaded",
    contextInjection: buildContextInjection(context, []),
  };
}

function collectSessionStartScanText(event: GateEvent): string {
  const parts: string[] = [];

  if (event.promptContent) {
    parts.push(event.promptContent);
  }

  collectStringValues(event.metadata, parts);

  return parts.join("\n");
}

function collectStringValues(value: unknown, parts: string[], depth = 0): void {
  if (depth > 4 || value === undefined || value === null) {
    return;
  }

  if (typeof value === "string") {
    parts.push(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStringValues(item, parts, depth + 1);
    }
    return;
  }

  if (typeof value === "object") {
    for (const child of Object.values(value)) {
      collectStringValues(child, parts, depth + 1);
    }
  }
}

function uniqueFindingIds(findings: readonly { readonly id: string }[]): readonly string[] {
  return [...new Set(findings.map((finding) => finding.id))];
}

function evaluateUserPrompt(context: GateEvaluationContext, event: GateEvent): GateResult {
  const bypassAttempt = evaluateAntiBypassClause({
    gateType: event.gateType,
    parts: [event.promptContent],
  });

  if (bypassAttempt.attempted && !RISK_POLICY[context.currentRisk.risk_class].bypassAllowed) {
    return {
      decision: "block",
      gateType: event.gateType,
      reason: `bypass is not allowed for risk class ${context.currentRisk.risk_class}`,
      violationType: "BYPASS_ATTEMPTED",
      evidenceAnchors: bypassAttempt.evidenceAnchors,
      contextInjection: buildContextInjection(context, []),
    };
  }

  if (bypassAttempt.attempted) {
    return {
      decision: "warn",
      gateType: event.gateType,
      reason: `bypass request accepted as warning for risk class ${context.currentRisk.risk_class}`,
      violationType: "BYPASS_ATTEMPTED",
      evidenceAnchors: bypassAttempt.evidenceAnchors,
      contextInjection: buildContextInjection(context, []),
    };
  }

  const runtimeBinding = enforceBlockingRuntimeBinding(context, "user_prompt");
  if (runtimeBinding) {
    return runtimeBinding;
  }

  // M0 note: "full-bypass" is only in allowedModes for T/L (baseline-policy.ts).
  // At M/H/C the allowedModes check below naturally blocks M0 (intended — see
  // mode-axis.md §2c). No extra skip needed here; the S-slice (baseline-policy)
  // is the sole enforcement point for which modes are permitted at which risk class.
  if (!RISK_POLICY[context.currentRisk.risk_class].allowedModes.includes(context.state.mode)) {
    return {
      decision: riskAtLeast(context.currentRisk.risk_class, "M") ? "block" : "warn",
      gateType: event.gateType,
      reason: `mode ${context.state.mode} is not allowed for risk class ${context.currentRisk.risk_class}`,
      violationType: "BYPASS_ATTEMPTED",
      contextInjection: buildContextInjection(context, []),
    };
  }

  return {
    decision: "allow",
    gateType: event.gateType,
    reason: "user_prompt allowed by risk class and operating mode",
    contextInjection: buildContextInjection(context, []),
  };
}

function evaluatePreTool(context: GateEvaluationContext, event: GateEvent): GateResult {
  const allowedZones = getAllowedWriteZones(context.state.sub_phase);

  // ── HARD gate: always fires, all modes including M0 (GOAL-3 §10.2) ──────
  const hardLimit = evaluateHardLimits(event);
  if (hardLimit.status === "block") {
    return {
      decision: "block",
      gateType: "pre_tool",
      reason: hardLimit.reason,
      violationType: hardLimit.violationType,
      evidenceAnchors: hardLimit.evidenceAnchors,
      contextInjection: buildContextInjection(context, allowedZones),
    };
  }

  // ── M0: destructive-op pause before write-zone skip ─────────────────────
  // Called first in M0 so that irreversible ops are caught even though
  // write-zone enforcement is skipped below. (mode-axis.md §4 + §2b)
  const destructiveBlock = evaluateDestructiveOp(context, event);
  if (destructiveBlock) {
    return destructiveBlock;
  }

  const bypassAttempt = evaluateAntiBypassClause({
    gateType: event.gateType,
    parts: [event.toolInput, event.metadata?.command],
  });

  if (bypassAttempt.attempted) {
    return {
      decision: riskAtLeast(context.currentRisk.risk_class, "M") ? "block" : "warn",
      gateType: "pre_tool",
      reason: `tool call attempts to bypass a gate in risk class ${context.currentRisk.risk_class}`,
      violationType: "BYPASS_ATTEMPTED",
      evidenceAnchors: bypassAttempt.evidenceAnchors,
      contextInjection: buildContextInjection(context, allowedZones),
    };
  }

  const targets = readTargetPaths(event);
  const policyTargets = targets.map((target) =>
    normalizeTargetForPolicy(target, context.projectRoot),
  );
  const writeEvent = isWriteEvent(event);
  const forceSignal = findForceSignal(
    policyTargets,
    writeEvent ? readShellCommand(event) : toolInputText(event),
  );

  if (
    forceSignal &&
    compareRiskClass(context.currentRisk.risk_class, forceSignal.minimumRiskClass) < 0
  ) {
    return {
      decision: riskAtLeast(context.currentRisk.risk_class, "H") ? "block" : "warn",
      gateType: "pre_tool",
      reason: `force signal ${forceSignal.signal} requires risk class ${forceSignal.minimumRiskClass}; current class is ${context.currentRisk.risk_class}`,
      violationType: "CLASS_UNDERESTIMATED",
      contextInjection: buildContextInjection(context, allowedZones),
    };
  }

  if (!writeEvent) {
    const runtimeBinding = enforceBlockingRuntimeBinding(context, "pre_tool");
    if (runtimeBinding) {
      return runtimeBinding;
    }

    return {
      decision: "allow",
      gateType: "pre_tool",
      reason: "pre_tool allowed non-write tool call",
      contextInjection: buildContextInjection(context, allowedZones),
    };
  }

  // ── Write-zone enforcement — skipped in M0 (mode-axis.md §2b) ──────────
  // M0 bypasses write-zone discipline gates. HARD limits (above) already
  // fired. Destructive-op pause (above) already fired. Only zone checks skip.
  if (!isFullBypassMode(context.state.mode)) {
    if (targets.length === 0) {
      return {
        decision: riskAtLeast(context.currentRisk.risk_class, "H") ? "block" : "warn",
        gateType: "pre_tool",
        reason: `write-capable tool call has no target paths for ${context.state.sub_phase}. Allowed zones: ${allowedZones.join(", ")}`,
        violationType: "FORBIDDEN_WRITE_ZONE",
        contextInjection: buildContextInjection(context, allowedZones),
      };
    }

    const forbiddenTargets = policyTargets.filter(
      (target) => !isAllowedWriteTarget(target, allowedZones),
    );

    if (forbiddenTargets.length > 0) {
      return {
        decision: riskAtLeast(context.currentRisk.risk_class, "H") ? "block" : "warn",
        gateType: "pre_tool",
        reason: `write target outside allowed zones for ${context.state.sub_phase}: ${forbiddenTargets.join(", ")}. Allowed zones: ${allowedZones.join(", ")}`,
        violationType: "FORBIDDEN_WRITE_ZONE",
        contextInjection: buildContextInjection(context, allowedZones),
      };
    }

    const runtimeBinding = enforceBlockingRuntimeBinding(context, "pre_tool");
    if (runtimeBinding) {
      return runtimeBinding;
    }

    return {
      decision: "allow",
      gateType: "pre_tool",
      reason: `write allowed in ${context.state.phase}/${context.state.sub_phase}`,
      contextInjection: buildContextInjection(context, allowedZones),
    };
  }
  // M0: write-zone skipped — fall through to allow
  // ────────────────────────────────────────────────────────────────────────

  return {
    decision: "allow",
    gateType: "pre_tool",
    reason: "pre_tool allowed (M0 full-bypass: write-zone check skipped)",
    contextInjection: buildContextInjection(context, allowedZones),
  };
}

function evaluatePostTool(context: GateEvaluationContext, event: GateEvent): GateResult {
  const outputText = stringifyUnknown(event.toolOutput);
  const inputText = toolInputText(event);
  const combinedText = `${inputText}\n${outputText}`;
  const writeEvent = isWriteEvent(event);
  const targets = writeEvent ? readTargetPaths(event) : [];

  if (containsPlaintextSecret(combinedText)) {
    return {
      decision: "warn",
      gateType: event.gateType,
      reason:
        "post_tool detected a plaintext secret; completed action cannot be undone, but stop must remain blocked until corrected",
      violationType: "SECRET_IN_PLAINTEXT",
      finalState: "BLOCKED_POLICY",
      policyEvent: postToolPolicyEvent("SECRET_IN_PLAINTEXT", false),
    };
  }

  const bypassAttempt = evaluateAntiBypassClause({
    gateType: event.gateType,
    parts: [event.toolInput, event.metadata?.command],
  });

  if (bypassAttempt.attempted) {
    return {
      decision: riskAtLeast(context.currentRisk.risk_class, "M") ? "block" : "warn",
      gateType: event.gateType,
      reason: `post_tool detected a gate bypass pattern in risk class ${context.currentRisk.risk_class}`,
      violationType: "BYPASS_ATTEMPTED",
      evidenceAnchors: bypassAttempt.evidenceAnchors,
      ...(riskAtLeast(context.currentRisk.risk_class, "M")
        ? {
            finalState: "BLOCKED_POLICY" as const,
            policyEvent: postToolPolicyEvent("BYPASS_ATTEMPTED", false),
          }
        : {}),
    };
  }

  // ── DONE_WITHOUT_EVIDENCE: skipped in M0 (mode-axis.md §2b) ────────────
  // In M0 there is no evidence-sufficiency discipline gate. Safety law:
  // containsPlaintextSecret and bypassAttempt checks above already fired
  // unconditionally; those are not skipped.
  if (!isFullBypassMode(context.state.mode)) {
    if (mentionsDoneVerified(combinedText) && !hasSufficientEvidence(context).sufficient) {
      return {
        decision: "block",
        gateType: event.gateType,
        reason: "DONE_VERIFIED appeared before the evidence set is sufficient",
        violationType: "DONE_WITHOUT_EVIDENCE",
        finalState: "BLOCKED_POLICY",
        policyEvent: postToolPolicyEvent("DONE_WITHOUT_EVIDENCE", true),
      };
    }
  }

  const slopCleanup = evaluateAiSlopCleaner({
    gateType: event.gateType,
    parts: [event.toolInput, event.toolOutput, event.metadata],
  });

  if (slopCleanup.cleanupTriggered && !slopCleanup.accepted) {
    const missingItems = slopCleanup.findings.map((finding) => finding.id);
    return {
      decision: riskAtLeast(context.currentRisk.risk_class, "M") ? "block" : "warn",
      gateType: event.gateType,
      reason: `post_tool cleanup/deslop output is missing required HARV-01 evidence: ${missingItems.join(", ")}`,
      violationType: "AI_SLOP_CLEANUP_EVIDENCE_MISSING",
      missingEvidenceItems: missingItems,
      evidenceAnchors: slopCleanup.evidenceAnchors,
      ...(riskAtLeast(context.currentRisk.risk_class, "M")
        ? {
            finalState: "BLOCKED_POLICY" as const,
            policyEvent: postToolPolicyEvent("AI_SLOP_CLEANUP_EVIDENCE_MISSING", true),
          }
        : {}),
    };
  }

  // ── MISSING_FALSIFIES_IF + MIGRATION_WITHOUT_ADR: skipped in M0 ─────────
  if (!isFullBypassMode(context.state.mode) && writeEvent) {
    const falsifiesIfViolation = findFalsifiesIfViolation(context.projectRoot, targets);
    if (falsifiesIfViolation) {
      return {
        decision: "block",
        gateType: event.gateType,
        reason: falsifiesIfViolation,
        violationType: "MISSING_FALSIFIES_IF",
        finalState: "BLOCKED_POLICY",
        policyEvent: postToolPolicyEvent("MISSING_FALSIFIES_IF", true),
      };
    }

    if (targets.some(isMigrationTarget) && !hasAdrEvidence(context)) {
      return {
        decision: "block",
        gateType: event.gateType,
        reason: "migration output detected without ADR or expand/contract evidence",
        violationType: "MIGRATION_WITHOUT_ADR",
        finalState: "BLOCKED_POLICY",
        policyEvent: postToolPolicyEvent("MIGRATION_WITHOUT_ADR", true),
      };
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const evidenceAnchors = collectClaimEvidenceAnchors(context.projectRoot, targets);

  return {
    decision: "allow",
    gateType: event.gateType,
    reason: "post_tool recorded completed action output without policy violations",
    ...(evidenceAnchors.length > 0 ? { evidenceAnchors } : {}),
  };
}

function evaluatePreCompact(context: GateEvaluationContext, event: GateEvent): GateResult {
  return {
    decision: "allow",
    gateType: event.gateType,
    reason: "pre_compact context snapshot prepared",
    contextInjection: buildContextInjection(context, []),
  };
}

function evaluatePostCompact(context: GateEvaluationContext, event: GateEvent): GateResult {
  const mismatches = getCompactionContinuityMismatches(context, event);

  if (mismatches.length > 0) {
    return {
      decision: riskAtLeast(context.currentRisk.risk_class, "M") ? "block" : "warn",
      gateType: event.gateType,
      reason: `post_compact route continuity mismatch: ${mismatches.join(", ")}`,
      violationType: "COMPACTION_CONTINUITY_MISMATCH",
      finalState: riskAtLeast(context.currentRisk.risk_class, "M")
        ? "BLOCKED_POLICY"
        : "DONE_WITH_GAPS",
      missingEvidenceItems: mismatches,
      contextInjection: buildContextInjection(context, []),
    };
  }

  return {
    decision: "allow",
    gateType: event.gateType,
    reason: "post_compact route continuity accepted",
    contextInjection: buildContextInjection(context, []),
  };
}

function evaluateStop(context: GateEvaluationContext, event: GateEvent): GateResult {
  // ── HARD-always: getPolicyEventBlockers fires in ALL modes including M0 ──
  // policy-event-blockers.ts lines 44–48: SECRET_IN_PLAINTEXT and
  // BYPASS_ATTEMPTED are never cleared by mode. This is the safety law.
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

  // ── M2: checkpoint injection before architecture/build boundary ──────────
  // Fires when mode is "checkpoint", the current phase is still in the
  // pre-architecture window (discovery/cadrage phases that map to
  // analysis+spec in GOAL-3 terminology), and no accepted hook_decision
  // evidence exists yet. "hook_decision" is EvidenceKey at canonical.ts line 68.
  if (isCheckpointMode(context.state.mode)) {
    const PRE_ARCH_PHASES = new Set(["discovery", "cadrage"]);  // MACRO_CYCLES before build
    const hasHookDecision = hasAnyAcceptedEvidence(context, ["hook_decision"]);
    if (PRE_ARCH_PHASES.has(context.state.phase) && !hasHookDecision) {
      return {
        decision: "block",
        gateType: event.gateType,
        reason: `M2 checkpoint-gated: human decision required before architecture/build phase; inject hook_decision evidence to resume`,
        violationType: "MISSING_HUMAN_VALIDATION",
        finalState: "BLOCKED_NEEDS_USER",
        missingEvidenceItems: ["hook_decision"],
        contextInjection: buildContextInjection(context, []),
      };
    }
    // Post-checkpoint or phases after cadrage: fall through to normal M1 logic.
  }

  // ── M0: skip evidence-sufficiency and requiresHumanCheckpoint checks ─────
  // mode-axis.md §2b: M0 bypasses discipline gates at stop.
  // HARD-always invariant: getPolicyEventBlockers (above) already fired.
  if (isFullBypassMode(context.state.mode)) {
    const runtimeBinding = enforceBlockingRuntimeBinding(context, "stop");
    if (runtimeBinding) {
      return runtimeBinding;
    }
    return {
      decision: "allow",
      gateType: event.gateType,
      reason: "stop allowed (M0 full-bypass: evidence-sufficiency check skipped; policy blockers clear)",
      finalState: "DONE_VERIFIED",
    };
  }

  // ── M1 / M2 (post-checkpoint) / M3 / M4: full evidence enforcement ───────
  const sufficiency = hasSufficientEvidence(context);

  if (
    RISK_POLICY[context.currentRisk.risk_class].requiresHumanCheckpoint &&
    sufficiency.missingItems.length === 1 &&
    sufficiency.missingItems[0] === "human_validation"
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
      reason: `stop cannot reach DONE_VERIFIED for risk class ${context.currentRisk.risk_class}; missing evidence: ${sufficiency.missingItems.join(", ")}`,
      violationType: "DONE_WITHOUT_EVIDENCE",
      finalState: riskAtLeast(context.currentRisk.risk_class, "M")
        ? "BLOCKED_POLICY"
        : "DONE_WITH_GAPS",
      missingEvidenceItems: sufficiency.missingItems,
    };
  }

  if (
    RISK_POLICY[context.currentRisk.risk_class].requiresHumanCheckpoint &&
    !hasAnyAcceptedEvidence(context, ["human_validation", "explicit_human_signature"])
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

  const runtimeBinding = enforceBlockingRuntimeBinding(context, "stop");
  if (runtimeBinding) {
    return runtimeBinding;
  }

  return {
    decision: "allow",
    gateType: event.gateType,
    reason: `stop allowed: evidence set is sufficient for risk class ${context.currentRisk.risk_class}`,
    finalState: "DONE_VERIFIED",
  };
}

function evaluateSubagentStart(context: GateEvaluationContext, event: GateEvent): GateResult {
  const hardLimit = evaluateHardLimits(event, context.runSet);

  if (hardLimit.status === "block") {
    return {
      decision: "block",
      gateType: "subagent_start",
      reason: hardLimit.reason,
      violationType: hardLimit.violationType,
      evidenceAnchors: hardLimit.evidenceAnchors,
    };
  }

  const agentId = readAgentId(event).trim();
  const task = readStringMetadata(event, ["task", "objective"]).trim();
  const scope = readStringArrayMetadata(event, "scope");
  const deliverables = uniqueStrings([
    ...readStringArrayMetadata(event, "deliverables"),
    ...readStringArrayMetadata(event, "expectedDeliverables"),
    ...readStringArrayMetadata(event, "expected_deliverables"),
  ]);
  const expectedEvidenceKeys = uniqueStrings([
    ...readStringArrayMetadata(event, "expectedEvidenceKeys"),
    ...readStringArrayMetadata(event, "expected_evidence_keys"),
    ...readStringArrayMetadata(event, "requiredEvidenceKeys"),
    ...readStringArrayMetadata(event, "required_evidence_keys"),
  ]);

  if (agentId.length === 0) {
    return {
      decision: "block",
      gateType: "subagent_start",
      reason: "subagent_start requires an explicit agent id",
      violationType: "SUBAGENT_WITHOUT_TRACE",
    };
  }

  if (task.length === 0) {
    return {
      decision: "block",
      gateType: "subagent_start",
      reason: `subagent_start for ${agentId} requires an explicit task`,
      violationType: "SUBAGENT_WITHOUT_TRACE",
    };
  }

  if (scope.length === 0) {
    return {
      decision: "block",
      gateType: "subagent_start",
      reason: `subagent_start for ${agentId} requires an explicit file/task scope`,
      violationType: "SUBAGENT_WITHOUT_TRACE",
    };
  }

  if (deliverables.length === 0 && expectedEvidenceKeys.length === 0) {
    return {
      decision: "block",
      gateType: "subagent_start",
      reason: `subagent_start for ${agentId} requires an explicit evidence contract`,
      violationType: "SUBAGENT_WITHOUT_TRACE",
    };
  }

  const bypassAttempt = evaluateAntiBypassClause({
    gateType: event.gateType,
    parts: [task, scope, deliverables, expectedEvidenceKeys],
  });

  if (bypassAttempt.attempted) {
    return {
      decision: riskAtLeast(context.currentRisk.risk_class, "M") ? "block" : "warn",
      gateType: "subagent_start",
      reason: `subagent_start for ${agentId} contains bypass instructions in risk class ${context.currentRisk.risk_class}`,
      violationType: "BYPASS_ATTEMPTED",
      evidenceAnchors: bypassAttempt.evidenceAnchors,
    };
  }

  const depth = readNumberMetadata(event, "depth") ?? 1;

  if (depth < 1 || depth > 1) {
    return {
      decision: "block",
      gateType: "subagent_start",
      reason: `subagent_start depth ${depth} exceeds the portable maximum depth of 1`,
      violationType: "SUBAGENT_WITHOUT_TRACE",
    };
  }

  const declaredRiskClass = readStringMetadata(event, ["riskClass", "risk_class"]);
  if (
    isRiskClass(declaredRiskClass) &&
    compareRiskClass(declaredRiskClass, context.currentRisk.risk_class) < 0
  ) {
    return {
      decision: "block",
      gateType: "subagent_start",
      reason: `subagent_start for ${agentId} declares lower risk ${declaredRiskClass} than current route ${context.currentRisk.risk_class}`,
      violationType: "CLASS_UNDERESTIMATED",
    };
  }

  const forbiddenTargets = scope
    .map(normalizePath)
    .filter(
      (target) => !isAllowedWriteTarget(target, getAllowedWriteZones(context.state.sub_phase)),
    );

  if (forbiddenTargets.length > 0) {
    return {
      decision: "block",
      gateType: "subagent_start",
      reason: `subagent_start for ${agentId} scope contains targets outside allowed zones for ${context.state.sub_phase}: ${forbiddenTargets.join(", ")}`,
      violationType: "FORBIDDEN_WRITE_ZONE",
    };
  }

  const toolPolicy = deriveSubagentToolPolicy(event);
  if (toolPolicy.deniedTools.length > 0) {
    return {
      decision: "block",
      gateType: "subagent_start",
      reason: `subagent_start for ${agentId} requests denied tools: ${toolPolicy.deniedTools.join(", ")}`,
      violationType: "SUBAGENT_TOOL_DENIED",
      evidenceAnchors: [
        "docs/excellence-application/05-architecture/stream-g-harvested-skill-wave-7.md#harvest-target",
      ],
    };
  }

  const runtimeBinding = enforceBlockingRuntimeBinding(context, "subagent_start");
  if (runtimeBinding) {
    return runtimeBinding;
  }

  return {
    decision: "allow",
    gateType: "subagent_start",
    reason: `subagent_start scope, depth, risk, and evidence contract accepted for ${agentId}`,
    contextInjection: buildContextInjection(context, getAllowedWriteZones(context.state.sub_phase)),
    subagentRecord: {
      agentId,
      role: readStringMetadata(event, ["role", "agentRole", "agent_role"]) || undefined,
      runtime:
        readStringMetadata(event, ["runtime", "targetRuntime", "target_runtime"]) || undefined,
      status: "requested",
      scope: uniqueStrings(scope),
      deliverables,
      metadata: {
        task,
        depth,
        expectedEvidenceKeys,
        riskClass: context.currentRisk.risk_class,
        declaredRiskClass: isRiskClass(declaredRiskClass) ? declaredRiskClass : undefined,
        toolPolicy,
      },
    },
  };
}

function deriveSubagentToolPolicy(event: GateEvent): {
  readonly requestedTools: readonly string[];
  readonly allowedTools: readonly string[];
  readonly defaultDeniedTools: readonly string[];
  readonly inheritedDeniedTools: readonly string[];
  readonly deniedTools: readonly string[];
} {
  const requestedTools = uniqueStrings(
    readStringArrayMetadataAny(event, ["requestedTools", "requested_tools", "tools"]),
  );
  const allowedTools = uniqueStrings(
    readStringArrayMetadataAny(event, [
      "allowedTools",
      "allowed_tools",
      "explicitAllowedTools",
      "explicit_allowed_tools",
    ]),
  );
  const inheritedDeniedTools = uniqueStrings(
    readStringArrayMetadataAny(event, [
      "disallowedTools",
      "disallowed_tools",
      "deniedTools",
      "denied_tools",
      "parentDeniedTools",
      "parent_denied_tools",
      "sessionDeniedTools",
      "session_denied_tools",
    ]),
  );
  const allowed = new Set(allowedTools.map(normalizeToolName));
  const inheritedDenied = new Set(inheritedDeniedTools.map(normalizeToolName));
  const defaultDenied = new Set(DEFAULT_DENIED_SUBAGENT_TOOLS.map(normalizeToolName));
  const deniedTools = requestedTools.filter((tool) => {
    const normalizedTool = normalizeToolName(tool);
    return (
      inheritedDenied.has(normalizedTool) ||
      (defaultDenied.has(normalizedTool) && !allowed.has(normalizedTool))
    );
  });

  return {
    requestedTools,
    allowedTools,
    defaultDeniedTools: [...DEFAULT_DENIED_SUBAGENT_TOOLS],
    inheritedDeniedTools,
    deniedTools,
  };
}

function evaluateSubagentStop(context: GateEvaluationContext, event: GateEvent): GateResult {
  const agentId = readAgentId(event);
  const subagentRecord = context.runSet.subagents.find((subagent) => subagent.agentId === agentId);
  const missingDeliverables = getMissingSubagentDeliverables(context, event, subagentRecord);
  if (missingDeliverables.length > 0) {
    return {
      decision: "block",
      gateType: "subagent_stop",
      reason: `subagent_stop missing declared deliverables for ${agentId || "unknown agent"}: ${missingDeliverables.join(", ")}`,
      violationType: "SUBAGENT_DELIVERABLES_MISSING",
      missingEvidenceItems: missingDeliverables,
    };
  }

  const hasTrace =
    agentId.length > 0 && subagentRecord !== undefined && hasEvidenceForAgent(context, agentId);

  if (!hasTrace || !subagentRecord) {
    return {
      decision: riskAtLeast(context.currentRisk.risk_class, "H") ? "block" : "warn",
      gateType: "subagent_stop",
      reason: agentId
        ? `subagent_stop has no accepted evidence trace for ${agentId}`
        : "subagent_stop requires an agent id and accepted evidence trace",
      violationType: "SUBAGENT_WITHOUT_TRACE",
    };
  }

  const slopCleanup = evaluateAiSlopCleaner({
    gateType: "subagent_stop",
    parts: [event.toolOutput, event.metadata, subagentRecord.metadata],
  });

  if (slopCleanup.cleanupTriggered && !slopCleanup.accepted) {
    const missingItems = slopCleanup.findings.map((finding) => finding.id);
    return {
      decision: riskAtLeast(context.currentRisk.risk_class, "M") ? "block" : "warn",
      gateType: "subagent_stop",
      reason: `subagent_stop cleanup/deslop output is missing required HARV-01 evidence: ${missingItems.join(", ")}`,
      violationType: "AI_SLOP_CLEANUP_EVIDENCE_MISSING",
      missingEvidenceItems: missingItems,
      evidenceAnchors: slopCleanup.evidenceAnchors,
      ...(riskAtLeast(context.currentRisk.risk_class, "M")
        ? { finalState: "BLOCKED_POLICY" as const }
        : {}),
    };
  }

  const runtimeBinding = enforceBlockingRuntimeBinding(context, "subagent_stop");
  if (runtimeBinding) {
    return runtimeBinding;
  }

  return {
    decision: "allow",
    gateType: "subagent_stop",
    reason: `subagent_stop trace accepted for ${agentId}`,
  };
}

function isWriteEvent(event: GateEvent): boolean {
  const action = typeof event.metadata?.action === "string" ? event.metadata.action : "";
  const actionName = action.toLowerCase();
  const toolName = event.toolName?.toLowerCase() ?? "";

  return (
    isWriteSignal(actionName) ||
    isWriteSignal(toolName) ||
    hasWriteMetadataCapability(event) ||
    hasWriteToolInputSignal(event) ||
    isShellWriteCommand(event)
  );
}

function isWriteSignal(value: string): boolean {
  const normalized = value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "_");
  const writeTokens = [
    "write",
    "edit",
    "patch",
    "move",
    "delete",
    "remove",
    "create",
    "save",
    "truncate",
    "append",
    "modify",
    "update",
    "rename",
    "copy",
    "post",
    "put",
    "upload",
  ];

  return writeTokens.some(
    (token) =>
      normalized === token ||
      normalized.startsWith(`${token}_`) ||
      normalized.endsWith(`_${token}`) ||
      normalized.includes(`_${token}_`),
  );
}

function hasWriteMetadataCapability(event: GateEvent): boolean {
  const metadata = event.metadata;

  if (!metadata) {
    return false;
  }

  const capabilityValues = [metadata.capability, metadata.toolCapability, metadata.tool_capability]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toLowerCase());
  const capabilityLists = [
    metadata.capabilities,
    metadata.toolCapabilities,
    metadata.tool_capabilities,
  ]
    .filter(Array.isArray)
    .flat()
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toLowerCase());

  return [...capabilityValues, ...capabilityLists].some(isWriteSignal);
}

function hasWriteToolInputSignal(event: GateEvent): boolean {
  if (!event.toolInput || typeof event.toolInput !== "object") {
    return false;
  }

  const input = event.toolInput as Record<string, unknown>;
  const scalarSignals = [
    input.action,
    input.operation,
    input.method,
    input.mode,
    input.intent,
    input.capability,
    input.toolCapability,
    input.tool_capability,
  ].filter((value): value is string => typeof value === "string");
  const listSignals = [input.capabilities, input.toolCapabilities, input.tool_capabilities]
    .filter(Array.isArray)
    .flat()
    .filter((value): value is string => typeof value === "string");

  return [...scalarSignals, ...listSignals].some(isWriteSignal);
}

function readTargetPaths(event: GateEvent): string[] {
  if (!event.toolInput || typeof event.toolInput !== "object") {
    return [...extractShellWriteTargets(event), ...extractPatchTargets(event)];
  }

  const input = event.toolInput as Record<string, unknown>;
  const scalarPaths = [
    input.path,
    input.filePath,
    input.file_path,
    input.targetPath,
    input.target_path,
    input.target,
  ].filter((value): value is string => typeof value === "string");
  const arrayPaths = [input.paths, input.files, input.targets]
    .filter(Array.isArray)
    .flat()
    .filter((value): value is string => typeof value === "string");

  return [
    ...new Set(
      [
        ...scalarPaths,
        ...arrayPaths,
        ...extractShellWriteTargets(event),
        ...extractPatchTargets(event),
      ]
        .map(normalizePath)
        .filter(Boolean),
    ),
  ];
}

function isShellWriteCommand(event: GateEvent): boolean {
  const command = readShellCommand(event);

  if (command.length === 0) {
    return false;
  }

  return (
    [
      /(?:^|[;&|]\s*)(?:touch|mkdir|rm|mv|cp)\b/i,
      /\b(?:Out-File|Set-Content|Add-Content|New-Item|Remove-Item|Move-Item|Copy-Item)\b/i,
      /\bsed\s+-i\b/i,
    ].some((pattern) => pattern.test(command)) || extractShellWriteTargets(event).length > 0
  );
}

function extractShellWriteTargets(event: GateEvent): string[] {
  const command = readShellCommand(event);
  if (command.length === 0) {
    return [];
  }

  const targets = [
    ...matchShellTargets(command, /(?:^|[^>])>{1,2}(?!&)\s*(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/g),
    ...matchShellTargets(command, /(?:-FilePath|-Path)\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/gi),
    ...matchShellTargets(command, /\btee\s+(?:-a\s+)?(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/gi),
    ...extractShellArgvWriteTargets(command),
  ];

  return targets.filter((target) => !target.startsWith("&") && !isNullDeviceTarget(target));
}

function extractPatchTargets(event: GateEvent): string[] {
  const text = `${toolInputText(event)}\n${stringifyUnknown(event.toolOutput)}`;
  return [
    ...matchPatchTargets(text, /^\*\*\* (?:Add|Update|Delete) File:\s+(.+?)\s*$/gm),
    ...matchPatchTargets(text, /^\*\*\* Move to:\s+(.+?)\s*$/gm),
  ];
}

function matchPatchTargets(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)]
    .map((match) => match[1]?.trim() ?? "")
    .filter((value) => value.length > 0);
}

function extractShellArgvWriteTargets(command: string): string[] {
  return splitShellCommandSegments(command).flatMap((segment) => {
    const tokens = tokenizeShellSegment(segment);
    if (tokens.length === 0) {
      return [];
    }

    const firstToken = tokens[0];
    if (firstToken === undefined) {
      return [];
    }

    const commandName = readShellCommandName(firstToken);
    if (["touch", "mkdir", "rm"].includes(commandName)) {
      return tokens.slice(1).filter(isShellPathOperand);
    }

    if (["mv", "cp"].includes(commandName)) {
      return tokens.slice(1).filter(isShellPathOperand);
    }

    if (commandName === "sed" && tokens.some((token) => token === "-i" || token.startsWith("-i"))) {
      const operands = tokens.slice(1).filter(isShellPathOperand);
      return operands.length >= 2 ? operands.slice(-1) : [];
    }

    return [];
  });
}

function splitShellCommandSegments(command: string): string[] {
  return command
    .split(/\s*(?:&&|\|\||[;|&])\s*/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function tokenizeShellSegment(segment: string): string[] {
  return [...segment.matchAll(/"([^"]*)"|'([^']*)'|([^\s]+)/g)]
    .map((match) => match[1] ?? match[2] ?? match[3] ?? "")
    .filter((value) => value.length > 0);
}

function readShellCommandName(token: string): string {
  return token.replace(/^.*[\\/]/, "").toLowerCase();
}

function isShellPathOperand(token: string): boolean {
  if (token.startsWith("-")) {
    return false;
  }

  if (/[<>]/.test(token)) {
    return false;
  }

  if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(token)) {
    return false;
  }

  return token.length > 0;
}

function matchShellTargets(command: string, pattern: RegExp): string[] {
  return [...command.matchAll(pattern)]
    .map((match) => match[1] ?? match[2] ?? match[3] ?? "")
    .filter((value) => value.length > 0);
}

function isNullDeviceTarget(target: string): boolean {
  const normalized = normalizePath(target);

  return normalized === "/dev/null" || normalized === "dev/null" || normalized === "nul";
}

function readShellCommand(event: GateEvent): string {
  const toolName = event.toolName?.toLowerCase() ?? "";
  if (!["bash", "shell", "powershell", "sh", "cmd"].some((name) => toolName.includes(name))) {
    return "";
  }

  if (typeof event.toolInput === "string") {
    return event.toolInput;
  }

  if (!event.toolInput || typeof event.toolInput !== "object") {
    return "";
  }

  const input = event.toolInput as Record<string, unknown>;
  const command = input.command ?? input.cmd ?? input.script;
  return typeof command === "string" ? command : "";
}

function readStringArrayMetadata(event: GateEvent, key: string): string[] {
  const value = event.metadata?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readStringArrayMetadataAny(event: GateEvent, keys: readonly string[]): string[] {
  return keys.flatMap((key) => readStringArrayMetadata(event, key));
}

function normalizeToolName(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "");
}

function readStringMetadata(event: GateEvent, keys: readonly string[]): string {
  for (const key of keys) {
    const value = event.metadata?.[key];
    if (typeof value === "string") {
      return value;
    }
  }

  return "";
}

function readNumberMetadata(event: GateEvent, key: string): number | null {
  const value = event.metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readAgentId(event: GateEvent): string {
  const value = event.metadata?.agentId ?? event.metadata?.agent_id;
  return typeof value === "string" ? value : "";
}

function getCompactionContinuityMismatches(
  context: GateEvaluationContext,
  event: GateEvent,
): string[] {
  const expected = {
    runId: context.state.run_id,
    phase: context.state.phase,
    subPhase: context.state.sub_phase ?? "",
    mode: context.state.mode,
    riskClass: context.currentRisk.risk_class,
  } satisfies CompactionCriticalState;

  return evaluateCompactionContinuity(expected, event.metadata ?? {}).mismatchedKeys;
}

function getMissingSubagentDeliverables(
  context: GateEvaluationContext,
  event: GateEvent,
  subagentRecord?: SubagentRunRecord,
): string[] {
  const declaredValues = [
    ...(subagentRecord?.deliverables ?? []),
    ...readStringArrayMetadata(event, "deliverables"),
    ...readStringArrayMetadata(event, "expectedDeliverables"),
    ...readStringArrayMetadata(event, "expected_deliverables"),
  ];
  const blankDeliverables = declaredValues
    .filter((deliverable) => deliverable.trim().length === 0)
    .map(() => "<blank deliverable>");
  const declared = uniqueStrings(declaredValues);

  return uniqueStrings([
    ...blankDeliverables,
    ...declared.filter(
      (deliverable) => !isExistingProjectDeliverable(context.projectRoot, deliverable),
    ),
  ]);
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

function isExistingProjectDeliverable(projectRoot: string, deliverable: string): boolean {
  if (path.isAbsolute(deliverable)) {
    return false;
  }

  const resolvedRoot = path.resolve(projectRoot);
  const resolvedDeliverable = path.resolve(resolvedRoot, deliverable);
  if (!isPathInsideRoot(resolvedRoot, resolvedDeliverable)) {
    return false;
  }

  if (!existsSync(resolvedDeliverable)) {
    return false;
  }

  return isPathInsideRoot(realpathSync(resolvedRoot), realpathSync(resolvedDeliverable));
}

function isPathInsideRoot(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative.length === 0 || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function normalizePath(value: string): string {
  return value
    .replaceAll("\\", "/")
    .replace(/^\/([a-z])\//i, "$1:/")
    .replace(/^\.\/+/, "")
    .toLowerCase();
}

function normalizeTargetForPolicy(value: string, projectRoot: string): string {
  const normalizedValue = normalizePath(value);
  const normalizedRoot = normalizePath(path.resolve(projectRoot));
  const absoluteValue = normalizeAbsoluteTargetForPolicy(normalizedValue);
  const realTarget = resolveRealPolicyTarget(value, projectRoot);

  if (realTarget) {
    const realRoot = normalizePath(realpathSync(path.resolve(projectRoot)));
    const normalizedRealTarget = normalizePath(realTarget);

    if (normalizedRealTarget === realRoot) {
      return ".";
    }

    return normalizedRealTarget.startsWith(`${realRoot}/`)
      ? normalizedRealTarget.slice(realRoot.length + 1)
      : normalizedRealTarget;
  }

  if (absoluteValue) {
    if (absoluteValue === normalizedRoot) {
      return ".";
    }

    return absoluteValue.startsWith(`${normalizedRoot}/`)
      ? absoluteValue.slice(normalizedRoot.length + 1)
      : absoluteValue;
  }

  const relativeValue = path.posix.normalize(normalizedValue);

  if (relativeValue === ".") {
    return ".";
  }

  return relativeValue;
}

function resolveRealPolicyTarget(value: string, projectRoot: string): string | null {
  const resolvedRoot = path.resolve(projectRoot);

  if (!existsSync(resolvedRoot)) {
    return null;
  }

  const normalizedValue = normalizePath(value);
  const absoluteValue = normalizeAbsoluteTargetForPolicy(normalizedValue);
  const resolvedTarget = absoluteValue
    ? path.resolve(absoluteValue)
    : path.resolve(resolvedRoot, path.posix.normalize(normalizedValue));
  const existingParent = findNearestExistingParent(resolvedTarget);

  if (!existingParent) {
    return null;
  }

  const relativeSuffix = path.relative(existingParent, resolvedTarget);
  return path.resolve(realpathSync(existingParent), relativeSuffix);
}

function findNearestExistingParent(target: string): string | null {
  let current = target;

  while (!existsSync(current)) {
    const parent = path.dirname(current);

    if (parent === current) {
      return null;
    }

    current = parent;
  }

  return current;
}

function normalizeAbsoluteTargetForPolicy(value: string): string | null {
  if (/^[a-z]:\//i.test(value)) {
    return normalizePath(path.win32.normalize(value));
  }

  if (value.startsWith("/")) {
    return normalizePath(path.posix.normalize(value));
  }

  return null;
}

function toolInputText(event: GateEvent): string {
  return stringifyUnknown(event.toolInput);
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === undefined || value === null) {
    return "";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function containsPlaintextSecret(text: string): boolean {
  const providerPatterns = [/sk-[a-z0-9]{20,}/i, /ghp_[a-z0-9]{20,}/i];
  if (providerPatterns.some((p) => p.test(text))) return true;

  const genericMatch = text.match(
    /(?:api[_-]?key|token|password|secret)\s*[:=]\s*["']?([a-z0-9_-]{20,})/i,
  );
  if (!genericMatch) return false;

  const candidate = genericMatch[1] ?? "";
  if (candidate.length === 0 || /^(.)\1+$/.test(candidate)) return false;
  if (
    /^(test_placeholder|fake_secret|mock_secret|dummy_value|example_key|sample_key)/i.test(
      candidate,
    )
  )
    return false;
  return true;
}

function mentionsDoneVerified(text: string): boolean {
  return /\bDONE_VERIFIED\b/.test(text);
}

function isMigrationTarget(target: string): boolean {
  return target.includes("migrations/") || target.includes(".migration.") || /\.sql$/.test(target);
}

function findFalsifiesIfViolation(projectRoot: string, targets: readonly string[]): string | null {
  for (const target of targets) {
    const absoluteTarget = resolveProjectTarget(projectRoot, target);
    if (!absoluteTarget || !existsSync(absoluteTarget)) {
      continue;
    }

    const relativeTarget = normalizeTargetForPolicy(absoluteTarget, projectRoot);
    const content = readFileSync(absoluteTarget, "utf8");
    if (!isClaimBearingArtifact(relativeTarget, content)) {
      continue;
    }

    const blockViolation = validateFalsifiesIfBlock(content, relativeTarget);
    if (blockViolation) {
      return blockViolation;
    }

    const anchor = extractEvidenceAnchor(content);
    const anchorViolation = anchor
      ? validateEvidenceAnchor(projectRoot, anchor, relativeTarget)
      : `claim-bearing artifact is missing evidence-anchor: ${relativeTarget}`;
    if (anchorViolation) {
      return anchorViolation;
    }
  }

  return null;
}

function collectClaimEvidenceAnchors(projectRoot: string, targets: readonly string[]): string[] {
  return targets.flatMap((target) => {
    const absoluteTarget = resolveProjectTarget(projectRoot, target);
    if (!absoluteTarget || !existsSync(absoluteTarget)) {
      return [];
    }

    const relativeTarget = normalizeTargetForPolicy(absoluteTarget, projectRoot);
    const content = readFileSync(absoluteTarget, "utf8");
    if (!isClaimBearingArtifact(relativeTarget, content)) {
      return [];
    }

    const anchor = extractEvidenceAnchor(content);
    return anchor ? [`${relativeTarget} -> ${anchor}`] : [];
  });
}

function postToolPolicyEvent(
  violationType: GateViolationType,
  resolvableByEvidence: boolean,
): NonNullable<GateResult["policyEvent"]> {
  return {
    source: "post_tool",
    status: "unresolved",
    severity: "critical",
    violationType,
    resolvableByEvidence,
  };
}

function resolveProjectTarget(projectRoot: string, target: string): string | null {
  if (target.length === 0) {
    return null;
  }

  return path.isAbsolute(target) ? path.resolve(target) : path.resolve(projectRoot, target);
}

function isClaimBearingArtifact(relativeTarget: string, content: string): boolean {
  const normalized = normalizePath(relativeTarget);
  if (!normalized.endsWith(".md")) {
    return false;
  }

  const basename = normalized.split("/").at(-1) ?? "";
  if (normalized.startsWith("docs/business-model/")) {
    return !basename.startsWith("research-") && !basename.startsWith("verification-");
  }

  if (normalized.startsWith("docs/decisions/")) {
    return true;
  }

  return /^---\s*\r?\n[\s\S]*?\bclaim-bearing:\s*true\b[\s\S]*?\r?\n---/.test(content);
}

function validateFalsifiesIfBlock(content: string, relativeTarget: string): string | null {
  const block = content.match(/^Falsifies-If:\s*\r?\n((?:[ \t]+.*(?:\r?\n|$))*)/m)?.[0];
  if (!block) {
    return `claim-bearing artifact missing Falsifies-If block: ${relativeTarget}`;
  }

  const requiredFields = ["kill-condition", "checkpoint-date", "evidence-anchor", "on-fail"];
  for (const field of requiredFields) {
    const fieldMatch = block.match(new RegExp(`^[ \\t]+${field}:[ \\t]*(.*)$`, "m"));
    if (!fieldMatch) {
      return `claim-bearing artifact has incomplete Falsifies-If block in ${relativeTarget}; missing ${field}:`;
    }
    if (!fieldMatch[1]?.trim()) {
      return `claim-bearing artifact has incomplete Falsifies-If block in ${relativeTarget}; empty ${field}:`;
    }
  }

  return null;
}

function extractEvidenceAnchor(content: string): string | null {
  const match = content.match(/^\s*evidence-anchor:\s*(.+?)\s*$/m);
  return match?.[1]?.trim() ?? null;
}

function validateEvidenceAnchor(
  projectRoot: string,
  anchor: string,
  sourceRelativeTarget: string,
): string | null {
  if (/^https?:\/\//i.test(anchor)) {
    return null;
  }

  const localAnchor = normalizeEvidenceAnchor(anchor, sourceRelativeTarget);
  if (!localAnchor.file) {
    return `evidence-anchor does not name a local file in ${sourceRelativeTarget}: ${anchor}`;
  }

  const absoluteAnchor = path.resolve(projectRoot, localAnchor.file);
  if (!existsSync(absoluteAnchor)) {
    return `evidence-anchor does not resolve to a file in ${sourceRelativeTarget}: ${anchor}`;
  }

  const anchorStats = statSync(absoluteAnchor);
  if (anchorStats.isDirectory()) {
    return null;
  }

  if (!anchorStats.isFile()) {
    return `evidence-anchor does not resolve to a file in ${sourceRelativeTarget}: ${anchor}`;
  }

  const content = readFileSync(absoluteAnchor, "utf8");
  const lines = content.split(/\r?\n/);
  const startLine = localAnchor.startLine;
  const endLine = localAnchor.endLine ?? startLine;

  if (
    startLine !== null &&
    endLine !== null &&
    (!Number.isInteger(startLine) ||
      !Number.isInteger(endLine) ||
      startLine < 1 ||
      endLine < startLine ||
      endLine > lines.length)
  ) {
    return `evidence-anchor line range is outside file contents in ${sourceRelativeTarget}: ${anchor}`;
  }

  if (localAnchor.section && !content.includes(localAnchor.section)) {
    return `evidence-anchor section is not present in ${sourceRelativeTarget}: ${anchor}`;
  }

  return null;
}

interface LocalEvidenceAnchor {
  readonly file: string;
  readonly startLine: number | null;
  readonly endLine: number | null;
  readonly section: string | null;
}

function normalizeEvidenceAnchor(
  anchor: string,
  sourceRelativeTarget: string,
): LocalEvidenceAnchor {
  const cleaned = anchor.replace(/^["'`]|["'`]$/g, "");
  if (/^this file(?:\b|$)/i.test(cleaned)) {
    return {
      file: sourceRelativeTarget,
      startLine: null,
      endLine: null,
      section: extractAnchorSection(cleaned),
    };
  }

  const localPathMatch = cleaned.match(
    /(?<file>(?:\.hima|docs|fixtures|packages|scripts)\/[^\s`),;]+?)(?=$|\s|\)|,|;)/,
  );
  if (localPathMatch?.groups?.file) {
    return parseLocalAnchorPath(localPathMatch.groups.file, extractAnchorSection(cleaned));
  }

  const sectionSplit = cleaned.split(/\s+§\s*/);
  const fileAndMaybeLines = sectionSplit[0]?.trim() ?? "";
  return parseLocalAnchorPath(fileAndMaybeLines, sectionSplit[1]?.trim() ?? null);
}

function parseLocalAnchorPath(
  fileAndMaybeLines: string,
  section: string | null,
): LocalEvidenceAnchor {
  const lineMatch = fileAndMaybeLines.match(/^(.+?)(?::(\d+)(?:-(\d+))?)?$/);
  return {
    file: lineMatch?.[1]?.trim() ?? "",
    startLine: lineMatch?.[2] ? Number.parseInt(lineMatch[2], 10) : null,
    endLine: lineMatch?.[3] ? Number.parseInt(lineMatch[3], 10) : null,
    section,
  };
}

function extractAnchorSection(anchor: string): string | null {
  return (
    anchor
      .split(/\s+§\s*/)[1]
      ?.split(/\s+\+\s+/)[0]
      ?.trim() ?? null
  );
}

function hasAdrEvidence(context: GateEvaluationContext): boolean {
  return context.runSet.evidence.some((item) => item.status === "accepted" && item.key === "adr");
}

function findForceSignal(
  targets: readonly string[],
  text: string,
): { signal: string; minimumRiskClass: RiskClass } | null {
  const haystack = [...targets, text.toLowerCase()].join("\n");
  const signals: { pattern: RegExp; signal: string; minimumRiskClass: RiskClass }[] = [
    {
      pattern: /(^|\/)(health|biometric|medical|financial\/regulated)(\/|$)/,
      signal: "regulated data path",
      minimumRiskClass: "C",
    },
    {
      pattern: /\b(refonte|strangler|big-bang|architecture-pivot)\b/,
      signal: "architecture pivot keyword",
      minimumRiskClass: "C",
    },
    {
      pattern:
        /(^|\/)(auth|authorization|sessions|payment|billing|stripe|checkout|migrations|schema|infra|terraform|k8s|api\/public)(\/|$)/,
      signal: "restricted H-risk path",
      minimumRiskClass: "H",
    },
    {
      pattern:
        /(\.session\.|\.migration\.|\.schema\.|openapi\.ya?ml|\.env\.production|pii|personal_data|email|phone|address)/,
      signal: "restricted H-risk field or contract",
      minimumRiskClass: "H",
    },
  ];

  return signals.find((entry) => entry.pattern.test(haystack)) ?? null;
}

function hasSufficientEvidence(context: GateEvaluationContext): {
  sufficient: boolean;
  missingItems: string[];
} {
  const sufficiency = isEvidenceSufficient(context.runSet.evidence, context.currentRisk.risk_class);

  return {
    sufficient: sufficiency.sufficient,
    missingItems: [...sufficiency.missingEvidenceKeys],
  };
}

function hasAnyAcceptedEvidence(context: GateEvaluationContext, ids: readonly string[]): boolean {
  return ids.some((id) =>
    context.runSet.evidence.some(
      (item) => item.status === "accepted" && (item.key === id || item.id === id),
    ),
  );
}

function hasEvidenceForAgent(context: GateEvaluationContext, agentId: string): boolean {
  const normalizedId = agentId.toLowerCase();
  return context.runSet.evidence.some((item) => {
    if (item.status !== "accepted") return false;
    const metaAgentId =
      typeof item.metadata?.agentId === "string" ? item.metadata.agentId.toLowerCase() : "";
    const evidenceId = item.id.toLowerCase();
    return (
      metaAgentId === normalizedId ||
      evidenceId === normalizedId ||
      evidenceId.startsWith(`${normalizedId}-`)
    );
  });
}

function enforceBlockingRuntimeBinding(
  context: GateEvaluationContext,
  gateType: "user_prompt" | "pre_tool" | "stop" | "subagent_start" | "subagent_stop",
): GateResult | null {
  const assessment = assessRuntimeBinding(context.runSet.runtimeBindings, gateType, {
    requireBlockingCapability: true,
  });

  if (!assessment.blockingProblem) {
    return null;
  }

  if (!riskAtLeast(context.currentRisk.risk_class, "M")) {
    return null;
  }

  return {
    decision: "block",
    gateType,
    reason: `runtime binding for ${gateType} is not enforceable for risk class ${context.currentRisk.risk_class}: ${assessment.binding.status}; canBlock=${assessment.binding.canBlock}`,
    violationType: "RUNTIME_BINDING_UNAVAILABLE",
    finalState: "BLOCKED_RUNTIME_MISSING",
  };
}

function buildContextInjection(
  context: GateEvaluationContext,
  allowedZones: readonly string[],
): string {
  return JSON.stringify(
    redactUnknown({
      runId: context.state.run_id,
      riskClass: context.currentRisk.risk_class,
      phase: context.state.phase,
      subPhase: context.state.sub_phase,
      mode: context.state.mode,
      activeGates: context.state.active_gates,
      allowedZones,
      forcingSignals: context.currentRisk.forcing_signals,
      sessionStart: loadSessionStartSnapshot(context.projectRoot),
    }),
  );
}

function loadSessionStartSnapshot(projectRoot: string): SessionStartSnapshot {
  return {
    gitStatus: readGitStatus(projectRoot),
    recentAdrs: readRecentAdrs(projectRoot),
    inProgressFeatures: readInProgressFeatures(projectRoot),
  };
}

function readGitStatus(projectRoot: string): SessionStartSnapshot["gitStatus"] {
  if (!existsSync(projectRoot)) {
    return { state: "unavailable", entries: [] };
  }

  try {
    const output = execFileSync("git", ["-C", projectRoot, "status", "--short"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2000,
      windowsHide: true,
    });
    const entries = output
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0)
      .slice(0, 20);

    return { state: entries.length === 0 ? "clean" : "dirty", entries };
  } catch {
    return { state: "unavailable", entries: [] };
  }
}

function readRecentAdrs(projectRoot: string): SessionStartSnapshot["recentAdrs"] {
  const decisionsDir = path.join(projectRoot, "docs", "decisions");

  if (!existsSync(decisionsDir)) {
    return [];
  }

  try {
    return readdirSync(decisionsDir)
      .filter((name) => name.toLowerCase().endsWith(".md"))
      .sort()
      .reverse()
      .slice(0, 3)
      .map((name) => {
        const adrPath = path.join(decisionsDir, name);
        return {
          path: normalizePath(path.relative(projectRoot, adrPath)),
          title: readMarkdownTitle(adrPath) ?? name,
        };
      });
  } catch {
    return [];
  }
}

function readMarkdownTitle(filePath: string): string | null {
  try {
    const content = readFileSync(filePath, "utf8");
    const title = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
    return title && title.length > 0 ? title : null;
  } catch {
    return null;
  }
}

function readInProgressFeatures(projectRoot: string): SessionStartSnapshot["inProgressFeatures"] {
  const featuresPath = path.join(projectRoot, "FEATURES.json");

  if (!existsSync(featuresPath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(readFileSync(featuresPath, "utf8")) as unknown;
    const features = Array.isArray(parsed)
      ? parsed
      : typeof parsed === "object" &&
          parsed !== null &&
          Array.isArray((parsed as { features?: unknown }).features)
        ? (parsed as { features: unknown[] }).features
        : [];

    return features
      .filter(isInProgressFeature)
      .slice(0, 10)
      .map((feature) => ({
        ...(typeof feature.id === "string" ? { id: feature.id } : {}),
        ...(typeof feature.title === "string"
          ? { title: feature.title }
          : typeof feature.name === "string"
            ? { title: feature.name }
            : {}),
        status: String(feature.status),
      }));
  } catch {
    return [];
  }
}

function isInProgressFeature(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const status = (value as Record<string, unknown>).status;
  return typeof status === "string" && status.toUpperCase() === "IN_PROGRESS";
}
