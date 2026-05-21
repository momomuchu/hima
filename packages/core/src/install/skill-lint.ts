import path from "node:path";
import { parse as parseYaml } from "yaml";
import { safeParseSkillFrontmatter } from "../schemas/skill.schema.js";

export type SkillLintSeverity = "error" | "warning";
export type SkillLintStatus = "pass" | "fail";

export interface SkillLintRule {
  readonly id: string;
  readonly severity: SkillLintSeverity;
  readonly description: string;
}

export interface SkillLintFinding {
  readonly ruleId: string;
  readonly severity: SkillLintSeverity;
  readonly message: string;
  readonly path?: string;
  readonly line?: number;
}

export interface SkillLintInput {
  readonly content: string;
  readonly path?: string;
}

export interface SkillLintReport {
  readonly status: SkillLintStatus;
  readonly ruleCount: number;
  readonly findings: readonly SkillLintFinding[];
}

export const SKILL_LINT_RULES: readonly SkillLintRule[] = [
  rule("skill_frontmatter_missing", "error", "SKILL.md must start with frontmatter."),
  rule("skill_frontmatter_unclosed", "error", "Frontmatter must have a closing delimiter."),
  rule("skill_frontmatter_yaml_invalid", "error", "Frontmatter must parse as YAML."),
  rule("skill_frontmatter_not_mapping", "error", "Frontmatter must be a YAML mapping."),
  rule("skill_frontmatter_schema_invalid", "error", "Frontmatter must pass the locked schema."),
  rule("skill_unknown_field", "error", "Frontmatter must not include unknown fields."),
  rule("skill_name_missing", "error", "Frontmatter must include name."),
  rule("skill_name_kebab_case", "error", "Skill name must be kebab-case."),
  rule("skill_name_path_mismatch", "error", "Skill name must match its parent folder."),
  rule("skill_version_missing", "error", "Frontmatter must include version."),
  rule("skill_version_semver", "error", "Version must be semantic version."),
  rule("skill_type_missing", "error", "Frontmatter must include type."),
  rule("skill_type_invalid", "error", "Type must be task or knowledge."),
  rule("skill_description_missing", "error", "Frontmatter must include description."),
  rule("skill_description_blank", "error", "Description must not be blank."),
  rule("skill_description_multiline", "error", "Description must fit on one line."),
  rule("skill_description_too_long", "warning", "Description should stay concise."),
  rule("skill_triggers_missing", "error", "Frontmatter must include triggers."),
  rule("skill_triggers_not_array", "error", "Triggers must be an array."),
  rule("skill_triggers_empty", "error", "Triggers must not be empty."),
  rule("skill_triggers_blank", "error", "Triggers must not contain blank entries."),
  rule("skill_triggers_duplicate", "warning", "Triggers should not repeat."),
  rule("skill_expected_outputs_missing", "error", "Frontmatter must include expected_outputs."),
  rule("skill_expected_outputs_not_array", "error", "Expected outputs must be an array."),
  rule("skill_expected_outputs_empty", "error", "Expected outputs must not be empty."),
  rule("skill_expected_outputs_blank", "error", "Expected outputs must not contain blanks."),
  rule("skill_expected_outputs_duplicate", "warning", "Expected outputs should not repeat."),
  rule("skill_expected_outputs_no_label", "warning", "Expected outputs should use label: detail."),
  rule("skill_requires_tools_missing", "error", "Frontmatter must include requires_tools."),
  rule("skill_requires_tools_not_array", "error", "Required tools must be an array."),
  rule("skill_requires_tools_blank", "error", "Required tools must not contain blanks."),
  rule("skill_requires_tools_duplicate", "warning", "Required tools should not repeat."),
  rule(
    "skill_fallback_toolsets_missing",
    "error",
    "Frontmatter must include fallback_for_toolsets.",
  ),
  rule("skill_fallback_toolsets_not_array", "error", "Fallback toolsets must be an array."),
  rule("skill_fallback_toolsets_blank", "error", "Fallback toolsets must not contain blanks."),
  rule("skill_fallback_toolsets_duplicate", "warning", "Fallback toolsets should not repeat."),
  rule(
    "skill_managed_header_missing",
    "warning",
    "Managed HIMA fixtures should keep the artifact header.",
  ),
  rule(
    "skill_managed_header_name_mismatch",
    "error",
    "Managed artifact header name must match frontmatter.",
  ),
  rule("skill_markdown_title_missing", "error", "Skill body must include a markdown title."),
  rule("skill_activation_heading_missing", "warning", "Skill body should include Activation."),
  rule("skill_ownership_heading_missing", "warning", "Skill body should include Ownership."),
  rule("skill_owns_bullet_missing", "warning", "Ownership should list owned outputs."),
  rule(
    "skill_out_of_scope_bullet_missing",
    "warning",
    "Ownership should list out-of-scope behavior.",
  ),
  rule("skill_body_too_short", "warning", "Skill body should include enough operational detail."),
];

const REQUIRED_FIELDS = [
  "name",
  "version",
  "type",
  "triggers",
  "expected_outputs",
  "requires_tools",
  "fallback_for_toolsets",
  "description",
] as const;

const ALLOWED_FIELDS = new Set<string>(REQUIRED_FIELDS);

const KEBAB_CASE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
const MANAGED_HEADER_PATTERN = /<!--\s*HIMA:SKILL-ARTIFACT\s+name=([a-z0-9-]+)\s+source=[^>]+-->/u;

export function lintSkillMarkdown(input: SkillLintInput | string): SkillLintReport {
  const normalizedInput = typeof input === "string" ? { content: input } : input;
  const findings: SkillLintFinding[] = [];
  const extracted = extractFrontmatter(normalizedInput.content, normalizedInput.path, findings);

  if (!extracted) {
    return report(findings);
  }

  const parsedFrontmatter = parseFrontmatterYaml(
    extracted.frontmatter,
    normalizedInput.path,
    findings,
  );
  if (!parsedFrontmatter || !isRecord(parsedFrontmatter)) {
    if (parsedFrontmatter !== undefined) {
      add(findings, "skill_frontmatter_not_mapping", "Frontmatter must be a YAML mapping.", {
        path: normalizedInput.path,
        line: 2,
      });
    }
    lintBody(extracted.body, normalizedInput.path, findings);
    return report(findings);
  }

  lintFrontmatter(parsedFrontmatter, normalizedInput.path, findings);
  lintBody(extracted.body, normalizedInput.path, findings, readString(parsedFrontmatter.name));

  return report(findings);
}

function lintFrontmatter(
  frontmatter: Record<string, unknown>,
  filePath: string | undefined,
  findings: SkillLintFinding[],
): void {
  for (const field of REQUIRED_FIELDS) {
    if (!(field in frontmatter)) {
      add(findings, missingRuleForField(field), `Missing required field: ${field}.`, {
        path: filePath,
        line: 2,
      });
    }
  }

  for (const field of Object.keys(frontmatter)) {
    if (!ALLOWED_FIELDS.has(field)) {
      add(findings, "skill_unknown_field", `Unknown frontmatter field: ${field}.`, {
        path: filePath,
        line: 2,
      });
    }
  }

  lintName(frontmatter.name, filePath, findings);
  lintVersion(frontmatter.version, filePath, findings);
  lintType(frontmatter.type, filePath, findings);
  lintDescription(frontmatter.description, filePath, findings);
  lintStringArray(frontmatter.triggers, {
    field: "triggers",
    missing: "skill_triggers_missing",
    notArray: "skill_triggers_not_array",
    empty: "skill_triggers_empty",
    blank: "skill_triggers_blank",
    duplicate: "skill_triggers_duplicate",
    filePath,
    findings,
  });
  lintStringArray(frontmatter.expected_outputs, {
    field: "expected_outputs",
    missing: "skill_expected_outputs_missing",
    notArray: "skill_expected_outputs_not_array",
    empty: "skill_expected_outputs_empty",
    blank: "skill_expected_outputs_blank",
    duplicate: "skill_expected_outputs_duplicate",
    filePath,
    findings,
  });
  lintExpectedOutputLabels(frontmatter.expected_outputs, filePath, findings);
  lintStringArray(frontmatter.requires_tools, {
    field: "requires_tools",
    missing: "skill_requires_tools_missing",
    notArray: "skill_requires_tools_not_array",
    empty: null,
    blank: "skill_requires_tools_blank",
    duplicate: "skill_requires_tools_duplicate",
    filePath,
    findings,
  });
  lintStringArray(frontmatter.fallback_for_toolsets, {
    field: "fallback_for_toolsets",
    missing: "skill_fallback_toolsets_missing",
    notArray: "skill_fallback_toolsets_not_array",
    empty: null,
    blank: "skill_fallback_toolsets_blank",
    duplicate: "skill_fallback_toolsets_duplicate",
    filePath,
    findings,
  });

  const schemaResult = safeParseSkillFrontmatter(frontmatter);
  if (!schemaResult.success) {
    add(findings, "skill_frontmatter_schema_invalid", "Frontmatter fails the locked schema.", {
      path: filePath,
      line: 2,
    });
  }
}

function lintName(
  value: unknown,
  filePath: string | undefined,
  findings: SkillLintFinding[],
): void {
  if (value === undefined) {
    return;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    add(findings, "skill_name_missing", "Skill name must be a non-blank string.", {
      path: filePath,
      line: 2,
    });
    return;
  }

  if (!KEBAB_CASE_PATTERN.test(value)) {
    add(findings, "skill_name_kebab_case", `Skill name is not kebab-case: ${value}.`, {
      path: filePath,
      line: 2,
    });
  }

  const expectedName = expectedNameFromPath(filePath);
  if (expectedName && value !== expectedName) {
    add(
      findings,
      "skill_name_path_mismatch",
      `Skill name ${value} does not match parent folder ${expectedName}.`,
      {
        path: filePath,
        line: 2,
      },
    );
  }
}

function lintVersion(
  value: unknown,
  filePath: string | undefined,
  findings: SkillLintFinding[],
): void {
  if (value === undefined) {
    return;
  }

  if (typeof value !== "string" || !SEMVER_PATTERN.test(value)) {
    add(findings, "skill_version_semver", "Skill version must be semantic version.", {
      path: filePath,
      line: 3,
    });
  }
}

function lintType(
  value: unknown,
  filePath: string | undefined,
  findings: SkillLintFinding[],
): void {
  if (value === undefined) {
    return;
  }

  if (value !== "task" && value !== "knowledge") {
    add(findings, "skill_type_invalid", "Skill type must be task or knowledge.", {
      path: filePath,
      line: 4,
    });
  }
}

function lintDescription(
  value: unknown,
  filePath: string | undefined,
  findings: SkillLintFinding[],
): void {
  if (value === undefined) {
    return;
  }

  if (typeof value !== "string") {
    add(findings, "skill_description_missing", "Description must be a string.", {
      path: filePath,
      line: 2,
    });
    return;
  }

  if (value.trim().length === 0) {
    add(findings, "skill_description_blank", "Description must not be blank.", {
      path: filePath,
      line: 2,
    });
  }

  if (/[\r\n]/u.test(value)) {
    add(findings, "skill_description_multiline", "Description must fit on one line.", {
      path: filePath,
      line: 2,
    });
  }

  if (value.length > 140) {
    add(findings, "skill_description_too_long", "Description should be 140 characters or less.", {
      path: filePath,
      line: 2,
    });
  }
}

function lintStringArray(
  value: unknown,
  options: {
    readonly field: string;
    readonly missing: string;
    readonly notArray: string;
    readonly empty: string | null;
    readonly blank: string;
    readonly duplicate: string;
    readonly filePath?: string;
    readonly findings: SkillLintFinding[];
  },
): void {
  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value)) {
    add(options.findings, options.notArray, `${options.field} must be an array.`, {
      path: options.filePath,
      line: 2,
    });
    return;
  }

  if (value.length === 0 && options.empty) {
    add(options.findings, options.empty, `${options.field} must not be empty.`, {
      path: options.filePath,
      line: 2,
    });
  }

  const strings = value.filter((item): item is string => typeof item === "string");
  if (strings.length !== value.length || strings.some((item) => item.trim().length === 0)) {
    add(options.findings, options.blank, `${options.field} contains blank or non-string entries.`, {
      path: options.filePath,
      line: 2,
    });
  }

  const duplicates = findDuplicates(strings);
  if (duplicates.length > 0) {
    add(
      options.findings,
      options.duplicate,
      `${options.field} contains duplicates: ${duplicates.join(", ")}.`,
      {
        path: options.filePath,
        line: 2,
      },
    );
  }
}

function lintExpectedOutputLabels(
  value: unknown,
  filePath: string | undefined,
  findings: SkillLintFinding[],
): void {
  if (!Array.isArray(value)) {
    return;
  }

  const unlabeled = value.filter(
    (item): item is string => typeof item === "string" && !/^[a-z0-9_-]+:\s+\S/iu.test(item),
  );
  if (unlabeled.length > 0) {
    add(
      findings,
      "skill_expected_outputs_no_label",
      "Expected outputs should use the shape label: detail.",
      { path: filePath, line: 2 },
    );
  }
}

function lintBody(
  body: string,
  filePath: string | undefined,
  findings: SkillLintFinding[],
  skillName?: string,
): void {
  const managedHeader = body.match(MANAGED_HEADER_PATTERN);
  if (!managedHeader) {
    add(findings, "skill_managed_header_missing", "Missing HIMA managed artifact header.", {
      path: filePath,
    });
  } else if (skillName && managedHeader[1] !== skillName) {
    add(
      findings,
      "skill_managed_header_name_mismatch",
      `Managed artifact header name ${managedHeader[1]} does not match ${skillName}.`,
      { path: filePath },
    );
  }

  if (!/^#\s+\S/mu.test(body)) {
    add(findings, "skill_markdown_title_missing", "Skill body must include a markdown title.", {
      path: filePath,
    });
  }

  if (!/^##\s+Activation\s*$/imu.test(body)) {
    add(findings, "skill_activation_heading_missing", "Skill body should include Activation.", {
      path: filePath,
    });
  }

  if (!/^##\s+Ownership\s*$/imu.test(body)) {
    add(findings, "skill_ownership_heading_missing", "Skill body should include Ownership.", {
      path: filePath,
    });
  }

  if (!/^-+\s+Owns:\s+\S/imu.test(body)) {
    add(findings, "skill_owns_bullet_missing", "Ownership should include an Owns bullet.", {
      path: filePath,
    });
  }

  if (!/^-+\s+Out of scope:\s+\S/imu.test(body)) {
    add(
      findings,
      "skill_out_of_scope_bullet_missing",
      "Ownership should include an Out of scope bullet.",
      { path: filePath },
    );
  }

  if (body.trim().length < 160) {
    add(findings, "skill_body_too_short", "Skill body is too short for operational use.", {
      path: filePath,
    });
  }
}

function extractFrontmatter(
  content: string,
  filePath: string | undefined,
  findings: SkillLintFinding[],
): {
  readonly frontmatter: string;
  readonly body: string;
} | null {
  const lines = content.split(/\r?\n/u);

  if (lines[0]?.trim() !== "---") {
    add(findings, "skill_frontmatter_missing", "SKILL.md must start with YAML frontmatter.", {
      path: filePath,
      line: 1,
    });
    return null;
  }

  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (closingIndex === -1) {
    add(findings, "skill_frontmatter_unclosed", "YAML frontmatter closing delimiter is missing.", {
      path: filePath,
      line: 1,
    });
    return null;
  }

  return {
    frontmatter: lines.slice(1, closingIndex).join("\n"),
    body: lines.slice(closingIndex + 1).join("\n"),
  };
}

function parseFrontmatterYaml(
  frontmatter: string,
  filePath: string | undefined,
  findings: SkillLintFinding[],
): unknown | undefined {
  try {
    return parseYaml(frontmatter);
  } catch (error) {
    add(
      findings,
      "skill_frontmatter_yaml_invalid",
      `Frontmatter YAML is invalid: ${error instanceof Error ? error.message : "parse failed"}.`,
      { path: filePath, line: 2 },
    );
    return undefined;
  }
}

function expectedNameFromPath(filePath: string | undefined): string | null {
  if (!filePath || path.basename(filePath).toLowerCase() !== "skill.md") {
    return null;
  }

  const parent = path.basename(path.dirname(filePath));
  return KEBAB_CASE_PATTERN.test(parent) ? parent : null;
}

function findDuplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values.map((item) => item.trim()).filter(Boolean)) {
    const normalized = value.toLowerCase();
    if (seen.has(normalized)) {
      duplicates.add(value);
    }
    seen.add(normalized);
  }

  return [...duplicates];
}

function missingRuleForField(field: (typeof REQUIRED_FIELDS)[number]): string {
  return field === "fallback_for_toolsets"
    ? "skill_fallback_toolsets_missing"
    : `skill_${field}_missing`;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function report(findings: readonly SkillLintFinding[]): SkillLintReport {
  return {
    status: findings.some((finding) => finding.severity === "error") ? "fail" : "pass",
    ruleCount: SKILL_LINT_RULES.length,
    findings,
  };
}

function add(
  findings: SkillLintFinding[],
  ruleId: string,
  message: string,
  location: { readonly path?: string; readonly line?: number } = {},
): void {
  const lintRule = SKILL_LINT_RULES.find((candidate) => candidate.id === ruleId);
  findings.push({
    ruleId,
    severity: lintRule?.severity ?? "error",
    message,
    ...(location.path === undefined ? {} : { path: location.path }),
    ...(location.line === undefined ? {} : { line: location.line }),
  });
}

function rule(id: string, severity: SkillLintSeverity, description: string): SkillLintRule {
  return { id, severity, description };
}
