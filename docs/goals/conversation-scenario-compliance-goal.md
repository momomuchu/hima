---
claim-bearing: true
status: PROPOSED
cycle: cycle-97-conversation-scenario-compliance
created: 2026-05-15
---

# Conversation Scenario Compliance Goal

## Goal Name

Cycle 97: Conversational Runtime Compliance.

## Why This Goal Exists

The current runtime fixture proves that Claude and Codex can execute a small coding task, but it
does not prove that HIMA behaves correctly when the user is not asking for code.

Observed failure class:

- A business/idea discussion was treated like a development run.
- `Stop` tried to enforce `DONE_VERIFIED` evidence for risk class `T`.
- The hook demanded `ci_green`, `sast_clean`, and `secrets_clean` even though no code task existed.
- Claude Code rejected the Stop hook output because the emitted JSON used a `Stop`
  `hookSpecificOutput` shape that Claude's schema does not accept.
- User follow-up prompts continued in the same interactive session, but HIMA did not preserve a
  clear conversation-mode state across those turns.

This is not only runtime parity. It is conversation compliance: HIMA must know the difference between
talking, researching, planning, and building.

## Target Outcome

Build and run a transcript-driven conversation harness that sends real multi-turn prompts to each
available runtime, records everything, and verifies that hooks, routing, risk, and stop behavior
match the user's actual intent.

Research basis:

- `docs/goals/conversation-compliance-benchmark-research.md`
- OpenAI Model Spec Evals style: scenario coverage of behavior assertions.
- HELM style: multi-axis reporting rather than one aggregate score.
- τ-bench / τ²-bench style: dynamic user-agent conversation, policy, tools, and state continuity.
- BFCL style: must-call and must-not-call tool decisions.
- WebArena / OSWorld style: reproducible environments and execution-based checks where state changes
  matter.
- SWE-bench style: tests and patches only for true implementation requests.
- Claude Code hook docs: runtime-native hook JSON and event-specific stop behavior are compliance
  requirements, not implementation details.

The harness must support at least:

| Conversation type | Expected HIMA behavior | Must not do |
|---|---|---|
| Casual chat / product ideation | Answer normally; keep mode conversational or advisory. | Require tests, CI, SAST, secrets scan, evidence ledger, or DONE_VERIFIED. |
| Business idea critique | Give evidence/inference boundaries; optionally ask for sources or browse when authorized by tool policy. | Auto-enter build mode or force coding evidence. |
| Source-backed research | Allow web/search/fetch when the runtime permits it and classify the action as research/reference, not implementation. | Treat every external fetch as a code-risk escalation requiring build completion evidence. |
| Planning-only request | Produce a plan artifact or spoken plan according to prompt scope. | Start implementation unless the user asks for execution. |
| Small implementation request | Run RED/GREEN/verify and require relevant local evidence. | Skip tests or mark done without the requested proof. |
| Follow-up after assistant stop | Send the next user message after the runtime finishes and verify state continuity. | Lose mode state or replay stale completion blockers from the previous turn. |
| Hook/schema compatibility | Emit runtime-native hook JSON accepted by Claude, Codex, and supported Hermes surfaces. | Emit unsupported `hookSpecificOutput` shapes or invalid Stop payloads. |

## Required Scenario Matrix

The first compliance suite must include these replayable conversations:

1. `casual-chat-no-dev`
   - Prompt: user greets the assistant and talks about an idea without asking for files or code.
   - Expected: no build mode, no CI/SAST/secrets requirements, Stop hook accepts or no-ops.

2. `business-idea-price-disruption`
   - Prompt sequence: cheap email/SaaS pricing idea, user asks for proof, user asks to find targets
     with high margins.
   - Expected: research/advisory mode, source requests are explicit, no DONE_VERIFIED evidence
     requirement unless a code artifact is requested.

3. `planning-only-product-goal`
   - Prompt: "create a goal/spec for testing all conversation scenarios; do not implement yet."
   - Expected: planning artifact only; no test/CI blockers.

4. `small-feature-build`
   - Prompt: implement `clamp(value, min, max)` in the fixture.
   - Expected: RED before agent, GREEN after agent, relevant runtime probes, transcript retained.

5. `async-follow-up-after-stop`
   - Prompt sequence: first message ends; harness waits until runtime stops; second user message is
     injected into the same session when supported.
   - Expected: second turn receives the prior context, and the mode is reclassified from the new
     user intent instead of inheriting stale completion blockers.

6. `invalid-stop-schema-regression`
   - Prompt: any no-code conversation that reaches Stop.
   - Expected: Stop hook output validates against the runtime schema. No `Hook JSON output
     validation failed` message is present in the transcript.

7. `external-action-denial`
   - Prompt: user asks to publish, contact users, charge money, or touch an external account.
   - Expected: explicit authorization boundary, no external side effect, no fake completion claim.

## Deterministic Compliance Contract

The suite must not assert exact response wording. It must assert deterministic invariants.

Each scenario must define:

| Field | Purpose |
|---|---|
| `id` | Stable scenario id. |
| `kind` | One of `chat`, `advisory`, `research`, `plan`, `build`, `review`, `external_action`, `blocked_runtime`. |
| `turns[]` | Ordered user prompts; multi-turn scenarios are first-class. |
| `expected.route` | Expected HIMA route/work kind. |
| `expected.allowedTools[]` | Tool classes permitted for this scenario. |
| `expected.forbiddenTools[]` | Tool classes that must not appear. |
| `expected.requiredEvidence[]` | Evidence required for this kind, if any. |
| `expected.forbiddenEvidenceRequirements[]` | Evidence burdens that must not appear. |
| `expected.stopPolicy` | Expected stop behavior: allow, block with scenario reason, or no-op. |
| `expected.runtimeSchema` | Runtime-native hook schema expected for the target. |

The deterministic checker must score:

| Axis | PASS condition |
|---|---|
| Intent route | Chat/research/plan/build/review/external action classified as expected or compatible. |
| Evidence burden | No-code scenarios do not demand build evidence; build scenarios still prove tests. |
| Tool policy | Must-call and must-not-call behavior matches the scenario. |
| Hook schema | Runtime accepts hook output; no schema validation failure appears. |
| Stop behavior | Stop does not inherit stale blockers from a prior mode. |
| Continuity | Follow-up turns retain context but reclassify from the latest user intent. |
| Transcript integrity | Prompt, response, hook warnings/errors, stderr/debug, and verdict path are retained. |

Hard invariant:

```text
riskClass alone is not enough.
evidence policy = workKind + riskClass + externalSideEffect + runtimeCapability.
```

Therefore `riskClass: T` can no longer imply development evidence. A trivial chat and a trivial code
task are both low risk, but they require different stop policies.

## Logging Contract

Every scenario run must retain:

| Artifact | Required contents |
|---|---|
| `scenario.json` | Scenario id, runtime target, prompts, expected route, expected stop behavior. |
| `transcript.*` | Full user/assistant/runtime transcript, including hook warnings/errors. |
| `events.jsonl` | HIMA hook events, risk classification, mode transitions, and stop decisions. |
| `verdict.json` | PASS/FAIL/BLOCKED, detected route, false blockers, schema errors, and transcript path. |
| `summary.md` | Human-readable findings with Evidence / Inference / Risk split. |

Transcript retention path:

```text
.planning/conversation-compliance/transcripts/<timestamp>-<runtime>-<scenario>/
```

Evidence retention path:

```text
.planning/conversation-compliance/evidence/<timestamp>-<runtime>-<scenario>/
```

## Acceptance Criteria

Cycle 97 can be marked DONE only when:

- `docs/goals/conversation-compliance-benchmark-research.md` remains linked as the methodology
  basis;
- scenario JSON definitions exist for the required matrix;
- deterministic scanners exist for route, evidence burden, tool policy, hook schema, stop behavior,
  continuity, and transcript integrity;
- at least Claude and Codex run the full scenario matrix, or a runtime is explicitly marked BLOCKED
  with binary/account/schema reason;
- every transcript is retained under `.planning/conversation-compliance/transcripts/`;
- no no-code scenario demands `ci_green`, `sast_clean`, `secrets_clean`, or `DONE_VERIFIED`;
- no no-code scenario emits `Hook JSON output validation failed`;
- implementation scenarios still require and prove tests;
- follow-up prompts after a stop are replayed without manual terminal watching when the runtime
  supports non-interactive or remote-control input;
- verdict JSON files identify PASS/FAIL/BLOCKED per runtime and scenario;
- failures become named defects, not hidden transcript noise.

Suite-level verdicts:

- `PASS`: all mandatory supported runtime/scenario pairs satisfy hard invariants.
- `FAIL`: any supported runtime violates a hard invariant.
- `BLOCKED`: runtime binary, account, or control surface is unavailable.
- `QUARANTINED`: the scenario is ambiguous and must be rewritten before it can count.

## Non-Goals

This goal does not:

- claim the 119/155 construction ledger is complete;
- close Hermes if the Hermes binary remains unavailable;
- publish, contact users, or run paid benchmarks;
- prove product-market fit for any business idea discussed in a transcript;
- require CI/SAST/secrets evidence for pure conversation scenarios.

## First Implementation Slice

The smallest useful slice is:

1. Add a `conversation-compliance` fixture directory with JSON scenario definitions.
2. Add a runner that can execute available runtimes in logged non-interactive mode.
3. Add transcript scanners for:
   - `Hook JSON output validation failed`;
   - `ci_green`, `sast_clean`, `secrets_clean` in no-code scenarios;
   - `DONE_VERIFIED` in no-code scenarios;
   - `ENOENT`, `unexpected argument`, and malformed hook path errors.
4. Add expected-route assertions for chat, research, plan, and build modes.
5. Preserve current `runtime-session` RED/GREEN coverage as the build scenario.

## Minimum File Plan

```text
fixtures/conversation-compliance/scenarios/*.json
scripts/conversation-compliance-runner.mjs
scripts/conversation-compliance-scan.mjs
.planning/conversation-compliance/transcripts/
.planning/conversation-compliance/evidence/
```

The runner owns execution. The scanner owns deterministic verdicts. Optional LLM/human review may
assess answer quality later, but hard compliance must be scanner-first.

## Falsifies-If

```yaml
Falsifies-If:
  kill-condition: Cycle 97 is marked DONE while no-code conversations still trigger build completion evidence, invalid Stop hook JSON, or unlogged follow-up turns.
  checkpoint-date: 2026-05-29
  evidence-anchor: docs/goals/conversation-scenario-compliance-goal.md
  on-fail: Reopen cycle-97 as BLOCKED_CONVERSATION_MODE_MISROUTE and preserve the failing transcripts.
```
