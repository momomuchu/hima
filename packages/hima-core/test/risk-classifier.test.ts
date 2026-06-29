/**
 * Tests for risk-classifier.ts — classifyRisk().
 *
 * Required scenarios (gap register R-018):
 *   (1) Payment / auth prompt → floor "C"
 *   (2) Architectural verb (FR: "refais l architecture du module") → floor "H"
 *   (3) Bounded implementation verb ("add a small helper") → floor "M"
 *   (4) Pure info question ("what does X mean?") → floor "T"
 *   (5) reasons[] is non-empty when floor ≠ "T"
 *   (6) reasons[] is empty when floor is "T"
 *   (7) Max floor wins when multiple signal groups fire
 *   (8) Case-insensitivity
 */

import { describe, expect, it } from "vitest";
import { classifyRisk } from "../src/risk-classifier.js";

// ─────────────────────────────────────────────────────────────────────────────
// Floor "C" — security / financial / identity-critical signals
// ─────────────────────────────────────────────────────────────────────────────

describe("classifyRisk — floor C signals", () => {
  it('returns C for a payment prompt', () => {
    const result = classifyRisk("process a payment for the user");
    expect(result.floor).toBe("C");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('returns C for an auth prompt', () => {
    const result = classifyRisk("update auth middleware to use JWT");
    expect(result.floor).toBe("C");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('returns C for a credential prompt', () => {
    const result = classifyRisk("store credential in the vault");
    expect(result.floor).toBe("C");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('returns C for a secret prompt', () => {
    const result = classifyRisk("rotate the secret key before deploying");
    expect(result.floor).toBe("C");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('returns C for a schema-migration prompt', () => {
    const result = classifyRisk("write a schema migration for users table");
    expect(result.floor).toBe("C");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('returns C for a security prompt', () => {
    const result = classifyRisk("review the security model for the API");
    expect(result.floor).toBe("C");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('returns C for a password prompt', () => {
    const result = classifyRisk("hash the password before storing it");
    expect(result.floor).toBe("C");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('returns C for an OAuth prompt', () => {
    const result = classifyRisk("implement OAuth with Google");
    expect(result.floor).toBe("C");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('C beats H when both signals present (auth + refactor)', () => {
    const result = classifyRisk("refactor the authentication flow");
    expect(result.floor).toBe("C");
    // both the architectural and auth rules fired
    expect(result.reasons.length).toBeGreaterThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Floor "H" — architectural verbs and broad-scope indicators
// ─────────────────────────────────────────────────────────────────────────────

describe("classifyRisk — floor H signals", () => {
  it('returns H for French architectural prompt "refais l architecture du module"', () => {
    const result = classifyRisk("refais l architecture du module");
    expect(result.floor).toBe("H");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('returns H for "refactor the database layer"', () => {
    const result = classifyRisk("refactor the database layer");
    expect(result.floor).toBe("H");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('returns H for "rewrite the rendering engine"', () => {
    const result = classifyRisk("rewrite the rendering engine");
    expect(result.floor).toBe("H");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('returns H for "migrate the legacy API to v2"', () => {
    const result = classifyRisk("migrate the legacy API to v2");
    expect(result.floor).toBe("H");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('returns H for "redesign the module interface"', () => {
    const result = classifyRisk("redesign the module interface");
    expect(result.floor).toBe("H");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('returns H for "restructure the project layout"', () => {
    const result = classifyRisk("restructure the project layout");
    expect(result.floor).toBe("H");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('returns H for multi-file scope indicator', () => {
    const result = classifyRisk("update multi-file imports across the project");
    expect(result.floor).toBe("H");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('returns H for "everything" scope indicator', () => {
    const result = classifyRisk("clean up everything in the repo");
    expect(result.floor).toBe("H");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('returns H for cross-cut scope indicator', () => {
    const result = classifyRisk("apply cross-cut logging to all handlers");
    expect(result.floor).toBe("H");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('multiple H groups both contribute to reasons[]', () => {
    const result = classifyRisk("refactor everything in the multi-module codebase");
    expect(result.floor).toBe("H");
    // architectural verb + broad-scope indicator should both fire
    expect(result.reasons.length).toBeGreaterThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Floor "M" — bounded implementation verbs
// ─────────────────────────────────────────────────────────────────────────────

describe("classifyRisk — floor M signals", () => {
  it('returns M for "add a small helper"', () => {
    const result = classifyRisk("add a small helper");
    expect(result.floor).toBe("M");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('returns M for "implement the missing endpoint"', () => {
    const result = classifyRisk("implement the missing endpoint");
    expect(result.floor).toBe("M");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('returns M for "fix the off-by-one error"', () => {
    const result = classifyRisk("fix the off-by-one error in the loop");
    expect(result.floor).toBe("M");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('returns M for "create a new utility function"', () => {
    const result = classifyRisk("create a new utility function for date parsing");
    expect(result.floor).toBe("M");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('returns M for "build a simple test"', () => {
    const result = classifyRisk("build a simple test for the validator");
    expect(result.floor).toBe("M");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('returns M for "write a helper"', () => {
    const result = classifyRisk("write a helper to format dates");
    expect(result.floor).toBe("M");
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Floor "T" — pure info / no signals
// ─────────────────────────────────────────────────────────────────────────────

describe("classifyRisk — floor T (no signals)", () => {
  it('returns T for a pure info question "what does X mean?"', () => {
    const result = classifyRisk("what does X mean?");
    expect(result.floor).toBe("T");
    expect(result.reasons).toEqual([]);
  });

  it('returns T for an empty string', () => {
    const result = classifyRisk("");
    expect(result.floor).toBe("T");
    expect(result.reasons).toEqual([]);
  });

  it('returns T for "what is the purpose of the canary?"', () => {
    const result = classifyRisk("what is the purpose of the canary?");
    expect(result.floor).toBe("T");
    expect(result.reasons).toEqual([]);
  });

  it('returns T for "show me the logs"', () => {
    const result = classifyRisk("show me the logs");
    expect(result.floor).toBe("T");
    expect(result.reasons).toEqual([]);
  });

  it('returns T for "explain how the gate works"', () => {
    const result = classifyRisk("explain how the gate works");
    expect(result.floor).toBe("T");
    expect(result.reasons).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Case-insensitivity
// ─────────────────────────────────────────────────────────────────────────────

describe("classifyRisk — case insensitivity", () => {
  it('upper-case PAYMENT → C', () => {
    const result = classifyRisk("PROCESS A PAYMENT");
    expect(result.floor).toBe("C");
  });

  it('mixed-case Auth → C', () => {
    const result = classifyRisk("fix Auth flow");
    expect(result.floor).toBe("C");
  });

  it('upper-case REFACTOR → H', () => {
    const result = classifyRisk("REFACTOR the entire module");
    expect(result.floor).toBe("H");
  });

  it('mixed-case Add → M', () => {
    const result = classifyRisk("Add a helper function");
    expect(result.floor).toBe("M");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// reasons contract
// ─────────────────────────────────────────────────────────────────────────────

describe("classifyRisk — reasons contract", () => {
  it('reasons is empty exactly when floor is T', () => {
    const t = classifyRisk("what does this function return?");
    expect(t.floor).toBe("T");
    expect(t.reasons).toHaveLength(0);
  });

  it('reasons is non-empty when floor is M', () => {
    const m = classifyRisk("add a validator");
    expect(m.reasons.length).toBeGreaterThan(0);
  });

  it('reasons is non-empty when floor is H', () => {
    const h = classifyRisk("restructure the codebase");
    expect(h.reasons.length).toBeGreaterThan(0);
  });

  it('reasons is non-empty when floor is C', () => {
    const c = classifyRisk("handle auth tokens securely");
    expect(c.reasons.length).toBeGreaterThan(0);
  });

  it('all fired reasons are non-empty strings', () => {
    const result = classifyRisk("refactor the payment flow");
    for (const reason of result.reasons) {
      expect(typeof reason).toBe("string");
      expect(reason.length).toBeGreaterThan(0);
    }
  });
});
