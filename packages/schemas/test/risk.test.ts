import { Either } from "effect";
import { describe, expect, it } from "vitest";
import { decodeRiskClass, decodeRiskClassEither, RISK_ORDER } from "../src/risk.js";

describe("RiskClass schema", () => {
  it.each(["T", "L", "M", "H", "C"] as const)("decodes valid class %s", (cls) => {
    expect(decodeRiskClass(cls)).toBe(cls);
  });

  it("rejects an unknown class 'X'", () => {
    const result = decodeRiskClassEither("X");
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects a lowercase 't'", () => {
    const result = decodeRiskClassEither("t");
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects a number", () => {
    const result = decodeRiskClassEither(2);
    expect(Either.isLeft(result)).toBe(true);
  });
});

describe("RISK_ORDER", () => {
  it("maps all five classes to distinct integers 0..4", () => {
    expect(RISK_ORDER).toEqual({ T: 0, L: 1, M: 2, H: 3, C: 4 });
  });

  it("orders T < L < M < H < C", () => {
    expect(RISK_ORDER["T"]).toBeLessThan(RISK_ORDER["L"]);
    expect(RISK_ORDER["L"]).toBeLessThan(RISK_ORDER["M"]);
    expect(RISK_ORDER["M"]).toBeLessThan(RISK_ORDER["H"]);
    expect(RISK_ORDER["H"]).toBeLessThan(RISK_ORDER["C"]);
  });

  it("supports floor comparison: H >= M is true", () => {
    expect(RISK_ORDER["H"] >= RISK_ORDER["M"]).toBe(true);
  });

  it("supports floor comparison: L >= H is false", () => {
    expect(RISK_ORDER["L"] >= RISK_ORDER["H"]).toBe(false);
  });
});
