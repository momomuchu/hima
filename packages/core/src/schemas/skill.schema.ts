import { z } from "zod";

export const SkillTypeSchema = z.enum(["task", "knowledge"]);

const NonBlankStringSchema = z.string().refine((value) => value.trim().length > 0, {
  message: "Expected a non-blank string.",
});

const KebabCaseSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u, "Expected kebab-case.");

const SemverSchema = z
  .string()
  .min(1)
  .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u, "Expected semantic version.");

const OneLineStringSchema = NonBlankStringSchema.refine(
  (value) => !/[\r\n]/u.test(value),
  "Expected a single-line string.",
);

const NonEmptyStringArraySchema = z.array(NonBlankStringSchema);

export const SkillFrontmatterSchema = z
  .object({
    name: KebabCaseSchema,
    version: SemverSchema,
    type: SkillTypeSchema,
    triggers: NonEmptyStringArraySchema.min(1),
    expected_outputs: NonEmptyStringArraySchema.min(1),
    requires_tools: NonEmptyStringArraySchema,
    fallback_for_toolsets: NonEmptyStringArraySchema,
    description: OneLineStringSchema,
  })
  .strict();

export type SkillType = z.infer<typeof SkillTypeSchema>;
export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;

export function parseSkillFrontmatter(input: unknown): SkillFrontmatter {
  return SkillFrontmatterSchema.parse(input);
}

export function safeParseSkillFrontmatter(input: unknown) {
  return SkillFrontmatterSchema.safeParse(input);
}
