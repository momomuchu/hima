/**
 * golden-g3.test.ts — snapshot regression of the real generator output.
 *
 * Calls runGenerator against the live otherskill corpus (dryRun:true) and
 * asserts hard numeric contracts + worked-example field values from
 * goal3/extract/skill-catalog-map.md §4 / §4b.
 *
 * If the corpus path is absent the suite skips entirely — no spurious failure.
 */
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runGenerator, type GeneratorResult } from "../src/index.js";

const CORPUS_ROOT =
  "C:/Users/momomuchu/research/otherskill/dist/excellence-pack/skills";
const ACTIVATION_RULES_PATH =
  "C:/Users/momomuchu/research/otherskill/.planning/term-universe/_activation/ACTIVATION-RULES.md";

const corpusPresent =
  existsSync(CORPUS_ROOT) && existsSync(ACTIVATION_RULES_PATH);

// ---------------------------------------------------------------------------
// Lazy-run: evaluate once, share across all assertions.
// ---------------------------------------------------------------------------
let result: GeneratorResult;
function getResult(): GeneratorResult {
  if (!result) {
    result = runGenerator({
      corpusRoot: CORPUS_ROOT,
      activationRulesPath: ACTIVATION_RULES_PATH,
      dryRun: true,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
describe("golden-g3 — generator output regression", () => {
  // ---- guard ---------------------------------------------------------------
  it.skipIf(!corpusPresent)(
    "corpus + activation-rules paths must exist (skip when absent)",
    () => {
      // If we reach here, both paths are present — nothing to assert.
      expect(corpusPresent).toBe(true);
    },
  );

  // ---- numeric contracts ---------------------------------------------------
  it.skipIf(!corpusPresent)("skillCount === 32", () => {
    expect(getResult().skillCount).toBe(32);
  });

  it.skipIf(!corpusPresent)("validSkills === 32", () => {
    expect(getResult().validSkills).toBe(32);
  });

  it.skipIf(!corpusPresent)("validActivate === 16", () => {
    expect(getResult().validActivate).toBe(16);
  });

  it.skipIf(!corpusPresent)("canary.passed === true", () => {
    expect(getResult().canary.passed).toBe(true);
  });

  it.skipIf(!corpusPresent)("errors.length === 0", () => {
    const res = getResult();
    expect(
      res.errors,
      `Generator errors:\n${res.errors.join("\n")}`,
    ).toHaveLength(0);
  });

  // ---- worked example A: technical-analysis-discovery ---------------------
  it.skipIf(!corpusPresent)(
    "technical-analysis-discovery entry matches skill-catalog-map §4",
    () => {
      const entries = (
        getResult() as GeneratorResult & { _drafts?: unknown[] }
      );
      // Re-run with access to drafts via a dry-run; the GeneratorResult does
      // not expose drafts directly, so we re-invoke (cached corpus parse is
      // fast). We validate via the public GeneratorResult shape that the
      // skill was counted and validated, and use a second focused call to
      // expose the entry through the generator's own validation path.
      // Since GeneratorResult does not expose draft entries, we call parse +
      // mapSkill directly via the generator's own index export to stay
      // white-box minimal.  The simplest assertion available without touching
      // internals: re-run with canaryOnly to confirm infra, then use a
      // structural check via the full result's error list (zero errors means
      // all 32 entries — including these two — passed the schema).
      //
      // For the id / owns / keywords fields we import the internal helpers
      // directly from their modules.
      expect(getResult().errors).toHaveLength(0); // both entries valid
    },
  );

  // ---- worked example A: deep field assertions via internal parse ---------
  it.skipIf(!corpusPresent)(
    "technical-analysis-discovery: id, owns subset, keywords subset",
    async () => {
      // Import internal modules directly (ESM, same package).
      const { parse } = await import("../src/parse.js");
      const { mapSkill } = await import("../src/map.js");

      const { rawSkills } = parse(CORPUS_ROOT, ACTIVATION_RULES_PATH);

      const raw = rawSkills.find((s) => s.dir === "technical-analysis-discovery-excellence-book");
      expect(raw, "raw skill for technical-analysis-discovery not found").toBeDefined();
      if (!raw) return;

      const entry = mapSkill(raw);

      // id — GAP-1 rule: strip -excellence-book suffix
      expect(entry.id).toBe("technical-analysis-discovery");

      // owns subset (skill-catalog-map §4 verbatim)
      const expectedOwns = [
        "current-state comparative analysis decisions",
        "codebase mapping decisions",
        "impact analysis decisions",
        "dependency/API evaluation decisions",
        "feasibility spike decisions",
        "migration readiness decisions",
        "analysis-to-plan handoff decisions",
      ];
      for (const own of expectedOwns) {
        expect(entry.owns, `owns missing: "${own}"`).toContain(own);
      }

      // keywords subset (AUTO-INVOQUER verbatim from §4)
      const expectedKeywords = [
        "impact analysis",
        "codebase mapping",
        "feasibility",
        "spike",
        "dependency evaluation",
        "migration readiness",
        "discovery",
        "pre-implementation",
        "technical analysis",
        "blast radius",
      ];
      for (const kw of expectedKeywords) {
        expect(
          entry.activation.keywords,
          `keyword missing: "${kw}"`,
        ).toContain(kw);
      }
    },
  );

  // ---- worked example B: product-strategy ---------------------------------
  it.skipIf(!corpusPresent)(
    "product-strategy: id, owns subset, keywords subset",
    async () => {
      const { parse } = await import("../src/parse.js");
      const { mapSkill } = await import("../src/map.js");

      const { rawSkills } = parse(CORPUS_ROOT, ACTIVATION_RULES_PATH);

      const raw = rawSkills.find((s) => s.dir === "product-strategy-excellence-book");
      expect(raw, "raw skill for product-strategy not found").toBeDefined();
      if (!raw) return;

      const entry = mapSkill(raw);

      // id — GAP-1: strip -excellence-book suffix
      expect(entry.id).toBe("product-strategy");

      // owns subset (skill-catalog-map §4b verbatim)
      const expectedOwns = [
        "product vision decisions",
        "bet portfolio decisions",
        "roadmap prioritization decisions",
        "product principle decisions",
        "product review decisions",
        "kill condition decisions",
      ];
      for (const own of expectedOwns) {
        expect(entry.owns, `owns missing: "${own}"`).toContain(own);
      }

      // keywords subset (AUTO-INVOQUER verbatim from §4b)
      const expectedKeywords = [
        "product strategy",
        "roadmap",
        "product vision",
        "bet",
        "prioritization",
        "product review",
        "kill condition",
        "product principles",
        "now-next-later",
        "product portfolio",
      ];
      for (const kw of expectedKeywords) {
        expect(
          entry.activation.keywords,
          `keyword missing: "${kw}"`,
        ).toContain(kw);
      }
    },
  );
});
