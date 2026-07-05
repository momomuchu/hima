/**
 * e2e-skill-force — walking-skeleton E2E test for the Claude enforcement chain.
 *
 * Proves end-to-end: GateVerdict → runGate() → ForceAction(skill-force) → Claude(exitCode 2).
 * And that after markLoaded(), the block clears (noop / exitCode 0).
 * Also validates pickSigil detects "ulw" terminal sigil.
 *
 * Uses a real tmp .hima root; no mocks.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { GateEvent, GateVerdict } from "@norm/schemas";
import { runGate } from "../src/run-gate.js";
import { markLoaded } from "../src/skill-state.js";
import { pickSigil } from "../src/keyword.js";

// ---------------------------------------------------------------------------
// Tmp dir lifecycle
// ---------------------------------------------------------------------------

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "hima-e2e-skill-force-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PRE_TOOL_EVENT: GateEvent = {
  gateType: "pre_tool",
  toolName: "Write",
};

const SKILL_GATE_VERDICT: GateVerdict = {
  decision: "block",
  reason: "spec gate: corpus-spec-driven-development required before implementation",
  forceIntent: {
    kind: "SkillGate",
    skillId: "corpus-spec-driven-development",
    blocksUntilInvoked: true,
  },
};

// ---------------------------------------------------------------------------
// E2E scenarios
// ---------------------------------------------------------------------------

describe("runGate — E2E skill-force chain", () => {
  it(
    "GIVEN empty skill register + SkillGate verdict → returns skill-force AND claude.exitCode=2",
    async () => {
      const result = await runGate({
        root,
        runtime: "claude",
        gateType: "pre_tool",
        event: PRE_TOOL_EVENT,
        verdict: SKILL_GATE_VERDICT,
      });

      // ForceAction must be skill-force
      expect(result.forceAction.kind).toBe("skill-force");
      if (result.forceAction.kind === "skill-force") {
        expect(result.forceAction.skillId).toBe("corpus-spec-driven-development");
      }

      // Claude translation: blocked with exitCode 2
      expect(result.claude.decision).toBe("block");
      expect(result.claude.exitCode).toBe(2);

      // Canary confirms skill was forced
      expect(result.canary).toContain("pre_tool");
      expect(result.canary).toContain("corpus-spec-driven-development");
    },
  );

  it(
    "GIVEN skill already markLoaded → SAME runGate returns noop AND claude.exitCode=0",
    async () => {
      // Mark the skill as loaded in the register first.
      await markLoaded(root, {
        source: "corpus",
        id: "corpus-spec-driven-development",
      });

      const result = await runGate({
        root,
        runtime: "claude",
        gateType: "pre_tool",
        event: PRE_TOOL_EVENT,
        verdict: SKILL_GATE_VERDICT,
      });

      // After loading, the block must clear
      expect(result.forceAction.kind).toBe("noop");
      expect(result.claude.decision).toBe("continue");
      expect(result.claude.exitCode).toBe(0);

      // Canary reflects no forced skill
      expect(result.canary).toContain("forced:none");
    },
  );
});

// ---------------------------------------------------------------------------
// Sigil detection — "build the thing ulw" → entryPoint full, floor H
// ---------------------------------------------------------------------------

describe("pickSigil — ulw alias detection", () => {
  it('detects "ulw" at end of message and maps to entryPoint=full, floor=H', () => {
    const match = pickSigil("build the thing ulw");

    expect(match).not.toBeNull();
    expect(match?.sigil).toBe("ulw");
    expect(match?.entryPoint).toBe("full");
    expect(match?.floor).toBe("H");
  });

  it("returns null when no terminal sigil is present", () => {
    expect(pickSigil("just a normal message")).toBeNull();
  });

  it("ignores ulw inside a fenced code block", () => {
    expect(pickSigil("check this out\n```\nulw\n```")).toBeNull();
  });
});
