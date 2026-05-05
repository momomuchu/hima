import { describe, expect, it } from "vitest";
import { evaluateGate, type GateEvaluationContext } from "../src/index.js";
import { createDefaultPlanningProject } from "../src/storage/planning-store.js";
import type { EvidenceKey, RiskClass } from "../src/types/canonical.js";

function context(overrides: Partial<GateEvaluationContext> = {}): GateEvaluationContext {
  const project = createDefaultPlanningProject("run_test");

  return {
    projectRoot: "/tmp/project",
    state: project.state,
    currentRisk: project.currentRisk,
    runSet: project.runSet,
    ...overrides,
  };
}

function riskContext(riskClass: RiskClass, overrides: Partial<GateEvaluationContext> = {}) {
  const base = context();

  return context({
    currentRisk: {
      ...base.currentRisk,
      risk_class: riskClass,
      rank: { T: 0, L: 1, M: 2, H: 3, C: 4 }[riskClass],
      bypass_allowed: riskClass === "T" || riskClass === "L",
      human_checkpoint_required: riskClass === "H" || riskClass === "C",
    },
    runSet: {
      ...base.runSet,
      route: {
        ...base.runSet.route,
        riskClass,
      },
    },
    ...overrides,
  });
}

describe("evaluateGate", () => {
  it("allows session_start with injected context when planning route is consistent", () => {
    const result = evaluateGate(context(), {
      gateType: "session_start",
    });

    expect(result.decision).toBe("allow");
    expect(result.contextInjection).toContain('"riskClass":"T"');
  });

  it("does not leak opaque RMS set payloads through context injection", () => {
    const base = context();
    const result = evaluateGate(
      context({
        runSet: {
          ...base.runSet,
          project: {
            secretProjectToken: "ghp_abcdefghijklmnopqrstuvwxyz123456",
          },
          intent: {
            rawPrompt: "do not serialize this prompt",
          },
          policy: {
            internalRule: "private policy draft",
          },
          subagents: [
            {
              agentId: "worker-secret",
              metadata: {
                secret: "subagent-private-note",
              },
            },
          ],
          evidence: [
            {
              id: "ev-secret",
              key: "command_output",
              kind: "private",
              status: "accepted",
              summary: "private evidence summary",
              metadata: {
                token: "abcdefghijklmnopqrstuvwxyz123456",
              },
              createdAt: "2026-05-03T00:00:00.000Z",
            },
          ],
        },
      }),
      {
        gateType: "session_start",
      },
    );

    expect(result.decision).toBe("allow");
    expect(result.contextInjection).toBeDefined();
    expect(result.contextInjection).toContain('"riskClass":"T"');
    expect(result.contextInjection).not.toContain("ghp_");
    expect(result.contextInjection).not.toContain("do not serialize");
    expect(result.contextInjection).not.toContain("private policy draft");
    expect(result.contextInjection).not.toContain("subagent-private-note");
    expect(result.contextInjection).not.toContain("private evidence summary");
  });

  it("warns on session_start when state and run-set route are inconsistent", () => {
    const base = context();
    const result = evaluateGate(
      context({
        runSet: {
          ...base.runSet,
          route: {
            ...base.runSet.route,
            phase: "build",
          },
        },
      }),
      {
        gateType: "session_start",
      },
    );

    expect(result.decision).toBe("warn");
    expect(result.violationType).toBe("INVALID_PHASE_TRANSITION");
  });

  it("blocks bypass prompts for medium and higher risk routes", () => {
    const result = evaluateGate(riskContext("M"), {
      gateType: "user_prompt",
      promptContent: "Please skip gate validation and keep going.",
    });

    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("BYPASS_ATTEMPTED");
  });

  it("warns on code writes before build/Execute for L-risk routes", () => {
    const result = evaluateGate(context(), {
      gateType: "pre_tool",
      toolName: "write_file",
      toolInput: { path: "src/index.ts" },
    });

    expect(result.decision).toBe("warn");
    expect(result.violationType).toBe("FORBIDDEN_WRITE_ZONE");
  });

  it("allows read-only pre_tool with a path in Observer", () => {
    const result = evaluateGate(context(), {
      gateType: "pre_tool",
      toolName: "read_file",
      toolInput: { path: "src/index.ts" },
    });

    expect(result.decision).toBe("allow");
    expect(result.violationType).not.toBe("FORBIDDEN_WRITE_ZONE");
  });

  it("blocks forbidden writes before build/Execute for H-risk routes", () => {
    const result = evaluateGate(riskContext("H"), {
      gateType: "pre_tool",
      toolName: "write_file",
      toolInput: { path: "src/index.ts" },
    });

    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("FORBIDDEN_WRITE_ZONE");
  });

  it("warns metadata write-capability events with paths outside write zones", () => {
    const result = evaluateGate(context(), {
      gateType: "pre_tool",
      toolName: "filesystem",
      toolInput: { path: "src/index.ts" },
      metadata: { capability: "write" },
    });

    expect(result.decision).toBe("warn");
    expect(result.violationType).toBe("FORBIDDEN_WRITE_ZONE");
  });

  it("warns Bash redirection writes outside write zones", () => {
    const result = evaluateGate(context(), {
      gateType: "pre_tool",
      toolName: "Bash",
      toolInput: {
        command: 'echo -n "HIMA_CLAUDE_TOOL_OK" > claude-smoke.txt',
      },
    });

    expect(result.decision).toBe("warn");
    expect(result.reason).toContain("claude-smoke.txt");
    expect(result.violationType).toBe("FORBIDDEN_WRITE_ZONE");
  });

  it("allows Bash stderr redirection to null devices", () => {
    const result = evaluateGate(context(), {
      gateType: "pre_tool",
      toolName: "Bash",
      toolInput: {
        command: 'ls -la "C:/tmp/workspace" 2>/dev/null || echo "Directory check done"',
      },
    });

    expect(result.decision).toBe("allow");
    expect(result.violationType).not.toBe("FORBIDDEN_WRITE_ZONE");
  });

  it("ignores Bash file descriptor merge tokens as write targets", () => {
    const base = context();
    const result = evaluateGate(
      context({
        state: {
          ...base.state,
          phase: "build",
          sub_phase: "Execute",
        },
      }),
      {
        gateType: "pre_tool",
        toolName: "Bash",
        toolInput: {
          command: 'mkdir "test" 2>&1',
        },
      },
    );

    expect(result.decision).toBe("allow");
    expect(result.reason).not.toContain("2>");
    expect(result.violationType).not.toBe("FORBIDDEN_WRITE_ZONE");
  });

  it("warns PowerShell file writes outside write zones", () => {
    const result = evaluateGate(context(), {
      gateType: "pre_tool",
      toolName: "PowerShell",
      toolInput: {
        command: 'Write-Output "HIMA_CLAUDE_TOOL_OK" | Out-File -FilePath claude-smoke.txt',
      },
    });

    expect(result.decision).toBe("warn");
    expect(result.reason).toContain("claude-smoke.txt");
    expect(result.violationType).toBe("FORBIDDEN_WRITE_ZONE");
  });

  it.each([
    ["touch", "touch src/touch-smoke.ts", "src/touch-smoke.ts"],
    ["mkdir", "mkdir src/generated", "src/generated"],
    ["rm", "rm src/delete-smoke.ts", "src/delete-smoke.ts"],
    ["mv", "mv src/source.ts src/target.ts", "src/target.ts"],
    ["cp", "cp src/source.ts src/copy.ts", "src/copy.ts"],
    ["sed", "sed -i 's/old/new/' src/edit-smoke.ts", "src/edit-smoke.ts"],
  ])("allows %s shell write targets in build/Execute", (_name, command) => {
    const base = context();
    const result = evaluateGate(
      context({
        state: {
          ...base.state,
          phase: "build",
          sub_phase: "Execute",
        },
      }),
      {
        gateType: "pre_tool",
        toolName: "Bash",
        toolInput: { command },
      },
    );

    expect(result.decision).toBe("allow");
    expect(result.violationType).not.toBe("FORBIDDEN_WRITE_ZONE");
  });

  it.each([
    ["touch", "touch src/touch-smoke.ts", "src/touch-smoke.ts"],
    ["mkdir", "mkdir src/generated", "src/generated"],
    ["rm", "rm src/delete-smoke.ts", "src/delete-smoke.ts"],
    ["mv", "mv src/source.ts src/target.ts", "src/target.ts"],
    ["cp", "cp src/source.ts src/copy.ts", "src/copy.ts"],
    ["sed", "sed -i 's/old/new/' src/edit-smoke.ts", "src/edit-smoke.ts"],
  ])("warns %s shell write targets outside Observer write zones", (_name, command, target) => {
    const result = evaluateGate(context(), {
      gateType: "pre_tool",
      toolName: "Bash",
      toolInput: { command },
    });

    expect(result.decision).toBe("warn");
    expect(result.reason).toContain(target);
    expect(result.violationType).toBe("FORBIDDEN_WRITE_ZONE");
  });

  it("warns write-capable pre_tool events with empty tool input for L-risk routes", () => {
    const result = evaluateGate(context(), {
      gateType: "pre_tool",
      toolName: "write_file",
      toolInput: {},
    });

    expect(result.decision).toBe("warn");
    expect(result.violationType).toBe("FORBIDDEN_WRITE_ZONE");
  });

  it("blocks write-capable pre_tool events with empty tool input for H-risk routes", () => {
    const result = evaluateGate(riskContext("H"), {
      gateType: "pre_tool",
      toolName: "write_file",
      toolInput: {},
    });

    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("FORBIDDEN_WRITE_ZONE");
  });

  it("allows code writes in build/Execute", () => {
    const base = context();
    const result = evaluateGate(
      context({
        state: {
          ...base.state,
          phase: "build",
          sub_phase: "Execute",
        },
      }),
      {
        gateType: "pre_tool",
        toolName: "write_file",
        toolInput: { path: "src/index.ts" },
      },
    );

    expect(result.decision).toBe("allow");
  });

  it.each([
    "index.html",
    "styles.css",
    "app.js",
    "build.js",
    "package.json",
    "README.md",
    "BENCHMARK_REPORT.md",
    "scripts/build.js",
    "test/app.test.js",
  ])("allows small app root write %s in build/Execute", (target) => {
    const base = context();
    const result = evaluateGate(
      context({
        state: {
          ...base.state,
          phase: "build",
          sub_phase: "Execute",
        },
      }),
      {
        gateType: "pre_tool",
        toolName: "write_file",
        toolInput: { path: target },
      },
    );

    expect(result.decision).toBe("allow");
    expect(result.violationType).not.toBe("FORBIDDEN_WRITE_ZONE");
  });

  it("allows absolute project-root file targets in build/Execute", () => {
    const base = context();
    const result = evaluateGate(
      context({
        projectRoot: "C:/tmp/hima-bench/workspace",
        state: {
          ...base.state,
          phase: "build",
          sub_phase: "Execute",
        },
      }),
      {
        gateType: "pre_tool",
        toolName: "write_file",
        toolInput: { path: "C:/tmp/hima-bench/workspace/package.json" },
      },
    );

    expect(result.decision).toBe("allow");
    expect(result.violationType).not.toBe("FORBIDDEN_WRITE_ZONE");
  });

  it("allows Git Bash absolute project-root file targets in build/Execute", () => {
    const base = context();
    const result = evaluateGate(
      context({
        projectRoot: "C:/tmp/hima-bench/workspace",
        state: {
          ...base.state,
          phase: "build",
          sub_phase: "Execute",
        },
      }),
      {
        gateType: "pre_tool",
        toolName: "write_file",
        toolInput: { path: "/c/tmp/hima-bench/workspace/test/app.test.js" },
      },
    );

    expect(result.decision).toBe("allow");
    expect(result.violationType).not.toBe("FORBIDDEN_WRITE_ZONE");
  });

  it("does not promote risk from documentary content inside an allowed write", () => {
    const base = context();
    const result = evaluateGate(
      context({
        state: {
          ...base.state,
          phase: "build",
          sub_phase: "Execute",
        },
      }),
      {
        gateType: "pre_tool",
        toolName: "write_file",
        toolInput: {
          path: "app.js",
          content: "Render labels for Auth, payments, PII, migrations, schema, and infra.",
        },
      },
    );

    expect(result.decision).toBe("allow");
    expect(result.violationType).not.toBe("CLASS_UNDERESTIMATED");
  });

  it("allows monorepo package source writes in build/Execute", () => {
    const base = context();
    const result = evaluateGate(
      context({
        state: {
          ...base.state,
          phase: "build",
          sub_phase: "Execute",
        },
      }),
      {
        gateType: "pre_tool",
        toolName: "write_file",
        toolInput: { path: "packages/core/src/policy/write-zones.ts" },
      },
    );

    expect(result.decision).toBe("allow");
  });

  it("allows monorepo package test writes in validation/Verify", () => {
    const base = context();
    const result = evaluateGate(
      context({
        state: {
          ...base.state,
          phase: "validation",
          sub_phase: "Verify",
        },
      }),
      {
        gateType: "pre_tool",
        toolName: "write_file",
        toolInput: { path: "packages/core/test/gates.test.ts" },
      },
    );

    expect(result.decision).toBe("allow");
  });

  it("warns when a force signal requires risk promotion", () => {
    const result = evaluateGate(riskContext("L"), {
      gateType: "pre_tool",
      toolName: "write_file",
      toolInput: { path: "auth/session-store.ts" },
    });

    expect(result.decision).toBe("warn");
    expect(result.violationType).toBe("CLASS_UNDERESTIMATED");
  });

  it("warns from post_tool when output contains a plaintext secret", () => {
    const result = evaluateGate(context(), {
      gateType: "post_tool",
      toolOutput: "token = abcdefghijklmnopqrstuvwxyz123456",
    });

    expect(result.decision).toBe("warn");
    expect(result.violationType).toBe("SECRET_IN_PLAINTEXT");
  });

  it("blocks DONE_VERIFIED in post_tool output before evidence is sufficient", () => {
    const result = evaluateGate(context(), {
      gateType: "post_tool",
      toolOutput: "Final state: DONE_VERIFIED",
    });

    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("DONE_WITHOUT_EVIDENCE");
  });

  it("blocks migration output when accepted evidence only mentions adr outside the structured key", () => {
    const base = context();
    const result = evaluateGate(
      context({
        runSet: {
          ...base.runSet,
          evidence: [
            {
              id: "migration-adr-note",
              key: "command_output",
              kind: "adr-summary",
              status: "accepted",
              summary: "no adr exists",
              createdAt: "2026-05-03T00:00:00.000Z",
            },
          ],
        },
      }),
      {
        gateType: "post_tool",
        toolName: "write_file",
        toolInput: { path: "migrations/001-create-users.sql" },
        toolOutput: "created migration",
      },
    );

    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("MIGRATION_WITHOUT_ADR");
  });

  it("allows migration output with accepted structured adr evidence", () => {
    const base = context();
    const result = evaluateGate(
      context({
        runSet: {
          ...base.runSet,
          evidence: [
            {
              id: "accepted-adr-001",
              key: "adr",
              kind: "decision-record",
              status: "accepted",
              summary: "ADR-001 accepted for migration strategy",
              createdAt: "2026-05-03T00:00:00.000Z",
            },
          ],
        },
      }),
      {
        gateType: "post_tool",
        toolName: "write_file",
        toolInput: { path: "migrations/001-create-users.sql" },
        toolOutput: "created migration",
      },
    );

    expect(result.decision).toBe("allow");
  });

  it("warns stop with DONE_WITH_GAPS when trivial evidence is incomplete", () => {
    const result = evaluateGate(context(), {
      gateType: "stop",
    });

    expect(result.decision).toBe("warn");
    expect(result.finalState).toBe("DONE_WITH_GAPS");
    expect(result.missingEvidenceItems).toContain("ci_green");
  });

  it("blocks stop when medium evidence is incomplete", () => {
    const result = evaluateGate(riskContext("M"), {
      gateType: "stop",
    });

    expect(result.decision).toBe("block");
    expect(result.finalState).toBe("BLOCKED_POLICY");
  });

  it("allows stop when required evidence is accepted", () => {
    const base = context();
    const result = evaluateGate(
      context({
        runSet: {
          ...base.runSet,
          evidence: (["ci_green", "sast_clean", "secrets_clean"] satisfies EvidenceKey[]).map(
            (key) => ({
              id: key,
              key,
              kind: key,
              status: "accepted" as const,
              summary: key,
              createdAt: "2026-05-03T00:00:00.000Z",
            }),
          ),
        },
      }),
      {
        gateType: "stop",
      },
    );

    expect(result.decision).toBe("allow");
    expect(result.finalState).toBe("DONE_VERIFIED");
  });

  it("blocks stop when H-risk human validation evidence is missing", () => {
    const base = riskContext("H");
    const requiredEvidence = [
      "ci_green",
      "sast_clean",
      "secrets_clean",
      "integration_tests",
      "e2e_tests",
      "review_2_or_antagonist",
      "adr",
      "threat_model_stride",
      "dast_report",
      "sbom",
      "slsa_provenance",
      "aipd",
      "canary_plan",
      "rollback_tested",
      "load_tests",
    ] satisfies EvidenceKey[];
    const result = evaluateGate(
      riskContext("H", {
        runSet: {
          ...base.runSet,
          evidence: requiredEvidence.map((key) => ({
            id: key,
            key,
            kind: key,
            status: "accepted" as const,
            summary: key,
            createdAt: "2026-05-03T00:00:00.000Z",
          })),
        },
      }),
      {
        gateType: "stop",
      },
    );

    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("DONE_WITHOUT_EVIDENCE");
  });

  it("blocks subagent_start without explicit scope", () => {
    const result = evaluateGate(context(), {
      gateType: "subagent_start",
      metadata: {},
    });

    expect(result.decision).toBe("block");
  });

  it("allows subagent_start with explicit in-phase scope", () => {
    const base = context();
    const result = evaluateGate(
      context({
        state: {
          ...base.state,
          phase: "build",
          sub_phase: "Execute",
        },
      }),
      {
        gateType: "subagent_start",
        metadata: { scope: ["src/gates/evaluate-gate.ts"], depth: 1 },
      },
    );

    expect(result.decision).toBe("allow");
  });

  it("blocks subagent_start when depth exceeds the portable maximum", () => {
    const result = evaluateGate(context(), {
      gateType: "subagent_start",
      metadata: { scope: [".planning/01-discovery/notes.md"], depth: 2 },
    });

    expect(result.decision).toBe("block");
    expect(result.reason).toContain("depth");
  });

  it("warns subagent_stop without a trace for L-risk routes", () => {
    const result = evaluateGate(context(), {
      gateType: "subagent_stop",
      metadata: { agentId: "worker-a" },
    });

    expect(result.decision).toBe("warn");
    expect(result.violationType).toBe("SUBAGENT_WITHOUT_TRACE");
  });

  it("allows subagent_stop when run-set contains the agent and accepted evidence", () => {
    const base = context();
    const result = evaluateGate(
      context({
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

    expect(result.decision).toBe("allow");
  });
});
