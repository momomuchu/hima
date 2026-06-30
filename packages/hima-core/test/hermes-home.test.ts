/**
 * Tests for hermes-home.ts — hermesHomeWarning() (R-055).
 *
 * Scenarios:
 *  1. HERMES_HOME absent (key not present)  → warning string
 *  2. HERMES_HOME empty string              → warning string
 *  3. HERMES_HOME set to a full path        → null
 *  4. HERMES_HOME set to any non-empty str  → null
 *  5. Unrelated env vars do not suppress warning
 *  6. Warning text is stable (exact match for downstream consumers)
 */

import { describe, it, expect } from "vitest";
import { hermesHomeWarning, HERMES_HOME_WARNING } from "../src/hermes-home.js";

// ---------------------------------------------------------------------------
// Absent / empty → warning
// ---------------------------------------------------------------------------

describe("hermesHomeWarning — HERMES_HOME absent", () => {
  it("returns the warning string when HERMES_HOME key is not present", () => {
    expect(hermesHomeWarning({})).toBe(HERMES_HOME_WARNING);
  });

  it("returns the warning string when env is empty", () => {
    const env: Record<string, string | undefined> = {};
    expect(hermesHomeWarning(env)).not.toBeNull();
  });

  it("returns the warning string when HERMES_HOME is explicitly undefined", () => {
    expect(hermesHomeWarning({ HERMES_HOME: undefined })).toBe(HERMES_HOME_WARNING);
  });

  it("returns the warning string when HERMES_HOME is an empty string", () => {
    expect(hermesHomeWarning({ HERMES_HOME: "" })).toBe(HERMES_HOME_WARNING);
  });
});

// ---------------------------------------------------------------------------
// Set → null
// ---------------------------------------------------------------------------

describe("hermesHomeWarning — HERMES_HOME set", () => {
  it("returns null when HERMES_HOME is a full profile path", () => {
    expect(
      hermesHomeWarning({ HERMES_HOME: "/home/user/.hermes/profiles/dev" }),
    ).toBeNull();
  });

  it("returns null when HERMES_HOME is a tilde-prefixed path", () => {
    expect(
      hermesHomeWarning({ HERMES_HOME: "~/.hermes/profiles/work" }),
    ).toBeNull();
  });

  it("returns null when HERMES_HOME is any non-empty string", () => {
    expect(hermesHomeWarning({ HERMES_HOME: "x" })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Isolation — unrelated env vars
// ---------------------------------------------------------------------------

describe("hermesHomeWarning — unrelated env vars", () => {
  it("still returns warning when only unrelated vars are present", () => {
    expect(
      hermesHomeWarning({ PATH: "/usr/bin", HOME: "/home/user" }),
    ).toBe(HERMES_HOME_WARNING);
  });

  it("returns null when HERMES_HOME is set alongside other vars", () => {
    expect(
      hermesHomeWarning({
        PATH: "/usr/bin",
        HERMES_HOME: "/home/user/.hermes/profiles/dev",
        HOME: "/home/user",
      }),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Warning text stability
// ---------------------------------------------------------------------------

describe("hermesHomeWarning — warning text contract", () => {
  it("warning starts with [HIMA WARNING]", () => {
    const w = hermesHomeWarning({});
    expect(w).toMatch(/^\[HIMA WARNING\]/);
  });

  it("warning mentions HERMES_HOME", () => {
    const w = hermesHomeWarning({});
    expect(w).toContain("HERMES_HOME");
  });

  it("warning mentions profile switching", () => {
    const w = hermesHomeWarning({});
    expect(w).toContain("profile switching");
  });

  it("HERMES_HOME_WARNING constant matches returned warning", () => {
    expect(hermesHomeWarning({})).toBe(HERMES_HOME_WARNING);
  });
});
