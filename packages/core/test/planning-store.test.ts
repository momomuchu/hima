import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appendRunEvent,
  CurrentRiskFileSchema,
  getEventsLogPath,
  getLedgerPath,
  getPlanningPaths,
  initPlanningProject,
  RunSetFileSchema,
  readEventLog,
  readLedger,
  readPlanningProject,
  verifyLedgerEntries,
  writePlanningProject,
} from "../src/index.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "harness-core-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("planning store", () => {
  it("creates and reads the three canonical files", async () => {
    const created = await initPlanningProject(root);
    const paths = getPlanningPaths(root);
    const read = await readPlanningProject(root);

    expect(
      paths.stateFile.endsWith(".planning\\state.yaml") ||
        paths.stateFile.endsWith(".planning/state.yaml"),
    ).toBe(true);
    expect(read.state.run_id).toBe(created.state.run_id);
    expect(read.state.phase).toBe("discovery");
    expect(read.currentRisk.risk_class).toBe("T");
    expect(read.runSet.route.phase).toBe("discovery");
  });

  it("stores run events in run-set and append-only audit logs", async () => {
    await initPlanningProject(root);

    await appendRunEvent(root, {
      id: "event-1",
      ts: "2026-05-03T00:00:00.000Z",
      type: "GATE_EVALUATED",
      decision: "allow",
      reason: "first event",
    });
    await appendRunEvent(root, {
      id: "event-2",
      ts: "2026-05-03T00:00:01.000Z",
      type: "GATE_EVALUATED",
      decision: "warn",
      reason: "second event",
    });

    const paths = getPlanningPaths(root);
    const planningEntries = await readdir(paths.planningDir);
    const read = await readPlanningProject(root);
    const eventsLog = await readEventLog(root);
    const ledger = await readLedger(root, read.runSet.runId);

    expect(planningEntries.sort()).toEqual(["current-risk.yaml", "run-set.json", "state.yaml"]);
    expect(read.runSet.events.map((event) => event.id)).toEqual(["event-1", "event-2"]);
    expect(getEventsLogPath(root)).toMatch(/\.hima[\\/]state[\\/]events\.jsonl$/);
    expect(getLedgerPath(root, read.runSet.runId)).toMatch(
      /\.hima[\\/]state[\\/]ledger[\\/].+\.jsonl$/,
    );
    expect(eventsLog.map((event) => event.id)).toEqual(["event-1", "event-2"]);
    expect(
      ledger.map((event) => event.payload).map((payload) => (payload as { id: string }).id),
    ).toEqual(["event-1", "event-2"]);
    expect(verifyLedgerEntries(ledger)).toBe(true);
  });

  it("preserves opaque RMS set payloads while validating the typed run-set envelope", async () => {
    const created = await initPlanningProject(root);
    const runSet = {
      ...created.runSet,
      project: {
        schemaVersion: 1 as const,
        name: "Pipeline Fractale v4",
        repoPaths: {
          planning: ".planning" as const,
          root: root.replaceAll("\\", "/"),
          futurePath: { nested: true },
        },
        tags: ["rms", "hooks"],
        futureProjectField: {
          nested: ["keep", true, 7, null],
        },
      },
      intent: {
        schemaVersion: 1 as const,
        objective: "Harden RMS contracts",
        inScope: ["schemas", "mcp-boundaries"],
        ambiguities: [],
        effectiveRiskClass: "M" as const,
        futureIntentField: {
          transcript: { language: "fr", source: "speech-to-text" },
        },
      },
      policy: {
        schemaVersion: 1 as const,
        globalRules: ["opaque sets are advisory unless a typed service reads them"],
        riskPolicies: {
          H: {
            humanCheckpointRequired: true,
            futureRiskPolicyField: ["preserve"],
          },
        },
        gatePolicies: {
          pre_tool: {
            canBlock: true,
            enforcement: "block" as const,
            futureGatePolicyField: { reason: "runtime hook" },
          },
        },
      },
      subagents: [
        {
          agentId: "agent-contract-audit",
          role: "test-engineer",
          runtime: "codex",
          status: "completed" as const,
          scope: ["packages/core"],
          evidenceRefs: ["ev-subagent-output"],
          metadata: {
            nested: { preserved: true },
            values: [true, false, 1, null, "text"],
          },
          futureSubagentField: { preserved: true },
        },
      ],
      evidence: [
        {
          id: "ev-subagent-output",
          key: "subagent_output" as const,
          kind: "verification",
          status: "accepted" as const,
          summary: "subagent verified the schema contract",
          source: "agent" as const,
          metadata: {
            verifiedHuman: "not-authority",
            nested: { preserved: true },
          },
          createdAt: "2026-05-03T00:00:00.000Z",
        },
      ],
    };

    await writePlanningProject(root, {
      ...created,
      runSet,
    });

    const read = await readPlanningProject(root);

    expect(read.runSet.project).toEqual(runSet.project);
    expect(read.runSet.intent).toEqual(runSet.intent);
    expect(read.runSet.policy).toEqual(runSet.policy);
    expect(read.runSet.subagents).toEqual(runSet.subagents);
    expect(read.runSet.evidence[0].metadata).toEqual(runSet.evidence[0].metadata);
  });

  it.each([
    ["project", null],
    ["project", []],
    ["project", "not-an-object"],
    ["intent", null],
    ["intent", []],
    ["policy", 42],
    ["policy", true],
    ["subagents", ["agent-id-only"]],
    ["subagents", [{}]],
  ] as const)("rejects invalid run-set contract root %s=%j", (field, value) => {
    const base = initRunSetFixture();

    expect(
      RunSetFileSchema.safeParse({
        ...base,
        [field]: value,
      }).success,
    ).toBe(false);
  });

  it("preserves typed current-risk promotion history entries", () => {
    const base = {
      version: 1 as const,
      run_id: "run_risk_contract",
      risk_class: "H" as const,
      rank: 3,
      bypass_allowed: false,
      human_checkpoint_required: true,
      forcing_signals: ["restricted H-risk path"],
      promotion_history: [
        {
          from: "M" as const,
          to: "H" as const,
          signal: "auth path changed",
          reason: "auth/session-store.ts matched a force signal",
          ts: "2026-05-03T00:00:00.000Z",
          futureAuditField: {
            preserved: true,
          },
        },
      ],
      updated_at: "2026-05-03T00:00:00.000Z",
    };

    expect(CurrentRiskFileSchema.parse(base)).toEqual(base);
    expect(
      CurrentRiskFileSchema.safeParse({
        ...base,
        promotion_history: ["M->H"],
      }).success,
    ).toBe(false);
  });
});

function initRunSetFixture() {
  return {
    version: 1 as const,
    runId: "run_schema_contract",
    project: {},
    intent: {},
    runtimeCapabilities: {},
    runtimeBindings: {},
    policy: {},
    route: {
      phase: "discovery" as const,
      subPhase: "Observer" as const,
      mode: "auto" as const,
      riskClass: "T" as const,
    },
    events: [],
    evidence: [],
    subagents: [],
    finalization: {
      state: "ACTIVE" as const,
      gaps: [],
    },
  };
}
