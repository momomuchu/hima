import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendEventLogEntry, getEventsLogPath, readEventLog } from "../src/index.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "harness-events-log-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("events log", () => {
  it("appends JSONL entries under .hima/state/events.jsonl", async () => {
    await appendEventLogEntry(root, {
      id: "event-1",
      ts: "2026-05-14T00:00:00.000Z",
      type: "TransitionExecuted",
      runId: "run_test",
      payload: { phase: "discovery" },
    });
    await appendEventLogEntry(root, {
      id: "event-2",
      ts: "2026-05-14T00:00:01.000Z",
      type: "GateEvaluated",
      runId: "run_test",
      payload: { decision: "allow" },
    });

    const entries = await readEventLog(root);

    expect(getEventsLogPath(root)).toMatch(/\.hima[\\/]state[\\/]events\.jsonl$/);
    expect(entries.map((entry) => entry.id)).toEqual(["event-1", "event-2"]);
    expect(entries.map((entry) => entry.type)).toEqual(["TransitionExecuted", "GateEvaluated"]);
  });
});
