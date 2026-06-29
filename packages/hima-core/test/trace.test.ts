import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TraceEvent } from "@hima/schemas";
import { appendTrace, readTrace, traceFilePath } from "../src/trace.js";

// ---------------------------------------------------------------------------
// Fixture factory — v3 schema (ts, sessionId, hookEvent, skillsForced, skillsLoaded)
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<TraceEvent> = {}): TraceEvent {
  return {
    ts: new Date().toISOString(),
    sessionId: "test-session",
    hookEvent: "PreToolUse",
    gateType: "pre_tool",
    decision: "allow",
    skillsForced: [],
    skillsLoaded: [],
    exitCode: 0,
    ...overrides,
  };
}

const SESSION = "test-session-abc";

// ---------------------------------------------------------------------------
// Tmp dir lifecycle
// ---------------------------------------------------------------------------

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "hima-trace-test-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// traceFilePath
// ---------------------------------------------------------------------------

describe("traceFilePath", () => {
  it("returns the canonical per-session JSONL path", () => {
    const result = traceFilePath("/project", "sess-42");
    expect(result).toBe(path.join("/project", ".hima", "state", "trace", "sess-42.jsonl"));
  });

  it("each distinct sessionId maps to a distinct file", () => {
    const a = traceFilePath("/project", "sess-a");
    const b = traceFilePath("/project", "sess-b");
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// round-trip: appendTrace → readTrace preserves order
// ---------------------------------------------------------------------------

describe("appendTrace + readTrace round-trip", () => {
  it("persists 2 events and readTrace returns them in append order", async () => {
    const event1 = makeEvent({ gateType: "user_prompt", decision: "warn", exitCode: 0 });
    const event2 = makeEvent({ gateType: "pre_tool", decision: "block", exitCode: 2 });

    await appendTrace(root, event1, SESSION);
    await appendTrace(root, event2, SESSION);

    const events = await readTrace(root, SESSION);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ gateType: "user_prompt", decision: "warn" });
    expect(events[1]).toMatchObject({ gateType: "pre_tool", decision: "block" });
  });

  it("successive appends accumulate (idempotent reads)", async () => {
    const event = makeEvent();
    await appendTrace(root, event, SESSION);
    await appendTrace(root, event, SESSION);
    await appendTrace(root, event, SESSION);

    const events = await readTrace(root, SESSION);
    expect(events).toHaveLength(3);
  });

  it("creates the trace directory automatically if absent", async () => {
    // No .hima directory exists yet — appendTrace must mkdir -p
    const event = makeEvent();
    await appendTrace(root, event, "fresh-session");

    const events = await readTrace(root, "fresh-session");
    expect(events).toHaveLength(1);
  });

  it("different sessions are isolated to separate files", async () => {
    await appendTrace(root, makeEvent({ gateType: "stop" }), "sess-x");
    await appendTrace(root, makeEvent({ gateType: "pre_tool" }), "sess-y");

    const x = await readTrace(root, "sess-x");
    const y = await readTrace(root, "sess-y");

    expect(x).toHaveLength(1);
    expect(x[0]?.gateType).toBe("stop");
    expect(y).toHaveLength(1);
    expect(y[0]?.gateType).toBe("pre_tool");
  });
});

// ---------------------------------------------------------------------------
// readTrace on a missing file → []
// ---------------------------------------------------------------------------

describe("readTrace — missing file", () => {
  it("returns [] when the trace file does not exist", async () => {
    const events = await readTrace(root, "no-such-session");
    expect(events).toEqual([]);
  });

  it("does not throw when the entire .hima directory is absent", async () => {
    // root is a fresh empty tmp dir with no .hima subdirectory
    await expect(readTrace(root, "ghost")).resolves.toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// readTrace skips malformed lines without throwing
// ---------------------------------------------------------------------------

describe("readTrace — malformed lines", () => {
  it("skips non-JSON lines and returns the valid events that follow", async () => {
    const traceDir = path.join(root, ".hima", "state", "trace");
    await mkdir(traceDir, { recursive: true });

    const validEvent = makeEvent({ decision: "allow" });
    const filePath = traceFilePath(root, SESSION);

    // Write: one valid event, one garbage line, one valid event
    const lines = [
      JSON.stringify(validEvent),
      "not json at all !!!",
      JSON.stringify(validEvent),
    ].join("\n") + "\n";

    await writeFile(filePath, lines, "utf8");

    const events = await readTrace(root, SESSION);
    expect(events).toHaveLength(2);
    events.forEach((e) => expect(e.decision).toBe("allow"));
  });

  it("skips lines that are valid JSON but fail schema validation", async () => {
    const traceDir = path.join(root, ".hima", "state", "trace");
    await mkdir(traceDir, { recursive: true });

    const validEvent = makeEvent({ decision: "block", exitCode: 2 });
    const filePath = traceFilePath(root, SESSION);

    // Write: one valid event, one JSON object with wrong shape, one valid event
    const invalidJson = JSON.stringify({ completely: "wrong", shape: true });
    const lines = [
      JSON.stringify(validEvent),
      invalidJson,
      JSON.stringify(validEvent),
    ].join("\n") + "\n";

    await writeFile(filePath, lines, "utf8");

    const events = await readTrace(root, SESSION);
    expect(events).toHaveLength(2);
  });

  it("returns [] when the file contains only malformed lines", async () => {
    const traceDir = path.join(root, ".hima", "state", "trace");
    await mkdir(traceDir, { recursive: true });

    const filePath = traceFilePath(root, SESSION);
    await writeFile(filePath, "garbage\n{bad json\n", "utf8");

    const events = await readTrace(root, SESSION);
    expect(events).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// appendTrace swallows errors — never throws
// ---------------------------------------------------------------------------

describe("appendTrace — error swallowing", () => {
  it("does not throw when the trace directory cannot be created (file in the way)", async () => {
    // Place a regular file at the path where the trace directory must be created.
    // mkdir -p will fail with ENOTDIR; appendTrace must swallow this.
    const traceDir = path.join(root, ".hima", "state", "trace");
    await mkdir(path.dirname(traceDir), { recursive: true });
    await writeFile(traceDir, "i-am-a-file-not-a-directory");

    const event = makeEvent();
    // Must resolve without throwing
    await expect(appendTrace(root, event, "blocked-session")).resolves.toBeUndefined();
  });

  it("uses event.sessionId as the file key when called with 2 arguments", async () => {
    // makeEvent() sets sessionId: "test-session"
    const event = makeEvent();
    // Two-argument form must be accepted and must not throw
    await expect(appendTrace(root, event)).resolves.toBeUndefined();

    // The file is written under event.sessionId ("test-session")
    const events = await readTrace(root, "test-session");
    expect(events).toHaveLength(1);
  });
});
