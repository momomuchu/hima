/**
 * Tests for behavior-core/registry.ts — Registry + module-level helpers.
 *
 * Scenarios:
 *  1. Fresh Registry: getBehaviorsForGate returns empty array for unknown gate
 *  2. Register a descriptor, then retrieve it by gate type
 *  3. Registering the same descriptor id twice is idempotent (no duplicates)
 *  4. Descriptor covering multiple gates is retrievable under each gate
 *  5. defaultRegistry is pre-seeded with BEH-023 under "stop"
 *  6. Module-level registerBehavior / getBehaviorsForGate delegates to defaultRegistry
 */

import { describe, it, expect } from "vitest";
import { Registry, defaultRegistry, registerBehavior, getBehaviorsForGate } from "../src/behavior-core/registry.js";
import { BEH_023 } from "../src/behavior-core/beh-023-completion.js";
import type { BehaviorDescriptor } from "../src/behavior-core/types.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDescriptor(
  id: string,
  gates: BehaviorDescriptor["gates"],
): BehaviorDescriptor {
  return {
    id,
    gates,
    evaluate: () => ({ decision: "allow", reason: "test", behaviorId: id }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Registry class", () => {
  it("1. empty registry returns [] for any gate", () => {
    const reg = new Registry();
    expect(reg.getBehaviorsForGate("stop")).toEqual([]);
    expect(reg.getBehaviorsForGate("pre_tool")).toEqual([]);
    expect(reg.getBehaviorsForGate("user_prompt")).toEqual([]);
  });

  it("2. registered descriptor is retrievable by gate type", () => {
    const reg = new Registry();
    const d = makeDescriptor("test-001", ["stop"]);
    reg.registerBehavior(d);
    const results = reg.getBehaviorsForGate("stop");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("test-001");
  });

  it("3. registering the same id twice is idempotent (no duplicates)", () => {
    const reg = new Registry();
    const d = makeDescriptor("dedup-001", ["stop"]);
    reg.registerBehavior(d);
    reg.registerBehavior(d);
    expect(reg.getBehaviorsForGate("stop")).toHaveLength(1);
  });

  it("4. descriptor covering multiple gates is retrievable under each gate", () => {
    const reg = new Registry();
    const d = makeDescriptor("multi-gate", ["stop", "pre_tool"]);
    reg.registerBehavior(d);
    expect(reg.getBehaviorsForGate("stop")).toHaveLength(1);
    expect(reg.getBehaviorsForGate("pre_tool")).toHaveLength(1);
    expect(reg.getBehaviorsForGate("user_prompt")).toHaveLength(0);
  });

  it("5. registering two different descriptors under the same gate returns both", () => {
    const reg = new Registry();
    reg.registerBehavior(makeDescriptor("aaa", ["stop"]));
    reg.registerBehavior(makeDescriptor("bbb", ["stop"]));
    const results = reg.getBehaviorsForGate("stop");
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.id)).toContain("aaa");
    expect(results.map((r) => r.id)).toContain("bbb");
  });

  it("6. descriptors for different gates do not bleed into each other", () => {
    const reg = new Registry();
    reg.registerBehavior(makeDescriptor("stop-only", ["stop"]));
    reg.registerBehavior(makeDescriptor("pre-only", ["pre_tool"]));
    expect(reg.getBehaviorsForGate("stop").map((d) => d.id)).toEqual(["stop-only"]);
    expect(reg.getBehaviorsForGate("pre_tool").map((d) => d.id)).toEqual(["pre-only"]);
  });
});

describe("defaultRegistry (module singleton)", () => {
  it("5. pre-seeded with BEH-023 under stop gate", () => {
    const behaviors = defaultRegistry.getBehaviorsForGate("stop");
    const ids = behaviors.map((b) => b.id);
    expect(ids).toContain(BEH_023.id);
  });

  it("BEH-023 is NOT registered under pre_tool or user_prompt", () => {
    const preToolIds = defaultRegistry.getBehaviorsForGate("pre_tool").map((b) => b.id);
    const userPromptIds = defaultRegistry.getBehaviorsForGate("user_prompt").map((b) => b.id);
    expect(preToolIds).not.toContain(BEH_023.id);
    expect(userPromptIds).not.toContain(BEH_023.id);
  });
});

describe("module-level convenience helpers", () => {
  it("6. getBehaviorsForGate delegates to defaultRegistry", () => {
    const fromHelper = getBehaviorsForGate("stop");
    const fromRegistry = defaultRegistry.getBehaviorsForGate("stop");
    expect(fromHelper.map((b) => b.id)).toEqual(fromRegistry.map((b) => b.id));
  });

  it("registerBehavior adds to defaultRegistry (idempotent re-add of BEH-023)", () => {
    const before = getBehaviorsForGate("stop").length;
    registerBehavior(BEH_023); // same id — should be a no-op
    const after = getBehaviorsForGate("stop").length;
    expect(after).toBe(before);
  });
});
