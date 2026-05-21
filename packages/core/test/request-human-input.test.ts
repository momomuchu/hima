import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getHumanInputHandoffsPath,
  initPlanningProject,
  readHumanInputRequests,
  readPlanningProject,
  requestHumanInput,
} from "../src/index.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "harness-human-input-"));
  await initPlanningProject(root);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("typed human input handoff service", () => {
  it("validates and appends a typed handoff request to replayable JSONL", async () => {
    const request = await requestHumanInput(root, {
      id: "handoff-001",
      createdAt: "2026-05-15T00:00:00.000Z",
      urgency: "high",
      format: "single_choice",
      question: "Choose the release path.",
      choices: ["block", "continue"],
      threadId: "thread-123",
      requestedBy: "cycle-82",
      metadata: { cycle: "cycle-82" },
    });

    expect(request).toMatchObject({
      schemaVersion: 1,
      id: "handoff-001",
      status: "pending",
      urgency: "high",
      format: "single_choice",
      threadId: "thread-123",
    });

    const handoffsPath = getHumanInputHandoffsPath(root);
    expect(handoffsPath).toMatch(/\.planning[\\/]09-logs[\\/]handoffs\.jsonl$/);
    const raw = await readFile(handoffsPath, "utf8");
    expect(raw.trimEnd().split(/\r?\n/)).toHaveLength(1);

    await expect(readHumanInputRequests(root)).resolves.toEqual([request]);
  });

  it("emits a run-set event for audit correlation", async () => {
    await requestHumanInput(root, {
      id: "handoff-002",
      createdAt: "2026-05-15T00:00:01.000Z",
      urgency: "critical",
      format: "approval",
      question: "Approve external publication?",
      choices: ["approve", "reject"],
      threadId: "thread-release",
    });

    const project = await readPlanningProject(root);
    expect(project.runSet.events).toContainEqual(
      expect.objectContaining({
        id: "human-input-requested-handoff-002",
        ts: "2026-05-15T00:00:01.000Z",
        type: "HUMAN_INPUT_REQUESTED",
        payload: expect.objectContaining({
          requestId: "handoff-002",
          urgency: "critical",
          format: "approval",
          threadId: "thread-release",
          choicesCount: 2,
          handoffsPath: ".planning/09-logs/handoffs.jsonl",
        }),
      }),
    );
  });

  it("keeps append order across multiple handoff requests", async () => {
    await requestHumanInput(root, {
      id: "handoff-first",
      createdAt: "2026-05-15T00:00:02.000Z",
      urgency: "normal",
      format: "free_text",
      question: "What changed?",
      threadId: "thread-order",
    });
    await requestHumanInput(root, {
      id: "handoff-second",
      createdAt: "2026-05-15T00:00:03.000Z",
      urgency: "low",
      format: "multi_choice",
      question: "Which docs should update?",
      choices: ["goal", "readme", "none"],
      threadId: "thread-order",
    });

    const requests = await readHumanInputRequests(root);
    expect(requests.map((request) => request.id)).toEqual(["handoff-first", "handoff-second"]);
  });

  it("rejects choice formats without enough choices", async () => {
    await expect(
      requestHumanInput(root, {
        urgency: "normal",
        format: "single_choice",
        question: "Pick one.",
        choices: ["only-one"],
        threadId: "thread-invalid",
      }),
    ).rejects.toThrow("single_choice handoff requests require at least two choices");
  });

  it("rejects malformed replay lines", async () => {
    const handoffsPath = getHumanInputHandoffsPath(root);
    await mkdir(path.dirname(handoffsPath), { recursive: true });
    await writeFile(handoffsPath, '{"schemaVersion":1,"id":""}\n', "utf8");

    await expect(readHumanInputRequests(root)).rejects.toThrow("Invalid handoffs log line 1");
  });
});
