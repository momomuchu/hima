#!/usr/bin/env node
import { existsSync } from "node:fs";
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyClaudeInstall, removeClaudeInstall } from "@harness/adapter-claude/install";
import { applyCodexInstall, removeCodexInstall } from "@harness/adapter-codex/install";
import { applyHermesInstall, removeHermesInstall } from "@harness/adapter-hermes/install";
import {
  type AddEvidenceInput,
  ARTIFACT_INSTALL_SELECTIONS,
  ARTIFACT_INSTALL_TARGETS,
  type ArtifactInstallSelection,
  type ArtifactRollbackPlan,
  addEvidence,
  applyRuntimeLifecycle,
  assessRouteRuntimeBindings,
  type BenchmarkAuthorization,
  type BenchmarkResult,
  bindRuntime,
  CATALOG_ARTIFACT_SELECTIONS,
  type CatalogArtifactSelection,
  type Changeset,
  type ClassificationResult,
  type CloseRunResult,
  CONFIDENCE_LEVELS,
  type CompliancePack,
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
  enterDevelopment,
  evaluateConvergence,
  extractInstallManifestHookCommands,
  GATE_TYPES,
  type GateType,
  getOperationalCatalog,
  getRuntimeHookProfiles,
  getRuntimeProfile,
  getStatus,
  type HarnessErrorCode,
  type HookResponse,
  handleHook,
  INSTALL_TARGETS,
  type InstallCatalogArtifactsResult,
  type InstallManifest,
  type InstallPlatformResult,
  type InstallTarget,
  initProject,
  inspectRuntime,
  installCatalogArtifacts,
  installPlatform,
  type LocalSiemFixtureResult,
  type LocalStressFixtureResult,
  MACRO_CYCLES,
  type MacroCycle,
  MISSING_RUNTIME_BINDING_STATUS,
  OPERATING_MODES,
  type OperatingMode,
  parseBenchmarkAuthorization,
  parseBenchmarkResult,
  parseCompliancePack,
  parseRuntimeParityAuthorization,
  parseRuntimeParityFixture,
  parseSiemIngestFixture,
  planArtifactInstall,
  planCatalogArtifacts,
  probeRuntime,
  RISK_CLASSES,
  type RiskClass,
  type RollbackCatalogArtifactsResult,
  RUNTIME_CAPABILITY_STATUSES,
  RUNTIME_TARGETS,
  type RuntimeBinding,
  type RuntimeBindingHealth,
  type RuntimeCapability,
  type RuntimeCapabilityStatus,
  type RuntimeHookCapabilityInput,
  RuntimeHooksInputSchema,
  type RuntimeParityAuthorization,
  type RuntimeParityFixture,
  type RuntimeProbeResult,
  readInstallManifest,
  readPlanningProject,
  repairRuntimeLifecycle,
  requestTransition,
  rollbackCatalogArtifacts,
  runLocalSiemFixture,
  runLocalStressFixture,
  SUB_PHASES,
  type SubPhase,
  safeAtomicWriteFile,
  toHookCommand,
  uninstallRuntimeLifecycle,
  type WriteCatalogArtifactsResult,
  writeCatalogArtifacts,
} from "@harness/core";
import { defineCommand, runMain } from "citty";

const HOOK_EVENT_TO_GATE_TYPE = Object.fromEntries([
  ...GATE_TYPES.flatMap((gateType) => {
    const executableEvent = toHookCommand(gateType).replace("harness hook ", "");

    return [
      [executableEvent, gateType],
      [executableEvent.replaceAll("-", "_"), gateType],
    ];
  }),
  ...RUNTIME_TARGETS.flatMap((target) =>
    getRuntimeHookProfiles(target).flatMap((hook) =>
      hook.nativeEvent === null
        ? []
        : [
            [hook.nativeEvent, hook.gateType],
            [hook.nativeEvent.toLowerCase(), hook.gateType],
          ],
    ),
  ),
]) as Record<string, GateType>;
const MAX_HOOK_STDIN_BYTES = 1024 * 1024;
const HOOK_STDIN_TIMEOUT_MS = 5000;
const HOOK_OUTPUT_FORMATS = ["native", "claude", "codex"] as const;
type CheckLevel = "pass" | "warn" | "fail";
type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];
type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];
type HookOutputFormat = (typeof HOOK_OUTPUT_FORMATS)[number];
type HookCommandOptions = {
  hookCommands?: Partial<Record<GateType, string>>;
  hookCommandPrefix?: string;
};
type ApplyPlatformConfigResult = Awaited<ReturnType<typeof applyPlatformConfig>>;
type RemovePlatformConfigResult = Awaited<ReturnType<typeof removePlatformConfig>>;
type SelfTestRuntimeExecutionStatus = "blocked_by_design";
type SelfTestTargetResult = {
  target: InstallTarget;
  install: {
    status: "pass" | "fail";
    hooksPlanned: number;
    unsupportedHooks: GateType[];
    degradedHooks: GateType[];
    manifestWritten: boolean;
  };
  hookDryRun: {
    status: "pass" | "fail";
    decision: HookResponse["decision"];
    gateType: GateType;
  };
  runtimeExecution: {
    status: SelfTestRuntimeExecutionStatus;
    reason: string;
  };
};
type SelfTestResult = {
  ok: boolean;
  root: string;
  externalRuntimeSessionsLaunched: false;
  targets: SelfTestTargetResult[];
};
type BenchmarkPlanResult = {
  ok: true;
  suite: "swe-bench-verified";
  requestedInstances: number;
  executionMode: "dry_run_plan";
  willLaunchExternalSessions: false;
  requiresExplicitAuthorization: true;
  plannedComparisons: string[];
  requiredEvidence: string[];
  status: "blocked_until_authorized";
};
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
  writeManifest: boolean;
  captureRestoreSnapshots: boolean;
  artifactsPlanned: number;
  artifactsWritten: readonly string[];
  artifactsUnchanged: readonly string[];
  manifest?: InstallCatalogArtifactsResult["manifest"];
  manifestFile?: string;
  result: ReturnType<typeof planArtifactInstall> | InstallCatalogArtifactsResult;
};
type RollbackArtifactsPlan = {
  ok: boolean;
  root: string;
  projectRoot: string;
  target: InstallTarget;
  platformDirectory: string;
  manifestFile: string;
  dryRun: boolean;
  apply: boolean;
  actions: ArtifactRollbackPlan["actions"];
  blockers: ArtifactRollbackPlan["blockers"];
  actionsPlanned: number;
  artifactsPlanned: number;
  deletedPaths: readonly string[];
  restoredPaths: readonly string[];
  artifactsDeleted: number;
  artifactsRestored: number;
  result: ArtifactRollbackPlan | RollbackCatalogArtifactsResult;
};
type PlatformUninstallPlan = {
  ok: boolean;
  action: "uninstall";
  root: string;
  target: InstallTarget;
  platformDirectory: string;
  manifestFile: string;
  dryRun: boolean;
  apply: boolean;
  hooksPlanned: number;
  hooksRemoved: number;
  manifestRetained: true;
  result?: RemovePlatformConfigResult;
};
type PlatformRepairPlan = {
  ok: boolean;
  action: "repair";
  root: string;
  target: InstallTarget;
  platformDirectory: string;
  manifestFile: string;
  dryRun: boolean;
  apply: boolean;
  hooksPlanned: number;
  hooksAdded: number;
  result?: ApplyPlatformConfigResult;
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

export interface CliCommandSurfaceEntry {
  command: string;
  description: string;
  hasSubCommands: boolean;
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
    format: {
      type: "enum",
      description: "Hook output format",
      options: [...HOOK_OUTPUT_FORMATS],
      default: "native",
    },
  },
  async run({ args }) {
    const gateType = parseHookEvent(args.event);
    const payload = await readJsonStdin();
    const result = await handleHook(args.root, gateType, payload, { dryRun: args.dryRun });
    const output = formatHookResponse(gateType, result, args.format as HookOutputFormat);

    console.log(JSON.stringify(output, null, 2));
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

const enter = defineCommand({
  meta: {
    name: "enter",
    description: "Enter governed development mode with phase, subphase, mode, risk, and intent",
  },
  args: {
    root: rootArg,
    phase: {
      type: "enum",
      description: "Target MacroCycle",
      options: [...MACRO_CYCLES],
      default: "build",
    },
    subPhase: {
      type: "enum",
      description: "Target SubPhase",
      options: [...SUB_PHASES],
      default: "Execute",
    },
    mode: {
      type: "enum",
      description: "Operating mode",
      options: [...OPERATING_MODES],
      default: "auto",
    },
    riskClass: {
      type: "enum",
      description: "Effective T/L/M/H/C risk class",
      options: [...RISK_CLASSES],
      default: "T",
    },
    objective: {
      type: "string",
      description: "Short objective for the governed development session",
      required: false,
    },
    prompt: {
      type: "string",
      description: "Raw user prompt or intent summary",
      required: false,
    },
    reason: {
      type: "string",
      description: "Reason recorded in the state event log",
      required: false,
    },
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const result = await enterDevelopment(args.root, {
      phase: parseMacroCycle(args.phase),
      subPhase: parseSubPhase(args.subPhase),
      mode: parseOperatingMode(args.mode),
      riskClass: parseRiskClass(args.riskClass),
      objective: readOptionalString(args, "objective"),
      rawPrompt: readOptionalString(args, "prompt"),
      reason: readOptionalString(args, "reason"),
    });

    console.log(args.json ? JSON.stringify(result, null, 2) : formatEnterDevelopmentHuman(result));
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

const selfTest = defineCommand({
  meta: {
    name: "self-test",
    description: "Run deterministic local fixture/install/hook checks without model sessions",
  },
  args: {
    root: rootArg,
    target: {
      type: "string",
      description: "Runtime target to check, or all",
      default: "all",
    },
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const result = await runLocalSelfTest({
      root: args.root,
      target: typeof args.target === "string" ? args.target : "all",
    });

    console.log(args.json ? JSON.stringify(result, null, 2) : formatSelfTestHuman(result));
  },
});

const stressFixture = defineCommand({
  meta: {
    name: "stress-fixture",
    description: "Run deterministic local transition/ledger stress checks without runtimes",
  },
  args: {
    root: rootArg,
    runId: {
      type: "string",
      description: "Local stress ledger run id",
      default: "local-stress-fixture",
    },
    iterations: {
      type: "string",
      description: "Number of deterministic transition-like ledger entries",
      default: "100",
    },
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const result = await runLocalStressFixture({
      root: args.root,
      runId: readOptionalString(args, "runId") ?? "local-stress-fixture",
      iterations: parseOptionalInteger(args.iterations, "iterations") ?? 100,
    });

    console.log(args.json ? JSON.stringify(result, null, 2) : formatStressFixtureHuman(result));
  },
});

const siemFixture = defineCommand({
  meta: {
    name: "siem-fixture",
    description: "Write local SIEM-like ingest records without network transmission",
  },
  args: {
    root: rootArg,
    runId: {
      type: "string",
      description: "Local SIEM fixture run id",
      default: "local-siem-fixture",
    },
    iterations: {
      type: "string",
      description: "Number of local ledger entries to normalize",
      default: "10",
    },
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const result = await runLocalSiemFixture({
      root: args.root,
      runId: readOptionalString(args, "runId") ?? "local-siem-fixture",
      iterations: parseOptionalInteger(args.iterations, "iterations") ?? 10,
    });

    console.log(args.json ? JSON.stringify(result, null, 2) : formatSiemFixtureHuman(result));
  },
});

const benchmarkPlan = defineCommand({
  meta: {
    name: "plan",
    description: "Plan a benchmark run without launching external sessions",
  },
  args: {
    instances: {
      type: "string",
      description: "Requested SWE-bench Verified instance count",
      default: "10",
    },
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const result = planBenchmarkRun({ instances: args.instances });

    console.log(args.json ? JSON.stringify(result, null, 2) : formatBenchmarkPlanHuman(result));
  },
});

const benchmarkValidate = defineCommand({
  meta: {
    name: "validate",
    description: "Validate a benchmark result JSON file without executing benchmarks",
  },
  args: {
    file: {
      type: "positional",
      description: "Benchmark result JSON file",
      required: true,
    },
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const result = await validateBenchmarkResultFile(args.file);

    console.log(
      args.json ? JSON.stringify(result, null, 2) : formatBenchmarkValidationHuman(result),
    );
  },
});

const benchmarkWrite = defineCommand({
  meta: {
    name: "write",
    description:
      "Write a planned or blocked benchmark result artifact without executing benchmarks",
  },
  args: {
    status: {
      type: "enum",
      options: ["planned", "blocked"],
      description: "Benchmark result status to persist",
      required: true,
    },
    instanceId: {
      type: "string",
      description: "SWE-bench Verified instance id",
      required: true,
    },
    target: {
      type: "string",
      description: "Runtime target",
      default: "codex",
    },
    blockReason: {
      type: "string",
      description: "Required when status is blocked",
      required: false,
    },
    root: rootArg,
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const result = await writeBenchmarkResultArtifact({
      root: args.root,
      status: args.status,
      instanceId: readRequiredString(args, "instanceId"),
      target: readOptionalString(args, "target") ?? "codex",
      blockReason: readOptionalString(args, "blockReason"),
    });

    console.log(args.json ? JSON.stringify(result, null, 2) : formatBenchmarkWriteHuman(result));
  },
});

const benchmarkAuthorizationWrite = defineCommand({
  meta: {
    name: "write",
    description: "Write benchmark execution authorization state without executing benchmarks",
  },
  args: {
    status: {
      type: "enum",
      options: ["blocked", "authorized"],
      description: "Authorization status",
      required: true,
    },
    instances: {
      type: "string",
      description: "Requested SWE-bench Verified instance count",
      default: "10",
    },
    targets: {
      type: "string",
      description: "Comma-separated runtime targets",
      default: "codex",
    },
    blockReason: {
      type: "string",
      description: "Required when status is blocked",
      required: false,
    },
    authorizedBy: {
      type: "string",
      description: "Required when status is authorized",
      required: false,
    },
    authorizationId: {
      type: "string",
      description: "Required when status is authorized",
      required: false,
    },
    costBudgetUsd: {
      type: "string",
      description: "Required positive cost budget when status is authorized",
      required: false,
    },
    credentialScope: {
      type: "string",
      description: "Required credential scope when status is authorized",
      required: false,
    },
    evidenceRetentionPath: {
      type: "string",
      description: "Required evidence retention path when status is authorized",
      required: false,
    },
    transcriptRetentionPath: {
      type: "string",
      description: "Required transcript retention path when status is authorized",
      required: false,
    },
    root: rootArg,
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const result = await writeBenchmarkAuthorizationArtifact({
      root: args.root,
      status: args.status,
      instances: args.instances,
      targets: readOptionalString(args, "targets") ?? "codex",
      blockReason: readOptionalString(args, "blockReason"),
      authorizedBy: readOptionalString(args, "authorizedBy"),
      authorizationId: readOptionalString(args, "authorizationId"),
      costBudgetUsd: args.costBudgetUsd,
      credentialScope: readOptionalString(args, "credentialScope"),
      evidenceRetentionPath: readOptionalString(args, "evidenceRetentionPath"),
      transcriptRetentionPath: readOptionalString(args, "transcriptRetentionPath"),
    });

    console.log(
      args.json ? JSON.stringify(result, null, 2) : formatBenchmarkAuthorizationWriteHuman(result),
    );
  },
});

const benchmarkAuthorizationValidate = defineCommand({
  meta: {
    name: "validate",
    description: "Validate benchmark execution authorization without executing benchmarks",
  },
  args: {
    file: {
      type: "positional",
      description: "Benchmark authorization JSON file",
      required: true,
    },
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const result = await validateBenchmarkAuthorizationFile(args.file);

    console.log(
      args.json
        ? JSON.stringify(result, null, 2)
        : formatBenchmarkAuthorizationValidationHuman(result),
    );
  },
});

const benchmarkAuthorization = defineCommand({
  meta: {
    name: "authorization",
    description: "Benchmark execution authorization namespace",
  },
  subCommands: {
    validate: benchmarkAuthorizationValidate,
    write: benchmarkAuthorizationWrite,
  },
});

const benchmarkExecutionPreflight = defineCommand({
  meta: {
    name: "execution-preflight",
    description: "Check whether benchmark execution is explicitly authorized",
  },
  args: {
    authorizationFile: {
      type: "string",
      description: "Benchmark authorization artifact path",
      required: false,
    },
    root: rootArg,
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const result = await checkBenchmarkExecutionPreflight({
      root: args.root,
      authorizationFile: readOptionalString(args, "authorizationFile"),
    });

    console.log(
      args.json ? JSON.stringify(result, null, 2) : formatBenchmarkExecutionPreflightHuman(result),
    );
  },
});

const benchmark = defineCommand({
  meta: {
    name: "benchmark",
    description: "Benchmark planning namespace",
  },
  subCommands: {
    authorization: benchmarkAuthorization,
    "execution-preflight": benchmarkExecutionPreflight,
    plan: benchmarkPlan,
    validate: benchmarkValidate,
    write: benchmarkWrite,
  },
});

const compliancePackValidate = defineCommand({
  meta: {
    name: "validate",
    description: "Validate a developer-session compliance pack without executing runtimes",
  },
  args: {
    file: {
      type: "positional",
      description: "Compliance pack JSON file",
      required: true,
    },
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const result = await validateCompliancePackFile(args.file);

    console.log(
      args.json ? JSON.stringify(result, null, 2) : formatCompliancePackValidationHuman(result),
    );
  },
});

const compliancePackWrite = defineCommand({
  meta: {
    name: "write",
    description: "Write a draft or blocked compliance pack without executing runtimes",
  },
  args: {
    status: {
      type: "enum",
      options: ["draft", "blocked"],
      description: "Compliance pack status to persist",
      required: true,
    },
    sessionId: {
      type: "string",
      description: "Developer session id",
      required: true,
    },
    target: {
      type: "string",
      description: "Runtime target",
      default: "codex",
    },
    riskClassificationPath: {
      type: "string",
      description: "Risk classification evidence path",
      required: false,
    },
    runSetPath: {
      type: "string",
      description: "Run-set evidence path",
      required: false,
    },
    ledgerPath: {
      type: "string",
      description: "Hash-chained ledger evidence path",
      required: false,
    },
    runtimeEvidencePath: {
      type: "string",
      description: "Runtime session evidence path",
      required: false,
    },
    blockReason: {
      type: "string",
      description: "Required when status is blocked",
      required: false,
    },
    unavailableEvidence: {
      type: "string",
      description: "Comma-separated unavailable evidence keys for blocked packs",
      required: false,
    },
    root: rootArg,
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const result = await writeCompliancePackArtifact({
      root: args.root,
      status: args.status,
      sessionId: readRequiredString(args, "sessionId"),
      target: readOptionalString(args, "target") ?? "codex",
      riskClassificationPath: readOptionalString(args, "riskClassificationPath"),
      runSetPath: readOptionalString(args, "runSetPath"),
      ledgerPath: readOptionalString(args, "ledgerPath"),
      runtimeEvidencePath: readOptionalString(args, "runtimeEvidencePath"),
      blockReason: readOptionalString(args, "blockReason"),
      unavailableEvidence: readOptionalString(args, "unavailableEvidence"),
    });

    console.log(
      args.json ? JSON.stringify(result, null, 2) : formatCompliancePackWriteHuman(result),
    );
  },
});

const compliancePackAssemble = defineCommand({
  meta: {
    name: "assemble",
    description: "Assemble a compliance pack after verifying local evidence references",
  },
  args: {
    sessionId: {
      type: "string",
      description: "Developer session id",
      required: true,
    },
    target: {
      type: "string",
      description: "Runtime target",
      default: "codex",
    },
    riskClassificationPath: {
      type: "string",
      description: "Risk classification evidence path",
      required: true,
    },
    runSetPath: {
      type: "string",
      description: "Run-set evidence path",
      required: true,
    },
    ledgerPath: {
      type: "string",
      description: "Hash-chained ledger evidence path",
      required: true,
    },
    runtimeEvidencePath: {
      type: "string",
      description: "Runtime session evidence path",
      required: true,
    },
    benchmarkResultPath: {
      type: "string",
      description: "Benchmark result evidence path",
      required: true,
    },
    complianceMappingPath: {
      type: "string",
      description: "Compliance mapping evidence path",
      required: true,
    },
    siemFixturePath: {
      type: "string",
      description: "Local SIEM fixture evidence path",
      required: true,
    },
    root: rootArg,
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const result = await assembleCompliancePackArtifact({
      root: args.root,
      sessionId: readRequiredString(args, "sessionId"),
      target: readOptionalString(args, "target") ?? "codex",
      riskClassificationPath: readRequiredString(args, "riskClassificationPath"),
      runSetPath: readRequiredString(args, "runSetPath"),
      ledgerPath: readRequiredString(args, "ledgerPath"),
      runtimeEvidencePath: readRequiredString(args, "runtimeEvidencePath"),
      benchmarkResultPath: readRequiredString(args, "benchmarkResultPath"),
      complianceMappingPath: readRequiredString(args, "complianceMappingPath"),
      siemFixturePath: readRequiredString(args, "siemFixturePath"),
    });

    console.log(
      args.json ? JSON.stringify(result, null, 2) : formatCompliancePackAssembleHuman(result),
    );
  },
});

const compliancePack = defineCommand({
  meta: {
    name: "compliance-pack",
    description: "Developer-session compliance pack namespace",
  },
  subCommands: {
    assemble: compliancePackAssemble,
    validate: compliancePackValidate,
    write: compliancePackWrite,
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
    hookCommandPrefix: {
      type: "string",
      description: "Executable prefix to use before hook aliases, e.g. node ./dist/index.js",
      required: false,
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
    const apply = args.apply === true;
    const result = await installPlatform({
      projectRoot: args.root,
      target,
      dryRun: apply ? false : args.dryRun,
      writeManifest: args.writeManifest,
      hookCommandPrefix: readOptionalString(
        { hookCommandPrefix: args.hookCommandPrefix },
        "hookCommandPrefix",
      ),
    });
    const applied = apply
      ? await applyPlatformConfig(target, result.expectedPaths.platformDirectory, {
          hookCommands: extractInstallManifestHookCommands(result.manifest as InstallManifest),
        })
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
      console.log(JSON.stringify(formatCatalogJson(result), null, 2));
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
    writeManifest: {
      type: "boolean",
      description: "Write .planning/artifact-install-manifest.json during apply",
      default: false,
    },
    captureRestoreSnapshots: {
      type: "boolean",
      description:
        "Store previous managed artifact content in the manifest for automatic rollback restore",
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
      writeManifest: args.writeManifest,
      captureRestoreSnapshots: args.captureRestoreSnapshots,
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

const rollbackArtifacts = defineCommand({
  meta: {
    name: "rollback-artifacts",
    description: "Plan or apply rollback of target platform catalog artifacts",
  },
  args: {
    root: rootArg,
    manifestFile: {
      type: "string",
      description: "Artifact install manifest file",
      required: false,
    },
    apply: {
      type: "boolean",
      description: "Delete rollbackable artifacts",
      default: false,
    },
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const plan = await generateRollbackArtifactsPlan({
      apply: args.apply,
      manifestFile: args.manifestFile,
      root: args.root,
    });

    if (args.json) {
      console.log(JSON.stringify(plan, null, 2));
    } else {
      console.log(formatRollbackArtifactsPlanHuman(plan));
    }

    if (!plan.ok) {
      process.exitCode = 1;
    }
  },
});

const uninstallPlatformCommand = defineCommand({
  meta: {
    name: "uninstall-platform",
    description: "Plan or remove managed platform hook registrations from an install manifest",
  },
  args: {
    root: rootArg,
    manifestFile: {
      type: "string",
      description: "Platform install manifest file",
      required: false,
    },
    apply: {
      type: "boolean",
      description: "Remove managed platform hook registrations",
      default: false,
    },
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const plan = await generatePlatformUninstallPlan({
      apply: args.apply,
      manifestFile: args.manifestFile,
      root: args.root,
    });

    console.log(args.json ? JSON.stringify(plan, null, 2) : formatPlatformUninstallHuman(plan));
  },
});

const repairPlatformCommand = defineCommand({
  meta: {
    name: "repair-platform",
    description: "Plan or re-apply managed platform hook registrations from an install manifest",
  },
  args: {
    root: rootArg,
    manifestFile: {
      type: "string",
      description: "Platform install manifest file",
      required: false,
    },
    apply: {
      type: "boolean",
      description: "Re-apply managed platform hook registrations",
      default: false,
    },
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const plan = await generatePlatformRepairPlan({
      apply: args.apply,
      manifestFile: args.manifestFile,
      root: args.root,
    });

    console.log(args.json ? JSON.stringify(plan, null, 2) : formatPlatformRepairHuman(plan));
  },
});

const lifecycleApply = defineCommand({
  meta: {
    name: "apply",
    description: "Plan or apply the full platform hooks + catalog artifacts lifecycle",
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
      description: "Write platform hooks, artifacts, and lifecycle manifests",
      default: false,
    },
    skipManifests: {
      type: "boolean",
      description: "Do not write lifecycle manifests during apply",
      default: false,
    },
    hookCommandPrefix: {
      type: "string",
      description: "Executable prefix to use before hook aliases, e.g. node ./dist/index.js",
      required: false,
    },
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const result = await generateLifecycleApplyPlan({
      apply: args.apply,
      kind: args.kind,
      root: args.root,
      skipManifests: args.skipManifests,
      target: args.target,
      hookCommandPrefix: args.hookCommandPrefix,
    });

    console.log(args.json ? JSON.stringify(result, null, 2) : formatLifecycleApplyHuman(result));
  },
});

const lifecycleUninstall = defineCommand({
  meta: {
    name: "uninstall",
    description: "Plan or uninstall platform hooks plus rollback catalog artifacts",
  },
  args: {
    root: rootArg,
    platformManifestFile: {
      type: "string",
      description: "Platform install manifest file",
      required: false,
    },
    artifactManifestFile: {
      type: "string",
      description: "Artifact install manifest file",
      required: false,
    },
    apply: {
      type: "boolean",
      description: "Rollback artifacts and remove managed hooks",
      default: false,
    },
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const result = await generateLifecycleUninstallPlan({
      apply: args.apply,
      artifactManifestFile: args.artifactManifestFile,
      platformManifestFile: args.platformManifestFile,
      root: args.root,
    });

    console.log(
      args.json ? JSON.stringify(result, null, 2) : formatLifecycleUninstallHuman(result),
    );

    if (!result.ok) {
      process.exitCode = 1;
    }
  },
});

const lifecycleRepair = defineCommand({
  meta: {
    name: "repair",
    description: "Plan or repair platform hooks plus catalog artifacts from manifests",
  },
  args: {
    root: rootArg,
    kind: {
      type: "enum",
      description: "Artifact kind to repair",
      options: [...ARTIFACT_INSTALL_SELECTIONS],
      default: "all",
    },
    manifestFile: {
      type: "string",
      description: "Platform install manifest file",
      required: false,
    },
    apply: {
      type: "boolean",
      description: "Re-apply hooks and catalog artifacts",
      default: false,
    },
    skipManifests: {
      type: "boolean",
      description: "Do not write lifecycle manifests during apply",
      default: false,
    },
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const result = await generateLifecycleRepairPlan({
      apply: args.apply,
      kind: args.kind,
      manifestFile: args.manifestFile,
      root: args.root,
      skipManifests: args.skipManifests,
    });

    console.log(args.json ? JSON.stringify(result, null, 2) : formatLifecycleRepairHuman(result));
  },
});

const lifecycle = defineCommand({
  meta: {
    name: "lifecycle",
    description: "Orchestrate platform hooks and catalog artifacts together",
  },
  subCommands: {
    apply: lifecycleApply,
    uninstall: lifecycleUninstall,
    repair: lifecycleRepair,
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
    const result = { target, runtimeVersion: getRuntimeProfile(target).runtimeVersion, digest };

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
    runtimeVersion: {
      type: "string",
      description: "Observed runtime profile version",
      required: false,
    },
    hooksJson: {
      type: "string",
      description: "JSON object of runtime hook capability overrides keyed by GateType",
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
      runtimeVersion: typeof args.runtimeVersion === "string" ? args.runtimeVersion : undefined,
      hooks: parseRuntimeHooksJson(args.hooksJson),
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

const runtimeProbe = defineCommand({
  meta: {
    name: "probe",
    description: "Probe runtime config and persist trusted runtime proofs for a target",
  },
  args: {
    target: {
      type: "positional",
      description: "Target platform",
      required: true,
    },
    root: rootArg,
    bind: {
      type: "boolean",
      description: "Bind runtime gates immediately after probing",
      default: false,
    },
    verifyBlockingFixtures: {
      type: "boolean",
      description: "Execute managed blocking fixtures before minting trusted blocking proofs",
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
    const result = await probeRuntime(args.root, target, {
      bind: args.bind,
      verifyBlockingFixtures: args.verifyBlockingFixtures,
    });

    console.log(args.json ? JSON.stringify(result, null, 2) : formatRuntimeProbeHuman(result));
  },
});

const runtimeAssessRoute = defineCommand({
  meta: {
    name: "assess-route",
    description: "Assess route-required runtime bindings without mutating state",
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
    const assessment = assessRouteRuntimeBindings(project.runSet, project.currentRisk.risk_class);
    const result = {
      riskClass: project.currentRisk.risk_class,
      activeTarget: project.runSet.runtimeBindings.activeTarget ?? null,
      ...assessment,
    };

    console.log(
      args.json ? JSON.stringify(result, null, 2) : formatRouteRuntimeAssessmentHuman(result),
    );
  },
});

const runtimeParityFixtureValidate = defineCommand({
  meta: {
    name: "parity-fixture-validate",
    description: "Validate synthetic cross-runtime governance parity fixtures",
  },
  args: {
    fixturesDir: {
      type: "string",
      description: "Directory containing synthetic runtime parity fixture JSON files",
      default: path.join("fixtures", "runtime-parity", "synthetic"),
    },
    root: rootArg,
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const result = await validateRuntimeParityFixtures({
      root: args.root,
      fixturesDir:
        readOptionalString(args, "fixturesDir") ??
        path.join("fixtures", "runtime-parity", "synthetic"),
    });

    console.log(
      args.json ? JSON.stringify(result, null, 2) : formatRuntimeParityFixturesHuman(result),
    );

    if (!result.ok) {
      process.exitCode = 1;
    }
  },
});

const runtimeParityAuthorizationWrite = defineCommand({
  meta: {
    name: "write",
    description: "Write real-runtime parity authorization state without executing runtimes",
  },
  args: {
    status: {
      type: "enum",
      options: ["blocked", "authorized"],
      description: "Authorization status",
      required: true,
    },
    scenarioId: {
      type: "string",
      description: "Runtime parity scenario id",
      default: "small-feature",
    },
    targets: {
      type: "string",
      description: "Comma-separated runtime targets",
      default: "claude,codex,hermes",
    },
    blockReason: {
      type: "string",
      description: "Required when status is blocked",
      required: false,
    },
    authorizedBy: {
      type: "string",
      description: "Required when status is authorized",
      required: false,
    },
    authorizationId: {
      type: "string",
      description: "Required when status is authorized",
      required: false,
    },
    costBudgetUsd: {
      type: "string",
      description: "Required positive cost budget when status is authorized",
      required: false,
    },
    credentialScope: {
      type: "string",
      description: "Required credential scope when status is authorized",
      required: false,
    },
    evidenceRetentionPath: {
      type: "string",
      description: "Required evidence retention path when status is authorized",
      required: false,
    },
    transcriptRetentionPath: {
      type: "string",
      description: "Required transcript retention path when status is authorized",
      required: false,
    },
    root: rootArg,
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const result = await writeRuntimeParityAuthorizationArtifact({
      root: args.root,
      status: args.status,
      scenarioId: readOptionalString(args, "scenarioId") ?? "small-feature",
      targets: readOptionalString(args, "targets") ?? "claude,codex,hermes",
      blockReason: readOptionalString(args, "blockReason"),
      authorizedBy: readOptionalString(args, "authorizedBy"),
      authorizationId: readOptionalString(args, "authorizationId"),
      costBudgetUsd: args.costBudgetUsd,
      credentialScope: readOptionalString(args, "credentialScope"),
      evidenceRetentionPath: readOptionalString(args, "evidenceRetentionPath"),
      transcriptRetentionPath: readOptionalString(args, "transcriptRetentionPath"),
    });

    console.log(
      args.json
        ? JSON.stringify(result, null, 2)
        : formatRuntimeParityAuthorizationWriteHuman(result),
    );
  },
});

const runtimeParityAuthorizationValidate = defineCommand({
  meta: {
    name: "validate",
    description: "Validate real-runtime parity authorization without executing runtimes",
  },
  args: {
    file: {
      type: "positional",
      description: "Runtime parity authorization JSON file",
      required: true,
    },
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const result = await validateRuntimeParityAuthorizationFile(args.file);

    console.log(
      args.json
        ? JSON.stringify(result, null, 2)
        : formatRuntimeParityAuthorizationValidationHuman(result),
    );
  },
});

const runtimeParityAuthorization = defineCommand({
  meta: {
    name: "parity-authorization",
    description: "Real-runtime parity authorization namespace",
  },
  subCommands: {
    validate: runtimeParityAuthorizationValidate,
    write: runtimeParityAuthorizationWrite,
  },
});

const runtimeParityExecutionPreflight = defineCommand({
  meta: {
    name: "parity-execution-preflight",
    description: "Check whether real-runtime parity execution is explicitly authorized",
  },
  args: {
    authorizationFile: {
      type: "string",
      description: "Runtime parity authorization artifact path",
      required: false,
    },
    root: rootArg,
    json: {
      type: "boolean",
      description: "Print JSON",
      default: false,
    },
  },
  async run({ args }) {
    const result = await checkRuntimeParityExecutionPreflight({
      root: args.root,
      authorizationFile: readOptionalString(args, "authorizationFile"),
    });

    console.log(
      args.json
        ? JSON.stringify(result, null, 2)
        : formatRuntimeParityExecutionPreflightHuman(result),
    );
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
    probe: runtimeProbe,
    "assess-route": runtimeAssessRoute,
    "parity-authorization": runtimeParityAuthorization,
    "parity-execution-preflight": runtimeParityExecutionPreflight,
    "parity-fixture-validate": runtimeParityFixtureValidate,
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
    enter,
    evidence,
    risk,
    doctor,
    validate,
    "self-test": selfTest,
    "siem-fixture": siemFixture,
    "stress-fixture": stressFixture,
    benchmark,
    "compliance-pack": compliancePack,
    install,
    catalog,
    artifacts,
    "install-artifacts": installArtifacts,
    "rollback-artifacts": rollbackArtifacts,
    "uninstall-platform": uninstallPlatformCommand,
    "repair-platform": repairPlatformCommand,
    lifecycle,
    runtime,
  },
});

if (isDirectRun()) {
  runMain(main);
}

function formatHookResponse(
  gateType: GateType,
  result: HookResponse,
  format: HookOutputFormat,
): HookResponse | Record<string, unknown> {
  if (format === "claude") {
    return formatHookResponseForClaude(gateType, result);
  }

  if (format === "codex") {
    return formatHookResponseForCodex(gateType, result);
  }

  return result;
}

export function formatHookResponseForCodex(
  gateType: GateType,
  result: HookResponse,
): Record<string, unknown> {
  const blocked = result.decision === "block";

  if (gateType === "pre_tool") {
    return blocked
      ? {
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: result.reason,
          },
        }
      : {};
  }

  if (gateType === "session_start") {
    return withAdditionalContext({}, "SessionStart", result.contextInjection);
  }

  if (gateType === "user_prompt") {
    return blocked
      ? {
          decision: "block",
          reason: result.reason,
        }
      : withAdditionalContext({}, "UserPromptSubmit", result.contextInjection);
  }

  if (gateType === "post_tool") {
    const output = blocked
      ? {
          decision: "block",
          reason: result.reason,
        }
      : result.decision === "warn"
        ? { systemMessage: result.reason }
        : {};

    return withAdditionalContext(
      output,
      "PostToolUse",
      result.contextInjection ?? (result.decision === "allow" ? undefined : result.reason),
    );
  }

  if (gateType === "stop") {
    return blocked
      ? {
          decision: "block",
          reason: result.reason,
        }
      : {};
  }

  if (gateType === "subagent_start") {
    return blocked
      ? {
          decision: "block",
          reason: result.reason,
        }
      : withAdditionalContext({}, "SubagentStart", result.contextInjection);
  }

  if (gateType === "subagent_stop") {
    return blocked
      ? {
          decision: "block",
          reason: result.reason,
        }
      : {};
  }

  return result.decision === "warn" ? { systemMessage: result.reason } : {};
}

export function formatHookResponseForClaude(
  gateType: GateType,
  result: HookResponse,
): Record<string, unknown> {
  const blocked = result.decision === "block";
  const output: Record<string, unknown> = {};

  if (blocked && gateType !== "pre_tool") {
    output.decision = "block";
    output.reason = result.reason;
  } else if (result.decision === "warn") {
    output.systemMessage = result.reason;
  }

  if (gateType === "session_start") {
    return withAdditionalContext(output, "SessionStart", result.contextInjection);
  }

  if (gateType === "pre_tool") {
    output.hookSpecificOutput = {
      hookEventName: "PreToolUse",
      permissionDecision: blocked ? "deny" : "allow",
      permissionDecisionReason: result.reason,
    };
  }

  if (gateType === "user_prompt") {
    return withAdditionalContext(output, "UserPromptSubmit", result.contextInjection);
  }

  if (gateType === "post_tool") {
    const additionalContext =
      result.contextInjection ?? (result.decision === "allow" ? undefined : result.reason);

    return withAdditionalContext(output, "PostToolUse", additionalContext);
  }

  if (gateType === "subagent_start") {
    return withAdditionalContext(output, "SubagentStart", result.contextInjection);
  }

  if (gateType === "stop") {
    return blocked ? output : withAdditionalContext(output, "Stop", result.reason);
  }

  if (gateType === "subagent_stop") {
    return withAdditionalContext(output, "SubagentStop", result.reason);
  }

  return output;
}

function withAdditionalContext(
  output: Record<string, unknown>,
  hookEventName: string,
  additionalContext: string | undefined,
): Record<string, unknown> {
  if (additionalContext === undefined) {
    return output;
  }

  return {
    ...output,
    hookSpecificOutput: {
      hookEventName,
      additionalContext,
    },
  };
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

export function parseRuntimeHooksJson(
  input: unknown,
): Partial<Record<GateType, RuntimeHookCapabilityInput>> | undefined {
  if (input === undefined) {
    return undefined;
  }

  if (typeof input !== "string") {
    throw new Error("hooksJson must be a JSON string");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (error) {
    throw new Error(
      `hooksJson must be valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return RuntimeHooksInputSchema.parse(parsed);
}

function parseMacroCycle(input: unknown): MacroCycle {
  if (typeof input === "string" && MACRO_CYCLES.includes(input as MacroCycle)) {
    return input as MacroCycle;
  }

  throw new Error(`Unknown MacroCycle: ${String(input)}`);
}

function parseSubPhase(input: unknown): SubPhase {
  if (typeof input === "string" && SUB_PHASES.includes(input as SubPhase)) {
    return input as SubPhase;
  }

  throw new Error(`Unknown SubPhase: ${String(input)}`);
}

function parseOperatingMode(input: unknown): OperatingMode {
  if (typeof input === "string" && OPERATING_MODES.includes(input as OperatingMode)) {
    return input as OperatingMode;
  }

  throw new Error(`Unknown operating mode: ${String(input)}`);
}

function parseRiskClass(input: unknown): RiskClass {
  if (typeof input === "string" && RISK_CLASSES.includes(input as RiskClass)) {
    return input as RiskClass;
  }

  throw new Error(`Unknown risk class: ${String(input)}`);
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
  captureRestoreSnapshots?: unknown;
  kind?: unknown;
  root?: unknown;
  target?: unknown;
  writeManifest?: unknown;
}): Promise<InstallArtifactsPlan> {
  const target = parseArtifactInstallTarget(args.target);
  const kind = parseArtifactInstallSelection(args.kind ?? "all");
  const root = readOptionalString({ root: args.root }, "root") ?? process.cwd();
  const apply = readBoolean({ apply: args.apply }, "apply");
  const writeManifest = readBoolean({ writeManifest: args.writeManifest }, "writeManifest");
  const captureRestoreSnapshots = readBoolean(
    { captureRestoreSnapshots: args.captureRestoreSnapshots },
    "captureRestoreSnapshots",
  );
  const dryRun = !apply;
  if (writeManifest && dryRun) {
    throw new Error("writeManifest requires --apply for install-artifacts.");
  }
  if (captureRestoreSnapshots && dryRun) {
    throw new Error("captureRestoreSnapshots requires --apply for install-artifacts.");
  }
  if (captureRestoreSnapshots && !writeManifest) {
    throw new Error("captureRestoreSnapshots requires --writeManifest for install-artifacts.");
  }

  const writeResult = apply
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
    writeManifest,
    captureRestoreSnapshots,
    artifactsPlanned: result.artifacts.length,
    artifactsWritten: writeResult?.writtenPaths ?? [],
    artifactsUnchanged: writeResult?.unchangedPaths ?? [],
    ...(writeResult?.manifest ? { manifest: writeResult.manifest } : {}),
    ...(writeResult?.manifestFile ? { manifestFile: writeResult.manifestFile } : {}),
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
    `Manifest   : ${plan.manifestFile ?? "not written"}`,
    `Snapshots  : ${plan.captureRestoreSnapshots ? "enabled" : "disabled"}`,
  ];
  lines.push("Result     : ready");

  return lines.join("\n");
}

export async function generateRollbackArtifactsPlan(args: {
  apply?: unknown;
  manifestFile?: unknown;
  root?: unknown;
}): Promise<RollbackArtifactsPlan> {
  const root = readOptionalString({ root: args.root }, "root") ?? process.cwd();
  const manifestFile = readOptionalString({ manifestFile: args.manifestFile }, "manifestFile");
  const apply = readBoolean({ apply: args.apply }, "apply");
  const dryRun = !apply;
  const result = apply
    ? await rollbackCatalogArtifacts({
        projectRoot: root,
        manifestFile,
        dryRun: false,
      })
    : await rollbackCatalogArtifacts({
        projectRoot: root,
        manifestFile,
        dryRun: true,
      });
  const deletedPaths = "deletedPaths" in result ? result.deletedPaths : [];
  const restoredPaths = "restoredPaths" in result ? result.restoredPaths : [];

  return {
    ok: result.blockers.length === 0,
    root: result.projectRoot,
    projectRoot: result.projectRoot,
    target: result.target,
    platformDirectory: result.platformDirectory,
    manifestFile: result.manifestFile,
    dryRun,
    apply,
    actions: result.actions,
    blockers: result.blockers,
    actionsPlanned: result.actions.length,
    artifactsPlanned: result.actions.length,
    deletedPaths,
    restoredPaths,
    artifactsDeleted: deletedPaths.length,
    artifactsRestored: restoredPaths.length,
    result,
  };
}

export function formatRollbackArtifactsPlanHuman(plan: RollbackArtifactsPlan): string {
  const lines = [
    "Rollback artifacts",
    `Mode      : ${plan.dryRun ? "dry-run" : "apply"}`,
    `Target    : ${plan.target}`,
    `Root      : ${plan.projectRoot}`,
    `Platform  : ${plan.platformDirectory}`,
    `Manifest  : ${plan.manifestFile}`,
    `Actions   : ${plan.actionsPlanned}`,
    `Deleted   : ${plan.deletedPaths.length}`,
    `Restored  : ${plan.restoredPaths.length}`,
    `Blockers  : ${plan.blockers.length}`,
    `Result    : ${plan.ok ? "ready" : "blocked"}`,
  ];

  return lines.join("\n");
}

export async function generatePlatformUninstallPlan(args: {
  apply?: unknown;
  manifestFile?: unknown;
  root?: unknown;
}): Promise<PlatformUninstallPlan> {
  const root = readOptionalString({ root: args.root }, "root") ?? process.cwd();
  const manifestFile = readOptionalString({ manifestFile: args.manifestFile }, "manifestFile");
  const apply = readBoolean({ apply: args.apply }, "apply");
  const dryRun = !apply;
  const manifest = await readInstallManifest({ projectRoot: root, manifestFile });
  const hookCommands = extractInstallManifestHookCommands(manifest);
  const result = apply
    ? await removePlatformConfig(manifest.target, manifest.expectedPaths.platformDirectory, {
        hookCommands,
      })
    : undefined;

  return {
    ok: true,
    action: "uninstall",
    root: manifest.expectedPaths.projectRoot,
    target: manifest.target,
    platformDirectory: manifest.expectedPaths.platformDirectory,
    manifestFile: manifest.expectedPaths.manifestFile,
    dryRun,
    apply,
    hooksPlanned: countSupportedManifestHooks(manifest),
    hooksRemoved: result?.hooksRemoved ?? 0,
    manifestRetained: true,
    ...(result ? { result } : {}),
  };
}

export async function generatePlatformRepairPlan(args: {
  apply?: unknown;
  manifestFile?: unknown;
  root?: unknown;
}): Promise<PlatformRepairPlan> {
  const root = readOptionalString({ root: args.root }, "root") ?? process.cwd();
  const manifestFile = readOptionalString({ manifestFile: args.manifestFile }, "manifestFile");
  const apply = readBoolean({ apply: args.apply }, "apply");
  const dryRun = !apply;
  const manifest = await readInstallManifest({ projectRoot: root, manifestFile });
  const hookCommands = extractInstallManifestHookCommands(manifest);
  const result = apply
    ? await applyPlatformConfig(manifest.target, manifest.expectedPaths.platformDirectory, {
        hookCommands,
      })
    : undefined;

  return {
    ok: true,
    action: "repair",
    root: manifest.expectedPaths.projectRoot,
    target: manifest.target,
    platformDirectory: manifest.expectedPaths.platformDirectory,
    manifestFile: manifest.expectedPaths.manifestFile,
    dryRun,
    apply,
    hooksPlanned: countSupportedManifestHooks(manifest),
    hooksAdded: result?.hooksAdded ?? 0,
    ...(result ? { result } : {}),
  };
}

export function formatPlatformUninstallHuman(plan: PlatformUninstallPlan): string {
  return [
    "Uninstall platform",
    `Mode              : ${plan.dryRun ? "dry-run" : "apply"}`,
    `Target            : ${plan.target}`,
    `Root              : ${plan.root}`,
    `Platform          : ${plan.platformDirectory}`,
    `Manifest          : ${plan.manifestFile}`,
    `Hooks planned     : ${plan.hooksPlanned}`,
    `Hooks removed     : ${plan.hooksRemoved}`,
    `Manifest retained : ${plan.manifestRetained ? "yes" : "no"}`,
    `Result            : ${plan.ok ? "ready" : "blocked"}`,
  ].join("\n");
}

export function formatPlatformRepairHuman(plan: PlatformRepairPlan): string {
  return [
    "Repair platform",
    `Mode          : ${plan.dryRun ? "dry-run" : "apply"}`,
    `Target        : ${plan.target}`,
    `Root          : ${plan.root}`,
    `Platform      : ${plan.platformDirectory}`,
    `Manifest      : ${plan.manifestFile}`,
    `Hooks planned : ${plan.hooksPlanned}`,
    `Hooks added   : ${plan.hooksAdded}`,
    `Result        : ${plan.ok ? "ready" : "blocked"}`,
  ].join("\n");
}

export async function generateLifecycleApplyPlan(args: {
  apply?: unknown;
  hookCommandPrefix?: unknown;
  kind?: unknown;
  root?: unknown;
  skipManifests?: unknown;
  target?: unknown;
}) {
  const target = parseArtifactInstallTarget(args.target);
  const kind = parseArtifactInstallSelection(args.kind ?? "all");
  const root = readOptionalString({ root: args.root }, "root") ?? process.cwd();
  const apply = readBoolean({ apply: args.apply }, "apply");
  const skipManifests = readBoolean({ skipManifests: args.skipManifests }, "skipManifests");
  const hookCommandPrefix = readOptionalString(
    { hookCommandPrefix: args.hookCommandPrefix },
    "hookCommandPrefix",
  );

  return applyRuntimeLifecycle({
    projectRoot: root,
    target,
    kind,
    apply,
    writeManifests: skipManifests ? false : undefined,
    hookCommandPrefix,
    platform: {
      apply: async (platformTarget, platformDirectory) =>
        applyPlatformConfig(platformTarget, platformDirectory, { hookCommandPrefix }),
    },
  });
}

export async function generateLifecycleRepairPlan(args: {
  apply?: unknown;
  kind?: unknown;
  manifestFile?: unknown;
  root?: unknown;
  skipManifests?: unknown;
}) {
  const kind = parseArtifactInstallSelection(args.kind ?? "all");
  const root = readOptionalString({ root: args.root }, "root") ?? process.cwd();
  const manifestFile = readOptionalString({ manifestFile: args.manifestFile }, "manifestFile");
  const apply = readBoolean({ apply: args.apply }, "apply");
  const skipManifests = readBoolean({ skipManifests: args.skipManifests }, "skipManifests");
  const manifest = apply
    ? await readInstallManifest({ projectRoot: root, manifestFile })
    : undefined;
  const hookCommands =
    manifest === undefined ? undefined : extractInstallManifestHookCommands(manifest);

  return repairRuntimeLifecycle({
    projectRoot: root,
    kind,
    manifestFile,
    apply,
    writeManifests: skipManifests ? false : undefined,
    platform: {
      apply: async (target, platformDirectory) =>
        applyPlatformConfig(target, platformDirectory, { hookCommands }),
    },
  });
}

export async function generateLifecycleUninstallPlan(args: {
  apply?: unknown;
  artifactManifestFile?: unknown;
  platformManifestFile?: unknown;
  root?: unknown;
}) {
  const root = readOptionalString({ root: args.root }, "root") ?? process.cwd();
  const platformManifestFile = readOptionalString(
    { platformManifestFile: args.platformManifestFile },
    "platformManifestFile",
  );
  const artifactManifestFile = readOptionalString(
    { artifactManifestFile: args.artifactManifestFile },
    "artifactManifestFile",
  );
  const apply = readBoolean({ apply: args.apply }, "apply");
  const manifest = apply
    ? await readInstallManifest({ projectRoot: root, manifestFile: platformManifestFile })
    : undefined;
  const hookCommands =
    manifest === undefined ? undefined : extractInstallManifestHookCommands(manifest);

  return uninstallRuntimeLifecycle({
    projectRoot: root,
    platformManifestFile,
    artifactManifestFile,
    apply,
    platform: {
      remove: async (target, platformDirectory) =>
        removePlatformConfig(target, platformDirectory, { hookCommands }),
    },
  });
}

export function formatLifecycleApplyHuman(
  plan: Awaited<ReturnType<typeof generateLifecycleApplyPlan>>,
): string {
  return [
    "Runtime lifecycle apply",
    `Mode                : ${plan.dryRun ? "dry-run" : "apply"}`,
    `Target              : ${plan.target}`,
    `Kind                : ${plan.kind}`,
    `Root                : ${plan.projectRoot}`,
    `Platform            : ${plan.platformDirectory}`,
    `Write manifests     : ${plan.writeManifests ? "yes" : "no"}`,
    `Platform manifest   : ${plan.platformInstall.manifestWritten ? plan.platformManifestFile : "not written"}`,
    `Artifact manifest   : ${"manifestFile" in plan.artifactInstall ? plan.artifactInstall.manifestFile : "not written"}`,
    `Artifacts planned   : ${plan.artifactInstall.actions.length}`,
    `Artifacts written   : ${plan.artifactsWritten.length}`,
    `Artifacts unchanged : ${plan.artifactsUnchanged.length}`,
    `Result              : ${plan.ok ? "ready" : "blocked"}`,
  ].join("\n");
}

export function formatLifecycleRepairHuman(
  plan: Awaited<ReturnType<typeof generateLifecycleRepairPlan>>,
): string {
  return [
    "Runtime lifecycle repair",
    `Mode                : ${plan.dryRun ? "dry-run" : "apply"}`,
    `Target              : ${plan.target}`,
    `Kind                : ${plan.kind}`,
    `Root                : ${plan.projectRoot}`,
    `Platform            : ${plan.platformDirectory}`,
    `Write manifests     : ${plan.writeManifests ? "yes" : "no"}`,
    `Artifact manifest   : ${"manifestFile" in plan.artifactInstall ? plan.artifactInstall.manifestFile : "not written"}`,
    `Artifacts planned   : ${plan.artifactInstall.actions.length}`,
    `Artifacts written   : ${plan.artifactsWritten.length}`,
    `Artifacts unchanged : ${plan.artifactsUnchanged.length}`,
    `Result              : ${plan.ok ? "ready" : "blocked"}`,
  ].join("\n");
}

export function formatLifecycleUninstallHuman(
  plan: Awaited<ReturnType<typeof generateLifecycleUninstallPlan>>,
): string {
  return [
    "Runtime lifecycle uninstall",
    `Mode              : ${plan.dryRun ? "dry-run" : "apply"}`,
    `Target            : ${plan.target}`,
    `Root              : ${plan.projectRoot}`,
    `Platform          : ${plan.platformDirectory}`,
    `Platform manifest : ${plan.platformManifestFile}`,
    `Artifact manifest : ${plan.artifactManifestFile}`,
    `Artifacts deleted : ${plan.artifactsDeleted.length}`,
    `Artifacts restored: ${plan.artifactsRestored.length}`,
    `Rollback blockers : ${plan.blockers.length}`,
    `Hooks removed     : ${plan.platformHooksRemoved ?? "unknown"}`,
    `Result            : ${plan.ok ? "ready" : "blocked"}`,
  ].join("\n");
}

export async function applyPlatformConfig(
  target: InstallTarget,
  platformDirectory: string,
  options: HookCommandOptions = {},
): Promise<
  | { target: "codex"; configFile: string; hooksAdded: number; featureFlagAdded: boolean }
  | { target: "claude"; settingsFile: string; hooksAdded: number }
  | { target: "hermes"; configFile: string; hooksAdded: number; pluginAdded: boolean }
> {
  if (target === "codex") {
    return applyCodexInstall({ root: platformDirectory, ...options });
  }

  if (target === "claude") {
    return applyClaudeInstall({ root: platformDirectory, ...options });
  }

  return applyHermesInstall({ root: platformDirectory, ...options });
}

export async function removePlatformConfig(
  target: InstallTarget,
  platformDirectory: string,
  options: HookCommandOptions = {},
): Promise<
  | { target: "codex"; configFile: string; hooksRemoved: number }
  | { target: "claude"; settingsFile: string; hooksRemoved: number }
  | { target: "hermes"; configFile: string; hooksRemoved: number; pluginRemoved: boolean }
> {
  if (target === "codex") {
    return removeCodexInstall({ root: platformDirectory, ...options });
  }

  if (target === "claude") {
    return removeClaudeInstall({ root: platformDirectory, ...options });
  }

  return removeHermesInstall({ root: platformDirectory, ...options });
}

function countSupportedManifestHooks(manifest: InstallManifest): number {
  return manifest.plannedActions.filter(
    (action) => action.kind === "register_hook" && action.supported !== false,
  ).length;
}

async function readJsonStdin(): Promise<unknown> {
  if (process.stdin.isTTY) {
    return {};
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    process.stdin.destroy(new Error("Timed out reading hook stdin."));
  }, HOOK_STDIN_TIMEOUT_MS);
  timeout.unref();

  try {
    for await (const chunk of process.stdin) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;

      if (totalBytes > MAX_HOOK_STDIN_BYTES) {
        throw new Error(`Hook stdin exceeds ${MAX_HOOK_STDIN_BYTES} bytes.`);
      }

      chunks.push(buffer);
    }
  } catch (error) {
    if (timedOut) {
      throw new Error(`Timed out reading hook stdin after ${HOOK_STDIN_TIMEOUT_MS}ms.`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
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

export async function runLocalSelfTest(options: {
  root: string;
  target?: string;
}): Promise<SelfTestResult> {
  const targets =
    options.target === undefined || options.target === "all"
      ? [...INSTALL_TARGETS]
      : [parseInstallTarget(options.target)];
  const results: SelfTestTargetResult[] = [];

  for (const target of targets) {
    const installResult = await installPlatform({
      projectRoot: options.root,
      target,
      dryRun: true,
      writeManifest: false,
    });
    const hookResult = await handleHook(options.root, "post_tool", {}, { dryRun: true });
    const bindings = getRuntimeHookProfiles(target);
    const unsupportedHooks = bindings
      .filter((binding) => !binding.supported)
      .map((binding) => binding.gateType);
    const degradedHooks = bindings
      .filter((binding) => binding.supported && !binding.canBlock)
      .map((binding) => binding.gateType);

    results.push({
      target,
      install: {
        status:
          installResult.plannedActions.some((action) => action.kind === "register_hook") &&
          !installResult.manifestWritten
            ? "pass"
            : "fail",
        hooksPlanned: installResult.plannedActions.filter(
          (action) => action.kind === "register_hook" && action.supported !== false,
        ).length,
        unsupportedHooks,
        degradedHooks,
        manifestWritten: installResult.manifestWritten,
      },
      hookDryRun: {
        status: hookResult.gateType === "post_tool" ? "pass" : "fail",
        decision: hookResult.decision,
        gateType: hookResult.gateType,
      },
      runtimeExecution: {
        status: "blocked_by_design",
        reason:
          "self-test is local only and never launches Claude, Codex, Hermes, or paid model sessions",
      },
    });
  }

  return {
    ok: results.every(
      (result) => result.install.status === "pass" && result.hookDryRun.status === "pass",
    ),
    root: options.root,
    externalRuntimeSessionsLaunched: false,
    targets: results,
  };
}

export function planBenchmarkRun(options: { instances?: unknown } = {}): BenchmarkPlanResult {
  const requestedInstances = parseBenchmarkInstanceCount(options.instances);

  return {
    ok: true,
    suite: "swe-bench-verified",
    requestedInstances,
    executionMode: "dry_run_plan",
    willLaunchExternalSessions: false,
    requiresExplicitAuthorization: true,
    plannedComparisons: [
      "baseline_without_hima_governance",
      "governed_with_hima_hooks_and_evidence",
    ],
    requiredEvidence: [
      "runtime_version",
      "fixture_or_instance_id",
      "baseline_transcript",
      "governed_transcript",
      "tests_before_after",
      "hima_events_or_ledger",
      "wall_clock_overhead",
      "token_or_cost_accounting",
    ],
    status: "blocked_until_authorized",
  };
}

export async function validateBenchmarkResultFile(filePath: string): Promise<{
  ok: true;
  file: string;
  suite: "swe-bench-verified";
  status: "planned" | "blocked" | "executed";
  instanceId: string;
  runtimeTarget: string;
  externalSessionsLaunched: false;
}> {
  const parsed = parseBenchmarkResult(JSON.parse(await readFile(filePath, "utf8")));

  return {
    ok: true,
    file: filePath,
    suite: parsed.suite,
    status: parsed.status,
    instanceId: parsed.instanceId,
    runtimeTarget: parsed.runtimeTarget,
    externalSessionsLaunched: false,
  };
}

export type BenchmarkWriteResult = {
  ok: true;
  file: string;
  result: BenchmarkResult;
  externalSessionsLaunched: false;
};

export async function writeBenchmarkResultArtifact(options: {
  root: string;
  status: unknown;
  instanceId: string;
  target: string;
  blockReason?: string;
  createdAt?: string;
}): Promise<BenchmarkWriteResult> {
  const status = parseBenchmarkWritableStatus(options.status);
  const runtimeTarget = parseInstallTarget(options.target);
  const instanceId = parseBenchmarkInstanceId(options.instanceId);
  const result = parseBenchmarkResult({
    schemaVersion: 1,
    suite: "swe-bench-verified",
    status,
    instanceId,
    runtimeTarget,
    createdAt: options.createdAt ?? new Date().toISOString(),
    ...(status === "blocked" ? { blockReason: options.blockReason } : {}),
  });
  const file = path.join(
    path.resolve(options.root),
    ".planning",
    "benchmarks",
    "swe-bench-verified",
    runtimeTarget,
    `${instanceId}.${status}.json`,
  );

  await safeAtomicWriteFile(
    path.resolve(options.root),
    file,
    `${JSON.stringify(result, null, 2)}\n`,
  );

  return {
    ok: true,
    file,
    result,
    externalSessionsLaunched: false,
  };
}

export async function validateBenchmarkAuthorizationFile(filePath: string): Promise<{
  ok: true;
  file: string;
  suite: "swe-bench-verified";
  status: "blocked" | "authorized";
  requestedInstances: number;
  runtimeTargets: string[];
  executionAllowed: boolean;
  externalSessionsLaunched: false;
}> {
  const parsed = parseBenchmarkAuthorization(JSON.parse(await readFile(filePath, "utf8")));

  return {
    ok: true,
    file: filePath,
    suite: parsed.suite,
    status: parsed.status,
    requestedInstances: parsed.requestedInstances,
    runtimeTargets: parsed.runtimeTargets,
    executionAllowed: parsed.status === "authorized",
    externalSessionsLaunched: false,
  };
}

export type BenchmarkAuthorizationWriteResult = {
  ok: true;
  file: string;
  authorization: BenchmarkAuthorization;
  executionAllowed: boolean;
  externalSessionsLaunched: false;
};

export async function writeBenchmarkAuthorizationArtifact(options: {
  root: string;
  status: unknown;
  instances?: unknown;
  targets?: string;
  blockReason?: string;
  authorizedBy?: string;
  authorizationId?: string;
  costBudgetUsd?: unknown;
  credentialScope?: string;
  evidenceRetentionPath?: string;
  transcriptRetentionPath?: string;
  createdAt?: string;
}): Promise<BenchmarkAuthorizationWriteResult> {
  const root = path.resolve(options.root);
  const status = parseBenchmarkAuthorizationStatus(options.status);
  const authorization = parseBenchmarkAuthorization({
    schemaVersion: 1,
    suite: "swe-bench-verified",
    status,
    requestedInstances: parseBenchmarkInstanceCount(options.instances),
    runtimeTargets: parseBenchmarkAuthorizationTargets(options.targets ?? "codex"),
    createdAt: options.createdAt ?? new Date().toISOString(),
    authorizationBoundary: "explicit_authorization_required_before_execution",
    ...(status === "blocked"
      ? { blockReason: options.blockReason }
      : {
          authorizedBy: options.authorizedBy,
          authorizationId: options.authorizationId,
          costBudgetUsd: parseOptionalPositiveNumber(options.costBudgetUsd, "costBudgetUsd"),
          credentialScope: options.credentialScope,
          evidenceRetentionPath: options.evidenceRetentionPath,
          transcriptRetentionPath: options.transcriptRetentionPath,
        }),
  });
  const file = path.join(
    root,
    ".planning",
    "benchmarks",
    "swe-bench-verified",
    "authorization.json",
  );

  await safeAtomicWriteFile(root, file, `${JSON.stringify(authorization, null, 2)}\n`);

  return {
    ok: true,
    file,
    authorization,
    executionAllowed: authorization.status === "authorized",
    externalSessionsLaunched: false,
  };
}

export async function checkBenchmarkExecutionPreflight(options: {
  root: string;
  authorizationFile?: string;
}): Promise<{
  ok: true;
  authorizationFile: string;
  status: "absent" | "blocked" | "authorized";
  executionAllowed: boolean;
  reason: string;
  externalSessionsLaunched: false;
}> {
  const root = path.resolve(options.root);
  const authorizationFile =
    options.authorizationFile ??
    path.join(root, ".planning", "benchmarks", "swe-bench-verified", "authorization.json");

  try {
    const validation = await validateBenchmarkAuthorizationFile(authorizationFile);
    return {
      ok: true,
      authorizationFile,
      status: validation.status,
      executionAllowed: validation.executionAllowed,
      reason: validation.executionAllowed
        ? "benchmark execution is explicitly authorized"
        : "benchmark execution is blocked by authorization artifact",
      externalSessionsLaunched: false,
    };
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return {
        ok: true,
        authorizationFile,
        status: "absent",
        executionAllowed: false,
        reason: "benchmark execution authorization artifact is absent",
        externalSessionsLaunched: false,
      };
    }

    throw error;
  }
}

export async function validateRuntimeParityAuthorizationFile(filePath: string): Promise<{
  ok: true;
  file: string;
  kind: "real-runtime-parity-authorization";
  status: "blocked" | "authorized";
  scenarioId: string;
  runtimeTargets: string[];
  executionAllowed: boolean;
  externalSessionsLaunched: false;
}> {
  const parsed = parseRuntimeParityAuthorization(JSON.parse(await readFile(filePath, "utf8")));

  return {
    ok: true,
    file: filePath,
    kind: parsed.kind,
    status: parsed.status,
    scenarioId: parsed.scenarioId,
    runtimeTargets: parsed.runtimeTargets,
    executionAllowed: parsed.status === "authorized",
    externalSessionsLaunched: false,
  };
}

export type RuntimeParityAuthorizationWriteResult = {
  ok: true;
  file: string;
  authorization: RuntimeParityAuthorization;
  executionAllowed: boolean;
  externalSessionsLaunched: false;
};

export async function writeRuntimeParityAuthorizationArtifact(options: {
  root: string;
  status: unknown;
  scenarioId: string;
  targets?: string;
  blockReason?: string;
  authorizedBy?: string;
  authorizationId?: string;
  costBudgetUsd?: unknown;
  credentialScope?: string;
  evidenceRetentionPath?: string;
  transcriptRetentionPath?: string;
  createdAt?: string;
}): Promise<RuntimeParityAuthorizationWriteResult> {
  const root = path.resolve(options.root);
  const status = parseRuntimeParityAuthorizationStatus(options.status);
  const authorization = parseRuntimeParityAuthorization({
    schemaVersion: 1,
    kind: "real-runtime-parity-authorization",
    status,
    scenarioId: parseRuntimeParityScenarioId(options.scenarioId),
    runtimeTargets: parseRuntimeTargets(options.targets ?? "claude,codex,hermes"),
    createdAt: options.createdAt ?? new Date().toISOString(),
    authorizationBoundary: "explicit_authorization_required_before_real_runtime_parity_execution",
    ...(status === "blocked"
      ? { blockReason: options.blockReason }
      : {
          authorizedBy: options.authorizedBy,
          authorizationId: options.authorizationId,
          costBudgetUsd: parseOptionalPositiveNumber(options.costBudgetUsd, "costBudgetUsd"),
          credentialScope: options.credentialScope,
          evidenceRetentionPath: options.evidenceRetentionPath,
          transcriptRetentionPath: options.transcriptRetentionPath,
        }),
  });
  const file = path.join(root, ".planning", "runtime-parity", "authorization.json");

  await safeAtomicWriteFile(root, file, `${JSON.stringify(authorization, null, 2)}\n`);

  return {
    ok: true,
    file,
    authorization,
    executionAllowed: authorization.status === "authorized",
    externalSessionsLaunched: false,
  };
}

export async function checkRuntimeParityExecutionPreflight(options: {
  root: string;
  authorizationFile?: string;
}): Promise<{
  ok: true;
  authorizationFile: string;
  status: "absent" | "blocked" | "authorized";
  executionAllowed: boolean;
  reason: string;
  externalSessionsLaunched: false;
}> {
  const root = path.resolve(options.root);
  const authorizationFile =
    options.authorizationFile ??
    path.join(root, ".planning", "runtime-parity", "authorization.json");

  try {
    const validation = await validateRuntimeParityAuthorizationFile(authorizationFile);
    return {
      ok: true,
      authorizationFile,
      status: validation.status,
      executionAllowed: validation.executionAllowed,
      reason: validation.executionAllowed
        ? "real runtime parity execution is explicitly authorized"
        : "real runtime parity execution is blocked by authorization artifact",
      externalSessionsLaunched: false,
    };
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return {
        ok: true,
        authorizationFile,
        status: "absent",
        executionAllowed: false,
        reason: "real runtime parity authorization artifact is absent",
        externalSessionsLaunched: false,
      };
    }

    throw error;
  }
}

export async function validateCompliancePackFile(filePath: string): Promise<{
  ok: true;
  file: string;
  kind: "developer-session-compliance-pack";
  status: "draft" | "blocked" | "assembled";
  sessionId: string;
  runtimeTarget: string;
  claimBoundary: "evidence_pack_not_compliance_certification";
  externalSessionsLaunched: false;
}> {
  const parsed = parseCompliancePack(JSON.parse(await readFile(filePath, "utf8")));

  return {
    ok: true,
    file: filePath,
    kind: parsed.kind,
    status: parsed.status,
    sessionId: parsed.sessionId,
    runtimeTarget: parsed.runtimeTarget,
    claimBoundary: parsed.claimBoundary,
    externalSessionsLaunched: false,
  };
}

export type CompliancePackWriteResult = {
  ok: true;
  file: string;
  pack: CompliancePack;
  externalSessionsLaunched: false;
};

export async function writeCompliancePackArtifact(options: {
  root: string;
  status: unknown;
  sessionId: string;
  target: string;
  riskClassificationPath?: string;
  runSetPath?: string;
  ledgerPath?: string;
  runtimeEvidencePath?: string;
  blockReason?: string;
  unavailableEvidence?: string;
  createdAt?: string;
}): Promise<CompliancePackWriteResult> {
  const status = parseCompliancePackWritableStatus(options.status);
  const runtimeTarget = parseInstallTarget(options.target);
  const sessionId = parseCompliancePackSessionId(options.sessionId);
  const pack = parseCompliancePack({
    schemaVersion: 1,
    kind: "developer-session-compliance-pack",
    status,
    sessionId,
    runtimeTarget,
    createdAt: options.createdAt ?? new Date().toISOString(),
    claimBoundary: "evidence_pack_not_compliance_certification",
    ...(status === "blocked"
      ? {
          blockReason: options.blockReason,
          unavailableEvidence: parseComplianceUnavailableEvidence(options.unavailableEvidence),
        }
      : {
          evidenceReferences: {
            riskClassificationPath: options.riskClassificationPath,
            runSetPath: options.runSetPath,
            ledgerPath: options.ledgerPath,
            runtimeEvidencePath: options.runtimeEvidencePath,
          },
        }),
  });
  const file = path.join(
    path.resolve(options.root),
    ".planning",
    "compliance-packs",
    `${sessionId}.${status}.json`,
  );

  await safeAtomicWriteFile(path.resolve(options.root), file, `${JSON.stringify(pack, null, 2)}\n`);

  return {
    ok: true,
    file,
    pack,
    externalSessionsLaunched: false,
  };
}

export type CompliancePackAssembleResult = CompliancePackWriteResult & {
  verifiedEvidencePaths: string[];
};

export async function assembleCompliancePackArtifact(options: {
  root: string;
  sessionId: string;
  target: string;
  riskClassificationPath: string;
  runSetPath: string;
  ledgerPath: string;
  runtimeEvidencePath: string;
  benchmarkResultPath: string;
  complianceMappingPath: string;
  siemFixturePath: string;
  createdAt?: string;
}): Promise<CompliancePackAssembleResult> {
  const root = path.resolve(options.root);
  const runtimeTarget = parseInstallTarget(options.target);
  const sessionId = parseCompliancePackSessionId(options.sessionId);
  const evidenceReferences = {
    riskClassificationPath: options.riskClassificationPath,
    runSetPath: options.runSetPath,
    ledgerPath: options.ledgerPath,
    runtimeEvidencePath: options.runtimeEvidencePath,
    benchmarkResultPath: options.benchmarkResultPath,
    complianceMappingPath: options.complianceMappingPath,
    siemFixturePath: options.siemFixturePath,
  };
  const verifiedEvidencePaths = await verifyComplianceEvidenceReferences(root, evidenceReferences);
  await verifyComplianceSiemFixtureReference(root, options.siemFixturePath);
  const pack = parseCompliancePack({
    schemaVersion: 1,
    kind: "developer-session-compliance-pack",
    status: "assembled",
    sessionId,
    runtimeTarget,
    createdAt: options.createdAt ?? new Date().toISOString(),
    claimBoundary: "evidence_pack_not_compliance_certification",
    evidenceReferences,
  });
  const file = path.join(root, ".planning", "compliance-packs", `${sessionId}.assembled.json`);

  await safeAtomicWriteFile(root, file, `${JSON.stringify(pack, null, 2)}\n`);

  return {
    ok: true,
    file,
    pack,
    verifiedEvidencePaths,
    externalSessionsLaunched: false,
  };
}

export type RuntimeParityFixtureValidationResult = {
  ok: boolean;
  parity: "pass" | "fail";
  fixtureScope: "synthetic_not_real_runtime";
  fixturesDir: string;
  expectedTargets: string[];
  observedTargets: string[];
  checkedFixtures: string[];
  errors: string[];
  externalSessionsLaunched: false;
};

export async function validateRuntimeParityFixtures(options: {
  root: string;
  fixturesDir: string;
}): Promise<RuntimeParityFixtureValidationResult> {
  const root = path.resolve(options.root);
  const fixturesDir = path.resolve(root, options.fixturesDir);
  const errors: string[] = [];
  const fixtures: RuntimeParityFixture[] = [];
  const checkedFixtures: string[] = [];

  let fileNames: string[];
  try {
    const entries = await readdir(fixturesDir, { withFileTypes: true });
    fileNames = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    return {
      ok: false,
      parity: "fail",
      fixtureScope: "synthetic_not_real_runtime",
      fixturesDir,
      expectedTargets: [...RUNTIME_TARGETS],
      observedTargets: [],
      checkedFixtures: [],
      errors: [`Unable to read runtime parity fixture directory: ${describeError(error)}`],
      externalSessionsLaunched: false,
    };
  }

  for (const fileName of fileNames) {
    const file = path.join(fixturesDir, fileName);
    const relativeFile = path.relative(root, file);
    checkedFixtures.push(relativeFile);

    try {
      fixtures.push(parseRuntimeParityFixture(JSON.parse(await readFile(file, "utf8"))));
    } catch (error) {
      errors.push(`${relativeFile}: ${describeError(error)}`);
    }
  }

  const byTarget = new Map<string, RuntimeParityFixture>();
  for (const fixture of fixtures) {
    if (byTarget.has(fixture.runtimeTarget)) {
      errors.push(`Duplicate runtime parity fixture for target ${fixture.runtimeTarget}.`);
      continue;
    }

    byTarget.set(fixture.runtimeTarget, fixture);
  }

  for (const target of RUNTIME_TARGETS) {
    if (!byTarget.has(target)) {
      errors.push(`Missing runtime parity fixture for target ${target}.`);
    }
  }

  const referenceTarget = RUNTIME_TARGETS.find((target) => byTarget.has(target));
  const referenceGovernance =
    referenceTarget === undefined ? undefined : byTarget.get(referenceTarget)?.governance;
  const referenceGovernanceDigest =
    referenceGovernance === undefined ? undefined : stableJson(referenceGovernance);

  for (const target of RUNTIME_TARGETS) {
    const fixture = byTarget.get(target);
    if (fixture === undefined || referenceGovernanceDigest === undefined) {
      continue;
    }

    if (stableJson(fixture.governance) !== referenceGovernanceDigest) {
      errors.push(
        `Governance parity mismatch for target ${target}; synthetic fixture shape differs from ${referenceTarget}.`,
      );
    }
  }

  return {
    ok: errors.length === 0,
    parity: errors.length === 0 ? "pass" : "fail",
    fixtureScope: "synthetic_not_real_runtime",
    fixturesDir,
    expectedTargets: [...RUNTIME_TARGETS],
    observedTargets: [...byTarget.keys()].sort(),
    checkedFixtures,
    errors,
    externalSessionsLaunched: false,
  };
}

function parseBenchmarkInstanceCount(input: unknown): number {
  const parsed = Number.parseInt(String(input ?? "10"), 10);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) {
    throw new Error("instances must be an integer between 1 and 20.");
  }

  return parsed;
}

function parseBenchmarkWritableStatus(input: unknown): "planned" | "blocked" {
  if (input === "planned" || input === "blocked") {
    return input;
  }

  throw new Error("benchmark write status must be planned or blocked.");
}

function parseBenchmarkAuthorizationStatus(input: unknown): "blocked" | "authorized" {
  if (input === "blocked" || input === "authorized") {
    return input;
  }

  throw new Error("benchmark authorization status must be blocked or authorized.");
}

function parseRuntimeParityAuthorizationStatus(input: unknown): "blocked" | "authorized" {
  if (input === "blocked" || input === "authorized") {
    return input;
  }

  throw new Error("runtime parity authorization status must be blocked or authorized.");
}

function parseBenchmarkAuthorizationTargets(input: string): string[] {
  return parseRuntimeTargets(input);
}

function parseRuntimeTargets(input: string): string[] {
  const targets = input
    .split(",")
    .map((target) => target.trim())
    .filter((target) => target.length > 0);

  if (targets.length === 0) {
    throw new Error("targets must include at least one runtime target.");
  }

  for (const target of targets) {
    parseInstallTarget(target);
  }

  return targets;
}

function parseRuntimeParityScenarioId(input: string): string {
  const normalized = input.trim();
  if (/^[A-Za-z0-9._-]+$/u.test(normalized)) {
    return normalized;
  }

  throw new Error(
    "runtime parity scenarioId may contain only letters, numbers, dot, underscore, or dash.",
  );
}

function parseBenchmarkInstanceId(input: string): string {
  const normalized = input.trim();
  if (/^[A-Za-z0-9._-]+$/u.test(normalized)) {
    return normalized;
  }

  throw new Error(
    "benchmark instanceId may contain only letters, numbers, dot, underscore, or dash.",
  );
}

function parseCompliancePackWritableStatus(input: unknown): "draft" | "blocked" {
  if (input === "draft" || input === "blocked") {
    return input;
  }

  throw new Error("compliance pack write status must be draft or blocked.");
}

function parseCompliancePackSessionId(input: string): string {
  const normalized = input.trim();
  if (/^[A-Za-z0-9._-]+$/u.test(normalized)) {
    return normalized;
  }

  throw new Error(
    "compliance pack sessionId may contain only letters, numbers, dot, underscore, or dash.",
  );
}

function parseComplianceUnavailableEvidence(input: string | undefined): string[] {
  const parsed = input
    ?.split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return parsed && parsed.length > 0
    ? parsed
    : ["runtime-session-evidence", "benchmark-result", "compliance-mapping"];
}

async function verifyComplianceEvidenceReferences(
  root: string,
  references: Record<string, string>,
): Promise<string[]> {
  const verified: string[] = [];

  for (const [name, referencePath] of Object.entries(references)) {
    const absolutePath = resolveComplianceEvidencePath(root, referencePath, name);

    try {
      await access(absolutePath);
    } catch (error) {
      if (isNodeErrorWithCode(error, "ENOENT")) {
        throw new Error(`Missing compliance pack evidence reference ${name}: ${referencePath}`);
      }

      throw error;
    }

    verified.push(referencePath);
  }

  return verified;
}

function resolveComplianceEvidencePath(root: string, referencePath: string, name: string): string {
  if (path.isAbsolute(referencePath)) {
    throw new Error(`Compliance pack evidence reference ${name} must be relative to root.`);
  }

  const absolutePath = path.resolve(root, referencePath);
  const relativePath = path.relative(root, absolutePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Compliance pack evidence reference ${name} must stay inside root.`);
  }

  return absolutePath;
}

async function verifyComplianceSiemFixtureReference(
  root: string,
  siemFixturePath: string,
): Promise<void> {
  const absolutePath = resolveComplianceEvidencePath(root, siemFixturePath, "siemFixturePath");

  try {
    parseSiemIngestFixture(JSON.parse(await readFile(absolutePath, "utf8")));
  } catch (error) {
    throw new Error(
      `Invalid compliance pack SIEM fixture reference siemFixturePath: ${describeError(error)}`,
    );
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

export function formatEnterDevelopmentHuman(
  result: Awaited<ReturnType<typeof enterDevelopment>>,
): string {
  return [
    "Development entry",
    `Run ID     : ${result.runId}`,
    `From       : ${result.previous.phase}/${result.previous.subPhase ?? "none"} ${result.previous.mode} ${result.previous.riskClass}`,
    `To         : ${result.current.phase}/${result.current.subPhase} ${result.current.mode} ${result.current.riskClass}`,
    `Objective  : ${result.objective ?? "none"}`,
    "Result     : active",
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

export function formatSelfTestHuman(result: SelfTestResult): string {
  return [
    "Local self-test",
    `Root                         : ${result.root}`,
    `External runtime sessions    : ${result.externalRuntimeSessionsLaunched ? "launched" : "not launched"}`,
    `Overall                      : ${result.ok ? "pass" : "fail"}`,
    "",
    ...result.targets.flatMap((target) => [
      `${target.target}: install=${target.install.status}, hooks=${target.install.hooksPlanned}, hookDryRun=${target.hookDryRun.status}, runtime=${target.runtimeExecution.status}`,
    ]),
  ].join("\n");
}

export function formatStressFixtureHuman(result: LocalStressFixtureResult): string {
  return [
    "Local stress fixture",
    `Run id                       : ${result.runId}`,
    `Iterations                   : ${result.iterations}`,
    `Ledger entries               : ${result.ledgerEntries}`,
    `Ledger valid                 : ${result.validation.ledgerValid ? "yes" : "no"}`,
    `Sequence valid               : ${result.validation.sequenceValid ? "yes" : "no"}`,
    `Transition order valid       : ${result.validation.transitionOrderValid ? "yes" : "no"}`,
    `Drift detected              : ${result.driftDetected ? "yes" : "no"}`,
    `External sessions            : not launched`,
    `Overall                      : ${result.ok ? "pass" : "fail"}`,
  ].join("\n");
}

export function formatSiemFixtureHuman(result: LocalSiemFixtureResult): string {
  return [
    "Local SIEM ingest fixture",
    `Run id                       : ${result.runId}`,
    `Fixture file                 : ${result.fixtureFile}`,
    `Records                      : ${result.records}`,
    `Ledger valid                 : ${result.ledgerValid ? "yes" : "no"}`,
    `External transmissions       : not sent`,
    `External sessions            : not launched`,
    `Overall                      : ${result.ok ? "pass" : "fail"}`,
  ].join("\n");
}

export function formatBenchmarkPlanHuman(result: BenchmarkPlanResult): string {
  return [
    "Benchmark plan",
    `Suite                        : ${result.suite}`,
    `Requested instances          : ${result.requestedInstances}`,
    `Execution mode               : ${result.executionMode}`,
    `External sessions            : ${result.willLaunchExternalSessions ? "will launch" : "not launched"}`,
    `Status                       : ${result.status}`,
    `Requires authorization       : ${result.requiresExplicitAuthorization ? "yes" : "no"}`,
  ].join("\n");
}

export function formatBenchmarkValidationHuman(
  result: Awaited<ReturnType<typeof validateBenchmarkResultFile>>,
): string {
  return [
    "Benchmark result validation",
    `File                         : ${result.file}`,
    `Suite                        : ${result.suite}`,
    `Status                       : ${result.status}`,
    `Instance                     : ${result.instanceId}`,
    `Runtime target               : ${result.runtimeTarget}`,
    `External sessions            : ${result.externalSessionsLaunched ? "launched" : "not launched"}`,
  ].join("\n");
}

export function formatBenchmarkWriteHuman(result: BenchmarkWriteResult): string {
  return [
    "Benchmark result written",
    `File                         : ${result.file}`,
    `Suite                        : ${result.result.suite}`,
    `Status                       : ${result.result.status}`,
    `Instance                     : ${result.result.instanceId}`,
    `Runtime target               : ${result.result.runtimeTarget}`,
    `External sessions            : ${result.externalSessionsLaunched ? "launched" : "not launched"}`,
  ].join("\n");
}

export function formatBenchmarkAuthorizationValidationHuman(
  result: Awaited<ReturnType<typeof validateBenchmarkAuthorizationFile>>,
): string {
  return [
    "Benchmark authorization validation",
    `File                         : ${result.file}`,
    `Suite                        : ${result.suite}`,
    `Status                       : ${result.status}`,
    `Requested instances          : ${result.requestedInstances}`,
    `Runtime targets              : ${result.runtimeTargets.join(", ")}`,
    `Execution allowed            : ${result.executionAllowed ? "yes" : "no"}`,
    `External sessions            : ${result.externalSessionsLaunched ? "launched" : "not launched"}`,
  ].join("\n");
}

export function formatBenchmarkAuthorizationWriteHuman(
  result: BenchmarkAuthorizationWriteResult,
): string {
  return [
    "Benchmark authorization written",
    `File                         : ${result.file}`,
    `Suite                        : ${result.authorization.suite}`,
    `Status                       : ${result.authorization.status}`,
    `Requested instances          : ${result.authorization.requestedInstances}`,
    `Runtime targets              : ${result.authorization.runtimeTargets.join(", ")}`,
    `Execution allowed            : ${result.executionAllowed ? "yes" : "no"}`,
    `External sessions            : ${result.externalSessionsLaunched ? "launched" : "not launched"}`,
  ].join("\n");
}

export function formatBenchmarkExecutionPreflightHuman(
  result: Awaited<ReturnType<typeof checkBenchmarkExecutionPreflight>>,
): string {
  return [
    "Benchmark execution preflight",
    `Authorization file            : ${result.authorizationFile}`,
    `Status                       : ${result.status}`,
    `Execution allowed            : ${result.executionAllowed ? "yes" : "no"}`,
    `Reason                       : ${result.reason}`,
    `External sessions            : ${result.externalSessionsLaunched ? "launched" : "not launched"}`,
  ].join("\n");
}

export function formatRuntimeParityAuthorizationValidationHuman(
  result: Awaited<ReturnType<typeof validateRuntimeParityAuthorizationFile>>,
): string {
  return [
    "Runtime parity authorization validation",
    `File                         : ${result.file}`,
    `Kind                         : ${result.kind}`,
    `Status                       : ${result.status}`,
    `Scenario                     : ${result.scenarioId}`,
    `Runtime targets              : ${result.runtimeTargets.join(", ")}`,
    `Execution allowed            : ${result.executionAllowed ? "yes" : "no"}`,
    `External sessions            : ${result.externalSessionsLaunched ? "launched" : "not launched"}`,
  ].join("\n");
}

export function formatRuntimeParityAuthorizationWriteHuman(
  result: RuntimeParityAuthorizationWriteResult,
): string {
  return [
    "Runtime parity authorization written",
    `File                         : ${result.file}`,
    `Kind                         : ${result.authorization.kind}`,
    `Status                       : ${result.authorization.status}`,
    `Scenario                     : ${result.authorization.scenarioId}`,
    `Runtime targets              : ${result.authorization.runtimeTargets.join(", ")}`,
    `Execution allowed            : ${result.executionAllowed ? "yes" : "no"}`,
    `External sessions            : ${result.externalSessionsLaunched ? "launched" : "not launched"}`,
  ].join("\n");
}

export function formatRuntimeParityExecutionPreflightHuman(
  result: Awaited<ReturnType<typeof checkRuntimeParityExecutionPreflight>>,
): string {
  return [
    "Runtime parity execution preflight",
    `Authorization file            : ${result.authorizationFile}`,
    `Status                       : ${result.status}`,
    `Execution allowed            : ${result.executionAllowed ? "yes" : "no"}`,
    `Reason                       : ${result.reason}`,
    `External sessions            : ${result.externalSessionsLaunched ? "launched" : "not launched"}`,
  ].join("\n");
}

export function formatCompliancePackValidationHuman(
  result: Awaited<ReturnType<typeof validateCompliancePackFile>>,
): string {
  return [
    "Compliance pack validation",
    `File                         : ${result.file}`,
    `Kind                         : ${result.kind}`,
    `Status                       : ${result.status}`,
    `Session                      : ${result.sessionId}`,
    `Runtime target               : ${result.runtimeTarget}`,
    `Claim boundary               : ${result.claimBoundary}`,
    `External sessions            : ${result.externalSessionsLaunched ? "launched" : "not launched"}`,
  ].join("\n");
}

export function formatCompliancePackWriteHuman(result: CompliancePackWriteResult): string {
  return [
    "Compliance pack written",
    `File                         : ${result.file}`,
    `Kind                         : ${result.pack.kind}`,
    `Status                       : ${result.pack.status}`,
    `Session                      : ${result.pack.sessionId}`,
    `Runtime target               : ${result.pack.runtimeTarget}`,
    `Claim boundary               : ${result.pack.claimBoundary}`,
    `External sessions            : ${result.externalSessionsLaunched ? "launched" : "not launched"}`,
  ].join("\n");
}

export function formatCompliancePackAssembleHuman(result: CompliancePackAssembleResult): string {
  return [
    "Compliance pack assembled",
    `File                         : ${result.file}`,
    `Kind                         : ${result.pack.kind}`,
    `Status                       : ${result.pack.status}`,
    `Session                      : ${result.pack.sessionId}`,
    `Runtime target               : ${result.pack.runtimeTarget}`,
    `Claim boundary               : ${result.pack.claimBoundary}`,
    `Verified evidence references : ${result.verifiedEvidencePaths.length}`,
    `External sessions            : ${result.externalSessionsLaunched ? "launched" : "not launched"}`,
  ].join("\n");
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
    `Hooks     : ${result.hooks.length}`,
    `Subagents : ${result.subagents.length}`,
  ].join("\n");
}

function formatCatalogJson(result: ReturnType<typeof getOperationalCatalog>) {
  return {
    skills: result.skills,
    hooks: result.hooks,
    subagents: result.subagents,
  };
}

export function formatRuntimeDigestHuman(result: {
  target: InstallTarget;
  runtimeVersion?: string;
  digest: string;
}): string {
  return [
    `Runtime target  : ${result.target}`,
    ...(result.runtimeVersion ? [`Runtime version : ${result.runtimeVersion}`] : []),
    `Digest          : ${result.digest}`,
  ].join("\n");
}

export function formatRuntimeInspectHuman(result: RuntimeCapability): string {
  return [
    `Runtime target : ${result.target}`,
    `Runtime name   : ${result.runtimeName}`,
    ...(result.runtimeVersion ? [`Runtime ver.   : ${result.runtimeVersion}`] : []),
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
    ...(bindings[0]?.runtimeVersion ? [`Runtime ver.   : ${bindings[0].runtimeVersion}`] : []),
    `Native gates   : ${nativeCount}`,
    `Stale gates    : ${staleCount}`,
    `Missing gates  : ${missingCount}`,
  ].join("\n");
}

export function formatRuntimeProbeHuman(result: RuntimeProbeResult): string {
  const nativeCount = Object.values(result.bindings ?? {}).filter(
    (binding) => binding.status === "native",
  ).length;

  return [
    `Runtime target   : ${result.target}`,
    `Runtime version  : ${result.runtimeVersion}`,
    `Config read      : ${result.configRead ? "yes" : "no"}`,
    `Manifest read    : ${result.manifestRead ? "yes" : "no"}`,
    `Profile digest   : ${result.profileDigest}`,
    ...(result.configDigest ? [`Config digest    : ${result.configDigest}`] : []),
    `Registered hooks : ${result.registeredHooks.length}`,
    `Missing hooks    : ${result.missingHooks.length}`,
    `Native gates     : ${result.bindings ? nativeCount : "not bound"}`,
  ].join("\n");
}

export function formatRuntimeParityFixturesHuman(
  result: RuntimeParityFixtureValidationResult,
): string {
  return [
    "Runtime parity fixtures",
    `Parity                      : ${result.parity}`,
    `Fixture scope               : ${result.fixtureScope}`,
    `Expected targets            : ${result.expectedTargets.join(", ")}`,
    `Observed targets            : ${result.observedTargets.join(", ") || "none"}`,
    `Checked fixtures            : ${result.checkedFixtures.length}`,
    `External sessions           : not launched`,
    `Errors                      : ${result.errors.length === 0 ? "none" : result.errors.join("\n                              ")}`,
  ].join("\n");
}

export function formatRouteRuntimeAssessmentHuman(
  result: RuntimeBindingHealth & { activeTarget?: string | null; riskClass?: string },
): string {
  return [
    "Route runtime assessment",
    ...(result.riskClass ? [`RiskClass  : ${result.riskClass}`] : []),
    `Target     : ${result.activeTarget ?? "unknown"}`,
    `Healthy    : ${result.healthy ? "yes" : "no"}`,
    `Required   : ${result.requiredGates.length === 0 ? "none" : result.requiredGates.join(", ")}`,
    `Gaps       : ${result.gaps.length === 0 ? "none" : result.gaps.join("\n             ")}`,
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

  const value =
    typeof input === "number" ? input : parseStrictNumericString(input, name, /^[-+]?[0-9]+$/);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }

  return value;
}

function parseOptionalPercent(input: unknown, name: string): number | undefined {
  if (input === undefined || input === null || input === "") {
    return undefined;
  }

  const value =
    typeof input === "number"
      ? input
      : parseStrictNumericString(input, name, /^[-+]?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${name} must be a number from 0 to 100.`);
  }

  return value;
}

function parseOptionalPositiveNumber(input: unknown, name: string): number | undefined {
  if (input === undefined || input === null || input === "") {
    return undefined;
  }

  const value =
    typeof input === "number"
      ? input
      : parseStrictNumericString(input, name, /^[-+]?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number.`);
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
  const value = args[name];

  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === "boolean") {
    return value;
  }

  throw new Error(`${name} must be a boolean.`);
}

function parseStrictNumericString(input: unknown, name: string, pattern: RegExp): number {
  if (typeof input !== "string") {
    throw new Error(`${name} must be a number.`);
  }

  const normalized = input.trim();
  if (!pattern.test(normalized)) {
    throw new Error(`${name} must be a number.`);
  }

  return Number(normalized);
}

function stableJson(input: unknown): string {
  if (Array.isArray(input)) {
    return `[${input.map(stableJson).join(",")}]`;
  }

  if (input !== null && typeof input === "object") {
    const entries = Object.entries(input as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${JSON.stringify(key)}:${stableJson(value)}`);

    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(input);
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

export function getCliCommandSurface(): CliCommandSurfaceEntry[] {
  return collectCliCommandSurface(main, ["harness"]);
}

function collectCliCommandSurface(
  commandInput: unknown,
  pathSegments: string[],
): CliCommandSurfaceEntry[] {
  const command = readCommandSurfaceShape(commandInput);
  const meta = readRecord(command.meta);
  const subCommands = readRecord(command.subCommands);
  const entry = {
    command: pathSegments.join(" "),
    description: typeof meta.description === "string" ? meta.description : "",
    hasSubCommands: Object.keys(subCommands).length > 0,
  };
  const subEntries = Object.entries(subCommands).flatMap(([name, subCommand]) =>
    collectCliCommandSurface(subCommand, [...pathSegments, name]),
  );

  return [entry, ...subEntries];
}

function readCommandSurfaceShape(commandInput: unknown): {
  meta?: unknown;
  subCommands?: unknown;
} {
  return readRecord(commandInput);
}

function readRecord(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

export { main };
