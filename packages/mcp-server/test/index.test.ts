import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  ARTIFACT_INSTALL_TARGETS,
  CHANGE_TYPES,
  DEFAULT_EVIDENCE_KEY,
  DEFAULT_EVIDENCE_STATUS,
  DEFAULT_RUNTIME_CAPABILITY_STATUS,
  EVIDENCE_STATUSES,
  GATE_DECISIONS,
  GATE_TYPES,
  getOperationalCatalog,
  getRuntimeProfile,
  getSkillsCatalog,
  INSTALL_TARGETS,
  initProject,
  MISSING_RUNTIME_BINDING_STATUS,
  OPERATING_MODES,
  RISK_CLASS_RANK,
  RISK_CLASSES,
  RISK_POLICY,
  RUNTIME_CAPABILITY_STATUSES,
  RUNTIME_PROOF_TYPES,
  readPlanningProject,
  toHookCommand,
  writePlanningProject,
} from "@harness/core";
import { describe, expect, it } from "vitest";
import { dispatchRequest, getMcpToolSurface } from "../src/index.js";

type JsonObject = Record<string, unknown>;
const MCP_ARTIFACT_SELECTIONS = ["all", "skills", "hooks", "subagents"];

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

function operationalHookCount(): number {
  return getOperationalCatalog().hooks.length;
}

function asObject(value: unknown): JsonObject {
  expect(value).toBeTypeOf("object");
  expect(value).not.toBeNull();
  expect(Array.isArray(value)).toBe(false);

  return value as JsonObject;
}

function structuredContent(value: unknown): JsonObject {
  return asObject(asObject(value).structuredContent);
}

async function callTool(name: string, args: JsonObject = {}): Promise<JsonObject> {
  return asObject(
    await dispatchRequest("tools/call", {
      name,
      arguments: args,
    }),
  );
}

async function mkMcpProjectRoot(prefix: string): Promise<string> {
  return mkdtemp(path.join(process.cwd(), `.tmp-${prefix}`));
}

async function seedDelegatedCodexRouteAssessment(root: string): Promise<void> {
  await initProject(root);
  const digest = structuredContent(
    await callTool("rms.runtime_digest", {
      target: "codex",
    }),
  ).digest as string;

  await callTool("rms.inspect_runtime", {
    root,
    target: "codex",
    configDigest: digest,
    status: DEFAULT_RUNTIME_CAPABILITY_STATUS,
  });
  await callTool("rms.bind_runtime", {
    root,
    target: "codex",
    expectedDigest: digest,
    currentDigest: digest,
  });

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

describe("MCP JSON-RPC surface", () => {
  it("keeps initialize, ping, tools/list, and tools/call available", async () => {
    const initialized = asObject(
      await dispatchRequest("initialize", { protocolVersion: "2025-06-18" }),
    );

    expect(initialized).toMatchObject({
      protocolVersion: "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "harness-mcp-server" },
    });
    expect(await dispatchRequest("ping", {})).toEqual({});

    const listed = asObject(await dispatchRequest("tools/list", {}));
    const tools = listed.tools as JsonObject[];
    const toolNames = tools.map((tool) => tool.name);

    expect(toolNames).toEqual(
      expect.arrayContaining([
        "rms.get_state",
        "rms.transition",
        "rms.enter_development",
        "rms.classify_risk",
        "rms.record_evidence",
        "rms.evaluate_gate",
        "rms.inspect_runtime",
        "rms.bind_runtime",
        "rms.probe_runtime",
        "rms.assess_route_runtime_bindings",
        "rms.get_catalog",
        "rms.generate_artifacts",
        "rms.install_artifacts",
        "rms.install_platform",
        "rms.uninstall_platform",
        "rms.repair_platform",
        "rms.apply_lifecycle",
        "rms.uninstall_lifecycle",
        "rms.repair_lifecycle",
        "rms.rollback_artifacts",
        "rms.runtime_digest",
        "rms.evaluate_convergence",
        "rms.close_run",
        "harness:get_state",
        "harness:get_risk_class",
        "harness:evaluate_gate",
        "harness:record_evidence",
        "harness:log_event",
        "harness:enter_development",
        "harness:get_catalog",
        "harness:generate_artifacts",
        "harness:install_artifacts",
        "harness:install_platform",
        "harness:uninstall_platform",
        "harness:repair_platform",
        "harness:apply_lifecycle",
        "harness:uninstall_lifecycle",
        "harness:repair_lifecycle",
        "harness:rollback_artifacts",
        "harness:runtime_digest",
        "harness:probe_runtime",
        "harness:evaluate_convergence",
        "harness:close_run",
      ]),
    );

    const inspectRuntimeTool = tools.find((tool) => tool.name === "rms.inspect_runtime");
    const inspectRuntimeSchema = asObject(inspectRuntimeTool?.inputSchema);
    const inspectRuntimeProperties = asObject(inspectRuntimeSchema.properties);
    const statusProperty = asObject(inspectRuntimeProperties.status);
    const configDigestProperty = asObject(inspectRuntimeProperties.configDigest);
    const runtimeVersionProperty = asObject(inspectRuntimeProperties.runtimeVersion);
    const hooksProperty = asObject(inspectRuntimeProperties.hooks);
    const hooksProperties = asObject(hooksProperty.properties);
    const preToolHookSchema = asObject(hooksProperties.pre_tool);
    const preToolHookProperties = asObject(preToolHookSchema.properties);
    const proofItems = asObject(asObject(preToolHookProperties.proofs).items);
    const proofProperties = asObject(proofItems.properties);

    expect(statusProperty.enum).toEqual([...RUNTIME_CAPABILITY_STATUSES]);
    expect(statusProperty.default).toBe(DEFAULT_RUNTIME_CAPABILITY_STATUS);
    expect(configDigestProperty.description).toBe(
      "Optional observed runtime config content digest.",
    );
    expect(runtimeVersionProperty.description).toBe(
      "Optional runtime profile version bound to trusted proofs.",
    );
    expect(asObject(proofProperties.type).enum).toEqual([...RUNTIME_PROOF_TYPES]);
    expect(asObject(proofProperties.status).enum).toEqual([...EVIDENCE_STATUSES]);
    expect(asObject(proofProperties.runtimeVersion).description).toBe(
      "Runtime profile version bound to a trusted proof.",
    );

    const probeRuntimeTool = tools.find((tool) => tool.name === "rms.probe_runtime");
    const probeRuntimeProperties = asObject(asObject(probeRuntimeTool?.inputSchema).properties);

    expect(probeRuntimeProperties.inspectedAt).toBeUndefined();

    const assessRouteRuntimeTool = tools.find(
      (tool) => tool.name === "rms.assess_route_runtime_bindings",
    );
    const assessRouteRuntimeSchema = asObject(assessRouteRuntimeTool?.inputSchema);
    const assessRouteRuntimeProperties = asObject(assessRouteRuntimeSchema.properties);

    expect(assessRouteRuntimeSchema).toMatchObject({
      type: "object",
      required: [],
      additionalProperties: false,
    });
    expect(Object.keys(assessRouteRuntimeProperties).sort()).toEqual(["root"]);
    expect(assessRouteRuntimeProperties.apply).toBeUndefined();
    expect(assessRouteRuntimeProperties.writeManifest).toBeUndefined();
    expect(assessRouteRuntimeProperties.bind).toBeUndefined();
    expect(assessRouteRuntimeProperties.target).toBeUndefined();

    const enterDevelopmentTool = tools.find((tool) => tool.name === "rms.enter_development");
    const enterDevelopmentProperties = asObject(
      asObject(enterDevelopmentTool?.inputSchema).properties,
    );

    expect(asObject(enterDevelopmentProperties.mode).enum).toEqual([...OPERATING_MODES]);
    expect(asObject(enterDevelopmentProperties.mode).default).toBe("auto");
    expect(asObject(enterDevelopmentProperties.riskClass).enum).toEqual([...RISK_CLASSES]);
    expect(asObject(enterDevelopmentProperties.phase).default).toBe("build");
    expect(asObject(enterDevelopmentProperties.subPhase).default).toBe("Execute");

    const classifyRiskTool = tools.find((tool) => tool.name === "rms.classify_risk");
    const classifyRiskProperties = asObject(asObject(classifyRiskTool?.inputSchema).properties);
    const changeTypeProperty = asObject(classifyRiskProperties.changeType);

    expect(changeTypeProperty.enum).toEqual([...CHANGE_TYPES]);

    const logEventTool = tools.find((tool) => tool.name === "harness:log_event");
    const logEventProperties = asObject(asObject(logEventTool?.inputSchema).properties);
    const decisionProperty = asObject(logEventProperties.decision);

    expect(decisionProperty.enum).toEqual([...GATE_DECISIONS]);

    const recordEvidenceTool = tools.find((tool) => tool.name === "rms.record_evidence");
    const recordEvidenceSchema = asObject(recordEvidenceTool?.inputSchema);
    const recordEvidenceProperties = asObject(recordEvidenceSchema.properties);
    const evidenceStatusProperty = asObject(recordEvidenceProperties.status);
    const evidenceKeyProperty = asObject(recordEvidenceProperties.key);

    expect(recordEvidenceSchema.additionalProperties).toBe(false);
    expect(evidenceStatusProperty.enum).toEqual([...EVIDENCE_STATUSES]);
    expect(evidenceStatusProperty.default).toBe(DEFAULT_EVIDENCE_STATUS);
    expect(evidenceKeyProperty.default).toBe(DEFAULT_EVIDENCE_KEY);
    expect(recordEvidenceProperties.source).toBeUndefined();
    expect(recordEvidenceProperties.metadata).toBeUndefined();
    expect(recordEvidenceProperties.id).toBeUndefined();
    expect(recordEvidenceProperties.createdAt).toBeUndefined();

    const generateArtifactsTool = tools.find((tool) => tool.name === "rms.generate_artifacts");
    const generateArtifactsProperties = asObject(
      asObject(generateArtifactsTool?.inputSchema).properties,
    );
    const kindProperty = asObject(generateArtifactsProperties.kind);
    const applyProperty = asObject(generateArtifactsProperties.apply);

    expect(kindProperty.enum).toEqual(["all", "skills", "hooks", "subagents"]);
    expect(kindProperty.default).toBe("all");
    expect(applyProperty.default).toBe(false);

    const installArtifactsTool = tools.find((tool) => tool.name === "rms.install_artifacts");
    const installArtifactsProperties = asObject(
      asObject(installArtifactsTool?.inputSchema).properties,
    );
    const installTargetProperty = asObject(installArtifactsProperties.target);
    const installKindProperty = asObject(installArtifactsProperties.kind);
    const installWriteManifestProperty = asObject(installArtifactsProperties.writeManifest);
    const installCaptureRestoreSnapshotsProperty = asObject(
      installArtifactsProperties.captureRestoreSnapshots,
    );

    expect(installTargetProperty.enum).toEqual([...ARTIFACT_INSTALL_TARGETS]);
    expect(installKindProperty.enum).toEqual(MCP_ARTIFACT_SELECTIONS);
    expect(installKindProperty.default).toBe("all");
    expect(installWriteManifestProperty.default).toBe(false);
    expect(installCaptureRestoreSnapshotsProperty.default).toBe(false);
    expect(installArtifactsProperties.baseDir).toBeUndefined();

    const installPlatformTool = tools.find((tool) => tool.name === "rms.install_platform");
    const installPlatformProperties = asObject(
      asObject(installPlatformTool?.inputSchema).properties,
    );
    const platformTargetProperty = asObject(installPlatformProperties.target);
    const platformApplyProperty = asObject(installPlatformProperties.apply);
    const platformWriteManifestProperty = asObject(installPlatformProperties.writeManifest);

    expect(platformTargetProperty.enum).toEqual([...INSTALL_TARGETS]);
    expect(platformApplyProperty.default).toBe(false);
    expect(platformWriteManifestProperty.default).toBe(false);

    const uninstallPlatformTool = tools.find((tool) => tool.name === "rms.uninstall_platform");
    const uninstallPlatformProperties = asObject(
      asObject(uninstallPlatformTool?.inputSchema).properties,
    );
    const uninstallPlatformApplyProperty = asObject(uninstallPlatformProperties.apply);

    expect(uninstallPlatformApplyProperty.default).toBe(false);
    expect(uninstallPlatformProperties.manifestFile).toBeDefined();

    const lifecycleApplyTool = tools.find((tool) => tool.name === "rms.apply_lifecycle");
    const lifecycleApplyProperties = asObject(asObject(lifecycleApplyTool?.inputSchema).properties);
    const lifecycleApplyProperty = asObject(lifecycleApplyProperties.apply);
    const lifecycleTargetProperty = asObject(lifecycleApplyProperties.target);
    const lifecycleKindProperty = asObject(lifecycleApplyProperties.kind);

    expect(lifecycleTargetProperty.enum).toEqual([...ARTIFACT_INSTALL_TARGETS]);
    expect(lifecycleKindProperty.enum).toEqual(MCP_ARTIFACT_SELECTIONS);
    expect(lifecycleKindProperty.default).toBe("all");
    expect(lifecycleApplyProperty.default).toBe(false);

    const rollbackArtifactsTool = tools.find((tool) => tool.name === "rms.rollback_artifacts");
    const rollbackArtifactsProperties = asObject(
      asObject(rollbackArtifactsTool?.inputSchema).properties,
    );
    const rollbackApplyProperty = asObject(rollbackArtifactsProperties.apply);

    expect(rollbackApplyProperty.default).toBe(false);
    expect(rollbackArtifactsProperties.manifestFile).toBeDefined();
  });

  it.each([
    null,
    "not-an-object",
    [],
    42,
    true,
  ])("rejects non-object tools/call arguments %j", async (args) => {
    await expect(
      dispatchRequest("tools/call", {
        name: "rms.get_state",
        arguments: args,
      }),
    ).rejects.toThrow("tools/call arguments must be an object when provided");
  });
});

describe("MCP executable surface contract", () => {
  it("keeps the conception MCP tool spec synchronized with the exported tool surface", async () => {
    const surface = getMcpToolSurface();
    const toolNames = surface.map((entry) => entry.name);
    const listed = asObject(await dispatchRequest("tools/list", {}));
    const listedNames = (listed.tools as JsonObject[]).map((tool) => tool.name);

    expect(toolNames).toEqual(listedNames);

    const spec = await readFile(
      new URL("../../../docs/conception/11-mcp-tools-spec.md", import.meta.url),
      "utf8",
    );
    const documentedTools = [
      ...backtickedFirstColumnValues(markdownSection(spec, "## 2. Canonical RMS Tools")),
      ...backtickedFirstColumnValues(markdownSection(spec, "## 3. Compatibility Alias Tools")),
    ];

    expect(documentedTools).toEqual(toolNames);
    expect(new Set(documentedTools).size).toBe(documentedTools.length);

    for (const entry of surface) {
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it("keeps every listed tool wired to an execution handler", async () => {
    for (const entry of getMcpToolSurface()) {
      const response = structuredContent(await callTool(entry.name, {}));

      expect(response.error).not.toBe(`Unknown tool: ${entry.name}`);
    }
  });
});

describe("RMS MCP tools", () => {
  it("reads state, transitions, classifies risk, records evidence, and preserves aliases", async () => {
    const root = await mkMcpProjectRoot("harness-mcp-");

    try {
      await initProject(root);

      expect(structuredContent(await callTool("rms.get_state", { root }))).toMatchObject({
        phase: "discovery",
        subPhase: "Observer",
        riskClass: "T",
      });

      expect(
        structuredContent(
          await callTool("rms.transition", {
            root,
            reason: "mcp transition token=ghp_abcdefghijklmnopqrstuvwxyz123456",
          }),
        ),
      ).toMatchObject({
        success: true,
        newSnapshot: {
          phase: "discovery",
          sub_phase: "Define",
        },
      });
      expect((await readPlanningProject(root)).runSet.events[0]).toMatchObject({
        type: "STATE_TRANSITIONED",
        reason: "mcp transition token=[REDACTED]",
      });

      expect(
        structuredContent(
          await callTool("rms.classify_risk", {
            files: ["src/auth/session.ts"],
            labels: [],
            changeType: "feature",
          }),
        ),
      ).toMatchObject({
        riskClass: "H",
        activeSignals: [
          {
            type: "file_path",
            forcedClass: "H",
          },
        ],
      });

      expect(
        structuredContent(
          await callTool("rms.record_evidence", {
            root,
            summary: "mcp unit test evidence",
          }),
        ),
      ).toMatchObject({
        recorded: true,
        evidence: {
          key: DEFAULT_EVIDENCE_KEY,
          summary: "mcp unit test evidence",
        },
      });

      expect(structuredContent(await callTool("harness:get_risk_class", { root }))).toMatchObject({
        riskClass: "T",
        bypassAllowed: true,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("enters governed development through the MCP state kernel", async () => {
    const root = await mkMcpProjectRoot("harness-mcp-enter-");

    try {
      await initProject(root);

      const result = structuredContent(
        await callTool("rms.enter_development", {
          root,
          mode: "auto",
          riskClass: "M",
          objective: "Implement the Claude entry skill POC",
          rawPrompt: "Start governed development",
        }),
      );
      const project = await readPlanningProject(root);

      expect(result.current).toMatchObject({
        phase: "build",
        subPhase: "Execute",
        mode: "auto",
        riskClass: "M",
      });
      expect(project.state).toMatchObject({
        phase: "build",
        sub_phase: "Execute",
        mode: "auto",
      });
      expect(project.currentRisk.risk_class).toBe("M");
      expect(project.runSet.intent.objective).toBe("Implement the Claude entry skill POC");

      await expect(
        callTool("harness:enter_development", {
          root,
          mode: "bypass",
          riskClass: "H",
        }),
      ).resolves.toMatchObject({
        content: [
          {
            type: "text",
            text: expect.stringContaining("Mode bypass is not allowed for risk class H"),
          },
        ],
        isError: true,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("inspects and binds runtime capabilities into the canonical run-set", async () => {
    const root = await mkMcpProjectRoot("harness-mcp-runtime-");

    try {
      await initProject(root);
      const digest = structuredContent(
        await callTool("rms.runtime_digest", {
          target: "codex",
        }),
      ).digest;
      const preToolDigest = structuredContent(
        await callTool("rms.runtime_digest", {
          target: "codex",
          gateType: "pre_tool",
        }),
      ).digest;
      const runtimeVersion = "codex-profile-v2";

      expect(
        structuredContent(
          await callTool("rms.inspect_runtime", {
            root,
            target: "codex",
            inspectedAt: "2026-05-03T00:00:00.000Z",
            runtimeVersion,
            configDigest: digest,
            knownLimitations: ["mcp test limitation"],
            hooks: {
              pre_tool: {
                nativeEvent: "PreToolUse",
                canBlock: true,
                status: DEFAULT_RUNTIME_CAPABILITY_STATUS,
                configDigest: preToolDigest,
                proofs: [
                  {
                    type: "negative_fixture",
                    status: "accepted",
                    observedAt: "2026-05-03T00:00:00.500Z",
                    detail: "MCP fixture produced the documented block response.",
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
            },
          }),
        ),
      ).toMatchObject({
        target: "codex",
        runtimeVersion,
        configDigest: digest,
        knownLimitations: ["mcp test limitation"],
        hooks: {
          pre_tool: {
            nativeEvent: "PreToolUse",
            canBlock: true,
            configDigest: preToolDigest,
            proofs: [
              {
                type: "negative_fixture",
                status: "candidate",
              },
            ],
          },
          subagent_stop: {
            nativeEvent: null,
          },
        },
      });

      expect(
        structuredContent(
          await callTool("rms.bind_runtime", {
            root,
            target: "codex",
            inspectedAt: "2026-05-03T00:00:01.000Z",
            expectedDigest: digest,
            currentDigest: digest,
          }),
        ),
      ).toMatchObject({
        pre_tool: {
          status: "stale",
          canBlock: false,
          runtimeVersion,
          configDigest: digest,
        },
        subagent_stop: {
          status: MISSING_RUNTIME_BINDING_STATUS,
          canBlock: false,
        },
      });
      const project = await readPlanningProject(root);
      expect(project.runSet.runtimeCapabilities.codex?.hooks.pre_tool?.proofs?.[0]?.status).toBe(
        "candidate",
      );
      expect(project.runSet.runtimeCapabilities.codex?.runtimeVersion).toBe(runtimeVersion);
      expect(
        project.runSet.runtimeCapabilities.codex?.hooks.pre_tool?.proofs?.[0]?.runtimeVersion,
      ).toBe(undefined);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("preserves unrelated run-set fields through MCP runtime inspect and bind", async () => {
    const root = await mkMcpProjectRoot("harness-mcp-runtime-preserve-");

    try {
      await initProject(root);
      const created = await readPlanningProject(root);
      const digest = structuredContent(
        await callTool("rms.runtime_digest", {
          target: "codex",
        }),
      ).digest;
      const preservedRunSet = {
        ...created.runSet,
        project: {
          schemaVersion: 1 as const,
          name: "Pipeline Fractale v4 MCP",
          repoPaths: {
            root: root.replaceAll("\\", "/"),
            planning: ".planning" as const,
          },
          tags: ["mcp", "runtime", "hooks"],
          futureProjectField: { preserve: true },
        },
        intent: {
          schemaVersion: 1 as const,
          objective: "Preserve run-set envelope through MCP runtime tools",
          plannedCycles: ["discovery", "build", "validation"] as const,
          initialRiskClass: "M" as const,
          effectiveRiskClass: "M" as const,
          futureIntentField: { preserve: ["mcp", "runtime"] },
        },
        runtimeCapabilities: {
          claude: {
            target: "claude",
            runtimeName: "claude",
            status: "available" as const,
            inspectedAt: "2026-05-03T00:00:00.250Z",
            hooks: {},
            knownLimitations: ["preexisting MCP Claude capability"],
          },
        },
        runtimeBindings: {
          futureRuntimeBindingField: {
            owner: "future-mcp-runtime-binding-contract",
            nested: { preserve: true },
          },
          gates: {
            pre_tool: {
              gateType: "pre_tool" as const,
              target: "codex",
              status: "stale" as const,
              nativeEvent: "PreToolUse",
              canBlock: false,
              inspectedAt: "2026-05-02T00:00:00.000Z",
              configDigest: "0".repeat(64),
              reason: "stale preexisting MCP binding that must be replaced",
            },
          },
        },
        policy: {
          schemaVersion: 1 as const,
          globalRules: ["MCP runtime writes are scoped to runtime fields"],
          riskPolicies: {
            M: {
              requiredGates: ["pre_tool"],
              futureRiskPolicyField: { preserve: true },
            },
          },
          gatePolicies: {
            pre_tool: {
              canBlock: true,
              enforcement: "block" as const,
              requiredEvidenceKeys: ["hook_decision"],
            },
          },
        },
        route: {
          phase: "build" as const,
          subPhase: "Execute" as const,
          mode: "auto" as const,
          riskClass: "M" as const,
        },
        events: [
          {
            id: "mcp-event-before-runtime-bind",
            ts: "2026-05-03T00:00:00.000Z",
            type: "MCP_AUDIT",
            gateType: "pre_tool" as const,
            decision: "warn" as const,
            reason: "preexisting MCP event",
            payload: { existing: true, nested: { preserve: true } },
          },
        ],
        evidence: [
          {
            id: "mcp-ev-runtime-contract",
            key: "hook_decision" as const,
            kind: "contract-test",
            status: "accepted" as const,
            summary: "MCP runtime writes preserve unrelated run-set fields",
            source: "ci" as const,
            metadata: { existing: true, nested: { preserve: true } },
            createdAt: "2026-05-03T00:00:00.000Z",
          },
        ],
        subagents: [
          {
            agentId: "mcp-agent-runtime-contract",
            role: "test-engineer",
            runtime: "codex",
            status: "completed" as const,
            scope: ["packages/mcp-server/test/index.test.ts"],
            evidenceRefs: ["mcp-ev-runtime-contract"],
            metadata: { lane: "mcp-runtime-binding", preserve: true },
          },
        ],
        finalization: {
          state: "BLOCKED" as const,
          gaps: ["awaiting MCP runtime binding proof"],
        },
      };

      await writePlanningProject(root, {
        ...created,
        runSet: preservedRunSet,
      });
      await callTool("rms.inspect_runtime", {
        root,
        target: "codex",
        inspectedAt: "2026-05-03T00:00:01.000Z",
        configDigest: digest,
        knownLimitations: ["mcp runtime preservation fixture"],
      });
      await callTool("rms.bind_runtime", {
        root,
        target: "codex",
        inspectedAt: "2026-05-03T00:00:02.000Z",
        expectedDigest: digest,
        currentDigest: digest,
      });

      const updated = await readPlanningProject(root);

      expect(updated.runSet.project).toEqual(preservedRunSet.project);
      expect(updated.runSet.intent).toEqual(preservedRunSet.intent);
      expect(updated.runSet.policy).toEqual(preservedRunSet.policy);
      expect(updated.runSet.route).toEqual(preservedRunSet.route);
      expect(updated.runSet.events).toEqual(preservedRunSet.events);
      expect(updated.runSet.evidence).toEqual(preservedRunSet.evidence);
      expect(updated.runSet.subagents).toEqual(preservedRunSet.subagents);
      expect(updated.runSet.finalization).toEqual(preservedRunSet.finalization);
      expect(updated.runSet.runtimeCapabilities.claude).toEqual(
        preservedRunSet.runtimeCapabilities.claude,
      );
      expect(updated.runSet.runtimeBindings.futureRuntimeBindingField).toEqual(
        preservedRunSet.runtimeBindings.futureRuntimeBindingField,
      );
      expect(updated.runSet.runtimeBindings.gates?.pre_tool).not.toEqual(
        preservedRunSet.runtimeBindings.gates.pre_tool,
      );
      expect(updated.runSet.runtimeCapabilities.codex?.knownLimitations).toEqual([
        "mcp runtime preservation fixture",
      ]);
      expect(updated.runSet.runtimeBindings.gates?.pre_tool?.status).toBe("stale");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("returns route runtime assessment for delegated subagents without mutating state", async () => {
    const root = await mkMcpProjectRoot("harness-mcp-route-runtime-");

    try {
      await seedDelegatedCodexRouteAssessment(root);

      const before = await readPlanningProject(root);
      const result = structuredContent(
        await callTool("rms.assess_route_runtime_bindings", { root }),
      );
      const after = await readPlanningProject(root);
      const assessments = result.assessments as JsonObject[];
      const subagentStopAssessment = asObject(
        assessments.find(
          (assessment) => asObject(asObject(assessment).binding).gateType === "subagent_stop",
        ),
      );

      expect(result.riskClass).toBe("M");
      expect(result.activeTarget).toBe("codex");
      expect(result.healthy).toBe(false);
      expect(result.requiredGates).toEqual(
        expect.arrayContaining(["subagent_start", "subagent_stop"]),
      );
      expect((result.gaps as string[]).some((gap) => gap.includes("subagent_stop"))).toBe(true);
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
      expect(after.runSet.runtimeBindings).toEqual(before.runSet.runtimeBindings);
      expect(after.runSet.events).toEqual(before.runSet.events);
      expect(after.runSet.finalization).toEqual(before.runSet.finalization);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("probes runtime config through MCP without promoting config-only blocking proof", async () => {
    const root = await mkMcpProjectRoot("harness-mcp-runtime-probe-");
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

      const result = structuredContent(
        await callTool("rms.probe_runtime", {
          root,
          target: "codex",
          bind: true,
        }),
      );

      expect(result.registeredHooks).toContain("pre_tool");
      expect(result.runtimeVersion).toBe(getRuntimeProfile("codex").runtimeVersion);
      expect(asObject(result.capability).runtimeVersion).toBe(
        getRuntimeProfile("codex").runtimeVersion,
      );
      expect(result.verifiedBlockingFixtures).not.toContain("pre_tool");
      expect(asObject(asObject(result.bindings).pre_tool)).toMatchObject({
        status: "stale",
        canBlock: false,
        runtimeVersion: getRuntimeProfile("codex").runtimeVersion,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("probes runtime config through MCP and binds trusted blocking proof after fixture verification", async () => {
    const root = await mkMcpProjectRoot("harness-mcp-runtime-probe-fixture-");
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

      const before = Date.now();
      const result = structuredContent(
        await callTool("rms.probe_runtime", {
          root,
          target: "codex",
          inspectedAt: "2999-01-01T00:00:00.000Z",
          bind: true,
          verifyBlockingFixtures: true,
        }),
      );
      const after = Date.now();
      const observedAt = String(result.inspectedAt);
      const observedAtMs = Date.parse(observedAt);

      expect(observedAt).not.toBe("2999-01-01T00:00:00.000Z");
      expect(observedAtMs).toBeGreaterThanOrEqual(before);
      expect(observedAtMs).toBeLessThanOrEqual(after);
      expect(result.registeredHooks).toContain("pre_tool");
      expect(result.runtimeVersion).toBe(getRuntimeProfile("codex").runtimeVersion);
      expect(result.verifiedBlockingFixtures).toContain("pre_tool");
      expect(asObject(asObject(result.bindings).pre_tool)).toMatchObject({
        status: "native",
        canBlock: true,
        runtimeVersion: getRuntimeProfile("codex").runtimeVersion,
      });
      const project = await readPlanningProject(root);
      const proofs = project.runSet.runtimeCapabilities.codex?.hooks.pre_tool?.proofs ?? [];

      expect(proofs.find((proof) => proof.type === "config_read")?.observedAt).toBe(observedAt);
      expect(proofs.find((proof) => proof.type === "negative_fixture")?.observedAt).toBe(
        observedAt,
      );
      expect(proofs.find((proof) => proof.type === "negative_fixture")?.runtimeVersion).toBe(
        getRuntimeProfile("codex").runtimeVersion,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not let MCP manual attestation create native blocking bindings", async () => {
    const root = await mkMcpProjectRoot("harness-mcp-runtime-manual-proof-");

    try {
      await initProject(root);
      const digest = structuredContent(
        await callTool("rms.runtime_digest", {
          target: "codex",
        }),
      ).digest;

      await callTool("rms.inspect_runtime", {
        root,
        target: "codex",
        inspectedAt: "2026-05-03T00:00:00.000Z",
        configDigest: digest,
        hooks: {
          pre_tool: {
            nativeEvent: "PreToolUse",
            canBlock: true,
            status: DEFAULT_RUNTIME_CAPABILITY_STATUS,
            proofs: [
              {
                type: "manual_attestation",
                status: "accepted",
                observedAt: "2026-05-03T00:00:00.500Z",
                detail: "Operator attested blocking behavior.",
              },
            ],
          },
        },
      });

      expect(
        structuredContent(
          await callTool("rms.bind_runtime", {
            root,
            target: "codex",
            inspectedAt: "2026-05-03T00:00:01.000Z",
            expectedDigest: digest,
            currentDigest: digest,
          }),
        ),
      ).toMatchObject({
        pre_tool: {
          status: "stale",
          canBlock: false,
          reason: expect.stringContaining("with observedAt required"),
        },
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not let MCP inputs forge native blocking bindings", async () => {
    const root = await mkMcpProjectRoot("harness-mcp-runtime-forged-");

    try {
      await initProject(root);
      const codexDigest = structuredContent(
        await callTool("rms.runtime_digest", {
          target: "codex",
        }),
      ).digest;
      const claudeSubagentDigest = structuredContent(
        await callTool("rms.runtime_digest", {
          target: "claude",
          gateType: "subagent_start",
        }),
      ).digest;

      expect(
        structuredContent(
          await callTool("rms.inspect_runtime", {
            root,
            target: "codex",
            inspectedAt: "2026-05-03T00:00:00.000Z",
            hooks: {
              subagent_start: {
                nativeEvent: "SubagentStart",
                canBlock: true,
                status: DEFAULT_RUNTIME_CAPABILITY_STATUS,
                configDigest: claudeSubagentDigest,
              },
            },
          }),
        ),
      ).toMatchObject({
        target: "codex",
        hooks: {
          subagent_start: {
            nativeEvent: null,
            canBlock: false,
            status: "missing",
          },
        },
      });

      expect(
        structuredContent(
          await callTool("rms.bind_runtime", {
            root,
            target: "codex",
            inspectedAt: "2026-05-03T00:00:01.000Z",
            expectedDigest: codexDigest,
            currentDigest: codexDigest,
          }),
        ),
      ).toMatchObject({
        subagent_start: {
          status: MISSING_RUNTIME_BINDING_STATUS,
          canBlock: false,
          nativeEvent: null,
        },
      });

      expect(
        structuredContent(
          await callTool("rms.bind_runtime", {
            root,
            target: "codex",
            inspectedAt: "2026-05-03T00:00:02.000Z",
          }),
        ),
      ).toMatchObject({
        pre_tool: {
          status: "stale",
          canBlock: false,
        },
        subagent_start: {
          status: MISSING_RUNTIME_BINDING_STATUS,
          canBlock: false,
        },
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.each([
    "human_validation",
    "explicit_human_signature",
  ] as const)("rejects MCP agent evidence for accepted human-only key %s", async (key) => {
    const root = await mkMcpProjectRoot("harness-mcp-human-evidence-");

    try {
      await initProject(root);

      const response = await callTool("rms.record_evidence", {
        root,
        key,
        status: "accepted",
        summary: "agent-supplied human approval",
      });

      expect(response.isError).toBe(true);
      expect(structuredContent(response).error).toContain("metadata.verifiedHuman=true");

      const project = await readPlanningProject(root);
      expect(project.runSet.evidence).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not let MCP record_evidence forge human trust with hidden fields", async () => {
    const root = await mkMcpProjectRoot("harness-mcp-human-evidence-forged-");

    try {
      await initProject(root);

      const response = await callTool("rms.record_evidence", {
        root,
        key: "human_validation",
        status: "accepted",
        summary: "agent-supplied hidden human approval",
        source: "human",
        metadata: { verifiedHuman: true },
      });

      expect(response.isError).toBe(true);
      expect(structuredContent(response).error).toContain("metadata.verifiedHuman=true");
      expect((await readPlanningProject(root)).runSet.evidence).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.each([
    null,
    "not-an-object",
    [],
    42,
    true,
  ])("rejects non-object MCP gate payload %j", async (payload) => {
    const root = await mkMcpProjectRoot("harness-mcp-gate-payload-");

    try {
      await initProject(root);

      const response = await callTool("rms.evaluate_gate", {
        root,
        gateType: "post_tool",
        payload,
      });

      expect(response.isError).toBe(true);
      expect(structuredContent(response).error).toContain(
        "payload must be an object when provided",
      );
      expect((await readPlanningProject(root)).runSet.events).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("evaluates gates as dry-run through RMS and persists GATE_EVALUATED through the harness alias", async () => {
    const root = await mkMcpProjectRoot("harness-mcp-evaluate-gate-");

    try {
      await initProject(root);

      expect(
        structuredContent(
          await callTool("rms.evaluate_gate", {
            root,
            gateType: "post_tool",
            dryRun: true,
            payload: {
              toolName: "shell",
              toolOutput: "token = abcdefghijklmnopqrstuvwxyz123456",
            },
          }),
        ),
      ).toMatchObject({
        decision: "warn",
        gateType: "post_tool",
        violationType: "SECRET_IN_PLAINTEXT",
        failOpen: false,
      });

      let project = await readPlanningProject(root);
      expect(project.runSet.events).toEqual([]);

      expect(
        structuredContent(
          await callTool("harness:evaluate_gate", {
            root,
            gateType: "post_tool",
            payload: {
              toolName: "shell",
              toolOutput: "token = abcdefghijklmnopqrstuvwxyz123456",
            },
          }),
        ),
      ).toMatchObject({
        decision: "warn",
        gateType: "post_tool",
        violationType: "SECRET_IN_PLAINTEXT",
        failOpen: false,
      });

      project = await readPlanningProject(root);
      expect(project.runSet.events).toHaveLength(1);
      expect(project.runSet.events[0]).toMatchObject({
        type: "GATE_EVALUATED",
        gateType: "post_tool",
        decision: "warn",
        payload: {
          violationType: "SECRET_IN_PLAINTEXT",
          finalState: "BLOCKED_POLICY",
          toolName: "shell",
        },
      });
      expect(project.runSet.events[0].payload.toolOutputPreview).toContain("[REDACTED]");
      expect(project.runSet.events[0].payload.toolOutputPreview).not.toContain(
        "abcdefghijklmnopqrstuvwxyz123456",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps MCP gate and transition writes inside the MCP server project root", async () => {
    const outside = await mkdtemp(path.join(tmpdir(), "harness-mcp-project-outside-"));

    try {
      await initProject(outside);

      const evaluate = await callTool("harness:evaluate_gate", {
        root: outside,
        gateType: "post_tool",
        payload: {
          toolName: "shell",
          toolOutput: "token = abcdefghijklmnopqrstuvwxyz123456",
        },
      });
      const transition = await callTool("rms.transition", {
        root: outside,
        reason: "outside transition",
      });

      expect(structuredContent(evaluate).error).toContain(
        "MCP project root must stay inside the project root",
      );
      expect(structuredContent(transition).error).toContain(
        "MCP project root must stay inside the project root",
      );
      expect((await readPlanningProject(outside)).runSet.events).toEqual([]);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("exposes operational catalog, runtime digest, convergence, and close tools", async () => {
    const root = await mkMcpProjectRoot("harness-mcp-sprint6-");

    try {
      await initProject(root);

      expect(structuredContent(await callTool("rms.get_catalog"))).toMatchObject({
        skills: expect.any(Array),
        hooks: expect.any(Array),
        subagents: expect.any(Array),
      });

      expect(
        structuredContent(
          await callTool("rms.runtime_digest", {
            target: "codex",
            gateType: "pre_tool",
          }),
        ),
      ).toMatchObject({
        target: "codex",
        gateType: "pre_tool",
        digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      });

      expect(structuredContent(await callTool("rms.evaluate_convergence", { root }))).toMatchObject(
        {
          status: "done_with_gaps",
          finalizationRecommendation: {
            finalState: "DONE_WITH_GAPS",
          },
        },
      );

      expect(
        structuredContent(
          await callTool("rms.close_run", {
            root,
            closedAt: "2026-05-03T00:00:00.000Z",
            eventId: "mcp-close-1",
          }),
        ),
      ).toMatchObject({
        evaluation: {
          status: "done_with_gaps",
        },
        runSet: {
          finalization: {
            state: "DONE_WITH_GAPS",
          },
        },
        event: {
          id: "mcp-close-1",
          type: "RUN_CLOSED",
          decision: "warn",
        },
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("generates catalog artifacts as dry-run by default and writes selected kinds on apply", async () => {
    const root = await mkdtemp(path.join(process.cwd(), ".tmp-harness-mcp-artifacts-"));

    try {
      const dryRun = structuredContent(
        await callTool("rms.generate_artifacts", {
          root,
          baseDir: root,
          kind: "skills",
        }),
      );

      expect(dryRun).toMatchObject({
        apply: false,
        dryRun: true,
        kind: "skills",
        artifactsPlanned: getSkillsCatalog().length,
        artifactsWritten: [],
      });
      expect(dryRun.artifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "skill",
            id: "classify-risk",
            relativePath: "artifacts/skills/classify-risk/SKILL.md",
          }),
        ]),
      );
      await expect(
        access(path.join(root, "artifacts", "skills", "classify-risk", "SKILL.md")),
      ).rejects.toThrow();

      const applied = structuredContent(
        await callTool("harness:generate_artifacts", {
          root,
          baseDir: root,
          kind: "skills",
          apply: true,
        }),
      );

      expect(applied).toMatchObject({
        apply: true,
        dryRun: false,
        kind: "skills",
        artifactsPlanned: getSkillsCatalog().length,
      });
      expect(asObject(applied).artifactsWritten).toHaveLength(getSkillsCatalog().length);
      await expect(
        access(path.join(root, "artifacts", "skills", "classify-risk", "SKILL.md")),
      ).resolves.toBeUndefined();
      await expect(access(path.join(root, "artifacts", "hooks"))).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("installs artifacts as dry-run by default through RMS MCP", async () => {
    const root = await mkdtemp(path.join(process.cwd(), ".tmp-harness-mcp-install-artifacts-dry-"));

    try {
      const result = structuredContent(
        await callTool("rms.install_artifacts", {
          root,
          target: "codex",
          kind: "hooks",
        }),
      );
      const projectRoot = String(result.projectRoot);

      expect(result).toMatchObject({
        apply: false,
        dryRun: true,
        target: "codex",
        kind: "hooks",
        selection: "hooks",
        root: projectRoot,
        projectRoot,
        platformDirectory: path.join(projectRoot, ".codex"),
        artifactsPlanned: operationalHookCount(),
        artifactsWritten: [],
        artifactsUnchanged: [],
      });
      expect(result.artifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "hook",
            id: "gate-policy",
            relativePath: "hooks/gate-policy.md",
          }),
        ]),
      );
      expect(result.actions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: "codex",
            artifactKind: "hook",
            id: "gate-policy",
            path: path.join(projectRoot, ".codex", "hooks", "gate-policy.md"),
            relativePath: "hooks/gate-policy.md",
            dryRun: true,
            status: "planned",
          }),
        ]),
      );
      await expect(access(path.join(root, ".codex", "hooks", "gate-policy.md"))).rejects.toThrow();
      await expect(
        access(path.join(root, "artifacts", "hooks", "gate-policy.md")),
      ).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("applies selected artifact installs through the harness MCP alias", async () => {
    const root = await mkdtemp(
      path.join(process.cwd(), ".tmp-harness-mcp-install-artifacts-apply-"),
    );

    try {
      const result = structuredContent(
        await callTool("harness:install_artifacts", {
          root,
          target: "claude",
          kind: "subagents",
          apply: true,
        }),
      );
      const projectRoot = String(result.projectRoot);

      expect(result).toMatchObject({
        apply: true,
        dryRun: false,
        writeManifest: false,
        captureRestoreSnapshots: false,
        target: "claude",
        kind: "subagents",
        selection: "subagents",
        root: projectRoot,
        projectRoot,
        platformDirectory: path.join(projectRoot, ".claude"),
        artifactsPlanned: getOperationalCatalog().subagents.length,
      });
      expect(asObject(result).artifactsWritten).toHaveLength(
        getOperationalCatalog().subagents.length,
      );
      expect(result.actions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: "claude",
            artifactKind: "subagent",
            id: "reviewer",
            path: path.join(projectRoot, ".claude", "agents", "reviewer.md"),
            relativePath: "agents/reviewer.md",
            dryRun: false,
            status: "written",
          }),
        ]),
      );
      await expect(
        access(path.join(root, ".claude", "agents", "reviewer.md")),
      ).resolves.toBeUndefined();
      await expect(access(path.join(root, ".claude", "hooks", "gate-policy.md"))).rejects.toThrow();
      await expect(
        access(path.join(root, "artifacts", "subagents", "reviewer.md")),
      ).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("writes selected artifact install manifests through the harness MCP alias", async () => {
    const root = await mkdtemp(
      path.join(process.cwd(), ".tmp-harness-mcp-install-artifacts-manifest-"),
    );

    try {
      const result = structuredContent(
        await callTool("harness:install_artifacts", {
          root,
          target: "codex",
          kind: "hooks",
          apply: true,
          writeManifest: true,
        }),
      );
      const projectRoot = String(result.projectRoot);
      const manifestFile = path.join(projectRoot, ".planning", "artifact-install-manifest.json");

      expect(result).toMatchObject({
        apply: true,
        dryRun: false,
        writeManifest: true,
        captureRestoreSnapshots: false,
        target: "codex",
        kind: "hooks",
        manifestFile,
        manifest: {
          schemaVersion: 1,
          target: "codex",
          selection: "hooks",
          writtenCount: operationalHookCount(),
        },
      });
      await expect(access(manifestFile)).resolves.toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("captures managed restore snapshots through the harness MCP alias when requested", async () => {
    const root = await mkdtemp(
      path.join(process.cwd(), ".tmp-harness-mcp-install-artifacts-snapshots-"),
    );
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
      const result = structuredContent(
        await callTool("harness:install_artifacts", {
          root,
          target: "codex",
          kind: "hooks",
          apply: true,
          writeManifest: true,
          captureRestoreSnapshots: true,
        }),
      );
      const manifest = asObject(result.manifest);
      const entries = manifest.entries as readonly JsonObject[];
      const gatePolicyEntry = asObject(entries.find((entry) => entry.id === "gate-policy"));
      const rollback = asObject(gatePolicyEntry.rollback);
      const restoreSnapshot = asObject(rollback.restoreSnapshot);

      expect(result).toMatchObject({
        apply: true,
        dryRun: false,
        writeManifest: true,
        captureRestoreSnapshots: true,
      });
      expect(restoreSnapshot).toMatchObject({
        encoding: "utf8",
        content: previousContent,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("refuses MCP install manifest writes during dry-run", async () => {
    const root = await mkdtemp(
      path.join(process.cwd(), ".tmp-harness-mcp-install-artifacts-manifest-dry-"),
    );

    try {
      const response = await callTool("rms.install_artifacts", {
        root,
        target: "codex",
        kind: "hooks",
        writeManifest: true,
      });

      expect(structuredContent(response).error).toContain(
        "writeManifest requires apply:true for install_artifacts",
      );
      await expect(
        access(path.join(root, ".planning", "artifact-install-manifest.json")),
      ).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("refuses MCP restore snapshot capture without a persisted manifest", async () => {
    const root = await mkdtemp(
      path.join(process.cwd(), ".tmp-harness-mcp-install-artifacts-snapshot-no-manifest-"),
    );

    try {
      const response = await callTool("rms.install_artifacts", {
        root,
        target: "codex",
        kind: "hooks",
        apply: true,
        captureRestoreSnapshots: true,
      });

      expect(structuredContent(response).error).toContain(
        "captureRestoreSnapshots requires writeManifest:true for install_artifacts",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps MCP artifact installs inside the MCP server project root", async () => {
    const outside = await mkdtemp(path.join(tmpdir(), "harness-mcp-install-artifacts-outside-"));

    try {
      const response = await callTool("rms.install_artifacts", {
        root: outside,
        target: "codex",
        kind: "skills",
        apply: true,
      });

      expect(structuredContent(response).error).toContain(
        "MCP install root must stay inside the project root",
      );
      await expect(
        access(path.join(outside, ".codex", "skills", "classify-risk", "SKILL.md")),
      ).rejects.toThrow();
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("installs, uninstalls, and repairs platform hooks through MCP", async () => {
    const root = await mkdtemp(path.join(process.cwd(), ".tmp-harness-mcp-platform-lifecycle-"));

    try {
      const manifestFile = path.join(root, ".planning", "install-manifest.json");
      const configFile = path.join(root, ".codex", "config.toml");
      const command = toHookCommand("pre_tool", "codex");

      const manifestOnly = structuredContent(
        await callTool("rms.install_platform", {
          root,
          target: "codex",
          writeManifest: true,
        }),
      );

      expect(manifestOnly).toMatchObject({
        apply: false,
        dryRun: true,
        writeManifest: true,
        target: "codex",
        manifestWritten: true,
        manifestFile,
      });
      expect(manifestOnly.applied).toBeUndefined();
      await expect(access(manifestFile)).resolves.toBeUndefined();
      await expect(access(configFile)).rejects.toThrow();

      const uninstallDryRun = structuredContent(
        await callTool("rms.uninstall_platform", {
          root,
        }),
      );

      expect(uninstallDryRun).toMatchObject({
        apply: false,
        dryRun: true,
        target: "codex",
        hooksPlanned: GATE_TYPES.length - 2,
        hooksRemoved: 0,
        manifestRetained: true,
      });
      await expect(access(configFile)).rejects.toThrow();

      const installApply = structuredContent(
        await callTool("harness:install_platform", {
          root,
          target: "codex",
          apply: true,
          writeManifest: true,
        }),
      );

      expect(installApply).toMatchObject({
        apply: true,
        dryRun: false,
        target: "codex",
        applied: {
          target: "codex",
          hooksAdded: GATE_TYPES.length - 2,
        },
      });
      expect(await readFile(configFile, "utf8")).toContain(command);

      const uninstallApply = structuredContent(
        await callTool("rms.uninstall_platform", {
          root,
          apply: true,
        }),
      );

      expect(uninstallApply).toMatchObject({
        apply: true,
        dryRun: false,
        target: "codex",
        hooksRemoved: GATE_TYPES.length - 2,
      });
      expect(await readFile(configFile, "utf8")).not.toContain(command);
      await expect(access(manifestFile)).resolves.toBeUndefined();

      const repairApply = structuredContent(
        await callTool("harness:repair_platform", {
          root,
          apply: true,
        }),
      );

      expect(repairApply).toMatchObject({
        apply: true,
        dryRun: false,
        target: "codex",
        hooksAdded: GATE_TYPES.length - 2,
      });
      expect(await readFile(configFile, "utf8")).toContain(command);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps MCP platform lifecycle roots inside the MCP server project root", async () => {
    const outside = await mkdtemp(path.join(tmpdir(), "harness-mcp-platform-outside-"));

    try {
      const install = await callTool("rms.install_platform", {
        root: outside,
        target: "codex",
        apply: true,
      });
      const uninstall = await callTool("rms.uninstall_platform", {
        root: outside,
        apply: true,
      });

      expect(structuredContent(install).error).toContain(
        "MCP platform root must stay inside the project root",
      );
      expect(structuredContent(uninstall).error).toContain(
        "MCP platform root must stay inside the project root",
      );
      await expect(access(path.join(outside, ".codex", "config.toml"))).rejects.toThrow();
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("orchestrates lifecycle dry-run, apply, blocked uninstall, and missing-manifest uninstall through MCP", async () => {
    const root = await mkdtemp(path.join(process.cwd(), ".tmp-harness-mcp-lifecycle-"));

    try {
      const configFile = path.join(root, ".codex", "config.toml");
      const artifactPath = path.join(root, ".codex", "hooks", "gate-policy.md");
      const platformManifestFile = path.join(root, ".planning", "install-manifest.json");
      const artifactManifestFile = path.join(root, ".planning", "artifact-install-manifest.json");
      const command = toHookCommand("pre_tool", "codex");

      const dryRun = structuredContent(
        await callTool("rms.apply_lifecycle", {
          root,
          target: "codex",
          kind: "hooks",
        }),
      );

      expect(dryRun).toMatchObject({
        ok: true,
        operation: "apply",
        apply: false,
        dryRun: true,
        writeManifests: false,
        target: "codex",
        kind: "hooks",
        artifactsWritten: [],
      });
      await expect(access(configFile)).rejects.toThrow();
      await expect(access(artifactPath)).rejects.toThrow();
      await expect(access(platformManifestFile)).rejects.toThrow();
      await expect(access(artifactManifestFile)).rejects.toThrow();

      const apply = structuredContent(
        await callTool("harness:apply_lifecycle", {
          root,
          target: "codex",
          kind: "hooks",
          apply: true,
        }),
      );

      expect(apply).toMatchObject({
        ok: true,
        operation: "apply",
        apply: true,
        dryRun: false,
        writeManifests: true,
        target: "codex",
        kind: "hooks",
        platformApplied: {
          target: "codex",
          hooksAdded: GATE_TYPES.length - 2,
        },
      });
      expect(asObject(apply).artifactsWritten).toHaveLength(operationalHookCount());
      await expect(access(configFile)).resolves.toBeUndefined();
      await expect(access(artifactPath)).resolves.toBeUndefined();
      await expect(access(platformManifestFile)).resolves.toBeUndefined();
      await expect(access(artifactManifestFile)).resolves.toBeUndefined();
      expect(await readFile(configFile, "utf8")).toContain(command);

      await writeFile(artifactPath, "tampered\n", "utf8");
      const blocked = structuredContent(
        await callTool("rms.uninstall_lifecycle", {
          root,
          apply: true,
        }),
      );

      expect(blocked.ok).toBe(false);
      expect(asObject(blocked).blockers).toHaveLength(1);
      expect(blocked.platformRemoved).toBeUndefined();
      expect(await readFile(configFile, "utf8")).toContain(command);

      await rm(artifactManifestFile);
      const missingArtifactManifest = structuredContent(
        await callTool("rms.uninstall_lifecycle", {
          root,
          apply: true,
        }),
      );

      expect(missingArtifactManifest).toMatchObject({
        ok: true,
        operation: "uninstall",
        apply: true,
        dryRun: false,
        target: "codex",
        artifactsRestored: [],
        artifactRollback: {
          skipped: true,
        },
        platformRemoved: {
          target: "codex",
          hooksRemoved: GATE_TYPES.length - 2,
        },
      });
      expect(await readFile(configFile, "utf8")).not.toContain(command);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects lifecycle uninstall artifact manifests outside the project through MCP", async () => {
    const root = await mkdtemp(path.join(process.cwd(), ".tmp-harness-mcp-lifecycle-outside-"));

    try {
      await callTool("rms.apply_lifecycle", {
        root,
        target: "codex",
        kind: "hooks",
        apply: true,
      });
      const response = await callTool("rms.uninstall_lifecycle", {
        root,
        apply: true,
        artifactManifestFile: path.resolve(root, "..", "missing-artifact-install-manifest.json"),
      });

      expect(structuredContent(response).error).toContain(
        "Artifact install manifest file must stay inside the project root",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("plans artifact rollback as dry-run by default through RMS MCP", async () => {
    const root = await mkdtemp(path.join(process.cwd(), ".tmp-harness-mcp-rollback-dry-"));

    try {
      const install = structuredContent(
        await callTool("rms.install_artifacts", {
          root,
          target: "codex",
          kind: "hooks",
          apply: true,
          writeManifest: true,
        }),
      );
      const projectRoot = String(install.projectRoot);
      const artifactPath = path.join(projectRoot, ".codex", "hooks", "gate-policy.md");
      const result = structuredContent(
        await callTool("rms.rollback_artifacts", {
          root,
        }),
      );

      expect(result).toMatchObject({
        apply: false,
        dryRun: true,
        root: projectRoot,
        projectRoot,
        target: "codex",
        platformDirectory: path.join(projectRoot, ".codex"),
        manifestFile: path.join(projectRoot, ".planning", "artifact-install-manifest.json"),
        artifactsPlanned: operationalHookCount(),
        actionsPlanned: operationalHookCount(),
        artifactsDeleted: 0,
        artifactsRestored: 0,
        deletedPaths: [],
        restoredPaths: [],
        blockers: [],
      });
      expect(result.actions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: artifactPath,
            relativePath: "hooks/gate-policy.md",
            dryRun: true,
            status: "planned",
          }),
        ]),
      );
      await expect(access(artifactPath)).resolves.toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("applies artifact rollback through the harness MCP alias", async () => {
    const root = await mkdtemp(path.join(process.cwd(), ".tmp-harness-mcp-rollback-apply-"));

    try {
      const install = structuredContent(
        await callTool("rms.install_artifacts", {
          root,
          target: "codex",
          kind: "hooks",
          apply: true,
          writeManifest: true,
        }),
      );
      const projectRoot = String(install.projectRoot);
      const artifactPath = path.join(projectRoot, ".codex", "hooks", "gate-policy.md");
      const result = structuredContent(
        await callTool("harness:rollback_artifacts", {
          root,
          apply: true,
        }),
      );

      expect(result).toMatchObject({
        apply: true,
        dryRun: false,
        root: projectRoot,
        projectRoot,
        target: "codex",
        artifactsDeleted: operationalHookCount(),
        artifactsRestored: 0,
        blockers: [],
      });
      expect(result.deletedPaths).toEqual(expect.arrayContaining([artifactPath]));
      expect(result.actions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: artifactPath,
            status: "deleted",
          }),
        ]),
      );
      await expect(access(artifactPath)).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps MCP artifact rollback roots inside the MCP server project root", async () => {
    const outside = await mkdtemp(path.join(tmpdir(), "harness-mcp-rollback-outside-"));

    try {
      const response = await callTool("rms.rollback_artifacts", {
        root: outside,
        apply: true,
      });

      expect(structuredContent(response).error).toContain(
        "MCP install root must stay inside the project root",
      );
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("keeps MCP generated artifact writes inside the MCP server project root", async () => {
    const outside = await mkdtemp(path.join(tmpdir(), "harness-mcp-artifacts-outside-root-"));

    try {
      const response = await callTool("rms.generate_artifacts", {
        root: outside,
        baseDir: outside,
        kind: "skills",
        apply: true,
      });

      expect(structuredContent(response).error).toContain(
        "MCP artifact root must stay inside the project root",
      );
      await expect(
        access(path.join(outside, "artifacts", "skills", "classify-risk", "SKILL.md")),
      ).rejects.toThrow();
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("keeps MCP artifact writes inside the declared project root", async () => {
    const root = await mkdtemp(path.join(process.cwd(), ".tmp-harness-mcp-artifacts-root-"));
    const outside = await mkdtemp(path.join(tmpdir(), "harness-mcp-artifacts-outside-"));

    try {
      const response = await callTool("rms.generate_artifacts", {
        root,
        baseDir: outside,
        kind: "skills",
        apply: true,
      });

      expect(structuredContent(response).error).toContain(
        "Artifact baseDir must stay inside the project root",
      );
      await expect(
        access(path.join(outside, "artifacts", "skills", "classify-risk", "SKILL.md")),
      ).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("keeps Sprint 6 harness aliases compatible with RMS tools", async () => {
    const root = await mkMcpProjectRoot("harness-mcp-sprint6-aliases-");

    try {
      await initProject(root);

      expect(structuredContent(await callTool("harness:get_catalog"))).toMatchObject({
        skills: expect.any(Array),
        hooks: expect.any(Array),
        subagents: expect.any(Array),
      });

      expect(
        structuredContent(
          await callTool("harness:runtime_digest", {
            target: "codex",
            gateType: "pre_tool",
          }),
        ),
      ).toMatchObject({
        target: "codex",
        gateType: "pre_tool",
        digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      });

      expect(
        structuredContent(await callTool("harness:evaluate_convergence", { root })),
      ).toMatchObject({
        status: "done_with_gaps",
        finalizationRecommendation: {
          finalState: "DONE_WITH_GAPS",
        },
      });

      expect(
        structuredContent(
          await callTool("harness:close_run", {
            root,
            closedAt: "2026-05-03T00:00:00.000Z",
            eventId: "mcp-close-alias-1",
          }),
        ),
      ).toMatchObject({
        evaluation: {
          status: "done_with_gaps",
        },
        runSet: {
          finalization: {
            state: "DONE_WITH_GAPS",
          },
        },
        event: {
          id: "mcp-close-alias-1",
          type: "RUN_CLOSED",
          decision: "warn",
        },
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("prevents raw MCP log events from forging policy events and redacts payloads", async () => {
    const root = await mkMcpProjectRoot("harness-mcp-log-event-");

    try {
      await initProject(root);

      const forged = await callTool("harness:log_event", {
        root,
        type: "GATE_EVALUATED",
        gateType: "post_tool",
        decision: "block",
        payload: {
          violationType: "SECRET_IN_PLAINTEXT",
          finalState: "BLOCKED_POLICY",
        },
      });

      expect(forged.isError).toBe(true);
      expect(structuredContent(forged).error).toContain("policy-significant");

      expect(
        structuredContent(
          await callTool("harness:log_event", {
            root,
            type: "MCP_AUDIT",
            reason: "debug token=ghp_abcdefghijklmnopqrstuvwxyz123456",
            payload: {
              token: "ghp_abcdefghijklmnopqrstuvwxyz123456",
              password: "correct-horse-battery-staple",
              nested: {
                secret: "abcdefghijklmnopqrstuvwxyz123456",
              },
            },
          }),
        ),
      ).toMatchObject({
        logged: true,
        event: {
          type: "MCP_AUDIT",
        },
      });

      const project = await readPlanningProject(root);
      expect(project.runSet.events).toHaveLength(1);
      expect(project.runSet.events[0].reason).toBe("debug token=[REDACTED]");
      expect(project.runSet.events[0].payload).toMatchObject({
        token: "[REDACTED]",
        password: "[REDACTED]",
        nested: {
          secret: "[REDACTED]",
        },
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.each([
    null,
    "not-an-object",
    [],
    42,
    true,
  ])("rejects non-object MCP log_event payload %j", async (payload) => {
    const root = await mkMcpProjectRoot("harness-mcp-log-payload-");

    try {
      await initProject(root);

      const response = await callTool("harness:log_event", {
        root,
        type: "MCP_AUDIT",
        payload,
      });

      expect(response.isError).toBe(true);
      expect(structuredContent(response).error).toContain(
        "payload must be an object when provided",
      );
      expect((await readPlanningProject(root)).runSet.events).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
