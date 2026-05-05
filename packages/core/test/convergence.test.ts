import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildRuntimeBindings,
  closeRun,
  computeRuntimeProfileDigest,
  createDefaultPlanningProject,
  type EvidenceItem,
  type EvidenceKey,
  evaluateConvergence,
  GATE_TYPES,
  getPlanningPaths,
  getRuntimeProfile,
  getStatus,
  handleHook,
  type PlanningProject,
  RISK_CLASS_RANK,
  RISK_POLICY,
  type RiskClass,
  type RuntimeBinding,
  type RuntimeCapability,
  readPlanningProject,
  writePlanningProject,
} from "../src/index.js";
import {
  createTrustedRuntimeProbeProof,
  TRUSTED_BLOCKING_RUNTIME_PROOF_RESULT,
} from "../src/runtime/runtime-proofs.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "harness-convergence-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("convergence", () => {
  it("returns DONE_VERIFIED when evidence and runtime gates are sufficient", () => {
    const evaluation = evaluateConvergence(
      projectForRisk("M", { withEvidence: true, withRuntime: true }),
    );

    expect(evaluation.finalizationRecommendation.finalState).toBe("DONE_VERIFIED");
    expect(evaluation.status).toBe("verified");
    expect(evaluation.score).toBe(100);
    expect(evaluation.evidenceSufficiency.sufficient).toBe(true);
    expect(evaluation.runtimeBindingHealth.healthy).toBe(true);
    expect(evaluation.blockers).toEqual([]);
  });

  it("returns BLOCKED_POLICY when medium mandatory evidence is missing", () => {
    const evaluation = evaluateConvergence(projectForRisk("M", { withRuntime: true }));

    expect(evaluation.finalizationRecommendation.finalState).toBe("BLOCKED_POLICY");
    expect(evaluation.finalizationRecommendation.runSetState).toBe("BLOCKED_POLICY");
    expect(evaluation.status).toBe("blocked");
    expect(evaluation.evidenceSufficiency.missingEvidenceKeys).toContain("ci_green");
    expect(evaluation.blockers).toContain("missing mandatory evidence: ci_green");
  });

  it("does not treat opaque intent or policy fields as convergence authority", () => {
    const project = projectForRisk("M", { withRuntime: true });
    const evaluation = evaluateConvergence({
      ...project,
      runSet: {
        ...project.runSet,
        intent: {
          effectiveRiskClass: "T",
          doneVerifiedAuthorized: true,
        },
        policy: {
          riskPolicies: {
            M: {
              mandatoryEvidenceKeys: [],
            },
          },
          finalizationOverride: "DONE_VERIFIED",
        },
      },
    });

    expect(evaluation.finalizationRecommendation.finalState).toBe("BLOCKED_POLICY");
    expect(evaluation.evidenceSufficiency.missingEvidenceKeys).toContain("ci_green");
  });

  it("returns BLOCKED_RUNTIME_MISSING when a required binding is stale or missing", () => {
    const project = projectForRisk("M", { withEvidence: true, withRuntime: true });
    const staleBinding: RuntimeBinding = {
      gateType: "pre_tool",
      target: "codex",
      status: "stale",
      nativeEvent: "PreToolUse",
      canBlock: false,
      inspectedAt: "2026-05-03T00:00:00.000Z",
      reason: "runtime capability digest mismatch",
    };
    const evaluation = evaluateConvergence({
      ...project,
      runSet: {
        ...project.runSet,
        runtimeBindings: {
          ...project.runSet.runtimeBindings,
          gates: {
            ...project.runSet.runtimeBindings.gates,
            pre_tool: staleBinding,
          },
        },
      },
    });

    expect(evaluation.finalizationRecommendation.finalState).toBe("BLOCKED_RUNTIME_MISSING");
    expect(evaluation.finalizationRecommendation.runSetState).toBe("BLOCKED_RUNTIME_MISSING");
    expect(evaluation.status).toBe("blocked");
    expect(evaluation.runtimeBindingHealth.healthy).toBe(false);
    expect(evaluation.runtimeBindingHealth.gaps[0]).toContain("pre_tool");
  });

  it("does not require native blocking for observable-only required gates", () => {
    const project = projectForRisk("M", { withEvidence: true, withRuntime: true });
    const gates = project.runSet.runtimeBindings.gates ?? {};
    const sessionStart = requireBinding(gates.session_start);
    const postTool = requireBinding(gates.post_tool);
    const evaluation = evaluateConvergence({
      ...project,
      runSet: {
        ...project.runSet,
        runtimeBindings: {
          ...project.runSet.runtimeBindings,
          gates: {
            ...gates,
            session_start: {
              ...sessionStart,
              canBlock: false,
              reason: "session_start is observable context injection",
            },
            post_tool: {
              ...postTool,
              canBlock: false,
              reason: "post_tool is observable completed-action inspection",
            },
          },
        },
      },
    });

    expect(evaluation.finalizationRecommendation.finalState).toBe("DONE_VERIFIED");
    expect(evaluation.runtimeBindingHealth.healthy).toBe(true);
  });

  it("still requires native blocking for blocking gates", () => {
    const project = projectForRisk("M", { withEvidence: true, withRuntime: true });
    const gates = project.runSet.runtimeBindings.gates ?? {};
    const stop = requireBinding(gates.stop);
    const evaluation = evaluateConvergence({
      ...project,
      runSet: {
        ...project.runSet,
        runtimeBindings: {
          ...project.runSet.runtimeBindings,
          gates: {
            ...gates,
            stop: {
              ...stop,
              canBlock: false,
              reason: "stop cannot block",
            },
          },
        },
      },
    });

    expect(evaluation.finalizationRecommendation.finalState).toBe("BLOCKED_RUNTIME_MISSING");
    expect(evaluation.runtimeBindingHealth.gaps[0]).toContain("stop lacks required blocking");
  });

  it("requires delegated runtime bindings when subagents are planned after initial inspection", () => {
    const project = projectForRisk("M", { withEvidence: true, withRuntime: true });
    const evaluation = evaluateConvergence({
      ...project,
      runSet: {
        ...project.runSet,
        subagents: [
          {
            agentId: "worker-route-required",
            status: "planned",
          },
        ],
      },
    });

    expect(evaluation.runtimeBindingHealth.requiredGates).toContain("subagent_start");
    expect(evaluation.runtimeBindingHealth.requiredGates).toContain("subagent_stop");
    expect(evaluation.finalizationRecommendation.finalState).toBe("BLOCKED_RUNTIME_MISSING");
    expect(evaluation.runtimeBindingHealth.gaps.some((gap) => gap.includes("subagent_stop"))).toBe(
      true,
    );
  });

  it("requires runtime bindings listed by risk policy required gates", () => {
    const project = projectForRisk("M", { withEvidence: true, withRuntime: true });
    const evaluation = evaluateConvergence({
      ...project,
      runSet: {
        ...project.runSet,
        policy: {
          ...project.runSet.policy,
          riskPolicies: {
            M: {
              requiredGates: ["subagent_stop"],
            },
          },
        },
      },
    });

    expect(evaluation.runtimeBindingHealth.requiredGates).toContain("subagent_stop");
    expect(evaluation.finalizationRecommendation.finalState).toBe("BLOCKED_RUNTIME_MISSING");
    expect(evaluation.runtimeBindingHealth.gaps[0]).toContain("subagent_stop");
  });

  it("deduplicates policy and delegated required gates before runtime assessment", () => {
    const project = projectForRisk("M", { withEvidence: true, withRuntime: true });
    const evaluation = evaluateConvergence({
      ...project,
      runSet: {
        ...project.runSet,
        subagents: [{ agentId: "worker-1", status: "planned" }],
        policy: {
          riskPolicies: {
            M: {
              requiredGates: ["subagent_stop"],
            },
          },
        },
      },
    });

    expect(
      evaluation.runtimeBindingHealth.requiredGates.filter(
        (gateType) => gateType === "subagent_stop",
      ),
    ).toHaveLength(1);
    expect(
      evaluation.runtimeBindingHealth.gaps.filter((gap) => gap.includes("subagent_stop")),
    ).toHaveLength(1);
  });

  it("allows trivial and L-risk closes with transparent gaps", () => {
    for (const riskClass of ["T", "L"] satisfies RiskClass[]) {
      const evaluation = evaluateConvergence(projectForRisk(riskClass));

      expect(evaluation.finalizationRecommendation.finalState).toBe("DONE_WITH_GAPS");
      expect(evaluation.status).toBe("done_with_gaps");
      expect(evaluation.blockers).toEqual([]);
      expect(evaluation.gaps.length).toBeGreaterThan(0);
    }
  });

  it("writes close finalization, close event, and closed state", async () => {
    await writePlanningProject(
      root,
      projectForRisk("M", { withEvidence: true, withRuntime: true }),
    );
    const paths = getPlanningPaths(root);
    const stateBefore = await readFile(paths.stateFile, "utf8");
    const currentRiskBefore = await readFile(paths.currentRiskFile, "utf8");

    const result = await closeRun(root, {
      closedAt: "2026-05-03T00:00:00.000Z",
      eventId: "close-1",
    });

    const stateAfter = await readFile(paths.stateFile, "utf8");
    const currentRiskAfter = await readFile(paths.currentRiskFile, "utf8");
    const planningEntries = await readdir(paths.planningDir);
    const project = await readPlanningProject(root);

    expect(stateAfter).not.toBe(stateBefore);
    expect(stateAfter).toContain("status: closed");
    expect(currentRiskAfter).toBe(currentRiskBefore);
    expect(planningEntries.sort()).toEqual(["current-risk.yaml", "run-set.json", "state.yaml"]);
    expect(result.evaluation.finalizationRecommendation.finalState).toBe("DONE_VERIFIED");
    expect(project.runSet.finalization).toEqual({ state: "DONE_VERIFIED", gaps: [] });
    expect(project.runSet.events).toHaveLength(1);
    expect(project.state.status).toBe("closed");
    expect(project.runSet.events[0]).toMatchObject({
      id: "close-1",
      type: "RUN_CLOSED",
      decision: "allow",
      payload: {
        finalState: "DONE_VERIFIED",
        evidenceSufficient: true,
        runtimeBindingHealthy: true,
      },
    });
  });

  it("writes canonical blocked finalization details to run-set.json", async () => {
    await writePlanningProject(root, projectForRisk("M", { withRuntime: true }));

    const result = await closeRun(root, {
      closedAt: "2026-05-03T00:00:00.000Z",
      eventId: "close-blocked-1",
    });
    const project = await readPlanningProject(root);

    expect(result.evaluation.finalizationRecommendation.finalState).toBe("BLOCKED_POLICY");
    expect(project.runSet.finalization.state).toBe("BLOCKED_POLICY");
    expect(project.runSet.events[0]).toMatchObject({
      decision: "block",
      payload: {
        finalState: "BLOCKED_POLICY",
      },
    });
  });

  it("is idempotent when the run is already closed", async () => {
    await writePlanningProject(
      root,
      projectForRisk("M", { withEvidence: true, withRuntime: true }),
    );

    await closeRun(root, {
      closedAt: "2026-05-03T00:00:00.000Z",
      eventId: "close-1",
    });
    const second = await closeRun(root, {
      closedAt: "2026-05-03T00:00:01.000Z",
      eventId: "close-2",
    });
    const project = await readPlanningProject(root);

    expect(second.event.id).toBe("close-1");
    expect(project.runSet.events.filter((event) => event.type === "RUN_CLOSED")).toHaveLength(1);
    expect(project.state.status).toBe("closed");
  });

  it("persists critical post_tool policy violations and blocks convergence", async () => {
    await writePlanningProject(
      root,
      projectForRisk("M", { withEvidence: true, withRuntime: true }),
    );

    const response = await handleHook(root, "post_tool", {
      toolName: "shell",
      toolOutput: "token = abcdefghijklmnopqrstuvwxyz123456",
    });
    const project = await readPlanningProject(root);
    const evaluation = evaluateConvergence(project);

    expect(response.decision).toBe("warn");
    expect(project.runSet.events[0]).toMatchObject({
      type: "GATE_EVALUATED",
      gateType: "post_tool",
      payload: {
        violationType: "SECRET_IN_PLAINTEXT",
        finalState: "BLOCKED_POLICY",
        toolOutputPreview: "token = [REDACTED]",
      },
    });
    expect(evaluation.finalizationRecommendation.finalState).toBe("BLOCKED_POLICY");
    expect(evaluation.blockers[0]).toContain("SECRET_IN_PLAINTEXT");
  });

  it("redacts secrets from persisted hook metadata", async () => {
    await writePlanningProject(root, projectForRisk("T"));

    await handleHook(root, "post_tool", {
      toolName: "shell",
      metadata: {
        token: "ghp_abcdefghijklmnopqrstuvwxyz123456",
        password: "correct-horse-battery-staple",
        nested: {
          apiKey: "abcdefghijklmnopqrstuvwxyz123456",
        },
      },
      toolOutput: "ok",
    });
    const project = await readPlanningProject(root);

    expect(project.runSet.events[0].payload).toMatchObject({
      metadata: {
        token: "[REDACTED]",
        password: "[REDACTED]",
        nested: {
          apiKey: "[REDACTED]",
        },
      },
    });
  });

  it("blocks stop when an unresolved post_tool policy violation exists", async () => {
    await writePlanningProject(
      root,
      projectForRisk("M", { withEvidence: true, withRuntime: true }),
    );

    await handleHook(root, "post_tool", {
      toolName: "shell",
      toolOutput: "api_key = abcdefghijklmnopqrstuvwxyz123456",
    });
    const stop = await handleHook(root, "stop", {});

    expect(stop).toMatchObject({
      decision: "block",
      violationType: "UNRESOLVED_POLICY_VIOLATION",
      finalState: "BLOCKED_POLICY",
    });
    expect(stop.reason).toContain("SECRET_IN_PLAINTEXT");
  });

  it("prioritizes critical policy blockers over runtime blockers in final state", async () => {
    await writePlanningProject(
      root,
      projectForRisk("M", { withEvidence: true, withRuntime: true }),
    );
    await handleHook(root, "post_tool", {
      toolName: "shell",
      toolOutput: "secret = abcdefghijklmnopqrstuvwxyz123456",
    });
    const project = await readPlanningProject(root);
    const gates = project.runSet.runtimeBindings.gates ?? {};
    const stop = requireBinding(gates.stop);
    const evaluation = evaluateConvergence({
      ...project,
      runSet: {
        ...project.runSet,
        runtimeBindings: {
          ...project.runSet.runtimeBindings,
          gates: {
            ...gates,
            stop: {
              ...stop,
              status: "stale",
              canBlock: false,
              reason: "runtime stale",
            },
          },
        },
      },
    });

    expect(evaluation.finalizationRecommendation.finalState).toBe("BLOCKED_POLICY");
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.stringContaining("runtime binding unavailable for stop"),
        expect.stringContaining("SECRET_IN_PLAINTEXT"),
      ]),
    );
  });

  it("exposes calculated finalization blockers and gaps from status", async () => {
    await writePlanningProject(root, projectForRisk("M", { withRuntime: true }));

    const status = await getStatus(root);

    expect(status.stateStatus).toBe("active");
    expect(status.finalizationState).toBe("ACTIVE");
    expect(status.convergenceStatus).toBe("blocked");
    expect(status.blockers).toContain("missing mandatory evidence: ci_green");
    expect(status.gaps).toContain("missing evidence: ci_green");
  });
});

function requireBinding(binding: RuntimeBinding | undefined): RuntimeBinding {
  if (!binding) {
    throw new Error("test fixture expected runtime binding");
  }

  return binding;
}

function projectForRisk(
  riskClass: RiskClass,
  options: { withEvidence?: boolean; withRuntime?: boolean } = {},
): PlanningProject {
  const project = createDefaultPlanningProject("run_test");

  return {
    ...project,
    currentRisk: {
      ...project.currentRisk,
      risk_class: riskClass,
      rank: RISK_CLASS_RANK[riskClass],
      bypass_allowed: RISK_POLICY[riskClass].bypassAllowed,
      human_checkpoint_required: RISK_POLICY[riskClass].requiresHumanCheckpoint,
    },
    runSet: {
      ...project.runSet,
      route: {
        ...project.runSet.route,
        riskClass,
      },
      evidence: options.withEvidence ? evidenceForRisk(riskClass) : [],
      runtimeBindings: options.withRuntime ? healthyRuntimeBindings() : {},
    },
  };
}

function evidenceForRisk(riskClass: RiskClass): EvidenceItem[] {
  return RISK_POLICY[riskClass].mandatoryEvidenceKeys.map((key) => evidence(key));
}

function evidence(key: EvidenceKey): EvidenceItem {
  return {
    id: key,
    key,
    kind: key,
    status: "accepted",
    summary: key,
    createdAt: "2026-05-03T00:00:00.000Z",
  };
}

function healthyRuntimeBindings() {
  const profile = getRuntimeProfile("codex");
  const digest = computeRuntimeProfileDigest("codex");

  return {
    activeTarget: "codex",
    gates: buildRuntimeBindings(
      "codex",
      {
        target: "codex",
        runtimeName: "codex",
        runtimeVersion: profile.runtimeVersion,
        status: "available",
        inspectedAt: "2026-05-03T00:00:00.000Z",
        hooks: Object.fromEntries(
          GATE_TYPES.map((gateType) => {
            const hook = profile.hooks[gateType];

            return [
              gateType,
              {
                gateType,
                nativeEvent: hook.nativeEvent,
                canBlock: hook.canBlock,
                status: hook.supported ? "available" : "missing",
                inspectedAt: "2026-05-03T00:00:00.000Z",
                proofs: hook.canBlock
                  ? [
                      createTrustedRuntimeProbeProof({
                        type: "negative_fixture",
                        observedAt: "2026-05-03T00:00:00.500Z",
                        target: "codex",
                        runtimeVersion: profile.runtimeVersion,
                        gateType,
                        configDigest: digest,
                        result: TRUSTED_BLOCKING_RUNTIME_PROOF_RESULT,
                        detail: `${gateType} produced the documented block response.`,
                      }),
                    ]
                  : undefined,
              },
            ];
          }),
        ) as RuntimeCapability["hooks"],
        knownLimitations: [],
      },
      "2026-05-03T00:00:01.000Z",
      {
        expectedDigest: digest,
        currentDigest: digest,
      },
    ),
  };
}
