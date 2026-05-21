import { access } from "node:fs/promises";
import { type PlanningPosition, validatePlanningTransition } from "../state-machine/subphases.js";
import {
  appendLedgerEntry,
  createLedgerSigner,
  getLedgerPath,
  type LedgerEntry,
  readLedger,
  verifyLedgerEntries,
} from "../storage/hash-chained-ledger.js";
import { MACRO_CYCLES, type MacroCycle, SUB_PHASES, type SubPhase } from "../types/canonical.js";
import { HarnessError } from "../types/errors.js";

export type LocalStressTransitionPayload = {
  kind: "local-stress-transition";
  fixtureScope: "local_only_no_runtime_execution";
  attempt: number;
  from: PlanningPosition;
  to: PlanningPosition;
  validationKind: "sequential";
  externalSessionsLaunched: false;
};

export type LocalStressLedgerValidation = {
  ok: boolean;
  ledgerValid: boolean;
  sequenceValid: boolean;
  transitionOrderValid: boolean;
  errors: string[];
};

export type LocalStressFixtureResult = {
  ok: boolean;
  runId: string;
  iterations: number;
  ledgerEntries: number;
  ledgerPath: string;
  validation: LocalStressLedgerValidation;
  driftDetected: boolean;
  externalSessionsLaunched: false;
};

export type LocalStressFixtureOptions = {
  root: string;
  runId?: string;
  iterations?: number;
};

const DEFAULT_STRESS_ITERATIONS = 100;
const MAX_STRESS_ITERATIONS = 1000;
const STRESS_POSITIONS = MACRO_CYCLES.flatMap((phase) =>
  SUB_PHASES.map((subPhase) => ({ phase, subPhase })),
);

export async function runLocalStressFixture(
  options: LocalStressFixtureOptions,
): Promise<LocalStressFixtureResult> {
  const iterations = parseStressIterations(options.iterations ?? DEFAULT_STRESS_ITERATIONS);
  const runId = parseStressRunId(options.runId ?? "local-stress-fixture");
  const ledgerPath = getLedgerPath(options.root, runId);

  await assertStressLedgerDoesNotExist(options.root, runId);

  const signer = createLedgerSigner();
  for (let attempt = 0; attempt < iterations; attempt += 1) {
    await appendLedgerEntry(options.root, runId, createStressTransitionPayload(attempt), signer);
  }

  const entries = await readLedger(options.root, runId);
  const validation = validateLocalStressLedger(entries, iterations);
  const driftDetected = !validateLocalStressLedger(tamperStressLedger(entries), iterations).ok;

  return {
    ok: validation.ok && driftDetected,
    runId,
    iterations,
    ledgerEntries: entries.length,
    ledgerPath,
    validation,
    driftDetected,
    externalSessionsLaunched: false,
  };
}

export function validateLocalStressLedger(
  entries: LedgerEntry[],
  expectedIterations = entries.length,
): LocalStressLedgerValidation {
  const errors: string[] = [];
  const ledgerValid = verifyLedgerEntries(entries);
  let sequenceValid = true;
  let transitionOrderValid = true;

  if (!ledgerValid) {
    errors.push("Ledger hash chain or signature validation failed.");
  }

  if (entries.length !== expectedIterations) {
    sequenceValid = false;
    errors.push(`Expected ${expectedIterations} ledger entries, found ${entries.length}.`);
  }

  for (const [index, entry] of entries.entries()) {
    if (entry.sequence !== index) {
      sequenceValid = false;
      errors.push(`Ledger entry ${index} has sequence ${entry.sequence}.`);
    }

    const payload = parseStressTransitionPayload(entry.payload);
    if (payload === null) {
      transitionOrderValid = false;
      errors.push(`Ledger entry ${index} is not a local stress transition payload.`);
      continue;
    }

    if (payload.attempt !== index) {
      sequenceValid = false;
      errors.push(`Ledger entry ${index} has attempt ${payload.attempt}.`);
    }

    const transition = validatePlanningTransition(payload.from, payload.to);
    if (!transition.valid || transition.kind !== payload.validationKind) {
      transitionOrderValid = false;
      errors.push(
        `Ledger entry ${index} transition order drift: ${payload.from.phase}/${payload.from.subPhase} -> ${payload.to.phase}/${payload.to.subPhase}.`,
      );
    }

    if (payload.externalSessionsLaunched !== false) {
      errors.push(`Ledger entry ${index} claims external session execution.`);
    }
  }

  return {
    ok: errors.length === 0,
    ledgerValid,
    sequenceValid,
    transitionOrderValid,
    errors,
  };
}

export function createStressTransitionPayload(attempt: number): LocalStressTransitionPayload {
  const from = STRESS_POSITIONS[attempt % (STRESS_POSITIONS.length - 1)];
  const to = STRESS_POSITIONS[(attempt % (STRESS_POSITIONS.length - 1)) + 1];
  if (from === undefined || to === undefined) {
    throw new HarnessError("PLANNING_SCHEMA_INVALID", "Unable to resolve stress transition.", {
      attempt,
    });
  }

  return {
    kind: "local-stress-transition",
    fixtureScope: "local_only_no_runtime_execution",
    attempt,
    from,
    to,
    validationKind: "sequential",
    externalSessionsLaunched: false,
  };
}

function parseStressTransitionPayload(input: unknown): LocalStressTransitionPayload | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }

  const payload = input as Partial<LocalStressTransitionPayload>;
  if (
    payload.kind !== "local-stress-transition" ||
    payload.fixtureScope !== "local_only_no_runtime_execution" ||
    typeof payload.attempt !== "number" ||
    payload.validationKind !== "sequential" ||
    payload.externalSessionsLaunched !== false ||
    !isPlanningPosition(payload.from) ||
    !isPlanningPosition(payload.to)
  ) {
    return null;
  }

  return {
    kind: payload.kind,
    fixtureScope: payload.fixtureScope,
    attempt: payload.attempt,
    from: payload.from,
    to: payload.to,
    validationKind: payload.validationKind,
    externalSessionsLaunched: payload.externalSessionsLaunched,
  };
}

function isPlanningPosition(input: unknown): input is PlanningPosition {
  if (typeof input !== "object" || input === null) {
    return false;
  }

  const position = input as { phase?: unknown; subPhase?: unknown };
  return (
    typeof position.phase === "string" &&
    MACRO_CYCLES.includes(position.phase as MacroCycle) &&
    typeof position.subPhase === "string" &&
    SUB_PHASES.includes(position.subPhase as SubPhase)
  );
}

function tamperStressLedger(entries: LedgerEntry[]): LedgerEntry[] {
  if (entries.length === 0) {
    return entries;
  }

  const tampered = [...entries];
  const first = entries[0];
  if (first === undefined) {
    return tampered;
  }

  const payload = parseStressTransitionPayload(first.payload);
  if (payload === null) {
    return tampered;
  }

  tampered[0] = {
    ...first,
    payload: {
      ...payload,
      to: payload.from,
    },
  };

  return tampered;
}

function parseStressIterations(input: number): number {
  if (!Number.isInteger(input) || input < 1 || input > MAX_STRESS_ITERATIONS) {
    throw new HarnessError(
      "PLANNING_SCHEMA_INVALID",
      `stress fixture iterations must be an integer between 1 and ${MAX_STRESS_ITERATIONS}.`,
      { iterations: input },
    );
  }

  return input;
}

function parseStressRunId(input: string): string {
  const normalized = input.trim();
  if (/^[A-Za-z0-9._-]+$/u.test(normalized)) {
    return normalized;
  }

  throw new HarnessError(
    "PLANNING_SCHEMA_INVALID",
    "stress fixture runId may contain only letters, numbers, dot, underscore, or dash.",
    { runId: input },
  );
}

async function assertStressLedgerDoesNotExist(root: string, runId: string): Promise<void> {
  const ledgerPath = getLedgerPath(root, runId);

  try {
    await access(ledgerPath);
  } catch {
    return;
  }

  throw new HarnessError(
    "PLANNING_SCHEMA_INVALID",
    `stress fixture ledger already exists for runId ${runId}.`,
    { ledgerPath },
  );
}
