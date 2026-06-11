---
claim-bearing: true
status: ACCEPTED
cycle-id: cycle-22-stream-d-hard-limits-permission-judge-sourcing
owner-stream: Stream D
decision: POLICY-SKETCH-CODE-DEFERRED
---

# Stream D - Hard-Limits Policy Sketch

## 1. Scope

This sketch defines what a future D-H7 implementation may enforce. It is not runtime code and does
not mark D-H7 complete.

The source review accepts only a narrow replacement model:

- use opencode-style deterministic permission inheritance as the primary implementation reference;
- use Goose SmartApprove only as a conceptual reference for M-class permission judgment;
- keep HIMA core hard limits pure, deterministic, replayable, and monotonic.

## 2. Candidate Boundary

A future `packages/core/src/security/hard-limits.ts` may exist only if it owns a boundary that is
currently missing from `evaluate-gate.ts`.

Allowed candidates:

| Candidate | Why it is eligible | Required input evidence |
|---|---|---|
| Subagent disallowed tools | Opencode proves subagent deny rules should be derived in code, and HIMA currently has launch scope checks but no adapter-level tool deny projection for child agents. | Subagent agent definition, parent/session deny rules, tool name, and current hook/session id. |
| Token-budget ceilings | The master D-H7 goal names token budgets, but no current HIMA module owns normalized budget consumption. | Runtime payload fields for requested, consumed, and remaining tokens. |
| Blocked-command patterns | PreToolUse write-zone detection exists, but command-specific deny patterns are not yet centralized as a security primitive. | Normalized tool name plus command text or argv parsed from real adapter payloads. |
| Active subagent spawn cap | HIMA persists `runSet.subagents[]`, making active launch count a deterministic local boundary. | Existing subagent records plus incoming `subagent_start` agent id. |

Deferred candidates:

| Candidate | Deferred because |
|---|---|
| Recursion depth | SubagentStart already blocks `depth < 1` and `depth > 1`; another module would duplicate current gate behavior. |
| Goose-style LLM permission judge | It is non-deterministic and belongs in an adapter/runtime approval layer, not in HIMA core hard limits. |

## 3. Non-Negotiable Semantics

Any future hard-limit verdict must be monotonic:

- `block` can never be downgraded by a classifier;
- `requires_approval` can never become `allow` without a higher-trust deterministic rule;
- unknown read/write intent is not read-only;
- subagent inherited deny rules must be preserved unless a policy explicitly allows a narrower
  override;
- dry-run mode may evaluate the limit but must not persist enforcement records.

## 4. Proposed Shape

If the next implementation cycle selects one candidate, the module should expose a small pure
surface:

```ts
type HardLimitVerdict = {
  status: "allow" | "requires_approval" | "block";
  reason: string;
  violationType?: string;
  evidenceAnchors: string[];
};

function evaluateHardLimits(input: HardLimitInput): HardLimitVerdict;
```

The module should not read the filesystem, call an LLM, mutate planning state, or append events.
`handle-hook.ts` and `evaluate-gate.ts` should remain responsible for orchestration and
persistence.

## 5. Next Implementation Gate

Before writing code, the next cycle must choose exactly one candidate and write failing tests first:

- Subagent disallowed tools: test inherited parent deny rules, default task/todo denial, explicit
  allow override, and no weakening of parent/session denies.
- Token-budget ceilings: test missing budget fields, over-budget block, exact-boundary allow, and
  redacted persistence.
- Blocked-command patterns: test shell alias bypasses, benign read commands, multiline command
  inputs, and case/spacing normalization.
- Active subagent spawn cap: test the 16th active subagent is blocked, terminal statuses are not
  counted, and existing active agent ids are not double-counted.

If none of those tests can be written from real payload shapes, D-H7 remains deferred.

## 6. Current Closeout

Cycle 22 closes with source review accepted and D-H7 deferred. The master checklist must continue to
show `packages/core/src/security/hard-limits.ts` as incomplete, with a note that sourcing is done and
code is intentionally postponed until a single missing boundary is selected.

```yaml
Falsifies-If:
  kill-condition: This sketch is used as permission to add broad hard-limit runtime code, duplicate existing gate checks, call an LLM from HIMA core, or mark D-H7 complete without one selected candidate and failing negative tests.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/excellence-application/05-architecture/stream-d-hard-limits-policy-sketch.md
  on-fail: Reopen D-H7 planning, remove broad speculative code, and select exactly one sourced hard-limit candidate before implementation.
```
