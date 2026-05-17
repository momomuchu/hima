import { randomUUID } from "node:crypto";
import { RunRepository } from "../../repositories/index.js";
import type { RunEvent } from "../../schemas/run-set.schema.js";
import { redactSecrets } from "../../security/redaction.js";
import { appendEventLogEntry } from "../../storage/events-log.js";
import { appendLedgerEntry } from "../../storage/hash-chained-ledger.js";
import type { PlanningProject } from "../../storage/planning-store.js";
import {
  evaluateTransitionGovernance,
  hasExplicitTransitionTarget,
  type TransitionRequest,
  type TransitionResult,
  transitionPlanningState,
} from "../cycle/index.js";
import { toDomainEventLogEntry } from "../events.js";
import { assertRunAlwaysValid } from "./run-invariant.js";

export class RunAggregate {
  private constructor(
    private readonly repository: RunRepository,
    private readonly project: PlanningProject,
  ) {}

  static async load(projectRoot: string): Promise<RunAggregate> {
    const repository = new RunRepository(projectRoot);
    return new RunAggregate(repository, await repository.load());
  }

  static assertAlwaysValid(project: PlanningProject): void {
    assertRunAlwaysValid(project);
  }

  async transition(request: TransitionRequest): Promise<TransitionResult> {
    const governance = await evaluateTransitionGovernance(
      this.repository.projectRoot,
      this.project.state,
      request,
    );
    const result = transitionPlanningState(this.project.state, request);
    const event = this.createTransitionEvent(request, result, governance);

    await this.save({
      ...this.project,
      state: result.newSnapshot,
      runSet: {
        ...this.project.runSet,
        events: [...this.project.runSet.events, event],
        route: {
          ...this.project.runSet.route,
          phase: result.newSnapshot.phase,
          subPhase: result.newSnapshot.sub_phase ?? "Observer",
        },
      },
    });
    await appendEventLogEntry(this.repository.projectRoot, {
      id: `transition-requested-${randomUUID()}`,
      ts: event.ts,
      type: "TransitionRequested",
      runId: this.project.runSet.runId,
      payload: {
        owner: "Cycle",
        request: {
          targetPhase: request.targetPhase,
          targetSubPhase: request.targetSubPhase,
          explicit: hasExplicitTransitionTarget(request),
          reason: redactSecrets(request.reason),
        },
      },
    });
    await appendEventLogEntry(
      this.repository.projectRoot,
      toDomainEventLogEntry(this.project.runSet.runId, event),
    );
    await appendLedgerEntry(this.repository.projectRoot, this.project.runSet.runId, event);

    return result;
  }

  private save(project: PlanningProject): Promise<void> {
    RunAggregate.assertAlwaysValid(project);
    return this.repository.save(project);
  }

  private createTransitionEvent(
    request: TransitionRequest,
    result: TransitionResult,
    governance: Awaited<ReturnType<typeof evaluateTransitionGovernance>>,
  ): RunEvent {
    return {
      id: `state-transition-${randomUUID()}`,
      ts: result.newSnapshot.updated_at,
      type: "STATE_TRANSITIONED",
      reason: redactSecrets(request.reason),
      payload: {
        fromPhase: result.previousSnapshot.phase,
        fromSubPhase: result.previousSnapshot.sub_phase,
        toPhase: result.newSnapshot.phase,
        toSubPhase: result.newSnapshot.sub_phase,
        explicit: hasExplicitTransitionTarget(request),
        governance,
      },
    };
  }
}

export async function transitionRun(
  projectRoot: string,
  request: TransitionRequest,
): Promise<TransitionResult> {
  const run = await RunAggregate.load(projectRoot);
  return run.transition(request);
}
