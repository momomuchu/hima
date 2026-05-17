/**
 * Stage 4 — non-vacuity canary (generator-architecture.md §4).
 * Feeds a deliberately malformed entry through the validator. If the
 * validator accepts it, non-vacuity is broken and the run must fail.
 */
import { SkillCatalogEntrySchema } from "./schemas.js";

export interface CanaryResult {
  readonly passed: boolean;
  readonly errorCount: number;
  readonly message: string;
}

export function runCanary(): CanaryResult {
  // 3 injected defects: non-kebab id, empty keywords, missing required arrays.
  const malformed = {
    id: "NOT KEBAB CASE!",
    title: "x",
    purpose: "x",
    activation: {
      macroCycles: [],
      riskClasses: [],
      keywords: [],
      auto: true,
    },
    owns: [],
    outOfScope: [],
    evidenceProduced: [],
    hookRefs: [],
    subagentRefs: [],
  };
  const res = SkillCatalogEntrySchema.safeParse(malformed);
  const errorCount = res.success ? 0 : res.error.issues.length;
  const passed = !res.success && errorCount >= 3;
  return {
    passed,
    errorCount,
    message: passed
      ? `canary OK — validator rejected malformed entry with ${errorCount} issues`
      : "CANARY FAIL: validator accepted malformed skill — non-vacuity broken",
  };
}
