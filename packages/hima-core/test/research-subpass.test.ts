/**
 * Tests for research-subpass.ts — runResearchSubpassContext (R-041).
 *
 * Mandated scenarios:
 *  A. entryPoint "run" at floor M → returns the corpus-technical-analysis-discovery string
 *  B. entryPoint "run" at floor H → returns the corpus-technical-analysis-discovery string
 *  C. entryPoint "full" → returns null
 *  D. entryPoint "spec" → returns null
 *  E. entryPoint "" (empty string) → returns null
 *  F. entryPoint "other" (unrecognised) → returns null
 *
 * Return value shape:
 *  G. returned string for "run" contains "corpus-technical-analysis-discovery"
 *  H. returned string for "run" contains "[HIMA]"
 *  I. returned string for "run" is a non-empty string (not null)
 *
 * Pure function contract:
 *  J. identical calls return identical values (no side effects)
 */

import { describe, it, expect } from "vitest";
import { runResearchSubpassContext } from "../src/research-subpass.js";

// ---------------------------------------------------------------------------
// Mandated scenarios
// ---------------------------------------------------------------------------

describe("runResearchSubpassContext — mandated scenarios", () => {
  it("A. entryPoint 'run' at floor M → returns corpus-technical-analysis-discovery string", () => {
    const result = runResearchSubpassContext("run", "M");
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });

  it("B. entryPoint 'run' at floor H → returns corpus-technical-analysis-discovery string", () => {
    const result = runResearchSubpassContext("run", "H");
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });

  it("C. entryPoint 'full' → returns null", () => {
    expect(runResearchSubpassContext("full", "M")).toBeNull();
  });

  it("D. entryPoint 'spec' → returns null", () => {
    expect(runResearchSubpassContext("spec", "M")).toBeNull();
  });

  it("E. entryPoint '' (empty string) → returns null", () => {
    expect(runResearchSubpassContext("", "M")).toBeNull();
  });

  it("F. entryPoint 'other' (unrecognised) → returns null", () => {
    expect(runResearchSubpassContext("other", "T")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Return value shape
// ---------------------------------------------------------------------------

describe("runResearchSubpassContext — return value shape", () => {
  it("G. returned string for 'run' contains 'corpus-technical-analysis-discovery'", () => {
    const result = runResearchSubpassContext("run", "M");
    expect(result).toContain("corpus-technical-analysis-discovery");
  });

  it("H. returned string for 'run' contains '[HIMA]'", () => {
    const result = runResearchSubpassContext("run", "M");
    expect(result).toContain("[HIMA]");
  });

  it("I. returned string for 'run' is a non-empty string (not null)", () => {
    const result = runResearchSubpassContext("run", "T");
    expect(result).toBeTruthy();
    expect(result!.length).toBeGreaterThan(0);
  });

  it("returned string for 'run' mentions both advisory and forced modes", () => {
    const result = runResearchSubpassContext("run", "M");
    expect(result).toContain("advisory at M");
    expect(result).toContain("forced at H+");
  });
});

// ---------------------------------------------------------------------------
// Pure function contract
// ---------------------------------------------------------------------------

describe("runResearchSubpassContext — pure function contract", () => {
  it("J. identical calls return identical values", () => {
    const first = runResearchSubpassContext("run", "M");
    const second = runResearchSubpassContext("run", "M");
    expect(first).toBe(second);
  });

  it("'full' returns null across all floors", () => {
    expect(runResearchSubpassContext("full", "T")).toBeNull();
    expect(runResearchSubpassContext("full", "L")).toBeNull();
    expect(runResearchSubpassContext("full", "M")).toBeNull();
    expect(runResearchSubpassContext("full", "H")).toBeNull();
    expect(runResearchSubpassContext("full", "C")).toBeNull();
  });

  it("'spec' returns null across all floors", () => {
    expect(runResearchSubpassContext("spec", "T")).toBeNull();
    expect(runResearchSubpassContext("spec", "L")).toBeNull();
    expect(runResearchSubpassContext("spec", "M")).toBeNull();
    expect(runResearchSubpassContext("spec", "H")).toBeNull();
    expect(runResearchSubpassContext("spec", "C")).toBeNull();
  });

  it("'run' returns a string across all floors", () => {
    const floors = ["T", "L", "M", "H", "C"] as const;
    for (const floor of floors) {
      const result = runResearchSubpassContext("run", floor);
      expect(result).not.toBeNull();
      expect(typeof result).toBe("string");
    }
  });
});
