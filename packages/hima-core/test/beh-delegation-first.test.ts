/**
 * Tests for behavior-core/beh-delegation-first.ts — SPEC-018 Delegation-First gate.
 *
 * Pure decision (decideDelegationFirst) truth table:
 *   a. design + H + Write + src/x.ts + no delegation      → block DELEGATION_FIRST
 *   b. impl   + C + Edit  + src/x.ts + no delegation      → block
 *   c. test   + H + MultiEdit + src/x.ts + no delegation  → block
 *   d. design + H + Write + src/x.ts + delegationActive   → allow
 *   e. impl   + M + Write + src/x.ts + no delegation      → warn (below H)
 *   f. impl   + T + Write + src/x.ts + no delegation      → allow (inert)
 *   g. impl   + L + Write + src/x.ts + no delegation      → allow (inert)
 *   h. discovery + H + Write + src/x.ts                   → allow (not work-bearing)
 *   i. spec   + H + Write + src/x.ts                      → allow (planner stage)
 *   j. verify + H + Write + src/x.ts                      → allow (reviewer, not executor)
 *   k. impl   + H + Bash                                  → allow (non-write)
 *   l. impl   + H + Write + docs/x.md                     → allow (.md)
 *   m. impl   + H + Write + .hima/plans/p.md              → allow (.hima)
 *   n. impl   + H + Write + undefined path                → allow (defensive)
 *   o. impl   + H + Write + src/x.ts + soloWaiver         → allow (escape hatch)
 *   p. block reason names implementer + verifier + `hima delegate`
 *
 * Behavior (BEH_DELEGATION_FIRST.evaluate) with a real temp root + lane marker:
 *   q. ward impl + H + Write src + NO marker  → block
 *   r. ward impl + H + Write src + marker set → allow
 *   s. no ward → allow
 *   t. descriptor id + gates
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  decideDelegationFirst,
  BEH_DELEGATION_FIRST,
} from "../src/behavior-core/beh-delegation-first.js";
import { markLane, markStageDelegation } from "../src/behavior-core/delegation-lane.js";
import type { BehaviorContext, BehaviorVerdict } from "../src/behavior-core/types.js";
import type { RiskClass, Ward } from "@hima/schemas";

// ---------------------------------------------------------------------------
// Pure decision truth table
// ---------------------------------------------------------------------------

type Dec = { decision: "allow" | "warn" | "block"; reason: string; violationType?: string };

function decide(
  o: Partial<{
    stage: string;
    riskClass: RiskClass;
    toolName: string;
    targetPath?: string;
    root?: string;
    delegationActive: boolean;
    soloWaiver: boolean;
  }> = {},
): Dec {
  return decideDelegationFirst({
    stage: o.stage ?? "impl",
    riskClass: o.riskClass ?? "H",
    toolName: o.toolName ?? "Write",
    targetPath: "targetPath" in o ? o.targetPath : "src/x.ts",
    root: o.root ?? "/project/root",
    delegationActive: o.delegationActive ?? false,
    soloWaiver: o.soloWaiver ?? false,
  });
}

describe("decideDelegationFirst — truth table", () => {
  it("a. design + H + Write, no delegation → block", () => {
    const d = decide({ stage: "design", riskClass: "H" });
    expect(d.decision).toBe("block");
    expect(d.violationType).toBe("DELEGATION_FIRST");
  });
  it("b. impl + C + Edit, no delegation → block", () => {
    expect(decide({ stage: "impl", riskClass: "C", toolName: "Edit" }).decision).toBe("block");
  });
  it("c. test + H + MultiEdit, no delegation → block", () => {
    expect(decide({ stage: "test", riskClass: "H", toolName: "MultiEdit" }).decision).toBe("block");
  });
  it("d. design + H + Write, delegation active → allow", () => {
    expect(decide({ stage: "design", riskClass: "H", delegationActive: true }).decision).toBe("allow");
  });
  it("e. impl + M + Write, no delegation → allow (inert; block threshold is High+)", () => {
    expect(decide({ stage: "impl", riskClass: "M" }).decision).toBe("allow");
  });
  it("f. impl + T + Write → allow (inert)", () => {
    expect(decide({ stage: "impl", riskClass: "T" }).decision).toBe("allow");
  });
  it("g. impl + L + Write → allow (inert)", () => {
    expect(decide({ stage: "impl", riskClass: "L" }).decision).toBe("allow");
  });
  it("h. discovery + H + Write → allow (not work-bearing)", () => {
    expect(decide({ stage: "discovery", riskClass: "H" }).decision).toBe("allow");
  });
  it("i. spec + H + Write → allow (planner stage)", () => {
    expect(decide({ stage: "spec", riskClass: "H" }).decision).toBe("allow");
  });
  it("j. verify + H + Write → block (verify is a work-bearing review/qa stage)", () => {
    expect(decide({ stage: "verify", riskClass: "H" }).decision).toBe("block");
  });
  it("j2. maintenance + H + Write → allow (not a work-bearing stage)", () => {
    expect(decide({ stage: "maintenance", riskClass: "H" }).decision).toBe("allow");
  });
  it("k. impl + H + Bash → allow (non-write)", () => {
    expect(decide({ stage: "impl", riskClass: "H", toolName: "Bash" }).decision).toBe("allow");
  });
  it("l. impl + H + Write + docs/x.md → allow (.md)", () => {
    expect(decide({ stage: "impl", riskClass: "H", targetPath: "docs/x.md" }).decision).toBe("allow");
  });
  it("m. impl + H + Write + .hima/plans/p → allow (.hima)", () => {
    expect(decide({ stage: "impl", riskClass: "H", targetPath: ".hima/plans/p.json" }).decision).toBe("allow");
  });
  it("n. impl + H + Write + undefined path → allow (defensive)", () => {
    expect(decide({ stage: "impl", riskClass: "H", targetPath: undefined }).decision).toBe("allow");
  });
  it("o. impl + H + Write + soloWaiver → allow (escape hatch)", () => {
    expect(decide({ stage: "impl", riskClass: "H", soloWaiver: true }).decision).toBe("allow");
  });
  it("p. block reason names implementer + verifier + `hima delegate`", () => {
    const d = decide({ stage: "impl", riskClass: "H" });
    expect(d.reason).toMatch(/implementer/i);
    expect(d.reason).toMatch(/verifier/i);
    expect(d.reason).toMatch(/hima delegate/);
  });

  // Property: for any work-bearing stage + write + impl file + no delegation,
  // decision is block iff riskClass ∈ {H,C}, warn iff M, allow iff {T,L}.
  it("property: criticality threshold at H across all work-bearing stages", () => {
    for (const stage of ["design", "impl", "test", "verify"]) {
      expect(decide({ stage, riskClass: "H" }).decision).toBe("block");
      expect(decide({ stage, riskClass: "C" }).decision).toBe("block");
      expect(decide({ stage, riskClass: "M" }).decision).toBe("allow"); // inert below High
      expect(decide({ stage, riskClass: "L" }).decision).toBe("allow");
      expect(decide({ stage, riskClass: "T" }).decision).toBe("allow");
    }
  });

  // ── reason-content + branch pinning (mutation-hardening) ──────────────────
  it("block reason embeds the actual stage and riskClass + separation-of-duties", () => {
    const d = decide({ stage: "design", riskClass: "C" });
    expect(d.reason).toContain('"design"');
    expect(d.reason).toContain("C-criticality");
    expect(d.reason).toMatch(/separates duties/i);
    expect(d.reason).toMatch(/HIMA_SOLO_OK/);
    expect(d.violationType).toBe("DELEGATION_FIRST");
  });
  it("M is inert (allow) with a below-High reason and no violationType", () => {
    const d = decide({ stage: "impl", riskClass: "M" });
    expect(d.decision).toBe("allow");
    expect(d.reason).toMatch(/below High/);
    expect(d.violationType).toBeUndefined();
  });
  it("each allow branch carries its distinctive reason (and no violationType)", () => {
    expect(decide({ toolName: "Bash" }).reason).toMatch(/non-write tool/);
    expect(decide({ stage: "discovery" }).reason).toMatch(/not a work-bearing stage/);
    expect(decide({ targetPath: "docs/x.md" }).reason).toMatch(/not an implementation file/);
    expect(decide({ delegationActive: true }).reason).toMatch(/delegation active/);
    expect(decide({ riskClass: "L" }).reason).toMatch(/below High/);
    expect(decide({ soloWaiver: true }).reason).toMatch(/HIMA_SOLO_OK/);
    for (const o of [
      { toolName: "Bash" },
      { stage: "discovery" },
      { targetPath: "docs/x.md" },
      { delegationActive: true },
      { riskClass: "L" as const },
      { soloWaiver: true },
    ]) {
      expect(decide(o).violationType).toBeUndefined();
    }
  });
  it("impl-file classification: absolute + root-relative + no-root all block at H", () => {
    // absolute impl path
    expect(decide({ targetPath: "/abs/src/x.ts", root: "/project" }).decision).toBe("block");
    // relative impl path with root
    expect(decide({ targetPath: "src/x.ts", root: "/project" }).decision).toBe("block");
    // relative impl path with NO root (root undefined) — still classified as impl
    expect(decide({ targetPath: "src/x.ts", root: undefined }).decision).toBe("block");
    // <root>/.hima state path is never an impl file → allow even at H
    expect(decide({ targetPath: "/project/.hima/state/x.json", root: "/project" }).decision).toBe("allow");
    expect(decide({ targetPath: ".hima/plans/p.json", root: "/project" }).decision).toBe("allow");
    // decoy: a nested ".hima" segment NOT at <root>/.hima is a real impl write → block
    expect(decide({ targetPath: "src/.hima/evil.ts", root: "/project" }).decision).toBe("block");
    expect(decide({ targetPath: "/project/src/.hima/evil.ts", root: "/project" }).decision).toBe("block");
    // nested .md → allow
    expect(decide({ targetPath: "a/b/c.md", root: "/project" }).decision).toBe("allow");
  });
});

// ---------------------------------------------------------------------------
// Behavior wiring (fs marker resolution)
// ---------------------------------------------------------------------------

let root: string;
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "delfirst-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env.HIMA_SOLO_OK;
});

function makeWard(openStage: string, overrides: Partial<Ward> = {}): Ward {
  return {
    id: "ward-001",
    entryPoint: "full",
    floor: "H",
    openStage,
    skillRegister: [],
    verdicts: [],
    ...overrides,
  };
}

function makeCtx(overrides: Partial<BehaviorContext> = {}): BehaviorContext {
  return {
    event: {
      gateType: "pre_tool",
      toolName: "Write",
      toolInput: { file_path: "src/x.ts", content: "const x = 1;" },
    },
    riskClass: "H",
    root,
    ward: makeWard("impl"),
    sessionId: "sess-main",
    ...overrides,
  };
}

function evaluate(ctx: BehaviorContext): BehaviorVerdict {
  return BEH_DELEGATION_FIRST.evaluate(ctx) as BehaviorVerdict;
}

describe("BEH_DELEGATION_FIRST.evaluate — marker resolution", () => {
  it("q. ward impl + H + Write src + NO lane marker → block", () => {
    const v = evaluate(makeCtx());
    expect(v.decision).toBe("block");
    expect(v.violationType).toBe("DELEGATION_FIRST");
  });

  it("r. same, but the session is marked as a delegated lane → allow", () => {
    markLane(root, "sess-main");
    expect(evaluate(makeCtx()).decision).toBe("allow");
  });

  it("r2. a sub-agent started at this ward+stage (auto stage-delegation) → allow", () => {
    // no lane marker for this session, but delegation was observed at ward+stage
    markStageDelegation(root, "ward-001", "impl");
    expect(evaluate(makeCtx()).decision).toBe("allow");
  });

  it("r3. stage-delegation at a DIFFERENT stage does not unblock this stage", () => {
    markStageDelegation(root, "ward-001", "design");
    expect(evaluate(makeCtx()).decision).toBe("block");
  });

  it("s. no ward → allow", () => {
    expect(evaluate(makeCtx({ ward: null })).decision).toBe("allow");
  });

  it("HIMA_SOLO_OK=1 waives the block (logged escape hatch)", () => {
    process.env.HIMA_SOLO_OK = "1";
    expect(evaluate(makeCtx()).decision).toBe("allow");
  });

  it("t. descriptor id + gates", () => {
    expect(BEH_DELEGATION_FIRST.id).toBe("BEH-DELEGATION-FIRST");
    expect(BEH_DELEGATION_FIRST.gates).toEqual(["pre_tool"]);
  });
});
