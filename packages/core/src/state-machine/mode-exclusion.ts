export const HIMA_WORKFLOW_MODES = Object.freeze([
  "autopilot",
  "autoresearch",
  "team",
  "ralph",
  "ultrawork",
  "ultraqa",
  "ralplan",
  "deep-interview",
] as const);

export type HimaWorkflowMode = (typeof HIMA_WORKFLOW_MODES)[number];

export type HimaWorkflowModeFamily = "planning" | "execution";

export const PLANNING_LIKE_MODES = Object.freeze([
  "deep-interview",
  "ralplan",
] as const satisfies readonly HimaWorkflowMode[]);

export const EXECUTION_LIKE_MODES = Object.freeze([
  "autopilot",
  "autoresearch",
  "team",
  "ralph",
  "ultrawork",
  "ultraqa",
] as const satisfies readonly HimaWorkflowMode[]);

export const AUTO_COMPLETE_TRANSITIONS = Object.freeze([
  ["deep-interview", "ralplan"],
  ["deep-interview", "autoresearch"],
  ["ralplan", "team"],
  ["ralplan", "ralph"],
  ["ralplan", "autopilot"],
  ["ralplan", "autoresearch"],
] as const satisfies readonly (readonly [HimaWorkflowMode, HimaWorkflowMode])[]);

export const ALLOWED_OVERLAP_PAIRS = Object.freeze([
  ["ralph", "team"],
] as const satisfies readonly (readonly [HimaWorkflowMode, HimaWorkflowMode])[]);

export type ModeTransitionAction = "activate" | "start" | "write";
export type ModeTransitionKind = "allow" | "overlap" | "auto-complete" | "deny";

export interface ModeTransitionDecision {
  allowed: boolean;
  kind: ModeTransitionKind;
  currentModes: HimaWorkflowMode[];
  requestedMode: HimaWorkflowMode;
  resultingModes: HimaWorkflowMode[];
  autoCompleteModes: HimaWorkflowMode[];
  transitionMessage?: string;
  denialReason?: "rollback";
}

export function isHimaWorkflowMode(value: unknown): value is HimaWorkflowMode {
  return typeof value === "string" && HIMA_WORKFLOW_MODES.includes(value as HimaWorkflowMode);
}

export function getHimaWorkflowModeFamily(mode: HimaWorkflowMode): HimaWorkflowModeFamily {
  if ((PLANNING_LIKE_MODES as readonly HimaWorkflowMode[]).includes(mode)) {
    return "planning";
  }

  return "execution";
}

export function buildModeTransitionMessage(
  sourceMode: HimaWorkflowMode,
  requestedMode: HimaWorkflowMode,
): string {
  return `mode transiting: ${sourceMode} -> ${requestedMode}`;
}

function normalizeTrackedModes(modes: Iterable<string>): HimaWorkflowMode[] {
  const deduped = new Set<HimaWorkflowMode>();
  for (const mode of modes) {
    if (isHimaWorkflowMode(mode)) {
      deduped.add(mode);
    }
  }

  return [...deduped];
}

function buildPairKey(a: HimaWorkflowMode, b: HimaWorkflowMode): string {
  return [a, b].sort((left, right) => left.localeCompare(right)).join("|");
}

function buildAutoCompleteKey(source: HimaWorkflowMode, target: HimaWorkflowMode): string {
  return `${source}->${target}`;
}

export function isAllowedModeOverlap(a: HimaWorkflowMode, b: HimaWorkflowMode): boolean {
  if (a === "ultrawork" || b === "ultrawork") {
    return true;
  }

  const allowedPairs = new Set(
    ALLOWED_OVERLAP_PAIRS.map(([left, right]) => buildPairKey(left, right)),
  );
  return allowedPairs.has(buildPairKey(a, b));
}

export function isAutoCompleteModeTransition(
  sourceMode: HimaWorkflowMode,
  requestedMode: HimaWorkflowMode,
): boolean {
  const transitions = new Set(
    AUTO_COMPLETE_TRANSITIONS.map(([source, target]) => buildAutoCompleteKey(source, target)),
  );
  return transitions.has(buildAutoCompleteKey(sourceMode, requestedMode));
}

function isRollbackTransition(
  currentModes: readonly HimaWorkflowMode[],
  requestedMode: HimaWorkflowMode,
): boolean {
  return (
    (PLANNING_LIKE_MODES as readonly HimaWorkflowMode[]).includes(requestedMode) &&
    currentModes.some((mode) =>
      (EXECUTION_LIKE_MODES as readonly HimaWorkflowMode[]).includes(mode),
    )
  );
}

export function evaluateModeActivation(
  currentActiveModes: Iterable<string>,
  requestedMode: HimaWorkflowMode,
): ModeTransitionDecision {
  const currentModes = normalizeTrackedModes(currentActiveModes);

  if (currentModes.includes(requestedMode)) {
    return {
      allowed: true,
      kind: "allow",
      currentModes,
      requestedMode,
      resultingModes: currentModes,
      autoCompleteModes: [],
    };
  }

  if (currentModes.length === 0) {
    return {
      allowed: true,
      kind: "allow",
      currentModes,
      requestedMode,
      resultingModes: [requestedMode],
      autoCompleteModes: [],
    };
  }

  const autoCompleteModes = currentModes.filter((mode) =>
    isAutoCompleteModeTransition(mode, requestedMode),
  );
  const survivableModes = currentModes.filter((mode) => !autoCompleteModes.includes(mode));
  if (
    autoCompleteModes.length > 0 &&
    survivableModes.every((mode) => isAllowedModeOverlap(mode, requestedMode))
  ) {
    const sourceMode = autoCompleteModes[0];
    if (!sourceMode) {
      throw new Error("Invariant violated: auto-complete branch requires a source mode.");
    }

    return {
      allowed: true,
      kind: "auto-complete",
      currentModes,
      requestedMode,
      resultingModes: normalizeTrackedModes([...survivableModes, requestedMode]),
      autoCompleteModes,
      transitionMessage: buildModeTransitionMessage(sourceMode, requestedMode),
    };
  }

  if (currentModes.every((mode) => isAllowedModeOverlap(mode, requestedMode))) {
    return {
      allowed: true,
      kind: "overlap",
      currentModes,
      requestedMode,
      resultingModes: normalizeTrackedModes([...currentModes, requestedMode]),
      autoCompleteModes: [],
    };
  }

  return {
    allowed: false,
    kind: "deny",
    currentModes,
    requestedMode,
    resultingModes: currentModes,
    autoCompleteModes: [],
    ...(isRollbackTransition(currentModes, requestedMode) ? { denialReason: "rollback" } : {}),
  };
}

function formatActiveModes(modes: readonly HimaWorkflowMode[]): string {
  if (modes.length === 0) {
    return "no tracked workflows";
  }
  if (modes.length === 1) {
    return `${modes[0]} is already active`;
  }
  if (modes.length === 2) {
    return `${modes[0]} and ${modes[1]} are already active`;
  }

  return `${modes.slice(0, -1).join(", ")}, and ${modes[modes.length - 1]} are already active`;
}

export function buildModeTransitionError(
  currentActiveModes: Iterable<string>,
  requestedMode: HimaWorkflowMode,
  action: ModeTransitionAction = "activate",
): string {
  const decision = evaluateModeActivation(currentActiveModes, requestedMode);
  const activeModesMessage = formatActiveModes(decision.currentModes);
  const overlap = [...decision.currentModes, requestedMode].join(" + ");

  if (decision.denialReason === "rollback") {
    return [
      `Cannot ${action} ${requestedMode}: ${activeModesMessage}.`,
      "Execution-to-planning rollback auto-complete is not allowed.",
      "First clear current workflow state and retry if this action is intended.",
    ].join(" ");
  }

  return [
    `Cannot ${action} ${requestedMode}: ${activeModesMessage}.`,
    `Unsupported workflow overlap: ${overlap}.`,
    "Current state is unchanged.",
  ].join(" ");
}

export function assertModeActivationAllowed(
  currentActiveModes: Iterable<string>,
  requestedMode: HimaWorkflowMode,
  action?: ModeTransitionAction,
): void {
  const decision = evaluateModeActivation(currentActiveModes, requestedMode);
  if (!decision.allowed) {
    throw new Error(buildModeTransitionError(currentActiveModes, requestedMode, action));
  }
}
