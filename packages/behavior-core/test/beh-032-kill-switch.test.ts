import { describe, expect, it } from "vitest";
import {
  BEH_032_DEGRADED_MODE,
  buildAbortReport,
  buildProgrammaticAbortMetadata,
  killSwitch,
  VIOLATION_CYCLE_ABORT,
} from "../src/behaviors/beh-032-kill-switch.js";
import type { GateEvaluationContext } from "../src/behavior-registry.js";
import type { GateEvent } from "../src/gate-event.js";
import type { CurrentRiskFile, RunSetFile } from "../src/run-set-types.js";

function makeContext(): GateEvaluationContext {
  return {
    projectRoot: "/tmp/project",
    currentRisk: { risk_class: "M" } as CurrentRiskFile,
    runSet: {
      runId: "run_beh032_test",
      policy: {},
      evidence: [],
      events: [],
      subagents: [],
    } as RunSetFile,
  };
}

function makeUserPromptEvent(promptContent: string, metadata?: Record<string, unknown>): GateEvent {
  return { gateType: "user_prompt", promptContent, metadata };
}

function makePreToolEvent(metadata?: Record<string, unknown>): GateEvent {
  return { gateType: "pre_tool", toolName: "Bash", metadata };
}

describe("BEH-032 descriptor", () => {
  it("has id BEH-032", () => {
    expect(killSwitch.id).toBe("BEH-032");
  });

  it("fires on both user_prompt and pre_tool gates", () => {
    expect(killSwitch.gates).toContain("user_prompt");
    expect(killSwitch.gates).toContain("pre_tool");
    expect(killSwitch.gates).toHaveLength(2);
  });

  it("exports degraded-mode strings for codex and hermes", () => {
    expect(typeof BEH_032_DEGRADED_MODE.codex).toBe("string");
    expect(typeof BEH_032_DEGRADED_MODE.hermes).toBe("string");
    expect(BEH_032_DEGRADED_MODE.codex.length).toBeGreaterThan(0);
    expect(BEH_032_DEGRADED_MODE.hermes.length).toBeGreaterThan(0);
  });

  it("exports violation type identifier", () => {
    expect(VIOLATION_CYCLE_ABORT).toBe("CYCLE_ABORT");
  });
});

describe("BEH-032 — abstains when no abort intent detected", () => {
  it("abstains for a normal user prompt", () => {
    const ctx = makeContext();
    expect(killSwitch.classify(ctx, makeUserPromptEvent("Please help me refactor this function."))).toBeNull();
  });

  it("abstains for an empty prompt", () => {
    expect(killSwitch.classify(makeContext(), makeUserPromptEvent(""))).toBeNull();
  });

  it("abstains for a pre_tool event with no metadata", () => {
    expect(killSwitch.classify(makeContext(), makePreToolEvent())).toBeNull();
  });

  it("abstains for a pre_tool event with unrelated metadata", () => {
    expect(killSwitch.classify(makeContext(), makePreToolEvent({ someOtherFlag: true }))).toBeNull();
  });

  it("abstains for a long prompt that happens to contain 'stop' in a sentence", () => {
    const longPrompt = "Can you please stop for a moment and think about the architecture before proceeding with the implementation?";
    expect(killSwitch.classify(makeContext(), makeUserPromptEvent(longPrompt))).toBeNull();
  });
});

describe("BEH-032 — prompt-text abort (warn only, H2 DoS protection)", () => {
  it("produces WARN (not block) for short imperative 'stop'", () => {
    const verdict = killSwitch.classify(makeContext(), makeUserPromptEvent("stop"));
    expect(verdict).not.toBeNull();
    expect(verdict?.decision).toBe("warn");
    expect(verdict?.violationType).toBe(VIOLATION_CYCLE_ABORT);
  });

  it("produces WARN for 'abort' imperative", () => {
    expect(killSwitch.classify(makeContext(), makeUserPromptEvent("abort"))?.decision).toBe("warn");
  });

  it("produces WARN for 'cancel this run'", () => {
    expect(killSwitch.classify(makeContext(), makeUserPromptEvent("cancel this run"))?.decision).toBe("warn");
  });

  it("produces WARN for 'stop the agent'", () => {
    expect(killSwitch.classify(makeContext(), makeUserPromptEvent("stop the agent"))?.decision).toBe("warn");
  });

  it("FALSIFIES-IF (H2): prompt-text abort MUST NOT produce block+CANCELLED directly", () => {
    const verdict = killSwitch.classify(makeContext(), makeUserPromptEvent("stop"));
    expect(verdict?.decision).not.toBe("block");
    expect(verdict?.finalState).not.toBe("CANCELLED");
  });
});

describe("BEH-032 — programmatic abort (operator-attested → block+CANCELLED)", () => {
  it("blocks with CANCELLED for cycleAbort=true with abortTriggeredBy=gate", () => {
    const meta = buildProgrammaticAbortMetadata("gate", "automated policy trigger");
    const verdict = killSwitch.classify(makeContext(), makePreToolEvent(meta));
    expect(verdict?.decision).toBe("block");
    expect(verdict?.finalState).toBe("CANCELLED");
    expect(verdict?.violationType).toBe(VIOLATION_CYCLE_ABORT);
  });

  it("blocks with CANCELLED for cycleAbort=true with abortTriggeredBy=policy", () => {
    const meta = buildProgrammaticAbortMetadata("policy", "policy enforcement");
    const verdict = killSwitch.classify(makeContext(), makePreToolEvent(meta));
    expect(verdict?.decision).toBe("block");
    expect(verdict?.finalState).toBe("CANCELLED");
  });

  it("blocks with CANCELLED on user_prompt gate too when operator-attested", () => {
    const meta = buildProgrammaticAbortMetadata("gate", "operator abort");
    const verdict = killSwitch.classify(makeContext(), makeUserPromptEvent("", meta));
    expect(verdict?.decision).toBe("block");
    expect(verdict?.finalState).toBe("CANCELLED");
  });

  it("produces WARN (not block) for cycleAbort=true with abortTriggeredBy=human and no abortOrigin", () => {
    const meta = { cycleAbort: true, abortTriggeredBy: "human", abortReason: "user clicked stop" };
    const verdict = killSwitch.classify(makeContext(), makePreToolEvent(meta));
    expect(verdict?.decision).toBe("warn");
    expect(verdict?.finalState).not.toBe("CANCELLED");
  });

  it("blocks when cycleAbort=true with abortOrigin present (operator attestation)", () => {
    const meta = { cycleAbort: true, abortTriggeredBy: "human", abortOrigin: "harness-operator", abortReason: "operator set this" };
    const verdict = killSwitch.classify(makeContext(), makePreToolEvent(meta));
    expect(verdict?.decision).toBe("block");
    expect(verdict?.finalState).toBe("CANCELLED");
  });

  it("FALSIFIES-IF: cycleAbort=true with gate attestation MUST produce block+CANCELLED", () => {
    const meta = buildProgrammaticAbortMetadata("gate", "test abort");
    const verdict = killSwitch.classify(makeContext(), makePreToolEvent(meta));
    expect(verdict?.decision).toBe("block");
    expect(verdict?.finalState).toBe("CANCELLED");
    expect(verdict?.reason).toContain("CYCLE_ABORT");
  });
});

describe("buildProgrammaticAbortMetadata", () => {
  it("builds metadata with cycleAbort=true", () => {
    const meta = buildProgrammaticAbortMetadata("gate", "test reason");
    expect(meta.cycleAbort).toBe(true);
    expect(meta.abortTriggeredBy).toBe("gate");
    expect(meta.abortReason).toBe("test reason");
  });
});

describe("buildAbortReport", () => {
  it("builds an abort report with runId and ts", () => {
    const ctx = makeContext();
    const report = buildAbortReport(ctx, "gate", "test abort");
    expect(report.runId).toBe("run_beh032_test");
    expect(typeof report.ts).toBe("string");
    expect(report.triggeredBy).toBe("gate");
    expect(report.reason).toBe("test abort");
    expect(Array.isArray(report.lastActionSignals)).toBe(true);
  });
});
