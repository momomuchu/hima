import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildSessionResumeContext,
  buildPreCompactContext,
} from "../src/session-state.js";
import { createWard, advanceStage } from "../src/ward-store.js";
import { markLoaded } from "../src/skill-state.js";

// ---------------------------------------------------------------------------
// Tmp dir lifecycle
// ---------------------------------------------------------------------------

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(os.tmpdir(), "session-state-test-"));
});

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// buildSessionResumeContext
// ---------------------------------------------------------------------------

describe("buildSessionResumeContext", () => {
  it("returns null when no ward file exists", async () => {
    const result = await buildSessionResumeContext(tmpRoot);
    expect(result).toBeNull();
  });

  it("returns the expected string including ward id + stage when a ward exists (no verdicts)", async () => {
    await createWard(tmpRoot, { id: "run-001", entryPoint: "full", floor: "H" });

    const result = await buildSessionResumeContext(tmpRoot);

    expect(result).toBe(
      "[HIMA] resuming ward:run-001 stage:discovery floor:H (last-sealed: none)",
    );
  });

  it("includes the last sealed stage name when verdicts exist", async () => {
    await createWard(tmpRoot, { id: "run-002", entryPoint: "full", floor: "M" });
    // Advance from discovery → spec; the closed stage (discovery) becomes last-sealed.
    await advanceStage(tmpRoot, "spec", "done");

    const result = await buildSessionResumeContext(tmpRoot);

    expect(result).toBe(
      "[HIMA] resuming ward:run-002 stage:spec floor:M (last-sealed: discovery)",
    );
  });

  it("reflects the most recent sealed stage after multiple advances", async () => {
    await createWard(tmpRoot, { id: "run-003", entryPoint: "full", floor: "C" });
    await advanceStage(tmpRoot, "spec", "done-verified");
    await advanceStage(tmpRoot, "build", "done");

    const result = await buildSessionResumeContext(tmpRoot);

    // openStage is now "build"; last sealed is "spec"
    expect(result).toBe(
      "[HIMA] resuming ward:run-003 stage:build floor:C (last-sealed: spec)",
    );
  });

  it("works for a run entry-point ward (openStage is spec)", async () => {
    await createWard(tmpRoot, { id: "run-004", entryPoint: "run", floor: "L" });

    const result = await buildSessionResumeContext(tmpRoot);

    expect(result).toBe(
      "[HIMA] resuming ward:run-004 stage:spec floor:L (last-sealed: none)",
    );
  });
});

// ---------------------------------------------------------------------------
// buildPreCompactContext
// ---------------------------------------------------------------------------

describe("buildPreCompactContext", () => {
  it("returns null when no ward file exists", async () => {
    const result = await buildPreCompactContext(tmpRoot);
    expect(result).toBeNull();
  });

  it("returns the expected string with an empty skill register", async () => {
    await createWard(tmpRoot, { id: "run-010", entryPoint: "run", floor: "L" });

    const result = await buildPreCompactContext(tmpRoot);

    expect(result).toBe(
      "[HIMA pre-compact] preserve: ward run-010 stage spec floor L skillRegister:[]",
    );
  });

  it("includes ward id and stage in the output", async () => {
    await createWard(tmpRoot, { id: "run-011", entryPoint: "full", floor: "H" });

    const result = await buildPreCompactContext(tmpRoot);

    expect(result).not.toBeNull();
    expect(result).toContain("run-011");
    expect(result).toContain("discovery");
    expect(result).toContain("H");
  });

  it("lists loaded skill refs as source:id pairs in the skillRegister field", async () => {
    await createWard(tmpRoot, { id: "run-012", entryPoint: "full", floor: "H" });
    await markLoaded(tmpRoot, { source: "base", id: "corpus-ui-knowledge" });
    await markLoaded(tmpRoot, { source: "corpus", id: "architecture-system-design" });

    const result = await buildPreCompactContext(tmpRoot);

    expect(result).toBe(
      "[HIMA pre-compact] preserve: ward run-012 stage discovery floor H" +
        " skillRegister:[base:corpus-ui-knowledge,corpus:architecture-system-design]",
    );
  });

  it("preserves insertion order of skill refs", async () => {
    await createWard(tmpRoot, { id: "run-013", entryPoint: "spec", floor: "M" });
    await markLoaded(tmpRoot, { source: "user", id: "my-custom-skill" });
    await markLoaded(tmpRoot, { source: "project", id: "team-rules" });
    await markLoaded(tmpRoot, { source: "base", id: "core-behavior" });

    const result = await buildPreCompactContext(tmpRoot);

    expect(result).toBe(
      "[HIMA pre-compact] preserve: ward run-013 stage spec floor M" +
        " skillRegister:[user:my-custom-skill,project:team-rules,base:core-behavior]",
    );
  });
});
