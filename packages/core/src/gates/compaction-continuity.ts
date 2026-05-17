export const COMPACTION_CRITICAL_STATE_KEYS = Object.freeze([
  "runId",
  "phase",
  "subPhase",
  "mode",
  "riskClass",
] as const);

export type CompactionCriticalStateKey = (typeof COMPACTION_CRITICAL_STATE_KEYS)[number];

export type CompactionCriticalState = Record<CompactionCriticalStateKey, string>;

export interface CompactionContinuityOptions {
  readonly requireAllKeys?: boolean;
  readonly maxSnapshotAgeMs?: number;
  readonly now?: Date | string;
}

export interface CompactionContinuityResult {
  readonly preserved: boolean;
  readonly mismatchedKeys: CompactionCriticalStateKey[];
  readonly missingKeys: CompactionCriticalStateKey[];
  readonly stale: boolean;
  readonly snapshotAgeMs?: number;
  readonly reason: string;
}

export function normalizeCompactionCriticalStateMetadata(
  metadata: Readonly<Record<string, unknown>>,
): Partial<CompactionCriticalState> {
  return {
    runId: readOptionalString(metadata.runId ?? metadata.run_id),
    phase: readOptionalString(metadata.phase),
    subPhase: readOptionalString(metadata.subPhase ?? metadata.sub_phase),
    mode: readOptionalString(metadata.mode),
    riskClass: readOptionalString(metadata.riskClass ?? metadata.risk_class),
  };
}

export function evaluateCompactionContinuity(
  expected: CompactionCriticalState,
  metadata: Readonly<Record<string, unknown>>,
  options: CompactionContinuityOptions = {},
): CompactionContinuityResult {
  const actual = normalizeCompactionCriticalStateMetadata(metadata);
  const missingKeys = options.requireAllKeys
    ? COMPACTION_CRITICAL_STATE_KEYS.filter((key) => actual[key] === undefined)
    : [];
  const mismatchedKeys = COMPACTION_CRITICAL_STATE_KEYS.filter(
    (key) => actual[key] !== undefined && actual[key] !== expected[key],
  );
  const snapshotAgeMs = getSnapshotAgeMs(metadata, options.now);
  const stale =
    options.maxSnapshotAgeMs !== undefined &&
    snapshotAgeMs !== undefined &&
    snapshotAgeMs > options.maxSnapshotAgeMs;
  const preserved = missingKeys.length === 0 && mismatchedKeys.length === 0 && !stale;

  return {
    preserved,
    mismatchedKeys,
    missingKeys,
    stale,
    ...(snapshotAgeMs !== undefined ? { snapshotAgeMs } : {}),
    reason: preserved
      ? "compaction critical state preserved"
      : buildCompactionContinuityReason(missingKeys, mismatchedKeys, stale),
  };
}

function buildCompactionContinuityReason(
  missingKeys: readonly CompactionCriticalStateKey[],
  mismatchedKeys: readonly CompactionCriticalStateKey[],
  stale: boolean,
): string {
  const parts = [
    missingKeys.length > 0 ? `missing critical state: ${missingKeys.join(", ")}` : "",
    mismatchedKeys.length > 0 ? `continuity mismatch: ${mismatchedKeys.join(", ")}` : "",
    stale ? "critical state snapshot is stale" : "",
  ].filter((part) => part.length > 0);

  return parts.length > 0 ? parts.join("; ") : "compaction critical state not preserved";
}

function getSnapshotAgeMs(
  metadata: Readonly<Record<string, unknown>>,
  now: Date | string | undefined,
): number | undefined {
  const capturedAt = readOptionalString(
    metadata.compactionSnapshotAt ??
      metadata.compaction_snapshot_at ??
      metadata.snapshotAt ??
      metadata.snapshot_at,
  );
  if (!capturedAt || !now) {
    return undefined;
  }

  const capturedTime = Date.parse(capturedAt);
  const nowTime = now instanceof Date ? now.getTime() : Date.parse(now);
  if (!Number.isFinite(capturedTime) || !Number.isFinite(nowTime)) {
    return undefined;
  }

  return Math.max(0, nowTime - capturedTime);
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
