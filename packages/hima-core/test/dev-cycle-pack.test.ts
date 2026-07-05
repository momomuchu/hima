import { DEV_CYCLE, decodeCycleDef } from "@norm/schemas";
import { describe, expect, it } from "vitest";
import {
  BASE_META_SKILLS,
  DEV_CYCLE_PACK_SKILLS,
  GENERIC_DEV_CYCLE,
} from "../src/dev-cycle-pack.js";

// ---------------------------------------------------------------------------
// GENERIC_DEV_CYCLE — decodes as a valid CycleDef
// ---------------------------------------------------------------------------

describe("GENERIC_DEV_CYCLE", () => {
  it("decodes via decodeCycleDef as a valid CycleDef", () => {
    expect(() => decodeCycleDef(GENERIC_DEV_CYCLE)).not.toThrow();
    const decoded = decodeCycleDef(GENERIC_DEV_CYCLE);
    expect(decoded).toEqual(GENERIC_DEV_CYCLE);
  });

  it("contains zero SkillRef with source \"corpus\"", () => {
    const allRefs = GENERIC_DEV_CYCLE.stages.flatMap((stage) => [
      ...stage.forceSkills,
      ...stage.injectSkills,
    ]);
    const corpusRefs = allRefs.filter((ref) => ref.source === "corpus");
    expect(corpusRefs).toEqual([]);
  });

  it("has the same 8 stage ids as DEV_CYCLE (swap-compatible)", () => {
    const genericIds = GENERIC_DEV_CYCLE.stages.map((s) => s.id);
    const devIds = DEV_CYCLE.stages.map((s) => s.id);
    expect(genericIds).toEqual(devIds);
    expect(genericIds).toHaveLength(8);
  });

  it("forces exactly one base-sourced skill per stage", () => {
    for (const stage of GENERIC_DEV_CYCLE.stages) {
      expect(stage.forceSkills.length).toBeGreaterThan(0);
      for (const ref of stage.forceSkills) {
        expect(ref.source).toBe("base");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// BASE_META_SKILLS — the 8 meta/orchestration skills
// ---------------------------------------------------------------------------

describe("BASE_META_SKILLS", () => {
  it("has 8 entries, all source \"base\"", () => {
    expect(BASE_META_SKILLS).toHaveLength(8);
    for (const ref of BASE_META_SKILLS) {
      expect(ref.source).toBe("base");
    }
  });

  it("contains the expected hima-* meta skill ids", () => {
    const ids = BASE_META_SKILLS.map((ref) => ref.id).sort();
    expect(ids).toEqual(
      [
        "norm-admit",
        "norm-covenant",
        "norm-lookout",
        "norm-muster",
        "norm-parley",
        "norm-purge",
        "norm-triage",
        "norm-warden",
      ].sort(),
    );
  });
});

// ---------------------------------------------------------------------------
// DEV_CYCLE_PACK_SKILLS — the 7 stage-bound default pack skills
// ---------------------------------------------------------------------------

describe("DEV_CYCLE_PACK_SKILLS", () => {
  it("has 7 entries, all source \"base\"", () => {
    expect(DEV_CYCLE_PACK_SKILLS).toHaveLength(7);
    for (const ref of DEV_CYCLE_PACK_SKILLS) {
      expect(ref.source).toBe("base");
    }
  });

  it("contains the expected hima-* stage-bound skill ids", () => {
    const ids = DEV_CYCLE_PACK_SKILLS.map((ref) => ref.id).sort();
    expect(ids).toEqual(
      [
        "norm-blueprint",
        "norm-charter",
        "norm-forge",
        "norm-stewardship",
        "norm-survey",
        "norm-trial",
        "norm-verdict",
      ].sort(),
    );
  });
});
