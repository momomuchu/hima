import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  initPlanningProject,
  RunRepository,
  readEventLog,
  readLedger,
  verifyLedgerEntries,
} from "../src/index.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "harness-run-repository-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("RunRepository", () => {
  it("loads and saves the planning project through the existing planning store", async () => {
    await initPlanningProject(root);
    const repository = new RunRepository(root);
    const project = await repository.load();

    await repository.save({
      ...project,
      runSet: {
        ...project.runSet,
        intent: {
          ...project.runSet.intent,
          objective: "prove thin repository persistence",
        },
      },
    });

    await expect(repository.load()).resolves.toMatchObject({
      runSet: {
        intent: {
          objective: "prove thin repository persistence",
        },
      },
    });
  });

  it("appends run events through existing run-set, event-log, and ledger storage", async () => {
    const project = await initPlanningProject(root);
    const repository = new RunRepository(root);

    await repository.appendRunEvent({
      id: "repo-event-1",
      ts: "2026-05-14T00:00:00.000Z",
      type: "GATE_EVALUATED",
      gateType: "post_tool",
      decision: "allow",
      reason: "repository append smoke",
    });

    const updated = await repository.load();
    const eventsLog = await readEventLog(root);
    const ledger = await readLedger(root, project.runSet.runId);

    expect(updated.runSet.events.map((event) => event.id)).toEqual(["repo-event-1"]);
    expect(eventsLog[0]).toMatchObject({
      id: "repo-event-1",
      type: "GateEvaluated",
      payload: {
        owner: "Gate",
        legacyType: "GATE_EVALUATED",
      },
    });
    expect(ledger[0].payload).toMatchObject({
      id: "repo-event-1",
      type: "GATE_EVALUATED",
    });
    expect(verifyLedgerEntries(ledger)).toBe(true);
  });
});
