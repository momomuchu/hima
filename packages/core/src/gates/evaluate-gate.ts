import { isEvidenceSufficient } from "../evidence/evaluate-evidence.js";
import { RISK_POLICY } from "../policy/baseline-policy.js";
import { getAllowedWriteZones, isAllowedWriteTarget } from "../policy/write-zones.js";
import { assessRuntimeBinding } from "../runtime/runtime-bindings.js";
import type { CurrentRiskFile } from "../schemas/current-risk.schema.js";
import type { GateEvent } from "../schemas/gate-event.schema.js";
import type { RunSetFile } from "../schemas/run-set.schema.js";
import type { PlanningStateFile } from "../schemas/state.schema.js";
import type { FinalState, GateDecision, RiskClass } from "../types/canonical.js";
import { compareRiskClass, riskAtLeast } from "../types/canonical.js";
import { getPolicyEventBlockers } from "./policy-event-blockers.js";

export type GateViolationType =
  | "SECRET_IN_PLAINTEXT"
  | "FORBIDDEN_WRITE_ZONE"
  | "BYPASS_ATTEMPTED"
  | "MIGRATION_WITHOUT_ADR"
  | "DONE_WITHOUT_EVIDENCE"
  | "MISSING_HUMAN_VALIDATION"
  | "SUBAGENT_WITHOUT_TRACE"
  | "CLASS_UNDERESTIMATED"
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
}

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

  return {
    decision: "allow",
    gateType: event.gateType,
    reason: "session_start context loaded",
    contextInjection: buildContextInjection(context, []),
  };
}

function evaluateUserPrompt(context: GateEvaluationContext, event: GateEvent): GateResult {
  const bypassAttempt = containsBypassAttempt(event.promptContent, event.metadata);

  if (bypassAttempt && !RISK_POLICY[context.currentRisk.risk_class].bypassAllowed) {
    return {
      decision: "block",
      gateType: event.gateType,
      reason: `bypass is not allowed for risk class ${context.currentRisk.risk_class}`,
      violationType: "BYPASS_ATTEMPTED",
      contextInjection: buildContextInjection(context, []),
    };
  }

  if (bypassAttempt) {
    return {
      decision: "warn",
      gateType: event.gateType,
      reason: `bypass request accepted as warning for risk class ${context.currentRisk.risk_class}`,
      violationType: "BYPASS_ATTEMPTED",
      contextInjection: buildContextInjection(context, []),
    };
  }

  const runtimeBinding = enforceBlockingRuntimeBinding(context, "user_prompt");
  if (runtimeBinding) {
    return runtimeBinding;
  }

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
  if (containsBypassAttempt(toolInputText(event), event.metadata)) {
    return {
      decision: riskAtLeast(context.currentRisk.risk_class, "M") ? "block" : "warn",
      gateType: "pre_tool",
      reason: `tool call attempts to bypass a gate in risk class ${context.currentRisk.risk_class}`,
      violationType: "BYPASS_ATTEMPTED",
    };
  }

  const targets = readTargetPaths(event);
  const forceSignal = findForceSignal(targets, toolInputText(event));

  if (
    forceSignal &&
    compareRiskClass(context.currentRisk.risk_class, forceSignal.minimumRiskClass) < 0
  ) {
    return {
      decision: riskAtLeast(context.currentRisk.risk_class, "H") ? "block" : "warn",
      gateType: "pre_tool",
      reason: `force signal ${forceSignal.signal} requires risk class ${forceSignal.minimumRiskClass}; current class is ${context.currentRisk.risk_class}`,
      violationType: "CLASS_UNDERESTIMATED",
    };
  }

  if (!isWriteEvent(event)) {
    const runtimeBinding = enforceBlockingRuntimeBinding(context, "pre_tool");
    if (runtimeBinding) {
      return runtimeBinding;
    }

    return {
      decision: "allow",
      gateType: "pre_tool",
      reason: "pre_tool allowed non-write tool call",
      contextInjection: buildContextInjection(
        context,
        getAllowedWriteZones(context.state.sub_phase),
      ),
    };
  }

  const allowedZones = getAllowedWriteZones(context.state.sub_phase);

  if (targets.length === 0) {
    return {
      decision: riskAtLeast(context.currentRisk.risk_class, "H") ? "block" : "warn",
      gateType: "pre_tool",
      reason: `write-capable tool call has no target paths for ${context.state.sub_phase}. Allowed zones: ${allowedZones.join(", ")}`,
      violationType: "FORBIDDEN_WRITE_ZONE",
    };
  }

  const forbiddenTargets = targets.filter((target) => !isAllowedWriteTarget(target, allowedZones));

  if (forbiddenTargets.length === 0) {
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

  return {
    decision: riskAtLeast(context.currentRisk.risk_class, "H") ? "block" : "warn",
    gateType: "pre_tool",
    reason: `write target outside allowed zones for ${context.state.sub_phase}: ${forbiddenTargets.join(", ")}. Allowed zones: ${allowedZones.join(", ")}`,
    violationType: "FORBIDDEN_WRITE_ZONE",
  };
}

function evaluatePostTool(context: GateEvaluationContext, event: GateEvent): GateResult {
  const outputText = stringifyUnknown(event.toolOutput);
  const inputText = toolInputText(event);
  const combinedText = `${inputText}\n${outputText}`;
  const targets = readTargetPaths(event);

  if (containsPlaintextSecret(combinedText)) {
    return {
      decision: "warn",
      gateType: event.gateType,
      reason:
        "post_tool detected a plaintext secret; completed action cannot be undone, but stop must remain blocked until corrected",
      violationType: "SECRET_IN_PLAINTEXT",
      finalState: "BLOCKED_POLICY",
    };
  }

  if (containsBypassAttempt(combinedText, event.metadata)) {
    return {
      decision: riskAtLeast(context.currentRisk.risk_class, "M") ? "block" : "warn",
      gateType: event.gateType,
      reason: `post_tool detected a gate bypass pattern in risk class ${context.currentRisk.risk_class}`,
      violationType: "BYPASS_ATTEMPTED",
      ...(riskAtLeast(context.currentRisk.risk_class, "M")
        ? { finalState: "BLOCKED_POLICY" as const }
        : {}),
    };
  }

  if (mentionsDoneVerified(combinedText) && !hasSufficientEvidence(context).sufficient) {
    return {
      decision: "block",
      gateType: event.gateType,
      reason: "DONE_VERIFIED appeared before the evidence set is sufficient",
      violationType: "DONE_WITHOUT_EVIDENCE",
      finalState: "BLOCKED_POLICY",
    };
  }

  if (targets.some(isMigrationTarget) && !hasAdrEvidence(context)) {
    return {
      decision: "block",
      gateType: event.gateType,
      reason: "migration output detected without ADR or expand/contract evidence",
      violationType: "MIGRATION_WITHOUT_ADR",
      finalState: "BLOCKED_POLICY",
    };
  }

  return {
    decision: "allow",
    gateType: event.gateType,
    reason: "post_tool recorded completed action output without policy violations",
  };
}

function evaluateStop(context: GateEvaluationContext, event: GateEvent): GateResult {
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

  const sufficiency = hasSufficientEvidence(context);

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
  const scope = readStringArrayMetadata(event, "scope");

  if (scope.length === 0) {
    return {
      decision: "block",
      gateType: "subagent_start",
      reason: "subagent_start requires an explicit file/task scope",
      violationType: "SUBAGENT_WITHOUT_TRACE",
    };
  }

  const depth = readNumberMetadata(event, "depth") ?? 1;

  if (depth > 1) {
    return {
      decision: "block",
      gateType: "subagent_start",
      reason: `subagent_start depth ${depth} exceeds the portable maximum depth of 1`,
      violationType: "SUBAGENT_WITHOUT_TRACE",
    };
  }

  const forbiddenTargets = scope
    .map(normalizePath)
    .filter(
      (target) => !isAllowedWriteTarget(target, getAllowedWriteZones(context.state.sub_phase)),
    );

  if (forbiddenTargets.length > 0) {
    return {
      decision: riskAtLeast(context.currentRisk.risk_class, "H") ? "block" : "warn",
      gateType: "subagent_start",
      reason: `subagent scope contains targets outside allowed zones for ${context.state.sub_phase}: ${forbiddenTargets.join(", ")}`,
      violationType: "FORBIDDEN_WRITE_ZONE",
    };
  }

  const runtimeBinding = enforceBlockingRuntimeBinding(context, "subagent_start");
  if (runtimeBinding) {
    return runtimeBinding;
  }

  return {
    decision: "allow",
    gateType: "subagent_start",
    reason: "subagent_start scope and depth accepted",
    contextInjection: buildContextInjection(context, getAllowedWriteZones(context.state.sub_phase)),
  };
}

function evaluateSubagentStop(context: GateEvaluationContext, event: GateEvent): GateResult {
  const agentId = readAgentId(event);
  const evidenceIds = acceptedEvidenceIds(context);
  const hasTrace =
    agentId.length > 0 &&
    context.runSet.subagents.some((subagent) => subagent.agentId === agentId) &&
    evidenceIds.some((id) => id.includes(agentId.toLowerCase()));

  if (!hasTrace) {
    return {
      decision: riskAtLeast(context.currentRisk.risk_class, "H") ? "block" : "warn",
      gateType: "subagent_stop",
      reason: agentId
        ? `subagent_stop has no accepted evidence trace for ${agentId}`
        : "subagent_stop requires an agent id and accepted evidence trace",
      violationType: "SUBAGENT_WITHOUT_TRACE",
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
  const writeTokens = ["write", "edit", "patch", "move", "delete", "remove"];

  return (
    actionName.startsWith("write") ||
    writeTokens.includes(actionName) ||
    writeTokens.some((token) => toolName.includes(token)) ||
    hasWriteMetadataCapability(event)
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

  return [...capabilityValues, ...capabilityLists].some((value) =>
    ["write", "edit", "patch", "move", "delete", "remove"].includes(value),
  );
}

function readTargetPaths(event: GateEvent): string[] {
  if (!event.toolInput || typeof event.toolInput !== "object") {
    return [];
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

  return [...new Set([...scalarPaths, ...arrayPaths].map(normalizePath).filter(Boolean))];
}

function readStringArrayMetadata(event: GateEvent, key: string): string[] {
  const value = event.metadata?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readNumberMetadata(event: GateEvent, key: string): number | null {
  const value = event.metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readAgentId(event: GateEvent): string {
  const value = event.metadata?.agentId ?? event.metadata?.agent_id;
  return typeof value === "string" ? value : "";
}

function normalizePath(value: string): string {
  return value
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "")
    .toLowerCase();
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

function containsBypassAttempt(text: unknown, metadata?: Record<string, unknown>): boolean {
  const haystack = `${stringifyUnknown(text)}\n${stringifyUnknown(metadata)}`.toLowerCase();
  return [
    "--no-verify",
    "skip gate",
    "skip_gate",
    "bypass gate",
    "bypass_mode",
    "disable hook",
    "ignore policy",
    "force override",
  ].some((pattern) => haystack.includes(pattern));
}

function containsPlaintextSecret(text: string): boolean {
  return [
    /(?:api[_-]?key|token|password|secret)\s*[:=]\s*["']?[a-z0-9_-]{16,}/i,
    /sk-[a-z0-9]{20,}/i,
    /ghp_[a-z0-9]{20,}/i,
  ].some((pattern) => pattern.test(text));
}

function mentionsDoneVerified(text: string): boolean {
  return /\bDONE_VERIFIED\b/.test(text);
}

function isMigrationTarget(target: string): boolean {
  return (
    target.includes("migrations/") ||
    target.includes("/schema/") ||
    target.includes(".migration.") ||
    target.includes(".schema.")
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
      signal: "restricted high-risk path",
      minimumRiskClass: "H",
    },
    {
      pattern:
        /(\.session\.|\.migration\.|\.schema\.|openapi\.ya?ml|\.env\.production|pii|personal_data|email|phone|address)/,
      signal: "restricted high-risk field or contract",
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
  const present = acceptedEvidenceIds(context);
  return ids.some((id) =>
    present.some((evidenceId) => evidenceId === id || evidenceId.includes(id)),
  );
}

function acceptedEvidenceIds(context: GateEvaluationContext): string[] {
  return context.runSet.evidence
    .filter((item) => item.status === "accepted")
    .flatMap((item) => [item.id, item.key, item.kind, item.summary])
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toLowerCase());
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
  return JSON.stringify({
    runId: context.state.run_id,
    riskClass: context.currentRisk.risk_class,
    phase: context.state.phase,
    subPhase: context.state.sub_phase,
    mode: context.state.mode,
    activeGates: context.state.active_gates,
    allowedZones,
    forcingSignals: context.currentRisk.forcing_signals,
  });
}
