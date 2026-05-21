import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  initPlanningProject,
  RunAggregate,
  readEventLog,
  readLedger,
  readPlanningProject,
  requestTransition,
  verifyLedgerEntries,
  writePlanningProject,
} from "../src/index.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "harness-core-transition-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("RunAggregate transition behavior", () => {
  it("keeps requestTransition as a public delegation API", async () => {
    await initPlanningProject(root);

    const result = await requestTransition(root, {
      reason: "service delegation smoke",
    });
    const project = await readPlanningProject(root);

    expect(result.newSnapshot).toEqual(project.state);
    expect(result.newSnapshot.sub_phase).toBe("Define");
  });

  it("persists state, run-set route, and a durable transition event", async () => {
    await initPlanningProject(root);
    const run = await RunAggregate.load(root);

    const result = await run.transition({
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
    const run = await RunAggregate.load(root);

    await expect(run.transition({})).rejects.toThrow(
      "Cannot implicitly advance from learning/Transmit",
    );

    expect(await readPlanningProject(root)).toEqual(terminalProject);
  });

  it("rejects inconsistent Run risk state before aggregate persistence", async () => {
    const project = await initPlanningProject(root);
    const inconsistentProject = {
      ...project,
      currentRisk: {
        ...project.currentRisk,
        risk_class: "M" as const,
        rank: 0,
        bypass_allowed: false,
      },
    };
    await writePlanningProject(root, inconsistentProject);
    const run = await RunAggregate.load(root);

    await expect(run.transition({ reason: "try inconsistent run" })).rejects.toThrow(
      "Run invariant violated",
    );

    expect(await readPlanningProject(root)).toEqual(inconsistentProject);
  });

  it("rejects DONE_VERIFIED without sufficient evidence at the Run invariant boundary", async () => {
    const project = await initPlanningProject(root);

    expect(() =>
      RunAggregate.assertAlwaysValid({
        ...project,
        runSet: {
          ...project.runSet,
          finalization: {
            state: "DONE_VERIFIED",
            gaps: [],
          },
        },
      }),
    ).toThrow("Run invariant violated");
  });

  it("preserves existing run-set data while updating only transition route fields", async () => {
    const project = await initPlanningProject(root);
    await writeGovernance("dod", "01-discovery", "discovery");
    await writeGovernance("dor", "04-build", "build");
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
    const run = await RunAggregate.load(root);

    await run.transition({
      targetPhase: "build",
      targetSubPhase: "Execute",
      reason: "explicit jump",
    });

    const updated = await readPlanningProject(root);
    const eventsLog = await readEventLog(root);
    const ledger = await readLedger(root, updated.runSet.runId);
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
    expect(eventsLog.map((event) => event.type)).toEqual([
      "TransitionRequested",
      "TransitionExecuted",
    ]);
    expect(eventsLog[1]).toMatchObject({
      id: updated.runSet.events[1]?.id,
      payload: {
        owner: "Cycle",
        legacyType: "STATE_TRANSITIONED",
      },
    });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].payload).toMatchObject({
      type: "STATE_TRANSITIONED",
      payload: { governance: { allowed: true } },
    });
    expect(verifyLedgerEntries(ledger)).toBe(true);
  });

  it("characterizes macro-cycle governance in run-set, event log, and ledger records", async () => {
    await initPlanningProject(root);
    await writeGovernance("dod", "01-discovery", "discovery");
    await writeGovernance("dor", "02-cadrage", "cadrage");
    const run = await RunAggregate.load(root);

    const result = await run.transition({
      targetPhase: "cadrage",
      targetSubPhase: "Observer",
      reason: "macro-cycle jump",
    });

    const project = await readPlanningProject(root);
    const eventsLog = await readEventLog(root);
    const ledger = await readLedger(root, project.runSet.runId);
    const transitionEvent = project.runSet.events[0];

    expect(result.previousSnapshot.phase).toBe("discovery");
    expect(result.newSnapshot.phase).toBe("cadrage");
    expect(transitionEvent).toMatchObject({
      type: "STATE_TRANSITIONED",
      payload: {
        fromPhase: "discovery",
        toPhase: "cadrage",
        explicit: true,
        governance: {
          allowed: true,
          blockers: [],
          checked: [
            { kind: "dod", cycle: "discovery" },
            { kind: "dor", cycle: "cadrage" },
          ],
        },
      },
    });
    expect(eventsLog[0]).toMatchObject({
      type: "TransitionRequested",
      runId: project.runSet.runId,
      payload: {
        owner: "Cycle",
        request: {
          targetPhase: "cadrage",
          targetSubPhase: "Observer",
          explicit: true,
        },
      },
    });
    expect(eventsLog[1]).toMatchObject({
      id: transitionEvent?.id,
      type: "TransitionExecuted",
      runId: project.runSet.runId,
      payload: {
        owner: "Cycle",
        legacyType: "STATE_TRANSITIONED",
        event: transitionEvent,
      },
    });
    expect(ledger[0]).toMatchObject({
      runId: project.runSet.runId,
      payload: transitionEvent,
    });
    expect(verifyLedgerEntries(ledger)).toBe(true);
  });
});

async function writeGovernance(kind: "dor" | "dod", slug: string, cycle: string): Promise<void> {
  const governanceDir = path.join(root, "docs", "01-governance");
  await mkdir(governanceDir, { recursive: true });
  await writeFile(
    path.join(governanceDir, `${kind}-${slug}.md`),
    `---
kind: ${kind}
cycle: ${cycle}
title: ${cycle} ${kind}
version: 1
criteria:
  - id: ${kind.toUpperCase()}-1
    text: First criterion.
  - id: ${kind.toUpperCase()}-2
    text: Second criterion.
  - id: ${kind.toUpperCase()}-3
    text: Third criterion.
Falsifies-If:
  kill-condition: Missing criterion invalidates the gate.
  checkpoint-date: 2026-06-04
  evidence-anchor: docs/01-governance/${kind}-${slug}.md
  on-fail: Block transition until fixed.
---
# ${cycle} ${kind}
`,
    "utf8",
  );
}
