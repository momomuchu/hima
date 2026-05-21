import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { lintSkillMarkdown, SKILL_LINT_RULES } from "../src/index.js";

const validSkillPath =
  "fixtures/hima-skills/harvested/project/.hima/skills/config-linting/SKILL.md";
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

describe("lintSkillMarkdown", () => {
  it("passes the harvested config-linting fixture", async () => {
    const content = await readFile(path.resolve(repoRoot, validSkillPath), "utf8");
    const report = lintSkillMarkdown({ content, path: validSkillPath });

    expect(report.status).toBe("pass");
    expect(report.ruleCount).toBeGreaterThanOrEqual(30);
    expect(report.findings).toEqual([]);
  });

  it("reports missing and unclosed frontmatter", () => {
    const missing = lintSkillMarkdown("# Skill\n\nNo frontmatter.");
    const unclosed = lintSkillMarkdown("---\nname: broken\n# Missing delimiter\n");

    expect(missing.status).toBe("fail");
    expect(missing.findings.map((finding) => finding.ruleId)).toContain(
      "skill_frontmatter_missing",
    );
    expect(unclosed.status).toBe("fail");
    expect(unclosed.findings.map((finding) => finding.ruleId)).toContain(
      "skill_frontmatter_unclosed",
    );
  });

  it("reports frontmatter, path, and body lint findings", () => {
    const report = lintSkillMarkdown({
      path: "fixtures/hima-skills/harvested/project/.hima/skills/expected-name/SKILL.md",
      content: `---
name: "Bad Name"
version: "v1"
type: agent
triggers:
  - "build"
  - "build"
  - " "
expected_outputs:
  - "missing label"
  - "missing label"
  - " "
requires_tools: shell
fallback_for_toolsets:
  - "readonly"
  - "readonly"
description: |
  line one
  line two
owner: runtime
---

No title.
`,
    });
    const ids = report.findings.map((finding) => finding.ruleId);

    expect(report.status).toBe("fail");
    expect(ids).toEqual(
      expect.arrayContaining([
        "skill_name_kebab_case",
        "skill_name_path_mismatch",
        "skill_version_semver",
        "skill_type_invalid",
        "skill_unknown_field",
        "skill_triggers_blank",
        "skill_triggers_duplicate",
        "skill_expected_outputs_blank",
        "skill_expected_outputs_duplicate",
        "skill_expected_outputs_no_label",
        "skill_requires_tools_not_array",
        "skill_fallback_toolsets_duplicate",
        "skill_description_multiline",
        "skill_frontmatter_schema_invalid",
        "skill_managed_header_missing",
        "skill_markdown_title_missing",
        "skill_activation_heading_missing",
        "skill_ownership_heading_missing",
        "skill_owns_bullet_missing",
        "skill_out_of_scope_bullet_missing",
        "skill_body_too_short",
      ]),
    );
  });

  it("keeps a named 30-plus rule catalog for local lint proof", () => {
    expect(SKILL_LINT_RULES).toHaveLength(44);
    expect(new Set(SKILL_LINT_RULES.map((rule) => rule.id)).size).toBe(SKILL_LINT_RULES.length);
    expect(SKILL_LINT_RULES.map((rule) => rule.id)).toEqual(
      expect.arrayContaining([
        "skill_frontmatter_schema_invalid",
        "skill_name_path_mismatch",
        "skill_expected_outputs_no_label",
        "skill_managed_header_name_mismatch",
      ]),
    );
  });
});
