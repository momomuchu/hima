import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import {
  computeRuntimeProfileDigest,
  DEFAULT_EVIDENCE_KEY,
  DEFAULT_EVIDENCE_STATUS,
  DEFAULT_RUNTIME_CAPABILITY_STATUS,
  GATE_TYPES,
  getOperationalCatalog,
  getRuntimeProfile,
  initProject,
  RISK_CLASS_RANK,
  RISK_POLICY,
  readPlanningProject,
  toHookCommand,
  writePlanningProject,
} from "@harness/core";
import { runCommand } from "citty";
import { describe, expect, it } from "vitest";
import {
  createDoctorReport,
  formatCatalogArtifactsPlanHuman,
  formatCatalogHuman,
  formatCloseRunHuman,
  formatConvergenceHuman,
  formatDoctorHuman,
  formatEnterDevelopmentHuman,
  formatEvidenceAddedHuman,
  formatHookResponseForClaude,
  formatHookResponseForCodex,
  formatInstallHuman,
  formatRiskClassHuman,
  formatRollbackArtifactsPlanHuman,
  formatRuntimeBindHuman,
  formatRuntimeDigestHuman,
  formatRuntimeInspectHuman,
  formatStatusHuman,
  generateCatalogArtifactsPlan,
  getCliCommandSurface,
  main,
  parseEvidenceAddArgs,
  parseHookEvent,
  parseRiskClassifyArgs,
  parseRuntimeHooksJson,
} from "../src/index.js";

function markdownSection(markdown: string, heading: string): string {
  const start = markdown.indexOf(heading);
  expect(start).toBeGreaterThanOrEqual(0);

  const remainder = markdown.slice(start);
  const nextHeadingMatch = /\n##\s/.exec(remainder.slice(heading.length));

  return nextHeadingMatch === null
    ? remainder
    : remainder.slice(0, heading.length + nextHeadingMatch.index);
}

function backtickedFirstColumnValues(markdownTableSection: string): string[] {
  return [...markdownTableSection.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map((match) => match[1]);
}

describe("CLI hook event parsing", () => {
  it("accepts runtime adapter event names", () => {
    expect(parseHookEvent("session-start")).toBe("session_start");
    expect(parseHookEvent("SessionStart")).toBe("session_start");
    expect(parseHookEvent("pre_tool_use")).toBe("pre_tool");
    expect(parseHookEvent("pre-tool-use")).toBe("pre_tool");
    expect(parseHookEvent("PreToolUse")).toBe("pre_tool");
    expect(parseHookEvent("pre_tool_call")).toBe("pre_tool");
    expect(parseHookEvent("post_tool_use")).toBe("post_tool");
    expect(parseHookEvent("post-tool-use")).toBe("post_tool");
    expect(parseHookEvent("PostToolUse")).toBe("post_tool");
    expect(parseHookEvent("user_prompt_submit")).toBe("user_prompt");
    expect(parseHookEvent("user-prompt-submit")).toBe("user_prompt");
    expect(parseHookEvent("UserPromptSubmit")).toBe("user_prompt");
    expect(parseHookEvent("pre_llm_call")).toBe("user_prompt");
    expect(parseHookEvent("subagent_start")).toBe("subagent_start");
    expect(parseHookEvent("subagent-start")).toBe("subagent_start");
    expect(parseHookEvent("SubagentStart")).toBe("subagent_start");
    expect(parseHookEvent("subagent_stop")).toBe("subagent_stop");
    expect(parseHookEvent("subagent-stop")).toBe("subagent_stop");
    expect(parseHookEvent("SubagentStop")).toBe("subagent_stop");
  });

  it("still accepts canonical gate types", () => {
    expect(parseHookEvent("pre_tool")).toBe("pre_tool");
    expect(parseHookEvent("stop")).toBe("stop");
  });

  it("rejects unknown event names", () => {
    expect(() => parseHookEvent("before_write")).toThrow("Unknown hook event");
  });
});

describe("CLI executable surface contract", () => {
  it("keeps the conception CLI spec synchronized with the exported command surface", async () => {
    const surface = getCliCommandSurface();
    const commandNames = surface.map((entry) => entry.command);
    const spec = await readFile(
      new URL("../../../docs/conception/09-cli-commands-spec.md", import.meta.url),
      "utf8",
    );
    const documentedCommands = backtickedFirstColumnValues(
      markdownSection(spec, "## 2. Command Surface"),
    );

    expect(documentedCommands).toEqual(commandNames);
    expect(new Set(documentedCommands).size).toBe(documentedCommands.length);

    for (const entry of surface) {
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });
});

describe("CLI hook command surface", () => {
  it("formats user_prompt hook responses for Codex without internal HIMA fields", () => {
    const result = formatHookResponseForCodex("user_prompt", {
      decision: "allow",
      gateType: "user_prompt",
      reason: "allowed",
      contextInjection: "CTX",
      failOpen: false,
    });

    expect(result).toEqual({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: "CTX",
      },
    });
    expect(result).not.toHaveProperty("decision");
    expect(result).not.toHaveProperty("gateType");
    expect(result).not.toHaveProperty("failOpen");
    expect(result).not.toHaveProperty("contextInjection");
  });

  it("formats allowed pre_tool hook responses for Codex as an empty allow", () => {
    const result = formatHookResponseForCodex("pre_tool", {
      decision: "allow",
      gateType: "pre_tool",
      reason: "allowed",
      failOpen: false,
    });

    expect(result).toEqual({});
  });

  it("formats blocked pre_tool hook responses for Codex", () => {
    const result = formatHookResponseForCodex("pre_tool", {
      decision: "block",
      gateType: "pre_tool",
      reason: "blocked",
      violationType: "FORBIDDEN_WRITE_ZONE",
      finalState: "BLOCKED_POLICY",
      failOpen: false,
    });

    expect(result).toEqual({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "blocked",
      },
    });
  });

  it("formats allowed Stop hook responses for Codex as empty JSON", () => {
    const result = formatHookResponseForCodex("stop", {
      decision: "allow",
      gateType: "stop",
      reason: "stop allowed",
      finalState: "DONE_VERIFIED",
      failOpen: false,
    });

    expect(result).toEqual({});
  });

  it("formats user_prompt hook responses for Claude Code without internal HIMA fields", () => {
    const result = formatHookResponseForClaude("user_prompt", {
      decision: "allow",
      gateType: "user_prompt",
      reason: "allowed",
      contextInjection: "CTX",
      failOpen: false,
    });

    expect(result).toEqual({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: "CTX",
      },
    });
    expect(result).not.toHaveProperty("continue");
    expect(result).not.toHaveProperty("decision");
    expect(result).not.toHaveProperty("gateType");
    expect(result).not.toHaveProperty("failOpen");
    expect(result).not.toHaveProperty("contextInjection");
  });

  it("formats blocked pre_tool hook responses for Claude Code", () => {
    const result = formatHookResponseForClaude("pre_tool", {
      decision: "block",
      gateType: "pre_tool",
      reason: "blocked",
      violationType: "FORBIDDEN_WRITE_ZONE",
      finalState: "BLOCKED_POLICY",
      failOpen: false,
    });

    expect(result).toEqual({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "blocked",
      },
    });
    expect(result).not.toHaveProperty("continue");
    expect(result).not.toHaveProperty("decision");
    expect(result).not.toHaveProperty("reason");
    expect(result).not.toHaveProperty("stopReason");
    expect(result).not.toHaveProperty("gateType");
    expect(result).not.toHaveProperty("failOpen");
    expect(result).not.toHaveProperty("violationType");
    expect(result).not.toHaveProperty("finalState");
  });

  it("formats blocked Stop hook responses with top-level Claude Code decision", () => {
    const result = formatHookResponseForClaude("stop", {
      decision: "block",
      gateType: "stop",
      reason: "missing evidence",
      failOpen: false,
    });

    expect(result).toEqual({
      decision: "block",
      reason: "missing evidence",
    });
    expect(result).not.toHaveProperty("continue");
    expect(result).not.toHaveProperty("stopReason");
  });

  it("prints Claude Code hook JSON through the hook command format flag", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-hook-claude-"));

    try {
      await initProject(root);

      const output = await runCommandWithStdin(
        ["hook", "user-prompt-submit", "--root", root, "--dryRun", "--format", "claude"],
        { promptContent: "normal request" },
      );
      const result = JSON.parse(output);

      expect(result).toMatchObject({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: expect.any(String),
        },
      });
      expect(result).not.toHaveProperty("continue");
      expect(result).not.toHaveProperty("decision");
      expect(result).not.toHaveProperty("gateType");
      expect(result).not.toHaveProperty("failOpen");
      expect(result).not.toHaveProperty("contextInjection");
      expect((await readPlanningProject(root)).runSet.events).toHaveLength(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("prints Codex hook JSON through the hook command format flag", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-hook-codex-"));

    try {
      await initProject(root);

      const output = await runCommandWithStdin(
        ["hook", "user-prompt-submit", "--root", root, "--dryRun", "--format", "codex"],
        { promptContent: "normal request" },
      );
      const result = JSON.parse(output);

      expect(result).toMatchObject({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: expect.any(String),
        },
      });
      expect(result).not.toHaveProperty("decision");
      expect(result).not.toHaveProperty("gateType");
      expect(result).not.toHaveProperty("failOpen");
      expect(result).not.toHaveProperty("contextInjection");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("evaluates dry-run hook JSON from stdin without persisting GATE_EVALUATED", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-hook-dry-"));

    try {
      await initProject(root);

      const output = await runCommandWithStdin(
        ["hook", "session-start", "--root", root, "--dryRun"],
        { metadata: { source: "test" } },
      );
      const result = JSON.parse(output);
      const project = await readPlanningProject(root);

      expect(result).toMatchObject({
        decision: "allow",
        gateType: "session_start",
        failOpen: false,
      });
      expect(project.runSet.events).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ type: "GATE_EVALUATED" })]),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("persists GATE_EVALUATED for non-dry-run hook JSON from stdin", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-hook-apply-"));

    try {
      await initProject(root);

      const output = await runCommandWithStdin(["hook", "pre-tool-use", "--root", root], {
        toolName: "read_file",
        toolInput: { path: "packages/cli/src/index.ts" },
      });
      const result = JSON.parse(output);
      const project = await readPlanningProject(root);

      expect(result).toMatchObject({
        decision: "allow",
        gateType: "pre_tool",
        failOpen: false,
      });
      expect(project.runSet.events.at(-1)).toMatchObject({
        type: "GATE_EVALUATED",
        gateType: "pre_tool",
        decision: "allow",
        payload: {
          toolName: "read_file",
          toolInputPreview: expect.stringContaining("packages/cli/src/index.ts"),
        },
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails invalid JSON from stdin", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-hook-invalid-json-"));

    try {
      await initProject(root);

      await expect(
        runCommandWithRawStdin(["hook", "session-start", "--root", root], "{"),
      ).rejects.toThrow();
      expect((await readPlanningProject(root)).runSet.events).toHaveLength(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails oversized hook stdin before writing events", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-hook-oversized-"));

    try {
      await initProject(root);

      await expect(
        runCommandWithRawStdin(
          ["hook", "session-start", "--root", root],
          JSON.stringify({ metadata: { value: "a".repeat(1024 * 1024) } }),
        ),
      ).rejects.toThrow("Hook stdin exceeds");
      expect((await readPlanningProject(root)).runSet.events).toHaveLength(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails invalid hook payloads from stdin", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-hook-invalid-payload-"));

    try {
      await initProject(root);

      await expect(
        runCommandWithStdin(["hook", "session-start", "--root", root], {
          metadata: "not an object",
        }),
      ).rejects.toThrow();
      expect((await readPlanningProject(root)).runSet.events).toHaveLength(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("maps canonical and adapter event names through runCommand", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-hook-mapping-"));

    try {
      await initProject(root);

      const canonicalOutput = await runCommandWithStdin(
        ["hook", "user_prompt", "--root", root, "--dryRun"],
        { promptContent: "normal request" },
      );
      const adapterOutput = await runCommandWithStdin(
        ["hook", "PreToolUse", "--root", root, "--dryRun"],
        { toolName: "read_file", toolInput: { path: "README.md" } },
      );

      expect(JSON.parse(canonicalOutput)).toMatchObject({
        decision: "allow",
        gateType: "user_prompt",
      });
      expect(JSON.parse(adapterOutput)).toMatchObject({
        decision: "allow",
        gateType: "pre_tool",
      });
      expect((await readPlanningProject(root)).runSet.events).toHaveLength(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

function operationalHookArtifacts() {
  return getOperationalCatalog().hooks;
}

describe("CLI human formatters", () => {
  it("formats status with explicit blocker fallback", () => {
    expect(
      formatStatusHuman({
        phase: "build",
        subPhase: "Execute",
        riskClass: "L",
        mode: "auto",
        runId: "run_1",
        evidenceCount: 2,
        blockers: [],
      }),
    ).toContain("Blockers   : none");
  });

  it("reports project checks and exported install services", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-"));

    try {
      await initProject(root);
      const report = await createDoctorReport(root, "codex");
      const output = formatDoctorHuman(report);

      expect(report.ok).toBe(true);
      expect(report.warnings).toBeGreaterThan(0);
      expect(output).toContain("Installation");
      expect(output).toContain("platform install services");
      expect(output).toContain("exported by @harness/core");
      expect(output).toContain("Project");
      expect(output).toContain("state.yaml");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("formats platform install planning results", () => {
    expect(
      formatInstallHuman({
        target: "codex",
        dryRun: true,
        manifestWritten: false,
        expectedPaths: {
          projectRoot: "C:\\repo",
          platformDirectory: "C:\\repo\\.codex",
          hooksDirectory: "C:\\repo\\.codex\\hooks",
          manifestFile: "C:\\repo\\.planning\\install-manifest.json",
        },
        plannedActions: [
          {
            kind: "ensure_directory",
            path: "C:\\repo\\.codex",
            dryRun: true,
            description: "Plan codex platform directory creation.",
          },
        ],
        checks: [],
        warnings: ["Dry-run mode: platform files will not be created."],
      }),
    ).toContain("Install target : codex");
  });

  it("formats catalog and runtime digest inspection output", () => {
    expect(formatCatalogHuman(getOperationalCatalog())).toContain("Operational catalog");
    expect(
      formatRuntimeDigestHuman({
        target: "codex",
        runtimeVersion: getRuntimeProfile("codex").runtimeVersion,
        digest: computeRuntimeProfileDigest("codex"),
      }),
    ).toContain("Runtime version : codex-profile-v1");
  });

  it("formats convergence, close, and runtime command output", () => {
    const digest = computeRuntimeProfileDigest("codex");

    expect(
      formatConvergenceHuman({
        score: 100,
        status: "verified",
        blockers: [],
        gaps: [],
        evidenceSufficiency: {
          sufficient: true,
          riskClass: "M",
          presentEvidenceKeys: [],
          missingEvidenceKeys: [],
          reason: "sufficient",
        },
        runtimeBindingHealth: {
          healthy: true,
          requiredGates: [],
          assessments: [],
          gaps: [],
        },
        finalizationRecommendation: {
          finalState: "DONE_VERIFIED",
          runSetState: "DONE_VERIFIED",
          reason: "ready",
        },
      }),
    ).toContain("FinalState : DONE_VERIFIED");
    expect(
      formatCloseRunHuman({
        evaluation: {
          score: 100,
          status: "verified",
          blockers: [],
          gaps: [],
          evidenceSufficiency: {
            sufficient: true,
            riskClass: "M",
            presentEvidenceKeys: [],
            missingEvidenceKeys: [],
            reason: "sufficient",
          },
          runtimeBindingHealth: {
            healthy: true,
            requiredGates: [],
            assessments: [],
            gaps: [],
          },
          finalizationRecommendation: {
            finalState: "DONE_VERIFIED",
            runSetState: "DONE_VERIFIED",
            reason: "ready",
          },
        },
        runSet: {} as never,
        event: {
          id: "close-1",
          ts: "2026-05-03T00:00:00.000Z",
          type: "RUN_CLOSED",
          decision: "allow",
        },
      }),
    ).toContain("Decision   : allow");
    expect(
      formatRuntimeInspectHuman({
        target: "codex",
        runtimeName: "codex",
        runtimeVersion: getRuntimeProfile("codex").runtimeVersion,
        status: DEFAULT_RUNTIME_CAPABILITY_STATUS,
        inspectedAt: "2026-05-03T00:00:00.000Z",
        configDigest: digest,
        hooks: {},
        knownLimitations: [],
      }),
    ).toContain("Runtime ver.");
    expect(
      formatRuntimeBindHuman({
        pre_tool: {
          gateType: "pre_tool",
          target: "codex",
          status: "native",
          nativeEvent: "PreToolUse",
          canBlock: true,
          inspectedAt: "2026-05-03T00:00:00.000Z",
          runtimeVersion: getRuntimeProfile("codex").runtimeVersion,
          configDigest: digest,
          reason: "bound",
        },
      } as never),
    ).toContain("Native gates   : 1");
  });
});

describe("CLI install and inspection commands", () => {
  it("keeps install dry-run read-only by default", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-install-"));

    try {
      await captureConsole(() =>
        runCommand(main, { rawArgs: ["install", "codex", "--root", root] }),
      );

      await expectPathMissing(path.join(root, ".codex", "config.toml"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not apply adapter config when only writing the manifest", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-manifest-"));

    try {
      await captureConsole(() =>
        runCommand(main, { rawArgs: ["install", "codex", "--root", root, "--writeManifest"] }),
      );

      await expectPathMissing(path.join(root, ".codex", "config.toml"));
      await expectPathPresent(path.join(root, ".planning", "install-manifest.json"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("applies adapter config only with explicit opt-in", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-apply-"));

    try {
      const output = await captureConsole(() =>
        runCommand(main, { rawArgs: ["install", "codex", "--root", root, "--apply"] }),
      );
      const configFile = path.join(root, ".codex", "config.toml");

      await expectPathPresent(configFile);
      expect(await readFile(configFile, "utf8")).toContain("codex_hooks = true");
      expect(output).toContain("Applied target : codex");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("uninstalls and repairs managed platform hooks from the install manifest", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-platform-lifecycle-"));

    try {
      await captureConsole(() =>
        runCommand(main, {
          rawArgs: ["install", "codex", "--root", root, "--apply", "--writeManifest", "--json"],
        }),
      );

      const configFile = path.join(root, ".codex", "config.toml");
      const uninstallOutput = await captureConsole(() =>
        runCommand(main, {
          rawArgs: ["uninstall-platform", "--root", root, "--apply", "--json"],
        }),
      );
      const uninstallResult = JSON.parse(uninstallOutput);

      expect(uninstallResult).toMatchObject({
        ok: true,
        action: "uninstall",
        apply: true,
        dryRun: false,
        target: "codex",
        hooksRemoved: GATE_TYPES.length - 2,
        manifestRetained: true,
      });
      expect(await readFile(configFile, "utf8")).not.toContain(toHookCommand("pre_tool", "codex"));
      await expectPathPresent(path.join(root, ".planning", "install-manifest.json"));

      const repairOutput = await captureConsole(() =>
        runCommand(main, {
          rawArgs: ["repair-platform", "--root", root, "--apply", "--json"],
        }),
      );
      const repairResult = JSON.parse(repairOutput);

      expect(repairResult).toMatchObject({
        ok: true,
        action: "repair",
        apply: true,
        dryRun: false,
        target: "codex",
        hooksAdded: GATE_TYPES.length - 2,
      });
      expect(await readFile(configFile, "utf8")).toContain(toHookCommand("pre_tool", "codex"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("uses manifest hook commands for Claude apply, uninstall, and repair", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-claude-command-"));
    const hookCommandPrefix = 'node "C:/repo/packages/cli/dist/index.js"';
    const expectedPreToolCommand = `${hookCommandPrefix} hook pre-tool-use --format claude`;

    try {
      await captureConsole(() =>
        runCommand(main, {
          rawArgs: [
            "install",
            "claude",
            "--root",
            root,
            "--apply",
            "--writeManifest",
            "--hookCommandPrefix",
            hookCommandPrefix,
            "--json",
          ],
        }),
      );

      const settingsFile = path.join(root, ".claude", "settings.json");
      const manifestFile = path.join(root, ".planning", "install-manifest.json");
      const settings = JSON.parse(await readFile(settingsFile, "utf8"));
      const manifest = JSON.parse(await readFile(manifestFile, "utf8"));

      expect(settings.hooks.PreToolUse[0].hooks[0].command).toBe(expectedPreToolCommand);
      expect(await readFile(settingsFile, "utf8")).not.toContain(
        toHookCommand("pre_tool", "claude"),
      );
      expect(
        manifest.plannedActions.find(
          (action: { gateType?: string }) => action.gateType === "pre_tool",
        ).command,
      ).toBe(expectedPreToolCommand);

      const uninstallOutput = await captureConsole(() =>
        runCommand(main, {
          rawArgs: ["uninstall-platform", "--root", root, "--apply", "--json"],
        }),
      );
      const uninstallResult = JSON.parse(uninstallOutput);

      expect(uninstallResult.hooksRemoved).toBe(GATE_TYPES.length);
      expect(await readFile(settingsFile, "utf8")).not.toContain(expectedPreToolCommand);

      const repairOutput = await captureConsole(() =>
        runCommand(main, {
          rawArgs: ["repair-platform", "--root", root, "--apply", "--json"],
        }),
      );
      const repairResult = JSON.parse(repairOutput);
      const repairedSettings = JSON.parse(await readFile(settingsFile, "utf8"));

      expect(repairResult.hooksAdded).toBe(GATE_TYPES.length);
      expect(repairedSettings.hooks.PreToolUse[0].hooks[0].command).toBe(expectedPreToolCommand);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps platform uninstall dry-run read-only by default", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-platform-uninstall-dry-"));

    try {
      await captureConsole(() =>
        runCommand(main, {
          rawArgs: ["install", "codex", "--root", root, "--apply", "--writeManifest", "--json"],
        }),
      );
      const configFile = path.join(root, ".codex", "config.toml");
      const before = await readFile(configFile, "utf8");
      const output = await captureConsole(() =>
        runCommand(main, { rawArgs: ["uninstall-platform", "--root", root, "--json"] }),
      );

      expect(JSON.parse(output)).toMatchObject({
        ok: true,
        apply: false,
        dryRun: true,
        hooksRemoved: 0,
      });
      await expect(readFile(configFile, "utf8")).resolves.toBe(before);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("prints lifecycle apply JSON dry-run without writing by default", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-lifecycle-dry-"));

    try {
      const output = await captureConsole(() =>
        runCommand(main, {
          rawArgs: ["lifecycle", "apply", "codex", "--kind", "skills", "--root", root, "--json"],
        }),
      );
      const result = JSON.parse(output);

      expect(result).toMatchObject({
        ok: true,
        operation: "apply",
        apply: false,
        dryRun: true,
        writeManifests: false,
        target: "codex",
        kind: "skills",
        artifactsWritten: [],
      });
      await expectPathMissing(path.join(root, ".planning", "install-manifest.json"));
      await expectPathMissing(path.join(root, ".planning", "artifact-install-manifest.json"));
      await expectPathMissing(path.join(root, ".codex", "config.toml"));
      await expectPathMissing(path.join(root, ".codex", "skills", "classify-risk", "SKILL.md"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("prints lifecycle apply JSON and writes hooks, artifacts, and manifests with --apply", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-lifecycle-apply-"));

    try {
      const output = await captureConsole(() =>
        runCommand(main, {
          rawArgs: [
            "lifecycle",
            "apply",
            "codex",
            "--kind",
            "skills",
            "--root",
            root,
            "--apply",
            "--json",
          ],
        }),
      );
      const result = JSON.parse(output);

      expect(result).toMatchObject({
        ok: true,
        operation: "apply",
        apply: true,
        dryRun: false,
        writeManifests: true,
        target: "codex",
        kind: "skills",
        platformInstall: {
          dryRun: false,
          manifestWritten: true,
        },
        platformApplied: {
          target: "codex",
          hooksAdded: GATE_TYPES.length - 2,
        },
      });
      expect(result.artifactsWritten).toHaveLength(getOperationalCatalog().skills.length);
      await expectPathPresent(path.join(root, ".planning", "install-manifest.json"));
      await expectPathPresent(path.join(root, ".planning", "artifact-install-manifest.json"));
      await expectPathPresent(path.join(root, ".codex", "config.toml"));
      await expectPathPresent(path.join(root, ".codex", "skills", "classify-risk", "SKILL.md"));
      expect(await readFile(path.join(root, ".codex", "config.toml"), "utf8")).toContain(
        toHookCommand("pre_tool", "codex"),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("prints lifecycle uninstall JSON and removes hooks when artifact manifest is missing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-lifecycle-uninstall-missing-"));

    try {
      await captureConsole(() =>
        runCommand(main, {
          rawArgs: ["lifecycle", "apply", "codex", "--root", root, "--apply", "--json"],
        }),
      );
      await rm(path.join(root, ".planning", "artifact-install-manifest.json"));

      const output = await captureConsole(() =>
        runCommand(main, {
          rawArgs: ["lifecycle", "uninstall", "--root", root, "--apply", "--json"],
        }),
      );
      const result = JSON.parse(output);

      expect(result).toMatchObject({
        ok: true,
        operation: "uninstall",
        apply: true,
        dryRun: false,
        target: "codex",
        platformHooksRemoved: GATE_TYPES.length - 2,
        artifactsRestored: [],
        artifactRollback: {
          skipped: true,
        },
        platformRemoved: {
          target: "codex",
          hooksRemoved: GATE_TYPES.length - 2,
        },
      });
      expect(await readFile(path.join(root, ".codex", "config.toml"), "utf8")).not.toContain(
        toHookCommand("pre_tool", "codex"),
      );
    } finally {
      process.exitCode = undefined;
      await rm(root, { recursive: true, force: true });
    }
  });

  it("prints lifecycle uninstall blockers from artifact rollback", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-lifecycle-uninstall-block-"));

    try {
      const applyOutput = await captureConsole(() =>
        runCommand(main, {
          rawArgs: [
            "lifecycle",
            "apply",
            "codex",
            "--kind",
            "hooks",
            "--root",
            root,
            "--apply",
            "--json",
          ],
        }),
      );
      const applyResult = JSON.parse(applyOutput);
      await writeFile(applyResult.artifactsWritten[0], "tampered\n", "utf8");
      const output = await captureConsole(() =>
        runCommand(main, {
          rawArgs: ["lifecycle", "uninstall", "--root", root, "--apply", "--json"],
        }),
      );
      const result = JSON.parse(output);

      expect(result.ok).toBe(false);
      expect(result.blockers.length).toBeGreaterThan(0);
      expect(result.artifactsDeleted).toEqual([]);
      expect(result.artifactsRestored).toEqual([]);
      expect(result.platformRemoved).toBeUndefined();
      expect(await readFile(path.join(root, ".codex", "config.toml"), "utf8")).toContain(
        toHookCommand("pre_tool", "codex"),
      );
    } finally {
      process.exitCode = undefined;
      await rm(root, { recursive: true, force: true });
    }
  });

  it("prints catalog and runtime digest JSON", async () => {
    const catalogOutput = await captureConsole(() =>
      runCommand(main, { rawArgs: ["catalog", "--json"] }),
    );
    const digestOutput = await captureConsole(() =>
      runCommand(main, { rawArgs: ["runtime", "digest", "codex", "--json"] }),
    );

    expect(JSON.parse(catalogOutput)).toMatchObject({
      skills: expect.any(Array),
      hooks: expect.any(Array),
      subagents: expect.any(Array),
    });
    expect(JSON.parse(digestOutput)).toEqual({
      target: "codex",
      runtimeVersion: getRuntimeProfile("codex").runtimeVersion,
      digest: computeRuntimeProfileDigest("codex"),
    });
  });

  it("plans artifact generation without writing by default", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-artifacts-"));

    try {
      const output = await captureConsole(() =>
        runCommand(main, {
          rawArgs: ["artifacts", "--kind", "skills", "--base-dir", root, "--json"],
        }),
      );
      process.exitCode = undefined;

      expect(JSON.parse(output)).toMatchObject({
        ok: true,
        kind: "skills",
        baseDir: root,
        dryRun: true,
        apply: false,
        artifactsPlanned: getOperationalCatalog().skills.length,
        artifactsWritten: [],
      });
      await expectPathMissing(path.join(root, "artifacts", "skills", "classify-risk", "SKILL.md"));
    } finally {
      process.exitCode = undefined;
      await rm(root, { recursive: true, force: true });
    }
  });

  it("writes selected catalog artifacts only with --apply", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-artifacts-apply-"));

    try {
      const output = await captureConsole(() =>
        runCommand(main, {
          rawArgs: ["artifacts", "--kind", "hooks", "--base-dir", root, "--apply", "--json"],
        }),
      );
      const result = JSON.parse(output);

      expect(result).toMatchObject({
        ok: true,
        kind: "hooks",
        dryRun: false,
        apply: true,
        artifactsPlanned: operationalHookArtifacts().length,
      });
      await expectPathPresent(result.artifactsWritten[0]);
      await expectPathMissing(path.join(root, "artifacts", "skills", "classify-risk", "SKILL.md"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("prints install-artifacts JSON dry-run without writing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-install-artifacts-dry-"));

    try {
      const output = await captureConsole(() =>
        runCommand(main, {
          rawArgs: ["install-artifacts", "codex", "--kind", "skills", "--root", root, "--json"],
        }),
      );
      const result = JSON.parse(output);

      expect(result).toMatchObject({
        ok: true,
        target: "codex",
        kind: "skills",
        projectRoot: path.resolve(root),
        platformDirectory: path.join(path.resolve(root), ".codex"),
        dryRun: true,
        apply: false,
        artifactsPlanned: getOperationalCatalog().skills.length,
        artifactsWritten: [],
      });
      await expectPathMissing(path.join(root, ".codex", "skills", "classify-risk", "SKILL.md"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("prints install-artifacts JSON apply with selected writes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-install-artifacts-apply-"));

    try {
      const output = await captureConsole(() =>
        runCommand(main, {
          rawArgs: [
            "install-artifacts",
            "claude",
            "--kind",
            "subagents",
            "--root",
            root,
            "--apply",
            "--json",
          ],
        }),
      );
      const result = JSON.parse(output);

      expect(result).toMatchObject({
        ok: true,
        target: "claude",
        kind: "subagents",
        projectRoot: path.resolve(root),
        platformDirectory: path.join(path.resolve(root), ".claude"),
        dryRun: false,
        apply: true,
        writeManifest: false,
        captureRestoreSnapshots: false,
        artifactsPlanned: getOperationalCatalog().subagents.length,
      });
      expect(result.artifactsWritten).toHaveLength(getOperationalCatalog().subagents.length);
      await expectPathPresent(path.join(root, ".claude", "agents", "reviewer.md"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("writes install-artifacts manifest only when explicitly requested with apply", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-install-artifacts-manifest-"));

    try {
      const output = await captureConsole(() =>
        runCommand(main, {
          rawArgs: [
            "install-artifacts",
            "codex",
            "--kind",
            "hooks",
            "--root",
            root,
            "--apply",
            "--writeManifest",
            "--json",
          ],
        }),
      );
      const result = JSON.parse(output);
      const manifestFile = path.join(root, ".planning", "artifact-install-manifest.json");

      expect(result).toMatchObject({
        ok: true,
        target: "codex",
        kind: "hooks",
        dryRun: false,
        apply: true,
        writeManifest: true,
        captureRestoreSnapshots: false,
        manifestFile,
        manifest: {
          schemaVersion: 1,
          target: "codex",
          selection: "hooks",
          writtenCount: operationalHookArtifacts().length,
        },
      });
      await expectPathPresent(manifestFile);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("captures managed restore snapshots for install-artifacts only when explicitly requested", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-install-artifacts-snapshots-"));
    const artifactPath = path.join(root, ".codex", "hooks", "gate-policy.md");
    const previousContent = [
      "<!-- HIMA:CATALOG-ARTIFACT kind=hook id=gate-policy source=operational-catalog -->",
      "",
      "# Previous managed content",
      "",
    ].join("\n");

    try {
      await mkdir(path.dirname(artifactPath), { recursive: true });
      await writeFile(artifactPath, previousContent, "utf8");
      const output = await captureConsole(() =>
        runCommand(main, {
          rawArgs: [
            "install-artifacts",
            "codex",
            "--kind",
            "hooks",
            "--root",
            root,
            "--apply",
            "--writeManifest",
            "--captureRestoreSnapshots",
            "--json",
          ],
        }),
      );
      const result = JSON.parse(output);
      const gatePolicyEntry = result.manifest.entries.find(
        (entry: { readonly id: string }) => entry.id === "gate-policy",
      );

      expect(result).toMatchObject({
        ok: true,
        captureRestoreSnapshots: true,
      });
      expect(gatePolicyEntry.rollback.restoreSnapshot).toMatchObject({
        encoding: "utf8",
        content: previousContent,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("prints rollback-artifacts JSON dry-run without deleting installed artifacts", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-rollback-artifacts-dry-"));

    try {
      const applyOutput = await captureConsole(() =>
        runCommand(main, {
          rawArgs: [
            "install-artifacts",
            "codex",
            "--kind",
            "hooks",
            "--root",
            root,
            "--apply",
            "--writeManifest",
            "--json",
          ],
        }),
      );
      const artifactPath = JSON.parse(applyOutput).artifactsWritten[0];
      const output = await captureConsole(() =>
        runCommand(main, {
          rawArgs: ["rollback-artifacts", "--root", root, "--json"],
        }),
      );
      const result = JSON.parse(output);

      expect(result).toMatchObject({
        ok: true,
        apply: false,
        dryRun: true,
        target: "codex",
        projectRoot: path.resolve(root),
        platformDirectory: path.join(path.resolve(root), ".codex"),
        manifestFile: path.join(path.resolve(root), ".planning", "artifact-install-manifest.json"),
        actionsPlanned: operationalHookArtifacts().length,
        artifactsPlanned: operationalHookArtifacts().length,
        deletedPaths: [],
        restoredPaths: [],
        artifactsDeleted: 0,
        artifactsRestored: 0,
        blockers: [],
      });
      await expectPathPresent(artifactPath);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("prints rollback-artifacts JSON apply and deletes matching artifacts", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-rollback-artifacts-apply-"));

    try {
      const applyOutput = await captureConsole(() =>
        runCommand(main, {
          rawArgs: [
            "install-artifacts",
            "codex",
            "--kind",
            "hooks",
            "--root",
            root,
            "--apply",
            "--writeManifest",
            "--json",
          ],
        }),
      );
      const artifactPath = JSON.parse(applyOutput).artifactsWritten[0];
      const output = await captureConsole(() =>
        runCommand(main, {
          rawArgs: ["rollback-artifacts", "--root", root, "--apply", "--json"],
        }),
      );
      const result = JSON.parse(output);

      expect(result).toMatchObject({
        ok: true,
        apply: true,
        dryRun: false,
        target: "codex",
        artifactsDeleted: operationalHookArtifacts().length,
        artifactsRestored: 0,
        blockers: [],
      });
      expect(result.deletedPaths).toContain(artifactPath);
      expect(result.actions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: artifactPath,
            status: "deleted",
          }),
        ]),
      );
      await expectPathMissing(artifactPath);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps artifact planning dry-run by default", async () => {
    const plan = await generateCatalogArtifactsPlan({ baseDir: "C:\\repo" });
    const human = formatCatalogArtifactsPlanHuman(plan);

    expect(plan).toMatchObject({
      ok: true,
      kind: "all",
      baseDir: "C:\\repo",
      dryRun: true,
      apply: false,
    });
    expect(human).toContain("Mode      : dry-run");
  });

  it("formats rollback artifact planning for humans", () => {
    expect(
      formatRollbackArtifactsPlanHuman({
        ok: true,
        root: "C:\\repo",
        projectRoot: "C:\\repo",
        target: "codex",
        platformDirectory: "C:\\repo\\.codex",
        manifestFile: "C:\\repo\\.planning\\artifact-install-manifest.json",
        dryRun: true,
        apply: false,
        actions: [],
        blockers: [],
        actionsPlanned: 0,
        artifactsPlanned: 0,
        deletedPaths: [],
        restoredPaths: [],
        artifactsDeleted: 0,
        artifactsRestored: 0,
        result: {
          deletedPaths: [],
          restoredPaths: [],
          dryRun: true,
          projectRoot: "C:\\repo",
          manifestFile: "C:\\repo\\.planning\\artifact-install-manifest.json",
          target: "codex",
          platformDirectory: "C:\\repo\\.codex",
          actions: [],
          blockers: [],
        },
      }),
    ).toContain("Rollback artifacts");
  });

  it("enters governed development mode from the CLI", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-enter-"));

    try {
      await initProject(root);

      const output = await captureConsole(() =>
        runCommand(main, {
          rawArgs: [
            "enter",
            "--root",
            root,
            "--mode",
            "pairing",
            "--riskClass",
            "H",
            "--objective",
            "Review a risky architecture change",
            "--json",
          ],
        }),
      );
      const result = JSON.parse(output);
      const project = await readPlanningProject(root);

      expect(result.current).toMatchObject({
        phase: "build",
        subPhase: "Execute",
        mode: "pairing",
        riskClass: "H",
      });
      expect(project.state).toMatchObject({
        phase: "build",
        sub_phase: "Execute",
        mode: "pairing",
      });
      expect(project.currentRisk.risk_class).toBe("H");
      expect(project.runSet.intent.objective).toBe("Review a risky architecture change");
      expect(formatEnterDevelopmentHuman(result)).toContain("Development entry");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("prints convergence JSON from .planning", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-convergence-"));

    try {
      await initProject(root);

      const output = await captureConsole(() =>
        runCommand(main, { rawArgs: ["convergence", "--root", root, "--json"] }),
      );

      expect(JSON.parse(output)).toMatchObject({
        score: expect.any(Number),
        status: expect.any(String),
        finalizationRecommendation: {
          finalState: expect.any(String),
        },
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("prints route runtime assessment JSON for delegated subagents", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-route-runtime-"));

    try {
      await seedDelegatedCodexRouteAssessment(root);

      const output = await captureConsole(() =>
        runCommand(main, { rawArgs: ["runtime", "assess-route", "--root", root, "--json"] }),
      );
      const result = JSON.parse(output);
      const subagentStopAssessment = result.assessments.find(
        (assessment: { binding?: { gateType?: string } }) =>
          assessment.binding?.gateType === "subagent_stop",
      );

      expect(result.riskClass).toBe("M");
      expect(result.activeTarget).toBe("codex");
      expect(result.healthy).toBe(false);
      expect(result.requiredGates).toEqual(
        expect.arrayContaining([
          "user_prompt",
          "pre_tool",
          "stop",
          "subagent_start",
          "subagent_stop",
        ]),
      );
      expect(result.gaps.some((gap: string) => gap.includes("subagent_stop"))).toBe(true);
      expect(subagentStopAssessment).toMatchObject({
        binding: {
          gateType: "subagent_stop",
          status: "missing",
          canBlock: false,
        },
        enforceable: false,
        availabilityProblem: true,
        blockingProblem: true,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("formats route runtime assessment for humans with required gates and gaps", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-route-runtime-human-"));

    try {
      await seedDelegatedCodexRouteAssessment(root);

      const output = await captureConsole(() =>
        runCommand(main, { rawArgs: ["runtime", "assess-route", "--root", root] }),
      );

      expect(output).toContain("Route runtime assessment");
      expect(output).toContain("RiskClass  : M");
      expect(output).toContain("Target     : codex");
      expect(output).toContain("Healthy    : no");
      expect(output).toContain("Required   :");
      expect(output).toContain("subagent_start");
      expect(output).toContain("subagent_stop");
      expect(output).toContain("Gaps       :");
      expect(output).toContain("runtime binding unavailable for subagent_stop");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("closes a run with explicit event id and timestamp", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-close-"));

    try {
      await initProject(root);

      const output = await captureConsole(() =>
        runCommand(main, {
          rawArgs: [
            "close",
            "--root",
            root,
            "--id",
            "close-cli-1",
            "--timestamp",
            "2026-05-03T00:00:00.000Z",
            "--json",
          ],
        }),
      );
      const result = JSON.parse(output);
      const project = await readPlanningProject(root);

      expect(result.event).toMatchObject({
        id: "close-cli-1",
        ts: "2026-05-03T00:00:00.000Z",
        type: "RUN_CLOSED",
        decision: expect.any(String),
      });
      expect(result.evaluation.finalizationRecommendation.finalState).toBe(
        project.runSet.finalization.state,
      );
      expect(project.runSet.events.at(-1)?.id).toBe("close-cli-1");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("inspects and binds runtime metadata through command surfaces", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-runtime-"));
    const digest = computeRuntimeProfileDigest("codex");
    const runtimeVersion = "codex-profile-v2";

    try {
      await initProject(root);

      const inspectOutput = await captureConsole(() =>
        runCommand(main, {
          rawArgs: [
            "runtime",
            "inspect",
            "codex",
            "--root",
            root,
            "--configDigest",
            digest,
            "--runtimeVersion",
            runtimeVersion,
            "--status",
            DEFAULT_RUNTIME_CAPABILITY_STATUS,
            "--json",
          ],
        }),
      );
      const bindOutput = await captureConsole(() =>
        runCommand(main, {
          rawArgs: [
            "runtime",
            "bind",
            "codex",
            "--root",
            root,
            "--expectedDigest",
            digest,
            "--currentDigest",
            digest,
            "--json",
          ],
        }),
      );
      const inspected = JSON.parse(inspectOutput);
      const bindings = JSON.parse(bindOutput);
      const project = await readPlanningProject(root);

      expect(inspected).toMatchObject({
        target: "codex",
        runtimeVersion,
        status: DEFAULT_RUNTIME_CAPABILITY_STATUS,
        configDigest: digest,
      });
      expect(bindings.pre_tool).toMatchObject({
        target: "codex",
        status: "stale",
        canBlock: false,
        runtimeVersion,
        configDigest: digest,
        reason: expect.stringContaining("runtime blocking proof is missing"),
      });
      expect(project.runSet.runtimeCapabilities.codex?.configDigest).toBe(digest);
      expect(project.runSet.runtimeCapabilities.codex?.runtimeVersion).toBe(runtimeVersion);
      expect(project.runSet.runtimeBindings.gates?.pre_tool?.status).toBe("stale");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("parses runtime hook proof overrides from JSON", () => {
    expect(
      parseRuntimeHooksJson(
        JSON.stringify({
          pre_tool: {
            proofs: [
              {
                type: "negative_fixture",
                status: "accepted",
                observedAt: "2026-05-03T00:00:00.000Z",
              },
            ],
          },
        }),
      ),
    ).toEqual({
      pre_tool: {
        proofs: [
          {
            type: "negative_fixture",
            status: "accepted",
            observedAt: "2026-05-03T00:00:00.000Z",
          },
        ],
      },
    });
    expect(parseRuntimeHooksJson(undefined)).toBeUndefined();
    expect(() => parseRuntimeHooksJson("{")).toThrow("hooksJson must be valid JSON");
    expect(() => parseRuntimeHooksJson({})).toThrow("hooksJson must be a JSON string");
    expect(() => parseRuntimeHooksJson(JSON.stringify({ unknown_gate: {} }))).toThrow();
  });

  it("keeps CLI-submitted runtime hook proofs candidate and non-native", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-runtime-hooks-"));
    const digest = computeRuntimeProfileDigest("codex");
    const hooksJson = JSON.stringify({
      pre_tool: {
        proofs: [
          {
            type: "negative_fixture",
            status: "accepted",
            observedAt: "2026-05-03T00:00:00.500Z",
            detail: "fixture blocked token=ghp_abcdefghijklmnopqrstuvwxyz123456",
            verifier: "core-runtime-probe",
            target: "codex",
            runtimeVersion: getRuntimeProfile("codex").runtimeVersion,
            gateType: "pre_tool",
            configDigest: digest,
            result: "blocked_expected_fixture",
            proofDigest: "forged",
          },
        ],
      },
    });

    try {
      await initProject(root);

      await captureConsole(() =>
        runCommand(main, {
          rawArgs: [
            "runtime",
            "inspect",
            "codex",
            "--root",
            root,
            "--configDigest",
            digest,
            "--status",
            DEFAULT_RUNTIME_CAPABILITY_STATUS,
            "--hooksJson",
            hooksJson,
            "--json",
          ],
        }),
      );
      const bindOutput = await captureConsole(() =>
        runCommand(main, {
          rawArgs: [
            "runtime",
            "bind",
            "codex",
            "--root",
            root,
            "--expectedDigest",
            digest,
            "--currentDigest",
            digest,
            "--json",
          ],
        }),
      );
      const bindings = JSON.parse(bindOutput);
      const project = await readPlanningProject(root);

      expect(bindings.pre_tool).toMatchObject({
        target: "codex",
        status: "stale",
        canBlock: false,
        configDigest: digest,
      });
      expect(project.runSet.runtimeCapabilities.codex?.hooks.pre_tool?.proofs?.[0]).toMatchObject({
        type: "negative_fixture",
        status: "candidate",
        observedAt: "2026-05-03T00:00:00.500Z",
        detail: "fixture blocked token=[REDACTED]",
      });
      expect(project.runSet.runtimeCapabilities.codex?.hooks.pre_tool?.proofs?.[0]?.verifier).toBe(
        undefined,
      );
      expect(
        project.runSet.runtimeCapabilities.codex?.hooks.pre_tool?.proofs?.[0]?.runtimeVersion,
      ).toBe(undefined);
      expect(project.runSet.runtimeBindings.gates?.pre_tool?.status).toBe("stale");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("probes Codex runtime config without promoting config-only blocking proof", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-runtime-probe-"));
    const platformDirectory = path.join(root, ".codex");

    try {
      await initProject(root);
      await mkdir(platformDirectory, { recursive: true });
      await writeFile(
        path.join(platformDirectory, "config.toml"),
        [
          "[features]",
          "codex_hooks = true",
          "",
          "[[hooks.PreToolUse]]",
          "",
          "[[hooks.PreToolUse.hooks]]",
          'type = "command"',
          `command = "${toHookCommand("pre_tool", "codex")}"`,
          "",
        ].join("\n"),
        "utf8",
      );

      const output = await captureConsole(() =>
        runCommand(main, {
          rawArgs: ["runtime", "probe", "codex", "--root", root, "--bind", "--json"],
        }),
      );
      const result = JSON.parse(output);
      const project = await readPlanningProject(root);

      expect(result.registeredHooks).toContain("pre_tool");
      expect(result.runtimeVersion).toBe(getRuntimeProfile("codex").runtimeVersion);
      expect(result.capability.runtimeVersion).toBe(getRuntimeProfile("codex").runtimeVersion);
      expect(result.verifiedBlockingFixtures).not.toContain("pre_tool");
      expect(result.bindings.pre_tool).toMatchObject({
        status: "stale",
        canBlock: false,
        runtimeVersion: getRuntimeProfile("codex").runtimeVersion,
      });
      expect(
        project.runSet.runtimeCapabilities.codex?.hooks.pre_tool?.proofs?.find(
          (proof) => proof.type === "negative_fixture",
        ),
      ).toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("probes Codex runtime config and binds trusted blocking proof after fixture verification", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-runtime-probe-fixture-"));
    const platformDirectory = path.join(root, ".codex");

    try {
      await initProject(root);
      await mkdir(platformDirectory, { recursive: true });
      await writeFile(
        path.join(platformDirectory, "config.toml"),
        [
          "[features]",
          "codex_hooks = true",
          "",
          "[[hooks.PreToolUse]]",
          "",
          "[[hooks.PreToolUse.hooks]]",
          'type = "command"',
          `command = "${toHookCommand("pre_tool", "codex")}"`,
          "",
        ].join("\n"),
        "utf8",
      );

      const output = await captureConsole(() =>
        runCommand(main, {
          rawArgs: [
            "runtime",
            "probe",
            "codex",
            "--root",
            root,
            "--bind",
            "--verifyBlockingFixtures",
            "--json",
          ],
        }),
      );
      const result = JSON.parse(output);
      const project = await readPlanningProject(root);

      expect(result.registeredHooks).toContain("pre_tool");
      expect(result.runtimeVersion).toBe(getRuntimeProfile("codex").runtimeVersion);
      expect(result.verifiedBlockingFixtures).toContain("pre_tool");
      expect(result.bindings.pre_tool).toMatchObject({
        status: "native",
        canBlock: true,
        runtimeVersion: getRuntimeProfile("codex").runtimeVersion,
      });
      expect(
        project.runSet.runtimeCapabilities.codex?.hooks.pre_tool?.proofs?.find(
          (proof) => proof.type === "negative_fixture",
        ),
      ).toMatchObject({
        status: "accepted",
        verifier: "core-runtime-probe",
        runtimeVersion: getRuntimeProfile("codex").runtimeVersion,
        result: "blocked_expected_fixture",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("uses the exported default runtime status for CLI inspection", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-runtime-default-"));

    try {
      await initProject(root);

      const output = await captureConsole(() =>
        runCommand(main, {
          rawArgs: ["runtime", "inspect", "codex", "--root", root, "--json"],
        }),
      );

      expect(JSON.parse(output)).toMatchObject({
        target: "codex",
        runtimeVersion: getRuntimeProfile("codex").runtimeVersion,
        status: DEFAULT_RUNTIME_CAPABILITY_STATUS,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("CLI evidence add parsing and formatting", () => {
  it("builds an addEvidence input from CLI args", () => {
    expect(
      parseEvidenceAddArgs({
        key: "ci_green",
        kind: "command",
        status: "accepted",
        summary: "pnpm test passed",
      }),
    ).toEqual({
      key: "ci_green",
      kind: "command",
      status: "accepted",
      summary: "pnpm test passed",
      source: "agent",
    });
  });

  it("defaults evidence status to candidate", () => {
    expect(
      parseEvidenceAddArgs({
        key: DEFAULT_EVIDENCE_KEY,
        kind: "command",
        summary: "lint output captured",
      }).status,
    ).toBe(DEFAULT_EVIDENCE_STATUS);
  });

  it("formats added evidence for humans", () => {
    expect(
      formatEvidenceAddedHuman({
        id: "ev_1",
        key: "ci_green",
        kind: "command",
        status: "accepted",
        summary: "tests passed",
        source: "agent",
        createdAt: "2026-05-03T00:00:00.000Z",
      }),
    ).toContain("Evidence added");
  });
});

async function expectPathPresent(filePath: string): Promise<void> {
  await expect(access(filePath)).resolves.toBeUndefined();
}

async function expectPathMissing(filePath: string): Promise<void> {
  await expect(access(filePath)).rejects.toMatchObject({ code: "ENOENT" });
}

async function captureConsole(run: () => Promise<unknown>): Promise<string> {
  const output: string[] = [];
  const originalLog = console.log;

  console.log = (value?: unknown, ...args: unknown[]) => {
    output.push([value, ...args].map(String).join(" "));
  };

  try {
    await run();
  } finally {
    console.log = originalLog;
  }

  return output.join("\n");
}

async function runCommandWithStdin(rawArgs: string[], payload: unknown): Promise<string> {
  return runCommandWithRawStdin(rawArgs, JSON.stringify(payload));
}

async function runCommandWithRawStdin(rawArgs: string[], input: string): Promise<string> {
  const originalDescriptor = Object.getOwnPropertyDescriptor(process, "stdin");

  Object.defineProperty(process, "stdin", {
    value: Readable.from([input]),
    configurable: true,
  });

  try {
    return await captureConsole(() => runCommand(main, { rawArgs }));
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(process, "stdin", originalDescriptor);
    }
  }
}

async function seedDelegatedCodexRouteAssessment(root: string): Promise<void> {
  const digest = computeRuntimeProfileDigest("codex");
  await initProject(root);
  await captureConsole(() =>
    runCommand(main, {
      rawArgs: [
        "runtime",
        "inspect",
        "codex",
        "--root",
        root,
        "--configDigest",
        digest,
        "--status",
        DEFAULT_RUNTIME_CAPABILITY_STATUS,
        "--json",
      ],
    }),
  );
  await captureConsole(() =>
    runCommand(main, {
      rawArgs: [
        "runtime",
        "bind",
        "codex",
        "--root",
        root,
        "--expectedDigest",
        digest,
        "--currentDigest",
        digest,
        "--json",
      ],
    }),
  );

  const project = await readPlanningProject(root);
  await writePlanningProject(root, {
    ...project,
    currentRisk: {
      ...project.currentRisk,
      risk_class: "M",
      rank: RISK_CLASS_RANK.M,
      bypass_allowed: RISK_POLICY.M.bypassAllowed,
      human_checkpoint_required: RISK_POLICY.M.requiresHumanCheckpoint,
    },
    runSet: {
      ...project.runSet,
      route: {
        ...project.runSet.route,
        riskClass: "M",
      },
      subagents: [
        {
          agentId: "worker-route-required",
          status: "planned",
        },
      ],
    },
  });
}

describe("CLI risk classification parsing and formatting", () => {
  it("maps pragmatic flags into a core changeset", () => {
    expect(
      parseRiskClassifyArgs({
        files: "src/auth/session.ts, db/migrations/001.sql",
        auth: true,
        schema: true,
        publicApi: true,
        linesChanged: "42",
        testCoverage: "85",
        confidence: "high",
      }),
    ).toMatchObject({
      files: ["src/auth/session.ts", "db/migrations/001.sql"],
      labels: ["schema-change", "auth", "api-breaking"],
      changeType: "migration",
      diffLinesNet: 42,
      probabilityEstimate: 2,
      ciGreen: true,
      newEndpointExposed: true,
    });
  });

  it("rejects invalid numeric flags", () => {
    expect(() =>
      parseRiskClassifyArgs({
        linesChanged: "-1",
      }),
    ).toThrow("linesChanged must be a non-negative integer");

    expect(() =>
      parseRiskClassifyArgs({
        testCoverage: "120",
      }),
    ).toThrow("testCoverage must be a number from 0 to 100");

    expect(() =>
      parseRiskClassifyArgs({
        linesChanged: "42abc",
      }),
    ).toThrow("linesChanged must be a number");

    expect(() =>
      parseRiskClassifyArgs({
        linesChanged: "12.5",
      }),
    ).toThrow("linesChanged must be a number");

    expect(() =>
      parseRiskClassifyArgs({
        testCoverage: "85abc",
      }),
    ).toThrow("testCoverage must be a number");
  });

  it("rejects non-boolean primitive flags", () => {
    expect(() =>
      parseRiskClassifyArgs({
        dependency: "true",
      }),
    ).toThrow("dependency must be a boolean");

    expect(() =>
      parseRiskClassifyArgs({
        schema: 1,
      }),
    ).toThrow("schema must be a boolean");
  });

  it("formats risk classification output with signal fallback", () => {
    expect(
      formatRiskClassHuman({
        riskClass: "T",
        justification: "T: composite score 1.",
        activeSignals: [],
        compositeScore: 1,
        operatingMode: "bypass",
        deploymentStrategy: "direct",
        mandatoryActivities: ["risk_classification"],
        bypassEligible: true,
        classifiedAt: "1970-01-01T00:00:00.000Z",
        proposedBy: "agent",
      }),
    ).toContain("Signals    : none");
  });
});
