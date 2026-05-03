import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appendRunEvent,
  getPlanningPaths,
  initPlanningProject,
  readPlanningProject,
} from "../src/index.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "harness-core-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("planning store", () => {
  it("creates and reads the three canonical files", async () => {
    const created = await initPlanningProject(root);
    const paths = getPlanningPaths(root);
    const read = await readPlanningProject(root);

    expect(
      paths.stateFile.endsWith(".planning\\state.yaml") ||
        paths.stateFile.endsWith(".planning/state.yaml"),
    ).toBe(true);
    expect(read.state.run_id).toBe(created.state.run_id);
    expect(read.state.phase).toBe("discovery");
    expect(read.currentRisk.risk_class).toBe("T");
    expect(read.runSet.route.phase).toBe("discovery");
  });

  it("stores run events inside the canonical run-set file without sidecar logs", async () => {
    await initPlanningProject(root);

    await appendRunEvent(root, {
      id: "event-1",
      ts: "2026-05-03T00:00:00.000Z",
      type: "GATE_EVALUATED",
      decision: "allow",
      reason: "first event",
    });
    await appendRunEvent(root, {
      id: "event-2",
      ts: "2026-05-03T00:00:01.000Z",
      type: "GATE_EVALUATED",
      decision: "warn",
      reason: "second event",
    });

    const paths = getPlanningPaths(root);
    const planningEntries = await readdir(paths.planningDir);
    const read = await readPlanningProject(root);

    expect(planningEntries.sort()).toEqual(["current-risk.yaml", "run-set.json", "state.yaml"]);
    expect(read.runSet.events.map((event) => event.id)).toEqual(["event-1", "event-2"]);
  });
});
