/**
 * Tests for BEH-031 — Watcher Subagent Role for High-Risk Runs
 *
 * Spec: docs/conception/12-behaviors-catalog-spec.md §7 BEH-031
 *
 * Falsifies-If regression (from spec):
 *   A run at risk class H or C completes without any watcher SubagentRunRecord in
 *   run-set.json#/runSet/subagents and without a WATCHER_NOT_REGISTERED event in
 *   the gate event log. One such completion disproves this behavior.
 */

import { describe, expect, it } from "vitest";
import {
  BEH_031_DEGRADED_MODE,
  VIOLATION_WATCHER_NOT_REGISTERED,
  watcherSubagentRole,
} from "../src/behaviors/beh-031-watcher.js";
import type { GateEvaluationContext } from "../src/gates/evaluate-gate.js";
import type { GateEvent } from "../src/schemas/gate-event.schema.js";
import type { SubagentRunRecord } from "../src/schemas/run-set.schema.js";
import { createDefaultPlanningProject } from "../src/storage/planning-store.js";
import type { RiskClass } from "../src/types/canonical.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContext(
  riskClass: RiskClass,
  subagents: SubagentRunRecord[] = [],
): GateEvaluationContext {
  const project = createDefaultPlanningProject("run_beh031_test");
  return {
    projectRoot: "/tmp/project",
    state: project.state,
    currentRisk: {
      ...project.currentRisk,
      risk_class: riskClass,
      rank: { T: 0, L: 1, M: 2, H: 3, C: 4 }[riskClass],
      bypass_allowed: riskClass === "T" || riskClass === "L",
      human_checkpoint_required: riskClass === "H" || riskClass === "C",
    },
    runSet: {
      ...project.runSet,
      route: { ...project.runSet.route, riskClass },
      subagents,
    },
  };
}

function makeSubagentStartEvent(agentId = "executor-1"): GateEvent {
  return {
    gateType: "subagent_start",
    metadata: {
      agentId,
      task: "implement feature X",
      scope: ["src/"],
      deliverables: ["src/feature.ts"],
    },
  };
}

function watcherRecord(status: SubagentRunRecord["status"] = "requested"): SubagentRunRecord {
  return {
    agentId: "watcher-1",
    role: "watcher",
    status,
    scope: [".planning/"],
    deliverables: [],
  };
}

// ── Descriptor shape ──────────────────────────────────────────────────────────

describe("BEH-031 descriptor", () => {
  it("has id BEH-031", () => {
    expect(watcherSubagentRole.id).toBe("BEH-031");
  });

  it("fires only on subagent_start gate", () => {
    expect(watcherSubagentRole.gates).toEqual(["subagent_start"]);
  });

  it("exports degraded-mode strings for codex and hermes", () => {
    expect(typeof BEH_031_DEGRADED_MODE.codex).toBe("string");
    expect(typeof BEH_031_DEGRADED_MODE.hermes).toBe("string");
    expect(BEH_031_DEGRADED_MODE.codex.length).toBeGreaterThan(0);
    expect(BEH_031_DEGRADED_MODE.hermes.length).toBeGreaterThan(0);
  });

  it("exports violation type identifier", () => {
    expect(VIOLATION_WATCHER_NOT_REGISTERED).toBe("WATCHER_NOT_REGISTERED");
  });
});

// ── Below risk floor — abstain ────────────────────────────────────────────────

describe("BEH-031 — below risk floor (T, L, M)", () => {
  it.each([
    "T",
    "L",
    "M",
  ] as RiskClass[])("abstains at risk class %s even when no watcher is registered", (riskClass) => {
    const ctx = makeContext(riskClass, []);
    const event = makeSubagentStartEvent();
    const verdict = watcherSubagentRole.classify(ctx, event);
    expect(verdict).toBeNull();
  });
});

// ── Risk class H — watcher required ──────────────────────────────────────────

describe("BEH-031 — risk class H", () => {
  it("warns when no watcher is registered", () => {
    const ctx = makeContext("H", []);
    const event = makeSubagentStartEvent();
    const verdict = watcherSubagentRole.classify(ctx, event);
    expect(verdict).not.toBeNull();
    expect(verdict?.decision).toBe("warn");
    expect(verdict?.violationType).toBe("WATCHER_NOT_REGISTERED");
  });

  it("abstains when a watcher with status 'requested' is registered", () => {
    const ctx = makeContext("H", [watcherRecord("requested")]);
    const event = makeSubagentStartEvent();
    const verdict = watcherSubagentRole.classify(ctx, event);
    expect(verdict).toBeNull();
  });

  it("abstains when a watcher with status 'running' is registered", () => {
    const ctx = makeContext("H", [watcherRecord("running")]);
    const event = makeSubagentStartEvent();
    const verdict = watcherSubagentRole.classify(ctx, event);
    expect(verdict).toBeNull();
  });

  it("abstains when a watcher with status 'completed' is registered", () => {
    const ctx = makeContext("H", [watcherRecord("completed")]);
    const event = makeSubagentStartEvent();
    const verdict = watcherSubagentRole.classify(ctx, event);
    expect(verdict).toBeNull();
  });

  it("warns when only non-watcher subagents are present", () => {
    const executor: SubagentRunRecord = {
      agentId: "executor-1",
      role: "executor",
      status: "running",
      scope: ["src/"],
      deliverables: [],
    };
    const ctx = makeContext("H", [executor]);
    const event = makeSubagentStartEvent();
    const verdict = watcherSubagentRole.classify(ctx, event);
    expect(verdict?.decision).toBe("warn");
  });

  it("warns when watcher record has status 'failed' (not an active status)", () => {
    const ctx = makeContext("H", [watcherRecord("failed")]);
    const event = makeSubagentStartEvent();
    const verdict = watcherSubagentRole.classify(ctx, event);
    expect(verdict?.decision).toBe("warn");
  });

  it("warns when watcher record has status 'cancelled'", () => {
    const ctx = makeContext("H", [watcherRecord("cancelled")]);
    const event = makeSubagentStartEvent();
    const verdict = watcherSubagentRole.classify(ctx, event);
    expect(verdict?.decision).toBe("warn");
  });

  it("warn reason mentions role 'watcher' and allowedTools guidance", () => {
    const ctx = makeContext("H", []);
    const event = makeSubagentStartEvent();
    const verdict = watcherSubagentRole.classify(ctx, event);
    expect(verdict?.reason).toContain("watcher");
    expect(verdict?.reason).toContain("Read");
    expect(verdict?.reason).toContain(".planning/");
  });

  it("includes the risk class in the warn reason", () => {
    const ctx = makeContext("H", []);
    const event = makeSubagentStartEvent();
    const verdict = watcherSubagentRole.classify(ctx, event);
    expect(verdict?.reason).toContain("H");
  });
});

// ── Risk class C — same as H ──────────────────────────────────────────────────

describe("BEH-031 — risk class C", () => {
  it("warns when no watcher registered at C", () => {
    const ctx = makeContext("C", []);
    const event = makeSubagentStartEvent();
    const verdict = watcherSubagentRole.classify(ctx, event);
    expect(verdict?.decision).toBe("warn");
    expect(verdict?.violationType).toBe("WATCHER_NOT_REGISTERED");
  });

  it("abstains when watcher is registered at C", () => {
    const ctx = makeContext("C", [watcherRecord("running")]);
    const event = makeSubagentStartEvent();
    const verdict = watcherSubagentRole.classify(ctx, event);
    expect(verdict).toBeNull();
  });
});

// ── Multiple subagents — one watcher is sufficient ───────────────────────────

describe("BEH-031 — multiple subagents", () => {
  it("abstains when watcher is present among multiple subagents", () => {
    const executor: SubagentRunRecord = {
      agentId: "executor-1",
      role: "executor",
      status: "running",
      scope: ["src/"],
      deliverables: [],
    };
    const reviewer: SubagentRunRecord = {
      agentId: "reviewer-1",
      role: "reviewer",
      status: "requested",
      scope: [".planning/"],
      deliverables: [],
    };
    const ctx = makeContext("H", [executor, reviewer, watcherRecord("requested")]);
    const event = makeSubagentStartEvent();
    const verdict = watcherSubagentRole.classify(ctx, event);
    expect(verdict).toBeNull();
  });
});

// ── Falsifies-If regression guard ────────────────────────────────────────────
//
// From spec §7 BEH-031 falsifies_if:
//   "A run at risk class H or C completes without any watcher SubagentRunRecord in
//    run-set.json#/runSet/subagents and without a WATCHER_NOT_REGISTERED event in
//    the gate event log. One such completion disproves this behavior."

describe("BEH-031 Falsifies-If counter-example regression", () => {
  it("COUNTER-EXAMPLE: H-class subagent_start with no watcher in runSet MUST warn (never allow)", () => {
    const ctx = makeContext("H", []); // empty subagent list — no watcher
    const event = makeSubagentStartEvent("executor-new");

    const verdict = watcherSubagentRole.classify(ctx, event);

    // This is the falsifying case: if verdict is null (allow), behavior is broken.
    expect(verdict).not.toBeNull();
    expect(verdict?.decision).toBe("warn");
    expect(verdict?.violationType).toBe("WATCHER_NOT_REGISTERED");
  });

  it("COUNTER-EXAMPLE: C-class subagent_start with no watcher MUST warn (never allow)", () => {
    const ctx = makeContext("C", []);
    const event = makeSubagentStartEvent("executor-critical");

    const verdict = watcherSubagentRole.classify(ctx, event);

    expect(verdict).not.toBeNull();
    expect(verdict?.decision).toBe("warn");
  });
});
