import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import {
  getOperationalCatalog,
  type HimaSkillScopeRoots,
  installHimaSkills,
  parseSkillFrontmatter,
  planHimaSkillInstall,
  resolveHimaSkill,
  resolveHimaSkills,
} from "../src/index.js";

let root: string;
let roots: HimaSkillScopeRoots;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "harness-hima-skills-"));
  roots = {
    publicRoot: path.join(root, "public"),
    userHome: path.join(root, "user"),
    orgRoot: path.join(root, "org"),
    projectRoot: path.join(root, "project"),
  };
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("HIMA skill scope install", () => {
  it("plans project-local .hima/skills writes without mutating during dry-run", async () => {
    const result = await installHimaSkills({
      roots,
      scope: "project",
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.scopeRoot).toBe(path.resolve(roots.projectRoot));
    expect(result.writtenPaths).toEqual([]);
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: "project",
          name: "classify-risk",
          path: path.join(roots.projectRoot, ".hima", "skills", "classify-risk", "SKILL.md"),
          relativePath: "skills/classify-risk/SKILL.md",
          status: "planned",
        }),
      ]),
    );
    await expect(
      access(path.join(roots.projectRoot, ".hima", "skills", "classify-risk", "SKILL.md")),
    ).rejects.toThrow();
  });

  it("schema-gates descriptors before planning writes", () => {
    expect(() =>
      planHimaSkillInstall({
        roots,
        scope: "project",
        skills: [
          {
            frontmatter: {
              name: "../escape",
              version: "1.0.0",
              type: "task",
              triggers: ["escape"],
              expected_outputs: ["evidence"],
              requires_tools: [],
              fallback_for_toolsets: [],
              description: "Unsafe skill.",
            },
            body: "# Unsafe",
            source: "test",
          },
        ],
      }),
    ).toThrow();
  });

  it("writes locked SKILL.md frontmatter under the selected scope", async () => {
    const result = await installHimaSkills({
      roots,
      scope: "project",
      dryRun: false,
      skills: [
        {
          frontmatter: {
            name: "custom-review",
            version: "1.0.0",
            type: "task",
            triggers: ["review"],
            expected_outputs: ["review: accepted findings"],
            requires_tools: [],
            fallback_for_toolsets: [],
            description: "Review code changes.",
          },
          body: "# Custom Review\n",
          source: "test",
        },
      ],
    });
    const skillPath = path.join(roots.projectRoot, ".hima", "skills", "custom-review", "SKILL.md");
    const content = await readFile(skillPath, "utf8");

    expect(result.writtenPaths).toEqual([skillPath]);
    expect(content).toContain('name: "custom-review"');
    expect(content).toContain('version: "1.0.0"');
    expect(content).toContain("type: task");
    expect(content).toContain('triggers:\n  - "review"');
    expect(content).toContain('expected_outputs:\n  - "review: accepted findings"');
    expect(content).toContain("requires_tools: []");
    expect(content).toContain("fallback_for_toolsets: []");
    expect(content).toContain("<!-- HIMA:SKILL-ARTIFACT name=custom-review source=test -->");
  });

  it("renders frontmatter that round-trips through the locked schema", async () => {
    await installHimaSkills({
      roots,
      scope: "project",
      dryRun: false,
      skills: [
        {
          frontmatter: {
            name: "custom-review",
            version: "1.0.0",
            type: "task",
            triggers: ["review"],
            expected_outputs: ["review: accepted findings"],
            requires_tools: [],
            fallback_for_toolsets: [],
            description: "Review code changes.",
          },
          body: "# Custom Review\n",
          source: "test",
        },
      ],
    });
    const skillPath = path.join(roots.projectRoot, ".hima", "skills", "custom-review", "SKILL.md");
    const content = await readFile(skillPath, "utf8");
    const parsedFrontmatter = parseSkillFrontmatter(parseYaml(extractFrontmatter(content)));

    expect(parsedFrontmatter).toEqual({
      name: "custom-review",
      version: "1.0.0",
      type: "task",
      triggers: ["review"],
      expected_outputs: ["review: accepted findings"],
      requires_tools: [],
      fallback_for_toolsets: [],
      description: "Review code changes.",
    });
  });

  it("rejects unsafe managed skill sources before planning writes", () => {
    expect(() =>
      planHimaSkillInstall({
        roots,
        scope: "project",
        skills: [
          {
            frontmatter: {
              name: "custom-review",
              version: "1.0.0",
              type: "task",
              triggers: ["review"],
              expected_outputs: ["review: accepted findings"],
              requires_tools: [],
              fallback_for_toolsets: [],
              description: "Review code changes.",
            },
            body: "# Custom Review",
            source: 'test" -->',
          },
        ],
      }),
    ).toThrow('Invalid HIMA skill source "test" -->"');
  });

  it("reports unchanged on an idempotent second apply", async () => {
    await installHimaSkills({
      roots,
      scope: "user",
      dryRun: false,
    });

    const result = await installHimaSkills({
      roots,
      scope: "user",
      dryRun: false,
    });

    expect(result.writtenPaths).toEqual([]);
    expect(result.unchangedPaths).toHaveLength(getOperationalCatalog().skills.length);
    expect(result.actions.every((action) => action.status === "unchanged")).toBe(true);
  });

  it("refuses to overwrite unmanaged skill content unless force is explicit", async () => {
    const skillPath = path.join(roots.projectRoot, ".hima", "skills", "classify-risk", "SKILL.md");
    await mkdir(path.dirname(skillPath), { recursive: true });
    await writeFile(skillPath, "# Manual skill\n", "utf8");

    await expect(
      installHimaSkills({
        roots,
        scope: "project",
        dryRun: false,
      }),
    ).rejects.toThrow("Refusing to overwrite unmanaged HIMA skill");
  });

  it("resolves duplicate skill names with public < user < org < project precedence", async () => {
    await Promise.all([
      writeSkill("public", "same-skill"),
      writeSkill("user", "same-skill"),
      writeSkill("org", "same-skill"),
      writeSkill("project", "same-skill"),
      writeSkill("user", "user-only"),
    ]);

    const resolution = await resolveHimaSkills(roots);
    const selected = await resolveHimaSkill(roots, "same-skill");

    expect(selected?.scope).toBe("project");
    expect(resolution.selected).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "same-skill", scope: "project" }),
        expect.objectContaining({ name: "user-only", scope: "user" }),
      ]),
    );
    expect(resolution.candidates.filter((candidate) => candidate.name === "same-skill")).toEqual([
      expect.objectContaining({ scope: "public", precedence: 0 }),
      expect.objectContaining({ scope: "user", precedence: 1 }),
      expect.objectContaining({ scope: "org", precedence: 2 }),
      expect.objectContaining({ scope: "project", precedence: 3 }),
    ]);
  });

  it("defaults resolution to durable non-org scopes when org root is absent", async () => {
    const { orgRoot: _orgRoot, ...rootsWithoutOrg } = roots;
    await Promise.all([
      writeSkill("public", "same-skill"),
      writeSkill("user", "same-skill"),
      writeSkill("project", "same-skill"),
    ]);

    const resolution = await resolveHimaSkills(rootsWithoutOrg);
    const selected = await resolveHimaSkill(rootsWithoutOrg, "same-skill");

    expect(selected?.scope).toBe("project");
    expect(resolution.candidates.map((candidate) => candidate.scope)).toEqual([
      "public",
      "user",
      "project",
    ]);
  });

  it("rejects unsafe resolver lookup names", async () => {
    await expect(resolveHimaSkill(roots, "../escape")).rejects.toThrow(
      'Skill name "../escape" is not a safe HIMA skill name',
    );
  });

  it("requires an org root for org scoped installation", () => {
    const { orgRoot: _orgRoot, ...rootsWithoutOrg } = roots;

    expect(() =>
      planHimaSkillInstall({
        roots: rootsWithoutOrg,
        scope: "org",
      }),
    ).toThrow("org skill scope requires orgRoot");
  });

  it("still rejects explicit org resolution when org root is absent", async () => {
    const { orgRoot: _orgRoot, ...rootsWithoutOrg } = roots;

    await expect(resolveHimaSkills(rootsWithoutOrg, ["org"])).rejects.toThrow(
      "org skill scope requires orgRoot",
    );
  });

  it("validates the first-wave project-local skill fixture tree", async () => {
    const fixtureRoot = path.join(repoRoot, "fixtures", "hima-skills", "first-wave");
    const fixtureRoots = {
      publicRoot: path.join(fixtureRoot, "public"),
      userHome: path.join(fixtureRoot, "user"),
      orgRoot: path.join(fixtureRoot, "org"),
      projectRoot: path.join(fixtureRoot, "project"),
    };
    const resolution = await resolveHimaSkills(fixtureRoots, ["project"]);
    const expectedNames = [
      "classify-risk",
      "hima-enter",
      "propose-change",
      "status",
      "transition-phase",
    ];

    expect(resolution.selected.map((candidate) => candidate.name)).toEqual(expectedNames);

    for (const candidate of resolution.selected) {
      const content = await readFile(candidate.path, "utf8");
      const frontmatter = parseSkillFrontmatter(parseYaml(extractFrontmatter(content)));

      expect(frontmatter.name).toBe(candidate.name);
      expect(frontmatter.version).toBe("1.0.0");
      expect(frontmatter.triggers.length).toBeGreaterThan(0);
      expect(content).toContain(
        `<!-- HIMA:SKILL-ARTIFACT name=${candidate.name} source=operational-catalog -->`,
      );
    }
  });

  it("validates the harvested project-local skill fixture tree", async () => {
    const fixtureRoot = path.join(repoRoot, "fixtures", "hima-skills", "harvested");
    const fixtureRoots = {
      publicRoot: path.join(fixtureRoot, "public"),
      userHome: path.join(fixtureRoot, "user"),
      orgRoot: path.join(fixtureRoot, "org"),
      projectRoot: path.join(fixtureRoot, "project"),
    };
    const selected = await resolveHimaSkill(fixtureRoots, "ai-slop-cleaner", ["project"]);

    expect(selected).toEqual(
      expect.objectContaining({
        name: "ai-slop-cleaner",
        scope: "project",
      }),
    );

    if (selected === undefined) {
      throw new Error("Expected ai-slop-cleaner fixture to resolve.");
    }

    const content = await readFile(selected.path, "utf8");
    const frontmatter = parseSkillFrontmatter(parseYaml(extractFrontmatter(content)));

    expect(frontmatter).toEqual({
      name: "ai-slop-cleaner",
      version: "1.0.0",
      type: "task",
      triggers: ["slop", "cleanup", "deslop"],
      expected_outputs: [
        "cleanup_plan: smell-focused cleanup plan",
        "regression_evidence: tests or explicit unchanged-behavior evidence",
      ],
      requires_tools: [],
      fallback_for_toolsets: [],
      description: "Run a bounded anti-slop cleanup pass after behavior is locked by evidence.",
    });
    expect(content).toContain(
      "<!-- HIMA:SKILL-ARTIFACT name=ai-slop-cleaner source=harvest/omc -->",
    );
  });

  it("validates the typed handoff harvested skill fixture", async () => {
    const fixtureRoot = path.join(repoRoot, "fixtures", "hima-skills", "harvested");
    const fixtureRoots = {
      publicRoot: path.join(fixtureRoot, "public"),
      userHome: path.join(fixtureRoot, "user"),
      orgRoot: path.join(fixtureRoot, "org"),
      projectRoot: path.join(fixtureRoot, "project"),
    };
    const selected = await resolveHimaSkill(fixtureRoots, "typed-handoff", ["project"]);

    expect(selected).toEqual(
      expect.objectContaining({
        name: "typed-handoff",
        scope: "project",
      }),
    );

    if (selected === undefined) {
      throw new Error("Expected typed-handoff fixture to resolve.");
    }

    const content = await readFile(selected.path, "utf8");
    const frontmatter = parseSkillFrontmatter(parseYaml(extractFrontmatter(content)));

    expect(frontmatter).toEqual({
      name: "typed-handoff",
      version: "1.0.0",
      type: "task",
      triggers: ["handoff", "human-input", "clarify"],
      expected_outputs: [
        "handoff_request: typed human input request",
        "decision_boundary: why automation cannot continue safely",
      ],
      requires_tools: [],
      fallback_for_toolsets: [],
      description:
        "Create a typed human-handoff request when missing authority blocks safe progress.",
    });
    expect(content).toContain(
      "<!-- HIMA:SKILL-ARTIFACT name=typed-handoff source=harvest/12-factor-agents-goose -->",
    );
  });

  it("validates the prompt injection scan harvested skill fixture", async () => {
    const fixtureRoot = path.join(repoRoot, "fixtures", "hima-skills", "harvested");
    const fixtureRoots = {
      publicRoot: path.join(fixtureRoot, "public"),
      userHome: path.join(fixtureRoot, "user"),
      orgRoot: path.join(fixtureRoot, "org"),
      projectRoot: path.join(fixtureRoot, "project"),
    };
    const selected = await resolveHimaSkill(fixtureRoots, "prompt-injection-scan", ["project"]);

    expect(selected).toEqual(
      expect.objectContaining({
        name: "prompt-injection-scan",
        scope: "project",
      }),
    );

    if (selected === undefined) {
      throw new Error("Expected prompt-injection-scan fixture to resolve.");
    }

    const content = await readFile(selected.path, "utf8");
    const frontmatter = parseSkillFrontmatter(parseYaml(extractFrontmatter(content)));

    expect(frontmatter).toEqual({
      name: "prompt-injection-scan",
      version: "1.0.0",
      type: "task",
      triggers: ["prompt-injection", "context-scan", "security"],
      expected_outputs: [
        "scan_report: suspicious prompt patterns and invisible characters",
        "decision: allow block or quarantine context",
      ],
      requires_tools: [],
      fallback_for_toolsets: [],
      description: "Scan loaded context for prompt-injection patterns before trusting it.",
    });
    expect(content).toContain(
      "<!-- HIMA:SKILL-ARTIFACT name=prompt-injection-scan source=harvest/hermes-agent -->",
    );
  });

  it("validates the config linting harvested skill fixture", async () => {
    const fixtureRoot = path.join(repoRoot, "fixtures", "hima-skills", "harvested");
    const fixtureRoots = {
      publicRoot: path.join(fixtureRoot, "public"),
      userHome: path.join(fixtureRoot, "user"),
      orgRoot: path.join(fixtureRoot, "org"),
      projectRoot: path.join(fixtureRoot, "project"),
    };
    const selected = await resolveHimaSkill(fixtureRoots, "config-linting", ["project"]);

    expect(selected).toEqual(
      expect.objectContaining({
        name: "config-linting",
        scope: "project",
      }),
    );

    if (selected === undefined) {
      throw new Error("Expected config-linting fixture to resolve.");
    }

    const content = await readFile(selected.path, "utf8");
    const frontmatter = parseSkillFrontmatter(parseYaml(extractFrontmatter(content)));

    expect(frontmatter).toEqual({
      name: "config-linting",
      version: "1.0.0",
      type: "task",
      triggers: ["config-lint", "skill-lint", "misconfiguration"],
      expected_outputs: [
        "lint_report: detected skill or runtime configuration risks",
        "remediation_plan: smallest safe fixes before execution",
      ],
      requires_tools: [],
      fallback_for_toolsets: [],
      description:
        "Detect silent-failure risks in HIMA skill and runtime configuration before execution.",
    });
    expect(content).toContain(
      "<!-- HIMA:SKILL-ARTIFACT name=config-linting source=harvest/agnix -->",
    );
  });

  it("validates the mode state machine harvested skill fixture", async () => {
    const fixtureRoot = path.join(repoRoot, "fixtures", "hima-skills", "harvested");
    const fixtureRoots = {
      publicRoot: path.join(fixtureRoot, "public"),
      userHome: path.join(fixtureRoot, "user"),
      orgRoot: path.join(fixtureRoot, "org"),
      projectRoot: path.join(fixtureRoot, "project"),
    };
    const selected = await resolveHimaSkill(fixtureRoots, "mode-state-machine", ["project"]);

    expect(selected).toEqual(
      expect.objectContaining({
        name: "mode-state-machine",
        scope: "project",
      }),
    );

    if (selected === undefined) {
      throw new Error("Expected mode-state-machine fixture to resolve.");
    }

    const content = await readFile(selected.path, "utf8");
    const frontmatter = parseSkillFrontmatter(parseYaml(extractFrontmatter(content)));

    expect(frontmatter).toEqual({
      name: "mode-state-machine",
      version: "1.0.0",
      type: "task",
      triggers: ["mode", "state-machine", "workflow-state"],
      expected_outputs: [
        "state_snapshot: current mode state and legal transitions",
        "transition_guard: allowed blocked or deferred movement with reason",
      ],
      requires_tools: [],
      fallback_for_toolsets: [],
      description: "Track workflow mode state and guard transitions before execution proceeds.",
    });
    expect(content).toContain(
      "<!-- HIMA:SKILL-ARTIFACT name=mode-state-machine source=harvest/omx -->",
    );
  });

  it("validates the evidence gate harvested skill fixture", async () => {
    const fixtureRoot = path.join(repoRoot, "fixtures", "hima-skills", "harvested");
    const fixtureRoots = {
      publicRoot: path.join(fixtureRoot, "public"),
      userHome: path.join(fixtureRoot, "user"),
      orgRoot: path.join(fixtureRoot, "org"),
      projectRoot: path.join(fixtureRoot, "project"),
    };
    const selected = await resolveHimaSkill(fixtureRoots, "evidence-gate", ["project"]);

    expect(selected).toEqual(
      expect.objectContaining({
        name: "evidence-gate",
        scope: "project",
      }),
    );

    if (selected === undefined) {
      throw new Error("Expected evidence-gate fixture to resolve.");
    }

    const content = await readFile(selected.path, "utf8");
    const frontmatter = parseSkillFrontmatter(parseYaml(extractFrontmatter(content)));

    expect(frontmatter).toEqual({
      name: "evidence-gate",
      version: "1.0.0",
      type: "task",
      triggers: ["evidence-gate", "eval-suite", "suite-promotion"],
      expected_outputs: [
        "gate_result: eval suite held-out split and promotion readiness",
        "missing_evidence: gaps blocking evidence acceptance",
      ],
      requires_tools: [],
      fallback_for_toolsets: [],
      description: "Apply a three-step evidence gate before accepting completion claims.",
    });
    expect(content).toContain(
      "<!-- HIMA:SKILL-ARTIFACT name=evidence-gate source=harvest/auto-harness -->",
    );
  });

  it("validates the default deny tools harvested skill fixture", async () => {
    const fixtureRoot = path.join(repoRoot, "fixtures", "hima-skills", "harvested");
    const fixtureRoots = {
      publicRoot: path.join(fixtureRoot, "public"),
      userHome: path.join(fixtureRoot, "user"),
      orgRoot: path.join(fixtureRoot, "org"),
      projectRoot: path.join(fixtureRoot, "project"),
    };
    const selected = await resolveHimaSkill(fixtureRoots, "default-deny-tools", ["project"]);

    expect(selected).toEqual(
      expect.objectContaining({
        name: "default-deny-tools",
        scope: "project",
      }),
    );

    if (selected === undefined) {
      throw new Error("Expected default-deny-tools fixture to resolve.");
    }

    const content = await readFile(selected.path, "utf8");
    const frontmatter = parseSkillFrontmatter(parseYaml(extractFrontmatter(content)));

    expect(frontmatter).toEqual({
      name: "default-deny-tools",
      version: "1.0.0",
      type: "task",
      triggers: ["default-deny", "subagent-tools", "tool-policy"],
      expected_outputs: [
        "deny_policy: blocked subagent tools and allowed exceptions",
        "enforcement_gap: missing runtime handler or test coverage",
      ],
      requires_tools: [],
      fallback_for_toolsets: [],
      description:
        "Apply default-deny reasoning to subagent tool policy before delegated work runs.",
    });
    expect(content).toContain(
      "<!-- HIMA:SKILL-ARTIFACT name=default-deny-tools source=harvest/opencode -->",
    );
  });

  it("validates the compact hooks harvested skill fixture", async () => {
    const fixtureRoot = path.join(repoRoot, "fixtures", "hima-skills", "harvested");
    const fixtureRoots = {
      publicRoot: path.join(fixtureRoot, "public"),
      userHome: path.join(fixtureRoot, "user"),
      orgRoot: path.join(fixtureRoot, "org"),
      projectRoot: path.join(fixtureRoot, "project"),
    };
    const selected = await resolveHimaSkill(fixtureRoots, "compact-hooks", ["project"]);

    expect(selected).toEqual(
      expect.objectContaining({
        name: "compact-hooks",
        scope: "project",
      }),
    );

    if (selected === undefined) {
      throw new Error("Expected compact-hooks fixture to resolve.");
    }

    const content = await readFile(selected.path, "utf8");
    const frontmatter = parseSkillFrontmatter(parseYaml(extractFrontmatter(content)));

    expect(frontmatter).toEqual({
      name: "compact-hooks",
      version: "1.0.0",
      type: "task",
      triggers: ["pre-compact", "post-compact", "context-compaction"],
      expected_outputs: [
        "compact_snapshot: critical state preserved before compaction",
        "continuity_check: post-compaction route and evidence continuity",
      ],
      requires_tools: [],
      fallback_for_toolsets: [],
      description:
        "Preserve critical state across context compaction with pre and post compact checks.",
    });
    expect(content).toContain(
      "<!-- HIMA:SKILL-ARTIFACT name=compact-hooks source=harvest/pro-workflow -->",
    );
  });

  it("validates the anti-bypass clause harvested skill fixture", async () => {
    const fixtureRoot = path.join(repoRoot, "fixtures", "hima-skills", "harvested");
    const fixtureRoots = {
      publicRoot: path.join(fixtureRoot, "public"),
      userHome: path.join(fixtureRoot, "user"),
      orgRoot: path.join(fixtureRoot, "org"),
      projectRoot: path.join(fixtureRoot, "project"),
    };
    const selected = await resolveHimaSkill(fixtureRoots, "anti-bypass-clause", ["project"]);

    expect(selected).toEqual(
      expect.objectContaining({
        name: "anti-bypass-clause",
        scope: "project",
      }),
    );

    if (selected === undefined) {
      throw new Error("Expected anti-bypass-clause fixture to resolve.");
    }

    const content = await readFile(selected.path, "utf8");
    const frontmatter = parseSkillFrontmatter(parseYaml(extractFrontmatter(content)));

    expect(frontmatter).toEqual({
      name: "anti-bypass-clause",
      version: "1.0.0",
      type: "task",
      triggers: ["anti-bypass", "permission-bypass", "tool-policy"],
      expected_outputs: [
        "bypass_clause: prohibited bypass paths and allowed escalation route",
        "violation_signal: detected bypass attempt or missing enforcement",
      ],
      requires_tools: [],
      fallback_for_toolsets: [],
      description: "State anti-bypass constraints before permission-sensitive tool or agent work.",
    });
    expect(content).toContain(
      "<!-- HIMA:SKILL-ARTIFACT name=anti-bypass-clause source=harvest/opencode -->",
    );
  });

  it("validates the prompt cache boundary harvested skill fixture", async () => {
    const fixtureRoot = path.join(repoRoot, "fixtures", "hima-skills", "harvested");
    const fixtureRoots = {
      publicRoot: path.join(fixtureRoot, "public"),
      userHome: path.join(fixtureRoot, "user"),
      orgRoot: path.join(fixtureRoot, "org"),
      projectRoot: path.join(fixtureRoot, "project"),
    };
    const selected = await resolveHimaSkill(fixtureRoots, "prompt-cache-boundary", ["project"]);

    expect(selected).toEqual(
      expect.objectContaining({
        name: "prompt-cache-boundary",
        scope: "project",
      }),
    );

    if (selected === undefined) {
      throw new Error("Expected prompt-cache-boundary fixture to resolve.");
    }

    const content = await readFile(selected.path, "utf8");
    const frontmatter = parseSkillFrontmatter(parseYaml(extractFrontmatter(content)));

    expect(frontmatter).toEqual({
      name: "prompt-cache-boundary",
      version: "1.0.0",
      type: "task",
      triggers: ["prompt-cache", "cache-boundary", "context-reuse"],
      expected_outputs: [
        "cache_boundary: cacheable prompt context and non-cacheable state",
        "invalidation_signal: freshness risks requiring cache bypass or invalidation",
      ],
      requires_tools: [],
      fallback_for_toolsets: [],
      description: "Separate cacheable prompt context from fresh state before context reuse.",
    });
    expect(content).toContain(
      "<!-- HIMA:SKILL-ARTIFACT name=prompt-cache-boundary source=harvest/claw-code -->",
    );
  });

  it("validates the preference router harvested skill fixture", async () => {
    const fixtureRoot = path.join(repoRoot, "fixtures", "hima-skills", "harvested");
    const fixtureRoots = {
      publicRoot: path.join(fixtureRoot, "public"),
      userHome: path.join(fixtureRoot, "user"),
      orgRoot: path.join(fixtureRoot, "org"),
      projectRoot: path.join(fixtureRoot, "project"),
    };
    const selected = await resolveHimaSkill(fixtureRoots, "preference-router", ["project"]);

    expect(selected).toEqual(
      expect.objectContaining({
        name: "preference-router",
        scope: "project",
      }),
    );

    if (selected === undefined) {
      throw new Error("Expected preference-router fixture to resolve.");
    }

    const content = await readFile(selected.path, "utf8");
    const frontmatter = parseSkillFrontmatter(parseYaml(extractFrontmatter(content)));

    expect(frontmatter).toEqual({
      name: "preference-router",
      version: "1.0.0",
      type: "task",
      triggers: ["preference-router", "evaluate-then-decide", "model-routing"],
      expected_outputs: [
        "route_decision: candidate preferences and selected route",
        "evaluation_gap: missing evidence before routing decision",
      ],
      requires_tools: [],
      fallback_for_toolsets: [],
      description: "Evaluate route preferences before selecting an agent or runtime path.",
    });
    expect(content).toContain(
      "<!-- HIMA:SKILL-ARTIFACT name=preference-router source=harvest/nexus-agents -->",
    );
  });

  it("validates the 00-idea-pmf book-scoped skill fixture tree", async () => {
    const fixtureRoot = path.join(repoRoot, "fixtures", "hima-skills", "books", "00-idea-pmf");
    const fixtureRoots = {
      publicRoot: path.join(fixtureRoot, "public"),
      userHome: path.join(fixtureRoot, "user"),
      orgRoot: path.join(fixtureRoot, "org"),
      projectRoot: path.join(fixtureRoot, "project"),
    };
    const resolution = await resolveHimaSkills(fixtureRoots, ["project"]);
    const expectedNames = [
      "icp-access-plan",
      "idea-sourcing",
      "pmf-evidence-card",
      "problem-pain-score",
      "validation-ladder",
    ];

    expect(resolution.selected.map((candidate) => candidate.name)).toEqual(expectedNames);

    for (const candidate of resolution.selected) {
      const content = await readFile(candidate.path, "utf8");
      const frontmatter = parseSkillFrontmatter(parseYaml(extractFrontmatter(content)));

      expect(frontmatter.name).toBe(candidate.name);
      expect(frontmatter.version).toBe("1.0.0");
      expect(content).toContain(`source=book/00-idea-pmf`);
    }
  });

  it("validates the 01-strategy-positioning book-scoped skill fixture tree", async () => {
    const fixtureRoot = path.join(
      repoRoot,
      "fixtures",
      "hima-skills",
      "books",
      "01-strategy-positioning",
    );
    const fixtureRoots = {
      publicRoot: path.join(fixtureRoot, "public"),
      userHome: path.join(fixtureRoot, "user"),
      orgRoot: path.join(fixtureRoot, "org"),
      projectRoot: path.join(fixtureRoot, "project"),
    };
    const resolution = await resolveHimaSkills(fixtureRoots, ["project"]);
    const expectedNames = [
      "category-thesis",
      "goal-sprint-alignment",
      "message-hierarchy",
      "positioning-map",
      "strategy-thesis",
    ];

    expect(resolution.selected.map((candidate) => candidate.name)).toEqual(expectedNames);

    for (const candidate of resolution.selected) {
      const content = await readFile(candidate.path, "utf8");
      const frontmatter = parseSkillFrontmatter(parseYaml(extractFrontmatter(content)));

      expect(frontmatter.name).toBe(candidate.name);
      expect(frontmatter.version).toBe("1.0.0");
      expect(content).toContain(`source=book/01-strategy-positioning`);
    }
  });

  it("validates the 02-analysis-discovery book-scoped skill fixture tree", async () => {
    const fixtureRoot = path.join(
      repoRoot,
      "fixtures",
      "hima-skills",
      "books",
      "02-analysis-discovery",
    );
    const fixtureRoots = {
      publicRoot: path.join(fixtureRoot, "public"),
      userHome: path.join(fixtureRoot, "user"),
      orgRoot: path.join(fixtureRoot, "org"),
      projectRoot: path.join(fixtureRoot, "project"),
    };
    const resolution = await resolveHimaSkills(fixtureRoots, ["project"]);
    const expectedNames = [
      "assumption-audit",
      "discovery-synthesis",
      "evidence-map",
      "source-triangulation",
      "technical-discovery-scan",
    ];

    expect(resolution.selected.map((candidate) => candidate.name)).toEqual(expectedNames);

    for (const candidate of resolution.selected) {
      const content = await readFile(candidate.path, "utf8");
      const frontmatter = parseSkillFrontmatter(parseYaml(extractFrontmatter(content)));

      expect(frontmatter.name).toBe(candidate.name);
      expect(frontmatter.version).toBe("1.0.0");
      expect(content).toContain(`source=book/02-analysis-discovery`);
    }
  });

  it("validates the 03-specification book-scoped skill fixture tree", async () => {
    const fixtureRoot = path.join(repoRoot, "fixtures", "hima-skills", "books", "03-specification");
    const fixtureRoots = {
      publicRoot: path.join(fixtureRoot, "public"),
      userHome: path.join(fixtureRoot, "user"),
      orgRoot: path.join(fixtureRoot, "org"),
      projectRoot: path.join(fixtureRoot, "project"),
    };
    const resolution = await resolveHimaSkills(fixtureRoots, ["project"]);
    const expectedNames = [
      "acceptance-criteria",
      "contract-schema",
      "requirements-clarity",
      "spec-review",
      "spec-to-test-plan",
    ];

    expect(resolution.selected.map((candidate) => candidate.name)).toEqual(expectedNames);

    for (const candidate of resolution.selected) {
      const content = await readFile(candidate.path, "utf8");
      const frontmatter = parseSkillFrontmatter(parseYaml(extractFrontmatter(content)));

      expect(frontmatter.name).toBe(candidate.name);
      expect(frontmatter.version).toBe("1.0.0");
      expect(content).toContain(`source=book/03-specification`);
    }
  });

  it("validates the 04-design-ux-ui book-scoped skill fixture tree", async () => {
    const fixtureRoot = path.join(repoRoot, "fixtures", "hima-skills", "books", "04-design-ux-ui");
    const fixtureRoots = {
      publicRoot: path.join(fixtureRoot, "public"),
      userHome: path.join(fixtureRoot, "user"),
      orgRoot: path.join(fixtureRoot, "org"),
      projectRoot: path.join(fixtureRoot, "project"),
    };
    const resolution = await resolveHimaSkills(fixtureRoots, ["project"]);
    const expectedNames = [
      "accessibility-check",
      "interaction-flow-review",
      "interface-copy-review",
      "visual-hierarchy-audit",
      "workflow-ergonomics",
    ];

    expect(resolution.selected.map((candidate) => candidate.name)).toEqual(expectedNames);

    for (const candidate of resolution.selected) {
      const content = await readFile(candidate.path, "utf8");
      const frontmatter = parseSkillFrontmatter(parseYaml(extractFrontmatter(content)));

      expect(frontmatter.name).toBe(candidate.name);
      expect(frontmatter.version).toBe("1.0.0");
      expect(content).toContain(`source=book/04-design-ux-ui`);
    }
  });

  it("validates the 05-architecture book-scoped skill fixture tree", async () => {
    const fixtureRoot = path.join(repoRoot, "fixtures", "hima-skills", "books", "05-architecture");
    const fixtureRoots = {
      publicRoot: path.join(fixtureRoot, "public"),
      userHome: path.join(fixtureRoot, "user"),
      orgRoot: path.join(fixtureRoot, "org"),
      projectRoot: path.join(fixtureRoot, "project"),
    };
    const resolution = await resolveHimaSkills(fixtureRoots, ["project"]);
    const expectedNames = [
      "api-boundary-review",
      "bounded-context-map",
      "domain-modeling",
      "runtime-architecture-decision",
      "storage-boundary-review",
    ];

    expect(resolution.selected.map((candidate) => candidate.name)).toEqual(expectedNames);

    for (const candidate of resolution.selected) {
      const content = await readFile(candidate.path, "utf8");
      const frontmatter = parseSkillFrontmatter(parseYaml(extractFrontmatter(content)));

      expect(frontmatter.name).toBe(candidate.name);
      expect(frontmatter.version).toBe("1.0.0");
      expect(content).toContain(`source=book/05-architecture`);
    }
  });

  it("validates the 07-build book-scoped skill fixture tree", async () => {
    const fixtureRoot = path.join(repoRoot, "fixtures", "hima-skills", "books", "07-build");
    const fixtureRoots = {
      publicRoot: path.join(fixtureRoot, "public"),
      userHome: path.join(fixtureRoot, "user"),
      orgRoot: path.join(fixtureRoot, "org"),
      projectRoot: path.join(fixtureRoot, "project"),
    };
    const resolution = await resolveHimaSkills(fixtureRoots, ["project"]);
    const expectedNames = [
      "build-slice-plan",
      "defect-containment",
      "refactor-safety",
      "regression-lock",
      "verification-loop",
    ];

    expect(resolution.selected.map((candidate) => candidate.name)).toEqual(expectedNames);

    for (const candidate of resolution.selected) {
      const content = await readFile(candidate.path, "utf8");
      const frontmatter = parseSkillFrontmatter(parseYaml(extractFrontmatter(content)));

      expect(frontmatter.name).toBe(candidate.name);
      expect(frontmatter.version).toBe("1.0.0");
      expect(content).toContain(`source=book/07-build`);
    }
  });

  it("validates the 09-quality-release-run book-scoped skill fixture tree", async () => {
    const fixtureRoot = path.join(
      repoRoot,
      "fixtures",
      "hima-skills",
      "books",
      "09-quality-release-run",
    );
    const fixtureRoots = {
      publicRoot: path.join(fixtureRoot, "public"),
      userHome: path.join(fixtureRoot, "user"),
      orgRoot: path.join(fixtureRoot, "org"),
      projectRoot: path.join(fixtureRoot, "project"),
    };
    const resolution = await resolveHimaSkills(fixtureRoots, ["project"]);
    const expectedNames = [
      "release-evidence-pack",
      "risk-based-test-matrix",
      "rollback-readiness",
      "smoke-release-check",
      "test-portfolio-scorecard",
    ];

    expect(resolution.selected.map((candidate) => candidate.name)).toEqual(expectedNames);

    for (const candidate of resolution.selected) {
      const content = await readFile(candidate.path, "utf8");
      const frontmatter = parseSkillFrontmatter(parseYaml(extractFrontmatter(content)));

      expect(frontmatter.name).toBe(candidate.name);
      expect(frontmatter.version).toBe("1.0.0");
      expect(content).toContain(`source=book/09-quality-release-run`);
    }
  });
});

async function writeSkill(scope: "public" | "user" | "org" | "project", name: string) {
  const scopeRoot =
    scope === "public"
      ? roots.publicRoot
      : scope === "user"
        ? roots.userHome
        : scope === "org"
          ? roots.orgRoot
          : roots.projectRoot;
  if (scopeRoot === undefined) {
    throw new Error("Missing scope root.");
  }

  const skillPath = path.join(scopeRoot, ".hima", "skills", name, "SKILL.md");
  await mkdir(path.dirname(skillPath), { recursive: true });
  await writeFile(skillPath, `# ${name}\n`, "utf8");
}

function extractFrontmatter(content: string): string {
  const match = /^---\n(?<frontmatter>[\s\S]*?)\n---\n/u.exec(content);
  if (match?.groups?.frontmatter === undefined) {
    throw new Error("Missing SKILL.md frontmatter.");
  }

  return match.groups.frontmatter;
}
