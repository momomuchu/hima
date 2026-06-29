/**
 * Tests for team-merge / mergeTeamOutputs()
 *
 * Covers the 6 mandated merge rules (M1–M6):
 *
 *   M1 — One "blocked" verdict → result "blocked"
 *   M2 — All "done" + adversaryBlock=true → at most "done" (not "done-verified")
 *   M3 — Majority "partial" (no blocked) → result "partial"
 *   M4 — All "done", adversaryBlock=false, no expectedAgents → "done"
 *   M5 — All "done-verified" + adversaryBlock=false + full count → "done-verified"
 *   M6 — verdicts.length < expectedAgents → "partial" (missing agent)
 *
 * Additional coverage:
 *   - Empty verdicts → "partial"
 *   - Evidence is deduplicated across agents
 *   - Mixed partial (not majority) + done → "partial"
 *   - stage name taken from first verdict
 *   - blocked beats partial (M1 priority)
 *   - done-validated treated as done-class (all done-class + no block → done / done-verified)
 */

import { describe, expect, it } from "vitest";
import type { StageVerdict } from "@hima/schemas";
import { mergeTeamOutputs } from "../src/team-merge.js";

// ---------------------------------------------------------------------------
// Verdict builders
// ---------------------------------------------------------------------------

function verdict(
  status: StageVerdict["status"],
  evidence: string[] = [],
  stage = "discovery",
): StageVerdict {
  return { stage, status, evidence };
}

// ---------------------------------------------------------------------------
// M1 — One "blocked" verdict → stage "blocked"
// ---------------------------------------------------------------------------

describe("M1: any blocked propagates to stage result", () => {
  it("returns blocked when a single verdict is blocked", () => {
    const verdicts = [verdict("blocked", ["ev-blocker"])];
    const result = mergeTeamOutputs(verdicts);
    expect(result.status).toBe("blocked");
  });

  it("returns blocked even when other verdicts are done", () => {
    const verdicts = [
      verdict("done", ["ev-done-1"]),
      verdict("done", ["ev-done-2"]),
      verdict("blocked", ["ev-blocker"]),
    ];
    const result = mergeTeamOutputs(verdicts);
    expect(result.status).toBe("blocked");
  });

  it("returns blocked even when other verdicts are done-verified", () => {
    const verdicts = [
      verdict("done-verified"),
      verdict("blocked"),
    ];
    const result = mergeTeamOutputs(verdicts);
    expect(result.status).toBe("blocked");
  });

  it("blocked beats partial (M1 priority over M3)", () => {
    const verdicts = [
      verdict("partial"),
      verdict("partial"),
      verdict("blocked"),
    ];
    const result = mergeTeamOutputs(verdicts);
    expect(result.status).toBe("blocked");
  });
});

// ---------------------------------------------------------------------------
// M2 — adversaryBlock=true caps result below "done-verified"
// ---------------------------------------------------------------------------

describe("M2: adversaryBlock=true → at most done, not done-verified", () => {
  it("returns done (not done-verified) when all done + adversaryBlock=true", () => {
    const verdicts = [
      verdict("done", ["ev-1"]),
      verdict("done", ["ev-2"]),
    ];
    const result = mergeTeamOutputs(verdicts, {
      adversaryBlock: true,
      expectedAgents: 2,
    });
    expect(result.status).toBe("done");
  });

  it("returns done when all done-verified + adversaryBlock=true", () => {
    const verdicts = [
      verdict("done-verified"),
      verdict("done-verified"),
    ];
    const result = mergeTeamOutputs(verdicts, {
      adversaryBlock: true,
      expectedAgents: 2,
    });
    expect(result.status).toBe("done");
  });

  it("adversaryBlock does not elevate blocked — blocked still wins (M1 > M2)", () => {
    const verdicts = [
      verdict("done"),
      verdict("blocked"),
    ];
    const result = mergeTeamOutputs(verdicts, { adversaryBlock: true });
    expect(result.status).toBe("blocked");
  });
});

// ---------------------------------------------------------------------------
// M3 — Majority "partial" (no blocked) → "partial"
// ---------------------------------------------------------------------------

describe("M3: majority partial → partial", () => {
  it("returns partial when 2 of 3 verdicts are partial", () => {
    const verdicts = [
      verdict("partial"),
      verdict("partial"),
      verdict("done"),
    ];
    const result = mergeTeamOutputs(verdicts);
    expect(result.status).toBe("partial");
  });

  it("returns partial when all verdicts are partial", () => {
    const verdicts = [
      verdict("partial"),
      verdict("partial"),
    ];
    const result = mergeTeamOutputs(verdicts);
    expect(result.status).toBe("partial");
  });

  it("returns partial when exactly half are partial (not strictly majority → partial still via not-all-done)", () => {
    // 2 out of 4: 2/4 = 50%, not > 50%; but not all done → should be partial via allDone=false path
    const verdicts = [
      verdict("partial"),
      verdict("partial"),
      verdict("done"),
      verdict("done"),
    ];
    const result = mergeTeamOutputs(verdicts);
    // Not all done (2 partial present), so result is partial via the not-allDone path
    expect(result.status).toBe("partial");
  });
});

// ---------------------------------------------------------------------------
// M4 — All done, no adversaryBlock, no expectedAgents → "done"
// ---------------------------------------------------------------------------

describe("M4: all done + no adversary block → done", () => {
  it("returns done when all verdicts are done and no adversaryBlock and no expectedAgents", () => {
    const verdicts = [
      verdict("done", ["ev-a"]),
      verdict("done", ["ev-b"]),
    ];
    const result = mergeTeamOutputs(verdicts);
    expect(result.status).toBe("done");
  });

  it("returns done for a single done verdict with no options", () => {
    const result = mergeTeamOutputs([verdict("done")]);
    expect(result.status).toBe("done");
  });

  it("returns done (not done-verified) when expectedAgents is absent even if all done", () => {
    const verdicts = [verdict("done"), verdict("done")];
    const result = mergeTeamOutputs(verdicts, { adversaryBlock: false });
    // No expectedAgents → count unverified → "done" per M4
    expect(result.status).toBe("done");
  });
});

// ---------------------------------------------------------------------------
// M5 — All done-verified + no adversaryBlock + full count → "done-verified"
// ---------------------------------------------------------------------------

describe("M5: all done + no block + full count → done-verified", () => {
  it("returns done-verified when all done, adversaryBlock=false, count matches", () => {
    const verdicts = [
      verdict("done", ["ev-1"]),
      verdict("done", ["ev-2"]),
    ];
    const result = mergeTeamOutputs(verdicts, {
      adversaryBlock: false,
      expectedAgents: 2,
    });
    expect(result.status).toBe("done-verified");
  });

  it("returns done-verified when all done-verified, no block, full count", () => {
    const verdicts = [
      verdict("done-verified", ["ev-a"]),
      verdict("done-verified", ["ev-b"]),
      verdict("done-verified", ["ev-c"]),
    ];
    const result = mergeTeamOutputs(verdicts, {
      adversaryBlock: false,
      expectedAgents: 3,
    });
    expect(result.status).toBe("done-verified");
  });

  it("returns done-verified for a single agent with expectedAgents=1", () => {
    const result = mergeTeamOutputs([verdict("done")], {
      adversaryBlock: false,
      expectedAgents: 1,
    });
    expect(result.status).toBe("done-verified");
  });

  it("done-validated treated as done-class for M5", () => {
    const verdicts = [
      verdict("done-validated"),
      verdict("done"),
    ];
    const result = mergeTeamOutputs(verdicts, {
      adversaryBlock: false,
      expectedAgents: 2,
    });
    expect(result.status).toBe("done-verified");
  });
});

// ---------------------------------------------------------------------------
// M6 — Missing agents (length < expectedAgents) → "partial"
// ---------------------------------------------------------------------------

describe("M6: missing agents → partial", () => {
  it("returns partial when 1 verdict submitted but 3 expected", () => {
    const verdicts = [verdict("done")];
    const result = mergeTeamOutputs(verdicts, { expectedAgents: 3 });
    expect(result.status).toBe("partial");
  });

  it("returns partial when 0 verdicts submitted and 2 expected", () => {
    const result = mergeTeamOutputs([], { expectedAgents: 2 });
    expect(result.status).toBe("partial");
  });

  it("returns partial when 2 of 4 expected agents submitted, both done", () => {
    const verdicts = [
      verdict("done"),
      verdict("done"),
    ];
    const result = mergeTeamOutputs(verdicts, { expectedAgents: 4 });
    expect(result.status).toBe("partial");
  });

  it("does NOT trigger M6 when count matches exactly", () => {
    const verdicts = [verdict("done"), verdict("done")];
    const result = mergeTeamOutputs(verdicts, {
      adversaryBlock: false,
      expectedAgents: 2,
    });
    // Full count → eligible for done-verified per M5
    expect(result.status).toBe("done-verified");
  });
});

// ---------------------------------------------------------------------------
// Edge: empty verdicts (no expectedAgents) → partial
// ---------------------------------------------------------------------------

describe("edge: empty verdicts with no expectedAgents", () => {
  it("returns partial when no verdicts and no expectedAgents", () => {
    const result = mergeTeamOutputs([]);
    expect(result.status).toBe("partial");
  });
});

// ---------------------------------------------------------------------------
// Evidence deduplication
// ---------------------------------------------------------------------------

describe("evidence deduplication", () => {
  it("deduplicates evidence items shared across agents", () => {
    const verdicts = [
      verdict("done", ["file-a.ts", "shared-evidence"]),
      verdict("done", ["shared-evidence", "file-b.ts"]),
    ];
    const result = mergeTeamOutputs(verdicts, {
      expectedAgents: 2,
    });
    expect(result.evidence).toContain("file-a.ts");
    expect(result.evidence).toContain("file-b.ts");
    expect(result.evidence).toContain("shared-evidence");
    // Deduplicated: shared-evidence appears once
    expect(result.evidence.filter((e) => e === "shared-evidence")).toHaveLength(1);
  });

  it("collects all distinct evidence items from every agent", () => {
    const verdicts = [
      verdict("done", ["ev-1"]),
      verdict("done", ["ev-2"]),
      verdict("done", ["ev-3"]),
    ];
    const result = mergeTeamOutputs(verdicts, { expectedAgents: 3 });
    expect(result.evidence.sort()).toEqual(["ev-1", "ev-2", "ev-3"]);
  });

  it("returns empty evidence when no agent provides any", () => {
    const result = mergeTeamOutputs([verdict("done", [])], { expectedAgents: 1 });
    expect(result.evidence).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Stage name propagation
// ---------------------------------------------------------------------------

describe("stage name", () => {
  it("takes stage from the first verdict", () => {
    const verdicts = [
      verdict("done", [], "spec"),
      verdict("done", [], "spec"),
    ];
    const result = mergeTeamOutputs(verdicts, { expectedAgents: 2 });
    expect(result.stage).toBe("spec");
  });

  it("falls back to 'unknown' when verdicts is empty", () => {
    const result = mergeTeamOutputs([]);
    expect(result.stage).toBe("unknown");
  });
});
