#!/usr/bin/env node
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { applyClaudeSettings } from "@harness/adapter-claude";
import { applyCodexHookConfig } from "@harness/adapter-codex";
import { applyHermesHookConfig } from "@harness/adapter-hermes";
import {
  type AddEvidenceInput,
  ARTIFACT_INSTALL_SELECTIONS,
  ARTIFACT_INSTALL_TARGETS,
  type ArtifactInstallSelection,
  addEvidence,
  bindRuntime,
  CATALOG_ARTIFACT_SELECTIONS,
  type CatalogArtifactSelection,
  type Changeset,
  type ClassificationResult,
  type CloseRunResult,
  CONFIDENCE_LEVELS,
  classifyRisk,
  closeRun,
  computeRuntimeProfileDigest,
  DEFAULT_CHANGE_TYPE,
  DEFAULT_CONFIDENCE_LEVEL,
  DEFAULT_EVIDENCE_STATUS,
  DEFAULT_RUNTIME_CAPABILITY_STATUS,
  DEFAULT_SUB_PHASE,
  detectPlatform,
  EVIDENCE_KEYS,
  EVIDENCE_STATUSES,
  type EvidenceItem,
  type EvidenceKey,
  evaluateConvergence,
  GATE_TYPES,
  type GateType,
  getOperationalCatalog,
  getStatus,
  type HarnessErrorCode,
  handleHook,
  INSTALL_TARGETS,
  type InstallCatalogArtifactsResult,
  type InstallPlatformResult,
  type InstallTarget,
  initProject,
  inspectRuntime,
  installCatalogArtifacts,
  installPlatform,
  MACRO_CYCLES,
  type MacroCycle,
  MISSING_RUNTIME_BINDING_STATUS,
  planArtifactInstall,
  planCatalogArtifacts,
  RUNTIME_CAPABILITY_STATUSES,
  type RuntimeBinding,
  type RuntimeCapability,
  type RuntimeCapabilityStatus,
  readPlanningProject,
  requestTransition,
  SUB_PHASES,
  type SubPhase,
  toHookCommand,
  type WriteCatalogArtifactsResult,
  writeCatalogArtifacts,
} from "@harness/core";
import { defineCommand, runMain } from "citty";

const HOOK_EVENT_TO_GATE_TYPE = Object.fromEntries(
  GATE_TYPES.flatMap((gateType) => {
    const executableEvent = toHookCommand(gateType).replace("harness hook ", "");

    return [
      [executableEvent, gateType],
      [executableEvent.replaceAll("-", "_"), gateType],
    ];
  }),
) as Record<string, GateType>;
type CheckLevel = "pass" | "warn" | "fail";
type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];
type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];
type ApplyPlatformConfigResult = Awaited<ReturnType<typeof applyPlatformConfig>>;
type CatalogArtifactsPlan = {
  ok: boolean;
  kind: CatalogArtifactSelection;
  baseDir: string;
  dryRun: boolean;
  apply: boolean;
  artifactsPlanned: number;
  artifactsWritten: readonly string[];
  artifactsUnchanged: readonly string[];
  result: ReturnType<typeof planCatalogArtifacts> | WriteCatalogArtifactsResult;
};
type InstallArtifactsPlan = {
  ok: boolean;
  target: InstallTarget;
  root: string;
  projectRoot: string;
  platformDirectory: string;
  kind: ArtifactInstallSelection;
  selection: ArtifactInstallSelection;
  dryRun: boolean;
  apply: boolean;
  artifactsPlanned: number;
  artifactsWritten: readonly string[];
  artifactsUnchanged: readonly string[];
  result: ReturnType<typeof planArtifactInstall> | InstallCatalogArtifactsResult;
};

interface DoctorCheck {
  name: string;
  level: CheckLevel;
  detail: string;
}

interface DoctorSection {
  name: string;
  checks: DoctorCheck[];
}

interface DoctorReport {
  ok: boolean;
  root: string;
  sections: DoctorSection[];
  errors: number;
  warnings: number;
}

const rootArg = {
  type: "string",
  description: "Project root",
  default: process.cwd(),
} as const;

const init = defineCommand({
  meta: {
    name: "init",
    description: "Create the three canonical .planning files",
  },
  args: {
    root: rootArg,
  },
  async run({ args }) {
    const project = await initProject(args.root);
    console.log(JSON.stringify({ ok: true, runId: project.state.run_id }, null, 2));
  },
});

const status = defineCommand({
  meta: {
    name: "status",
    description: "Show current harness state",
  },
  args: {
    root: rootArg,
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const result = await getStatus(args.root);

    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(formatStatusHuman(result));
  },
});

const convergence = defineCommand({
  meta: {
    name: "convergence",
    description: "Evaluate convergence from .planning state",
  },
  args: {
    root: rootArg,
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const project = await readPlanningProject(args.root);
    const result = evaluateConvergence(project);

    console.log(args.json ? JSON.stringify(result, null, 2) : formatConvergenceHuman(result));
  },
});

const close = defineCommand({
  meta: {
    name: "close",
    description: "Close the current run from convergence evaluation",
  },
  args: {
    root: rootArg,
    timestamp: {
      type: "string",
      description: "Close timestamp",
      required: false,
    },
    id: {
      type: "string",
      description: "Close event id",
      required: false,
    },
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const result = await closeRun(args.root, {
      closedAt: typeof args.timestamp === "string" ? args.timestamp : undefined,
      eventId: typeof args.id === "string" ? args.id : undefined,
    });

    console.log(args.json ? JSON.stringify(result, null, 2) : formatCloseRunHuman(result));
  },
});

const hook = defineCommand({
  meta: {
    name: "hook",
    description: "Evaluate a runtime hook event from JSON stdin",
  },
  args: {
    event: {
      type: "positional",
      description: "Runtime event name or canonical GateType",
      required: true,
    },
    root: rootArg,
    dryRun: {
      type: "boolean",
      description: "Evaluate without persisting an event",
      default: false,
    },
  },
  async run({ args }) {
    const gateType = parseHookEvent(args.event);
    const payload = await readJsonStdin();
    const result = await handleHook(args.root, gateType, payload, { dryRun: args.dryRun });

    console.log(JSON.stringify(result, null, 2));
  },
});

const transition = defineCommand({
  meta: {
    name: "transition",
    description: "Transition to another macro cycle and optional subphase",
  },
  args: {
    cycle: {
      type: "positional",
      description: "Target MacroCycle",
      required: true,
    },
    subPhase: {
      type: "enum",
      description: "Target SubPhase",
      options: [...SUB_PHASES],
      default: DEFAULT_SUB_PHASE,
    },
    root: rootArg,
  },
  async run({ args }) {
    const targetPhase = parseMacroCycle(args.cycle);
    const targetSubPhase = args.subPhase as SubPhase;
    const result = await requestTransition(args.root, { targetPhase, targetSubPhase });

    console.log(
      JSON.stringify(
        {
          ok: true,
          from: result.previousSnapshot.phase,
          to: result.newSnapshot.phase,
          subPhase: result.newSnapshot.sub_phase,
        },
        null,
        2,
      ),
    );
  },
});

const evidenceAdd = defineCommand({
  meta: {
    name: "add",
    description: "Append an evidence item to .planning/run-set.json",
  },
  args: {
    root: rootArg,
    key: {
      type: "enum",
      description: "Evidence key",
      options: [...EVIDENCE_KEYS],
      required: true,
    },
    kind: {
      type: "string",
      description: "Evidence kind, for example command, test, or review",
      required: true,
    },
    status: {
      type: "enum",
      description: "Evidence acceptance status",
      options: [...EVIDENCE_STATUSES],
      default: DEFAULT_EVIDENCE_STATUS,
    },
    summary: {
      type: "string",
      description: "Short evidence summary",
      required: true,
    },
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const input = parseEvidenceAddArgs(args);
    const item = await addEvidence(args.root, input);

    console.log(args.json ? JSON.stringify(item, null, 2) : formatEvidenceAddedHuman(item));
  },
});

const evidence = defineCommand({
  meta: {
    name: "evidence",
    description: "Manage harness evidence",
  },
  subCommands: {
    add: evidenceAdd,
  },
});

const riskClassify = defineCommand({
  meta: {
    name: "classify",
    description: "Classify a changeset risk level from pragmatic CLI flags",
  },
  args: {
    files: {
      type: "string",
      description: "Changed files as comma, newline, or semicolon separated paths",
      default: "",
    },
    dependency: {
      type: "boolean",
      description: "Dependency update",
      default: false,
    },
    schema: {
      type: "boolean",
      description: "Schema or database shape change",
      default: false,
    },
    auth: {
      type: "boolean",
      description: "Authentication or authorization change",
      default: false,
    },
    infra: {
      type: "boolean",
      description: "Infrastructure or production configuration change",
      default: false,
    },
    destructive: {
      type: "boolean",
      description: "Destructive or breaking change",
      default: false,
    },
    publicApi: {
      type: "boolean",
      description: "Public API contract change",
      default: false,
    },
    migration: {
      type: "boolean",
      description: "Runtime/data migration",
      default: false,
    },
    securitySensitive: {
      type: "boolean",
      description: "Security or privacy sensitive change",
      default: false,
    },
    externalIntegration: {
      type: "boolean",
      description: "External service integration change",
      default: false,
    },
    linesChanged: {
      type: "string",
      description: "Approximate net changed lines",
      default: "0",
    },
    testCoverage: {
      type: "string",
      description: "Approximate test coverage percent for the change",
      required: false,
    },
    confidence: {
      type: "enum",
      description: "Implementation confidence",
      options: [...CONFIDENCE_LEVELS],
      default: DEFAULT_CONFIDENCE_LEVEL,
    },
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  run({ args }) {
    const changeset = parseRiskClassifyArgs(args);
    const result = classifyRisk(changeset);

    console.log(args.json ? JSON.stringify(result, null, 2) : formatRiskClassHuman(result));
  },
});

const risk = defineCommand({
  meta: {
    name: "risk",
    description: "Classify and inspect harness risk",
  },
  subCommands: {
    classify: riskClassify,
  },
});

const doctor = defineCommand({
  meta: {
    name: "doctor",
    description: "Validate local harness installation and .planning state files",
  },
  args: {
    root: rootArg,
    target: {
      type: "enum",
      description: "Limit platform checks",
      options: [...INSTALL_TARGETS],
      required: false,
    },
    fix: {
      type: "boolean",
      description: "Reserved for core-backed repairs",
      default: false,
    },
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const report = await createDoctorReport(args.root, args.target as InstallTarget | undefined, {
      fix: args.fix,
    });

    if (args.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    console.log(formatDoctorHuman(report));

    if (!report.ok) {
      process.exitCode = 1;
    }
  },
});

const validate = defineCommand({
  meta: {
    name: "validate",
    description: "Machine-friendly read-only validation for project state",
  },
  args: {
    root: rootArg,
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const report = await createDoctorReport(args.root);

    if (args.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatDoctorHuman(report));
    }

    if (!report.ok) {
      process.exitCode = 1;
    }
  },
});

const install = defineCommand({
  meta: {
    name: "install",
    description: "Plan or write a safe platform install manifest",
  },
  args: {
    target: {
      type: "positional",
      description: "Target platform",
      required: true,
    },
    root: rootArg,
    dryRun: {
      type: "boolean",
      description: "Preview planned checks without writing platform files",
      default: true,
    },
    writeManifest: {
      type: "boolean",
      description: "Write only .planning/install-manifest.json",
      default: false,
    },
    apply: {
      type: "boolean",
      description: "Apply target adapter config after planning",
      default: false,
    },
    force: {
      type: "boolean",
      description: "Reserved for future platform file writes",
      default: false,
    },
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const target = parseInstallTarget(args.target);
    const result = await installPlatform({
      projectRoot: args.root,
      target,
      dryRun: args.dryRun,
      writeManifest: args.writeManifest,
    });
    const applied = args.apply
      ? await applyPlatformConfig(target, result.expectedPaths.platformDirectory)
      : undefined;

    if (args.json) {
      console.log(JSON.stringify(applied ? { install: result, applied } : result, null, 2));
    } else {
      console.log(
        applied
          ? `${formatInstallHuman(result)}\n\n${formatApplyPlatformConfigHuman(applied)}`
          : formatInstallHuman(result),
      );
    }
  },
});

const catalog = defineCommand({
  meta: {
    name: "catalog",
    description: "Inspect the operational catalog",
  },
  args: {
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  run({ args }) {
    const result = getOperationalCatalog();

    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(formatCatalogHuman(result));
  },
});

const artifacts = defineCommand({
  meta: {
    name: "artifacts",
    description: "Plan or write catalog-driven operational artifacts",
  },
  args: {
    apply: {
      type: "boolean",
      description: "Write generated artifacts",
      default: false,
    },
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
    kind: {
      type: "enum",
      description: "Artifact kind to generate",
      options: [...CATALOG_ARTIFACT_SELECTIONS],
      default: "all",
    },
    baseDir: {
      type: "string",
      description: "Base directory for generated artifacts",
      default: process.cwd(),
    },
  },
  async run({ args }) {
    const plan = await generateCatalogArtifactsPlan({
      apply: args.apply,
      baseDir: args.baseDir,
      kind: args.kind,
    });

    if (args.json) {
      console.log(JSON.stringify(plan, null, 2));
    } else {
      console.log(formatCatalogArtifactsPlanHuman(plan));
    }

    if (!plan.ok) {
      process.exitCode = 1;
    }
  },
});

const installArtifacts = defineCommand({
  meta: {
    name: "install-artifacts",
    description: "Plan or write target platform catalog artifacts",
  },
  args: {
    target: {
      type: "positional",
      description: "Target platform",
      required: true,
    },
    root: rootArg,
    kind: {
      type: "enum",
      description: "Artifact kind to install",
      options: [...ARTIFACT_INSTALL_SELECTIONS],
      default: "all",
    },
    apply: {
      type: "boolean",
      description: "Write installed artifacts",
      default: false,
    },
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const plan = await generateInstallArtifactsPlan({
      apply: args.apply,
      kind: args.kind,
      root: args.root,
      target: args.target,
    });

    if (args.json) {
      console.log(JSON.stringify(plan, null, 2));
    } else {
      console.log(formatInstallArtifactsPlanHuman(plan));
    }

    if (!plan.ok) {
      process.exitCode = 1;
    }
  },
});

const runtimeDigest = defineCommand({
  meta: {
    name: "digest",
    description: "Print the runtime profile digest for a target",
  },
  args: {
    target: {
      type: "positional",
      description: "Target platform",
      required: true,
    },
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  run({ args }) {
    const target = parseInstallTarget(args.target);
    const digest = computeRuntimeProfileDigest(target);
    const result = { target, digest };

    console.log(args.json ? JSON.stringify(result, null, 2) : formatRuntimeDigestHuman(result));
  },
});

const runtimeInspect = defineCommand({
  meta: {
    name: "inspect",
    description: "Inspect and persist runtime capabilities for a target",
  },
  args: {
    target: {
      type: "positional",
      description: "Target platform",
      required: true,
    },
    root: rootArg,
    configDigest: {
      type: "string",
      description: "Observed runtime config digest",
      required: false,
    },
    status: {
      type: "enum",
      description: "Observed runtime status",
      options: [...RUNTIME_CAPABILITY_STATUSES],
      default: DEFAULT_RUNTIME_CAPABILITY_STATUS,
    },
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const target = parseInstallTarget(args.target);
    const result = await inspectRuntime(args.root, target, {
      configDigest: typeof args.configDigest === "string" ? args.configDigest : undefined,
      status: args.status as RuntimeCapabilityStatus,
    });

    console.log(args.json ? JSON.stringify(result, null, 2) : formatRuntimeInspectHuman(result));
  },
});

const runtimeBind = defineCommand({
  meta: {
    name: "bind",
    description: "Bind inspected runtime capabilities to required gates",
  },
  args: {
    target: {
      type: "positional",
      description: "Target platform",
      required: true,
    },
    root: rootArg,
    expectedDigest: {
      type: "string",
      description: "Expected runtime config digest",
      required: false,
    },
    currentDigest: {
      type: "string",
      description: "Current runtime config digest",
      required: false,
    },
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const target = parseInstallTarget(args.target);
    const result = await bindRuntime(args.root, target, {
      expectedDigest: typeof args.expectedDigest === "string" ? args.expectedDigest : undefined,
      currentDigest: typeof args.currentDigest === "string" ? args.currentDigest : undefined,
    });

    console.log(args.json ? JSON.stringify(result, null, 2) : formatRuntimeBindHuman(result));
  },
});

const runtime = defineCommand({
  meta: {
    name: "runtime",
    description: "Inspect runtime metadata",
  },
  subCommands: {
    digest: runtimeDigest,
    inspect: runtimeInspect,
    bind: runtimeBind,
  },
});

const main = defineCommand({
  meta: {
    name: "harness",
    version: "0.0.0",
    description: "PFV4 local harness CLI",
  },
  subCommands: {
    init,
    status,
    convergence,
    close,
    hook,
    transition,
    evidence,
    risk,
    doctor,
    validate,
    install,
    catalog,
    artifacts,
    "install-artifacts": installArtifacts,
    runtime,
  },
});

if (isDirectRun()) {
  runMain(main);
}

export function parseHookEvent(input: unknown): GateType {
  if (typeof input === "string" && GATE_TYPES.includes(input as GateType)) {
    return input as GateType;
  }

  if (typeof input === "string") {
    const mappedGateType = HOOK_EVENT_TO_GATE_TYPE[input];
    if (mappedGateType !== undefined) {
      return mappedGateType;
    }
  }

  throw new Error(`Unknown hook event: ${String(input)}`);
}

function parseMacroCycle(input: unknown): MacroCycle {
  if (typeof input === "string" && MACRO_CYCLES.includes(input as MacroCycle)) {
    return input as MacroCycle;
  }

  throw new Error(`Unknown MacroCycle: ${String(input)}`);
}

function parseInstallTarget(input: unknown): InstallTarget {
  if (typeof input === "string" && INSTALL_TARGETS.includes(input as InstallTarget)) {
    return input as InstallTarget;
  }

  throw new Error(`Unknown install target: ${String(input)}`);
}

function parseArtifactInstallTarget(input: unknown): InstallTarget {
  if (typeof input === "string" && ARTIFACT_INSTALL_TARGETS.includes(input as InstallTarget)) {
    return input as InstallTarget;
  }

  throw new Error(`Unknown artifact install target: ${String(input)}`);
}

export function parseEvidenceAddArgs(args: Record<string, unknown>): AddEvidenceInput {
  const key = parseEvidenceKey(args.key);
  const status = parseEvidenceStatus(args.status ?? DEFAULT_EVIDENCE_STATUS);

  return {
    key,
    kind: readRequiredString(args, "kind"),
    status,
    summary: readRequiredString(args, "summary"),
    source: "agent",
  };
}

export function parseRiskClassifyArgs(args: Record<string, unknown>): Changeset {
  const labels: string[] = [];
  const diffParts: string[] = [];
  const files = parseStringList(args.files);
  const linesChanged = parseOptionalInteger(args.linesChanged, "linesChanged") ?? 0;
  const coverage = parseOptionalPercent(args.testCoverage, "testCoverage");
  const confidence = parseConfidence(args.confidence ?? DEFAULT_CONFIDENCE_LEVEL);

  let changeType: Changeset["changeType"] = DEFAULT_CHANGE_TYPE;

  if (readBoolean(args, "dependency")) {
    changeType = "deps";
  }

  if (readBoolean(args, "schema")) {
    changeType = "migration";
    labels.push("schema-change");
    diffParts.push("+ ALTER TABLE records ADD COLUMN value text;");
  }

  if (readBoolean(args, "migration")) {
    changeType = "migration";
    labels.push("migration");
  }

  if (readBoolean(args, "infra")) {
    changeType = "infra";
    labels.push("infrastructure");
  }

  if (readBoolean(args, "auth")) {
    labels.push("auth");
  }

  if (readBoolean(args, "destructive")) {
    labels.push("breaking-change");
    diffParts.push("+ DROP TABLE obsolete_records;");
  }

  const newEndpointExposed = readBoolean(args, "publicApi") || undefined;
  if (newEndpointExposed) {
    labels.push("api-breaking");
  }

  if (readBoolean(args, "securitySensitive")) {
    labels.push("privacy");
  }

  if (readBoolean(args, "externalIntegration")) {
    labels.push("external-integration");
  }

  return {
    files,
    labels,
    changeType,
    diffContent: diffParts.join("\n") || undefined,
    diffLinesNet: linesChanged,
    probabilityEstimate: probabilityEstimateFromConfidence(confidence),
    ciGreen: coverage === undefined ? undefined : coverage >= 80,
    newEndpointExposed,
  };
}

export async function generateCatalogArtifactsPlan(args: {
  apply?: unknown;
  baseDir?: unknown;
  kind?: unknown;
}): Promise<CatalogArtifactsPlan> {
  const kind = parseArtifactKind(args.kind ?? "all");
  const baseDir = readOptionalString({ baseDir: args.baseDir }, "baseDir") ?? process.cwd();
  const apply = readBoolean({ apply: args.apply }, "apply");
  const dryRun = !apply;
  const writeResult = apply
    ? await writeCatalogArtifacts({ outputRoot: baseDir, kind, dryRun: false })
    : undefined;
  const result = writeResult ?? planCatalogArtifacts({ outputRoot: baseDir, kind, dryRun: true });

  return {
    ok: true,
    kind,
    baseDir,
    dryRun,
    apply,
    artifactsPlanned: result.artifacts.length,
    artifactsWritten: writeResult?.writtenPaths ?? [],
    artifactsUnchanged: writeResult?.unchangedPaths ?? [],
    result,
  };
}

export function formatCatalogArtifactsPlanHuman(plan: CatalogArtifactsPlan): string {
  const lines = [
    "Catalog artifacts",
    `Mode      : ${plan.dryRun ? "dry-run" : "apply"}`,
    `Kind      : ${plan.kind}`,
    `Base dir  : ${plan.baseDir}`,
    `Artifacts : ${plan.artifactsPlanned}`,
    `Written   : ${plan.artifactsWritten.length}`,
    `Unchanged : ${plan.artifactsUnchanged.length}`,
  ];
  lines.push("Result    : ready");

  return lines.join("\n");
}

export async function generateInstallArtifactsPlan(args: {
  apply?: unknown;
  kind?: unknown;
  root?: unknown;
  target?: unknown;
}): Promise<InstallArtifactsPlan> {
  const target = parseArtifactInstallTarget(args.target);
  const kind = parseArtifactInstallSelection(args.kind ?? "all");
  const root = readOptionalString({ root: args.root }, "root") ?? process.cwd();
  const apply = readBoolean({ apply: args.apply }, "apply");
  const dryRun = !apply;
  const writeResult = apply
    ? await installCatalogArtifacts({ projectRoot: root, target, kind, dryRun: false })
    : undefined;
  const result =
    writeResult ?? planArtifactInstall({ projectRoot: root, target, kind, dryRun: true });

  return {
    ok: true,
    target,
    root: result.projectRoot,
    projectRoot: result.projectRoot,
    platformDirectory: result.platformDirectory,
    kind,
    selection: result.selection,
    dryRun,
    apply,
    artifactsPlanned: result.artifacts.length,
    artifactsWritten: writeResult?.writtenPaths ?? [],
    artifactsUnchanged: writeResult?.unchangedPaths ?? [],
    result,
  };
}

export function formatInstallArtifactsPlanHuman(plan: InstallArtifactsPlan): string {
  const lines = [
    "Target artifacts",
    `Mode       : ${plan.dryRun ? "dry-run" : "apply"}`,
    `Target     : ${plan.target}`,
    `Kind       : ${plan.kind}`,
    `Root       : ${plan.projectRoot}`,
    `Platform   : ${plan.platformDirectory}`,
    `Artifacts  : ${plan.artifactsPlanned}`,
    `Written    : ${plan.artifactsWritten.length}`,
    `Unchanged  : ${plan.artifactsUnchanged.length}`,
  ];
  lines.push("Result     : ready");

  return lines.join("\n");
}

export async function applyPlatformConfig(
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

async function readJsonStdin(): Promise<unknown> {
  if (process.stdin.isTTY) {
    return {};
  }

  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw.length === 0 ? {} : JSON.parse(raw);
}

export async function createDoctorReport(
  root: string,
  target?: InstallTarget,
  options: { fix?: boolean } = {},
): Promise<DoctorReport> {
  const projectChecks: DoctorCheck[] = [];
  const stateChecks: DoctorCheck[] = [];

  try {
    const project = await readPlanningProject(root);
    const status = await getStatus(root);

    projectChecks.push(
      check("state.yaml", "pass", `${status.phase} / ${status.subPhase}`),
      check("current-risk.yaml", "pass", `class ${status.riskClass}`),
      check("run-set.json", "pass", `${status.evidenceCount} evidence item(s)`),
    );
    stateChecks.push(
      check("run_id", status.runId.length > 0 ? "pass" : "fail", status.runId || "missing"),
      check("finalization", "pass", project.runSet.finalization.state),
      check(
        "blockers",
        status.blockers.length === 0 ? "pass" : "warn",
        status.blockers.length === 0 ? "none" : status.blockers.join(", "),
      ),
    );
  } catch (error) {
    const detail = describeError(error);
    const level = getErrorCode(error) === "PLANNING_SCHEMA_INVALID" ? "fail" : "fail";
    projectChecks.push(check("planning project", level, detail));
  }

  const installChecks = [check("platform install services", "pass", "exported by @harness/core")];

  if (options.fix) {
    installChecks.push(check("--fix", "warn", "auto-repair is not enabled in this MVP"));
  }

  const platformChecks = target
    ? (await detectPlatform(root, target)).checks.map((item) =>
        check(item.name, item.status, item.path ? `${item.message} ${item.path}` : item.message),
      )
    : [check("target", "warn", "pass --target when checking a specific platform")];

  const sections = [
    { name: "Installation", checks: installChecks },
    { name: "Platform", checks: platformChecks },
    { name: "Project", checks: projectChecks },
    { name: "State", checks: stateChecks },
  ];

  const errors = countChecks(sections, "fail");
  const warnings = countChecks(sections, "warn");

  return {
    ok: errors === 0,
    root,
    sections,
    errors,
    warnings,
  };
}

export function formatStatusHuman(result: Awaited<ReturnType<typeof getStatus>>): string {
  const blockers = result.blockers.length === 0 ? "none" : result.blockers.join(", ");

  return [
    `MacroCycle : ${result.phase}`,
    `SubPhase   : ${result.subPhase}`,
    `RiskClass  : ${result.riskClass}`,
    `Mode       : ${result.mode}`,
    `Run ID     : ${result.runId}`,
    `Evidence   : ${result.evidenceCount}`,
    `Blockers   : ${blockers}`,
  ].join("\n");
}

export function formatConvergenceHuman(result: ReturnType<typeof evaluateConvergence>): string {
  const blockers = result.blockers.length === 0 ? "none" : result.blockers.join(", ");
  const gaps = result.gaps.length === 0 ? "none" : result.gaps.join(", ");

  return [
    `Status     : ${result.status}`,
    `Score      : ${result.score}`,
    `FinalState : ${result.finalizationRecommendation.finalState}`,
    `Reason     : ${result.finalizationRecommendation.reason}`,
    `Blockers   : ${blockers}`,
    `Gaps       : ${gaps}`,
  ].join("\n");
}

export function formatCloseRunHuman(result: CloseRunResult): string {
  return [
    "Run closed",
    `Event ID   : ${result.event.id}`,
    `Decision   : ${result.event.decision ?? "n/a"}`,
    `FinalState : ${result.evaluation.finalizationRecommendation.finalState}`,
    `Status     : ${result.evaluation.status}`,
    `Score      : ${result.evaluation.score}`,
    `Reason     : ${result.evaluation.finalizationRecommendation.reason}`,
  ].join("\n");
}

export function formatDoctorHuman(report: DoctorReport): string {
  const lines = ["harness doctor", "----------------------------------------"];

  for (const section of report.sections) {
    lines.push(section.name);
    for (const item of section.checks) {
      lines.push(`  ${formatCheckMarker(item.level)} ${item.name} - ${item.detail}`);
    }
    lines.push("");
  }

  lines.push(`${report.errors} error(s), ${report.warnings} warning(s).`);
  return lines.join("\n").trimEnd();
}

export function formatEvidenceAddedHuman(item: EvidenceItem): string {
  return [
    "Evidence added",
    `ID      : ${item.id}`,
    `Key     : ${item.key}`,
    `Kind    : ${item.kind}`,
    `Status  : ${item.status}`,
    `Summary : ${item.summary}`,
  ].join("\n");
}

export function formatRiskClassHuman(result: ClassificationResult): string {
  const signals =
    result.activeSignals.length === 0
      ? "none"
      : result.activeSignals
          .map((signal) => `${signal.type}:${signal.value}->${signal.forcedClass}`)
          .join(", ");

  return [
    `RiskClass  : ${result.riskClass}`,
    `Mode       : ${result.operatingMode}`,
    `Deploy     : ${result.deploymentStrategy}`,
    `Bypass     : ${result.bypassEligible ? "yes" : "no"}`,
    `Score      : ${result.compositeScore ?? "n/a"}`,
    `Signals    : ${signals}`,
    `Reason     : ${result.justification}`,
  ].join("\n");
}

export function formatInstallHuman(result: InstallPlatformResult): string {
  const lines = [
    `Install target : ${result.target}`,
    `Mode           : ${result.dryRun ? "dry-run" : "write-manifest-only"}`,
    `Manifest       : ${result.manifestWritten ? result.expectedPaths.manifestFile : "not written"}`,
    "Planned actions:",
  ];

  for (const action of result.plannedActions) {
    lines.push(`  - ${action.kind}: ${action.path}`);
  }

  if (result.warnings.length > 0) {
    lines.push("Warnings:");
    for (const warning of result.warnings) {
      lines.push(`  - ${warning}`);
    }
  }

  return lines.join("\n");
}

export function formatApplyPlatformConfigHuman(result: ApplyPlatformConfigResult): string {
  const configFile = "settingsFile" in result ? result.settingsFile : result.configFile;

  return [
    `Applied target : ${result.target}`,
    `Config file    : ${configFile}`,
    `Hooks added    : ${result.hooksAdded}`,
  ].join("\n");
}

export function formatCatalogHuman(result: ReturnType<typeof getOperationalCatalog>): string {
  return [
    "Operational catalog",
    `Skills    : ${result.skills.length}`,
    `Books     : ${result.books.length}`,
    `Subagents : ${result.subagents.length}`,
  ].join("\n");
}

export function formatRuntimeDigestHuman(result: {
  target: InstallTarget;
  digest: string;
}): string {
  return [`Runtime target : ${result.target}`, `Digest         : ${result.digest}`].join("\n");
}

export function formatRuntimeInspectHuman(result: RuntimeCapability): string {
  return [
    `Runtime target : ${result.target}`,
    `Runtime name   : ${result.runtimeName}`,
    `Status         : ${result.status}`,
    `Config digest  : ${result.configDigest ?? "n/a"}`,
    `Hooks          : ${Object.keys(result.hooks).length}`,
  ].join("\n");
}

export function formatRuntimeBindHuman(result: Record<GateType, RuntimeBinding>): string {
  const bindings = Object.values(result);
  const nativeCount = bindings.filter((binding) => binding.status === "native").length;
  const staleCount = bindings.filter((binding) => binding.status === "stale").length;
  const missingCount = bindings.filter(
    (binding) =>
      binding.status === MISSING_RUNTIME_BINDING_STATUS || binding.status === "capability_unknown",
  ).length;
  const target = bindings[0]?.target ?? "unknown";

  return [
    `Runtime target : ${target}`,
    `Native gates   : ${nativeCount}`,
    `Stale gates    : ${staleCount}`,
    `Missing gates  : ${missingCount}`,
  ].join("\n");
}

function check(name: string, level: CheckLevel, detail: string): DoctorCheck {
  return { name, level, detail };
}

function countChecks(sections: DoctorSection[], level: CheckLevel): number {
  return sections.reduce(
    (total, section) => total + section.checks.filter((item) => item.level === level).length,
    0,
  );
}

function formatCheckMarker(level: CheckLevel): string {
  if (level === "pass") {
    return "[OK]";
  }

  if (level === "warn") {
    return "[WARN]";
  }

  return "[FAIL]";
}

function parseEvidenceKey(input: unknown): EvidenceKey {
  if (typeof input === "string" && EVIDENCE_KEYS.includes(input as EvidenceKey)) {
    return input as EvidenceKey;
  }

  throw new Error(`Unknown evidence key: ${String(input)}`);
}

function parseEvidenceStatus(input: unknown): EvidenceStatus {
  if (typeof input === "string" && EVIDENCE_STATUSES.includes(input as EvidenceStatus)) {
    return input as EvidenceStatus;
  }

  throw new Error(`Unknown evidence status: ${String(input)}`);
}

function parseConfidence(input: unknown): ConfidenceLevel {
  if (typeof input === "string" && CONFIDENCE_LEVELS.includes(input as ConfidenceLevel)) {
    return input as ConfidenceLevel;
  }

  throw new Error(`Unknown confidence: ${String(input)}`);
}

function parseArtifactKind(input: unknown): CatalogArtifactSelection {
  if (
    typeof input === "string" &&
    CATALOG_ARTIFACT_SELECTIONS.includes(input as CatalogArtifactSelection)
  ) {
    return input as CatalogArtifactSelection;
  }

  throw new Error(`Unknown artifact kind: ${String(input)}`);
}

function parseArtifactInstallSelection(input: unknown): ArtifactInstallSelection {
  if (
    typeof input === "string" &&
    ARTIFACT_INSTALL_SELECTIONS.includes(input as ArtifactInstallSelection)
  ) {
    return input as ArtifactInstallSelection;
  }

  throw new Error(`Unknown artifact install kind: ${String(input)}`);
}

function probabilityEstimateFromConfidence(confidence: ConfidenceLevel): 2 | 3 | 4 {
  if (confidence === "high") {
    return 2;
  }

  if (confidence === "low") {
    return 4;
  }

  return 3;
}

function parseStringList(input: unknown): string[] {
  if (input === undefined || input === null || input === "") {
    return [];
  }

  if (Array.isArray(input)) {
    return input.flatMap(parseStringList);
  }

  if (typeof input !== "string") {
    throw new Error(`Expected string list, got: ${String(input)}`);
  }

  return input
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseOptionalInteger(input: unknown, name: string): number | undefined {
  if (input === undefined || input === null || input === "") {
    return undefined;
  }

  const value = typeof input === "number" ? input : Number.parseInt(String(input), 10);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }

  return value;
}

function parseOptionalPercent(input: unknown, name: string): number | undefined {
  if (input === undefined || input === null || input === "") {
    return undefined;
  }

  const value = typeof input === "number" ? input : Number.parseFloat(String(input));
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${name} must be a number from 0 to 100.`);
  }

  return value;
}

function readRequiredString(args: Record<string, unknown>, name: string): string {
  const value = args[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }

  return value.trim();
}

function readOptionalString(args: Record<string, unknown>, name: string): string | undefined {
  const value = args[name];
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string.`);
  }

  return value.trim();
}

function readBoolean(args: Record<string, unknown>, name: string): boolean {
  return args[name] === true;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "unknown error";
}

function getErrorCode(error: unknown): HarnessErrorCode | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    return (error as { code?: HarnessErrorCode }).code;
  }

  return undefined;
}

function isDirectRun(): boolean {
  if (!process.argv[1]) {
    return false;
  }

  return existsSync(process.argv[1]) && fileURLToPath(import.meta.url) === process.argv[1];
}

export { main };
