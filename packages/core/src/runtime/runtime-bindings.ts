import { createHash } from "node:crypto";
import {
  RunSetFileSchema,
  type RuntimeBinding,
  type RuntimeBindingStatus,
  type RuntimeCapability,
  type RuntimeCapabilityStatus,
  type RuntimeHookCapability,
  type RuntimeHookCapabilityInput,
  type RuntimeProbeEvidence,
} from "../schemas/run-set.schema.js";
import { redactSecrets } from "../security/redaction.js";
import { writeJsonFile } from "../storage/json.js";
import { getPlanningPaths } from "../storage/planning-paths.js";
import { readPlanningProject } from "../storage/planning-store.js";
import { GATE_TYPES, type GateType } from "../types/canonical.js";
import { getRuntimeProfile, isRuntimeTarget } from "./runtime-profiles.js";
import {
  DEFAULT_TRUSTED_RUNTIME_PROOF_MAX_AGE_MS,
  isTrustedRuntimeProof,
  normalizeRuntimeProofTrust,
} from "./runtime-proofs.js";

export interface InspectRuntimeInput {
  runtimeName?: string;
  runtimeVersion?: string;
  status?: RuntimeCapabilityStatus;
  inspectedAt?: string;
  configDigest?: string;
  hooks?: Partial<Record<GateType, RuntimeHookCapabilityInput>>;
  knownLimitations?: string[];
}

export interface BindRuntimeInput {
  inspectedAt?: string;
  expectedDigest?: string;
  currentDigest?: string;
  expectedHookDigests?: Partial<Record<GateType, string>>;
  currentHookDigests?: Partial<Record<GateType, string>>;
}

export interface RuntimeBindingAssessment {
  binding: RuntimeBinding;
  enforceable: boolean;
  blockingProblem: boolean;
  availabilityProblem: boolean;
  blockingCapabilityRequired: boolean;
}

export interface RuntimeBindingAssessmentOptions {
  readonly requireBlockingCapability?: boolean;
}

const BLOCKING_STATUSES = new Set<RuntimeBindingStatus>([
  "missing",
  "stale",
  "noop",
  "capability_unknown",
]);

const DIGEST_ALGORITHM = "sha256";
const BLOCKING_RUNTIME_PROOF_TYPES = new Set(["negative_fixture", "event_fire"]);

export async function inspectRuntime(
  projectRoot: string,
  target: string,
  input: InspectRuntimeInput = {},
): Promise<RuntimeCapability> {
  return inspectRuntimeInternal(projectRoot, target, input, false);
}

export async function inspectRuntimeWithTrustedProofs(
  projectRoot: string,
  target: string,
  input: InspectRuntimeInput = {},
): Promise<RuntimeCapability> {
  return inspectRuntimeInternal(projectRoot, target, input, true);
}

async function inspectRuntimeInternal(
  projectRoot: string,
  target: string,
  input: InspectRuntimeInput,
  trustedProofInput: boolean,
): Promise<RuntimeCapability> {
  const project = await readPlanningProject(projectRoot);
  const paths = getPlanningPaths(projectRoot);
  const capability = buildRuntimeCapability(target, input, trustedProofInput);
  const runSet = {
    ...project.runSet,
    runtimeCapabilities: {
      ...project.runSet.runtimeCapabilities,
      [target]: capability,
    },
  };

  await writeJsonFile(paths.runSetFile, runSet, RunSetFileSchema);
  return capability;
}

export async function bindRuntime(
  projectRoot: string,
  target: string,
  input: BindRuntimeInput = {},
): Promise<Record<GateType, RuntimeBinding>> {
  const project = await readPlanningProject(projectRoot);
  const paths = getPlanningPaths(projectRoot);
  const inspectedAt = input.inspectedAt ?? new Date().toISOString();
  const bindings = buildRuntimeBindings(
    target,
    project.runSet.runtimeCapabilities[target],
    inspectedAt,
    input,
  );
  const runSet = {
    ...project.runSet,
    runtimeBindings: {
      ...project.runSet.runtimeBindings,
      activeTarget: target,
      gates: bindings,
    },
  };

  await writeJsonFile(paths.runSetFile, runSet, RunSetFileSchema);
  return bindings;
}

export function assessRuntimeBinding(
  runtimeBindings: unknown,
  gateType: GateType,
  options: RuntimeBindingAssessmentOptions = {},
): RuntimeBindingAssessment {
  const binding = readBinding(runtimeBindings, gateType);
  const availabilityProblem = BLOCKING_STATUSES.has(binding.status);
  const blockingCapabilityRequired = options.requireBlockingCapability ?? false;
  const blockingProblem = availabilityProblem || (blockingCapabilityRequired && !binding.canBlock);

  return {
    binding,
    enforceable: !blockingProblem,
    blockingProblem,
    availabilityProblem,
    blockingCapabilityRequired,
  };
}

export function buildRuntimeBindings(
  target: string,
  capability: RuntimeCapability | undefined,
  inspectedAt = new Date().toISOString(),
  digestCheck: BindRuntimeInput = {},
): Record<GateType, RuntimeBinding> {
  return Object.fromEntries(
    GATE_TYPES.map((gateType) => [
      gateType,
      buildRuntimeBinding(
        target,
        gateType,
        capability,
        capability?.hooks[gateType],
        inspectedAt,
        digestCheck,
      ),
    ]),
  ) as Record<GateType, RuntimeBinding>;
}

export function computeRuntimeProfileDigest(target: string): string {
  const normalizedTarget = target.toLowerCase();
  if (!isRuntimeTarget(normalizedTarget)) {
    return computeDigest({ target: normalizedTarget, hooks: {} });
  }

  const profile = getRuntimeProfile(normalizedTarget);
  return computeDigest({
    target: profile.target,
    runtimeVersion: profile.runtimeVersion,
    hooks: Object.fromEntries(
      GATE_TYPES.map((gateType) => {
        const hook = profile.hooks[gateType];
        return [
          gateType,
          {
            nativeEvent: hook.nativeEvent,
            canBlock: hook.canBlock,
            supported: hook.supported,
            command: hook.command,
          },
        ];
      }),
    ),
  });
}

export function computeRuntimeHookDigest(target: string, gateType: GateType): string {
  const normalizedTarget = target.toLowerCase();
  if (!isRuntimeTarget(normalizedTarget)) {
    return computeDigest({ target: normalizedTarget, gateType, hook: null });
  }

  const hook = getRuntimeProfile(normalizedTarget).hooks[gateType];
  return computeDigest({
    target: normalizedTarget,
    gateType,
    hook: {
      nativeEvent: hook.nativeEvent,
      canBlock: hook.canBlock,
      supported: hook.supported,
      command: hook.command,
    },
  });
}

function buildRuntimeCapability(
  target: string,
  input: InspectRuntimeInput,
  trustedProofInput: boolean,
): RuntimeCapability {
  const inspectedAt = input.inspectedAt ?? new Date().toISOString();
  const runtimeName = input.runtimeName ?? target;
  const runtimeVersion = input.runtimeVersion ?? getDefaultRuntimeVersion(target);
  const hookInputs = getRuntimeHookCapabilityInputs(target, input.hooks, trustedProofInput);
  const defaultDigest = getDefaultRuntimeDigest(target);
  const hooks = Object.fromEntries(
    GATE_TYPES.map((gateType) => [
      gateType,
      buildHookCapability(gateType, hookInputs[gateType], inspectedAt),
    ]),
  ) as Record<GateType, RuntimeHookCapability>;

  return {
    target,
    runtimeName,
    ...(runtimeVersion ? { runtimeVersion } : {}),
    status: input.status ?? "available",
    inspectedAt,
    configDigest: input.configDigest ?? defaultDigest,
    hooks,
    knownLimitations: redactStringArray(input.knownLimitations ?? []),
  };
}

function getDefaultRuntimeDigest(target: string): string | undefined {
  const normalizedTarget = target.toLowerCase();
  return isRuntimeTarget(normalizedTarget)
    ? computeRuntimeProfileDigest(normalizedTarget)
    : undefined;
}

function getDefaultRuntimeVersion(target: string): string | undefined {
  const normalizedTarget = target.toLowerCase();
  return isRuntimeTarget(normalizedTarget)
    ? getRuntimeProfile(normalizedTarget).runtimeVersion
    : undefined;
}

function getDefaultRuntimeHooks(
  target: string,
): Partial<Record<GateType, RuntimeHookCapabilityInput>> {
  const normalizedTarget = target.toLowerCase();
  if (!isRuntimeTarget(normalizedTarget)) {
    return {};
  }

  const profile = getRuntimeProfile(normalizedTarget);
  return Object.fromEntries(
    GATE_TYPES.map((gateType) => {
      const hook = profile.hooks[gateType];
      return [
        gateType,
        {
          nativeEvent: hook.nativeEvent,
          canBlock: hook.canBlock,
          status: hook.supported ? "available" : "missing",
          configDigest: computeRuntimeHookDigest(normalizedTarget, gateType),
        },
      ];
    }),
  ) as Record<GateType, RuntimeHookCapabilityInput>;
}

function getRuntimeHookCapabilityInputs(
  target: string,
  hookInputs: Partial<Record<GateType, RuntimeHookCapabilityInput>> | undefined,
  trustedInput: boolean,
): Partial<Record<GateType, RuntimeHookCapabilityInput>> {
  const defaults = getDefaultRuntimeHooks(target);
  const normalizedTarget = target.toLowerCase();

  if (!isRuntimeTarget(normalizedTarget)) {
    return Object.fromEntries(
      GATE_TYPES.map((gateType) => [
        gateType,
        sanitizeCustomHookCapabilityInput(hookInputs?.[gateType], trustedInput),
      ]),
    ) as Partial<Record<GateType, RuntimeHookCapabilityInput>>;
  }

  return Object.fromEntries(
    GATE_TYPES.map((gateType) => {
      const defaultHook = defaults[gateType];
      const hookInput = hookInputs?.[gateType];

      if (!hookInput) {
        return [gateType, defaultHook];
      }

      return [
        gateType,
        {
          ...defaultHook,
          status: getConservativeKnownHookStatus(defaultHook?.status, hookInput.status),
          configDigest:
            trustedInput && hookInput.configDigest
              ? hookInput.configDigest
              : defaultHook?.configDigest,
          proofs: normalizeRuntimeProofs(hookInput.proofs, trustedInput),
          notes: hookInput.notes,
        },
      ];
    }),
  ) as Partial<Record<GateType, RuntimeHookCapabilityInput>>;
}

function sanitizeCustomHookCapabilityInput(
  input: RuntimeHookCapabilityInput | undefined,
  trustedInput: boolean,
): RuntimeHookCapabilityInput {
  return {
    status: input?.status === "missing" ? "missing" : "unknown",
    nativeEvent: null,
    canBlock: false,
    ...(input?.configDigest ? { configDigest: input.configDigest } : {}),
    ...(input?.proofs ? { proofs: normalizeRuntimeProofs(input.proofs, trustedInput) } : {}),
    ...(input?.notes ? { notes: redactStringArray(input.notes) } : {}),
  };
}

function getConservativeKnownHookStatus(
  defaultStatus: RuntimeCapabilityStatus | undefined,
  inputStatus: RuntimeCapabilityStatus | undefined,
): RuntimeCapabilityStatus | undefined {
  if (!inputStatus || inputStatus === "available") {
    return defaultStatus;
  }

  if (defaultStatus === "missing") {
    return "missing";
  }

  return inputStatus;
}

function buildHookCapability(
  gateType: GateType,
  input: RuntimeHookCapabilityInput | undefined,
  inspectedAt: string,
): RuntimeHookCapability {
  const nativeEvent = input?.nativeEvent ?? null;
  const status = input?.status ?? (nativeEvent ? "available" : "unknown");

  return {
    gateType,
    nativeEvent,
    canBlock: input?.canBlock ?? false,
    status,
    inspectedAt,
    ...(input?.configDigest ? { configDigest: input.configDigest } : {}),
    ...(input?.proofs ? { proofs: redactRuntimeProofs(input.proofs) } : {}),
    ...(input?.notes ? { notes: redactStringArray(input.notes) } : {}),
  };
}

function buildRuntimeBinding(
  target: string,
  gateType: GateType,
  runtimeCapability: RuntimeCapability | undefined,
  capability: RuntimeHookCapability | undefined,
  inspectedAt: string,
  digestCheck: BindRuntimeInput,
): RuntimeBinding {
  if (!capability) {
    return {
      gateType,
      target,
      status: "capability_unknown",
      nativeEvent: null,
      canBlock: false,
      inspectedAt: null,
      reason: "runtime capability has not been inspected",
    };
  }

  const digestMismatch = getDigestMismatch(gateType, runtimeCapability, capability, digestCheck);

  if (capability.status === "stale" || capability.status === "failed_probe") {
    return {
      gateType,
      target,
      status: "stale",
      nativeEvent: capability.nativeEvent,
      canBlock: false,
      inspectedAt: capability.inspectedAt,
      ...(runtimeCapability?.runtimeVersion
        ? { runtimeVersion: runtimeCapability.runtimeVersion }
        : {}),
      ...(capability.configDigest ? { configDigest: capability.configDigest } : {}),
      reason: `runtime capability is ${capability.status}`,
    };
  }

  if (digestMismatch) {
    return {
      gateType,
      target,
      status: "stale",
      nativeEvent: capability.nativeEvent,
      canBlock: false,
      inspectedAt: capability.inspectedAt,
      ...(runtimeCapability?.runtimeVersion
        ? { runtimeVersion: runtimeCapability.runtimeVersion }
        : {}),
      ...(digestMismatch.currentDigest ? { configDigest: digestMismatch.currentDigest } : {}),
      reason: `runtime capability digest mismatch: expected ${digestMismatch.expectedDigest}, current ${digestMismatch.currentDigest}`,
    };
  }

  const bindingDigest = getBindingDigest(gateType, runtimeCapability, capability, digestCheck);

  if (capability.status === "unknown") {
    return {
      gateType,
      target,
      status: "capability_unknown",
      nativeEvent: null,
      canBlock: false,
      inspectedAt: capability.inspectedAt,
      ...(runtimeCapability?.runtimeVersion
        ? { runtimeVersion: runtimeCapability.runtimeVersion }
        : {}),
      ...(bindingDigest ? { configDigest: bindingDigest } : {}),
      reason: "runtime capability is unknown",
    };
  }

  if (capability.status === "missing" || !capability.nativeEvent) {
    return {
      gateType,
      target,
      status: "missing",
      nativeEvent: null,
      canBlock: false,
      inspectedAt: capability.inspectedAt,
      ...(runtimeCapability?.runtimeVersion
        ? { runtimeVersion: runtimeCapability.runtimeVersion }
        : {}),
      ...(bindingDigest ? { configDigest: bindingDigest } : {}),
      reason: "runtime does not expose a native event for this gate",
    };
  }

  const trustedHookProblem = getTrustedHookProblem(target, gateType, capability);

  if (trustedHookProblem) {
    return trustedHookProblem.status === "missing"
      ? {
          gateType,
          target,
          status: "missing",
          nativeEvent: null,
          canBlock: false,
          inspectedAt: capability.inspectedAt,
          ...(runtimeCapability?.runtimeVersion
            ? { runtimeVersion: runtimeCapability.runtimeVersion }
            : {}),
          ...(bindingDigest ? { configDigest: bindingDigest } : {}),
          reason: trustedHookProblem.reason,
        }
      : {
          gateType,
          target,
          status: "capability_unknown",
          nativeEvent: null,
          canBlock: false,
          inspectedAt: capability.inspectedAt,
          ...(runtimeCapability?.runtimeVersion
            ? { runtimeVersion: runtimeCapability.runtimeVersion }
            : {}),
          ...(bindingDigest ? { configDigest: bindingDigest } : {}),
          reason: trustedHookProblem.reason,
        };
  }

  const missingDigestProof = getMissingDigestProof(gateType, digestCheck);

  if (missingDigestProof) {
    return {
      gateType,
      target,
      status: "stale",
      nativeEvent: capability.nativeEvent,
      canBlock: false,
      inspectedAt: capability.inspectedAt,
      ...(runtimeCapability?.runtimeVersion
        ? { runtimeVersion: runtimeCapability.runtimeVersion }
        : {}),
      ...(bindingDigest ? { configDigest: bindingDigest } : {}),
      reason: `runtime capability digest proof is missing: ${missingDigestProof}`,
    };
  }

  if (
    capability.canBlock &&
    !hasAcceptedBlockingProof(
      capability,
      target,
      runtimeCapability?.runtimeVersion,
      gateType,
      bindingDigest,
      inspectedAt,
    )
  ) {
    return {
      gateType,
      target,
      status: "stale",
      nativeEvent: capability.nativeEvent,
      canBlock: false,
      inspectedAt: capability.inspectedAt,
      ...(runtimeCapability?.runtimeVersion
        ? { runtimeVersion: runtimeCapability.runtimeVersion }
        : {}),
      ...(bindingDigest ? { configDigest: bindingDigest } : {}),
      reason:
        "runtime blocking proof is missing or stale: trusted core-runtime-probe accepted negative_fixture or event_fire with observedAt required, observed no earlier than capability inspection, no later than binding inspection, and within the trusted proof freshness window",
    };
  }

  return {
    gateType,
    target,
    status: "native",
    nativeEvent: capability.nativeEvent,
    canBlock: capability.canBlock,
    inspectedAt: capability.inspectedAt ?? inspectedAt,
    ...(runtimeCapability?.runtimeVersion
      ? { runtimeVersion: runtimeCapability.runtimeVersion }
      : {}),
    ...(bindingDigest ? { configDigest: bindingDigest } : {}),
    reason: "runtime capability inspected and bound to native event",
  };
}

function hasAcceptedBlockingProof(
  capability: RuntimeHookCapability,
  target: string,
  runtimeVersion: string | undefined,
  gateType: GateType,
  configDigest: string | undefined,
  inspectedAt: string,
): boolean {
  if (!runtimeVersion || !configDigest) {
    return false;
  }

  return (
    capability.proofs?.some(
      (proof) =>
        BLOCKING_RUNTIME_PROOF_TYPES.has(proof.type) &&
        isTrustedRuntimeProof(proof, {
          target,
          runtimeVersion,
          gateType,
          configDigest,
          result: "blocked_expected_fixture",
          validAfter: capability.inspectedAt,
          validAt: inspectedAt,
          maxAgeMs: DEFAULT_TRUSTED_RUNTIME_PROOF_MAX_AGE_MS,
        }),
    ) ?? false
  );
}

function normalizeRuntimeProofs(
  proofs: RuntimeProbeEvidence[] | undefined,
  trustedInput: boolean,
): RuntimeProbeEvidence[] | undefined {
  return proofs?.map((proof) =>
    redactRuntimeProof(normalizeRuntimeProofTrust(proof, trustedInput)),
  );
}

function redactRuntimeProofs(proofs: RuntimeProbeEvidence[]): RuntimeProbeEvidence[] {
  return proofs.map(redactRuntimeProof);
}

function redactRuntimeProof(proof: RuntimeProbeEvidence): RuntimeProbeEvidence {
  return {
    ...proof,
    ...(proof.detail ? { detail: redactSecrets(proof.detail) ?? proof.detail } : {}),
  };
}

function redactStringArray(values: string[]): string[] {
  return values.map((value) => redactSecrets(value) ?? value);
}

function getTrustedHookProblem(
  target: string,
  gateType: GateType,
  capability: RuntimeHookCapability,
): { status: "capability_unknown" | "missing"; reason: string } | null {
  const normalizedTarget = target.toLowerCase();

  if (!isRuntimeTarget(normalizedTarget)) {
    return {
      status: "capability_unknown",
      reason: "runtime target is not a trusted core runtime profile",
    };
  }

  const trustedHook = getRuntimeProfile(normalizedTarget).hooks[gateType];

  if (!trustedHook.supported || !trustedHook.nativeEvent) {
    return {
      status: "missing",
      reason: "trusted runtime profile does not expose a native event for this gate",
    };
  }

  if (
    capability.nativeEvent !== trustedHook.nativeEvent ||
    capability.canBlock !== trustedHook.canBlock
  ) {
    return {
      status: "capability_unknown",
      reason: "runtime capability does not match trusted core runtime profile",
    };
  }

  return null;
}

function getDigestMismatch(
  gateType: GateType,
  runtimeCapability: RuntimeCapability | undefined,
  capability: RuntimeHookCapability,
  digestCheck: BindRuntimeInput,
): { expectedDigest: string; currentDigest: string } | null {
  const expectedHookDigest = digestCheck.expectedHookDigests?.[gateType];
  const expectedDigest = expectedHookDigest ?? digestCheck.expectedDigest;
  const currentDigest = expectedHookDigest
    ? (digestCheck.currentHookDigests?.[gateType] ?? capability.configDigest)
    : (digestCheck.currentDigest ?? runtimeCapability?.configDigest);

  if (!expectedDigest || !currentDigest || expectedDigest === currentDigest) {
    return null;
  }

  return { expectedDigest, currentDigest };
}

function getMissingDigestProof(gateType: GateType, digestCheck: BindRuntimeInput): string | null {
  const expectedHookDigest = digestCheck.expectedHookDigests?.[gateType];
  const currentHookDigest = digestCheck.currentHookDigests?.[gateType];

  if (expectedHookDigest || currentHookDigest) {
    if (!expectedHookDigest) {
      return `expected hook digest for ${gateType}`;
    }

    if (!currentHookDigest) {
      return `current hook digest for ${gateType}`;
    }

    return null;
  }

  if (!digestCheck.expectedDigest) {
    return "expected runtime digest";
  }

  if (!digestCheck.currentDigest) {
    return "current runtime digest";
  }

  return null;
}

function getBindingDigest(
  gateType: GateType,
  runtimeCapability: RuntimeCapability | undefined,
  capability: RuntimeHookCapability,
  digestCheck: BindRuntimeInput,
): string | undefined {
  return (
    digestCheck.currentHookDigests?.[gateType] ??
    digestCheck.currentDigest ??
    capability.configDigest ??
    runtimeCapability?.configDigest
  );
}

function computeDigest(value: unknown): string {
  return createHash(DIGEST_ALGORITHM)
    .update(JSON.stringify(sortJson(value)))
    .digest("hex");
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortJson(item)]),
    );
  }

  return value;
}

function readBinding(runtimeBindings: unknown, gateType: GateType): RuntimeBinding {
  if (
    runtimeBindings &&
    typeof runtimeBindings === "object" &&
    "gates" in runtimeBindings &&
    runtimeBindings.gates &&
    typeof runtimeBindings.gates === "object"
  ) {
    const binding = (runtimeBindings.gates as Partial<Record<GateType, RuntimeBinding>>)[gateType];
    if (binding) {
      return binding;
    }
  }

  return {
    gateType,
    target: "unknown",
    status: "missing",
    nativeEvent: null,
    canBlock: false,
    inspectedAt: null,
    reason: "required runtime binding is missing from run-set.json",
  };
}
