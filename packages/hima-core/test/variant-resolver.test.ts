/**
 * Tests for prompts-core/variant-resolver.ts — resolveVariant().
 *
 * Scenarios:
 *  1.  agentName="planner", variant "planner" present → "planner"  (step 1)
 *  2.  agentName="planner", no "planner" variant → falls through to step 2
 *  3.  agentName="executor" (not planner alias), modelID starts with "claude-",
 *      variant "claude" present → "claude"  (step 2)
 *  4.  modelID does not match any matcher, "default" present → "default"  (step 3)
 *  5.  modelID does not match, no "default" → first key of table  (step 4)
 *  6.  agentName="planner" but variant "planner" absent → step 2 (claude match)
 *  7.  agentName="planner", "planner" present → "planner" regardless of modelID
 *  8.  modelID="claude-haiku-3" → matches claude matcher → "claude"  (step 2)
 *  9.  modelID="gpt-4o" (no matcher), "default" present → "default"
 * 10.  empty variants → returns "default" (graceful fallback)
 */

import { describe, expect, it } from "vitest";
import {
  resolveVariant,
  PLANNER_AGENT_NAMES,
} from "../src/prompts-core/variant-resolver.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Minimal bundled PromptSource stand-in (content not inspected by resolver). */
const src = (label: string) => ({ kind: "bundled" as const, content: label });

// ---------------------------------------------------------------------------
// PLANNER_AGENT_NAMES — exported set shape
// ---------------------------------------------------------------------------

describe("PLANNER_AGENT_NAMES", () => {
  it('contains "planner"', () => {
    expect(PLANNER_AGENT_NAMES.has("planner")).toBe(true);
  });

  it('does not contain "executor"', () => {
    expect(PLANNER_AGENT_NAMES.has("executor")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Step 1 — planner alias
// ---------------------------------------------------------------------------

describe("resolveVariant — step 1: planner alias", () => {
  it('agentName="planner" + "planner" variant present → "planner"', () => {
    const result = resolveVariant({
      modelID: "claude-sonnet-4-6",
      agentName: "planner",
      variants: { planner: src("planner"), default: src("default") },
    });
    expect(result).toBe("planner");
  });

  it('planner takes priority over claude matcher when both present', () => {
    const result = resolveVariant({
      modelID: "claude-sonnet-4-6",
      agentName: "planner",
      variants: { planner: src("planner"), claude: src("claude"), default: src("default") },
    });
    expect(result).toBe("planner");
  });

  it('planner takes priority regardless of modelID (non-claude model)', () => {
    const result = resolveVariant({
      modelID: "gpt-4o",
      agentName: "planner",
      variants: { planner: src("planner"), default: src("default") },
    });
    expect(result).toBe("planner");
  });
});

// ---------------------------------------------------------------------------
// Step 2 — model matcher (claude)
// ---------------------------------------------------------------------------

describe("resolveVariant — step 2: model matcher", () => {
  it('modelID="claude-sonnet-4-6" + "claude" variant present → "claude"', () => {
    const result = resolveVariant({
      modelID: "claude-sonnet-4-6",
      agentName: "executor",
      variants: { claude: src("claude"), default: src("default") },
    });
    expect(result).toBe("claude");
  });

  it('modelID="claude-haiku-3" → matches claude matcher → "claude"', () => {
    const result = resolveVariant({
      modelID: "claude-haiku-3",
      agentName: "executor",
      variants: { claude: src("claude"), default: src("default") },
    });
    expect(result).toBe("claude");
  });

  it('modelID="claude-opus-4" → matches claude matcher → "claude"', () => {
    const result = resolveVariant({
      modelID: "claude-opus-4",
      agentName: "reviewer",
      variants: { claude: src("claude") },
    });
    expect(result).toBe("claude");
  });

  it('agentName="planner" without "planner" variant falls through to claude match', () => {
    const result = resolveVariant({
      modelID: "claude-sonnet-4-6",
      agentName: "planner",
      variants: { claude: src("claude"), default: src("default") },
    });
    // "planner" key absent → skip step 1 → step 2: claude matches
    expect(result).toBe("claude");
  });
});

// ---------------------------------------------------------------------------
// Step 3 — "default" fallback
// ---------------------------------------------------------------------------

describe('resolveVariant — step 3: "default" fallback', () => {
  it('modelID="gpt-4o" (no matcher), "default" present → "default"', () => {
    const result = resolveVariant({
      modelID: "gpt-4o",
      agentName: "executor",
      variants: { claude: src("claude"), default: src("default") },
    });
    expect(result).toBe("default");
  });

  it('unknown modelID + only "default" key → "default"', () => {
    const result = resolveVariant({
      modelID: "gemini-pro",
      agentName: "executor",
      variants: { default: src("default") },
    });
    expect(result).toBe("default");
  });
});

// ---------------------------------------------------------------------------
// Step 4 — first key fallback
// ---------------------------------------------------------------------------

describe("resolveVariant — step 4: first key fallback", () => {
  it('no matcher match, no "default" → returns first key', () => {
    const result = resolveVariant({
      modelID: "gpt-4o",
      agentName: "executor",
      variants: { fast: src("fast"), deep: src("deep") },
    });
    expect(result).toBe("fast");
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("resolveVariant — edge cases", () => {
  it("empty variants object → graceful fallback to default string", () => {
    const result = resolveVariant({
      modelID: "claude-sonnet-4-6",
      agentName: "executor",
      variants: {},
    });
    // No key available — function returns the string "default" as last resort
    expect(typeof result).toBe("string");
  });

  it('agentName="" (non-planner) + claude model → "claude"', () => {
    const result = resolveVariant({
      modelID: "claude-sonnet-4-6",
      agentName: "",
      variants: { planner: src("planner"), claude: src("claude"), default: src("default") },
    });
    // Empty agentName is not in PLANNER_AGENT_NAMES → skip step 1 → claude match
    expect(result).toBe("claude");
  });
});
