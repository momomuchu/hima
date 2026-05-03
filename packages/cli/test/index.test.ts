import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  computeRuntimeProfileDigest,
  DEFAULT_EVIDENCE_KEY,
  DEFAULT_EVIDENCE_STATUS,
  DEFAULT_RUNTIME_CAPABILITY_STATUS,
  getOperationalCatalog,
  initProject,
  readPlanningProject,
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
  formatEvidenceAddedHuman,
  formatInstallHuman,
  formatRiskClassHuman,
  formatRuntimeBindHuman,
  formatRuntimeDigestHuman,
  formatRuntimeInspectHuman,
  formatStatusHuman,
  generateCatalogArtifactsPlan,
  main,
  parseEvidenceAddArgs,
  parseHookEvent,
  parseRiskClassifyArgs,
} from "../src/index.js";

describe("CLI hook event parsing", () => {
  it("accepts runtime adapter event names", () => {
    expect(parseHookEvent("session-start")).toBe("session_start");
    expect(parseHookEvent("pre_tool_use")).toBe("pre_tool");
    expect(parseHookEvent("pre-tool-use")).toBe("pre_tool");
    expect(parseHookEvent("post_tool_use")).toBe("post_tool");
    expect(parseHookEvent("post-tool-use")).toBe("post_tool");
    expect(parseHookEvent("user_prompt_submit")).toBe("user_prompt");
    expect(parseHookEvent("user-prompt-submit")).toBe("user_prompt");
    expect(parseHookEvent("subagent_start")).toBe("subagent_start");
    expect(parseHookEvent("subagent-start")).toBe("subagent_start");
    expect(parseHookEvent("subagent_stop")).toBe("subagent_stop");
    expect(parseHookEvent("subagent-stop")).toBe("subagent_stop");
  });

  it("still accepts canonical gate types", () => {
    expect(parseHookEvent("pre_tool")).toBe("pre_tool");
    expect(parseHookEvent("stop")).toBe("stop");
  });

  it("rejects unknown event names", () => {
    expect(() => parseHookEvent("before_write")).toThrow("Unknown hook event");
  });
});

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
        digest: computeRuntimeProfileDigest("codex"),
      }),
    ).toContain("Runtime target : codex");
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
        status: DEFAULT_RUNTIME_CAPABILITY_STATUS,
        inspectedAt: "2026-05-03T00:00:00.000Z",
        configDigest: digest,
        hooks: {},
        knownLimitations: [],
      }),
    ).toContain("Config digest");
    expect(
      formatRuntimeBindHuman({
        pre_tool: {
          gateType: "pre_tool",
          target: "codex",
          status: "native",
          nativeEvent: "PreToolUse",
          canBlock: true,
          inspectedAt: "2026-05-03T00:00:00.000Z",
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

  it("prints catalog and runtime digest JSON", async () => {
    const catalogOutput = await captureConsole(() =>
      runCommand(main, { rawArgs: ["catalog", "--json"] }),
    );
    const digestOutput = await captureConsole(() =>
      runCommand(main, { rawArgs: ["runtime", "digest", "codex", "--json"] }),
    );

    expect(JSON.parse(catalogOutput)).toMatchObject({
      skills: expect.any(Array),
      books: expect.any(Array),
      subagents: expect.any(Array),
    });
    expect(JSON.parse(digestOutput)).toEqual({
      target: "codex",
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
          rawArgs: ["artifacts", "--kind", "books", "--base-dir", root, "--apply", "--json"],
        }),
      );

      expect(JSON.parse(output)).toMatchObject({
        ok: true,
        kind: "books",
        dryRun: false,
        apply: true,
        artifactsPlanned: getOperationalCatalog().books.length,
      });
      await expectPathPresent(path.join(root, "artifacts", "books", "gate-policy.md"));
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
        artifactsPlanned: getOperationalCatalog().subagents.length,
      });
      expect(result.artifactsWritten).toHaveLength(getOperationalCatalog().subagents.length);
      await expectPathPresent(path.join(root, ".claude", "agents", "reviewer.md"));
      await expectPathMissing(path.join(root, ".claude", "books", "gate-policy.md"));
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
        status: DEFAULT_RUNTIME_CAPABILITY_STATUS,
        configDigest: digest,
      });
      expect(bindings.pre_tool).toMatchObject({
        target: "codex",
        status: "native",
        configDigest: digest,
      });
      expect(project.runSet.runtimeCapabilities.codex?.configDigest).toBe(digest);
      expect(project.runSet.runtimeBindings.gates?.pre_tool?.status).toBe("native");
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
