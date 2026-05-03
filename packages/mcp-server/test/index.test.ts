import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  ARTIFACT_INSTALL_SELECTIONS,
  ARTIFACT_INSTALL_TARGETS,
  CHANGE_TYPES,
  DEFAULT_EVIDENCE_KEY,
  DEFAULT_EVIDENCE_STATUS,
  DEFAULT_RUNTIME_CAPABILITY_STATUS,
  EVIDENCE_STATUSES,
  GATE_DECISIONS,
  getOperationalCatalog,
  getSkillsCatalog,
  initProject,
  MISSING_RUNTIME_BINDING_STATUS,
  RUNTIME_CAPABILITY_STATUSES,
  readPlanningProject,
} from "@harness/core";
import { describe, expect, it } from "vitest";
import { dispatchRequest } from "../src/index.js";

type JsonObject = Record<string, unknown>;

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
        "rms.classify_risk",
        "rms.record_evidence",
        "rms.evaluate_gate",
        "rms.inspect_runtime",
        "rms.bind_runtime",
        "rms.get_catalog",
        "rms.generate_artifacts",
        "rms.install_artifacts",
        "rms.runtime_digest",
        "rms.evaluate_convergence",
        "rms.close_run",
        "harness:get_state",
        "harness:get_risk_class",
        "harness:evaluate_gate",
        "harness:record_evidence",
        "harness:log_event",
        "harness:get_catalog",
        "harness:generate_artifacts",
        "harness:install_artifacts",
        "harness:runtime_digest",
        "harness:evaluate_convergence",
        "harness:close_run",
      ]),
    );

    const inspectRuntimeTool = tools.find((tool) => tool.name === "rms.inspect_runtime");
    const inspectRuntimeSchema = asObject(inspectRuntimeTool?.inputSchema);
    const inspectRuntimeProperties = asObject(inspectRuntimeSchema.properties);
    const statusProperty = asObject(inspectRuntimeProperties.status);

    expect(statusProperty.enum).toEqual([...RUNTIME_CAPABILITY_STATUSES]);
    expect(statusProperty.default).toBe(DEFAULT_RUNTIME_CAPABILITY_STATUS);

    const classifyRiskTool = tools.find((tool) => tool.name === "rms.classify_risk");
    const classifyRiskProperties = asObject(asObject(classifyRiskTool?.inputSchema).properties);
    const changeTypeProperty = asObject(classifyRiskProperties.changeType);

    expect(changeTypeProperty.enum).toEqual([...CHANGE_TYPES]);

    const logEventTool = tools.find((tool) => tool.name === "harness:log_event");
    const logEventProperties = asObject(asObject(logEventTool?.inputSchema).properties);
    const decisionProperty = asObject(logEventProperties.decision);

    expect(decisionProperty.enum).toEqual([...GATE_DECISIONS]);

    const recordEvidenceTool = tools.find((tool) => tool.name === "rms.record_evidence");
    const recordEvidenceProperties = asObject(asObject(recordEvidenceTool?.inputSchema).properties);
    const evidenceStatusProperty = asObject(recordEvidenceProperties.status);
    const evidenceKeyProperty = asObject(recordEvidenceProperties.key);

    expect(evidenceStatusProperty.enum).toEqual([...EVIDENCE_STATUSES]);
    expect(evidenceStatusProperty.default).toBe(DEFAULT_EVIDENCE_STATUS);
    expect(evidenceKeyProperty.default).toBe(DEFAULT_EVIDENCE_KEY);

    const generateArtifactsTool = tools.find((tool) => tool.name === "rms.generate_artifacts");
    const generateArtifactsProperties = asObject(
      asObject(generateArtifactsTool?.inputSchema).properties,
    );
    const kindProperty = asObject(generateArtifactsProperties.kind);
    const applyProperty = asObject(generateArtifactsProperties.apply);

    expect(kindProperty.enum).toEqual(["all", "skills", "books", "subagents"]);
    expect(kindProperty.default).toBe("all");
    expect(applyProperty.default).toBe(false);

    const installArtifactsTool = tools.find((tool) => tool.name === "rms.install_artifacts");
    const installArtifactsProperties = asObject(
      asObject(installArtifactsTool?.inputSchema).properties,
    );
    const installTargetProperty = asObject(installArtifactsProperties.target);
    const installKindProperty = asObject(installArtifactsProperties.kind);

    expect(installTargetProperty.enum).toEqual([...ARTIFACT_INSTALL_TARGETS]);
    expect(installKindProperty.enum).toEqual([...ARTIFACT_INSTALL_SELECTIONS]);
    expect(installKindProperty.default).toBe("all");
    expect(installArtifactsProperties.baseDir).toBeUndefined();
  });
});

describe("RMS MCP tools", () => {
  it("reads state, transitions, classifies risk, records evidence, and preserves aliases", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-mcp-"));

    try {
      await initProject(root);

      expect(structuredContent(await callTool("rms.get_state", { root }))).toMatchObject({
        phase: "discovery",
        subPhase: "Observer",
        riskClass: "T",
      });

      expect(structuredContent(await callTool("rms.transition", { root }))).toMatchObject({
        success: true,
        newSnapshot: {
          phase: "discovery",
          sub_phase: "Define",
        },
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

  it("inspects and binds runtime capabilities into the canonical run-set", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-mcp-runtime-"));

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

      expect(
        structuredContent(
          await callTool("rms.inspect_runtime", {
            root,
            target: "codex",
            inspectedAt: "2026-05-03T00:00:00.000Z",
            configDigest: digest,
            knownLimitations: ["mcp test limitation"],
            hooks: {
              pre_tool: {
                nativeEvent: "PreToolUse",
                canBlock: true,
                status: DEFAULT_RUNTIME_CAPABILITY_STATUS,
                configDigest: preToolDigest,
              },
            },
          }),
        ),
      ).toMatchObject({
        target: "codex",
        configDigest: digest,
        knownLimitations: ["mcp test limitation"],
        hooks: {
          pre_tool: {
            nativeEvent: "PreToolUse",
            canBlock: true,
            configDigest: preToolDigest,
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
          status: "native",
          canBlock: true,
          configDigest: digest,
        },
        subagent_stop: {
          status: MISSING_RUNTIME_BINDING_STATUS,
          canBlock: false,
        },
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not let MCP inputs forge native blocking bindings", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-mcp-runtime-forged-"));

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
    const root = await mkdtemp(path.join(tmpdir(), "harness-mcp-human-evidence-"));

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

  it("exposes operational catalog, runtime digest, convergence, and close tools", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-mcp-sprint6-"));

    try {
      await initProject(root);

      expect(structuredContent(await callTool("rms.get_catalog"))).toMatchObject({
        skills: expect.any(Array),
        books: expect.any(Array),
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
    const root = await mkdtemp(path.join(tmpdir(), "harness-mcp-artifacts-"));

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
      await expect(access(path.join(root, "artifacts", "books"))).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("installs artifacts as dry-run by default through RMS MCP", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-mcp-install-artifacts-dry-"));

    try {
      const result = structuredContent(
        await callTool("rms.install_artifacts", {
          root,
          target: "codex",
          kind: "books",
        }),
      );
      const projectRoot = String(result.projectRoot);

      expect(result).toMatchObject({
        apply: false,
        dryRun: true,
        target: "codex",
        kind: "books",
        selection: "books",
        root: projectRoot,
        projectRoot,
        platformDirectory: path.join(projectRoot, ".codex"),
        artifactsPlanned: getOperationalCatalog().books.length,
        artifactsWritten: [],
        artifactsUnchanged: [],
      });
      expect(result.artifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "book",
            id: "gate-policy",
            relativePath: "books/gate-policy.md",
          }),
        ]),
      );
      expect(result.actions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: "codex",
            artifactKind: "book",
            id: "gate-policy",
            path: path.join(projectRoot, ".codex", "books", "gate-policy.md"),
            relativePath: "books/gate-policy.md",
            dryRun: true,
            status: "planned",
          }),
        ]),
      );
      await expect(access(path.join(root, ".codex", "books", "gate-policy.md"))).rejects.toThrow();
      await expect(
        access(path.join(root, "artifacts", "books", "gate-policy.md")),
      ).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("applies selected artifact installs through the harness MCP alias", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-mcp-install-artifacts-apply-"));

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
      await expect(access(path.join(root, ".claude", "books", "gate-policy.md"))).rejects.toThrow();
      await expect(
        access(path.join(root, "artifacts", "subagents", "reviewer.md")),
      ).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps MCP artifact writes inside the declared project root", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-mcp-artifacts-root-"));
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
    const root = await mkdtemp(path.join(tmpdir(), "harness-mcp-sprint6-aliases-"));

    try {
      await initProject(root);

      expect(structuredContent(await callTool("harness:get_catalog"))).toMatchObject({
        skills: expect.any(Array),
        books: expect.any(Array),
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
    const root = await mkdtemp(path.join(tmpdir(), "harness-mcp-log-event-"));

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
});
