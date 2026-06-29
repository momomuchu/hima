/**
 * Tests for spawn-plan — work-driven role-team composition.
 *
 * Covers:
 *  1. spawnPlan("design", ROLE_CATALOG) returns Architect + Antagonist (and only them).
 *  2. teamWidth returns the count of stage roles.
 *  3. Criticality is NOT a parameter — function arity is 2; no floor/criticality param.
 *  4. spawnPlan("discovery", ROLE_CATALOG) returns Surveyor + Risk Analyst + Researcher.
 *  5. spawnPlan("verify", ROLE_CATALOG) returns Reviewer + Security Auditor.
 *  6. spawnPlan("spec", ROLE_CATALOG) returns Specwright + Contract Guardian.
 *  7. spawnPlan("impl", ROLE_CATALOG) returns Executor + Test Writer.
 *  8. spawnPlan("test", ROLE_CATALOG) returns Test Writer only.
 *  9. spawnPlan("unknown-stage", ROLE_CATALOG) returns [].
 * 10. mergeTeamOutputs — M1: any blocked → "blocked".
 * 11. mergeTeamOutputs — M2: adversarial BLOCK finding → prevents "done-verified".
 * 12. mergeTeamOutputs — M3: majority partial → "partial".
 * 13. mergeTeamOutputs — M4: all done + no BLOCK → "done".
 * 14. mergeTeamOutputs — M5: all done + no BLOCK + evidence → "done-verified".
 * 15. mergeTeamOutputs — M6: timed-out lane → at most "partial".
 * 16. mergeTeamOutputs — empty verdicts → "partial" (safe fallback).
 * 17. RoleDef shape: every role in ROLE_CATALOG has required fields.
 * 18. ROLE_CATALOG contains exactly the expected 11 role entries.
 */

import { describe, expect, it } from "vitest";
import {
  spawnPlan,
  teamWidth,
  mergeTeamOutputs,
  ROLE_CATALOG,
} from "../src/spawn-plan.js";
import type { RoleDef, AgentVerdict } from "../src/spawn-plan.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Minimal passing AgentVerdict — done, no findings, evidence present. */
function doneVerdict(
  laneId: string,
  roleId = "executor",
  isAdversarial = false,
): AgentVerdict {
  return {
    laneId,
    roleId,
    isAdversarial,
    decision: "done",
    openFindings: [],
    skillsInvoked: ["code-quality-maintainability"],
    evidence: ["src/foo.ts"],
    timedOut: false,
  };
}

function partialVerdict(laneId: string, isAdversarial = false): AgentVerdict {
  return { ...doneVerdict(laneId, "reviewer", isAdversarial), decision: "partial", evidence: [] };
}

function blockedVerdict(laneId: string, isAdversarial = false): AgentVerdict {
  return {
    ...doneVerdict(laneId, "reviewer", isAdversarial),
    decision: "blocked",
    openFindings: [{ severity: "BLOCK", desc: "critical gate failure" }],
  };
}

function doneVerifiedVerdict(laneId: string, isAdversarial = false): AgentVerdict {
  return { ...doneVerdict(laneId, "executor", isAdversarial), decision: "done-verified" };
}

function timedOutVerdict(laneId: string): AgentVerdict {
  return {
    ...partialVerdict(laneId),
    timedOut: true,
    openFindings: [{ severity: "BLOCK", desc: "Lane did not submit verdict" }],
  };
}

/** Adversarial verdict that is "done" but has an open BLOCK finding. */
function adversarialBlockVerdict(laneId: string): AgentVerdict {
  return {
    laneId,
    roleId: "antagonist",
    isAdversarial: true,
    decision: "done",
    openFindings: [{ severity: "BLOCK", desc: "design brittleness: no retry budget" }],
    skillsInvoked: ["architecture-system-design"],
    evidence: [".hima/plans/antagonist-review-ward1.md"],
    timedOut: false,
  };
}

// ---------------------------------------------------------------------------
// §1 — spawnPlan("design") returns Architect + Antagonist
// ---------------------------------------------------------------------------

describe("spawnPlan — design stage", () => {
  it("returns Architect and Antagonist for 'design' stage", () => {
    const plan = spawnPlan("design", ROLE_CATALOG);
    const roleIds = plan.map((r) => r.roleId);
    expect(roleIds).toContain("architect");
    expect(roleIds).toContain("antagonist");
  });

  it("returns ONLY Architect and Antagonist for 'design' stage", () => {
    const plan = spawnPlan("design", ROLE_CATALOG);
    expect(plan).toHaveLength(2);
    const roleIds = plan.map((r) => r.roleId).sort();
    expect(roleIds).toEqual(["antagonist", "architect"].sort());
  });

  it("Architect is not adversarial; Antagonist is adversarial", () => {
    const plan = spawnPlan("design", ROLE_CATALOG);
    const architect = plan.find((r) => r.roleId === "architect");
    const antagonist = plan.find((r) => r.roleId === "antagonist");
    expect(architect?.isAdversarial).toBe(false);
    expect(antagonist?.isAdversarial).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// §2 — teamWidth returns count of stage roles
// ---------------------------------------------------------------------------

describe("teamWidth", () => {
  it("returns the number of roles in the plan (design = 2)", () => {
    const plan = spawnPlan("design", ROLE_CATALOG);
    expect(teamWidth(plan)).toBe(2);
  });

  it("returns 3 for discovery stage (Surveyor + Risk Analyst + Researcher)", () => {
    const plan = spawnPlan("discovery", ROLE_CATALOG);
    expect(teamWidth(plan)).toBe(3);
  });

  it("returns 0 for an unknown stage", () => {
    const plan = spawnPlan("__nonexistent__", ROLE_CATALOG);
    expect(teamWidth(plan)).toBe(0);
  });

  it("equals plan.length", () => {
    const plan = spawnPlan("spec", ROLE_CATALOG);
    expect(teamWidth(plan)).toBe(plan.length);
  });
});

// ---------------------------------------------------------------------------
// §3 — criticality is NOT a parameter (function arity = 2, no floor param)
// ---------------------------------------------------------------------------

describe("spawnPlan — criticality is not a parameter", () => {
  it("spawnPlan has exactly 2 parameters (stage, allRoles) — no criticality/floor param", () => {
    // Function.length returns the number of declared formal parameters.
    // AMENDMENT-002: agent count is WORK-driven, not criticality-gated.
    expect(spawnPlan.length).toBe(2);
  });

  it("calling spawnPlan with two different stages always returns the stage's roles regardless of caller intent", () => {
    // There is no way to pass a floor/criticality and get a different width.
    const planH = spawnPlan("design", ROLE_CATALOG);
    const planM = spawnPlan("design", ROLE_CATALOG);
    // Both must be identical (same stage, same catalog, no floor input).
    expect(planH.map((r) => r.roleId)).toEqual(planM.map((r) => r.roleId));
  });
});

// ---------------------------------------------------------------------------
// §4 — discovery stage
// ---------------------------------------------------------------------------

describe("spawnPlan — discovery stage", () => {
  it("returns Surveyor, Risk Analyst, and Researcher", () => {
    const plan = spawnPlan("discovery", ROLE_CATALOG);
    const roleIds = plan.map((r) => r.roleId);
    expect(roleIds).toContain("surveyor");
    expect(roleIds).toContain("risk-analyst");
    expect(roleIds).toContain("researcher");
  });

  it("has width 3", () => {
    expect(teamWidth(spawnPlan("discovery", ROLE_CATALOG))).toBe(3);
  });

  it("Researcher runs on haiku (lookup-heavy per cost table)", () => {
    const plan = spawnPlan("discovery", ROLE_CATALOG);
    const researcher = plan.find((r) => r.roleId === "researcher");
    expect(researcher?.model).toBe("haiku");
  });
});

// ---------------------------------------------------------------------------
// §5 — verify stage
// ---------------------------------------------------------------------------

describe("spawnPlan — verify stage", () => {
  it("returns Reviewer and Security Auditor", () => {
    const plan = spawnPlan("verify", ROLE_CATALOG);
    const roleIds = plan.map((r) => r.roleId);
    expect(roleIds).toContain("reviewer");
    expect(roleIds).toContain("security-auditor");
  });

  it("has width 2", () => {
    expect(teamWidth(spawnPlan("verify", ROLE_CATALOG))).toBe(2);
  });

  it("Security Auditor is adversarial (co-lane adversarial at verify)", () => {
    const plan = spawnPlan("verify", ROLE_CATALOG);
    const sa = plan.find((r) => r.roleId === "security-auditor");
    expect(sa?.isAdversarial).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// §6 — spec stage
// ---------------------------------------------------------------------------

describe("spawnPlan — spec stage", () => {
  it("returns Specwright and Contract Guardian", () => {
    const plan = spawnPlan("spec", ROLE_CATALOG);
    const roleIds = plan.map((r) => r.roleId);
    expect(roleIds).toContain("specwright");
    expect(roleIds).toContain("contract-guardian");
  });

  it("has width 2", () => {
    expect(teamWidth(spawnPlan("spec", ROLE_CATALOG))).toBe(2);
  });

  it("Contract Guardian is adversarial", () => {
    const plan = spawnPlan("spec", ROLE_CATALOG);
    const cg = plan.find((r) => r.roleId === "contract-guardian");
    expect(cg?.isAdversarial).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// §7 — impl stage
// ---------------------------------------------------------------------------

describe("spawnPlan — impl stage", () => {
  it("returns Executor and Test Writer", () => {
    const plan = spawnPlan("impl", ROLE_CATALOG);
    const roleIds = plan.map((r) => r.roleId);
    expect(roleIds).toContain("executor");
    expect(roleIds).toContain("test-writer");
  });

  it("has width 2", () => {
    expect(teamWidth(spawnPlan("impl", ROLE_CATALOG))).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// §8 — test stage
// ---------------------------------------------------------------------------

describe("spawnPlan — test stage", () => {
  it("returns Test Writer only", () => {
    const plan = spawnPlan("test", ROLE_CATALOG);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.roleId).toBe("test-writer");
  });
});

// ---------------------------------------------------------------------------
// §9 — unknown stage
// ---------------------------------------------------------------------------

describe("spawnPlan — unknown stage returns empty array", () => {
  it("returns [] for an unrecognized stage", () => {
    const plan = spawnPlan("__unknown_stage__", ROLE_CATALOG);
    expect(plan).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// §10 — M1: any blocked → "blocked"
// ---------------------------------------------------------------------------

describe("mergeTeamOutputs — M1: any blocked verdict", () => {
  it("returns blocked when one lane is blocked", () => {
    const verdicts: AgentVerdict[] = [
      doneVerdict("impl-lane-1"),
      blockedVerdict("impl-lane-2"),
    ];
    const result = mergeTeamOutputs("design", verdicts);
    expect(result.status).toBe("blocked");
  });

  it("returns blocked even if all other lanes are done-verified", () => {
    const verdicts: AgentVerdict[] = [
      doneVerifiedVerdict("lane-1"),
      doneVerifiedVerdict("lane-2"),
      blockedVerdict("lane-3"),
    ];
    expect(mergeTeamOutputs("design", verdicts).status).toBe("blocked");
  });
});

// ---------------------------------------------------------------------------
// §11 — M2: adversarial BLOCK finding prevents "done-verified"
// ---------------------------------------------------------------------------

describe("mergeTeamOutputs — M2: adversarial BLOCK finding", () => {
  it("returns at most 'done' (not done-verified) when adversarial has open BLOCK finding", () => {
    const verdicts: AgentVerdict[] = [
      doneVerdict("design-lane-1"),         // Architect: done
      adversarialBlockVerdict("design-lane-2"), // Antagonist: done but BLOCK finding
    ];
    const result = mergeTeamOutputs("design", verdicts);
    expect(result.status).not.toBe("done-verified");
    expect(["done", "partial", "blocked"]).toContain(result.status);
  });
});

// ---------------------------------------------------------------------------
// §12 — M3: majority partial → "partial"
// ---------------------------------------------------------------------------

describe("mergeTeamOutputs — M3: majority partial", () => {
  it("returns partial when majority of lanes are partial", () => {
    const verdicts: AgentVerdict[] = [
      partialVerdict("lane-1"),
      partialVerdict("lane-2"),
      doneVerdict("lane-3"),
    ];
    const result = mergeTeamOutputs("design", verdicts);
    expect(result.status).toBe("partial");
  });

  it("returns partial when all lanes are partial", () => {
    const verdicts: AgentVerdict[] = [
      partialVerdict("lane-1"),
      partialVerdict("lane-2"),
    ];
    expect(mergeTeamOutputs("design", verdicts).status).toBe("partial");
  });
});

// ---------------------------------------------------------------------------
// §13 — M4: all done + no BLOCK findings → "done"
// ---------------------------------------------------------------------------

describe("mergeTeamOutputs — M4: all done, no BLOCK findings", () => {
  it("returns 'done' when all lanes are done and no BLOCK findings exist", () => {
    const verdicts: AgentVerdict[] = [
      { ...doneVerdict("lane-1"), evidence: [] },
      { ...doneVerdict("lane-2"), evidence: [] },
    ];
    // No evidence → cannot reach done-verified → should be "done"
    const result = mergeTeamOutputs("design", verdicts);
    expect(result.status).toBe("done");
  });
});

// ---------------------------------------------------------------------------
// §14 — M5: all done + no BLOCK + evidence → "done-verified"
// ---------------------------------------------------------------------------

describe("mergeTeamOutputs — M5: done-verified requirements", () => {
  it("returns 'done-verified' when all done, no BLOCK findings, evidence present", () => {
    const verdicts: AgentVerdict[] = [
      doneVerdict("lane-1"),
      doneVerdict("lane-2"),
    ];
    const result = mergeTeamOutputs("design", verdicts);
    expect(result.status).toBe("done-verified");
  });

  it("aggregates evidence from all lanes in done-verified result", () => {
    const verdicts: AgentVerdict[] = [
      { ...doneVerdict("lane-1"), evidence: ["src/a.ts"] },
      { ...doneVerdict("lane-2"), evidence: ["src/b.ts"] },
    ];
    const result = mergeTeamOutputs("design", verdicts);
    expect(result.evidence).toContain("src/a.ts");
    expect(result.evidence).toContain("src/b.ts");
  });

  it("deduplicates evidence items", () => {
    const verdicts: AgentVerdict[] = [
      { ...doneVerdict("lane-1"), evidence: ["src/foo.ts"] },
      { ...doneVerdict("lane-2"), evidence: ["src/foo.ts"] },
    ];
    const result = mergeTeamOutputs("design", verdicts);
    const fooCount = result.evidence.filter((e) => e === "src/foo.ts").length;
    expect(fooCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// §15 — M6: timed-out lane → at most "partial"
// ---------------------------------------------------------------------------

describe("mergeTeamOutputs — M6: timed-out lane → partial", () => {
  it("returns partial when a lane timed out (even if others are done)", () => {
    const verdicts: AgentVerdict[] = [
      doneVerdict("lane-1"),
      timedOutVerdict("lane-2"),
    ];
    const result = mergeTeamOutputs("design", verdicts);
    expect(result.status).toBe("partial");
  });

  it("timed-out lane prevents done-verified", () => {
    const verdicts: AgentVerdict[] = [
      doneVerifiedVerdict("lane-1"),
      timedOutVerdict("lane-2"),
    ];
    expect(mergeTeamOutputs("design", verdicts).status).not.toBe("done-verified");
  });
});

// ---------------------------------------------------------------------------
// §16 — empty verdicts → "partial" (safe fallback)
// ---------------------------------------------------------------------------

describe("mergeTeamOutputs — empty verdicts", () => {
  it("returns partial for an empty verdict list", () => {
    const result = mergeTeamOutputs("design", []);
    expect(result.status).toBe("partial");
  });
});

// ---------------------------------------------------------------------------
// §17 — RoleDef shape: every catalog role has required fields
// ---------------------------------------------------------------------------

describe("ROLE_CATALOG — shape invariants", () => {
  it("every role has a non-empty roleId", () => {
    for (const role of ROLE_CATALOG) {
      expect(typeof role.roleId).toBe("string");
      expect(role.roleId.length).toBeGreaterThan(0);
    }
  });

  it("every role has at least one stage", () => {
    for (const role of ROLE_CATALOG) {
      expect(role.stages.length).toBeGreaterThan(0);
    }
  });

  it("every role has a model of 'sonnet' or 'haiku'", () => {
    for (const role of ROLE_CATALOG) {
      expect(["sonnet", "haiku"]).toContain(role.model);
    }
  });

  it("every role has at least one skillRef", () => {
    for (const role of ROLE_CATALOG) {
      expect(role.skillRefs.length).toBeGreaterThan(0);
    }
  });

  it("every skillRef has source 'base' (AMENDMENT-001: core never references corpus-* literals)", () => {
    for (const role of ROLE_CATALOG) {
      for (const ref of role.skillRefs) {
        expect(ref.source).toBe("base");
      }
    }
  });

  it("isAdversarial is a boolean on every role", () => {
    for (const role of ROLE_CATALOG) {
      expect(typeof role.isAdversarial).toBe("boolean");
    }
  });
});

// ---------------------------------------------------------------------------
// §18 — ROLE_CATALOG contains exactly 11 entries
// ---------------------------------------------------------------------------

describe("ROLE_CATALOG — cardinality", () => {
  it("contains exactly 11 role entries", () => {
    expect(ROLE_CATALOG).toHaveLength(11);
  });

  it("each roleId is unique across the catalog", () => {
    const ids = ROLE_CATALOG.map((r) => r.roleId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ROLE_CATALOG.length);
  });
});

// ---------------------------------------------------------------------------
// Custom catalog — spawnPlan respects the passed allRoles param
// ---------------------------------------------------------------------------

describe("spawnPlan — custom catalog filtering", () => {
  const customCatalog: RoleDef[] = [
    {
      roleId: "alpha",
      name: "Alpha",
      mission: "Alpha mission.",
      stages: ["design"],
      skillRefs: [{ source: "base", id: "architecture-system-design" }],
      model: "sonnet",
      isAdversarial: false,
    },
    {
      roleId: "beta",
      name: "Beta",
      mission: "Beta mission.",
      stages: ["spec"],
      skillRefs: [{ source: "base", id: "spec-driven-development" }],
      model: "sonnet",
      isAdversarial: true,
    },
  ];

  it("returns only roles whose stages include the given stage", () => {
    const plan = spawnPlan("design", customCatalog);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.roleId).toBe("alpha");
  });

  it("returns empty array when no role matches the stage in the custom catalog", () => {
    const plan = spawnPlan("verify", customCatalog);
    expect(plan).toEqual([]);
  });
});
