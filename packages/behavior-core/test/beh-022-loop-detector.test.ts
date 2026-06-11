import { describe, expect, it } from "vitest";
import {
  appendLoopDetectorEntry,
  beh022LoopDetector,
  buildLoopDetectorEntry,
  countConsecutiveTrailingMatches,
  EMPTY_CONTENT_SENTINEL,
  entriesMatch,
  LOOP_BLOCK_THRESHOLD,
  LOOP_DETECTOR_MAX_ENTRIES,
  LOOP_WARN_THRESHOLD,
  verdictFromMatchCount,
} from "../src/behaviors/beh-022-loop-detector.js";
import { hashContent } from "../src/action-signal.js";
import type { GateEvaluationContext } from "../src/behavior-registry.js";
import type { GateEvent } from "../src/gate-event.js";
import type { CurrentRiskFile, LoopDetector, LoopDetectorEntry, RunSetFile } from "../src/run-set-types.js";
import type { RiskClass } from "../src/risk-class.js";

function makeContext(riskClass: RiskClass = "M", loopDetector?: LoopDetector): GateEvaluationContext {
  return {
    projectRoot: "/tmp/test",
    currentRisk: { risk_class: riskClass } as CurrentRiskFile,
    runSet: {
      runId: "beh022-test",
      policy: {},
      evidence: [],
      events: [],
      subagents: [],
      loopDetector,
    } as RunSetFile,
  };
}

function makePostToolEvent(toolName: string, toolInput: unknown = {}, toolOutput: unknown = "ok"): GateEvent {
  return { gateType: "post_tool", toolName, toolInput, toolOutput };
}

function makeEntry(toolName: string, argsInput: unknown = {}, resultOutput: unknown = "ok"): LoopDetectorEntry {
  return {
    toolName,
    argsHash: hashContent(argsInput),
    resultHash: hashContent(resultOutput),
    ts: new Date().toISOString(),
  };
}

describe("buildLoopDetectorEntry", () => {
  it("extracts toolName from event", () => {
    const entry = buildLoopDetectorEntry(makePostToolEvent("Read", { file_path: "src/foo.ts" }, "content"));
    expect(entry.toolName).toBe("Read");
  });

  it("produces a non-empty argsHash from toolInput", () => {
    const entry = buildLoopDetectorEntry(makePostToolEvent("Write", { file_path: "src/foo.ts", content: "x" }, "ok"));
    expect(entry.argsHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces a non-empty resultHash from toolOutput", () => {
    const entry = buildLoopDetectorEntry(makePostToolEvent("Bash", { command: "ls" }, "file1\nfile2"));
    expect(entry.resultHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces the EMPTY_CONTENT_SENTINEL argsHash for undefined toolInput", () => {
    const event: GateEvent = { gateType: "post_tool", toolName: "Read" };
    expect(buildLoopDetectorEntry(event).argsHash).toBe(EMPTY_CONTENT_SENTINEL);
  });

  it("produces stable hashes for identical inputs", () => {
    const input = { file_path: "src/bar.ts" };
    const e1 = makePostToolEvent("Read", input, "result");
    const e2 = makePostToolEvent("Read", input, "result");
    expect(buildLoopDetectorEntry(e1).argsHash).toBe(buildLoopDetectorEntry(e2).argsHash);
    expect(buildLoopDetectorEntry(e1).resultHash).toBe(buildLoopDetectorEntry(e2).resultHash);
  });

  it("produces different hashes for different inputs", () => {
    const e1 = makePostToolEvent("Read", { file_path: "a.ts" }, "result-a");
    const e2 = makePostToolEvent("Read", { file_path: "b.ts" }, "result-b");
    expect(buildLoopDetectorEntry(e1).argsHash).not.toBe(buildLoopDetectorEntry(e2).argsHash);
  });
});

describe("entriesMatch", () => {
  it("returns true for identical triples", () => {
    const e1 = makeEntry("Read", { f: "a.ts" }, "content");
    const e2 = makeEntry("Read", { f: "a.ts" }, "content");
    expect(entriesMatch(e1, e2)).toBe(true);
  });

  it("returns false when toolName differs", () => {
    expect(entriesMatch(makeEntry("Read", { f: "a.ts" }, "c"), makeEntry("Write", { f: "a.ts" }, "c"))).toBe(false);
  });

  it("returns false when argsHash differs", () => {
    expect(entriesMatch(makeEntry("Read", { f: "a.ts" }, "c"), makeEntry("Read", { f: "b.ts" }, "c"))).toBe(false);
  });

  it("returns false when resultHash differs", () => {
    expect(entriesMatch(makeEntry("Read", { f: "a.ts" }, "c1"), makeEntry("Read", { f: "a.ts" }, "c2"))).toBe(false);
  });

  it("ignores ts field when comparing", () => {
    const e1 = makeEntry("Bash", { command: "ls" }, "result");
    const e2 = { ...e1, ts: "2099-01-01T00:00:00.000Z" };
    expect(entriesMatch(e1, e2)).toBe(true);
  });
});

describe("countConsecutiveTrailingMatches", () => {
  it("returns 1 when buffer is empty", () => {
    expect(countConsecutiveTrailingMatches([], makeEntry("Read", { f: "a.ts" }, "x"))).toBe(1);
  });

  it("returns 2 when last entry matches candidate", () => {
    const e = makeEntry("Read", { f: "a.ts" }, "x");
    expect(countConsecutiveTrailingMatches([e], e)).toBe(2);
  });

  it("returns 3 when last two entries match candidate", () => {
    const e = makeEntry("Read", { f: "a.ts" }, "x");
    expect(countConsecutiveTrailingMatches([e, e], e)).toBe(3);
  });

  it("resets count at first non-matching entry", () => {
    const e = makeEntry("Read", { f: "a.ts" }, "x");
    const other = makeEntry("Write", { f: "b.ts" }, "y");
    expect(countConsecutiveTrailingMatches([other, e, e], e)).toBe(3);
  });

  it("returns 1 when last entry does not match", () => {
    const e = makeEntry("Read", { f: "a.ts" }, "x");
    const other = makeEntry("Write", { f: "b.ts" }, "y");
    expect(countConsecutiveTrailingMatches([e, e, other], e)).toBe(1);
  });
});

describe("appendLoopDetectorEntry", () => {
  it("creates a new LoopDetector when current is undefined", () => {
    const result = appendLoopDetectorEntry(undefined, makeEntry("Read", {}, "x"));
    expect(result.entries).toHaveLength(1);
    expect(result.maxEntries).toBe(LOOP_DETECTOR_MAX_ENTRIES);
    expect(result.consecutiveMatchCount).toBe(1);
  });

  it("appends to existing buffer", () => {
    const ld = appendLoopDetectorEntry(undefined, makeEntry("Read", { f: "a" }, "x"));
    const result = appendLoopDetectorEntry(ld, makeEntry("Write", { f: "b" }, "y"));
    expect(result.entries).toHaveLength(2);
  });

  it("trims buffer to maxEntries (ring buffer cap)", () => {
    let ld: LoopDetector | undefined;
    for (let i = 0; i < LOOP_DETECTOR_MAX_ENTRIES + 3; i++) {
      ld = appendLoopDetectorEntry(ld, makeEntry("Read", { i }, "x"));
    }
    expect(ld?.entries.length).toBe(LOOP_DETECTOR_MAX_ENTRIES);
  });

  it("updates consecutiveMatchCount for repeated identical entries", () => {
    const e = makeEntry("Read", { f: "a.ts" }, "content");
    let ld = appendLoopDetectorEntry(undefined, e);
    expect(ld.consecutiveMatchCount).toBe(1);
    ld = appendLoopDetectorEntry(ld, e);
    expect(ld.consecutiveMatchCount).toBe(2);
    ld = appendLoopDetectorEntry(ld, e);
    expect(ld.consecutiveMatchCount).toBe(3);
  });
});

describe("verdictFromMatchCount", () => {
  it("returns null when count is 1", () => {
    expect(verdictFromMatchCount(1)).toBeNull();
  });

  it(`returns warn when count is ${LOOP_WARN_THRESHOLD}`, () => {
    expect(verdictFromMatchCount(LOOP_WARN_THRESHOLD)?.decision).toBe("warn");
  });

  it(`returns block when count is ${LOOP_BLOCK_THRESHOLD}`, () => {
    const v = verdictFromMatchCount(LOOP_BLOCK_THRESHOLD);
    expect(v?.decision).toBe("block");
    expect(v?.finalState).toBe("LOOP_DETECTED");
  });

  it("returns block for counts above the block threshold", () => {
    const v = verdictFromMatchCount(5);
    expect(v?.decision).toBe("block");
    expect(v?.finalState).toBe("LOOP_DETECTED");
  });
});

describe("BEH-022 — beh022LoopDetector.classify", () => {
  it("abstains on first unique post_tool call (empty buffer)", () => {
    const ctx = makeContext("M", undefined);
    expect(beh022LoopDetector.classify(ctx, makePostToolEvent("Read", { file_path: "src/foo.ts" }, "content"))).toBeNull();
  });

  it("warns when buffer already has one identical triple", () => {
    const input = { file_path: "src/foo.ts" };
    const output = "content";
    const existing = makeEntry("Read", input, output);
    const ld: LoopDetector = { entries: [existing], maxEntries: LOOP_DETECTOR_MAX_ENTRIES, consecutiveMatchCount: 1 };
    expect(beh022LoopDetector.classify(makeContext("M", ld), makePostToolEvent("Read", input, output))?.decision).toBe("warn");
  });

  it("blocks when buffer already has two identical triples", () => {
    const input = { file_path: "src/foo.ts" };
    const output = "content";
    const existing = makeEntry("Read", input, output);
    const ld: LoopDetector = { entries: [existing, existing], maxEntries: LOOP_DETECTOR_MAX_ENTRIES, consecutiveMatchCount: 2 };
    const verdict = beh022LoopDetector.classify(makeContext("M", ld), makePostToolEvent("Read", input, output));
    expect(verdict?.decision).toBe("block");
    expect(verdict?.finalState).toBe("LOOP_DETECTED");
  });

  it("abstains on a new unique call after prior repetitions (chain breaks)", () => {
    const inputA = { file_path: "a.ts" };
    const entryA = makeEntry("Read", inputA, "content-a");
    const ld: LoopDetector = { entries: [entryA, entryA], maxEntries: LOOP_DETECTOR_MAX_ENTRIES, consecutiveMatchCount: 2 };
    expect(beh022LoopDetector.classify(makeContext("M", ld), makePostToolEvent("Write", { file_path: "b.ts" }, "written"))).toBeNull();
  });

  it("fires at risk class T (risk_floor is T — all risk classes)", () => {
    const input = { file_path: "src/foo.ts" };
    const output = "content";
    const existing = makeEntry("Read", input, output);
    const ld: LoopDetector = { entries: [existing, existing], maxEntries: LOOP_DETECTOR_MAX_ENTRIES, consecutiveMatchCount: 2 };
    const verdict = beh022LoopDetector.classify(makeContext("T", ld), makePostToolEvent("Read", input, output));
    expect(verdict?.decision).toBe("block");
    expect(verdict?.finalState).toBe("LOOP_DETECTED");
  });

  it("FALSIFIES-IF: three consecutive identical triples must always produce a block with LOOP_DETECTED", () => {
    const input = { command: "ls -la" };
    const output = "total 0\ndrwxr-xr-x 1 user user 0 Jan 1 00:00 .";
    const existing = makeEntry("Bash", input, output);
    const ld: LoopDetector = { entries: [existing, existing], maxEntries: LOOP_DETECTOR_MAX_ENTRIES, consecutiveMatchCount: 2 };
    const verdict = beh022LoopDetector.classify(makeContext("M", ld), makePostToolEvent("Bash", input, output));
    expect(verdict?.decision).toBe("block");
    expect(verdict?.finalState).toBe("LOOP_DETECTED");
  });
});

describe("BEH-022 descriptor metadata", () => {
  it("has correct catalog id", () => {
    expect(beh022LoopDetector.id).toBe("BEH-022");
  });

  it("fires only on post_tool gate", () => {
    expect(beh022LoopDetector.gates).toEqual(["post_tool"]);
  });

  it("exposes LOOP_WARN_THRESHOLD=2 and LOOP_BLOCK_THRESHOLD=3", () => {
    expect(LOOP_WARN_THRESHOLD).toBe(2);
    expect(LOOP_BLOCK_THRESHOLD).toBe(3);
  });
});
