---
claim-bearing: true
status: ACCEPTED
date: 2026-05-14
cycle: cycle-03-specification-excellence-application
deliverable: C3-2
---

# HIMA Spec Discipline Checklist

Use this checklist before any hima component moves from conception into implementation.
It adapts the spec-driven-development book into a local, gate-ready checklist.

## 1. Spec Level

| Check | PASS rule |
|---|---|
| Change type named | feature, fix, improvement, or refactor is recorded. |
| Executor named | human or AI agent is explicit. |
| Risk flags scored | R1 auth/security, R2 money/PII, R3 multi-module, R4 public contract/schema, R5 AI agent. |
| SDD level chosen | AI-agent or architecture-boundary work uses `spec-anchored`; `spec-as-source` is rejected unless fully generated and documented. |

## 2. Minimum Spec Packet

| Check | PASS rule |
|---|---|
| Scope | Names exact component, files/modules in scope, and the behavior or architecture decision to change. |
| Non-goals | Lists at least two plausible adjacent changes that are explicitly excluded. |
| Acceptance rows | Stable IDs exist and each row is falsifiable by inspection, command output, or review artifact. |
| Counterexamples | At least one row names what must not count as completion. |
| Evidence plan | Each acceptance row maps to a future proof command, file, or review. |
| Falsifies-If | Claim-bearing artifact includes kill-condition, checkpoint-date, evidence-anchor, and on-fail. |
| ADR linkage | Architectural or boundary-setting work links to an ADR or records why none is needed. |
| Threat-model trigger | H/C or security/privacy/data-loss scope includes STRIDE or a documented no-trigger rationale. |

## 3. Stage Gates

| Stage | PASS rule | BLOCK if |
|---|---|---|
| Spec -> Plan | All acceptance rows and non-goals are stable. | Plan introduces scope not named in spec. |
| Plan -> Tasks | Every task maps to one acceptance row or non-goal-preserving support work. | A task exists only because "it seems useful." |
| Tasks -> Implement | Agent receives spec, plan, tasks, non-goals, and stop conditions. | Prompt-only execution begins. |
| Implement -> Verify | Verification walks every acceptance row. | CI passes but at least one row is unmapped. |
| Verify -> Archive | Spec, ADR, and verification report remain discoverable in repo. | The only durable spec is PR text or chat history. |

## 4. Review Verdicts

| Verdict | Meaning |
|---|---|
| PASS | Spec can drive implementation without extra context. |
| REVISE | Scope or evidence is fixable in the spec before implementation. |
| BLOCK | A material ambiguity, missing evidence plan, or wrong component target would make implementation unsafe. |

## 5. Anti-Pattern Scan

- Task-driven spec: tasks exist before the spec acceptance rows.
- Pipeline short-circuit: implementation starts before Plan and Tasks gates pass.
- Review theater: reviewer says "looks good" without PASS/REVISE/BLOCK and named evidence.
- CI-green-as-proof: completion relies on tests without spec-to-evidence mapping.
- Prompt-first agent execution: agent receives intent but not the signed spec packet.
- Stale current spec: future implementation changes the boundary but leaves this spec untouched.

## Falsifies-If

```yaml
Falsifies-If:
  kill-condition: A future Stream C implementation is accepted without a checklist PASS or documented REVISE/BLOCK closure.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/excellence-application/03-specification/spec-discipline-checklist.md
  on-fail: Treat the implementation as spec-drifted and rerun the checklist before continuing.
```
