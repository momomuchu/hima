/**
 * skill-coverage.test.ts — R2: every base-tier SkillRef has a real skills/<id>/SKILL.md.
 *
 * `BASE_META_SKILLS` (8) + `DEV_CYCLE_PACK_SKILLS` (7) together name the 15 hima-* base skill
 * ids the "generic, corpus-free" cycle depends on (per .planning/research/HIMA-BASE-SKILLS.md and
 * ADR-0006). This suite fails loudly if any of the 15 is missing on disk, or if a present file's
 * frontmatter does not carry the 5 required fields (name/description/stage/source/mode) with the
 * expected `source: "base"` value and a `name` matching the directory id.
 *
 * Non-destructive: read-only — never writes to skills/ or touches dev-cycle-pack.ts/cycle.ts.
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BASE_META_SKILLS, DEV_CYCLE_PACK_SKILLS } from "../src/dev-cycle-pack.js";

// Repo root is 3 levels up from packages/hima-core/test/.
const REPO_ROOT = path.resolve(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "../../..",
);
const SKILLS_DIR = path.join(REPO_ROOT, "skills");

const ALL_BASE_SKILL_IDS = [...BASE_META_SKILLS, ...DEV_CYCLE_PACK_SKILLS].map((ref) => ref.id);

// ---------------------------------------------------------------------------
// Minimal frontmatter field extractor (test-local — no production dependency).
// Extracts flat `key: value` scalar lines from the leading `---`...`---` block.
// ---------------------------------------------------------------------------

function extractFrontmatter(content: string): Record<string, string> {
  const OPEN_RE = /^---[ \t]*\r?\n/;
  const openMatch = OPEN_RE.exec(content);
  if (!openMatch) return {};

  const afterOpen = content.slice(openMatch[0].length);
  const CLOSE_RE = /^---[ \t]*(\r?\n|$)/m;
  const closeMatch = CLOSE_RE.exec(afterOpen);
  if (!closeMatch) return {};

  const yamlBlock = afterOpen.slice(0, closeMatch.index);
  const fields: Record<string, string> = {};
  for (const line of yamlBlock.split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (m) {
      const key = m[1] ?? "";
      const value = (m[2] ?? "").trim();
      fields[key] = value;
    }
  }
  return fields;
}

describe("R2 — base skill coverage: BASE_META_SKILLS + DEV_CYCLE_PACK_SKILLS", () => {
  it("names exactly 15 base skill ids (8 meta + 7 pack)", () => {
    expect(ALL_BASE_SKILL_IDS).toHaveLength(15);
    // No duplicate ids across the two tables.
    expect(new Set(ALL_BASE_SKILL_IDS).size).toBe(15);
  });

  it.each(ALL_BASE_SKILL_IDS)("skills/%s/SKILL.md exists on disk", (id) => {
    const skillPath = path.join(SKILLS_DIR, id, "SKILL.md");
    expect(existsSync(skillPath)).toBe(true);
  });

  it.each(ALL_BASE_SKILL_IDS)(
    "skills/%s/SKILL.md has valid frontmatter (name, description, stage, source: base, mode)",
    (id) => {
      const skillPath = path.join(SKILLS_DIR, id, "SKILL.md");
      const content = readFileSync(skillPath, "utf8");
      const fm = extractFrontmatter(content);

      expect(fm["name"]).toBe(id);
      expect(fm["description"]).toBeTruthy();
      expect(fm["stage"]).toBeTruthy();
      expect(fm["source"]).toBe("base");
      expect(["force", "advisory"]).toContain(fm["mode"]);
    },
  );

  it("fails loudly (non-empty diff) if any of the 15 ids has no on-disk SKILL.md", () => {
    const missing = ALL_BASE_SKILL_IDS.filter(
      (id) => !existsSync(path.join(SKILLS_DIR, id, "SKILL.md")),
    );
    expect(missing).toEqual([]);
  });
});
