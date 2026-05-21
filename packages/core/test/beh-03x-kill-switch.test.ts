/**
 * Tests for BEH-032 — In-Band Kill Switch via CYCLE_ABORT
 *
 * Spec: docs/conception/12-behaviors-catalog-spec.md §7 BEH-032
 *
 * H2 security contract (prompt-injection DoS protection):
 *   Prompt-text abort patterns produce WARN only — they cannot directly abort
 *   a governed run. Only operator-attested programmatic signals (cycleAbort=true
 *   with abortTriggeredBy="gate"/"policy" OR abortOrigin present) produce BLOCK
 *   + FinalState: CANCELLED.
 *
 * Falsifies-If regression (updated to match H2):
 *   (1) A cycleAbort=true event with gate/policy attestation does NOT transition
 *       to FinalState: CANCELLED — disproves this behavior.
 *   (2) A prompt-text abort command produces BLOCK + CANCELLED directly (without
 *       operator attestation) — disproves the H2 DoS protection.
 */

import { describe, expect, it } from "vitest";
import {
  BEH_032_DEGRADED_MODE,
  buildAbortReport,
  buildProgrammaticAbortMetadata,
  killSwitch,
  VIOLATION_CYCLE_ABORT,
} from "../src/behaviors/beh-032-kill-switch.js";
import type { GateEvaluationContext } from "../src/gates/evaluate-gate.js";
import type { GateEvent } from "../src/schemas/gate-event.schema.js";
import { createDefaultPlanningProject } from "../src/storage/planning-store.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContext(): GateEvaluationContext {
  const project = createDefaultPlanningProject("run_beh032_test");
  return {
    projectRoot: "/tmp/project",
    state: project.state,
    currentRisk: project.currentRisk,
    runSet: project.runSet,
  };
}

function makeUserPromptEvent(promptContent: string, metadata?: Record<string, unknown>): GateEvent {
  return { gateType: "user_prompt", promptContent, metadata };
}

function makePreToolEvent(metadata?: Record<string, unknown>): GateEvent {
  return { gateType: "pre_tool", toolName: "Bash", metadata };
}

// ── Descriptor shape ──────────────────────────────────────────────────────────

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

// ── No-abort cases — abstain ──────────────────────────────────────────────────

describe("BEH-032 — abstains when no abort intent detected", () => {
  it("abstains for a normal user prompt", () => {
    const ctx = makeContext();
    const event = makeUserPromptEvent("implement the login feature");
    const verdict = killSwitch.classify(ctx, event);
    expect(verdict).toBeNull();
  });

  it("abstains for an empty prompt", () => {
    const ctx = makeContext();
    const event = makeUserPromptEvent("");
    const verdict = killSwitch.classify(ctx, event);
    expect(verdict).toBeNull();
  });

  it("abstains for a pre_tool event with no cycleAbort metadata", () => {
    const ctx = makeContext();
    const event = makePreToolEvent({ toolName: "Read", file_path: "src/foo.ts" });
    const verdict = killSwitch.classify(ctx, event);
    expect(verdict).toBeNull();
  });

  it("abstains when prompt discusses stopping in prose (not an imperative)", () => {
    const ctx = makeContext();
    // Long sentence — prose, not imperative command
    const event = makeUserPromptEvent(
      "I was thinking about whether we should stop this feature development and revisit the architecture",
    );
    const verdict = killSwitch.classify(ctx, event);
    expect(verdict).toBeNull();
  });

  it("abstains for a conditional stop phrase", () => {
    const ctx = makeContext();
    const event = makeUserPromptEvent("if the tests fail, stop the deployment");
    const verdict = killSwitch.classify(ctx, event);
    expect(verdict).toBeNull();
  });

  it("abstains for a question about stopping", () => {
    const ctx = makeContext();
    const event = makeUserPromptEvent("should we stop this run?");
    const verdict = killSwitch.classify(ctx, event);
    expect(verdict).toBeNull();
  });
});

// ── Prompt structural detection — WARN only (H2 DoS protection) ──────────────
// Prompt-text abort patterns are a prompt-injection DoS vector. They produce
// WARN so a human operator can confirm — they do NOT directly abort a governed run.

describe("BEH-032 — prompt structural pattern produces WARN only (H2 DoS protection)", () => {
  it.each([
    "stop",
    "abort",
    "cancel",
    "halt",
    "kill",
    "terminate",
    "end",
  ])("bare imperative '%s' produces warn (not block)", (verb) => {
    const ctx = makeContext();
    const event = makeUserPromptEvent(verb);
    const verdict = killSwitch.classify(ctx, event);
    // Must detect the signal — but WARN, not BLOCK
    expect(verdict).not.toBeNull();
    expect(verdict?.decision).toBe("warn");
    expect(verdict?.violationType).toBe("CYCLE_ABORT");
    // WARN must NOT set finalState to CANCELLED
    expect(verdict?.finalState).toBeUndefined();
  });

  it.each([
    "stop this run",
    "abort this session",
    "cancel this task",
    "halt the agent",
    "terminate the cycle",
    "end this workflow",
    "stop run",
    "abort session",
    "cancel task",
  ])("'%s' with run-noun qualifier produces warn (not block)", (phrase) => {
    const ctx = makeContext();
    const event = makeUserPromptEvent(phrase);
    const verdict = killSwitch.classify(ctx, event);
    expect(verdict).not.toBeNull();
    expect(verdict?.decision).toBe("warn");
    expect(verdict?.finalState).toBeUndefined();
  });

  it("abort with trailing punctuation produces warn", () => {
    const ctx = makeContext();
    const event = makeUserPromptEvent("abort.");
    const verdict = killSwitch.classify(ctx, event);
    expect(verdict?.decision).toBe("warn");
  });

  it("abort with exclamation mark produces warn", () => {
    const ctx = makeContext();
    const event = makeUserPromptEvent("stop!");
    const verdict = killSwitch.classify(ctx, event);
    expect(verdict?.decision).toBe("warn");
  });

  it("is case-insensitive (still produces warn)", () => {
    const ctx = makeContext();
    const event = makeUserPromptEvent("ABORT");
    const verdict = killSwitch.classify(ctx, event);
    expect(verdict?.decision).toBe("warn");
  });

  it("warn reason instructs operator how to abort programmatically", () => {
    const ctx = makeContext();
    const event = makeUserPromptEvent("abort this run");
    const verdict = killSwitch.classify(ctx, event);
    expect(verdict?.reason).toContain("abort this run");
    // Must explain how to do an attested abort
    expect(verdict?.reason).toContain("cycleAbort=true");
  });
});

// ── Programmatic invocation (CLI / MCP path) ──────────────────────────────────
// Operator-attested cycleAbort (gate/policy origin or abortOrigin present) BLOCKS.
// Human-only cycleAbort (abortTriggeredBy="human", no abortOrigin) WARNs.

describe("BEH-032 — programmatic abort via metadata flag", () => {
  it("blocks when cycleAbort=true with abortTriggeredBy='gate' (operator-attested)", () => {
    const ctx = makeContext();
    const event: GateEvent = {
      gateType: "pre_tool",
      metadata: buildProgrammaticAbortMetadata("gate", "policy violation threshold exceeded"),
    };
    const verdict = killSwitch.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
    expect(verdict?.finalState).toBe("CANCELLED");
    expect(verdict?.violationType).toBe("CYCLE_ABORT");
  });

  it("blocks when cycleAbort=true with abortTriggeredBy='policy' (operator-attested)", () => {
    const ctx = makeContext();
    const event: GateEvent = {
      gateType: "user_prompt",
      metadata: buildProgrammaticAbortMetadata("policy", "automated policy abort"),
    };
    const verdict = killSwitch.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
    expect(verdict?.finalState).toBe("CANCELLED");
    expect(verdict?.reason).toContain("policy");
  });

  it("blocks when cycleAbort=true with abortOrigin present (operator-attested via origin)", () => {
    const ctx = makeContext();
    const event: GateEvent = {
      gateType: "user_prompt",
      metadata: {
        cycleAbort: true,
        abortTriggeredBy: "human",
        abortReason: "operator set origin",
        abortOrigin: "harness-cli-v2",
      },
    };
    const verdict = killSwitch.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
    expect(verdict?.finalState).toBe("CANCELLED");
  });

  it("warns (does NOT block) when cycleAbort=true with abortTriggeredBy='human' and no abortOrigin", () => {
    // Human-only cycleAbort could be prompt-injected — only warn, require operator confirmation
    const ctx = makeContext();
    const event: GateEvent = {
      gateType: "user_prompt",
      metadata: buildProgrammaticAbortMetadata("human", "operator requested stop"),
    };
    const verdict = killSwitch.classify(ctx, event);
    expect(verdict?.decision).toBe("warn");
    expect(verdict?.finalState).toBeUndefined();
  });

  it("block verdict carries an abortReport with runId and ts", () => {
    const ctx = makeContext();
    const event: GateEvent = {
      gateType: "pre_tool",
      metadata: buildProgrammaticAbortMetadata("gate", "test abort"),
    };
    const verdict = killSwitch.classify(ctx, event);
    expect(verdict?.abortReport).toBeDefined();
    expect(verdict?.abortReport?.runId).toBe(ctx.runSet.runId);
    expect(typeof verdict?.abortReport?.ts).toBe("string");
  });

  it("buildProgrammaticAbortMetadata sets cycleAbort=true", () => {
    const meta = buildProgrammaticAbortMetadata("human", "test reason");
    expect(meta.cycleAbort).toBe(true);
    expect(meta.abortTriggeredBy).toBe("human");
    expect(meta.abortReason).toBe("test reason");
  });
});

// ── Abort report builder ──────────────────────────────────────────────────────

describe("BEH-032 — buildAbortReport", () => {
  it("produces a report with all required fields", () => {
    const ctx = makeContext();
    const report = buildAbortReport(ctx, "human", "operator abort");
    expect(report.runId).toBe(ctx.runSet.runId);
    expect(typeof report.ts).toBe("string");
    expect(report.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO-8601
    expect(report.triggeredBy).toBe("human");
    expect(report.reason).toBe("operator abort");
    expect(Array.isArray(report.lastActionSignals)).toBe(true);
  });

  it("extracts last 10 entries from loop detector ring buffer when present", () => {
    const ctx = makeContext();
    const entries = Array.from({ length: 15 }, (_, i) => ({
      toolName: "Read",
      argsHash: `hash-${i}`,
      resultHash: `res-${i}`,
      ts: new Date().toISOString(),
    }));
    const ctxWithLoop: GateEvaluationContext = {
      ...ctx,
      runSet: {
        ...ctx.runSet,
        loopDetector: { entries, maxEntries: 10 },
      },
    };
    const report = buildAbortReport(ctxWithLoop, "gate", "loop detected");
    // Should take last 10 of 15 entries
    expect(report.lastActionSignals).toHaveLength(10);
  });

  it("returns empty lastActionSignals when no loop detector present", () => {
    const ctx = makeContext();
    const report = buildAbortReport(ctx, "human", "no loop detector");
    expect(report.lastActionSignals).toHaveLength(0);
  });
});

// ── Falsifies-If regression guard (H2 updated) ───────────────────────────────
//
// Updated per H2 security fix. New Falsifies-If contract:
//   (1) operator-attested cycleAbort MUST produce block + CANCELLED
//   (2) prompt-text abort MUST NOT produce block + CANCELLED directly
//       (would mean DoS via prompt injection is possible)

describe("BEH-032 Falsifies-If counter-example regression", () => {
  it("FALSIFIES-IF (1): operator-attested cycleAbort MUST produce block + CANCELLED", () => {
    const ctx = makeContext();
    const event: GateEvent = {
      gateType: "pre_tool",
      metadata: buildProgrammaticAbortMetadata("gate", "test abort"),
    };

    const verdict = killSwitch.classify(ctx, event);

    expect(verdict).not.toBeNull();
    expect(verdict?.decision).toBe("block");
    expect(verdict?.finalState).toBe("CANCELLED");
    expect(verdict?.violationType).toBe("CYCLE_ABORT");
  });

  it("FALSIFIES-IF (2): prompt-text abort MUST NOT produce block+CANCELLED directly (H2 DoS guard)", () => {
    const ctx = makeContext();
    // Bare imperative via prompt text — unattested, could be prompt-injected
    const event = makeUserPromptEvent("abort");

    const verdict = killSwitch.classify(ctx, event);

    // Must detect the signal (not null) but must NOT block
    expect(verdict).not.toBeNull();
    expect(verdict?.decision).toBe("warn");
    // MUST NOT transition to CANCELLED directly from prompt text alone
    expect(verdict?.finalState).toBeUndefined();
  });

  it("COUNTER-EXAMPLE: prose mentioning 'stop' in a long sentence MUST NOT trigger (false positive guard)", () => {
    const ctx = makeContext();
    // More than 12 words — prose discussion, not an imperative command
    const event = makeUserPromptEvent(
      "please do not stop working on this feature because it is critical for the deadline",
    );

    const verdict = killSwitch.classify(ctx, event);

    // This falsifies a broken implementation that does keyword scanning instead of
    // structural pattern matching. The correct behavior is to abstain (null).
    expect(verdict).toBeNull();
  });
});
