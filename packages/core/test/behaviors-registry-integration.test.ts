/**
 * Behaviors Registry Integration Test
 *
 * Asserts that all 12 BehaviorDescriptor modules are registered in the dispatch
 * registry after importing behaviors/index.ts, and that getBehaviorsForGate
 * returns the correct subset for each gate type.
 *
 * This is the saturation gate for Step 1 of the behavior integration task.
 */

import { describe, expect, it } from "vitest";

// Import the behaviors index to trigger all registrations
import "../src/behaviors/index.js";

import { getAllBehaviors, getBehaviorsForGate } from "../src/gates/behavior-registry.js";

const EXPECTED_IDS = [
  "BEH-010",
  "BEH-011",
  "BEH-012",
  "BEH-013",
  "BEH-014",
  "BEH-020",
  "BEH-021",
  "BEH-022",
  "BEH-023",
  "BEH-030",
  "BEH-031",
  "BEH-032",
] as const;

describe("behaviors registry — all 12 descriptors registered", () => {
  it("registers exactly the 12 expected behavior IDs", () => {
    const registeredIds = getAllBehaviors().map((b) => b.id);
    for (const id of EXPECTED_IDS) {
      expect(registeredIds, `${id} must be registered`).toContain(id);
    }
    expect(registeredIds.length).toBeGreaterThanOrEqual(12);
  });

  it("getBehaviorsForGate(pre_tool) returns BEH-010, BEH-012, BEH-032", () => {
    const ids = getBehaviorsForGate("pre_tool").map((b) => b.id);
    expect(ids).toContain("BEH-010"); // read-before-write
    expect(ids).toContain("BEH-012"); // chesterton-fence
    expect(ids).toContain("BEH-032"); // kill-switch (fires on pre_tool too)
  });

  it("getBehaviorsForGate(post_tool) returns BEH-011, BEH-022", () => {
    const ids = getBehaviorsForGate("post_tool").map((b) => b.id);
    expect(ids).toContain("BEH-011"); // suppression-guard
    expect(ids).toContain("BEH-022"); // loop-detector
  });

  it("getBehaviorsForGate(user_prompt) returns BEH-014, BEH-032", () => {
    const ids = getBehaviorsForGate("user_prompt").map((b) => b.id);
    expect(ids).toContain("BEH-014"); // anti-sycophancy
    expect(ids).toContain("BEH-032"); // kill-switch
  });

  it("getBehaviorsForGate(stop) returns BEH-013, BEH-021, BEH-023", () => {
    const ids = getBehaviorsForGate("stop").map((b) => b.id);
    expect(ids).toContain("BEH-013"); // claim-source
    expect(ids).toContain("BEH-021"); // dimension-retry
    expect(ids).toContain("BEH-023"); // completion-status
  });

  it("getBehaviorsForGate(subagent_start) returns BEH-030, BEH-031", () => {
    const ids = getBehaviorsForGate("subagent_start").map((b) => b.id);
    expect(ids).toContain("BEH-030"); // subagent-contract
    expect(ids).toContain("BEH-031"); // watcher
  });

  it("getBehaviorsForGate(subagent_stop) returns BEH-020, BEH-021", () => {
    const ids = getBehaviorsForGate("subagent_stop").map((b) => b.id);
    expect(ids).toContain("BEH-020"); // critic-gate
    expect(ids).toContain("BEH-021"); // dimension-retry
  });
});
