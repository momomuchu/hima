/**
 * Local zod mirrors of @harness/core contracts.
 *
 * Mirrored (not imported) on purpose: the generator stays standalone and
 * does not require @harness/core to be built first (generator-architecture
 * decision D1 — keep separate in first iteration, emit to staging). The
 * shapes below are kept byte-faithful to:
 *   - SkillCatalogEntry  @harness/core/src/catalogs/operational-catalog.ts:21-32
 *   - SkillFrontmatter   @harness/core/src/schemas/skill.schema.ts:26-37
 *   - canonical enums    @harness/core/src/types/canonical.ts (+ re-exports)
 * If @harness/core drifts, `pnpm typecheck` of the wiring slice (Tidy-First
 * Slice 2) is the guard — see GOAL-3 hima-seam-map §1.9 / R2.
 */
import { z } from "zod";

// ---- canonical enum value sets (verbatim from canonical.ts) -------------
export const MACRO_CYCLES = [
  "discovery",
  "cadrage",
  "conception",
  "build",
  "validation",
  "release",
  "run",
  "learning",
] as const;
export const GATE_TYPES = [
  "session_start",
  "user_prompt",
  "pre_tool",
  "post_tool",
  "pre_compact",
  "post_compact",
  "stop",
  "subagent_start",
  "subagent_stop",
] as const;
export const RISK_CLASSES = ["T", "L", "M", "H", "C"] as const;
export const OPERATING_MODES = ["bypass", "auto", "pairing"] as const;

const MacroCycle = z.enum(MACRO_CYCLES);
const GateType = z.enum(GATE_TYPES);
const RiskClass = z.enum(RISK_CLASSES);
const OperatingMode = z.enum(OPERATING_MODES);

const NonBlank = z.string().refine((v) => v.trim().length > 0, "Expected a non-blank string.");
const NonBlankArray = z.array(NonBlank);

// ---- SkillCatalogEntry mirror ------------------------------------------
export const CatalogActivationSchema = z
  .object({
    macroCycles: z.array(MacroCycle).min(1),
    gateTypes: z.array(GateType).optional(),
    riskClasses: z.array(RiskClass).min(1),
    operatingModes: z.array(OperatingMode).optional(),
    keywords: NonBlankArray.min(1),
    auto: z.boolean(),
  })
  .strict();

export const SkillCatalogEntrySchema = z
  .object({
    id: z
      .string()
      .min(1)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u, "Expected kebab-case."),
    title: NonBlank,
    purpose: NonBlank,
    activation: CatalogActivationSchema,
    procedure: NonBlankArray.min(1).optional(),
    owns: NonBlankArray.min(1),
    outOfScope: NonBlankArray.min(1),
    evidenceProduced: z.array(z.string()),
    hookRefs: z.array(z.string()),
    subagentRefs: z.array(z.string()),
  })
  .strict();
export type SkillCatalogEntry = z.infer<typeof SkillCatalogEntrySchema>;

// ---- SkillFrontmatter mirror (skill.schema.ts:26-37) -------------------
const KebabCase = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u, "Expected kebab-case.");
const Semver = z
  .string()
  .min(1)
  .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u, "Expected semantic version.");
const OneLine = NonBlank.refine((v) => !/[\r\n]/u.test(v), "Expected a single-line string.");

export const SkillFrontmatterSchema = z
  .object({
    name: KebabCase,
    version: Semver,
    type: z.enum(["task", "knowledge"]),
    triggers: NonBlankArray.min(1),
    expected_outputs: NonBlankArray.min(1),
    requires_tools: NonBlankArray,
    fallback_for_toolsets: NonBlankArray,
    description: OneLine,
  })
  .strict();
export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;

// ---- structural-activation (activate-Pn) ------------------------------
export const ActivateSkillSchema = z
  .object({
    frontmatter: SkillFrontmatterSchema,
    presetId: z.string().regex(/^P(?:[1-9]|1[0-6])$/u),
    window: z
      .object({ start: z.number().int().min(1).max(13), stop: z.number().int().min(1).max(13) })
      .strict()
      .refine((w) => w.start <= w.stop, "window start must be <= stop"),
    mode: z.enum(["bypass", "auto", "gate", "only", "scope"]),
    hardSets: z.array(NonBlank),
    body: NonBlank,
  })
  .strict();
export type ActivateSkill = z.infer<typeof ActivateSkillSchema>;

export interface KeywordRegistryDraft {
  readonly skillId: string;
  readonly keywords: readonly string[];
  readonly forcedInvoke: boolean;
  readonly stage: string;
}
