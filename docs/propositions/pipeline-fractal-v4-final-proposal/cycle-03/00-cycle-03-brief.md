# 00 - Cycle 03 Brief

Status: active autonomous design cycle

## Purpose

Cycle 03 continues the nested development loop requested by the user. Cycle 02
accepted the architecture direction and blocked implementation handoff. Cycle 03
therefore narrows the work to the P0 executable contracts that caused the
block.

This cycle does not reopen the whole architecture unless a contract artifact
proves that Candidate C cannot satisfy an invariant.

## Cycle Question

```text
Can the remaining P0 blockers be turned into executable contracts precise
enough for schema-first implementation planning?
```

## Inputs

- `../cycle-02/01-discovery-gap-audit.md`
- `../cycle-02/02-planning-implementation-roadmap.md`
- `../cycle-02/03-mcp-tool-contracts.md`
- `../cycle-02/04-registry-storage-layout.md`
- `../cycle-02/05-verification-fixtures.md`
- `../cycle-02/06-audit-red-team.md`
- `../cycle-02/07-cycle-02-integration.md`
- `../../pipeline-fractal-v4-state-machine/06-open-decisions.md`
- `../06-integrated-final-proposal.md`

## Required Lanes

| Lane | Output | Gate |
|---|---|---|
| Supersession and decision delta | `01-supersession-and-decision-delta.md` | Every old authority source has an explicit status. |
| Guard merge lattice | `02-guard-merge-lattice.md` | Guard output merge is deterministic and fixture-ready. |
| Evidence requirements and freshness | `03-evidence-requirements-freshness.md` | Evidence status can be derived without prose judgement. |
| Risk/runtime degradation | `04-risk-runtime-degradation.md` | Risk class, bypass and fallback behavior are mechanized. |
| Artifact, human and candidate evidence contracts | `05-artifact-human-candidate-evidence.md` | Skills/reference docs/subagents, human checkpoints and inactive artifacts have import/control schemas. |
| Cycle audit | `06-cycle-03-audit.md` | Independent red-team verdict on implementation handoff. |
| Integration | `07-cycle-03-integration.md` | Decision on whether schema-first implementation planning can start. |

## Stop Rule

Cycle 03 may pass only if it gives each P0 blocker one of these statuses:

- `closed_by_contract`;
- `closed_by_fixture`;
- `deferred_out_of_mvp`;
- `still_blocking`.

If any P0 blocker remains `still_blocking`, implementation handoff remains
blocked and Cycle 04 must target only that blocker set.
