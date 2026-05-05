import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  initPlanningProject,
  readPlanningProject,
  requestTransition,
  writePlanningProject,
} from "../src/index.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "harness-core-transition-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("requestTransition", () => {
  it("persists state, run-set route, and a durable transition event", async () => {
    await initPlanningProject(root);

    const result = await requestTransition(root, {
      reason: "advance to definition token=ghp_abcdefghijklmnopqrstuvwxyz123456",
    });
    const project = await readPlanningProject(root);

    expect(project.state).toEqual(result.newSnapshot);
    expect(project.state.phase).toBe("discovery");
    expect(project.state.sub_phase).toBe("Define");
    expect(project.runSet.route.phase).toBe("discovery");
    expect(project.runSet.route.subPhase).toBe("Define");
    expect(project.runSet.events).toHaveLength(1);
    expect(project.runSet.events[0]).toMatchObject({
      id: expect.stringMatching(/^state-transition-[0-9a-f-]{36}$/),
      ts: result.newSnapshot.updated_at,
      type: "STATE_TRANSITIONED",
      reason: "advance to definition token=[REDACTED]",
      payload: {
        fromPhase: "discovery",
        fromSubPhase: "Observer",
        toPhase: "discovery",
        toSubPhase: "Define",
        explicit: false,
      },
    });
  });

  it("rejects failed implicit terminal transitions without partial writes", async () => {
    const project = await initPlanningProject(root);
    const terminalProject = {
      ...project,
      state: {
        ...project.state,
        phase: "learning" as const,
        sub_phase: "Transmit" as const,
        updated_at: "2026-05-03T00:00:00.000Z",
      },
      runSet: {
        ...project.runSet,
        route: {
          ...project.runSet.route,
          phase: "learning" as const,
          subPhase: "Transmit" as const,
        },
        events: [
          {
            id: "existing-event",
            ts: "2026-05-03T00:00:00.000Z",
            type: "GATE_EVALUATED",
            decision: "allow" as const,
            reason: "existing event",
          },
        ],
      },
    };
    await writePlanningProject(root, terminalProject);

    await expect(requestTransition(root, {})).rejects.toThrow(
      "Cannot implicitly advance from learning/Transmit",
    );

    expect(await readPlanningProject(root)).toEqual(terminalProject);
  });

  it("preserves existing run-set data while updating only transition route fields", async () => {
    const project = await initPlanningProject(root);
    const existingRunSet = {
      ...project.runSet,
      project: { name: "pipeline" },
      intent: { goal: "preserve me" },
      runtimeCapabilities: {
        codex: {
          target: "codex",
          runtimeName: "Codex",
          status: "available" as const,
          inspectedAt: "2026-05-03T00:00:00.000Z",
          hooks: {},
          knownLimitations: ["none"],
        },
      },
      runtimeBindings: {
        activeTarget: "codex",
      },
      policy: { writeScope: ["packages/core"] },
      route: {
        ...project.runSet.route,
        mode: "pairing" as const,
        riskClass: "L" as const,
      },
      events: [
        {
          id: "existing-event",
          ts: "2026-05-03T00:00:00.000Z",
          type: "GATE_EVALUATED",
          decision: "warn" as const,
          reason: "keep this event",
        },
      ],
      evidence: [
        {
          id: "evidence-1",
          key: "command_output" as const,
          kind: "vitest",
          status: "accepted" as const,
          summary: "existing evidence",
          source: "ci" as const,
          metadata: { command: "vitest" },
          createdAt: "2026-05-03T00:00:00.000Z",
        },
      ],
      subagents: [{ agentId: "worker-1" }],
      finalization: {
        state: "ACTIVE" as const,
        gaps: ["existing gap"],
      },
    };
    await writePlanningProject(root, {
      ...project,
      runSet: existingRunSet,
    });

    await requestTransition(root, {
      targetPhase: "build",
      targetSubPhase: "Execute",
      reason: "explicit jump",
    });

    const updated = await readPlanningProject(root);
    const { events: _events, route: _route, ...existingRunSetData } = existingRunSet;

    expect(updated.runSet).toMatchObject({
      ...existingRunSetData,
      route: {
        phase: "build",
        subPhase: "Execute",
        mode: "pairing",
        riskClass: "L",
      },
    });
    expect(updated.runSet.events).toHaveLength(2);
    expect(updated.runSet.events[0]).toEqual(existingRunSet.events[0]);
    expect(updated.runSet.events[1]).toMatchObject({
      type: "STATE_TRANSITIONED",
      reason: "explicit jump",
      payload: {
        fromPhase: "discovery",
        fromSubPhase: "Observer",
        toPhase: "build",
        toSubPhase: "Execute",
        explicit: true,
      },
    });
  });
});
