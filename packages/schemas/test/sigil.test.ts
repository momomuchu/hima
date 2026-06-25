import { Either } from "effect";
import { describe, expect, it } from "vitest";
import { decodeSigilMatch, decodeSigilMatchEither } from "../src/sigil.js";

describe("SigilMatch schema", () => {
  it("decodes a valid full/H match (canonical sigil)", () => {
    const value = {
      sigil: "full",
      entryPoint: "full",
      floor: "H",
    };
    expect(decodeSigilMatch(value)).toEqual(value);
  });

  it("decodes a valid ulw/H match (alias sigil resolves to full)", () => {
    const value = {
      sigil: "ulw",
      entryPoint: "full",
      floor: "H",
    };
    expect(decodeSigilMatch(value)).toEqual(value);
  });

  it("decodes a valid run/M match", () => {
    const value = {
      sigil: "run",
      entryPoint: "run",
      floor: "M",
    };
    expect(decodeSigilMatch(value)).toEqual(value);
  });

  it("decodes a valid spec/M match", () => {
    const value = {
      sigil: "spec",
      entryPoint: "spec",
      floor: "M",
    };
    expect(decodeSigilMatch(value)).toEqual(value);
  });

  it("rejects an invalid entryPoint", () => {
    const result = decodeSigilMatchEither({
      sigil: "ulw",
      entryPoint: "ulw",
      floor: "H",
    });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects an invalid floor RiskClass", () => {
    const result = decodeSigilMatchEither({
      sigil: "full",
      entryPoint: "full",
      floor: "X",
    });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects a missing entryPoint field", () => {
    const result = decodeSigilMatchEither({
      sigil: "run",
      floor: "M",
    });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects a missing sigil field", () => {
    const result = decodeSigilMatchEither({
      entryPoint: "spec",
      floor: "M",
    });
    expect(Either.isLeft(result)).toBe(true);
  });
});
