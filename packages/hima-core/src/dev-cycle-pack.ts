/**
 * dev-cycle-pack — the base-tier, corpus-free meta skills + the swappable default dev-cycle pack.
 *
 * Per ADR-0006 (docs/decisions/0006-base-tier-agnostic-primitives.md), the `base` tier ships only
 * agnostic primitives: the cycle engine, the forcing mechanism, and a small set of meta/orchestration
 * skills every cycle needs. The opinionated dev-cycle stage skills (survey/charter/blueprint/forge/
 * trial/verdict/stewardship) ship as a *default, swappable pack* — not part of the agnostic core.
 *
 * `GENERIC_DEV_CYCLE` proves SPEC-PRIMITIVE INV-2 (the cycle is data, never hardcoded): it has the
 * exact same 8 stage ids as `DEV_CYCLE` (@norm/schemas), but every `forceSkills` entry references a
 * `source: "base"` hima-* skill instead of a `source: "corpus"` corpus-* skill. A stranger cloning
 * hima with zero corpus skills installed gets a working default cycle from this pack alone.
 *
 * See: .planning/research/HIMA-BASE-SKILLS.md (the 15 hima-* skill ids + purposes),
 *      docs/decisions/0006-base-tier-agnostic-primitives.md,
 *      docs/specs/SPEC-PRIMITIVE.md (INV-2 swappability).
 */

import type { CycleDef, SkillRef } from "@norm/schemas";

// ─────────────────────────────────────────────────────────────────────────────
// Meta / orchestration skills (8) — base tier, cross-cutting, not bound to one stage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * BASE_META_SKILLS — the 8 meta/orchestration skills every hima cycle needs regardless of which
 * stage-bound pack is plugged in (planning, research, dynamic verification, structural cleanup,
 * onboarding, batch-questioning, per-project discipline, bug-report triage).
 */
export const BASE_META_SKILLS: SkillRef[] = [
  { source: "base", id: "norm-muster" },
  { source: "base", id: "norm-lookout" },
  { source: "base", id: "norm-warden" },
  { source: "base", id: "norm-purge" },
  { source: "base", id: "norm-admit" },
  { source: "base", id: "norm-parley" },
  { source: "base", id: "norm-covenant" },
  { source: "base", id: "norm-triage" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Stage-bound skills (7) — the default dev-cycle pack (swappable, per ADR-0006)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DEV_CYCLE_PACK_SKILLS — the 7 stage-bound skills that make up the default dev-cycle pack, one per
 * `DEV_CYCLE` stage (discovery+analysis share `norm-survey`).
 */
export const DEV_CYCLE_PACK_SKILLS: SkillRef[] = [
  { source: "base", id: "norm-survey" },
  { source: "base", id: "norm-charter" },
  { source: "base", id: "norm-blueprint" },
  { source: "base", id: "norm-forge" },
  { source: "base", id: "norm-trial" },
  { source: "base", id: "norm-verdict" },
  { source: "base", id: "norm-stewardship" },
];

// ─────────────────────────────────────────────────────────────────────────────
// GENERIC_DEV_CYCLE — the corpus-free default cycle (swap-compatible with DEV_CYCLE)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GENERIC_DEV_CYCLE — the same 8 stage ids as `DEV_CYCLE` (@norm/schemas), but every stage's
 * `forceSkills` references a `source: "base"` hima-* pack skill instead of a `source: "corpus"`
 * corpus-* skill. This is the corpus-free default a stranger can run out of the box; swapping it in
 * for `DEV_CYCLE` (or vice versa) requires no kernel change (SPEC-PRIMITIVE INV-2).
 *
 * Stage → pack skill mapping (per .planning/research/HIMA-BASE-SKILLS.md):
 *   discovery   → norm-survey   (covers discovery + analysis, per the sanctuary lexicon)
 *   analysis    → norm-survey
 *   spec        → norm-charter
 *   design      → norm-blueprint
 *   impl        → norm-forge
 *   test        → norm-trial
 *   verify      → norm-verdict
 *   maintenance → norm-stewardship
 */
export const GENERIC_DEV_CYCLE: CycleDef = {
  id: "generic-dev-cycle-v1",
  name: "Generic Development Cycle (base pack)",
  stages: [
    {
      id: "discovery",
      name: "Discovery",
      forceSkills: [{ source: "base", id: "norm-survey" }],
      injectSkills: [],
      entryAllowed: true,
    },
    {
      id: "analysis",
      name: "Analysis",
      forceSkills: [{ source: "base", id: "norm-survey" }],
      injectSkills: [],
      entryAllowed: true,
    },
    {
      id: "spec",
      name: "Specification",
      forceSkills: [{ source: "base", id: "norm-charter" }],
      injectSkills: [],
      entryAllowed: true,
    },
    {
      id: "design",
      name: "Design",
      forceSkills: [{ source: "base", id: "norm-blueprint" }],
      injectSkills: [],
      entryAllowed: true,
    },
    {
      id: "impl",
      name: "Implementation",
      forceSkills: [{ source: "base", id: "norm-forge" }],
      injectSkills: [],
      entryAllowed: true,
    },
    {
      id: "test",
      name: "Test",
      forceSkills: [{ source: "base", id: "norm-trial" }],
      injectSkills: [],
      entryAllowed: true,
    },
    {
      id: "verify",
      name: "Verify",
      forceSkills: [{ source: "base", id: "norm-verdict" }],
      injectSkills: [],
      entryAllowed: true,
    },
    {
      id: "maintenance",
      name: "Maintenance",
      forceSkills: [{ source: "base", id: "norm-stewardship" }],
      injectSkills: [],
      entryAllowed: true,
    },
  ],
};
