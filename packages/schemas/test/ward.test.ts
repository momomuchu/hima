import { Either } from "effect";
import { describe, expect, it } from "vitest";
import { decodeWard, decodeWardEither } from "../src/ward.js";

describe("Ward schema", () => {
  const freshWard = {
    id: "run-2026-01-01",
    entryPoint: "full",
    floor: "H",
    openStage: "discovery",
    skillRegister: [],
    verdicts: [],
  };

  it("decodes a fresh ward with empty registers and no deferred field", () => {
    const result = decodeWard(freshWard);
    expect(result.id).toBe("run-2026-01-01");
    expect(result.entryPoint).toBe("full");
    expect(result.floor).toBe("H");
    expect(result.openStage).toBe("discovery");
    expect(result.skillRegister).toEqual([]);
    expect(result.verdicts).toEqual([]);
    expect(result.deferred).toBeUndefined();
  });

  it("decodes a ward with skill refs and stage verdicts", () => {
    const value = {
      ...freshWard,
      skillRegister: [
        { source: "corpus", id: "corpus-spec-driven-development" },
        { source: "base", id: "governor" },
      ],
      verdicts: [
        {
          stage: "discovery",
          status: "done-verified",
          evidence: ["architecture-v3 read", "goals read"],
        },
      ],
    };
    const result = decodeWard(value);
    expect(result.skillRegister).toHaveLength(2);
    expect(result.verdicts[0].status).toBe("done-verified");
    expect(result.verdicts[0].evidence).toHaveLength(2);
  });

  it("decodes a ward with the optional deferred field present", () => {
    const value = {
      ...freshWard,
      deferred: ".hima/pending-stop-verdict-abc.json",
    };
    const result = decodeWard(value);
    expect(result.deferred).toBe(".hima/pending-stop-verdict-abc.json");
  });

  it("decodes all valid entryPoint values", () => {
    for (const ep of ["full", "run", "spec"] as const) {
      const result = decodeWard({ ...freshWard, entryPoint: ep });
      expect(result.entryPoint).toBe(ep);
    }
  });

  it("decodes all valid RiskClass floor values", () => {
    for (const floor of ["T", "L", "M", "H", "C"] as const) {
      const result = decodeWard({ ...freshWard, floor });
      expect(result.floor).toBe(floor);
    }
  });

  it("rejects an unknown entryPoint", () => {
    const result = decodeWardEither({ ...freshWard, entryPoint: "ulw" });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects an invalid floor value", () => {
    const result = decodeWardEither({ ...freshWard, floor: "X" });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects a verdict with a bad status", () => {
    const result = decodeWardEither({
      ...freshWard,
      verdicts: [{ stage: "spec", status: "in-progress", evidence: [] }],
    });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects a skill ref with an unknown source", () => {
    const result = decodeWardEither({
      ...freshWard,
      skillRegister: [{ source: "npm", id: "some-skill" }],
    });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects a ward missing the required id field", () => {
    const { id: _omitted, ...noId } = freshWard;
    const result = decodeWardEither(noId);
    expect(Either.isLeft(result)).toBe(true);
  });

  it("accepts all valid StageVerdict status literals", () => {
    const statuses = [
      "blocked",
      "partial",
      "done",
      "done-verified",
      "done-validated",
    ] as const;
    for (const status of statuses) {
      const result = decodeWard({
        ...freshWard,
        verdicts: [{ stage: "impl", status, evidence: [] }],
      });
      expect(result.verdicts[0].status).toBe(status);
    }
  });
});
