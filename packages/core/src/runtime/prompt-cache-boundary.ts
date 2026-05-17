export const SYSTEM_PROMPT_DYNAMIC_BOUNDARY = "SYSTEM_PROMPT_DYNAMIC_BOUNDARY";

export const PROMPT_CACHE_INVALIDATION_REASONS = Object.freeze([
  "missingBoundary",
  "duplicateBoundary",
  "staleSnapshot",
  "invalidationSignal",
  "dynamicStateInCacheablePrefix",
] as const);

export type PromptCacheInvalidationReason = (typeof PROMPT_CACHE_INVALIDATION_REASONS)[number];

export type PromptCacheBoundaryDecision = "allow_cache" | "bypass_cache";

export interface PromptCacheBoundaryInput {
  readonly prompt: string;
  readonly boundaryMarker?: string;
  readonly dynamicStateMarkers?: readonly string[];
  readonly invalidationSignals?: readonly string[];
  readonly snapshotAt?: Date | string;
  readonly now?: Date | string;
  readonly maxSnapshotAgeMs?: number;
}

export interface PromptCacheBoundaryEvaluation {
  readonly decision: PromptCacheBoundaryDecision;
  readonly boundaryMarker: string;
  readonly boundaryCount: number;
  readonly cacheablePrefix: string;
  readonly dynamicSuffix: string;
  readonly invalidationRequired: boolean;
  readonly reasons: PromptCacheInvalidationReason[];
  readonly invalidationSignals: string[];
  readonly leakedDynamicStateMarkers: string[];
  readonly stale: boolean;
  readonly snapshotAgeMs?: number;
}

export function evaluatePromptCacheBoundary(
  input: PromptCacheBoundaryInput,
): PromptCacheBoundaryEvaluation {
  const boundaryMarker = input.boundaryMarker ?? SYSTEM_PROMPT_DYNAMIC_BOUNDARY;
  const segments = input.prompt.split(boundaryMarker);
  const boundaryCount = segments.length - 1;
  const cacheablePrefix = segments[0] ?? "";
  const dynamicSuffix = boundaryCount === 1 ? (segments[1] ?? "") : "";
  const invalidationSignals = normalizeStrings(input.invalidationSignals ?? []);
  const leakedDynamicStateMarkers = normalizeStrings(input.dynamicStateMarkers ?? []).filter(
    (marker) => cacheablePrefix.includes(marker),
  );
  const snapshotAgeMs = getSnapshotAgeMs(input.snapshotAt, input.now);
  const stale =
    input.maxSnapshotAgeMs !== undefined &&
    snapshotAgeMs !== undefined &&
    snapshotAgeMs > input.maxSnapshotAgeMs;
  const reasons = buildInvalidationReasons({
    boundaryCount,
    stale,
    invalidationSignals,
    leakedDynamicStateMarkers,
  });
  const invalidationRequired = reasons.length > 0;

  return {
    decision: invalidationRequired ? "bypass_cache" : "allow_cache",
    boundaryMarker,
    boundaryCount,
    cacheablePrefix,
    dynamicSuffix,
    invalidationRequired,
    reasons,
    invalidationSignals,
    leakedDynamicStateMarkers,
    stale,
    ...(snapshotAgeMs !== undefined ? { snapshotAgeMs } : {}),
  };
}

function buildInvalidationReasons(input: {
  readonly boundaryCount: number;
  readonly stale: boolean;
  readonly invalidationSignals: readonly string[];
  readonly leakedDynamicStateMarkers: readonly string[];
}): PromptCacheInvalidationReason[] {
  const reasons: PromptCacheInvalidationReason[] = [];

  if (input.boundaryCount === 0) {
    reasons.push("missingBoundary");
  }
  if (input.boundaryCount > 1) {
    reasons.push("duplicateBoundary");
  }
  if (input.stale) {
    reasons.push("staleSnapshot");
  }
  if (input.invalidationSignals.length > 0) {
    reasons.push("invalidationSignal");
  }
  if (input.leakedDynamicStateMarkers.length > 0) {
    reasons.push("dynamicStateInCacheablePrefix");
  }

  return reasons;
}

function normalizeStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

function getSnapshotAgeMs(
  snapshotAt: Date | string | undefined,
  now: Date | string | undefined,
): number | undefined {
  if (!snapshotAt || !now) {
    return undefined;
  }

  const snapshotTime = snapshotAt instanceof Date ? snapshotAt.getTime() : Date.parse(snapshotAt);
  const nowTime = now instanceof Date ? now.getTime() : Date.parse(now);
  if (!Number.isFinite(snapshotTime) || !Number.isFinite(nowTime)) {
    return undefined;
  }

  return Math.max(0, nowTime - snapshotTime);
}
