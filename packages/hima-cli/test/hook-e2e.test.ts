// e2e: stop event with riskClass T → allow, using @hima/gates-core's fixed evaluateGate.
// Creates a temporary .hima/ project via initProject, builds GateEvaluationContext
// from disk state, and calls evaluateGate directly — verifying the
// requiresEvidenceBeforeStop=false fix for riskClass T.

import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { initProject, readPlanningProject } from "@harness/core";
import { evaluateGate, type GateEvaluationContext } from "@hima/gates-core";
import { formatVerdict } from "../src/format.js";
import type { GateType, Verdict } from "../src/types.js";
import { GATE_TYPES } from "../src/types.js";

function parseGateType(event: string): GateType {
  const normalized = event.toLowerCase().replaceAll("-", "_");
  if (GATE_TYPES.includes(normalized as GateType)) return normalized as GateType;
  throw new Error(`Unknown hook event: ${event}. Valid events: ${GATE_TYPES.join(", ")}`);
}

const tmpDirs: string[] = [];

async function makeTmpProject(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "hima-cli-test-"));
  tmpDirs.push(dir);
  await initProject(dir);
  return dir;
}

async function evalStop(root: string): Promise<ReturnType<typeof evaluateGate>> {
  const project = await readPlanningProject(root);
  const context: GateEvaluationContext = {
    projectRoot: root,
    state: project.state,
    currentRisk: project.currentRisk,
    runSet: project.runSet,
  };
  return evaluateGate(context, { gateType: "stop" });
}

afterEach(async () => {
  for (const dir of tmpDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe("hook pipeline e2e — real dispatch via @hima/gates-core", () => {
  it("stop event with riskClass T returns allow (requiresEvidenceBeforeStop=false fix)", async () => {
    const root = await makeTmpProject();
    const result = await evalStop(root);
    expect(result.decision).toBe("allow");
  });

  it("stop + allow formatted for claude returns object without decision key", async () => {
    const root = await makeTmpProject();
    const result = await evalStop(root);
    const verdict: Verdict = {
      decision: result.decision as Verdict["decision"],
      reason: result.reason,
      contextInjection: result.contextInjection,
    };
    const output = formatVerdict("stop", verdict, "claude");
    expect(output).not.toHaveProperty("decision");
  });

  it("stop + allow formatted for hermes returns empty object", async () => {
    const root = await makeTmpProject();
    const result = await evalStop(root);
    const verdict: Verdict = {
      decision: result.decision as Verdict["decision"],
      reason: result.reason,
      contextInjection: result.contextInjection,
    };
    const output = formatVerdict("stop", verdict, "hermes");
    expect(output).toEqual({});
  });

  it("parseGateType throws on unknown event", () => {
    expect(() => parseGateType("not_a_real_event")).toThrow("Unknown hook event");
  });

  it("all canonical gate types parse without error", () => {
    for (const gt of GATE_TYPES) {
      expect(() => parseGateType(gt)).not.toThrow();
    }
  });
});
