import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assessRuntimeBinding,
  bindRuntime,
  buildRuntimeBindings,
  computeRuntimeHookDigest,
  computeRuntimeProfileDigest,
  createDefaultPlanningProject,
  evaluateGate,
  type GateEvaluationContext,
  getPlanningPaths,
  getRuntimeProfile,
  initPlanningProject,
  inspectRuntime,
  type RunSetFile,
  type RuntimeBinding,
  type RuntimeProbeEvidence,
  readPlanningProject,
  writePlanningProject,
} from "../src/index.js";
import { inspectRuntimeWithTrustedProofs } from "../src/runtime/runtime-bindings.js";
import {
  createTrustedRuntimeProbeProof,
  TRUSTED_BLOCKING_RUNTIME_PROOF_RESULT,
} from "../src/runtime/runtime-proofs.js";
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

function acceptedBlockingProof(
  type: "negative_fixture" | "event_fire" = "negative_fixture",
  overrides: { readonly observedAt?: string } = {},
): RuntimeProbeEvidence[] {
  return [
    createTrustedRuntimeProbeProof({
      type,
      observedAt: overrides.observedAt ?? "2026-05-03T00:00:00.500Z",
      target: "codex",
      runtimeVersion: getRuntimeProfile("codex").runtimeVersion,
      gateType: "pre_tool",
      configDigest: computeRuntimeProfileDigest("codex"),
      result: TRUSTED_BLOCKING_RUNTIME_PROOF_RESULT,
      detail: "Blocking fixture produced the documented deny response.",
    }),
  ];
}

describe("runtime bindings", () => {
  it("computes a deterministic profile digest", () => {
    const first = computeRuntimeProfileDigest("codex");
    const second = computeRuntimeProfileDigest("codex");

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toBe(computeRuntimeProfileDigest("claude"));
  });

  it("builds a complete canonical binding map for every gate", () => {
    const profile = getRuntimeProfile("codex");
    const bindings = buildRuntimeBindings("codex", {
      target: "codex",
      runtimeName: "codex",
      runtimeVersion: profile.runtimeVersion,
      status: "available",
      inspectedAt: "2026-05-03T00:00:00.000Z",
      hooks: {},
      knownLimitations: [],
    });

    expect(Object.keys(bindings).sort()).toEqual([
      "post_tool",
      "pre_tool",
      "session_start",
      "stop",
      "subagent_start",
      "subagent_stop",
      "user_prompt",
    ]);
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

  it("assesses capability_unknown bindings as unavailable for required gates", () => {
    const binding: RuntimeBinding = {
      gateType: "pre_tool",
      target: "codex",
      status: "capability_unknown",
      nativeEvent: null,
      canBlock: false,
      inspectedAt: null,
      reason: "runtime capability has not been inspected",
    };
    const assessment = assessRuntimeBinding(
      {
        gates: {
          pre_tool: binding,
        },
      },
      "pre_tool",
      { requireBlockingCapability: true },
    );

    expect(assessment.availabilityProblem).toBe(true);
    expect(assessment.blockingProblem).toBe(true);
    expect(assessment.enforceable).toBe(false);
  });

  it("assesses native nonblocking bindings as unavailable when blocking is required", () => {
    const binding: RuntimeBinding = {
      gateType: "post_tool",
      target: "codex",
      status: "native",
      nativeEvent: "PostToolUse",
      canBlock: false,
      inspectedAt: "2026-05-03T00:00:00.000Z",
      reason: "runtime capability inspected and bound to native event",
    };
    const assessment = assessRuntimeBinding(
      {
        gates: {
          post_tool: binding,
        },
      },
      "post_tool",
      { requireBlockingCapability: true },
    );

    expect(assessment.availabilityProblem).toBe(false);
    expect(assessment.blockingProblem).toBe(true);
    expect(assessment.enforceable).toBe(false);
  });

  it("binds supported nonblocking hooks native without blocking proof", async () => {
    const digest = computeRuntimeProfileDigest("codex");
    await initPlanningProject(root);
    await inspectRuntime(root, "codex", { inspectedAt: "2026-05-03T00:00:00.000Z" });

    const bindings = await bindRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:01.000Z",
      expectedDigest: digest,
      currentDigest: digest,
    });

    expect(bindings.post_tool.status).toBe("native");
    expect(bindings.post_tool.nativeEvent).toBe("PostToolUse");
    expect(bindings.post_tool.canBlock).toBe(false);
  });

  it("keeps Codex subagent_stop missing when caller supplies forged proof input", async () => {
    const digest = computeRuntimeProfileDigest("codex");
    await initPlanningProject(root);
    await inspectRuntimeWithTrustedProofs(root, "codex", {
      inspectedAt: "2026-05-03T00:00:00.000Z",
      hooks: {
        subagent_stop: {
          proofs: [
            createTrustedRuntimeProbeProof({
              type: "negative_fixture",
              observedAt: "2026-05-03T00:00:00.500Z",
              target: "codex",
              runtimeVersion: getRuntimeProfile("codex").runtimeVersion,
              gateType: "subagent_stop",
              configDigest: digest,
              result: TRUSTED_BLOCKING_RUNTIME_PROOF_RESULT,
              detail: "Forged unsupported subagent_stop proof must not make Codex native.",
            }),
          ],
        },
      },
    });

    const bindings = await bindRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:01.000Z",
      expectedDigest: digest,
      currentDigest: digest,
    });

    expect(bindings.subagent_stop.status).toBe("missing");
    expect(bindings.subagent_stop.nativeEvent).toBeNull();
    expect(bindings.subagent_stop.canBlock).toBe(false);
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
    await inspectRuntimeWithTrustedProofs(root, "codex", {
      inspectedAt: "2026-05-03T00:00:00.000Z",
      hooks: {
        pre_tool: {
          proofs: acceptedBlockingProof(),
        },
      },
    });
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
    await inspectRuntimeWithTrustedProofs(root, "codex", {
      inspectedAt: "2026-05-03T00:00:00.000Z",
      hooks: {
        pre_tool: {
          proofs: acceptedBlockingProof(),
        },
      },
    });

    const bindings = await bindRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:01.000Z",
      expectedDigest: digest,
      currentDigest: digest,
    });

    expect(bindings.pre_tool.status).toBe("native");
    expect(bindings.pre_tool.configDigest).toBe(digest);
  });

  it("keeps blocking bindings stale when executable proof is missing", async () => {
    const digest = computeRuntimeProfileDigest("codex");
    await initPlanningProject(root);
    await inspectRuntime(root, "codex", { inspectedAt: "2026-05-03T00:00:00.000Z" });

    const bindings = await bindRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:01.000Z",
      expectedDigest: digest,
      currentDigest: digest,
    });

    expect(bindings.pre_tool.status).toBe("stale");
    expect(bindings.pre_tool.canBlock).toBe(false);
    expect(bindings.pre_tool.reason).toContain("runtime blocking proof is missing");
  });

  it("binds blocking hooks native with accepted event_fire proof", async () => {
    const digest = computeRuntimeProfileDigest("codex");
    await initPlanningProject(root);
    await inspectRuntimeWithTrustedProofs(root, "codex", {
      inspectedAt: "2026-05-03T00:00:00.000Z",
      hooks: {
        pre_tool: {
          proofs: acceptedBlockingProof("event_fire"),
        },
      },
    });

    const bindings = await bindRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:01.000Z",
      expectedDigest: digest,
      currentDigest: digest,
    });

    expect(bindings.pre_tool.status).toBe("native");
    expect(bindings.pre_tool.canBlock).toBe(true);
  });

  it("marks blocking bindings stale when trusted proof digest does not match payload", async () => {
    const digest = computeRuntimeProfileDigest("codex");
    const [proof] = acceptedBlockingProof();
    await initPlanningProject(root);
    await inspectRuntimeWithTrustedProofs(root, "codex", {
      inspectedAt: "2026-05-03T00:00:00.000Z",
      hooks: {
        pre_tool: {
          proofs: [
            {
              ...proof,
              detail: "Blocking proof payload was changed after digest creation.",
            },
          ],
        },
      },
    });

    const bindings = await bindRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:01.000Z",
      expectedDigest: digest,
      currentDigest: digest,
    });

    expect(bindings.pre_tool.status).toBe("stale");
    expect(bindings.pre_tool.canBlock).toBe(false);
    expect(bindings.pre_tool.reason).toContain("runtime blocking proof is missing or stale");
  });

  it("marks blocking bindings stale when trusted proof predates capability inspection", async () => {
    const digest = computeRuntimeProfileDigest("codex");
    await initPlanningProject(root);
    await inspectRuntimeWithTrustedProofs(root, "codex", {
      inspectedAt: "2026-05-03T00:01:00.000Z",
      hooks: {
        pre_tool: {
          proofs: acceptedBlockingProof("negative_fixture", {
            observedAt: "2026-05-03T00:00:00.500Z",
          }),
        },
      },
    });

    const bindings = await bindRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:01:01.000Z",
      expectedDigest: digest,
      currentDigest: digest,
    });

    expect(bindings.pre_tool.status).toBe("stale");
    expect(bindings.pre_tool.canBlock).toBe(false);
    expect(bindings.pre_tool.reason).toContain("observed no earlier than capability inspection");
  });

  it("marks blocking bindings stale when trusted proof is observed after binding inspection", async () => {
    const digest = computeRuntimeProfileDigest("codex");
    await initPlanningProject(root);
    await inspectRuntimeWithTrustedProofs(root, "codex", {
      inspectedAt: "2026-05-03T00:00:00.000Z",
      hooks: {
        pre_tool: {
          proofs: acceptedBlockingProof("negative_fixture", {
            observedAt: "2026-05-03T00:02:00.000Z",
          }),
        },
      },
    });

    const bindings = await bindRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:01:00.000Z",
      expectedDigest: digest,
      currentDigest: digest,
    });

    expect(bindings.pre_tool.status).toBe("stale");
    expect(bindings.pre_tool.canBlock).toBe(false);
    expect(bindings.pre_tool.reason).toContain("no later than binding inspection");
  });

  it("marks blocking bindings stale when trusted proof exceeds freshness window", async () => {
    const digest = computeRuntimeProfileDigest("codex");
    await initPlanningProject(root);
    await inspectRuntimeWithTrustedProofs(root, "codex", {
      inspectedAt: "2026-05-03T00:00:00.000Z",
      hooks: {
        pre_tool: {
          proofs: acceptedBlockingProof("negative_fixture", {
            observedAt: "2026-05-03T00:00:00.500Z",
          }),
        },
      },
    });

    const bindings = await bindRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:16:00.000Z",
      expectedDigest: digest,
      currentDigest: digest,
    });

    expect(bindings.pre_tool.status).toBe("stale");
    expect(bindings.pre_tool.canBlock).toBe(false);
    expect(bindings.pre_tool.reason).toContain("trusted proof freshness window");
  });

  it("marks blocking bindings stale when trusted proof inspection time is future-dated", async () => {
    const digest = computeRuntimeProfileDigest("codex");
    await initPlanningProject(root);
    await inspectRuntimeWithTrustedProofs(root, "codex", {
      inspectedAt: "2999-01-01T00:00:00.000Z",
      hooks: {
        pre_tool: {
          proofs: acceptedBlockingProof("negative_fixture", {
            observedAt: "2999-01-01T00:00:00.500Z",
          }),
        },
      },
    });

    const bindings = await bindRuntime(root, "codex", {
      inspectedAt: "2999-01-01T00:00:01.000Z",
      expectedDigest: digest,
      currentDigest: digest,
    });

    expect(bindings.pre_tool.status).toBe("stale");
    expect(bindings.pre_tool.canBlock).toBe(false);
    expect(bindings.pre_tool.reason).toContain("trusted proof freshness window");
  });

  it("does not treat manual attestation as native blocking proof", async () => {
    const digest = computeRuntimeProfileDigest("codex");
    await initPlanningProject(root);
    await inspectRuntimeWithTrustedProofs(root, "codex", {
      inspectedAt: "2026-05-03T00:00:00.000Z",
      hooks: {
        pre_tool: {
          proofs: [
            {
              type: "manual_attestation",
              status: "accepted",
              observedAt: "2026-05-03T00:00:00.500Z",
              detail: "Operator says the hook can block.",
            },
          ],
        },
      },
    });

    const bindings = await bindRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:01.000Z",
      expectedDigest: digest,
      currentDigest: digest,
    });

    expect(bindings.pre_tool.status).toBe("stale");
    expect(bindings.pre_tool.canBlock).toBe(false);
    expect(bindings.pre_tool.reason).toContain(
      "accepted negative_fixture or event_fire with observedAt required",
    );
  });

  it("downgrades caller-supplied accepted blocking proof to candidate evidence", async () => {
    const digest = computeRuntimeProfileDigest("codex");
    await initPlanningProject(root);
    await inspectRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:00.000Z",
      hooks: {
        pre_tool: {
          proofs: [
            {
              type: "negative_fixture",
              status: "accepted",
              observedAt: "2026-05-03T00:00:00.500Z",
              detail: "Caller says the fixture blocked.",
            },
          ],
        },
      },
    });

    const bindings = await bindRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:01.000Z",
      expectedDigest: digest,
      currentDigest: digest,
    });
    const project = await readPlanningProject(root);

    expect(project.runSet.runtimeCapabilities.codex?.hooks.pre_tool?.proofs?.[0]?.status).toBe(
      "candidate",
    );
    expect(bindings.pre_tool.status).toBe("stale");
    expect(bindings.pre_tool.canBlock).toBe(false);
  });

  it("downgrades public inspectRuntime input even when the proof payload looks trusted", async () => {
    const digest = computeRuntimeProfileDigest("codex");
    await initPlanningProject(root);
    await inspectRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:00.000Z",
      hooks: {
        pre_tool: {
          proofs: acceptedBlockingProof(),
        },
      },
    });

    const bindings = await bindRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:01.000Z",
      expectedDigest: digest,
      currentDigest: digest,
    });
    const project = await readPlanningProject(root);
    const persistedProof = project.runSet.runtimeCapabilities.codex?.hooks.pre_tool?.proofs?.[0];

    expect(persistedProof).toMatchObject({
      type: "negative_fixture",
      status: "candidate",
      observedAt: "2026-05-03T00:00:00.500Z",
    });
    expect(persistedProof?.verifier).toBeUndefined();
    expect(persistedProof?.target).toBeUndefined();
    expect(persistedProof?.gateType).toBeUndefined();
    expect(persistedProof?.configDigest).toBeUndefined();
    expect(persistedProof?.result).toBeUndefined();
    expect(persistedProof?.proofDigest).toBeUndefined();
    expect(bindings.pre_tool.status).toBe("stale");
    expect(bindings.pre_tool.canBlock).toBe(false);
  });

  it("does not treat accepted blocking proof without observedAt as fresh", async () => {
    const digest = computeRuntimeProfileDigest("codex");
    await initPlanningProject(root);
    await inspectRuntimeWithTrustedProofs(root, "codex", {
      inspectedAt: "2026-05-03T00:00:00.000Z",
      hooks: {
        pre_tool: {
          proofs: [
            {
              type: "negative_fixture",
              status: "accepted",
              detail: "Fixture result was accepted but not timestamped.",
            },
          ],
        },
      },
    });

    const bindings = await bindRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:01.000Z",
      expectedDigest: digest,
      currentDigest: digest,
    });

    expect(bindings.pre_tool.status).toBe("stale");
    expect(bindings.pre_tool.canBlock).toBe(false);
    expect(bindings.pre_tool.reason).toContain("with observedAt required");
  });

  it("redacts runtime proof details, notes, and limitations before persistence", async () => {
    await initPlanningProject(root);

    await inspectRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:00.000Z",
      knownLimitations: ["api_key=abcdefghijklmnopqrstuvwxyz123456"],
      hooks: {
        pre_tool: {
          notes: ["password=correct-horse-battery-staple"],
          proofs: [
            {
              type: "negative_fixture",
              status: "accepted",
              observedAt: "2026-05-03T00:00:00.500Z",
              detail: "token=ghp_abcdefghijklmnopqrstuvwxyz123456",
            },
          ],
        },
      },
    });

    const project = await readPlanningProject(root);
    const capability = project.runSet.runtimeCapabilities.codex;

    expect(capability?.knownLimitations).toEqual(["api_key=[REDACTED]"]);
    expect(capability?.hooks.pre_tool?.notes).toEqual(["password=[REDACTED]"]);
    expect(capability?.hooks.pre_tool?.proofs?.[0]?.detail).toBe("token=[REDACTED]");
  });

  it("marks bindings stale when expected and current digests differ", async () => {
    const digest = computeRuntimeProfileDigest("codex");
    await initPlanningProject(root);
    await inspectRuntimeWithTrustedProofs(root, "codex", {
      inspectedAt: "2026-05-03T00:00:00.000Z",
      hooks: {
        pre_tool: {
          proofs: acceptedBlockingProof(),
        },
      },
    });

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

  it("marks blocking bindings stale when trusted proof runtime version does not match capability", async () => {
    const digest = computeRuntimeProfileDigest("codex");
    await initPlanningProject(root);
    await inspectRuntimeWithTrustedProofs(root, "codex", {
      inspectedAt: "2026-05-03T00:00:00.000Z",
      runtimeVersion: "codex-profile-v2",
      hooks: {
        pre_tool: {
          proofs: acceptedBlockingProof(),
        },
      },
    });

    const bindings = await bindRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:01.000Z",
      expectedDigest: digest,
      currentDigest: digest,
    });

    expect(bindings.pre_tool.status).toBe("stale");
    expect(bindings.pre_tool.canBlock).toBe(false);
    expect(bindings.pre_tool.runtimeVersion).toBe("codex-profile-v2");
    expect(bindings.pre_tool.reason).toContain("runtime blocking proof is missing or stale");
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

    const capability = await inspectRuntimeWithTrustedProofs(root, "codex", {
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

  it("blocks H-risk gates when forged blocking proof is missing", async () => {
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
    await inspectRuntimeWithTrustedProofs(root, "codex", {
      inspectedAt: "2026-05-03T00:00:00.000Z",
      hooks: {
        pre_tool: {
          proofs: acceptedBlockingProof(),
        },
      },
    });
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

  it("preserves unrelated run-set fields while inspecting and binding runtime", async () => {
    const digest = computeRuntimeProfileDigest("codex");
    const created = await initPlanningProject(root);
    const preservedRunSet = {
      ...created.runSet,
      project: {
        schemaVersion: 1 as const,
        name: "Pipeline Fractale v4",
        repoPaths: {
          root: root.replaceAll("\\", "/"),
          planning: ".planning" as const,
        },
        tags: ["runtime", "hooks"],
        futureProjectField: { preserve: true },
      },
      intent: {
        schemaVersion: 1 as const,
        objective: "Preserve the canonical run-set envelope during runtime binding",
        plannedCycles: ["discovery", "build", "validation"] as const,
        initialRiskClass: "M" as const,
        effectiveRiskClass: "M" as const,
        futureIntentField: { preserve: ["speech-to-text", "operator-context"] },
      },
      runtimeCapabilities: {
        claude: {
          target: "claude",
          runtimeName: "claude",
          status: "available" as const,
          inspectedAt: "2026-05-03T00:00:00.250Z",
          hooks: {},
          knownLimitations: ["preexisting Claude capability"],
        },
      },
      runtimeBindings: {
        futureRuntimeBindingField: {
          owner: "future-runtime-binding-contract",
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
            reason: "stale preexisting binding that must be replaced",
          },
        },
      },
      policy: {
        schemaVersion: 1 as const,
        globalRules: ["runtime writes are scoped to runtime fields"],
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
          id: "event-before-runtime-bind",
          ts: "2026-05-03T00:00:00.000Z",
          type: "GATE_EVALUATED",
          gateType: "pre_tool" as const,
          decision: "warn" as const,
          reason: "preexisting policy event",
          payload: { existing: true, nested: { preserve: true } },
        },
      ],
      evidence: [
        {
          id: "ev-runtime-contract",
          key: "hook_decision" as const,
          kind: "contract-test",
          status: "accepted" as const,
          summary: "Runtime writes preserve unrelated run-set fields",
          source: "ci" as const,
          metadata: { existing: true, nested: { preserve: true } },
          createdAt: "2026-05-03T00:00:00.000Z",
        },
      ],
      subagents: [
        {
          agentId: "agent-runtime-contract",
          role: "test-engineer",
          runtime: "codex",
          status: "completed" as const,
          scope: ["packages/core/test/runtime-bindings.test.ts"],
          evidenceRefs: ["ev-runtime-contract"],
          metadata: { lane: "runtime-binding", preserve: true },
        },
      ],
      finalization: {
        state: "BLOCKED" as const,
        gaps: ["awaiting runtime binding proof"],
      },
    };

    await writePlanningProject(root, {
      ...created,
      runSet: preservedRunSet,
    });
    await inspectRuntimeWithTrustedProofs(root, "codex", {
      inspectedAt: "2026-05-03T00:00:01.000Z",
      hooks: {
        pre_tool: {
          proofs: acceptedBlockingProof("negative_fixture", {
            observedAt: "2026-05-03T00:00:01.500Z",
          }),
        },
      },
    });
    await bindRuntime(root, "codex", {
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
    expect(updated.runSet.runtimeCapabilities.codex?.hooks.pre_tool?.nativeEvent).toBe(
      "PreToolUse",
    );
    expect(updated.runSet.runtimeBindings.gates?.pre_tool?.status).toBe("native");
  });
});
