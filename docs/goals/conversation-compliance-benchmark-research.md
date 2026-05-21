---
claim-bearing: true
status: RESEARCH
cycle: cycle-97-conversation-scenario-compliance
created: 2026-05-15
---

# Conversation Compliance Benchmark Research

## Research Question

How should HIMA evaluate deterministic conversational compliance across real runtime sessions when
the user may be chatting, researching, planning, coding, correcting the agent, or continuing
asynchronously after a stop?

The core requirement is not "does the model give a good answer?" The requirement is:

- Did HIMA classify the user's intent correctly?
- Did hooks apply the correct policy for that intent?
- Did Stop behavior match the scenario rather than forcing a build lifecycle?
- Did the runtime transcript preserve enough evidence to debug failures?
- Did follow-up turns reclassify from the new user message rather than inheriting stale blockers?

## Benchmark Families Reviewed

| Family | Examples reviewed | What it teaches HIMA | What it does not solve |
|---|---|---|---|
| Spec/scenario compliance | OpenAI Model Spec Evals | Use small representative scenarios to cover behavior assertions; behavior specs need targeted evals because one metric cannot cover all failure modes. | Does not execute real CLI hooks or repo workspaces. |
| Multi-metric language eval | HELM | Evaluate multiple dimensions, not just task success; expose trade-offs and keep raw prompts/completions. | Mostly model-output evaluation, not runtime lifecycle compliance. |
| Interactive agent benchmark | AgentBench | Agent evaluation should run in interactive environments, not only static prompts. | Broad agent capability benchmark, not HIMA-specific hook/routing semantics. |
| Realistic web/desktop agents | WebArena, OSWorld | Use reproducible environments, initial-state setup, and execution-based success checks. | Heavy environments; overkill for pure chat/no-code routing tests. |
| Tool-agent-user conversations | τ-bench | Conversation + policy + tools is the closest benchmark family to HIMA's runtime issue. | Original τ-bench is mostly single-control: the agent changes world state while user is a simulator. |
| Dual-control conversations | τ²-bench | Tests shared dynamic state where user and agent can both act; separates reasoning from communication/coordination failures. | Domain-specific and newer; methodology must be adapted rather than copied directly. |
| Function/tool-call correctness | BFCL | Tool invocation can be scored with structured categories, multi-turn tests, cost/latency, and "should call vs should not call" checks. | Function-call accuracy is narrower than HIMA lifecycle mode compliance. |
| Software engineering tasks | SWE-bench family | Build tasks need real patches and tests; success should be execution-based, not judged by vibes. | It should apply only when the user actually asked for code. |
| Eval frameworks | OpenAI Evals API, Inspect AI | Store scenario data, runs, output items/logs, solvers/scorers; make results replayable. | Frameworks do not define HIMA's intent taxonomy or hook schemas. |
| Runtime hook contracts | Claude Code hooks docs | Hook output must follow runtime-native schemas and event-specific blocking behavior. | Docs describe hook mechanics, not when HIMA should demand build evidence. |

## Source Notes

### OpenAI Model Spec Evals

OpenAI describes Model Spec Evals as scenario-based evaluations intended to cover assertions in a
behavior specification with representative examples, while noting that broader behavior still needs
targeted evaluations across safety, truthfulness, sycophancy, style, and capabilities.

Takeaway for HIMA:

- Treat `conversation compliance` as a behavior-spec eval, not a unit test.
- Each desired behavior assertion should have at least one representative scenario.
- The suite must include negative scenarios where the correct behavior is to avoid a workflow.

Source: https://openai.com/index/our-approach-to-the-model-spec/

### HELM

HELM argues for multi-metric evaluation instead of one aggregate score: accuracy, calibration,
robustness, fairness, bias, toxicity, and efficiency are measured across scenarios, with raw prompts
and completions released for transparency.

Takeaway for HIMA:

- Do not collapse conversation compliance into one PASS percentage.
- Preserve raw transcripts and score multiple axes:
  - intent-route correctness;
  - evidence burden correctness;
  - hook schema validity;
  - tool-use appropriateness;
  - continuity across turns;
  - response usefulness.

Source: https://friedeggs.github.io/files/helm.pdf

### AgentBench

AgentBench frames LLM agents as systems that need interactive environment evaluation across
multiple environments, not only static text prompts.

Takeaway for HIMA:

- HIMA must test the runtime loop, not only generated answers.
- A valid scenario includes user prompt, hook events, tool calls, stop behavior, and final output.

Source: https://arxiv.org/abs/2308.03688

### WebArena

WebArena emphasizes realistic, reproducible web environments and functional correctness for
long-horizon tasks.

Takeaway for HIMA:

- For browser/tool scenarios, create reproducible local fixtures and execution-based checks.
- Do not judge "looks reasonable"; verify whether the intended state changed.

Source: https://arxiv.org/abs/2307.13854

### OSWorld

OSWorld uses real computer environments with setup configuration and custom execution-based
evaluation scripts across OSes and applications.

Takeaway for HIMA:

- When HIMA tests runtime/desktop behavior, each scenario needs:
  - initial-state setup;
  - executable or inspectable success condition;
  - transcript plus environment-state evidence.

Source: https://arxiv.org/abs/2404.07972

### τ-bench

τ-bench targets dynamic conversations between simulated users and tool-using agents that must follow
domain-specific API tools and policy guidelines.

Takeaway for HIMA:

- This is the closest pattern for no-code vs tool-use vs policy-following conversational compliance.
- HIMA should define policy-guideline fixtures per scenario and score violations deterministically.

Source: https://arxiv.org/abs/2406.12045

### τ²-bench

τ²-bench extends the idea into a dual-control environment where user and agent can both affect shared
state, with a generator for diverse verifiable tasks and analysis that separates reasoning errors
from communication/coordination failures.

Takeaway for HIMA:

- The async follow-up problem is dual-control: the user changes the conversation state after the
  assistant stopped.
- HIMA verdicts should distinguish:
  - wrong answer;
  - wrong route;
  - stale state;
  - user coordination failure;
  - hook/schema failure.

Source: https://arxiv.org/abs/2506.07982

### BFCL

BFCL evaluates function/tool calling and includes real-world data, multi-turn interactions, cost,
latency, and tool-call accuracy.

Takeaway for HIMA:

- Tool-use tests should include both "must call" and "must not call" cases.
- For no-code chat, the correct tool decision is often "no build tools, no evidence gate".
- Cost/latency should be captured for live runtime scenarios.

Source: https://gorilla.cs.berkeley.edu/leaderboard

### SWE-bench Family

SWE-bench-style evaluation is appropriate when the user explicitly asks for repository changes:
patches should be validated by tests.

Takeaway for HIMA:

- Keep RED/GREEN build scenarios.
- Do not apply SWE-bench-style completion gates to ideation, research, or planning conversations.

Representative source: https://arxiv.org/abs/2310.06770

### OpenAI Evals API

OpenAI's Evals API organizes eval definitions, runs, input messages, data sources, and output items.

Takeaway for HIMA:

- Use scenario definitions as data, not hardcoded prompt strings.
- Store run outputs per item so failures can be replayed and compared.

Source: https://developers.openai.com/api/reference/resources/evals

### Inspect AI

Inspect provides a task/solver/scorer model and log-based evaluation workflow for frontier model
evals.

Takeaway for HIMA:

- Separate scenario execution from scoring.
- Treat transcript scanners as deterministic scorers.
- Allow later LLM-judge scoring only after deterministic invariants pass.

Source: https://inspect.aisi.org.uk/

### Claude Code Hooks

Claude Code's hook docs specify event-specific behavior, including that JSON stdout is only parsed on
exit code 0, exit code 2 blocks where applicable, exit code 1 is generally non-blocking, and hook JSON
must match the event schema. `UserPromptSubmit` can inject context; `Stop` can block stoppage.

Takeaway for HIMA:

- Stop hook JSON must be runtime-event compatible.
- `Stop` should not emit `hookSpecificOutput` shapes unsupported by Claude's Stop schema.
- No-code scenarios should not reach a Stop block that demands build evidence.

Source: https://code.claude.com/docs/en/hooks

## Method Comparison

| Method | Determinism | Coverage | Cost | Best use in HIMA | Risk |
|---|---:|---:|---:|---|---|
| Static transcript scanner | High | Medium | Low | Detect forbidden strings, schema errors, hook path errors, stale blockers. | Can miss semantic failures. |
| Route oracle per scenario | High | High | Low | Verify expected mode: chat, research, plan, build, review, external action. | Requires curated taxonomy. |
| Tool-call oracle | High | Medium | Low/medium | Verify must-call / must-not-call behavior. | Runtime tool surfaces differ. |
| Execution-based checker | High | High for build/tool tasks | Medium | Verify files/tests/state changes. | Not applicable to pure conversation. |
| Simulated user multi-turn harness | Medium/high | High | Medium | Test async follow-up and state continuity. | Simulator can introduce its own bias. |
| LLM-as-judge | Medium/low | High for nuance | Medium/high | Secondary review of helpfulness or evidence quality. | Non-deterministic; cannot be the first gate. |
| Human review | High quality, low automation | High for ambiguous cases | High | Final adjudication of fuzzy product conversations. | Slow; not regression-friendly. |

Recommended HIMA stack:

1. Deterministic scenario metadata.
2. Deterministic route oracle.
3. Deterministic transcript/error scanners.
4. Deterministic runtime hook schema checks.
5. Execution-based checks for build/tool scenarios.
6. Optional LLM/human review only for advisory quality, never for hard compliance.

## Deterministic Contract Model

HIMA should not expect identical prose. It should expect identical compliance properties.

Each scenario should define:

```json
{
  "id": "business-idea-price-disruption",
  "kind": "research_advisory",
  "turns": [
    { "role": "user", "text": "..." },
    { "role": "user", "text": "show proof and compare Cloudflare Email" }
  ],
  "expected": {
    "route": "research",
    "allowedTools": ["web_fetch", "web_search"],
    "forbiddenTools": ["apply_patch", "git_commit", "npm_test_required"],
    "requiredEvidence": ["source_links_when_prices_are_claimed"],
    "forbiddenEvidenceRequirements": ["ci_green", "sast_clean", "secrets_clean", "DONE_VERIFIED"],
    "stopPolicy": "allow_no_code_stop",
    "schema": "runtime_native"
  }
}
```

The deterministic checker should score these axes:

| Axis | PASS means | FAIL means |
|---|---|---|
| Intent route | Runtime classified the turn as expected or accepted compatible route. | Chat/research/plan got forced into build lifecycle, or build got treated as casual chat. |
| Evidence burden | Required evidence matches the scenario kind. | No-code scenario requires CI/SAST/secrets/tests, or build scenario skips tests. |
| Tool permission | Tools used are allowed for the scenario. | Forbidden tool class appears or required tool is absent. |
| Hook schema | Runtime accepts hook JSON; no schema validation failure. | `Hook JSON output validation failed` or unsupported event-specific shape. |
| Stop behavior | Stop allows natural completion or blocks only with scenario-relevant reason. | Stop demands stale blockers from a previous mode. |
| Continuity | Follow-up turn has prior context and fresh reclassification. | Second turn loses context or inherits stale mode. |
| Transcript integrity | Full prompt/response/hooks/errors retained. | Missing transcript, missing stderr/debug, or redaction destroys diagnosis. |

## Scenario Taxonomy

| Mode | User signal | Required behavior | Forbidden behavior |
|---|---|---|---|
| `chat` | greeting, personal thought, loose idea, no request for artifacts | respond conversationally; maybe ask clarifying question | build lifecycle, tests, CI/SAST/secrets, DONE_VERIFIED |
| `advisory` | asks opinion, critique, tradeoff, strategy | give assumptions, risks, possible next steps | pretend external facts without sources when facts are current/priced |
| `research` | asks proof, pricing, latest, compare providers | browse/fetch if available; cite sources; distinguish evidence/inference | code edits unless requested |
| `plan` | asks goal, plan, spec, "do not implement" | produce plan/spec artifact or answer only | implementation, test execution as completion requirement |
| `build` | asks to implement/fix/refactor | edit files, run relevant tests, collect evidence | stop at plan only, skip verification |
| `review` | asks review/audit | findings first, file/line references, no edits unless requested | silently patch while asked only for review |
| `external_action` | asks publish, pay, contact users, production deploy | require explicit authorization and log boundary | perform external side effect silently |
| `blocked_runtime` | runtime binary/account unavailable | mark BLOCKED with reason and path to retry | fake evidence or treat dry-run as real run |

## Coverage Matrix

Minimum matrix for Cycle 97:

| Scenario | chat | advisory | research | plan | build | async | hook schema | external boundary |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| casual-chat-no-dev | yes | no | no | no | no | optional | yes | no |
| business-idea-price-disruption | no | yes | yes | no | no | yes | yes | no |
| planning-only-product-goal | no | yes | no | yes | no | optional | yes | no |
| small-feature-build | no | no | no | no | yes | no | yes | no |
| async-follow-up-after-stop | yes | yes | yes | optional | optional | yes | yes | no |
| invalid-stop-schema-regression | yes | yes | optional | optional | no | optional | yes | no |
| external-action-denial | no | advisory | optional | yes | no | optional | yes | yes |

## Hard Lessons For HIMA

1. No-code conversations need a completion state, but not `DONE_VERIFIED`.
   - Suggested state: `CONVERSATION_COMPLETE`.

2. Stop hooks must be intent-aware.
   - `Stop` for build: may require test evidence.
   - `Stop` for research: may require citations if factual/pricing claims were made.
   - `Stop` for chat: should not require CI/SAST/secrets.

3. Risk class alone is insufficient.
   - `T` can mean trivial chat or trivial code.
   - Evidence policy must depend on both `riskClass` and `workKind`.

4. The runtime schema is part of compliance.
   - A semantically correct block is still a failure if the runtime rejects its JSON.

5. Async continuation is a first-class scenario.
   - The harness should wait for a stop event, then inject a follow-up when the runtime supports it.
   - If a runtime lacks this control surface, mark the scenario `BLOCKED_RUNTIME_CAPABILITY`, not PASS.

6. Determinism means invariant determinism, not identical wording.
   - Accept varied prose.
   - Reject invariant violations.

## Proposed Scorecard

Each scenario/runtime pair should produce:

```json
{
  "scenarioId": "business-idea-price-disruption",
  "runtime": "claude",
  "status": "PASS",
  "scores": {
    "route": "PASS",
    "evidenceBurden": "PASS",
    "toolPolicy": "PASS",
    "hookSchema": "PASS",
    "stopBehavior": "PASS",
    "continuity": "PASS",
    "transcriptIntegrity": "PASS"
  },
  "detectedFailures": [],
  "transcriptPath": ".planning/conversation-compliance/transcripts/..."
}
```

Suite-level status:

- `PASS`: all mandatory runtime/scenario pairs pass.
- `FAIL`: any supported runtime violates a hard invariant.
- `BLOCKED`: runtime binary/account/control surface unavailable.
- `QUARANTINED`: scenario itself is ambiguous or non-deterministic and needs rewrite.

## Recommended Next Architecture

Add:

```text
fixtures/conversation-compliance/scenarios/*.json
scripts/conversation-compliance-runner.mjs
scripts/conversation-compliance-scan.mjs
.planning/conversation-compliance/transcripts/
.planning/conversation-compliance/evidence/
```

Runner responsibilities:

1. Create a clean workspace per scenario/runtime.
2. Install HIMA runtime hooks.
3. Send first prompt.
4. Wait for runtime stop or non-interactive completion.
5. Send follow-up prompt if scenario has more turns and runtime supports it.
6. Collect transcript, hook/debug logs, runtime probe, and process exit state.
7. Run deterministic scanners.
8. Emit verdict JSON.

Scanner responsibilities:

1. Detect invalid hook schema.
2. Detect forbidden evidence burdens in no-code scenarios.
3. Detect missing test evidence in build scenarios.
4. Detect stale mode carryover.
5. Detect unsupported runtime capability and classify BLOCKED.

## Falsifies-If

```yaml
Falsifies-If:
  kill-condition: This research is used to close Cycle 97 without implementing replayable scenarios, transcript retention, deterministic route/evidence/hook-schema checks, and at least one real no-code failure regression.
  checkpoint-date: 2026-05-29
  evidence-anchor: docs/goals/conversation-compliance-benchmark-research.md
  on-fail: Reopen cycle-97 as BLOCKED_RESEARCH_ONLY_NO_EVAL and require executable scenario evidence.
```
