#!/usr/bin/env node
import { realpath } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";
import { applyClaudeSettings, removeClaudeSettings } from "@harness/adapter-claude";
import { applyCodexHookConfig, removeCodexHookConfig } from "@harness/adapter-codex";
import { applyHermesHookConfig, removeHermesHookConfig } from "@harness/adapter-hermes";
import {
  ARTIFACT_INSTALL_TARGETS,
  type ArtifactInstallSelection,
  type ArtifactInstallTarget,
  addEvidence,
  appendRunEvent,
  applyRuntimeLifecycle,
  assessRouteRuntimeBindings,
  bindRuntime,
  type CatalogArtifactDescriptor,
  type CatalogArtifactSelection,
  CHANGE_TYPES,
  type Changeset,
  classifyRisk,
  closeRun,
  computeRuntimeHookDigest,
  computeRuntimeProfileDigest,
  DEFAULT_EVIDENCE_KEY,
  DEFAULT_EVIDENCE_STATUS,
  DEFAULT_RUNTIME_CAPABILITY_STATUS,
  EVIDENCE_KEYS,
  EVIDENCE_STATUSES,
  type EvidenceKey,
  type EvidenceStatus,
  enterDevelopment,
  evaluateConvergence,
  GATE_DECISIONS,
  GATE_TYPES,
  type GateDecision,
  type GateType,
  getOperationalCatalog,
  getStatus,
  handleHook,
  INSTALL_TARGETS,
  type InstallManifest,
  type InstallTarget,
  inspectRuntime,
  installCatalogArtifacts,
  installPlatform,
  MACRO_CYCLES,
  OPERATING_MODES,
  planArtifactInstall,
  planCatalogArtifacts,
  probeRuntime,
  RISK_CLASSES,
  RUNTIME_CAPABILITY_STATUSES,
  RUNTIME_PROOF_TYPES,
  type RuntimeCapabilityStatus,
  type RuntimeHookCapabilityInput,
  type RuntimeProbeEvidence,
  type RuntimeProofType,
  readInstallManifest,
  readPlanningProject,
  redactRecord,
  redactSecrets,
  repairRuntimeLifecycle,
  requestTransition,
  rollbackCatalogArtifacts,
  SUB_PHASES,
  uninstallRuntimeLifecycle,
  writeCatalogArtifacts,
} from "@harness/core";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };
type RequestId = string | number | null;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: RequestId;
  method: string;
  params?: unknown;
}

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: JsonObject;
};

export interface McpToolSurfaceEntry {
  name: string;
  description: string;
}

const MCP_ARTIFACT_SELECTIONS = ["all", "skills", "hooks", "subagents"] as const;
type McpArtifactSelection = (typeof MCP_ARTIFACT_SELECTIONS)[number];

const SERVER_INFO = {
  name: "harness-mcp-server",
  version: "0.0.0",
};
const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "rms.get_state",
    description: "Read the current RMS planning state from the project .planning files.",
    inputSchema: objectSchema({
      root: stringProperty(
        "Project root. Defaults to the MCP server working directory and must stay under it.",
      ),
    }),
  },
  {
    name: "rms.transition",
    description: "Request an RMS planning transition through @harness/core requestTransition().",
    inputSchema: objectSchema({
      root: stringProperty(
        "Project root. Defaults to the MCP server working directory and must stay under it.",
      ),
      targetPhase: {
        type: "string",
        enum: [...MACRO_CYCLES],
        description:
          "Optional macro-cycle target. Omit both targets to advance to the next position.",
      },
      targetSubPhase: {
        type: "string",
        enum: [...SUB_PHASES],
        description: "Optional subphase target. Defaults to Observer when targetPhase is provided.",
      },
      reason: stringProperty("Optional transition reason."),
    }),
  },
  {
    name: "rms.enter_development",
    description:
      "Enter governed development mode by binding phase, subphase, operating mode, risk class, and intent in .planning.",
    inputSchema: enterDevelopmentInputSchema(),
  },
  {
    name: "rms.classify_risk",
    description: "Classify RMS risk for a changeset through @harness/core classifyRisk().",
    inputSchema: objectSchema(
      {
        files: arrayProperty("string", "Changed file paths."),
        labels: arrayProperty("string", "Change labels."),
        changeType: {
          type: "string",
          enum: [...CHANGE_TYPES],
          description: "Canonical change type.",
        },
        diffContent: stringProperty("Optional diff content used for forcing-signal scans."),
        diffLinesNet: numberProperty("Optional net line count for the diff."),
        impactEstimate: estimateProperty("Optional impact estimate from 1 to 5."),
        probabilityEstimate: estimateProperty("Optional probability estimate from 1 to 5."),
        reposCount: numberProperty("Optional number of repositories affected."),
        ciGreen: {
          type: "boolean",
          description: "Whether CI is green for bypass checks.",
        },
        newEndpointExposed: {
          type: "boolean",
          description: "Whether the change exposes a new endpoint.",
        },
      },
      ["files", "labels", "changeType"],
    ),
  },
  {
    name: "rms.record_evidence",
    description:
      "Append an RMS evidence item to .planning/run-set.json through @harness/core storage.",
    inputSchema: evidenceInputSchema(),
  },
  {
    name: "rms.evaluate_gate",
    description: "Evaluate a canonical RMS GateType through @harness/core handleHook().",
    inputSchema: gateInputSchema(),
  },
  {
    name: "rms.inspect_runtime",
    description: "Inspect RMS runtime capabilities and store them inside .planning/run-set.json.",
    inputSchema: runtimeInspectInputSchema(),
  },
  {
    name: "rms.bind_runtime",
    description: "Bind inspected RMS runtime capabilities to canonical gates in run-set.json.",
    inputSchema: objectSchema(
      {
        root: stringProperty(
          "Project root. Defaults to the MCP server working directory and must stay under it.",
        ),
        target: stringProperty("Runtime target, for example codex, claude, or hermes."),
        inspectedAt: stringProperty("Optional binding timestamp."),
        expectedDigest: stringProperty("Optional expected runtime config/capability digest."),
        currentDigest: stringProperty("Optional current runtime config/capability digest."),
        expectedHookDigests: hookDigestRecordProperty(
          "Optional expected per-gate runtime digests.",
        ),
        currentHookDigests: hookDigestRecordProperty("Optional current per-gate runtime digests."),
      },
      ["target"],
    ),
  },
  {
    name: "rms.probe_runtime",
    description:
      "Probe target runtime config and store core-minted trusted runtime proofs in .planning/run-set.json.",
    inputSchema: runtimeProbeInputSchema(),
  },
  {
    name: "rms.assess_route_runtime_bindings",
    description: "Assess route-required runtime bindings without mutating state.",
    inputSchema: objectSchema({
      root: stringProperty(
        "Project root. Defaults to the MCP server working directory and must stay under it.",
      ),
    }),
  },
  {
    name: "rms.get_catalog",
    description: "Read the operational catalog exposed by @harness/core.",
    inputSchema: objectSchema({}),
  },
  {
    name: "rms.generate_artifacts",
    description:
      "Generate catalog-driven skill, hook, and subagent artifacts. Defaults to dry-run; set apply:true to write.",
    inputSchema: generateArtifactsInputSchema(),
  },
  {
    name: "rms.install_artifacts",
    description:
      "Install catalog-driven skill, hook, and subagent artifacts. Defaults to dry-run; set apply:true to write.",
    inputSchema: installArtifactsInputSchema(),
  },
  {
    name: "rms.install_platform",
    description:
      "Plan/write a platform install manifest and optionally apply target hook config. Defaults to dry-run.",
    inputSchema: platformInstallInputSchema(),
  },
  {
    name: "rms.uninstall_platform",
    description:
      "Remove managed platform hook registrations from a validated install manifest. Defaults to dry-run.",
    inputSchema: platformLifecycleInputSchema(),
  },
  {
    name: "rms.repair_platform",
    description:
      "Re-apply managed platform hook registrations from a validated install manifest. Defaults to dry-run.",
    inputSchema: platformLifecycleInputSchema(),
  },
  {
    name: "rms.apply_lifecycle",
    description:
      "Orchestrate platform hook install and catalog artifact install together. Defaults to dry-run.",
    inputSchema: lifecycleApplyInputSchema(),
  },
  {
    name: "rms.uninstall_lifecycle",
    description:
      "Orchestrate catalog artifact rollback and managed platform hook removal together. Defaults to dry-run.",
    inputSchema: lifecycleUninstallInputSchema(),
  },
  {
    name: "rms.repair_lifecycle",
    description:
      "Orchestrate platform hook repair and catalog artifact repair together. Defaults to dry-run.",
    inputSchema: lifecycleRepairInputSchema(),
  },
  {
    name: "rms.rollback_artifacts",
    description:
      "Rollback installed catalog-driven artifacts from an install manifest. Defaults to dry-run; set apply:true to delete.",
    inputSchema: rollbackArtifactsInputSchema(),
  },
  {
    name: "rms.runtime_digest",
    description: "Compute deterministic runtime profile digests for a target.",
    inputSchema: runtimeDigestInputSchema(),
  },
  {
    name: "rms.evaluate_convergence",
    description: "Evaluate run convergence from the current planning project.",
    inputSchema: objectSchema({
      root: stringProperty(
        "Project root. Defaults to the MCP server working directory and must stay under it.",
      ),
    }),
  },
  {
    name: "rms.close_run",
    description:
      "Close the current run using convergence evaluation and write finalization to run-set.json.",
    inputSchema: closeRunInputSchema(),
  },
  {
    name: "harness:get_state",
    description: "Read the current PFV4 harness state from the project .planning files.",
    inputSchema: objectSchema({
      root: stringProperty(
        "Project root. Defaults to the MCP server working directory and must stay under it.",
      ),
    }),
  },
  {
    name: "harness:get_risk_class",
    description: "Read the current harness risk class from .planning/current-risk.yaml.",
    inputSchema: objectSchema({
      root: stringProperty(
        "Project root. Defaults to the MCP server working directory and must stay under it.",
      ),
    }),
  },
  {
    name: "harness:evaluate_gate",
    description: "Evaluate a canonical harness GateType through @harness/core handleHook().",
    inputSchema: gateInputSchema(),
  },
  {
    name: "harness:record_evidence",
    description: "Append an evidence item to .planning/run-set.json through @harness/core storage.",
    inputSchema: evidenceInputSchema(),
  },
  {
    name: "harness:log_event",
    description: "Append a harness run event to .planning/run-set.json through @harness/core.",
    inputSchema: objectSchema(
      {
        root: stringProperty(
          "Project root. Defaults to the MCP server working directory and must stay under it.",
        ),
        type: stringProperty("Run event type."),
        gateType: {
          type: "string",
          enum: [...GATE_TYPES],
          description: "Optional canonical GateType attached to the event.",
        },
        decision: {
          type: "string",
          enum: [...GATE_DECISIONS],
          description: "Optional gate decision attached to the event.",
        },
        reason: stringProperty("Optional event reason."),
        payload: {
          type: "object",
          description: "Optional JSON payload.",
          additionalProperties: true,
        },
      },
      ["type"],
    ),
  },
  {
    name: "harness:enter_development",
    description: "Compatibility alias for rms.enter_development.",
    inputSchema: enterDevelopmentInputSchema(),
  },
  {
    name: "harness:get_catalog",
    description: "Legacy alias for rms.get_catalog.",
    inputSchema: objectSchema({}),
  },
  {
    name: "harness:generate_artifacts",
    description: "Compatibility alias for rms.generate_artifacts.",
    inputSchema: generateArtifactsInputSchema(),
  },
  {
    name: "harness:install_artifacts",
    description: "Compatibility alias for rms.install_artifacts.",
    inputSchema: installArtifactsInputSchema(),
  },
  {
    name: "harness:install_platform",
    description: "Compatibility alias for rms.install_platform.",
    inputSchema: platformInstallInputSchema(),
  },
  {
    name: "harness:uninstall_platform",
    description: "Compatibility alias for rms.uninstall_platform.",
    inputSchema: platformLifecycleInputSchema(),
  },
  {
    name: "harness:repair_platform",
    description: "Compatibility alias for rms.repair_platform.",
    inputSchema: platformLifecycleInputSchema(),
  },
  {
    name: "harness:apply_lifecycle",
    description: "Compatibility alias for rms.apply_lifecycle.",
    inputSchema: lifecycleApplyInputSchema(),
  },
  {
    name: "harness:uninstall_lifecycle",
    description: "Compatibility alias for rms.uninstall_lifecycle.",
    inputSchema: lifecycleUninstallInputSchema(),
  },
  {
    name: "harness:repair_lifecycle",
    description: "Compatibility alias for rms.repair_lifecycle.",
    inputSchema: lifecycleRepairInputSchema(),
  },
  {
    name: "harness:rollback_artifacts",
    description: "Compatibility alias for rms.rollback_artifacts.",
    inputSchema: rollbackArtifactsInputSchema(),
  },
  {
    name: "harness:runtime_digest",
    description: "Legacy alias for rms.runtime_digest.",
    inputSchema: runtimeDigestInputSchema(),
  },
  {
    name: "harness:probe_runtime",
    description: "Legacy alias for rms.probe_runtime.",
    inputSchema: runtimeProbeInputSchema(),
  },
  {
    name: "harness:evaluate_convergence",
    description: "Legacy alias for rms.evaluate_convergence.",
    inputSchema: objectSchema({
      root: stringProperty(
        "Project root. Defaults to the MCP server working directory and must stay under it.",
      ),
    }),
  },
  {
    name: "harness:close_run",
    description: "Legacy alias for rms.close_run.",
    inputSchema: closeRunInputSchema(),
  },
];

if (isDirectExecution()) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exitCode = 1;
  });
}

async function main(): Promise<void> {
  const input = createInterface({ input: process.stdin });

  for await (const line of input) {
    const raw = line.trim();

    if (raw.length === 0) {
      continue;
    }

    await handleRawMessage(raw);
  }
}

async function handleRawMessage(raw: string): Promise<void> {
  let message: unknown;

  try {
    message = JSON.parse(raw);
  } catch (error) {
    writeResponse(errorResponse(null, -32700, "Parse error", errorMessage(error)));
    return;
  }

  if (Array.isArray(message)) {
    const responses = await Promise.all(message.map((request) => handleMessage(request)));
    const reply = responses.filter((response): response is JsonObject => response !== null);

    if (reply.length > 0) {
      writeResponse(reply);
    }

    return;
  }

  const response = await handleMessage(message);

  if (response) {
    writeResponse(response);
  }
}

async function handleMessage(message: unknown): Promise<JsonObject | null> {
  if (!isRequest(message)) {
    return errorResponse(null, -32600, "Invalid Request");
  }

  if (message.id === undefined) {
    await handleNotification(message);
    return null;
  }

  try {
    const result = await dispatchRequest(message.method, message.params);
    return successResponse(message.id, result);
  } catch (error) {
    return errorResponse(message.id, -32603, "Internal error", errorMessage(error));
  }
}

async function handleNotification(message: JsonRpcRequest): Promise<void> {
  if (
    message.method === "notifications/initialized" ||
    message.method.startsWith("notifications/")
  ) {
    return;
  }
}

export async function dispatchRequest(method: string, params: unknown): Promise<JsonValue> {
  switch (method) {
    case "initialize":
      return {
        protocolVersion: readProtocolVersion(params),
        capabilities: {
          tools: {},
        },
        serverInfo: SERVER_INFO,
      };
    case "ping":
      return {};
    case "tools/list":
      return { tools: TOOL_DEFINITIONS as JsonValue[] };
    case "tools/call":
      return callTool(params);
    default:
      throw new Error(`Unsupported method: ${method}`);
  }
}

export function getMcpToolSurface(): McpToolSurfaceEntry[] {
  return TOOL_DEFINITIONS.map((tool) => ({
    name: tool.name,
    description: tool.description,
  }));
}

async function callTool(params: unknown): Promise<JsonObject> {
  const request = readToolCall(params);

  try {
    const data = await executeTool(request.name, request.arguments);
    return toolResult(data);
  } catch (error) {
    return toolResult({ error: errorMessage(error) }, true);
  }
}

async function executeTool(name: string, args: JsonObject): Promise<JsonValue> {
  switch (name) {
    case "rms.get_state":
    case "harness:get_state":
      return toJsonValue(await getStatus(await readMcpProjectRoot(args, "MCP project root")));
    case "harness:get_risk_class":
      return getRiskClass(await readMcpProjectRoot(args, "MCP project root"));
    case "rms.transition":
      return transitionTool(args);
    case "rms.enter_development":
    case "harness:enter_development":
      return enterDevelopmentTool(args);
    case "rms.classify_risk":
      return toJsonValue(classifyRisk(readChangeset(args)));
    case "rms.evaluate_gate":
    case "harness:evaluate_gate":
      return evaluateGateTool(args);
    case "rms.record_evidence":
    case "harness:record_evidence":
      return recordEvidence(args);
    case "rms.inspect_runtime":
      return inspectRuntimeTool(args);
    case "rms.bind_runtime":
      return bindRuntimeTool(args);
    case "rms.probe_runtime":
    case "harness:probe_runtime":
      return probeRuntimeTool(args);
    case "rms.assess_route_runtime_bindings":
      return assessRouteRuntimeBindingsTool(args);
    case "rms.get_catalog":
    case "harness:get_catalog":
      return toJsonValue(getOperationalCatalog()) as JsonObject;
    case "rms.generate_artifacts":
    case "harness:generate_artifacts":
      return generateArtifactsTool(args);
    case "rms.install_artifacts":
    case "harness:install_artifacts":
      return installArtifactsTool(args);
    case "rms.install_platform":
    case "harness:install_platform":
      return installPlatformTool(args);
    case "rms.uninstall_platform":
    case "harness:uninstall_platform":
      return uninstallPlatformTool(args);
    case "rms.repair_platform":
    case "harness:repair_platform":
      return repairPlatformTool(args);
    case "rms.apply_lifecycle":
    case "harness:apply_lifecycle":
      return applyLifecycleTool(args);
    case "rms.uninstall_lifecycle":
    case "harness:uninstall_lifecycle":
      return uninstallLifecycleTool(args);
    case "rms.repair_lifecycle":
    case "harness:repair_lifecycle":
      return repairLifecycleTool(args);
    case "rms.rollback_artifacts":
    case "harness:rollback_artifacts":
      return rollbackArtifactsTool(args);
    case "rms.runtime_digest":
    case "harness:runtime_digest":
      return runtimeDigestTool(args);
    case "rms.evaluate_convergence":
    case "harness:evaluate_convergence":
      return evaluateConvergenceTool(args);
    case "rms.close_run":
    case "harness:close_run":
      return closeRunTool(args);
    case "harness:log_event":
      return logEvent(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function transitionTool(args: JsonObject): Promise<JsonObject> {
  const request: {
    targetPhase?: (typeof MACRO_CYCLES)[number];
    targetSubPhase?: (typeof SUB_PHASES)[number];
    reason?: string;
  } = {};

  if (args.targetPhase !== undefined) {
    request.targetPhase = readMacroCycle(args.targetPhase);
  }

  if (args.targetSubPhase !== undefined) {
    request.targetSubPhase = readSubPhase(args.targetSubPhase);
  }

  if (args.reason !== undefined) {
    request.reason = readRequiredString(args.reason, "reason");
  }

  return toJsonValue(
    await requestTransition(await readMcpProjectRoot(args, "MCP project root"), request),
  ) as JsonObject;
}

async function enterDevelopmentTool(args: JsonObject): Promise<JsonObject> {
  return toJsonValue(
    await enterDevelopment(await readMcpProjectRoot(args, "MCP project root"), {
      phase: args.phase === undefined ? undefined : readMacroCycle(args.phase),
      subPhase: args.subPhase === undefined ? undefined : readSubPhase(args.subPhase),
      mode: args.mode === undefined ? undefined : readOperatingMode(args.mode),
      riskClass: args.riskClass === undefined ? undefined : readRiskClass(args.riskClass),
      objective: readOptionalString(args.objective, "objective"),
      rawPrompt: readOptionalString(args.rawPrompt, "rawPrompt"),
      reason: readOptionalString(args.reason, "reason"),
    }),
  ) as JsonObject;
}

async function getRiskClass(projectRoot: string): Promise<JsonObject> {
  const project = await readPlanningProject(projectRoot);

  return {
    runId: project.currentRisk.run_id,
    riskClass: project.currentRisk.risk_class,
    rank: project.currentRisk.rank,
    bypassAllowed: project.currentRisk.bypass_allowed,
    humanCheckpointRequired: project.currentRisk.human_checkpoint_required,
  };
}

function readChangeset(args: JsonObject): Changeset {
  return {
    files: readStringArray(args.files, "files"),
    labels: readStringArray(args.labels, "labels"),
    changeType: readChangeType(args.changeType),
    diffContent: readOptionalString(args.diffContent, "diffContent"),
    diffLinesNet: readOptionalNumber(args.diffLinesNet, "diffLinesNet"),
    impactEstimate: readOptionalEstimate(args.impactEstimate, "impactEstimate"),
    probabilityEstimate: readOptionalEstimate(args.probabilityEstimate, "probabilityEstimate"),
    reposCount: readOptionalNumber(args.reposCount, "reposCount"),
    ciGreen: readOptionalBoolean(args.ciGreen, "ciGreen"),
    newEndpointExposed: readOptionalBoolean(args.newEndpointExposed, "newEndpointExposed"),
  };
}

async function evaluateGateTool(args: JsonObject): Promise<JsonObject> {
  const gateType = readGateType(args.gateType);
  const payload = readOptionalJsonObject(args.payload, "payload");
  const dryRun = typeof args.dryRun === "boolean" ? args.dryRun : false;
  const root = await readMcpProjectRoot(args, "MCP project root");

  return toJsonValue(await handleHook(root, gateType, payload, { dryRun })) as JsonObject;
}

async function recordEvidence(args: JsonObject): Promise<JsonObject> {
  const projectRoot = await readMcpProjectRoot(args, "MCP project root");
  const project = await readPlanningProject(projectRoot);
  const key = readEvidenceKey(args.key);
  const item = await addEvidence(projectRoot, {
    key,
    kind: typeof args.kind === "string" && args.kind.length > 0 ? args.kind : key,
    status: readEvidenceStatus(args.status),
    summary: readRequiredString(args.summary, "summary"),
    source: "agent",
  });

  return {
    recorded: true,
    runId: project.runSet.runId,
    evidence: toJsonValue(item),
  };
}

async function inspectRuntimeTool(args: JsonObject): Promise<JsonObject> {
  const capability = await inspectRuntime(
    await readMcpProjectRoot(args, "MCP project root"),
    readRequiredString(args.target, "target"),
    {
      inspectedAt: readOptionalString(args.inspectedAt, "inspectedAt"),
      runtimeName: readOptionalString(args.runtimeName, "runtimeName"),
      runtimeVersion: readOptionalString(args.runtimeVersion, "runtimeVersion"),
      status: readOptionalRuntimeCapabilityStatus(args.status, "status"),
      configDigest: readOptionalString(args.configDigest, "configDigest"),
      hooks: readOptionalRuntimeHooks(args.hooks, "hooks"),
      knownLimitations: readOptionalStringArray(args.knownLimitations, "knownLimitations"),
    },
  );

  return toJsonValue(capability) as JsonObject;
}

async function bindRuntimeTool(args: JsonObject): Promise<JsonObject> {
  const bindings = await bindRuntime(
    await readMcpProjectRoot(args, "MCP project root"),
    readRequiredString(args.target, "target"),
    {
      inspectedAt: readOptionalString(args.inspectedAt, "inspectedAt"),
      expectedDigest: readOptionalString(args.expectedDigest, "expectedDigest"),
      currentDigest: readOptionalString(args.currentDigest, "currentDigest"),
      expectedHookDigests: readOptionalHookDigestRecord(
        args.expectedHookDigests,
        "expectedHookDigests",
      ),
      currentHookDigests: readOptionalHookDigestRecord(
        args.currentHookDigests,
        "currentHookDigests",
      ),
    },
  );

  return toJsonValue(bindings) as JsonObject;
}

async function probeRuntimeTool(args: JsonObject): Promise<JsonObject> {
  const inspectedAt = new Date().toISOString();

  return toJsonValue(
    await probeRuntime(
      await readMcpProjectRoot(args, "MCP project root"),
      readRequiredString(args.target, "target"),
      {
        inspectedAt,
        bind: readOptionalBoolean(args.bind, "bind") ?? false,
        verifyBlockingFixtures:
          readOptionalBoolean(args.verifyBlockingFixtures, "verifyBlockingFixtures") ?? false,
      },
    ),
  ) as JsonObject;
}

function runtimeDigestTool(args: JsonObject): JsonObject {
  const target = readRequiredString(args.target, "target");

  if (args.gateType !== undefined) {
    const gateType = readGateType(args.gateType);

    return {
      target,
      gateType,
      digest: computeRuntimeHookDigest(target, gateType),
    };
  }

  return {
    target,
    digest: computeRuntimeProfileDigest(target),
  };
}

async function evaluateConvergenceTool(args: JsonObject): Promise<JsonObject> {
  const project = await readPlanningProject(await readMcpProjectRoot(args, "MCP project root"));

  return toJsonValue(evaluateConvergence(project)) as JsonObject;
}

async function assessRouteRuntimeBindingsTool(args: JsonObject): Promise<JsonObject> {
  const project = await readPlanningProject(await readMcpProjectRoot(args, "MCP project root"));
  const assessment = assessRouteRuntimeBindings(project.runSet, project.currentRisk.risk_class);

  return toJsonValue({
    riskClass: project.currentRisk.risk_class,
    activeTarget: project.runSet.runtimeBindings.activeTarget ?? null,
    ...assessment,
  }) as JsonObject;
}

async function closeRunTool(args: JsonObject): Promise<JsonObject> {
  return toJsonValue(
    await closeRun(await readMcpProjectRoot(args, "MCP project root"), {
      closedAt: readOptionalString(args.closedAt, "closedAt"),
      eventId: readOptionalString(args.eventId, "eventId"),
    }),
  ) as JsonObject;
}

async function generateArtifactsTool(args: JsonObject): Promise<JsonObject> {
  const kind = readArtifactToolKind(args.kind);
  const { baseDir, root } = await readArtifactBaseDir(args);
  const apply = readApply(args);
  const writeResult = apply
    ? await writeCatalogArtifacts({ outputRoot: baseDir, kind, dryRun: false })
    : undefined;
  const result = writeResult ?? planCatalogArtifacts({ outputRoot: baseDir, kind, dryRun: true });
  const writtenPaths = writeResult?.writtenPaths ?? [];
  const unchangedPaths = writeResult?.unchangedPaths ?? [];

  return {
    apply,
    dryRun: !apply,
    kind,
    root,
    baseDir: result.outputRoot,
    artifacts: toJsonValue(result.artifacts.map(toArtifactSummary)),
    artifactsPlanned: result.artifacts.length,
    artifactsWritten: [...writtenPaths],
    artifactsUnchanged: [...unchangedPaths],
  };
}

async function installArtifactsTool(args: JsonObject): Promise<JsonObject> {
  const kind = readArtifactInstallKind(args.kind);
  const target = readArtifactInstallTarget(args.target);
  const root = await readMcpInstallRoot(args);
  const apply = readApply(args);
  const writeManifest = readWriteManifest(args);
  const captureRestoreSnapshots = readCaptureRestoreSnapshots(args);
  if (writeManifest && !apply) {
    throw new Error("writeManifest requires apply:true for install_artifacts.");
  }
  if (captureRestoreSnapshots && !apply) {
    throw new Error("captureRestoreSnapshots requires apply:true for install_artifacts.");
  }
  if (captureRestoreSnapshots && !writeManifest) {
    throw new Error("captureRestoreSnapshots requires writeManifest:true for install_artifacts.");
  }

  const installResult = apply
    ? await installCatalogArtifacts({
        projectRoot: root,
        target,
        kind,
        dryRun: false,
        writeManifest,
        captureRestoreSnapshots,
      })
    : undefined;
  const result =
    installResult ?? planArtifactInstall({ projectRoot: root, target, kind, dryRun: true });
  const writtenPaths = installResult?.writtenPaths ?? [];
  const unchangedPaths = installResult?.unchangedPaths ?? [];

  return {
    apply,
    dryRun: !apply,
    writeManifest,
    captureRestoreSnapshots,
    target: result.target,
    kind: result.selection,
    selection: result.selection,
    root,
    projectRoot: result.projectRoot,
    platformDirectory: result.platformDirectory,
    artifacts: toJsonValue(result.artifacts.map(toArtifactSummary)),
    actions: toJsonValue(result.actions),
    artifactsPlanned: result.artifacts.length,
    artifactsWritten: [...writtenPaths],
    artifactsUnchanged: [...unchangedPaths],
    ...(installResult?.manifest ? { manifest: toJsonValue(installResult.manifest) } : {}),
    ...(installResult?.manifestFile ? { manifestFile: installResult.manifestFile } : {}),
  };
}

async function installPlatformTool(args: JsonObject): Promise<JsonObject> {
  const target = readInstallTarget(args.target);
  const root = await readMcpPlatformRoot(args);
  const apply = readApply(args);
  const writeManifest = readWriteManifest(args);
  const result = await installPlatform({
    projectRoot: root,
    target,
    dryRun: !apply,
    writeManifest,
  });
  const applied = apply
    ? await applyPlatformConfig(target, result.expectedPaths.platformDirectory)
    : undefined;

  return {
    apply,
    dryRun: result.dryRun,
    writeManifest,
    target: result.target,
    root,
    projectRoot: result.expectedPaths.projectRoot,
    platformDirectory: result.expectedPaths.platformDirectory,
    hooksDirectory: result.expectedPaths.hooksDirectory,
    manifestFile: result.expectedPaths.manifestFile,
    plannedActions: toJsonValue(result.plannedActions),
    checks: toJsonValue(result.checks),
    warnings: [...result.warnings],
    manifestWritten: result.manifestWritten,
    ...(result.manifest ? { manifest: toJsonValue(result.manifest) } : {}),
    ...(applied ? { applied: toJsonValue(applied) } : {}),
  };
}

async function uninstallPlatformTool(args: JsonObject): Promise<JsonObject> {
  const root = await readMcpPlatformRoot(args);
  const apply = readApply(args);
  const manifestFile = readOptionalString(args.manifestFile, "manifestFile");
  const manifest = await readInstallManifest({ projectRoot: root, manifestFile });
  const removed = apply
    ? await removePlatformConfig(manifest.target, manifest.expectedPaths.platformDirectory)
    : undefined;

  return {
    apply,
    dryRun: !apply,
    target: manifest.target,
    root,
    projectRoot: manifest.expectedPaths.projectRoot,
    platformDirectory: manifest.expectedPaths.platformDirectory,
    hooksDirectory: manifest.expectedPaths.hooksDirectory,
    manifestFile: manifest.expectedPaths.manifestFile,
    hooksPlanned: countSupportedManifestHooks(manifest),
    hooksRemoved: removed?.hooksRemoved ?? 0,
    manifestRetained: true,
    ...(removed ? { removed: toJsonValue(removed) } : {}),
  };
}

async function repairPlatformTool(args: JsonObject): Promise<JsonObject> {
  const root = await readMcpPlatformRoot(args);
  const apply = readApply(args);
  const manifestFile = readOptionalString(args.manifestFile, "manifestFile");
  const manifest = await readInstallManifest({ projectRoot: root, manifestFile });
  const applied = apply
    ? await applyPlatformConfig(manifest.target, manifest.expectedPaths.platformDirectory)
    : undefined;

  return {
    apply,
    dryRun: !apply,
    target: manifest.target,
    root,
    projectRoot: manifest.expectedPaths.projectRoot,
    platformDirectory: manifest.expectedPaths.platformDirectory,
    hooksDirectory: manifest.expectedPaths.hooksDirectory,
    manifestFile: manifest.expectedPaths.manifestFile,
    hooksPlanned: countSupportedManifestHooks(manifest),
    hooksAdded: applied?.hooksAdded ?? 0,
    ...(applied ? { applied: toJsonValue(applied) } : {}),
  };
}

async function applyLifecycleTool(args: JsonObject): Promise<JsonObject> {
  const target = readArtifactInstallTarget(args.target);
  const kind = readArtifactInstallKind(args.kind);
  const root = await readMcpInstallRoot(args);
  const apply = readApply(args);
  const result = await applyRuntimeLifecycle({
    projectRoot: root,
    target,
    kind,
    apply,
    writeManifests: readLifecycleWriteManifests(args, apply),
    platform: {
      apply: applyPlatformConfig,
    },
  });

  return toJsonValue(result) as JsonObject;
}

async function uninstallLifecycleTool(args: JsonObject): Promise<JsonObject> {
  const root = await readMcpInstallRoot(args);
  const apply = readApply(args);
  const result = await uninstallRuntimeLifecycle({
    projectRoot: root,
    apply,
    platformManifestFile: readOptionalString(args.platformManifestFile, "platformManifestFile"),
    artifactManifestFile: readOptionalString(args.artifactManifestFile, "artifactManifestFile"),
    platform: {
      remove: removePlatformConfig,
    },
  });

  return toJsonValue(result) as JsonObject;
}

async function repairLifecycleTool(args: JsonObject): Promise<JsonObject> {
  const kind = readArtifactInstallKind(args.kind);
  const root = await readMcpInstallRoot(args);
  const apply = readApply(args);
  const result = await repairRuntimeLifecycle({
    projectRoot: root,
    kind,
    apply,
    writeManifests: readLifecycleWriteManifests(args, apply),
    manifestFile: readOptionalString(args.manifestFile, "manifestFile"),
    platform: {
      apply: applyPlatformConfig,
    },
  });

  return toJsonValue(result) as JsonObject;
}

async function applyPlatformConfig(
  target: InstallTarget,
  platformDirectory: string,
): Promise<
  | { target: "codex"; configFile: string; hooksAdded: number; featureFlagAdded: boolean }
  | { target: "claude"; settingsFile: string; hooksAdded: number }
  | { target: "hermes"; configFile: string; hooksAdded: number; pluginAdded: boolean }
> {
  if (target === "codex") {
    return applyCodexHookConfig({ root: platformDirectory });
  }

  if (target === "claude") {
    return applyClaudeSettings({ root: platformDirectory });
  }

  return applyHermesHookConfig({ root: platformDirectory });
}

async function removePlatformConfig(
  target: InstallTarget,
  platformDirectory: string,
): Promise<
  | { target: "codex"; configFile: string; hooksRemoved: number }
  | { target: "claude"; settingsFile: string; hooksRemoved: number }
  | { target: "hermes"; configFile: string; hooksRemoved: number; pluginRemoved: boolean }
> {
  if (target === "codex") {
    return removeCodexHookConfig({ root: platformDirectory });
  }

  if (target === "claude") {
    return removeClaudeSettings({ root: platformDirectory });
  }

  return removeHermesHookConfig({ root: platformDirectory });
}

function countSupportedManifestHooks(manifest: InstallManifest): number {
  return manifest.plannedActions.filter(
    (action) => action.kind === "register_hook" && action.supported !== false,
  ).length;
}

async function rollbackArtifactsTool(args: JsonObject): Promise<JsonObject> {
  const root = await readMcpInstallRoot(args);
  const apply = readApply(args);
  const manifestFile = readOptionalString(args.manifestFile, "manifestFile");
  const result = await rollbackCatalogArtifacts({
    projectRoot: root,
    manifestFile,
    dryRun: !apply,
  });
  const deletedPaths = result.deletedPaths ?? [];
  const restoredPaths = result.restoredPaths ?? [];

  return {
    apply,
    dryRun: !apply,
    root,
    projectRoot: result.projectRoot,
    target: result.target,
    platformDirectory: result.platformDirectory,
    manifestFile: result.manifestFile,
    actions: toJsonValue(result.actions),
    blockers: toJsonValue(result.blockers),
    artifactsPlanned: result.actions.length,
    actionsPlanned: result.actions.length,
    artifactsDeleted: deletedPaths.length,
    artifactsRestored: restoredPaths.length,
    deletedPaths: [...deletedPaths],
    restoredPaths: [...restoredPaths],
  };
}

function readEvidenceKey(value: unknown): EvidenceKey {
  if (value === undefined) {
    return DEFAULT_EVIDENCE_KEY;
  }

  if (typeof value === "string" && EVIDENCE_KEYS.includes(value as EvidenceKey)) {
    return value as EvidenceKey;
  }

  throw new Error(`Invalid evidence key: ${String(value)}`);
}

async function logEvent(args: JsonObject): Promise<JsonObject> {
  const projectRoot = await readMcpProjectRoot(args, "MCP project root");
  const eventType = readRequiredString(args.type, "type");

  if (eventType === "GATE_EVALUATED" || eventType === "RUN_CLOSED") {
    throw new Error(`${eventType} is policy-significant and must be produced by core services`);
  }

  const event: {
    id: string;
    ts: string;
    type: string;
    gateType?: GateType;
    decision?: GateDecision;
    reason?: string;
    payload: JsonObject;
  } = {
    id: `evt_${Date.now()}`,
    ts: new Date().toISOString(),
    type: eventType,
    payload: redactJsonObject(readOptionalJsonObject(args.payload, "payload")) as JsonObject,
  };

  if (args.gateType !== undefined) {
    event.gateType = readGateType(args.gateType);
  }

  if (args.decision !== undefined) {
    event.decision = readGateDecision(args.decision);
  }

  if (args.reason !== undefined) {
    event.reason = redactSecrets(readRequiredString(args.reason, "reason"));
  }

  const runSet = await appendRunEvent(projectRoot, event);

  return {
    logged: true,
    runId: runSet.runId,
    event,
  };
}

function readMacroCycle(value: unknown): (typeof MACRO_CYCLES)[number] {
  if (typeof value === "string" && MACRO_CYCLES.includes(value as (typeof MACRO_CYCLES)[number])) {
    return value as (typeof MACRO_CYCLES)[number];
  }

  throw new Error(`Invalid targetPhase: ${String(value)}`);
}

function readSubPhase(value: unknown): (typeof SUB_PHASES)[number] {
  if (typeof value === "string" && SUB_PHASES.includes(value as (typeof SUB_PHASES)[number])) {
    return value as (typeof SUB_PHASES)[number];
  }

  throw new Error(`Invalid targetSubPhase: ${String(value)}`);
}

function readOperatingMode(value: unknown): (typeof OPERATING_MODES)[number] {
  if (
    typeof value === "string" &&
    OPERATING_MODES.includes(value as (typeof OPERATING_MODES)[number])
  ) {
    return value as (typeof OPERATING_MODES)[number];
  }

  throw new Error(`Invalid mode: ${String(value)}`);
}

function readRiskClass(value: unknown): (typeof RISK_CLASSES)[number] {
  if (typeof value === "string" && RISK_CLASSES.includes(value as (typeof RISK_CLASSES)[number])) {
    return value as (typeof RISK_CLASSES)[number];
  }

  throw new Error(`Invalid riskClass: ${String(value)}`);
}

function readChangeType(value: unknown): Changeset["changeType"] {
  if (typeof value === "string" && CHANGE_TYPES.includes(value as Changeset["changeType"])) {
    return value as Changeset["changeType"];
  }

  throw new Error(`Invalid changeType: ${String(value)}`);
}

function readStringArray(value: unknown, fieldName: string): string[] {
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value;
  }

  throw new Error(`${fieldName} must be an array of strings`);
}

function readOptionalStringArray(value: unknown, fieldName: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readStringArray(value, fieldName);
}

function readOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  throw new Error(`${fieldName} must be a string`);
}

function readOptionalNumber(value: unknown, fieldName: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  throw new Error(`${fieldName} must be a finite number`);
}

function readOptionalEstimate(value: unknown, fieldName: string): 1 | 2 | 3 | 4 | 5 | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) {
    return value;
  }

  throw new Error(`${fieldName} must be an integer from 1 to 5`);
}

function readOptionalBoolean(value: unknown, fieldName: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  throw new Error(`${fieldName} must be a boolean`);
}

function readOptionalRuntimeCapabilityStatus(
  value: unknown,
  fieldName: string,
): RuntimeCapabilityStatus | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value === "string" &&
    RUNTIME_CAPABILITY_STATUSES.includes(value as RuntimeCapabilityStatus)
  ) {
    return value as RuntimeCapabilityStatus;
  }

  throw new Error(`${fieldName} must be a runtime capability status`);
}

function readOptionalRuntimeHooks(
  value: unknown,
  fieldName: string,
): Partial<Record<GateType, RuntimeHookCapabilityInput>> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isJsonObject(value)) {
    throw new Error(`${fieldName} must be an object keyed by gate type`);
  }

  return Object.fromEntries(
    Object.entries(value).map(([gateType, hook]) => [
      readGateType(gateType),
      readRuntimeHookCapabilityInput(hook, `${fieldName}.${gateType}`),
    ]),
  ) as Partial<Record<GateType, RuntimeHookCapabilityInput>>;
}

function readRuntimeHookCapabilityInput(
  value: unknown,
  fieldName: string,
): RuntimeHookCapabilityInput {
  if (!isJsonObject(value)) {
    throw new Error(`${fieldName} must be an object`);
  }

  const hook: RuntimeHookCapabilityInput = {};

  if (value.nativeEvent !== undefined) {
    hook.nativeEvent =
      value.nativeEvent === null
        ? null
        : readRequiredString(value.nativeEvent, `${fieldName}.nativeEvent`);
  }

  if (value.canBlock !== undefined) {
    hook.canBlock = readOptionalBoolean(value.canBlock, `${fieldName}.canBlock`);
  }

  if (value.status !== undefined) {
    hook.status = readOptionalRuntimeCapabilityStatus(value.status, `${fieldName}.status`);
  }

  if (value.configDigest !== undefined) {
    hook.configDigest = readRequiredString(value.configDigest, `${fieldName}.configDigest`);
  }

  if (value.proofs !== undefined) {
    hook.proofs = readRuntimeProbeEvidenceArray(value.proofs, `${fieldName}.proofs`);
  }

  if (value.notes !== undefined) {
    hook.notes = readStringArray(value.notes, `${fieldName}.notes`);
  }

  return hook;
}

function readRuntimeProbeEvidenceArray(value: unknown, fieldName: string): RuntimeProbeEvidence[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }

  return value.map((item, index) => readRuntimeProbeEvidence(item, `${fieldName}.${index}`));
}

function readRuntimeProbeEvidence(value: unknown, fieldName: string): RuntimeProbeEvidence {
  if (!isJsonObject(value)) {
    throw new Error(`${fieldName} must be an object`);
  }

  const proof: RuntimeProbeEvidence = {
    type: readRuntimeProofType(value.type, `${fieldName}.type`),
    status: readRequiredEvidenceStatus(value.status, `${fieldName}.status`),
  };

  if (value.observedAt !== undefined) {
    proof.observedAt = readRequiredString(value.observedAt, `${fieldName}.observedAt`);
  }

  if (value.detail !== undefined) {
    proof.detail = readRequiredString(value.detail, `${fieldName}.detail`);
  }

  return proof;
}

function readRuntimeProofType(value: unknown, fieldName: string): RuntimeProofType {
  if (typeof value === "string" && RUNTIME_PROOF_TYPES.includes(value as RuntimeProofType)) {
    return value as RuntimeProofType;
  }

  throw new Error(`${fieldName} must be a runtime proof type`);
}

function readOptionalHookDigestRecord(
  value: unknown,
  fieldName: string,
): Partial<Record<GateType, string>> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isJsonObject(value)) {
    throw new Error(`${fieldName} must be an object keyed by gate type`);
  }

  return Object.fromEntries(
    Object.entries(value).map(([gateType, digest]) => [
      readGateType(gateType),
      readRequiredString(digest, `${fieldName}.${gateType}`),
    ]),
  ) as Partial<Record<GateType, string>>;
}

function readToolCall(params: unknown): { name: string; arguments: JsonObject } {
  if (!isJsonObject(params) || typeof params.name !== "string") {
    throw new Error("tools/call params must include a string name");
  }

  if (params.arguments !== undefined && !isJsonObject(params.arguments)) {
    throw new Error("tools/call arguments must be an object when provided");
  }

  return {
    name: params.name,
    arguments: params.arguments ?? {},
  };
}

function readOptionalJsonObject(value: unknown, fieldName: string): JsonObject {
  if (value === undefined) {
    return {};
  }

  if (isJsonObject(value)) {
    return value;
  }

  throw new Error(`${fieldName} must be an object when provided`);
}

function readRoot(args: JsonObject): string {
  return typeof args.root === "string" && args.root.length > 0 ? args.root : process.cwd();
}

async function readArtifactBaseDir(args: JsonObject): Promise<{ root: string; baseDir: string }> {
  const root = await readMcpProjectRoot(args, "MCP artifact root");
  const baseDirInput =
    typeof args.baseDir === "string" && args.baseDir.length > 0 ? args.baseDir : root;
  const baseDir = await resolvePathUnderRealRoot(root, path.resolve(baseDirInput));

  assertPathInside(root, baseDir, "Artifact baseDir");

  return { root, baseDir };
}

async function readMcpInstallRoot(args: JsonObject): Promise<string> {
  return readMcpProjectRoot(args, "MCP install root");
}

async function readMcpPlatformRoot(args: JsonObject): Promise<string> {
  return readMcpProjectRoot(args, "MCP platform root");
}

async function readMcpProjectRoot(args: JsonObject, label: string): Promise<string> {
  const serverRoot = await ensureRealDirectory(process.cwd());
  const requestedRoot = await ensureRealDirectory(path.resolve(readRoot(args)));

  assertPathInside(serverRoot, requestedRoot, label);

  return requestedRoot;
}

function readApply(args: JsonObject): boolean {
  if (args.apply === undefined) {
    return false;
  }

  if (typeof args.apply === "boolean") {
    return args.apply;
  }

  throw new Error("apply must be a boolean");
}

function readWriteManifest(args: JsonObject): boolean {
  if (args.writeManifest === undefined) {
    return false;
  }

  if (typeof args.writeManifest === "boolean") {
    return args.writeManifest;
  }

  throw new Error("writeManifest must be a boolean");
}

function readCaptureRestoreSnapshots(args: JsonObject): boolean {
  if (args.captureRestoreSnapshots === undefined) {
    return false;
  }

  if (typeof args.captureRestoreSnapshots === "boolean") {
    return args.captureRestoreSnapshots;
  }

  throw new Error("captureRestoreSnapshots must be a boolean");
}

function readLifecycleWriteManifests(args: JsonObject, apply: boolean): boolean | undefined {
  if (args.writeManifests === undefined) {
    return undefined;
  }

  if (typeof args.writeManifests !== "boolean") {
    throw new Error("writeManifests must be a boolean");
  }

  if (args.writeManifests && !apply) {
    throw new Error("writeManifests requires apply:true for lifecycle operations.");
  }

  return args.writeManifests;
}

function readArtifactToolKind(value: unknown): CatalogArtifactSelection {
  if (value === undefined) {
    return "all";
  }

  if (
    typeof value === "string" &&
    MCP_ARTIFACT_SELECTIONS.includes(value as McpArtifactSelection)
  ) {
    return toCoreArtifactSelection(value as McpArtifactSelection);
  }

  throw new Error(`Invalid artifact kind: ${String(value)}`);
}

function readArtifactInstallKind(value: unknown): ArtifactInstallSelection {
  if (value === undefined) {
    return "all";
  }

  if (
    typeof value === "string" &&
    MCP_ARTIFACT_SELECTIONS.includes(value as McpArtifactSelection)
  ) {
    return toCoreArtifactSelection(value as McpArtifactSelection);
  }

  throw new Error(`Invalid artifact install kind: ${String(value)}`);
}

function readArtifactInstallTarget(value: unknown): ArtifactInstallTarget {
  if (
    typeof value === "string" &&
    ARTIFACT_INSTALL_TARGETS.includes(value as ArtifactInstallTarget)
  ) {
    return value as ArtifactInstallTarget;
  }

  throw new Error(`Invalid artifact install target: ${String(value)}`);
}

function readInstallTarget(value: unknown): InstallTarget {
  if (typeof value === "string" && INSTALL_TARGETS.includes(value as InstallTarget)) {
    return value as InstallTarget;
  }

  throw new Error(`Invalid install target: ${String(value)}`);
}

function readProtocolVersion(params: unknown): string {
  if (isJsonObject(params) && typeof params.protocolVersion === "string") {
    return params.protocolVersion;
  }

  return "2025-06-18";
}

function readGateType(value: unknown): GateType {
  if (typeof value === "string" && GATE_TYPES.includes(value as GateType)) {
    return value as GateType;
  }

  throw new Error(`Invalid gateType: ${String(value)}`);
}

function readGateDecision(value: unknown): GateDecision {
  if (typeof value === "string" && GATE_DECISIONS.includes(value as GateDecision)) {
    return value as GateDecision;
  }

  throw new Error(`Invalid decision: ${String(value)}`);
}

function readEvidenceStatus(value: unknown): EvidenceStatus {
  if (value === undefined) {
    return DEFAULT_EVIDENCE_STATUS;
  }

  return readRequiredEvidenceStatus(value, "status");
}

function readRequiredEvidenceStatus(value: unknown, fieldName: string): EvidenceStatus {
  if (typeof value === "string" && EVIDENCE_STATUSES.includes(value as EvidenceStatus)) {
    return value as EvidenceStatus;
  }

  throw new Error(`${fieldName} must be an evidence status`);
}

function readRequiredString(value: unknown, fieldName: string): string {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  throw new Error(`${fieldName} must be a non-empty string`);
}

function toolResult(data: JsonValue, isError = false): JsonObject {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
    structuredContent: data,
    isError,
  };
}

function successResponse(id: RequestId, result: JsonValue): JsonObject {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

function errorResponse(id: RequestId, code: number, message: string, data?: string): JsonObject {
  return {
    jsonrpc: "2.0",
    id,
    error: data ? { code, message, data } : { code, message },
  };
}

function writeResponse(response: JsonValue): void {
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

function isRequest(value: unknown): value is JsonRpcRequest {
  return (
    isJsonObject(value) &&
    value.jsonrpc === "2.0" &&
    typeof value.method === "string" &&
    (value.id === undefined ||
      value.id === null ||
      typeof value.id === "string" ||
      typeof value.id === "number")
  );
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function objectSchema(properties: JsonObject, required: string[] = []): JsonObject {
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

function gateInputSchema(): JsonObject {
  return objectSchema(
    {
      root: stringProperty(
        "Project root. Defaults to the MCP server working directory and must stay under it.",
      ),
      gateType: {
        type: "string",
        enum: [...GATE_TYPES],
        description: "Canonical GateType to evaluate.",
      },
      payload: {
        type: "object",
        description: "Gate payload passed to @harness/core.",
        additionalProperties: true,
      },
      dryRun: {
        type: "boolean",
        description: "Evaluate without appending a run event.",
        default: false,
      },
    },
    ["gateType"],
  );
}

function runtimeDigestInputSchema(): JsonObject {
  return objectSchema(
    {
      target: stringProperty("Runtime target, for example codex, claude, or hermes."),
      gateType: {
        type: "string",
        enum: [...GATE_TYPES],
        description: "Optional canonical gate for a hook-level digest.",
      },
    },
    ["target"],
  );
}

function closeRunInputSchema(): JsonObject {
  return objectSchema({
    root: stringProperty(
      "Project root. Defaults to the MCP server working directory and must stay under it.",
    ),
    closedAt: stringProperty("Optional close timestamp."),
    eventId: stringProperty("Optional close event id."),
  });
}

function enterDevelopmentInputSchema(): JsonObject {
  return objectSchema({
    root: stringProperty(
      "Project root. Defaults to the MCP server working directory and must stay under it.",
    ),
    phase: {
      type: "string",
      enum: [...MACRO_CYCLES],
      description: "Target macro-cycle. Defaults to build.",
      default: "build",
    },
    subPhase: {
      type: "string",
      enum: [...SUB_PHASES],
      description: "Target subphase. Defaults to Execute.",
      default: "Execute",
    },
    mode: {
      type: "string",
      enum: [...OPERATING_MODES],
      description: "Operating mode. Defaults to auto.",
      default: "auto",
    },
    riskClass: {
      type: "string",
      enum: [...RISK_CLASSES],
      description: "Effective T/L/M/H/C risk class. Defaults to current risk.",
    },
    objective: stringProperty("Short objective for the governed development session."),
    rawPrompt: stringProperty("Raw user prompt or intent summary."),
    reason: stringProperty("Reason recorded in the state event log."),
  });
}

function runtimeInspectInputSchema(): JsonObject {
  return objectSchema(
    {
      root: stringProperty(
        "Project root. Defaults to the MCP server working directory and must stay under it.",
      ),
      target: stringProperty("Runtime target, for example codex, claude, or hermes."),
      inspectedAt: stringProperty("Optional inspection timestamp."),
      runtimeName: stringProperty("Optional runtime display name."),
      runtimeVersion: stringProperty("Optional runtime profile version bound to trusted proofs."),
      status: runtimeCapabilityStatusProperty("Optional runtime capability status."),
      configDigest: stringProperty("Optional observed runtime config content digest."),
      hooks: runtimeHooksProperty("Optional runtime hook capability overrides keyed by gate type."),
      knownLimitations: arrayProperty("string", "Optional runtime limitations."),
    },
    ["target"],
  );
}

function evidenceInputSchema(): JsonObject {
  return objectSchema(
    {
      root: stringProperty(
        "Project root. Defaults to the MCP server working directory and must stay under it.",
      ),
      key: {
        type: "string",
        enum: [...EVIDENCE_KEYS],
        description: "Canonical evidence key.",
        default: DEFAULT_EVIDENCE_KEY,
      },
      kind: stringProperty("Evidence kind, for example command_output, review, or custom."),
      summary: stringProperty("Human-readable evidence summary."),
      status: {
        type: "string",
        enum: [...EVIDENCE_STATUSES],
        description: "Evidence acceptance status.",
        default: DEFAULT_EVIDENCE_STATUS,
      },
    },
    ["summary"],
  );
}

function generateArtifactsInputSchema(): JsonObject {
  return objectSchema({
    root: stringProperty(
      "Project root. Defaults to the MCP server working directory and must stay under it.",
    ),
    baseDir: stringProperty(
      "Artifact output base directory. Defaults to root and must stay inside root.",
    ),
    kind: {
      type: "string",
      enum: [...MCP_ARTIFACT_SELECTIONS],
      description: "Artifact kind to generate.",
      default: "all",
    },
    apply: {
      type: "boolean",
      description: "Write artifacts when true. Defaults to dry-run.",
      default: false,
    },
  });
}

function installArtifactsInputSchema(): JsonObject {
  return objectSchema(
    {
      root: stringProperty(
        "Project root. Defaults to the MCP server working directory and must stay under it.",
      ),
      target: {
        type: "string",
        enum: [...ARTIFACT_INSTALL_TARGETS],
        description: "Runtime install target.",
      },
      kind: {
        type: "string",
        enum: [...MCP_ARTIFACT_SELECTIONS],
        description: "Artifact kind to install.",
        default: "all",
      },
      apply: {
        type: "boolean",
        description: "Write artifacts when true. Defaults to dry-run.",
        default: false,
      },
      writeManifest: {
        type: "boolean",
        description: "Write .planning/artifact-install-manifest.json during apply.",
        default: false,
      },
      captureRestoreSnapshots: {
        type: "boolean",
        description:
          "Store previous managed artifact content in the manifest for automatic rollback restore.",
        default: false,
      },
    },
    ["target"],
  );
}

function platformInstallInputSchema(): JsonObject {
  return objectSchema(
    {
      root: stringProperty(
        "Project root. Defaults to the MCP server working directory and must stay under it.",
      ),
      target: {
        type: "string",
        enum: [...INSTALL_TARGETS],
        description: "Runtime platform install target.",
      },
      apply: {
        type: "boolean",
        description: "Apply target adapter hook config when true. Defaults to dry-run.",
        default: false,
      },
      writeManifest: {
        type: "boolean",
        description: "Write .planning/install-manifest.json.",
        default: false,
      },
    },
    ["target"],
  );
}

function platformLifecycleInputSchema(): JsonObject {
  return objectSchema({
    root: stringProperty(
      "Project root. Defaults to the MCP server working directory and must stay under it.",
    ),
    manifestFile: stringProperty("Optional platform install manifest file."),
    apply: {
      type: "boolean",
      description: "Mutate managed platform hook config when true. Defaults to dry-run.",
      default: false,
    },
  });
}

function lifecycleApplyInputSchema(): JsonObject {
  return objectSchema(
    {
      root: stringProperty(
        "Project root. Defaults to the MCP server working directory and must stay under it.",
      ),
      target: {
        type: "string",
        enum: [...ARTIFACT_INSTALL_TARGETS],
        description: "Runtime lifecycle target.",
      },
      kind: {
        type: "string",
        enum: [...MCP_ARTIFACT_SELECTIONS],
        description: "Artifact kind to install.",
        default: "all",
      },
      apply: {
        type: "boolean",
        description: "Write platform hooks, artifacts, and lifecycle manifests when true.",
        default: false,
      },
      writeManifests: {
        type: "boolean",
        description: "Write lifecycle manifests during apply. Defaults to apply:true.",
      },
    },
    ["target"],
  );
}

function lifecycleRepairInputSchema(): JsonObject {
  return objectSchema({
    root: stringProperty(
      "Project root. Defaults to the MCP server working directory and must stay under it.",
    ),
    kind: {
      type: "string",
      enum: [...MCP_ARTIFACT_SELECTIONS],
      description: "Artifact kind to repair.",
      default: "all",
    },
    manifestFile: stringProperty("Optional platform install manifest file."),
    apply: {
      type: "boolean",
      description: "Re-apply platform hooks, artifacts, and lifecycle manifests when true.",
      default: false,
    },
    writeManifests: {
      type: "boolean",
      description: "Write lifecycle manifests during apply. Defaults to apply:true.",
    },
  });
}

function lifecycleUninstallInputSchema(): JsonObject {
  return objectSchema({
    root: stringProperty(
      "Project root. Defaults to the MCP server working directory and must stay under it.",
    ),
    platformManifestFile: stringProperty("Optional platform install manifest file."),
    artifactManifestFile: stringProperty("Optional artifact install manifest file."),
    apply: {
      type: "boolean",
      description: "Rollback artifacts and remove managed platform hooks when true.",
      default: false,
    },
  });
}

function rollbackArtifactsInputSchema(): JsonObject {
  return objectSchema({
    root: stringProperty(
      "Project root. Defaults to the MCP server working directory and must stay under it.",
    ),
    manifestFile: stringProperty("Optional artifact install manifest file."),
    apply: {
      type: "boolean",
      description: "Delete rollbackable artifacts when true. Defaults to dry-run.",
      default: false,
    },
  });
}

function stringProperty(description: string): JsonObject {
  return {
    type: "string",
    description,
  };
}

function numberProperty(description: string): JsonObject {
  return {
    type: "number",
    description,
  };
}

function arrayProperty(itemType: string, description: string): JsonObject {
  return {
    type: "array",
    items: { type: itemType },
    description,
  };
}

function hookDigestRecordProperty(description: string): JsonObject {
  return {
    type: "object",
    properties: Object.fromEntries(
      GATE_TYPES.map((gateType) => [gateType, stringProperty(`${gateType} digest.`)]),
    ),
    additionalProperties: false,
    description,
  };
}

function runtimeHooksProperty(description: string): JsonObject {
  return {
    type: "object",
    properties: Object.fromEntries(
      GATE_TYPES.map((gateType) => [
        gateType,
        objectSchema({
          nativeEvent: {
            type: ["string", "null"],
            description: "Native runtime event for this gate.",
          },
          canBlock: {
            type: "boolean",
            description: "Whether the native event can block execution.",
          },
          status: runtimeCapabilityStatusProperty("Hook capability status."),
          configDigest: stringProperty("Optional hook config digest."),
          proofs: {
            type: "array",
            description: "Executable runtime probe evidence for this hook.",
            items: objectSchema(
              {
                type: {
                  type: "string",
                  enum: [...RUNTIME_PROOF_TYPES],
                  description: "Runtime proof type.",
                },
                status: {
                  type: "string",
                  enum: [...EVIDENCE_STATUSES],
                  description: "Proof acceptance status.",
                },
                observedAt: stringProperty("Optional proof observation timestamp."),
                detail: stringProperty("Optional proof detail."),
                verifier: stringProperty("Trusted proof verifier. External values are downgraded."),
                target: stringProperty("Runtime target bound to a trusted proof."),
                runtimeVersion: stringProperty("Runtime profile version bound to a trusted proof."),
                gateType: {
                  type: "string",
                  enum: [...GATE_TYPES],
                  description: "GateType bound to a trusted proof.",
                },
                configDigest: stringProperty("Runtime config digest bound to a trusted proof."),
                result: stringProperty("Verifier result bound to a trusted proof."),
                proofDigest: stringProperty("Verifier digest over the trusted proof payload."),
              },
              ["type", "status"],
            ),
          },
          notes: arrayProperty("string", "Optional hook notes."),
        }),
      ]),
    ),
    additionalProperties: false,
    description,
  };
}

function runtimeProbeInputSchema(): JsonObject {
  return objectSchema(
    {
      root: stringProperty(
        "Project root. Defaults to the MCP server working directory and must stay under it.",
      ),
      target: stringProperty("Runtime target, for example codex, claude, or hermes."),
      bind: {
        type: "boolean",
        description: "Bind runtime gates immediately after probing.",
        default: false,
      },
      verifyBlockingFixtures: {
        type: "boolean",
        description: "Execute managed blocking fixtures before minting trusted blocking proofs.",
        default: false,
      },
    },
    ["target"],
  );
}

function runtimeCapabilityStatusProperty(description: string): JsonObject {
  return {
    type: "string",
    enum: [...RUNTIME_CAPABILITY_STATUSES],
    description,
    default: DEFAULT_RUNTIME_CAPABILITY_STATUS,
  };
}

function estimateProperty(description: string): JsonObject {
  return {
    type: "integer",
    enum: [1, 2, 3, 4, 5],
    description,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function ensureRealDirectory(directory: string): Promise<string> {
  try {
    return await realpath(directory);
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      throw new Error(`Directory must exist: ${directory}`);
    }

    throw error;
  }
}

async function resolvePathUnderRealRoot(realRoot: string, targetPath: string): Promise<string> {
  let currentPath = targetPath;
  const missingSegments: string[] = [];

  while (true) {
    try {
      const realExistingPath = await realpath(currentPath);
      assertPathInside(realRoot, realExistingPath, "Artifact baseDir");

      return path.resolve(realExistingPath, ...missingSegments.reverse());
    } catch (error) {
      if (!isNodeErrorWithCode(error, "ENOENT")) {
        throw error;
      }

      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) {
        throw new Error(`No existing parent directory for: ${targetPath}`);
      }

      missingSegments.push(path.basename(currentPath));
      currentPath = parentPath;
    }
  }
}

function assertPathInside(root: string, targetPath: string, label: string): void {
  const relativeTarget = path.relative(root, targetPath);

  if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
    throw new Error(`${label} must stay inside the project root.`);
  }
}

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === code
  );
}

function toJsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function toCoreArtifactSelection(selection: McpArtifactSelection): ArtifactInstallSelection {
  return selection;
}

function toArtifactSummary(artifact: CatalogArtifactDescriptor): JsonObject {
  return {
    kind: artifact.kind,
    id: artifact.id,
    title: artifact.title,
    relativePath: artifact.relativePath,
  };
}

function redactJsonObject(value: JsonObject): JsonObject {
  return redactRecord(value) as JsonObject;
}

function isDirectExecution(): boolean {
  const entrypoint = process.argv[1];

  return entrypoint !== undefined && import.meta.url === pathToFileURL(entrypoint).href;
}
