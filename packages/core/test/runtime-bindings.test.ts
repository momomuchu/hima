import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bindRuntime,
  buildRuntimeBindings,
  computeRuntimeHookDigest,
  computeRuntimeProfileDigest,
  createDefaultPlanningProject,
  evaluateGate,
  type GateEvaluationContext,
  getPlanningPaths,
  initPlanningProject,
  inspectRuntime,
  type RunSetFile,
  readPlanningProject,
} from "../src/index.js";
import type { RiskClass } from "../src/types/canonical.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "harness-runtime-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function riskContext(
  riskClass: RiskClass,
  overrides: Partial<GateEvaluationContext> = {},
): GateEvaluationContext {
  const project = createDefaultPlanningProject("run_test");

  return {
    projectRoot: root,
    state: project.state,
    currentRisk: {
      ...project.currentRisk,
      risk_class: riskClass,
      rank: { T: 0, L: 1, M: 2, H: 3, C: 4 }[riskClass],
      bypass_allowed: riskClass === "T" || riskClass === "L",
      human_checkpoint_required: riskClass === "H" || riskClass === "C",
    },
    runSet: {
      ...project.runSet,
      route: {
        ...project.runSet.route,
        riskClass,
      },
    },
    ...overrides,
  };
}

describe("runtime bindings", () => {
  it("computes a deterministic profile digest", () => {
    const first = computeRuntimeProfileDigest("codex");
    const second = computeRuntimeProfileDigest("codex");

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toBe(computeRuntimeProfileDigest("claude"));
  });

  it("does not treat a runtime name alone as binding proof", async () => {
    await initPlanningProject(root);

    await bindRuntime(root, "codex", { inspectedAt: "2026-05-03T00:00:00.000Z" });
    const project = await readPlanningProject(root);

    expect(project.runSet.runtimeBindings.activeTarget).toBe("codex");
    expect(project.runSet.runtimeBindings.gates?.pre_tool?.status).toBe("capability_unknown");
    expect(project.runSet.runtimeBindings.gates?.pre_tool?.status).not.toBe("native");
  });

  it("binds Codex subagent_stop as missing, never native", async () => {
    await initPlanningProject(root);
    await inspectRuntime(root, "codex", { inspectedAt: "2026-05-03T00:00:00.000Z" });

    const bindings = await bindRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:01.000Z",
    });

    expect(bindings.subagent_stop.status).toBe("missing");
    expect(bindings.subagent_stop.nativeEvent).toBeNull();
    expect(bindings.subagent_stop.status).not.toBe("native");
  });

  it("blocks medium pre_tool when the required binding is absent", () => {
    const result = evaluateGate(riskContext("M"), {
      gateType: "pre_tool",
      toolName: "read_file",
      toolInput: {},
    });

    expect(result.decision).toBe("block");
    expect(result.finalState).toBe("BLOCKED_RUNTIME_MISSING");
    expect(result.violationType).toBe("RUNTIME_BINDING_UNAVAILABLE");
  });

  it("blocks medium user_prompt when the required binding is absent", () => {
    const result = evaluateGate(riskContext("M"), {
      gateType: "user_prompt",
      promptContent: "continue with governed work",
    });

    expect(result.decision).toBe("block");
    expect(result.gateType).toBe("user_prompt");
    expect(result.violationType).toBe("RUNTIME_BINDING_UNAVAILABLE");
  });

  it("blocks medium subagent gates when required bindings are absent", () => {
    const start = evaluateGate(riskContext("M"), {
      gateType: "subagent_start",
      metadata: { scope: [".planning/01-discovery/notes.md"], depth: 1 },
    });
    const base = riskContext("M");
    const stop = evaluateGate(
      riskContext("M", {
        runSet: {
          ...base.runSet,
          subagents: [{ agentId: "worker-a" }],
          evidence: [
            {
              id: "worker-a-tests",
              key: "subagent_output",
              kind: "verification",
              status: "accepted",
              summary: "worker-a verified the assigned slice",
              createdAt: "2026-05-03T00:00:00.000Z",
            },
          ],
        },
      }),
      {
        gateType: "subagent_stop",
        metadata: { agentId: "worker-a" },
      },
    );

    expect(start.decision).toBe("block");
    expect(start.violationType).toBe("RUNTIME_BINDING_UNAVAILABLE");
    expect(stop.decision).toBe("block");
    expect(stop.violationType).toBe("RUNTIME_BINDING_UNAVAILABLE");
  });

  it("allows medium pre_tool with a fresh native canBlock binding", async () => {
    const digest = computeRuntimeProfileDigest("codex");
    await initPlanningProject(root);
    await inspectRuntime(root, "codex", { inspectedAt: "2026-05-03T00:00:00.000Z" });
    await bindRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:01.000Z",
      expectedDigest: digest,
      currentDigest: digest,
    });
    const project = await readPlanningProject(root);

    const result = evaluateGate(
      riskContext("M", {
        state: {
          ...project.state,
          phase: "build",
          sub_phase: "Execute",
        },
        runSet: project.runSet,
      }),
      {
        gateType: "pre_tool",
        toolName: "write_file",
        toolInput: { path: "src/index.ts" },
      },
    );

    expect(project.runSet.runtimeBindings.gates?.pre_tool?.status).toBe("native");
    expect(project.runSet.runtimeBindings.gates?.pre_tool?.canBlock).toBe(true);
    expect(result.decision).toBe("allow");
  });

  it("keeps a native binding when expected and current digests match", async () => {
    const digest = computeRuntimeProfileDigest("codex");
    await initPlanningProject(root);
    await inspectRuntime(root, "codex", { inspectedAt: "2026-05-03T00:00:00.000Z" });

    const bindings = await bindRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:01.000Z",
      expectedDigest: digest,
      currentDigest: digest,
    });

    expect(bindings.pre_tool.status).toBe("native");
    expect(bindings.pre_tool.configDigest).toBe(digest);
  });

  it("marks bindings stale when expected and current digests differ", async () => {
    const digest = computeRuntimeProfileDigest("codex");
    await initPlanningProject(root);
    await inspectRuntime(root, "codex", { inspectedAt: "2026-05-03T00:00:00.000Z" });

    const bindings = await bindRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:01.000Z",
      expectedDigest: digest,
      currentDigest: "0".repeat(64),
    });

    expect(bindings.pre_tool.status).toBe("stale");
    expect(bindings.pre_tool.canBlock).toBe(false);
    expect(bindings.pre_tool.reason).toContain("runtime capability digest mismatch");
    expect(bindings.pre_tool.reason).toContain(`expected ${digest}`);
  });

  it("marks otherwise native bindings stale when digest proof is missing", async () => {
    const bindings = buildRuntimeBindings(
      "codex",
      {
        target: "codex",
        runtimeName: "codex",
        status: "available",
        inspectedAt: "2026-05-03T00:00:00.000Z",
        hooks: {
          pre_tool: {
            gateType: "pre_tool",
            nativeEvent: "PreToolUse",
            canBlock: true,
            status: "available",
            inspectedAt: "2026-05-03T00:00:00.000Z",
          },
        },
        knownLimitations: [],
      },
      "2026-05-03T00:00:01.000Z",
    );

    expect(bindings.pre_tool.status).toBe("stale");
    expect(bindings.pre_tool.canBlock).toBe(false);
    expect(bindings.pre_tool.reason).toContain("runtime capability digest proof is missing");
  });

  it("does not bind forged blocking claims beyond the trusted Codex profile", async () => {
    const digest = computeRuntimeProfileDigest("codex");
    await initPlanningProject(root);

    const capability = await inspectRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:00.000Z",
      hooks: {
        subagent_start: {
          nativeEvent: "SubagentStart",
          canBlock: true,
          status: "available",
          configDigest: computeRuntimeHookDigest("claude", "subagent_start"),
        },
      },
    });
    const bindings = await bindRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:01.000Z",
      expectedDigest: digest,
      currentDigest: digest,
    });

    expect(capability.hooks.subagent_start?.nativeEvent).toBeNull();
    expect(capability.hooks.subagent_start?.canBlock).toBe(false);
    expect(bindings.subagent_start.status).toBe("missing");
    expect(bindings.subagent_start.canBlock).toBe(false);
    expect(bindings.subagent_start.status).not.toBe("native");
  });

  it("blocks high-risk gates when forged blocking proof is missing", async () => {
    await initPlanningProject(root);
    await inspectRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:00.000Z",
      hooks: {
        pre_tool: {
          nativeEvent: "PreToolUse",
          canBlock: true,
          status: "available",
        },
      },
    });
    const bindings = await bindRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:01.000Z",
    });
    const project = await readPlanningProject(root);

    const result = evaluateGate(
      riskContext("H", {
        state: {
          ...project.state,
          phase: "build",
          sub_phase: "Execute",
        },
        runSet: project.runSet,
      }),
      {
        gateType: "pre_tool",
        toolName: "write_file",
        toolInput: { path: "src/index.ts" },
      },
    );

    expect(bindings.pre_tool.status).toBe("stale");
    expect(bindings.pre_tool.canBlock).toBe(false);
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("RUNTIME_BINDING_UNAVAILABLE");
  });

  it("stores capabilities and bindings only inside run-set.json", async () => {
    const digest = computeRuntimeProfileDigest("codex");
    await initPlanningProject(root);
    await inspectRuntime(root, "codex", { inspectedAt: "2026-05-03T00:00:00.000Z" });
    await bindRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:01.000Z",
      expectedDigest: digest,
      currentDigest: digest,
    });

    const paths = getPlanningPaths(root);
    const planningEntries = await readdir(paths.planningDir);
    const runSet = JSON.parse(await readFile(paths.runSetFile, "utf8")) as RunSetFile;

    expect(planningEntries.sort()).toEqual(["current-risk.yaml", "run-set.json", "state.yaml"]);
    expect(runSet.runtimeCapabilities.codex?.hooks.pre_tool?.nativeEvent).toBe("PreToolUse");
    expect(runSet.runtimeBindings.gates?.pre_tool?.status).toBe("native");
  });
});
