#!/usr/bin/env node
import { realpath } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";
import {
  ARTIFACT_INSTALL_SELECTIONS,
  ARTIFACT_INSTALL_TARGETS,
  type ArtifactInstallSelection,
  type ArtifactInstallTarget,
  addEvidence,
  appendRunEvent,
  bindRuntime,
  CATALOG_ARTIFACT_SELECTIONS,
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
  evaluateConvergence,
  GATE_DECISIONS,
  GATE_TYPES,
  type GateDecision,
  type GateType,
  getOperationalCatalog,
  getStatus,
  handleHook,
  inspectRuntime,
  installCatalogArtifacts,
  MACRO_CYCLES,
  planArtifactInstall,
  planCatalogArtifacts,
  RUNTIME_CAPABILITY_STATUSES,
  type RuntimeCapabilityStatus,
  type RuntimeHookCapabilityInput,
  readPlanningProject,
  requestTransition,
  SUB_PHASES,
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

const SERVER_INFO = {
  name: "harness-mcp-server",
  version: "0.0.0",
};
const SECRET_KEY_PATTERN = /api[_-]?key|apikey|token|password|secret/i;
const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "rms.get_state",
    description: "Read the current RMS planning state from the project .planning files.",
    inputSchema: objectSchema({
      root: stringProperty("Project root. Defaults to the MCP server working directory."),
    }),
  },
  {
    name: "rms.transition",
    description: "Request an RMS planning transition through @harness/core requestTransition().",
    inputSchema: objectSchema({
      root: stringProperty("Project root. Defaults to the MCP server working directory."),
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
        root: stringProperty("Project root. Defaults to the MCP server working directory."),
        target: stringProperty("Runtime target, for example codex, claude, or hermes."),
        inspectedAt: stringProperty("Optional binding timestamp."),
        expectedDigest: stringProperty("Optional expected runtime profile digest."),
        currentDigest: stringProperty("Optional current runtime profile digest."),
        expectedHookDigests: hookDigestRecordProperty(
          "Optional expected per-gate runtime digests.",
        ),
        currentHookDigests: hookDigestRecordProperty("Optional current per-gate runtime digests."),
      },
      ["target"],
    ),
  },
  {
    name: "rms.get_catalog",
    description: "Read the operational catalog exposed by @harness/core.",
    inputSchema: objectSchema({}),
  },
  {
    name: "rms.generate_artifacts",
    description:
      "Generate catalog-driven skill, book, and subagent artifacts. Defaults to dry-run; set apply:true to write.",
    inputSchema: generateArtifactsInputSchema(),
  },
  {
    name: "rms.install_artifacts",
    description:
      "Install catalog-driven skill, book, and subagent artifacts. Defaults to dry-run; set apply:true to write.",
    inputSchema: installArtifactsInputSchema(),
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
      root: stringProperty("Project root. Defaults to the MCP server working directory."),
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
      root: stringProperty("Project root. Defaults to the MCP server working directory."),
    }),
  },
  {
    name: "harness:get_risk_class",
    description: "Read the current harness risk class from .planning/current-risk.yaml.",
    inputSchema: objectSchema({
      root: stringProperty("Project root. Defaults to the MCP server working directory."),
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
        root: stringProperty("Project root. Defaults to the MCP server working directory."),
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
    name: "harness:runtime_digest",
    description: "Legacy alias for rms.runtime_digest.",
    inputSchema: runtimeDigestInputSchema(),
  },
  {
    name: "harness:evaluate_convergence",
    description: "Legacy alias for rms.evaluate_convergence.",
    inputSchema: objectSchema({
      root: stringProperty("Project root. Defaults to the MCP server working directory."),
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
      return toJsonValue(await getStatus(readRoot(args)));
    case "harness:get_risk_class":
      return getRiskClass(readRoot(args));
    case "rms.transition":
      return transitionTool(args);
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
    case "rms.get_catalog":
    case "harness:get_catalog":
      return toJsonValue(getOperationalCatalog());
    case "rms.generate_artifacts":
    case "harness:generate_artifacts":
      return generateArtifactsTool(args);
    case "rms.install_artifacts":
    case "harness:install_artifacts":
      return installArtifactsTool(args);
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

  return toJsonValue(await requestTransition(readRoot(args), request)) as JsonObject;
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
  const payload = isJsonObject(args.payload) ? args.payload : {};
  const dryRun = typeof args.dryRun === "boolean" ? args.dryRun : false;

  return toJsonValue(await handleHook(readRoot(args), gateType, payload, { dryRun })) as JsonObject;
}

async function recordEvidence(args: JsonObject): Promise<JsonObject> {
  const projectRoot = readRoot(args);
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
    readRoot(args),
    readRequiredString(args.target, "target"),
    {
      inspectedAt: readOptionalString(args.inspectedAt, "inspectedAt"),
      runtimeName: readOptionalString(args.runtimeName, "runtimeName"),
      status: readOptionalRuntimeCapabilityStatus(args.status, "status"),
      configDigest: readOptionalString(args.configDigest, "configDigest"),
      hooks: readOptionalRuntimeHooks(args.hooks, "hooks"),
      knownLimitations: readOptionalStringArray(args.knownLimitations, "knownLimitations"),
    },
  );

  return toJsonValue(capability) as JsonObject;
}

async function bindRuntimeTool(args: JsonObject): Promise<JsonObject> {
  const bindings = await bindRuntime(readRoot(args), readRequiredString(args.target, "target"), {
    inspectedAt: readOptionalString(args.inspectedAt, "inspectedAt"),
    expectedDigest: readOptionalString(args.expectedDigest, "expectedDigest"),
    currentDigest: readOptionalString(args.currentDigest, "currentDigest"),
    expectedHookDigests: readOptionalHookDigestRecord(
      args.expectedHookDigests,
      "expectedHookDigests",
    ),
    currentHookDigests: readOptionalHookDigestRecord(args.currentHookDigests, "currentHookDigests"),
  });

  return toJsonValue(bindings) as JsonObject;
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
  const project = await readPlanningProject(readRoot(args));

  return toJsonValue(evaluateConvergence(project)) as JsonObject;
}

async function closeRunTool(args: JsonObject): Promise<JsonObject> {
  return toJsonValue(
    await closeRun(readRoot(args), {
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
  const root = await ensureRealDirectory(path.resolve(readRoot(args)));
  const apply = readApply(args);
  const installResult = apply
    ? await installCatalogArtifacts({ projectRoot: root, target, kind, dryRun: false })
    : undefined;
  const result =
    installResult ?? planArtifactInstall({ projectRoot: root, target, kind, dryRun: true });
  const writtenPaths = installResult?.writtenPaths ?? [];
  const unchangedPaths = installResult?.unchangedPaths ?? [];

  return {
    apply,
    dryRun: !apply,
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
  const projectRoot = readRoot(args);
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
    payload: isJsonObject(args.payload) ? (redactJsonObject(args.payload) as JsonObject) : {},
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

  if (value.notes !== undefined) {
    hook.notes = readStringArray(value.notes, `${fieldName}.notes`);
  }

  return hook;
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

  return {
    name: params.name,
    arguments: isJsonObject(params.arguments) ? params.arguments : {},
  };
}

function readRoot(args: JsonObject): string {
  return typeof args.root === "string" && args.root.length > 0 ? args.root : process.cwd();
}

async function readArtifactBaseDir(args: JsonObject): Promise<{ root: string; baseDir: string }> {
  const root = path.resolve(readRoot(args));
  const baseDirInput =
    typeof args.baseDir === "string" && args.baseDir.length > 0 ? args.baseDir : root;
  const realRoot = await ensureRealDirectory(root);
  const baseDir = await resolvePathUnderRealRoot(realRoot, path.resolve(baseDirInput));

  assertPathInside(realRoot, baseDir, "Artifact baseDir");

  return { root: realRoot, baseDir };
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

function readArtifactToolKind(value: unknown): CatalogArtifactSelection {
  if (value === undefined) {
    return "all";
  }

  if (
    typeof value === "string" &&
    CATALOG_ARTIFACT_SELECTIONS.includes(value as CatalogArtifactSelection)
  ) {
    return value as CatalogArtifactSelection;
  }

  throw new Error(`Invalid artifact kind: ${String(value)}`);
}

function readArtifactInstallKind(value: unknown): ArtifactInstallSelection {
  if (value === undefined) {
    return "all";
  }

  if (
    typeof value === "string" &&
    ARTIFACT_INSTALL_SELECTIONS.includes(value as ArtifactInstallSelection)
  ) {
    return value as ArtifactInstallSelection;
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

function readEvidenceStatus(value: unknown): (typeof EVIDENCE_STATUSES)[number] {
  if (value === undefined) {
    return DEFAULT_EVIDENCE_STATUS;
  }

  if (
    typeof value === "string" &&
    EVIDENCE_STATUSES.includes(value as (typeof EVIDENCE_STATUSES)[number])
  ) {
    return value as (typeof EVIDENCE_STATUSES)[number];
  }

  throw new Error(`Invalid status: ${String(value)}`);
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
      root: stringProperty("Project root. Defaults to the MCP server working directory."),
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
    root: stringProperty("Project root. Defaults to the MCP server working directory."),
    closedAt: stringProperty("Optional close timestamp."),
    eventId: stringProperty("Optional close event id."),
  });
}

function runtimeInspectInputSchema(): JsonObject {
  return objectSchema(
    {
      root: stringProperty("Project root. Defaults to the MCP server working directory."),
      target: stringProperty("Runtime target, for example codex, claude, or hermes."),
      inspectedAt: stringProperty("Optional inspection timestamp."),
      runtimeName: stringProperty("Optional runtime display name."),
      status: runtimeCapabilityStatusProperty("Optional runtime capability status."),
      configDigest: stringProperty("Optional runtime profile config digest."),
      hooks: runtimeHooksProperty("Optional runtime hook capability overrides keyed by gate type."),
      knownLimitations: arrayProperty("string", "Optional runtime limitations."),
    },
    ["target"],
  );
}

function evidenceInputSchema(): JsonObject {
  return objectSchema(
    {
      root: stringProperty("Project root. Defaults to the MCP server working directory."),
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
    root: stringProperty("Project root. Defaults to the MCP server working directory."),
    baseDir: stringProperty(
      "Artifact output base directory. Defaults to root and must stay inside root.",
    ),
    kind: {
      type: "string",
      enum: [...CATALOG_ARTIFACT_SELECTIONS],
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
      root: stringProperty("Project root. Defaults to the MCP server working directory."),
      target: {
        type: "string",
        enum: [...ARTIFACT_INSTALL_TARGETS],
        description: "Runtime install target.",
      },
      kind: {
        type: "string",
        enum: [...ARTIFACT_INSTALL_SELECTIONS],
        description: "Artifact kind to install.",
        default: "all",
      },
      apply: {
        type: "boolean",
        description: "Write artifacts when true. Defaults to dry-run.",
        default: false,
      },
    },
    ["target"],
  );
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
          notes: arrayProperty("string", "Optional hook notes."),
        }),
      ]),
    ),
    additionalProperties: false,
    description,
  };
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

function toArtifactSummary(artifact: CatalogArtifactDescriptor): JsonObject {
  return {
    kind: artifact.kind,
    id: artifact.id,
    title: artifact.title,
    relativePath: artifact.relativePath,
  };
}

function redactJsonObject(value: JsonObject): JsonObject {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, redactJsonValue(item, key)]),
  ) as JsonObject;
}

function redactJsonValue(value: JsonValue, key?: string): JsonValue {
  if (typeof value === "string") {
    if (SECRET_KEY_PATTERN.test(key ?? "")) {
      return "[REDACTED]";
    }

    return redactSecrets(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactJsonValue(item, key));
  }

  if (value && typeof value === "object") {
    return redactJsonObject(value);
  }

  return value;
}

function redactSecrets(value: string): string {
  return value
    .replace(
      /((?:api[_-]?key|token|password|secret)\s*[:=]\s*["']?)[a-z0-9_-]{8,}/gi,
      "$1[REDACTED]",
    )
    .replace(/sk-[a-z0-9]{8,}/gi, "sk-[REDACTED]")
    .replace(/ghp_[a-z0-9]{8,}/gi, "ghp_[REDACTED]");
}

function isDirectExecution(): boolean {
  const entrypoint = process.argv[1];

  return entrypoint !== undefined && import.meta.url === pathToFileURL(entrypoint).href;
}
