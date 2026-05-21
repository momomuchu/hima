/**
 * Tests for BEH-022 — Loop Detection with LOOP_DETECTED Final State Emission
 *
 * Covers:
 *   - buildLoopDetectorEntry extracts toolName and hashes inputs/outputs
 *   - entriesMatch identifies identical triples correctly
 *   - countConsecutiveTrailingMatches counts trailing identical entries
 *   - appendLoopDetectorEntry maintains ring buffer cap and updates count
 *   - verdictFromMatchCount: null below warn, warn at 2, block at 3+
 *   - beh022LoopDetector.classify: abstains on first unique call
 *   - beh022LoopDetector.classify: warns on second consecutive identical call
 *   - beh022LoopDetector.classify: blocks on third consecutive identical call
 *   - Fires at all risk classes (risk_floor: T)
 *   - Falsifies-If counter-example: 3 consecutive identical triples must block
 */

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
import { hashContent } from "../src/gates/action-signal.js";
import type { GateEvaluationContext } from "../src/gates/evaluate-gate.js";
import type { GateEvent } from "../src/schemas/gate-event.schema.js";
import type { LoopDetector, LoopDetectorEntry } from "../src/schemas/run-set.schema.js";
import { createDefaultPlanningProject } from "../src/storage/planning-store.js";
import type { RiskClass } from "../src/types/canonical.js";

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeContext(
  riskClass: RiskClass = "M",
  loopDetector?: LoopDetector,
): GateEvaluationContext {
  const project = createDefaultPlanningProject("beh022-test");
  return {
    projectRoot: "/tmp/test",
    state: project.state,
    currentRisk: {
      ...project.currentRisk,
      risk_class: riskClass,
      rank: ({ T: 0, L: 1, M: 2, H: 3, C: 4 } as const)[riskClass],
      bypass_allowed: riskClass === "T" || riskClass === "L",
      human_checkpoint_required: riskClass === "H" || riskClass === "C",
    },
    runSet: {
      ...project.runSet,
      route: { ...project.runSet.route, riskClass },
      loopDetector,
    },
  };
}

function makePostToolEvent(
  toolName: string,
  toolInput: unknown = {},
  toolOutput: unknown = "ok",
): GateEvent {
  return { gateType: "post_tool", toolName, toolInput, toolOutput };
}

function makeEntry(
  toolName: string,
  argsInput: unknown = {},
  resultOutput: unknown = "ok",
): LoopDetectorEntry {
  return {
    toolName,
    argsHash: hashContent(argsInput),
    resultHash: hashContent(resultOutput),
    ts: new Date().toISOString(),
  };
}

// ── buildLoopDetectorEntry ────────────────────────────────────────────────────

describe("buildLoopDetectorEntry", () => {
  it("extracts toolName from event", () => {
    const event = makePostToolEvent("Read", { file_path: "src/foo.ts" }, "content");
    const entry = buildLoopDetectorEntry(event);
    expect(entry.toolName).toBe("Read");
  });

  it("produces a non-empty argsHash from toolInput", () => {
    const event = makePostToolEvent("Write", { file_path: "src/foo.ts", content: "x" }, "ok");
    const entry = buildLoopDetectorEntry(event);
    expect(entry.argsHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces a non-empty resultHash from toolOutput", () => {
    const event = makePostToolEvent("Bash", { command: "ls" }, "file1\nfile2");
    const entry = buildLoopDetectorEntry(event);
    expect(entry.resultHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces the EMPTY_CONTENT_SENTINEL argsHash for undefined toolInput", () => {
    // The schema requires argsHash: z.string().min(1), so undefined inputs use
    // a stable non-empty sentinel rather than an empty string.
    const event: GateEvent = { gateType: "post_tool", toolName: "Read" };
    const entry = buildLoopDetectorEntry(event);
    expect(entry.argsHash).toBe(EMPTY_CONTENT_SENTINEL);
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

// ── entriesMatch ──────────────────────────────────────────────────────────────

describe("entriesMatch", () => {
  it("returns true for identical (toolName, argsHash, resultHash) triples", () => {
    const e1 = makeEntry("Read", { f: "a.ts" }, "content");
    const e2 = makeEntry("Read", { f: "a.ts" }, "content");
    expect(entriesMatch(e1, e2)).toBe(true);
  });

  it("returns false when toolName differs", () => {
    const e1 = makeEntry("Read", { f: "a.ts" }, "content");
    const e2 = makeEntry("Write", { f: "a.ts" }, "content");
    expect(entriesMatch(e1, e2)).toBe(false);
  });

  it("returns false when argsHash differs", () => {
    const e1 = makeEntry("Read", { f: "a.ts" }, "content");
    const e2 = makeEntry("Read", { f: "b.ts" }, "content");
    expect(entriesMatch(e1, e2)).toBe(false);
  });

  it("returns false when resultHash differs", () => {
    const e1 = makeEntry("Read", { f: "a.ts" }, "content-1");
    const e2 = makeEntry("Read", { f: "a.ts" }, "content-2");
    expect(entriesMatch(e1, e2)).toBe(false);
  });

  it("ignores ts field when comparing (timestamps differ between calls)", () => {
    const e1 = makeEntry("Bash", { command: "ls" }, "result");
    const e2 = { ...e1, ts: "2099-01-01T00:00:00.000Z" };
    expect(entriesMatch(e1, e2)).toBe(true);
  });
});

// ── countConsecutiveTrailingMatches ───────────────────────────────────────────

describe("countConsecutiveTrailingMatches", () => {
  it("returns 1 when buffer is empty (candidate counts as 1)", () => {
    const candidate = makeEntry("Read", { f: "a.ts" }, "x");
    expect(countConsecutiveTrailingMatches([], candidate)).toBe(1);
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
    // buffer: [other, e, e], candidate: e → matches last 2, but other breaks the chain
    // Actually: scan from end: e matches (count 1), e matches (count 2), other doesn't match → stop
    // Result: 2 matches in buffer + 1 candidate = 3
    expect(countConsecutiveTrailingMatches([other, e, e], e)).toBe(3);
  });

  it("returns 1 when last entry does not match (different call)", () => {
    const e = makeEntry("Read", { f: "a.ts" }, "x");
    const other = makeEntry("Write", { f: "b.ts" }, "y");
    // buffer ends with `other`, candidate is `e` — no trailing match
    expect(countConsecutiveTrailingMatches([e, e, other], e)).toBe(1);
  });
});

// ── appendLoopDetectorEntry ───────────────────────────────────────────────────

describe("appendLoopDetectorEntry", () => {
  it("creates a new LoopDetector when current is undefined", () => {
    const entry = makeEntry("Read", {}, "x");
    const result = appendLoopDetectorEntry(undefined, entry);
    expect(result.entries).toHaveLength(1);
    expect(result.maxEntries).toBe(LOOP_DETECTOR_MAX_ENTRIES);
    expect(result.consecutiveMatchCount).toBe(1);
  });

  it("appends to existing buffer", () => {
    const e1 = makeEntry("Read", { f: "a" }, "x");
    const ld = appendLoopDetectorEntry(undefined, e1);
    const e2 = makeEntry("Write", { f: "b" }, "y");
    const result = appendLoopDetectorEntry(ld, e2);
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

// ── verdictFromMatchCount ─────────────────────────────────────────────────────

describe("verdictFromMatchCount", () => {
  it("returns null when count is 1 (first occurrence)", () => {
    expect(verdictFromMatchCount(1)).toBeNull();
  });

  it(`returns warn when count is ${LOOP_WARN_THRESHOLD}`, () => {
    const verdict = verdictFromMatchCount(LOOP_WARN_THRESHOLD);
    expect(verdict?.decision).toBe("warn");
  });

  it(`returns block when count is ${LOOP_BLOCK_THRESHOLD}`, () => {
    const verdict = verdictFromMatchCount(LOOP_BLOCK_THRESHOLD);
    expect(verdict?.decision).toBe("block");
    expect(verdict?.finalState).toBe("LOOP_DETECTED");
  });

  it("returns block for counts above the block threshold", () => {
    const verdict = verdictFromMatchCount(5);
    expect(verdict?.decision).toBe("block");
    expect(verdict?.finalState).toBe("LOOP_DETECTED");
  });
});

// ── BEH-022 classify ──────────────────────────────────────────────────────────

describe("BEH-022 — beh022LoopDetector.classify", () => {
  it("abstains on first unique post_tool call (empty buffer)", () => {
    const ctx = makeContext("M", undefined);
    const event = makePostToolEvent("Read", { file_path: "src/foo.ts" }, "content");
    const verdict = beh022LoopDetector.classify(ctx, event);
    expect(verdict).toBeNull();
  });

  it("warns when buffer already has one identical triple (second consecutive)", () => {
    const input = { file_path: "src/foo.ts" };
    const output = "content";
    const existing = makeEntry("Read", input, output);
    const ld: LoopDetector = {
      entries: [existing],
      maxEntries: LOOP_DETECTOR_MAX_ENTRIES,
      consecutiveMatchCount: 1,
    };
    const ctx = makeContext("M", ld);
    const event = makePostToolEvent("Read", input, output);
    const verdict = beh022LoopDetector.classify(ctx, event);
    expect(verdict?.decision).toBe("warn");
  });

  it("blocks when buffer already has two identical triples (third consecutive)", () => {
    const input = { file_path: "src/foo.ts" };
    const output = "content";
    const existing = makeEntry("Read", input, output);
    const ld: LoopDetector = {
      entries: [existing, existing],
      maxEntries: LOOP_DETECTOR_MAX_ENTRIES,
      consecutiveMatchCount: 2,
    };
    const ctx = makeContext("M", ld);
    const event = makePostToolEvent("Read", input, output);
    const verdict = beh022LoopDetector.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
    expect(verdict?.finalState).toBe("LOOP_DETECTED");
  });

  it("abstains on a new unique call after prior repetitions (chain breaks)", () => {
    const inputA = { file_path: "a.ts" };
    const entryA = makeEntry("Read", inputA, "content-a");
    const ld: LoopDetector = {
      entries: [entryA, entryA], // two A's at the end
      maxEntries: LOOP_DETECTOR_MAX_ENTRIES,
      consecutiveMatchCount: 2,
    };
    const ctx = makeContext("M", ld);
    // A different call — breaks the chain
    const event = makePostToolEvent("Write", { file_path: "b.ts" }, "written");
    const verdict = beh022LoopDetector.classify(ctx, event);
    expect(verdict).toBeNull();
  });

  it("fires at risk class T (risk_floor is T — all risk classes)", () => {
    const input = { file_path: "src/foo.ts" };
    const output = "content";
    const existing = makeEntry("Read", input, output);
    const ld: LoopDetector = {
      entries: [existing, existing],
      maxEntries: LOOP_DETECTOR_MAX_ENTRIES,
      consecutiveMatchCount: 2,
    };
    const ctx = makeContext("T", ld); // lowest risk class
    const event = makePostToolEvent("Read", input, output);
    const verdict = beh022LoopDetector.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
    expect(verdict?.finalState).toBe("LOOP_DETECTED");
  });

  // ── Falsifies-If counter-example ───────────────────────────────────────────
  // Spec: "Three consecutive post_tool events with identical (toolName, argsHash,
  // resultHash) triples occur within a single run without a LOOP_DETECTED block
  // verdict being emitted."

  it(
    "FALSIFIES-IF: three consecutive identical triples must always produce " +
      "a block with LOOP_DETECTED — disproving the scenario where they pass silently",
    () => {
      const input = { command: "ls -la" };
      const output = "total 0\ndrwxr-xr-x 1 user user 0 Jan 1 00:00 .";
      const existing = makeEntry("Bash", input, output);

      // Simulate the state AFTER two identical events already recorded
      const ld: LoopDetector = {
        entries: [existing, existing],
        maxEntries: LOOP_DETECTOR_MAX_ENTRIES,
        consecutiveMatchCount: 2,
      };
      const ctx = makeContext("M", ld);

      // Third identical event arrives
      const event = makePostToolEvent("Bash", input, output);
      const verdict = beh022LoopDetector.classify(ctx, event);

      // This MUST block — the scenario where it doesn't is the falsified case
      expect(verdict?.decision).toBe("block");
      expect(verdict?.finalState).toBe("LOOP_DETECTED");
    },
  );
});

// ── Descriptor metadata ───────────────────────────────────────────────────────

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
