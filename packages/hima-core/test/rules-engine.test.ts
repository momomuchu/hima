/**
 * tests/rules-engine.test.ts — integration tests for the rules engine.
 *
 * Required scenarios (R-029):
 *   (A) A .hima/rules/*.md file with globs:["**\/*.ts"] matches a .ts target
 *       and returns its body.
 *   (B) An alwaysApply:true rule is always returned, regardless of target.
 *   (C) A rule with globs:["**\/*.sql"] does NOT match a .ts target.
 *   (D) Session dedup: a second resolve call for the same sessionId does not
 *       re-inject the same rule.
 *   (E) Missing rules directories → empty result (no throw).
 *
 * Additional coverage:
 *   - Frontmatter parser: globs array, alwaysApply, description, body.
 *   - Matcher: ruleMatches() positive / negative / empty-globs.
 *   - Mixed sources: .hima/rules precedes .claude/rules.
 *   - Multiple rules with different globs: only matching ones injected.
 */

import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { parseRuleFrontmatter } from "../src/rules-engine/frontmatter.js";
import { ruleMatches } from "../src/rules-engine/matcher.js";
import { resolveRulesForPath } from "../src/rules-engine/index.js";

// ---------------------------------------------------------------------------
// Tmp dir lifecycle
// ---------------------------------------------------------------------------

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(os.tmpdir(), "hima-rules-test-"));
});

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeRule(
  root: string,
  source: string,
  filename: string,
  content: string,
): Promise<string> {
  const dir = path.join(root, source);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await writeFile(filePath, content, "utf8");
  return filePath;
}

// ---------------------------------------------------------------------------
// §1 — parseRuleFrontmatter
// ---------------------------------------------------------------------------

describe("parseRuleFrontmatter", () => {
  it("parses globs array and body correctly", () => {
    const content = `---
globs:
  - "**/*.ts"
  - "src/**"
alwaysApply: false
description: "TS rules"
---
Rule body here.
`;
    const result = parseRuleFrontmatter(content);
    expect(result.globs).toEqual(["**/*.ts", "src/**"]);
    expect(result.alwaysApply).toBe(false);
    expect(result.description).toBe("TS rules");
    expect(result.body.trim()).toBe("Rule body here.");
  });

  it("parses inline globs array", () => {
    const content = `---
globs: ["**/*.ts", "lib/**"]
alwaysApply: false
---
Body.
`;
    const result = parseRuleFrontmatter(content);
    expect(result.globs).toEqual(["**/*.ts", "lib/**"]);
  });

  it("returns alwaysApply: true when set", () => {
    const content = `---
alwaysApply: true
---
Always injected.
`;
    const result = parseRuleFrontmatter(content);
    expect(result.alwaysApply).toBe(true);
    expect(result.globs).toEqual([]);
  });

  it("returns empty globs and alwaysApply:false when no frontmatter", () => {
    const content = "Just a plain rule without frontmatter.\n";
    const result = parseRuleFrontmatter(content);
    expect(result.globs).toEqual([]);
    expect(result.alwaysApply).toBe(false);
    expect(result.body).toBe(content);
  });

  it("handles missing description field", () => {
    const content = `---
globs: ["**/*.ts"]
alwaysApply: false
---
No description.
`;
    const result = parseRuleFrontmatter(content);
    expect(result.description).toBeUndefined();
  });

  it("body captures everything after the closing ---", () => {
    const content = `---
alwaysApply: true
---
Line 1.
Line 2.
`;
    const result = parseRuleFrontmatter(content);
    expect(result.body).toBe("Line 1.\nLine 2.\n");
  });
});

// ---------------------------------------------------------------------------
// §2 — ruleMatches
// ---------------------------------------------------------------------------

describe("ruleMatches", () => {
  it("matches a .ts file against **/*.ts glob on relativePath", () => {
    expect(ruleMatches(["**/*.ts"], "src/foo/bar.ts", "bar.ts")).toBe(true);
  });

  it("matches a .ts file against **/*.ts glob on basename", () => {
    expect(ruleMatches(["**/*.ts"], "some/deep/file.ts", "file.ts")).toBe(true);
  });

  it("does NOT match a .ts file against **/*.sql glob", () => {
    expect(ruleMatches(["**/*.sql"], "src/foo/bar.ts", "bar.ts")).toBe(false);
  });

  it("returns false for empty globs array", () => {
    expect(ruleMatches([], "src/foo/bar.ts", "bar.ts")).toBe(false);
  });

  it("negation pattern cancels a positive match", () => {
    expect(
      ruleMatches(["**/*.ts", "!**/*.test.ts"], "src/foo.test.ts", "foo.test.ts"),
    ).toBe(false);
  });

  it("positive pattern with non-matching negation still matches", () => {
    expect(
      ruleMatches(["**/*.ts", "!**/*.sql"], "src/foo.ts", "foo.ts"),
    ).toBe(true);
  });

  it("matches exact filename via basename", () => {
    expect(ruleMatches(["AGENTS.md"], "deep/dir/AGENTS.md", "AGENTS.md")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// §3 — resolveRulesForPath: scenario A — glob match returns body
// ---------------------------------------------------------------------------

describe("resolveRulesForPath — scenario A: glob match returns body", () => {
  it("a .hima/rules/*.md with globs:**/*.ts matches a .ts target and returns its body", async () => {
    const ruleContent = `---
globs:
  - "**/*.ts"
alwaysApply: false
---
TypeScript rule body.
`;
    await writeRule(tmpRoot, ".hima/rules", "ts-rules.md", ruleContent);

    const target = path.join(tmpRoot, "src", "index.ts");
    const result = await resolveRulesForPath(tmpRoot, target, {
      sources: [".hima/rules"],
    });

    expect(result.injected).toHaveLength(1);
    expect(result.injected[0]?.trim()).toBe("TypeScript rule body.");
    expect(result.matchedFiles).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// §4 — scenario B: alwaysApply rule is always returned
// ---------------------------------------------------------------------------

describe("resolveRulesForPath — scenario B: alwaysApply rule always returned", () => {
  it("alwaysApply:true rule is injected regardless of the target file extension", async () => {
    const ruleContent = `---
alwaysApply: true
---
Always-on rule body.
`;
    await writeRule(tmpRoot, ".hima/rules", "global.md", ruleContent);

    // Target is a Python file — no .ts glob would match, but alwaysApply wins
    const target = path.join(tmpRoot, "scripts", "deploy.py");
    const result = await resolveRulesForPath(tmpRoot, target, {
      sources: [".hima/rules"],
    });

    expect(result.injected).toHaveLength(1);
    expect(result.injected[0]?.trim()).toBe("Always-on rule body.");
  });

  it("alwaysApply:true rule is injected even when the target has no extension", async () => {
    const ruleContent = `---
alwaysApply: true
---
Injected for any file.
`;
    await writeRule(tmpRoot, ".hima/rules", "always.md", ruleContent);

    const target = path.join(tmpRoot, "Makefile");
    const result = await resolveRulesForPath(tmpRoot, target, {
      sources: [".hima/rules"],
    });

    expect(result.injected).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// §5 — scenario C: **/*.sql does NOT match a .ts target
// ---------------------------------------------------------------------------

describe("resolveRulesForPath — scenario C: non-matching glob returns nothing", () => {
  it("a rule with globs:**/*.sql does NOT match a .ts file", async () => {
    const ruleContent = `---
globs:
  - "**/*.sql"
alwaysApply: false
---
SQL rule body.
`;
    await writeRule(tmpRoot, ".hima/rules", "sql-rules.md", ruleContent);

    const target = path.join(tmpRoot, "src", "models.ts");
    const result = await resolveRulesForPath(tmpRoot, target, {
      sources: [".hima/rules"],
    });

    expect(result.injected).toHaveLength(0);
    expect(result.matchedFiles).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// §6 — scenario D: session dedup
// ---------------------------------------------------------------------------

describe("resolveRulesForPath — scenario D: session dedup", () => {
  it("second resolve for the same sessionId does not re-inject the same rule", async () => {
    const ruleContent = `---
alwaysApply: true
---
Session-dedup rule.
`;
    await writeRule(tmpRoot, ".hima/rules", "dedup.md", ruleContent);

    const target = path.join(tmpRoot, "src", "index.ts");

    // First call — rule is injected
    const first = await resolveRulesForPath(tmpRoot, target, {
      sessionId: "test-session-001",
      sources: [".hima/rules"],
    });
    expect(first.injected).toHaveLength(1);

    // Second call with the same sessionId — rule should be skipped
    const second = await resolveRulesForPath(tmpRoot, target, {
      sessionId: "test-session-001",
      sources: [".hima/rules"],
    });
    expect(second.injected).toHaveLength(0);
    expect(second.matchedFiles).toHaveLength(0);
  });

  it("different sessionIds are independent — each gets a fresh injection", async () => {
    const ruleContent = `---
alwaysApply: true
---
Independent per session.
`;
    await writeRule(tmpRoot, ".hima/rules", "sess.md", ruleContent);

    const target = path.join(tmpRoot, "src", "foo.ts");

    const s1 = await resolveRulesForPath(tmpRoot, target, {
      sessionId: "session-A",
      sources: [".hima/rules"],
    });
    const s2 = await resolveRulesForPath(tmpRoot, target, {
      sessionId: "session-B",
      sources: [".hima/rules"],
    });

    expect(s1.injected).toHaveLength(1);
    expect(s2.injected).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// §7 — scenario E: missing rules directories → empty result
// ---------------------------------------------------------------------------

describe("resolveRulesForPath — scenario E: missing rules dirs return empty", () => {
  it("returns empty result when all source directories are missing", async () => {
    const target = path.join(tmpRoot, "src", "app.ts");
    const result = await resolveRulesForPath(tmpRoot, target, {
      sources: [".hima/rules", ".claude/rules", ".cursor/rules"],
    });

    expect(result.injected).toHaveLength(0);
    expect(result.matchedFiles).toHaveLength(0);
  });

  it("does not throw when root itself does not contain any rules dir", async () => {
    const target = path.join(tmpRoot, "main.ts");
    await expect(
      resolveRulesForPath(tmpRoot, target),
    ).resolves.toMatchObject({ injected: [], matchedFiles: [] });
  });
});

// ---------------------------------------------------------------------------
// §8 — source priority and multiple rules
// ---------------------------------------------------------------------------

describe("resolveRulesForPath — source priority and multi-rule scenarios", () => {
  it("includes only matching rules when multiple rules with different globs are present", async () => {
    await writeRule(
      tmpRoot,
      ".hima/rules",
      "ts.md",
      `---\nglobs: ["**/*.ts"]\nalwaysApply: false\n---\nTS rule.\n`,
    );
    await writeRule(
      tmpRoot,
      ".hima/rules",
      "sql.md",
      `---\nglobs: ["**/*.sql"]\nalwaysApply: false\n---\nSQL rule.\n`,
    );
    await writeRule(
      tmpRoot,
      ".hima/rules",
      "always.md",
      `---\nalwaysApply: true\n---\nAlways rule.\n`,
    );

    const target = path.join(tmpRoot, "src", "model.ts");
    const result = await resolveRulesForPath(tmpRoot, target, {
      sources: [".hima/rules"],
    });

    // Should include: ts.md (glob match) + always.md (alwaysApply) — NOT sql.md
    expect(result.injected).toHaveLength(2);
    const allBody = result.injected.join("\n");
    expect(allBody).toContain("TS rule.");
    expect(allBody).toContain("Always rule.");
    expect(allBody).not.toContain("SQL rule.");
  });

  it("deduplicates by realpath when the same file appears in two sources", async () => {
    // Create one rule file in .hima/rules
    const ruleContent = `---\nalwaysApply: true\n---\nUnique rule.\n`;
    await writeRule(tmpRoot, ".hima/rules", "shared.md", ruleContent);

    // Resolve with .hima/rules listed twice
    const target = path.join(tmpRoot, "file.ts");
    const result = await resolveRulesForPath(tmpRoot, target, {
      sources: [".hima/rules", ".hima/rules"],
    });

    // Same real file — should appear only once
    expect(result.injected).toHaveLength(1);
  });

  it("returns matchedFiles paths for all matched rules", async () => {
    await writeRule(
      tmpRoot,
      ".hima/rules",
      "a.md",
      `---\nglobs: ["**/*.ts"]\nalwaysApply: false\n---\nA.\n`,
    );
    await writeRule(
      tmpRoot,
      ".hima/rules",
      "b.md",
      `---\nglobs: ["**/*.ts"]\nalwaysApply: false\n---\nB.\n`,
    );

    const target = path.join(tmpRoot, "src", "x.ts");
    const result = await resolveRulesForPath(tmpRoot, target, {
      sources: [".hima/rules"],
    });

    expect(result.matchedFiles).toHaveLength(2);
    expect(result.matchedFiles.every((f) => f.endsWith(".md"))).toBe(true);
  });
});
