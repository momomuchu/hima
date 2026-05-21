---
claim-bearing: true
status: ACCEPTED
cycle-id: cycle-22-stream-d-hard-limits-permission-judge-sourcing
owner-stream: Stream D
decision: SOURCE-ACCEPTED-CODE-DEFERRED
---

# Stream D - Hard-Limits Source Review

## 1. Decision

Cycle 22 accepts the hard-limits gap as real, but rejects immediate runtime code.

The previously cited hard safety-gate implementation from Agent-Village remains falsified. The
replacement evidence supports two narrower ideas:

- deterministic subagent permission inheritance and default-deny restrictions are credible source
  material for a future HIMA hard-limits boundary;
- Goose SmartApprove is credible source material for permission judgment as a concept, but it is an
  LLM-assisted classifier, not deterministic hard-limit enforcement.

No `packages/core/src/security/hard-limits.ts` file lands in this cycle. The correct output is a
source review plus a policy sketch that marks code as deferred until a narrow runtime gap is
selected and tested.

## 2. Evidence

| Evidence | Source anchor | What it supports | Limit |
|---|---|---|---|
| Prior Agent-Village safety-gate source is falsified: the cited `src/safety/gate.py`, FSM files, and tool registry do not exist. | `docs/excellence-application/02-analysis-discovery/swarm-deep/critic-audit.md:23`, `:75-79`, `:97`, `:116`, `:225` | D-H7 cannot rely on SYNTHESIS pattern #3 as implementation evidence. | This falsifies the source, not the underlying product need. |
| SYNTHESIS now marks pattern #3 as falsified and says it must be re-sourced or removed. | `docs/excellence-application/02-analysis-discovery/swarm/SYNTHESIS.md:52`, `:346`, `:363-364` | The master plan is correct to require re-sourcing before code. | It does not itself supply a replacement implementation. |
| Opencode currently derives subagent session permissions from parent deny rules, parent session denies/external-directory rules, and default `todowrite`/`task` denies unless explicitly allowed. | `https://github.com/sst/opencode/blob/dev/packages/opencode/src/agent/subagent-permissions.ts#L1-L40` | Programmatic default-deny subagent lane limits are real source evidence and close a prompt-only boundary gap. | This is subagent/session permission inheritance, not recursion, token, or blocked-command limits. |
| Goose permission judge builds a read-only classification tool and asks the model to identify strictly read-only tool requests. Unknown requests are not read-only. | `https://github.com/block/goose/blob/main/crates/goose/src/permission/permission_judge.rs#L1-L80` | Permission judgment can be performed per tool batch, and the read-only/write split is a useful M-class concept. | It depends on an LLM call and therefore is not a deterministic hard limit for HIMA core. |
| Goose inspection logic applies Deny and RequireApproval results without allowing an Allow result to override stricter decisions. | `https://github.com/block/goose/blob/main/crates/goose/src/tool_inspection.rs#L1-L180` | If HIMA later adds permission judgment, deny/approval decisions must be monotonic and must not be weakened by permissive classifier output. | The visible source confirms mixing semantics, not the full mode-routing surface. |
| HIMA already has several deterministic gates: bypass prompt blocking, forced risk floor signals, write-zone blocks, SubagentStart depth/scope/evidence/risk checks, and runtime-binding blocks. | `packages/core/src/gates/evaluate-gate.ts:140`, `:188-222`, `:456-547`, `:1104`, `:1311`, `:1379` | A new hard-limits module must add a new boundary, not duplicate existing gate code. | Existing code does not yet implement token-budget or adapter-level subagent tool disallow lists. |

## 3. Inference

- Opencode is the strongest replacement source for deterministic hard limits in the current D-H7
  scope because it turns subagent permission inheritance into code, not prompt prose.
- Goose is useful for a later M-class permission-judge design, but importing it directly into HIMA
  core would violate the cycle constraint that any `hard-limits.ts` behavior be pure and
  deterministic.
- HIMA already enforces some of the originally requested "hard-limits" categories inside
  `evaluate-gate.ts`. Extracting those into a new module now would be a refactor, not new sourced
  behavior.
- A future D-H7 implementation should be scoped around one new missing runtime boundary:
  adapter-level subagent disallowed tools, token-budget ceilings from normalized runtime metadata,
  or blocked-command pattern enforcement.

## 4. Assumptions

- The current verified source snapshots are sufficient for a policy sketch, but any future code
  cycle must re-check the exact external source anchors before implementation.
- HIMA core should stay deterministic. Non-deterministic permission judgment can exist only as a
  runtime adapter decision layer or as explicit human-confirmation routing, not as a core hard-limit
  primitive.
- "Hard-limits" should mean non-overridable policy decisions. Warnings, prompts, and advisory
  classifier output do not qualify unless a stricter gate consumes them.

## 5. Risks

- Adding a `hard-limits.ts` shell now would create false completion pressure: D-H7 would look done
  while token budgets, blocked commands, and subagent tool disallow lists remain unimplemented.
- Treating Goose SmartApprove as deterministic would introduce model variability into a policy
  surface that must be testable and replayable.
- Reusing the falsified Agent-Village claim would re-open the same evidence-anchor failure Cycle 22
  was created to prevent.
- Leaving D-H7 open can look like lack of progress, but the safer truth surface is explicit
  deferral after source review.

## 6. Rejected Options

| Option | Rejected because |
|---|---|
| Mark D-H7 complete based on Agent-Village | The source is falsified; the cited files do not exist. |
| Add `hard-limits.ts` with speculative recursion/spawn/token constants | There is no current source-backed HIMA policy for those constants or adapter payload fields. |
| Port Goose SmartApprove into core | It requires an LLM call and cannot serve as pure deterministic enforcement. |
| Move existing `evaluate-gate.ts` checks into a new module during this cycle | That would be behavior-preserving refactor work, not the sourced hard-limit implementation the cycle asks for. |

## 7. Code Decision

`packages/core/src/security/hard-limits.ts` is intentionally not created in Cycle 22.

Future code may land only when it satisfies all of these conditions:

- the enforced limit is not already covered by `evaluate-gate.ts`;
- the input fields are normalized and available from real adapter payloads;
- the result is pure, deterministic, and unit-tested with negative fixtures;
- any classifier or permission judge can only make an operation stricter, never weaker;
- the policy sketch names the exact hook or adapter boundary where the limit is consumed.

```yaml
Falsifies-If:
  kill-condition: D-H7 is marked complete or runtime code is added while relying on the falsified Agent-Village source, treating Goose SmartApprove as deterministic core policy, or failing to name the exact new boundary that existing HIMA gates do not already enforce.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/excellence-application/05-architecture/stream-d-hard-limits-source-review.md
  on-fail: Reopen cycle-22 as BLOCKED_HARD_LIMITS_SOURCE and remove any speculative hard-limits runtime code before resuming D-MCP work.
```
