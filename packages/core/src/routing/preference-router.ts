export const PREFERENCE_ROUTER_EVIDENCE_ANCHOR =
  "docs/excellence-application/05-architecture/stream-g-harvested-skill-wave-11.md#harvest-target";

export const PREFERENCE_ROUTE_REJECTION_REASONS = [
  "missing_required_signal",
  "killed_by_signal",
  "score_below_floor",
] as const;

export type PreferenceRouteRejectionReason = (typeof PREFERENCE_ROUTE_REJECTION_REASONS)[number];

export type PreferenceRouteDecision =
  | "select_route"
  | "needs_evidence"
  | "needs_evaluation"
  | "reject_all";

export type PreferenceSignalValue = boolean | number | string | null | undefined;

export interface PreferenceRouteCandidate {
  readonly id: string;
  readonly routeId?: string;
  readonly label?: string;
  readonly score: number;
  readonly priority?: number;
  readonly requiredSignals?: readonly string[];
  readonly killSignals?: readonly string[];
}

export interface PreferenceRouterInput {
  readonly candidates: readonly PreferenceRouteCandidate[];
  readonly signals?: Readonly<Record<string, PreferenceSignalValue>>;
  readonly scoreFloor?: number;
}

export interface PreferenceRouteEvaluation {
  readonly candidateId: string;
  readonly routeId: string;
  readonly label?: string;
  readonly score: number;
  readonly priority: number;
  readonly status: "eligible" | "rejected";
  readonly rejectionReasons: readonly PreferenceRouteRejectionReason[];
  readonly missingSignals: readonly string[];
  readonly triggeredKillSignals: readonly string[];
}

export interface PreferenceRouterResult {
  readonly decision: PreferenceRouteDecision;
  readonly selectedRouteId: string | null;
  readonly selectedCandidateId: string | null;
  readonly reason: string;
  readonly evaluations: readonly PreferenceRouteEvaluation[];
  readonly missingSignals: readonly string[];
  readonly tiedCandidateIds: readonly string[];
  readonly evidenceAnchors: readonly string[];
}

const DEFAULT_SCORE_FLOOR = 1;

export function evaluatePreferenceRoutes(input: PreferenceRouterInput): PreferenceRouterResult {
  const scoreFloor = input.scoreFloor ?? DEFAULT_SCORE_FLOOR;
  const signals = input.signals ?? {};
  const evaluations = input.candidates.map((candidate) =>
    evaluateCandidate(candidate, signals, scoreFloor),
  );
  const eligible = evaluations
    .filter((evaluation) => evaluation.status === "eligible")
    .sort(compareEligibleRoutes);

  if (eligible.length === 0) {
    const missingSignals = uniqueStrings(
      evaluations.flatMap((evaluation) => evaluation.missingSignals),
    );
    return {
      decision: missingSignals.length > 0 ? "needs_evidence" : "reject_all",
      selectedRouteId: null,
      selectedCandidateId: null,
      reason:
        missingSignals.length > 0
          ? `preference router needs evidence for signals: ${missingSignals.join(", ")}`
          : "preference router rejected all candidates by kill signals or score floor",
      evaluations,
      missingSignals,
      tiedCandidateIds: [],
      evidenceAnchors: [PREFERENCE_ROUTER_EVIDENCE_ANCHOR],
    };
  }

  const selected = eligible[0];
  const runnerUp = eligible[1];

  if (!selected) {
    throw new Error("preference router invariant violated: eligible route missing after guard");
  }

  const tiedCandidateIds =
    runnerUp && selected.score === runnerUp.score && selected.priority === runnerUp.priority
      ? eligible
          .filter(
            (evaluation) =>
              evaluation.score === selected.score && evaluation.priority === selected.priority,
          )
          .map((evaluation) => evaluation.candidateId)
      : [];

  if (tiedCandidateIds.length > 1) {
    return {
      decision: "needs_evaluation",
      selectedRouteId: null,
      selectedCandidateId: null,
      reason: `preference router tie requires additional evaluation: ${tiedCandidateIds.join(", ")}`,
      evaluations,
      missingSignals: [],
      tiedCandidateIds,
      evidenceAnchors: [PREFERENCE_ROUTER_EVIDENCE_ANCHOR],
    };
  }

  return {
    decision: "select_route",
    selectedRouteId: selected.routeId,
    selectedCandidateId: selected.candidateId,
    reason: `preference router selected ${selected.routeId} from ${eligible.length} eligible candidate(s)`,
    evaluations,
    missingSignals: [],
    tiedCandidateIds: [],
    evidenceAnchors: [PREFERENCE_ROUTER_EVIDENCE_ANCHOR],
  };
}

function evaluateCandidate(
  candidate: PreferenceRouteCandidate,
  signals: Readonly<Record<string, PreferenceSignalValue>>,
  scoreFloor: number,
): PreferenceRouteEvaluation {
  const requiredSignals = uniqueStrings(candidate.requiredSignals ?? []);
  const killSignals = uniqueStrings(candidate.killSignals ?? []);
  const missingSignals = requiredSignals.filter((signal) => isMissingSignal(signals[signal]));
  const triggeredKillSignals = killSignals.filter((signal) => isTruthySignal(signals[signal]));
  const rejectionReasons = uniqueRejectionReasons([
    ...(missingSignals.length > 0 ? ["missing_required_signal" as const] : []),
    ...(triggeredKillSignals.length > 0 ? ["killed_by_signal" as const] : []),
    ...(candidate.score <= scoreFloor ? ["score_below_floor" as const] : []),
  ]);

  return {
    candidateId: candidate.id,
    routeId: candidate.routeId ?? candidate.id,
    label: candidate.label,
    score: candidate.score,
    priority: candidate.priority ?? 0,
    status: rejectionReasons.length > 0 ? "rejected" : "eligible",
    rejectionReasons,
    missingSignals,
    triggeredKillSignals,
  };
}

function compareEligibleRoutes(
  left: PreferenceRouteEvaluation,
  right: PreferenceRouteEvaluation,
): number {
  return (
    right.score - left.score ||
    right.priority - left.priority ||
    left.candidateId.localeCompare(right.candidateId)
  );
}

function isMissingSignal(value: PreferenceSignalValue): boolean {
  return value === undefined || value === null || value === "";
}

function isTruthySignal(value: PreferenceSignalValue): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value > 0;
  }
  if (typeof value === "string") {
    return value.trim().length > 0 && !["false", "0", "no"].includes(value.trim().toLowerCase());
  }
  return false;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function uniqueRejectionReasons(
  reasons: readonly PreferenceRouteRejectionReason[],
): PreferenceRouteRejectionReason[] {
  return [...new Set(reasons)];
}
