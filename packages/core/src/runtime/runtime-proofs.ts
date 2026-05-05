import { createHash } from "node:crypto";
import type { RuntimeProbeEvidence } from "../schemas/run-set.schema.js";
import type { GateType } from "../types/canonical.js";

export const TRUSTED_RUNTIME_PROOF_VERIFIER = "core-runtime-probe";
export const TRUSTED_BLOCKING_RUNTIME_PROOF_RESULT = "blocked_expected_fixture";
export const DEFAULT_TRUSTED_RUNTIME_PROOF_MAX_AGE_MS = 15 * 60 * 1000;
export const TRUSTED_RUNTIME_PROOF_CLOCK_SKEW_MS = 5 * 1000;

export interface TrustedRuntimeProbeProofInput {
  readonly type: RuntimeProbeEvidence["type"];
  readonly observedAt: string;
  readonly target: string;
  readonly runtimeVersion: string;
  readonly gateType: GateType;
  readonly configDigest: string;
  readonly result: string;
  readonly detail?: string;
}

export interface RuntimeProofExpectation {
  readonly target: string;
  readonly runtimeVersion: string;
  readonly gateType: GateType;
  readonly configDigest: string;
  readonly result: string;
  readonly validAfter?: string;
  readonly validAt?: string;
  readonly maxAgeMs?: number;
}

export function createTrustedRuntimeProbeProof(
  input: TrustedRuntimeProbeProofInput,
): RuntimeProbeEvidence {
  const proof: RuntimeProbeEvidence = {
    type: input.type,
    status: "accepted",
    observedAt: input.observedAt,
    verifier: TRUSTED_RUNTIME_PROOF_VERIFIER,
    target: input.target,
    runtimeVersion: input.runtimeVersion,
    gateType: input.gateType,
    configDigest: input.configDigest,
    result: input.result,
    ...(input.detail ? { detail: input.detail } : {}),
  };

  return {
    ...proof,
    proofDigest: computeRuntimeProofDigest(proof),
  };
}

export function isTrustedRuntimeProof(
  proof: RuntimeProbeEvidence,
  expectation: RuntimeProofExpectation,
): boolean {
  if (
    proof.status !== "accepted" ||
    proof.verifier !== TRUSTED_RUNTIME_PROOF_VERIFIER ||
    proof.target !== expectation.target ||
    proof.runtimeVersion !== expectation.runtimeVersion ||
    proof.gateType !== expectation.gateType ||
    proof.configDigest !== expectation.configDigest ||
    proof.result !== expectation.result ||
    proof.observedAt === undefined ||
    Number.isNaN(Date.parse(proof.observedAt)) ||
    proof.proofDigest === undefined
  ) {
    return false;
  }

  return (
    proof.proofDigest === computeRuntimeProofDigest(proof) &&
    isRuntimeProofFresh(proof.observedAt, expectation)
  );
}

export function normalizeRuntimeProofTrust(
  proof: RuntimeProbeEvidence,
  trustedInput: boolean,
): RuntimeProbeEvidence {
  if (trustedInput) {
    return proof;
  }

  return {
    type: proof.type,
    status: proof.status === "accepted" ? "candidate" : proof.status,
    ...(proof.observedAt ? { observedAt: proof.observedAt } : {}),
    ...(proof.detail ? { detail: proof.detail } : {}),
  };
}

export function computeRuntimeProofDigest(proof: RuntimeProbeEvidence): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        type: proof.type,
        status: proof.status,
        observedAt: proof.observedAt,
        verifier: proof.verifier,
        target: proof.target,
        runtimeVersion: proof.runtimeVersion,
        gateType: proof.gateType,
        configDigest: proof.configDigest,
        result: proof.result,
        detail: proof.detail,
      }),
    )
    .digest("hex");
}

function isRuntimeProofFresh(observedAt: string, expectation: RuntimeProofExpectation): boolean {
  const observedAtMs = parseTimestamp(observedAt);
  const validAfterMs = parseOptionalTimestamp(expectation.validAfter);
  const validAtMs = parseOptionalTimestamp(expectation.validAt);
  const maxAgeMs = expectation.maxAgeMs ?? DEFAULT_TRUSTED_RUNTIME_PROOF_MAX_AGE_MS;
  const nowMs = Date.now();

  if (observedAtMs === null || validAfterMs === null || validAtMs === null || maxAgeMs < 0) {
    return false;
  }

  if (validAfterMs !== undefined && observedAtMs < validAfterMs) {
    return false;
  }

  if (validAtMs !== undefined) {
    if (validAtMs > nowMs + TRUSTED_RUNTIME_PROOF_CLOCK_SKEW_MS) {
      return false;
    }

    if (observedAtMs > validAtMs) {
      return false;
    }

    if (validAtMs - observedAtMs > maxAgeMs) {
      return false;
    }
  }

  return true;
}

function parseOptionalTimestamp(value: string | undefined): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return parseTimestamp(value);
}

function parseTimestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}
