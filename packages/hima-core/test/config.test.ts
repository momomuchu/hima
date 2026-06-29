/**
 * Tests for config.ts — loadConfig, resolveStageForceSkills, resolveStageInjectSkills, resolveRole.
 *
 * All filesystem interaction uses temporary directories created per-test and
 * removed afterwards.  The injectable opts.userConfigPath / opts.projectConfigPath
 * keeps the real home directory untouched.
 *
 * Required scenarios (task spec §tests):
 *   (1) No config files → loadConfig returns {} and forceSkills falls back to DEV_CYCLE
 *   (2) Project config overrides discovery.force → resolveStageForceSkills returns override
 *   (3) Project beats user for the same stage
 *   (4) Malformed project config is skipped, not thrown
 *   (5) resolveRole merges model "haiku" over a base role
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEV_CYCLE } from "@hima/schemas";
import type { SkillRef } from "@hima/schemas";
import { ROLE_CATALOG } from "../src/role-catalog.js";
import {
  HimaConfig,
  loadConfig,
  resolveRole,
  resolveStageForceSkills,
  resolveStageInjectSkills,
} from "../src/config.js";

// ─────────────────────────────────────────────────────────────────────────────
// Tmp dir lifecycle
// ─────────────────────────────────────────────────────────────────────────────

let tmpDir: string;
let userConfigPath: string;
let projectConfigPath: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), "hima-config-test-"));
  userConfigPath = path.join(tmpDir, "user-config.json");
  projectConfigPath = path.join(tmpDir, "project-config.json");
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────

/** The Surveyor RoleDef from the base catalog. */
const SURVEYOR = ROLE_CATALOG.find((r) => r.roleId === "surveyor")!;

const MY_SKILL: SkillRef = { source: "user", id: "my-custom-skill" };
const PROJECT_SKILL: SkillRef = { source: "project", id: "project-skill" };
const USER_SKILL: SkillRef = { source: "user", id: "user-skill" };

// ─────────────────────────────────────────────────────────────────────────────
// (1) No config files → empty config + DEV_CYCLE fallback
// ─────────────────────────────────────────────────────────────────────────────

describe("loadConfig — no config files", () => {
  it("returns an empty config when neither user nor project config exists", async () => {
    const config = await loadConfig("/nonexistent-root", {
      userConfigPath,
      projectConfigPath,
    });
    expect(config).toEqual({});
  });

  it("resolveStageForceSkills falls back to DEV_CYCLE discovery forceSkills", async () => {
    const config = await loadConfig("/nonexistent-root", {
      userConfigPath,
      projectConfigPath,
    });
    const skills = resolveStageForceSkills(config, "discovery", DEV_CYCLE);
    // DEV_CYCLE discovery stage has one forceSkill
    expect(skills).toEqual([
      { source: "corpus", id: "corpus-technical-analysis-discovery" },
    ]);
  });

  it("resolveStageForceSkills returns [] for an unknown stage", async () => {
    const config = await loadConfig("/nonexistent-root", {
      userConfigPath,
      projectConfigPath,
    });
    expect(resolveStageForceSkills(config, "nonexistent-stage", DEV_CYCLE)).toEqual([]);
  });

  it("resolveStageInjectSkills falls back to DEV_CYCLE (discovery has no injectSkills)", async () => {
    const config = await loadConfig("/nonexistent-root", {
      userConfigPath,
      projectConfigPath,
    });
    expect(resolveStageInjectSkills(config, "discovery", DEV_CYCLE)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (2) Project config overriding discovery.force
// ─────────────────────────────────────────────────────────────────────────────

describe("loadConfig — project config stageSkills override", () => {
  it("project stageSkills.discovery.force overrides DEV_CYCLE", async () => {
    const projectConfig = {
      stageSkills: {
        discovery: { force: [MY_SKILL] },
      },
    };
    await writeFile(projectConfigPath, JSON.stringify(projectConfig));

    const config = await loadConfig("/root", {
      userConfigPath,
      projectConfigPath,
    });
    const skills = resolveStageForceSkills(config, "discovery", DEV_CYCLE);
    expect(skills).toEqual([MY_SKILL]);
  });

  it("project stageSkills.discovery.inject overrides DEV_CYCLE", async () => {
    const projectConfig = {
      stageSkills: {
        discovery: { inject: [MY_SKILL] },
      },
    };
    await writeFile(projectConfigPath, JSON.stringify(projectConfig));

    const config = await loadConfig("/root", {
      userConfigPath,
      projectConfigPath,
    });
    const skills = resolveStageInjectSkills(config, "discovery", DEV_CYCLE);
    expect(skills).toEqual([MY_SKILL]);
  });

  it("override with empty array [] suppresses the default (empty is 'set')", async () => {
    const projectConfig = {
      stageSkills: {
        // discovery normally has a forceSkill; explicit [] should win
        discovery: { force: [] },
      },
    };
    await writeFile(projectConfigPath, JSON.stringify(projectConfig));

    const config = await loadConfig("/root", {
      userConfigPath,
      projectConfigPath,
    });
    const skills = resolveStageForceSkills(config, "discovery", DEV_CYCLE);
    expect(skills).toEqual([]);
  });

  it("stages not in the override continue to use DEV_CYCLE defaults", async () => {
    const projectConfig = {
      stageSkills: {
        discovery: { force: [MY_SKILL] },
        // spec stage not overridden
      },
    };
    await writeFile(projectConfigPath, JSON.stringify(projectConfig));

    const config = await loadConfig("/root", {
      userConfigPath,
      projectConfigPath,
    });
    // spec stage should still use DEV_CYCLE default
    const specSkills = resolveStageForceSkills(config, "spec", DEV_CYCLE);
    expect(specSkills).toEqual([
      { source: "corpus", id: "corpus-spec-driven-development" },
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (3) Project beats user for the same stage
// ─────────────────────────────────────────────────────────────────────────────

describe("loadConfig — project beats user precedence", () => {
  it("project stageSkills entry wins over user entry for the same stage", async () => {
    const userConfig = {
      stageSkills: { discovery: { force: [USER_SKILL] } },
    };
    const projectConfig = {
      stageSkills: { discovery: { force: [PROJECT_SKILL] } },
    };
    await writeFile(userConfigPath, JSON.stringify(userConfig));
    await writeFile(projectConfigPath, JSON.stringify(projectConfig));

    const config = await loadConfig("/root", { userConfigPath, projectConfigPath });
    const skills = resolveStageForceSkills(config, "discovery", DEV_CYCLE);
    expect(skills).toEqual([PROJECT_SKILL]);
  });

  it("user entry is kept when project does not override that stage", async () => {
    const userConfig = {
      stageSkills: {
        analysis: { force: [USER_SKILL] },
      },
    };
    const projectConfig = {
      stageSkills: {
        discovery: { force: [PROJECT_SKILL] },
        // analysis NOT overridden in project
      },
    };
    await writeFile(userConfigPath, JSON.stringify(userConfig));
    await writeFile(projectConfigPath, JSON.stringify(projectConfig));

    const config = await loadConfig("/root", { userConfigPath, projectConfigPath });
    // project wins discovery
    expect(resolveStageForceSkills(config, "discovery", DEV_CYCLE)).toEqual([
      PROJECT_SKILL,
    ]);
    // user entry for analysis is preserved (project didn't override it)
    expect(resolveStageForceSkills(config, "analysis", DEV_CYCLE)).toEqual([
      USER_SKILL,
    ]);
  });

  it("project cycle beats user cycle wholesale", async () => {
    const specStageOnly = {
      id: "mini-cycle",
      name: "Mini",
      stages: [
        {
          id: "spec",
          name: "Spec",
          forceSkills: [MY_SKILL],
          injectSkills: [],
          entryAllowed: true,
        },
      ],
    };
    const userConfig = { cycle: DEV_CYCLE };
    const projectConfig = { cycle: specStageOnly };
    await writeFile(userConfigPath, JSON.stringify(userConfig));
    await writeFile(projectConfigPath, JSON.stringify(projectConfig));

    const config = await loadConfig("/root", { userConfigPath, projectConfigPath });
    // project cycle wins — spec stage uses project's MY_SKILL
    expect(resolveStageForceSkills(config, "spec", DEV_CYCLE)).toEqual([MY_SKILL]);
  });

  it("project roles entry wins over user entry for the same role", async () => {
    const userConfig = { roles: { surveyor: { model: "sonnet" } } };
    const projectConfig = { roles: { surveyor: { model: "haiku" } } };
    await writeFile(userConfigPath, JSON.stringify(userConfig));
    await writeFile(projectConfigPath, JSON.stringify(projectConfig));

    const config = await loadConfig("/root", { userConfigPath, projectConfigPath });
    const resolved = resolveRole(config, "surveyor", SURVEYOR);
    expect(resolved?.model).toBe("haiku");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (4) Malformed config is skipped, not thrown
// ─────────────────────────────────────────────────────────────────────────────

describe("loadConfig — malformed config files are skipped", () => {
  it("does not throw when project config is invalid JSON", async () => {
    await writeFile(projectConfigPath, "this is {{{ not json");
    await expect(
      loadConfig("/root", { userConfigPath, projectConfigPath }),
    ).resolves.toBeDefined();
  });

  it("returns empty config when only project config exists and is invalid JSON", async () => {
    await writeFile(projectConfigPath, "{ broken json");
    const config = await loadConfig("/root", { userConfigPath, projectConfigPath });
    expect(config).toEqual({});
  });

  it("does not throw when user config is invalid JSON", async () => {
    await writeFile(userConfigPath, "[ bad json }");
    await expect(
      loadConfig("/root", { userConfigPath, projectConfigPath }),
    ).resolves.toBeDefined();
  });

  it("returns empty config when only user config exists and is invalid JSON", async () => {
    await writeFile(userConfigPath, "not-json-at-all");
    const config = await loadConfig("/root", { userConfigPath, projectConfigPath });
    expect(config).toEqual({});
  });

  it("skips a project config that fails schema decode (wrong shape)", async () => {
    // `model` accepts only "sonnet"|"haiku" — "opus" is a decode failure
    const badConfig = { roles: { surveyor: { model: "opus" } } };
    await writeFile(projectConfigPath, JSON.stringify(badConfig));
    const config = await loadConfig("/root", { userConfigPath, projectConfigPath });
    // Bad project config skipped; user config also absent → empty
    expect(config).toEqual({});
  });

  it("uses valid user config even when project config is malformed", async () => {
    const userConfig = { stageSkills: { discovery: { force: [MY_SKILL] } } };
    await writeFile(userConfigPath, JSON.stringify(userConfig));
    await writeFile(projectConfigPath, "{ bad }");

    const config = await loadConfig("/root", { userConfigPath, projectConfigPath });
    // User config is valid and loaded; project is skipped
    const skills = resolveStageForceSkills(config, "discovery", DEV_CYCLE);
    expect(skills).toEqual([MY_SKILL]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (5) resolveRole — model "haiku" merges over a base role
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveRole", () => {
  it("merges model haiku over the base Surveyor role", () => {
    const config: HimaConfig = {
      roles: { surveyor: { model: "haiku" } },
    };
    const resolved = resolveRole(config, "surveyor", SURVEYOR);
    expect(resolved).not.toBeUndefined();
    expect(resolved?.model).toBe("haiku");
  });

  it("preserves all other base role fields when merging model", () => {
    const config: HimaConfig = {
      roles: { surveyor: { model: "haiku" } },
    };
    const resolved = resolveRole(config, "surveyor", SURVEYOR);
    expect(resolved?.name).toBe(SURVEYOR.name);
    expect(resolved?.mission).toBe(SURVEYOR.mission);
    expect(resolved?.roleId).toBe(SURVEYOR.roleId);
    expect(resolved?.isAdversarial).toBe(SURVEYOR.isAdversarial);
    expect(resolved?.forcedSkills).toEqual(SURVEYOR.forcedSkills);
    expect(resolved?.stages).toEqual(SURVEYOR.stages);
  });

  it("merges forcedSkills override over base role", () => {
    const config: HimaConfig = {
      roles: { surveyor: { forcedSkills: [MY_SKILL] } },
    };
    const resolved = resolveRole(config, "surveyor", SURVEYOR);
    expect(resolved?.forcedSkills).toEqual([MY_SKILL]);
    // model unchanged
    expect(resolved?.model).toBe(SURVEYOR.model);
  });

  it("merges stages override over base role", () => {
    const config: HimaConfig = {
      roles: { surveyor: { stages: ["impl", "test"] } },
    };
    const resolved = resolveRole(config, "surveyor", SURVEYOR);
    expect(resolved?.stages).toEqual(["impl", "test"]);
  });

  it("returns baseRole unchanged when no override exists for the role", () => {
    const config: HimaConfig = {};
    const resolved = resolveRole(config, "surveyor", SURVEYOR);
    expect(resolved).toBe(SURVEYOR); // same reference
  });

  it("returns undefined when baseRole is not provided", () => {
    const config: HimaConfig = {
      roles: { surveyor: { model: "haiku" } },
    };
    expect(resolveRole(config, "surveyor")).toBeUndefined();
  });

  it("returns undefined when neither baseRole nor override exist", () => {
    const config: HimaConfig = {};
    expect(resolveRole(config, "unknown-role")).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveStageForceSkills — config.cycle fallback path
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveStageForceSkills — config.cycle override", () => {
  it("uses config.cycle stage forceSkills when stageSkills has no force entry", () => {
    const config: HimaConfig = {
      cycle: {
        id: "custom",
        name: "Custom",
        stages: [
          {
            id: "discovery",
            name: "Discovery",
            forceSkills: [MY_SKILL],
            injectSkills: [],
            entryAllowed: true,
          },
        ],
      },
    };
    const skills = resolveStageForceSkills(config, "discovery", DEV_CYCLE);
    expect(skills).toEqual([MY_SKILL]);
  });

  it("stageSkills.force wins over config.cycle stage forceSkills", () => {
    const config: HimaConfig = {
      stageSkills: { discovery: { force: [PROJECT_SKILL] } },
      cycle: {
        id: "custom",
        name: "Custom",
        stages: [
          {
            id: "discovery",
            name: "Discovery",
            forceSkills: [MY_SKILL],
            injectSkills: [],
            entryAllowed: true,
          },
        ],
      },
    };
    // stageSkills.force takes priority over config.cycle
    const skills = resolveStageForceSkills(config, "discovery", DEV_CYCLE);
    expect(skills).toEqual([PROJECT_SKILL]);
  });
});
