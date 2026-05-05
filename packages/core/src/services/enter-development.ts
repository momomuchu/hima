import { getRequiredGates, RISK_POLICY } from "../policy/baseline-policy.js";
import { readPlanningProject, writePlanningProject } from "../storage/planning-store.js";
import type { MacroCycle, OperatingMode, RiskClass, SubPhase } from "../types/canonical.js";
import { RISK_CLASS_RANK } from "../types/canonical.js";
import { HarnessError } from "../types/errors.js";

export interface EnterDevelopmentInput {
  readonly phase?: MacroCycle;
  readonly subPhase?: SubPhase;
  readonly mode?: OperatingMode;
  readonly riskClass?: RiskClass;
  readonly objective?: string;
  readonly rawPrompt?: string;
  readonly reason?: string;
  readonly now?: Date;
}

export interface EnterDevelopmentResult {
  readonly ok: true;
  readonly runId: string;
  readonly previous: {
    readonly phase: MacroCycle;
    readonly subPhase: SubPhase | null;
    readonly mode: OperatingMode;
    readonly riskClass: RiskClass;
  };
  readonly current: {
    readonly phase: MacroCycle;
    readonly subPhase: SubPhase;
    readonly mode: OperatingMode;
    readonly riskClass: RiskClass;
  };
  readonly objective: string | null;
}

const DEFAULT_DEVELOPMENT_PHASE = "build" satisfies MacroCycle;
const DEFAULT_DEVELOPMENT_SUB_PHASE = "Execute" satisfies SubPhase;
const DEFAULT_DEVELOPMENT_MODE = "auto" satisfies OperatingMode;

export async function enterDevelopment(
  projectRoot: string,
  input: EnterDevelopmentInput = {},
): Promise<EnterDevelopmentResult> {
  const project = await readPlanningProject(projectRoot);
  const phase = input.phase ?? DEFAULT_DEVELOPMENT_PHASE;
  const subPhase = input.subPhase ?? DEFAULT_DEVELOPMENT_SUB_PHASE;
  const mode = input.mode ?? DEFAULT_DEVELOPMENT_MODE;
  const riskClass = input.riskClass ?? project.currentRisk.risk_class;
  const policy = RISK_POLICY[riskClass];

  if (!policy.allowedModes.includes(mode)) {
    throw new HarnessError(
      "TRANSITION_BLOCKED",
      `Mode ${mode} is not allowed for risk class ${riskClass}.`,
      { mode, riskClass, allowedModes: [...policy.allowedModes] },
    );
  }

  const now = (input.now ?? new Date()).toISOString();
  const objective = input.objective?.trim() || null;
  const previous = {
    phase: project.state.phase,
    subPhase: project.state.sub_phase,
    mode: project.state.mode,
    riskClass: project.currentRisk.risk_class,
  };
  const riskChanged = previous.riskClass !== riskClass;

  await writePlanningProject(projectRoot, {
    state: {
      ...project.state,
      phase,
      sub_phase: subPhase,
      mode,
      active_gates: getRequiredGates(riskClass),
      status: "active",
      updated_at: now,
    },
    currentRisk: {
      ...project.currentRisk,
      risk_class: riskClass,
      rank: RISK_CLASS_RANK[riskClass],
      bypass_allowed: policy.bypassAllowed,
      human_checkpoint_required: policy.requiresHumanCheckpoint,
      promotion_history: riskChanged
        ? [
            ...project.currentRisk.promotion_history,
            {
              from: previous.riskClass,
              to: riskClass,
              reason: input.reason ?? "development entry",
              source: "hima-enter",
              ts: now,
            },
          ]
        : project.currentRisk.promotion_history,
      updated_at: now,
    },
    runSet: {
      ...project.runSet,
      intent: {
        ...project.runSet.intent,
        ...(input.rawPrompt ? { rawPrompt: input.rawPrompt } : {}),
        ...(objective ? { objective, interpretedObjective: objective } : {}),
        plannedCycles: [phase],
        initialRiskClass: project.runSet.intent.initialRiskClass ?? riskClass,
        effectiveRiskClass: riskClass,
        authorizedAutonomy: mode,
        capturedAt: project.runSet.intent.capturedAt ?? now,
        updatedAt: now,
      },
      route: {
        phase,
        subPhase,
        mode,
        riskClass,
      },
      events: [
        ...project.runSet.events,
        {
          id: `development-entry-${Date.now()}`,
          ts: now,
          type: "DEVELOPMENT_MODE_ENTERED",
          reason: input.reason ?? "hima-enter skill activation",
          payload: {
            fromPhase: previous.phase,
            fromSubPhase: previous.subPhase,
            fromMode: previous.mode,
            fromRiskClass: previous.riskClass,
            toPhase: phase,
            toSubPhase: subPhase,
            toMode: mode,
            toRiskClass: riskClass,
            objective,
          },
        },
      ],
      finalization: {
        state: "ACTIVE",
        gaps: [],
      },
    },
  });

  return {
    ok: true,
    runId: project.state.run_id,
    previous,
    current: {
      phase,
      subPhase,
      mode,
      riskClass,
    },
    objective,
  };
}
