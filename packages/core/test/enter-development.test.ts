import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  enterDevelopment,
  getStatus,
  initPlanningProject,
  readPlanningProject,
  writePlanningProject,
} from "../src/index.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "harness-enter-development-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("enterDevelopment", () => {
  it("binds phase, mode, risk, intent, and active gates through one kernel entrypoint", async () => {
    await initPlanningProject(root);

    const result = await enterDevelopment(root, {
      phase: "build",
      subPhase: "Execute",
      mode: "auto",
      riskClass: "M",
      objective: "Implement the Claude entry skill POC",
      rawPrompt: "Start governed development",
      now: new Date("2026-05-04T00:00:00.000Z"),
    });
    const project = await readPlanningProject(root);

    expect(result.current).toEqual({
      phase: "build",
      subPhase: "Execute",
      mode: "auto",
      riskClass: "M",
    });
    expect(project.state).toMatchObject({
      phase: "build",
      sub_phase: "Execute",
      mode: "auto",
      active_gates: ["session_start", "user_prompt", "pre_tool", "post_tool", "stop"],
      status: "active",
    });
    expect(project.currentRisk).toMatchObject({
      risk_class: "M",
      rank: 2,
      bypass_allowed: false,
      human_checkpoint_required: false,
    });
    expect(project.currentRisk.promotion_history.at(-1)).toMatchObject({
      from: "T",
      to: "M",
      source: "hima-enter",
    });
    expect(project.runSet.route).toEqual({
      phase: "build",
      subPhase: "Execute",
      mode: "auto",
      riskClass: "M",
    });
    expect(project.runSet.intent).toMatchObject({
      rawPrompt: "Start governed development",
      objective: "Implement the Claude entry skill POC",
      effectiveRiskClass: "M",
      authorizedAutonomy: "auto",
      plannedCycles: ["build"],
    });
    expect(project.runSet.events.at(-1)).toMatchObject({
      type: "DEVELOPMENT_MODE_ENTERED",
    });
  });

  it("refuses modes disallowed by the selected risk policy", async () => {
    await initPlanningProject(root);

    await expect(
      enterDevelopment(root, {
        mode: "bypass",
        riskClass: "H",
      }),
    ).rejects.toThrow("Mode bypass is not allowed for risk class H");
  });

  it("clears stored finalization gaps when reopening development", async () => {
    const created = await initPlanningProject(root);
    await writePlanningProject(root, {
      ...created,
      runSet: {
        ...created.runSet,
        finalization: {
          state: "BLOCKED_POLICY",
          gaps: ["old close blocker"],
        },
      },
    });

    await enterDevelopment(root, {
      mode: "auto",
      riskClass: "M",
    });
    const project = await readPlanningProject(root);

    expect(project.runSet.finalization).toEqual({
      state: "ACTIVE",
      gaps: [],
    });
  });

  it("starts a new convergence window after reopening development", async () => {
    const created = await initPlanningProject(root);
    await writePlanningProject(root, {
      ...created,
      runSet: {
        ...created.runSet,
        events: [
          {
            id: "old-post-tool-blocker",
            ts: "2026-05-04T00:00:00.000Z",
            type: "GATE_EVALUATED",
            gateType: "post_tool",
            decision: "block",
            reason: "DONE_VERIFIED appeared before the evidence set is sufficient",
            payload: {
              violationType: "DONE_WITHOUT_EVIDENCE",
              finalState: "BLOCKED_POLICY",
            },
          },
        ],
      },
    });

    await enterDevelopment(root, {
      mode: "auto",
      riskClass: "M",
      now: new Date("2026-05-04T00:01:00.000Z"),
    });
    const status = await getStatus(root);

    expect(status.blockers).not.toContain(
      "critical post_tool policy violation (DONE_WITHOUT_EVIDENCE): DONE_VERIFIED appeared before the evidence set is sufficient",
    );
  });
});
