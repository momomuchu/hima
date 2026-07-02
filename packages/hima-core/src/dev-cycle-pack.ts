/**
 * dev-cycle-pack — the base-tier, corpus-free meta skills + the swappable default dev-cycle pack.
 *
 * Per ADR-0006 (docs/decisions/0006-base-tier-agnostic-primitives.md), the `base` tier ships only
 * agnostic primitives: the cycle engine, the forcing mechanism, and a small set of meta/orchestration
 * skills every cycle needs. The opinionated dev-cycle stage skills (survey/charter/blueprint/forge/
 * trial/verdict/stewardship) ship as a *default, swappable pack* — not part of the agnostic core.
 *
 * `GENERIC_DEV_CYCLE` proves SPEC-PRIMITIVE INV-2 (the cycle is data, never hardcoded): it has the
 * exact same 8 stage ids as `DEV_CYCLE` (@hima/schemas), but every `forceSkills` entry references a
 * `source: "base"` hima-* skill instead of a `source: "corpus"` corpus-* skill. A stranger cloning
 * hima with zero corpus skills installed gets a working default cycle from this pack alone.
 *
 * See: .planning/research/HIMA-BASE-SKILLS.md (the 15 hima-* skill ids + purposes),
 *      docs/decisions/0006-base-tier-agnostic-primitives.md,
 *      docs/specs/SPEC-PRIMITIVE.md (INV-2 swappability).
 */

import type { CycleDef, SkillRef } from "@hima/schemas";

// ─────────────────────────────────────────────────────────────────────────────
// Meta / orchestration skills (8) — base tier, cross-cutting, not bound to one stage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * BASE_META_SKILLS — the 8 meta/orchestration skills every hima cycle needs regardless of which
 * stage-bound pack is plugged in (planning, research, dynamic verification, structural cleanup,
 * onboarding, batch-questioning, per-project discipline, bug-report triage).
 */
export const BASE_META_SKILLS: SkillRef[] = [
  { source: "base", id: "hima-muster" },
  { source: "base", id: "hima-lookout" },
  { source: "base", id: "hima-warden" },
  { source: "base", id: "hima-purge" },
  { source: "base", id: "hima-admit" },
  { source: "base", id: "hima-parley" },
  { source: "base", id: "hima-covenant" },
  { source: "base", id: "hima-triage" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Stage-bound skills (7) — the default dev-cycle pack (swappable, per ADR-0006)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DEV_CYCLE_PACK_SKILLS — the 7 stage-bound skills that make up the default dev-cycle pack, one per
 * `DEV_CYCLE` stage (discovery+analysis share `hima-survey`).
 */
export const DEV_CYCLE_PACK_SKILLS: SkillRef[] = [
  { source: "base", id: "hima-survey" },
  { source: "base", id: "hima-charter" },
  { source: "base", id: "hima-blueprint" },
  { source: "base", id: "hima-forge" },
  { source: "base", id: "hima-trial" },
  { source: "base", id: "hima-verdict" },
  { source: "base", id: "hima-stewardship" },
];

// ─────────────────────────────────────────────────────────────────────────────
// GENERIC_DEV_CYCLE — the corpus-free default cycle (swap-compatible with DEV_CYCLE)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GENERIC_DEV_CYCLE — the same 8 stage ids as `DEV_CYCLE` (@hima/schemas), but every stage's
 * `forceSkills` references a `source: "base"` hima-* pack skill instead of a `source: "corpus"`
 * corpus-* skill. This is the corpus-free default a stranger can run out of the box; swapping it in
 * for `DEV_CYCLE` (or vice versa) requires no kernel change (SPEC-PRIMITIVE INV-2).
 *
 * Stage → pack skill mapping (per .planning/research/HIMA-BASE-SKILLS.md):
 *   discovery   → hima-survey   (covers discovery + analysis, per the sanctuary lexicon)
 *   analysis    → hima-survey
 *   spec        → hima-charter
 *   design      → hima-blueprint
 *   impl        → hima-forge
 *   test        → hima-trial
 *   verify      → hima-verdict
 *   maintenance → hima-stewardship
 */
export const GENERIC_DEV_CYCLE: CycleDef = {
  id: "generic-dev-cycle-v1",
  name: "Generic Development Cycle (base pack)",
  stages: [
    {
      id: "discovery",
      name: "Discovery",
      forceSkills: [{ source: "base", id: "hima-survey" }],
      injectSkills: [],
      entryAllowed: true,
    },
    {
      id: "analysis",
      name: "Analysis",
      forceSkills: [{ source: "base", id: "hima-survey" }],
      injectSkills: [],
      entryAllowed: true,
    },
    {
      id: "spec",
      name: "Specification",
      forceSkills: [{ source: "base", id: "hima-charter" }],
      injectSkills: [],
      entryAllowed: true,
    },
    {
      id: "design",
      name: "Design",
      forceSkills: [{ source: "base", id: "hima-blueprint" }],
      injectSkills: [],
      entryAllowed: true,
    },
    {
      id: "impl",
      name: "Implementation",
      forceSkills: [{ source: "base", id: "hima-forge" }],
      injectSkills: [],
      entryAllowed: true,
    },
    {
      id: "test",
      name: "Test",
      forceSkills: [{ source: "base", id: "hima-trial" }],
      injectSkills: [],
      entryAllowed: true,
    },
    {
      id: "verify",
      name: "Verify",
      forceSkills: [{ source: "base", id: "hima-verdict" }],
      injectSkills: [],
      entryAllowed: true,
    },
    {
      id: "maintenance",
      name: "Maintenance",
      forceSkills: [{ source: "base", id: "hima-stewardship" }],
      injectSkills: [],
      entryAllowed: true,
    },
  ],
};
