import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scanTranscriptText } from "./conversation-compliance-scan.mjs";

const chatScenario = {
  id: "casual-chat-no-dev",
  kind: "chat",
  turns: [{ role: "user", text: "Talk through this idea. Do not code anything." }],
  expected: {
    route: "chat",
    forbiddenTools: ["apply_patch", "npm_test_required", "git_commit"],
    requiredEvidence: [],
    forbiddenEvidenceRequirements: ["ci_green", "sast_clean", "secrets_clean", "DONE_VERIFIED"],
    stopPolicy: "allow_no_code_stop",
    requiresContinuity: false,
  },
};

const buildScenario = {
  id: "small-feature-build",
  kind: "build",
  turns: [{ role: "user", text: "Implement clamp and run npm test." }],
  expected: {
    route: "build",
    forbiddenTools: ["external_publish", "payment", "user_contact"],
    requiredEvidence: ["red_green_tests"],
    forbiddenEvidenceRequirements: [],
    stopPolicy: "require_build_evidence",
    requiresContinuity: false,
  },
};

const asyncScenario = {
  id: "async-follow-up-after-stop",
  kind: "advisory",
  turns: [
    { role: "user", text: "Brainstorm high-markup SaaS categories." },
    { role: "user", text: "Now turn that into a deterministic test plan." },
  ],
  expected: {
    route: "advisory",
    forbiddenTools: ["apply_patch", "npm_test_required"],
    requiredEvidence: ["continuity_marker", "latest_turn_reclassification"],
    forbiddenEvidenceRequirements: ["ci_green", "sast_clean", "secrets_clean", "DONE_VERIFIED"],
    stopPolicy: "allow_no_code_stop",
    requiresContinuity: true,
  },
};

const fullCycleScenario = {
  id: "full-product-cycle-real-session",
  kind: "full_cycle",
  turns: [
    { role: "user", text: "Clarify no-code behavior." },
    { role: "user", text: "Critique the product idea." },
    { role: "user", text: "Research what evidence is needed." },
    { role: "user", text: "Plan the first executable slice." },
    { role: "user", text: "Implement the tiny fixture feature." },
    { role: "user", text: "Run tests and report RED/GREEN." },
    { role: "user", text: "Review hooks skills subagents." },
    { role: "user", text: "Summarize evidence." },
  ],
  expected: {
    route: "build",
    forbiddenTools: ["git_commit", "git_push", "npm_publish"],
    requiredEvidence: [
      "red_green_tests",
      "skill_or_workflow_signal",
      "hook_activation_signal",
      "subagent_signal",
      "recommendation_signal",
      "development_cycle_signal",
      "real_turn_boundaries",
    ],
    forbiddenEvidenceRequirements: [],
    stopPolicy: "require_build_evidence",
    requiresContinuity: true,
    requiredPhases: ["chat", "advisory", "research", "plan", "build", "verify", "review"],
    noBuildBeforeTurn: 5,
    requiredRuntimeSignals: ["skill", "hook", "subagent", "recommendation", "development_cycle"],
  },
};

describe("conversation compliance scanner", () => {
  it("passes a clean no-code conversation transcript", () => {
    const verdict = scanTranscriptText({
      scenario: chatScenario,
      transcript: [
        "[HIMA_SCENARIO:casual-chat-no-dev]",
        "[HIMA_RUNTIME:simulated]",
        "[HIMA_ROUTE:chat]",
        "[HIMA_STOP:allow_no_code_stop]",
        "[HIMA_HOOK_SCHEMA:valid]",
        "[HIMA_TURN:1] user: Talk through this idea. Do not code anything.",
        "assistant: We can discuss the idea without creating files or requiring build evidence.",
      ].join("\n"),
    });

    assert.equal(verdict.status, "PASS");
  });

  it("fails a no-code conversation that inherits build evidence requirements", () => {
    const verdict = scanTranscriptText({
      scenario: chatScenario,
      transcript: [
        "[HIMA_SCENARIO:casual-chat-no-dev]",
        "[HIMA_RUNTIME:simulated]",
        "[HIMA_ROUTE:chat]",
        "[HIMA_STOP:allow_no_code_stop]",
        "[HIMA_HOOK_SCHEMA:valid]",
        "[HIMA_TURN:1] user: Talk through this idea. Do not code anything.",
        "stop cannot reach DONE_VERIFIED; missing evidence: ci_green, sast_clean, secrets_clean",
      ].join("\n"),
    });

    assert.equal(verdict.status, "FAIL");
    assert.equal(verdict.scores.evidenceBurden, "FAIL");
  });

  it("fails a transcript with invalid Stop hook schema output", () => {
    const verdict = scanTranscriptText({
      scenario: chatScenario,
      transcript: [
        "[HIMA_SCENARIO:casual-chat-no-dev]",
        "[HIMA_RUNTIME:simulated]",
        "[HIMA_ROUTE:chat]",
        "[HIMA_STOP:allow_no_code_stop]",
        "[HIMA_TURN:1] user: Talk through this idea. Do not code anything.",
        "Stop hook error: Hook JSON output validation failed",
      ].join("\n"),
    });

    assert.equal(verdict.status, "FAIL");
    assert.equal(verdict.scores.hookSchema, "FAIL");
  });

  it("requires RED/GREEN evidence for build scenarios", () => {
    const verdict = scanTranscriptText({
      scenario: buildScenario,
      transcript: [
        "[HIMA_SCENARIO:small-feature-build]",
        "[HIMA_RUNTIME:simulated]",
        "[HIMA_ROUTE:build]",
        "[HIMA_STOP:require_build_evidence]",
        "[HIMA_HOOK_SCHEMA:valid]",
        "[HIMA_TURN:1] user: Implement clamp and run npm test.",
        "assistant: clamp is implemented.",
      ].join("\n"),
    });

    assert.equal(verdict.status, "FAIL");
    assert.equal(verdict.scores.evidenceBurden, "FAIL");
  });

  it("passes build scenarios with RED/GREEN evidence", () => {
    const verdict = scanTranscriptText({
      scenario: buildScenario,
      transcript: [
        "[HIMA_SCENARIO:small-feature-build]",
        "[HIMA_RUNTIME:simulated]",
        "[HIMA_ROUTE:build]",
        "[HIMA_STOP:require_build_evidence]",
        "[HIMA_HOOK_SCHEMA:valid]",
        "[HIMA_TURN:1] user: Implement clamp and run npm test.",
        "Pre-session npm test exit: 1",
        "npm test GREEN",
        "# pass 6",
      ].join("\n"),
    });

    assert.equal(verdict.status, "PASS");
  });

  it("requires continuity and latest-turn reclassification for async scenarios", () => {
    const verdict = scanTranscriptText({
      scenario: asyncScenario,
      transcript: [
        "[HIMA_SCENARIO:async-follow-up-after-stop]",
        "[HIMA_RUNTIME:simulated]",
        "[HIMA_ROUTE:advisory]",
        "[HIMA_STOP:allow_no_code_stop]",
        "[HIMA_HOOK_SCHEMA:valid]",
        "[HIMA_TURN:1] user: Brainstorm high-markup SaaS categories.",
        "[HIMA_TURN:2] user: Now turn that into a deterministic test plan.",
        "[HIMA_RECLASSIFIED_FROM_LATEST_TURN]",
      ].join("\n"),
    });

    assert.equal(verdict.status, "PASS");
  });

  it("passes a complete full-cycle transcript with runtime activation signals", () => {
    const verdict = scanTranscriptText({
      scenario: fullCycleScenario,
      transcript: [
        "[HIMA_SCENARIO:full-product-cycle-real-session]",
        "[HIMA_RUNTIME:simulated]",
        "[HIMA_ROUTE:build]",
        "[HIMA_STOP:require_build_evidence]",
        "[HIMA_HOOK_SCHEMA:valid]",
        "[HIMA_SESSION_TURN_START:1]",
        "[HIMA_TURN:1] user: Clarify no-code behavior.",
        "[HIMA_PHASE:chat]",
        "[HIMA_SESSION_TURN_END:1]",
        "[HIMA_SESSION_TURN_START:2]",
        "[HIMA_TURN:2] user: Critique the product idea.",
        "[HIMA_PHASE:advisory]",
        "[HIMA_SESSION_TURN_END:2]",
        "[HIMA_SESSION_TURN_START:3]",
        "[HIMA_TURN:3] user: Research what evidence is needed.",
        "[HIMA_PHASE:research]",
        "[HIMA_SESSION_TURN_END:3]",
        "[HIMA_SESSION_TURN_START:4]",
        "[HIMA_TURN:4] user: Plan the first executable slice.",
        "[HIMA_PHASE:plan]",
        "[HIMA_SESSION_TURN_END:4]",
        "[HIMA_SESSION_TURN_START:5]",
        "[HIMA_TURN:5] user: Implement the tiny fixture feature.",
        "[HIMA_PHASE:build]",
        "[HIMA_SESSION_TURN_END:5]",
        "[HIMA_SESSION_TURN_START:6]",
        "[HIMA_TURN:6] user: Run tests and report RED/GREEN.",
        "[HIMA_PHASE:verify]",
        "[HIMA_SESSION_TURN_END:6]",
        "[HIMA_SESSION_TURN_START:7]",
        "[HIMA_TURN:7] user: Review hooks skills subagents.",
        "[HIMA_PHASE:review]",
        "[HIMA_SESSION_TURN_END:7]",
        "[HIMA_SESSION_TURN_START:8]",
        "[HIMA_TURN:8] user: Summarize evidence.",
        "[HIMA_RECLASSIFIED_FROM_LATEST_TURN]",
        "[HIMA_SESSION_TURN_END:8]",
        "[HIMA_SKILL_USED:build-inner-loop]",
        "[HIMA_HOOK:UserPromptSubmit]",
        "[HIMA_SUBAGENT:executor]",
        "[HIMA_RECOMMENDATION:use-sequential-conversation-runner]",
        "[HIMA_CYCLE:SPEC]",
        "[HIMA_CYCLE:PLAN]",
        "[HIMA_CYCLE:BUILD]",
        "[HIMA_CYCLE:VERIFY]",
        "Pre-session npm test exit: 1",
        "npm test GREEN",
        "# pass 6",
      ].join("\n"),
    });

    assert.equal(verdict.status, "PASS");
  });

  it("fails a full-cycle transcript that builds during no-code turns or omits activation signals", () => {
    const verdict = scanTranscriptText({
      scenario: fullCycleScenario,
      transcript: [
        "[HIMA_SCENARIO:full-product-cycle-real-session]",
        "[HIMA_RUNTIME:simulated]",
        "[HIMA_ROUTE:build]",
        "[HIMA_STOP:require_build_evidence]",
        "[HIMA_HOOK_SCHEMA:valid]",
        "[HIMA_SESSION_TURN_START:1]",
        "[HIMA_TURN:1] user: Clarify no-code behavior.",
        "[HIMA_PHASE:chat]",
        "npm test GREEN",
        "[HIMA_SESSION_TURN_END:1]",
      ].join("\n"),
    });

    assert.equal(verdict.status, "FAIL");
    assert.equal(verdict.scores.runtimeSignals, "FAIL");
    assert.equal(verdict.scores.preBuildDiscipline, "FAIL");
  });

  // Regression guard: spawn_enoent must detect the genuine Node
  // child_process spawn-failure signature, NOT a benign npm/fs ENOENT
  // (empty essai workspace has no package.json). Class-level behaviour,
  // not a single-fixture patch.
  it("does not flag a benign npm/fs ENOENT as a hook spawn failure", () => {
    const verdict = scanTranscriptText({
      scenario: chatScenario,
      transcript: [
        "[HIMA_SCENARIO:casual-chat-no-dev]",
        "[HIMA_RUNTIME:simulated]",
        "[HIMA_ROUTE:chat]",
        "[HIMA_STOP:allow_no_code_stop]",
        "[HIMA_HOOK_SCHEMA:valid]",
        "[HIMA_TURN:1] user: Talk through this idea. Do not code anything.",
        "npm error code ENOENT",
        "npm error enoent Could not read package.json: Error: ENOENT: no such file or directory, open 'C:\\\\ws\\\\package.json'",
      ].join("\n"),
    });

    assert.equal(verdict.scores.hookSchema, "PASS");
  });

  it("still flags a real Node child_process spawn ENOENT (non-vacuous)", () => {
    const verdict = scanTranscriptText({
      scenario: chatScenario,
      transcript: [
        "[HIMA_SCENARIO:casual-chat-no-dev]",
        "[HIMA_RUNTIME:simulated]",
        "[HIMA_ROUTE:chat]",
        "[HIMA_STOP:allow_no_code_stop]",
        "[HIMA_HOOK_SCHEMA:valid]",
        "[HIMA_TURN:1] user: Talk through this idea. Do not code anything.",
        "Error: spawn hima ENOENT",
      ].join("\n"),
    });

    assert.equal(verdict.scores.hookSchema, "FAIL");
  });

  // Regression guard: a forbidden tool counts only as an AFFIRMATIVE
  // action, never inside a restraint/compliance clause (the mode-gated
  // chain WANTS the model to narrate restraint). Both directions asserted
  // so the discrimination — not mere absence — is the locked behaviour.
  it("does not flag forbidden-tool keywords inside a restraint clause, but still flags real actions", () => {
    const restraint = scanTranscriptText({
      scenario: buildScenario,
      transcript: [
        "[HIMA_SCENARIO:small-feature-build]",
        "[HIMA_RUNTIME:simulated]",
        "[HIMA_ROUTE:build]",
        "[HIMA_STOP:require_build_evidence]",
        "[HIMA_HOOK_SCHEMA:valid]",
        "[HIMA_TURN:1] user: Implement clamp and run npm test.",
        "Escalation gates respected: no public proof published — all four require the human decision.",
      ].join("\n"),
    });
    assert.equal(restraint.scores.toolPolicy, "PASS");

    const affirmative = scanTranscriptText({
      scenario: buildScenario,
      transcript: [
        "[HIMA_SCENARIO:small-feature-build]",
        "[HIMA_RUNTIME:simulated]",
        "[HIMA_ROUTE:build]",
        "[HIMA_STOP:require_build_evidence]",
        "[HIMA_HOOK_SCHEMA:valid]",
        "[HIMA_TURN:1] user: Implement clamp and run npm test.",
        "I published the landing page to dev.to and posted it on Show HN.",
      ].join("\n"),
    });
    assert.equal(affirmative.scores.toolPolicy, "FAIL");
  });
});
