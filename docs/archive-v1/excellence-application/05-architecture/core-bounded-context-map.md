---
claim-bearing: true
status: ACCEPTED
date: 2026-05-14
cycle: cycle-04-stream-c1-bounded-context-map
deliverable: C4-1
source-spec: docs/excellence-application/03-specification/cycle-03-technical-spec.md
---

# Core Bounded Context Map — Stream C1

## Decision

`packages/core/` is organized around six domain contexts:

| Context | Responsibility |
|---|---|
| Run | Owns the governed run as the aggregate lifecycle: run identity, route projection, status, finalization, planning snapshots, and durable run persistence. |
| Cycle | Owns lifecycle phase movement: macro-cycle/subphase vocabulary, transition validity, DoR/DoD governance, and transition events. |
| Gate | Owns policy decisions at runtime boundaries: hook evaluation, write-zone rules, risk classification, violation typing, and allow/warn/block verdicts. |
| Skill | Owns discoverable operational knowledge: catalog entries, keyword routing, cascade selection, and future skill installation contracts. |
| Subagent | Owns delegated-work lifecycle: subagent identity, declared deliverables, trace requirements, and return-contract semantics. |
| Evidence | Owns proof material: evidence sufficiency, evidence records, append-only event log, hash-chained ledger, and spec-to-proof closure. |

Technical support modules exist, but they are **not a seventh domain context**. Support modules
provide storage primitives, runtime probing, install mechanics, redaction, and shared types used by
the six contexts.

## Context Boundaries

### Run

Owned data:

- `runId`, planning project identity, current route projection, finalization state.
- Planning snapshots in `.planning/state.yaml`, `.planning/current-risk.yaml`, and `.planning/run-set.json`.
- Persistence orchestration for reading and writing the current run.
- `OperatingMode` as Run/Gate coordination vocabulary stored on run state and route.

Incoming commands:

- `initProject`, `enterDevelopment`, `getStatus`, `closeRun`, `requestTransition`,
  `RunAggregate.transition`.

Outgoing events:

- Run status and finalization events through Evidence-owned event and ledger appenders.

Boundary rule:

- Run may coordinate Cycle, Gate, Subagent, and Evidence state, but it must not own their policy rules.

### Cycle

Owned data:

- Macro-cycle/subphase vocabulary and transition graph.
- DoR/DoD governance definitions for phase changes.
- Transition history projection.
- `SubPhase` value-object boundary.

Incoming commands:

- `evaluateTransitionGovernance`, `transitionPlanningState`, and transition target/validity
  helpers from the Cycle-owned transition policy boundary consumed by Run orchestration.

Outgoing events:

- `STATE_TRANSITIONED` with governance evaluation payload.

Boundary rule:

- Cycle decides whether movement is legal; Run persists the updated run snapshot.

### Gate

Owned data:

- Gate event payload shape.
- Gate violation taxonomy.
- Baseline risk policy and write-zone policy.
- Risk classification result used by runtime gates.
- `RiskClass` and `GateType` value-object boundaries.

Incoming commands:

- `handleHook`, `evaluateGate`, `classifyRisk`.

Outgoing events:

- Gate verdicts and policy violations, recorded by Run/Evidence persistence.

Boundary rule:

- Gate can require Evidence but cannot declare evidence sufficient by storage presence alone.

### Skill

Owned data:

- Operational catalog, keyword registry, router cascade, generated artifacts from catalogs.

Incoming commands:

- Catalog resolution and future skill install/resolve commands.

Outgoing events:

- None yet; future D-skills work should emit catalog install/selection evidence through Evidence.

Boundary rule:

- Skill selects operational guidance; it must not mutate Run state or bypass Gate policy.

### Subagent

Owned data:

- Subagent identity, declared deliverables, allowed scope/depth, trace contract, and return status.

Current implementation note:

- Subagent concepts are currently embedded in `run-set.schema.ts` and enforced through `evaluate-gate.ts`.
  That is acceptable for C1 as a mapping fact, but C2-C7 must avoid treating Subagent as a Gate subfeature.
- In `run-set.schema.ts`, `SubagentRunStatusSchema`, `SubagentRunRecordSchema`, and the
  `RunSetFileSchema.subagents` field remain Subagent-owned concepts even while the physical file
  is Run-owned.

Incoming commands:

- `subagent_start` and `subagent_stop` gate events.

Outgoing events:

- Subagent launch/return evidence and deliverables-gate verdicts.

Boundary rule:

- Gate enforces Subagent policy; Subagent owns the lifecycle contract that policy evaluates.

### Evidence

Owned data:

- Evidence items, evidence sufficiency rules, event log entries, ledger entries, and proof verification results.

Incoming commands:

- `addEvidence`, `evaluateEvidence`, append event, append ledger, verify ledger.

Outgoing events:

- Accepted/rejected evidence records, append-only event entries, hash-chain verification outcomes.

Boundary rule:

- Evidence records proof; it does not decide phase movement or hook policy without Gate/Cycle context.

## Run vs Cycle Ownership

| Concern | Owner | Reason |
|---|---|---|
| State snapshot file shape | Run | The snapshot is part of the run aggregate persistence surface. |
| `phase` / `sub_phase` vocabulary | Cycle | Phase movement is lifecycle language, not storage language. |
| Transition validity | Cycle | Validity depends on lifecycle graph semantics. |
| Transition history projection | Cycle | It records lifecycle movement and must stay tied to transition rules. |
| Route projection in `run-set.json` | Run | It is the run's current query projection, updated after Cycle approves movement. |
| Finalization state | Run | Closure is aggregate lifecycle state, even when Gate/Evidence decides whether closure is allowed. |
| DoR/DoD governance | Cycle | These files define readiness/done criteria for phase movement. |

## Gate vs Evidence Ownership

| Concern | Owner | Reason |
|---|---|---|
| Gate decision `allow/warn/block` | Gate | It is a policy verdict at a runtime boundary. |
| Violation type | Gate | Violation taxonomy belongs to policy evaluation. |
| Missing evidence item names | Gate | Gate computes what is missing for the current risk/policy context. |
| Accepted evidence record | Evidence | The proof item is durable evidence independent of the gate that requested it. |
| Evidence sufficiency score | Evidence | Sufficiency evaluates proof sets against risk requirements. |
| Event log | Evidence | Append-only proof/event stream is an evidence substrate. |
| Hash-chained ledger | Evidence | Integrity of proof history belongs to Evidence. |
| `DONE_VERIFIED` allowance | Gate + Evidence | Gate makes the verdict; Evidence supplies sufficiency facts. |

## Embedded Ownership Split: `run-set.schema.ts`

The file-to-context CSV assigns `packages/core/src/schemas/run-set.schema.ts` to Run as its
physical owner because the file defines the durable run-set aggregate shape. That physical
ownership is not semantic ownership of every concept embedded in the file.

| Lines / symbols | Semantic owner | Reason |
|---|---|---|
| `20-95` runtime capability and binding schemas | Runtime support | Runtime probing/binding facts support Run and Gate; they do not own domain policy. |
| `97-101` `FinalizationStateSchema` | Run | Finalization is run lifecycle state. |
| `107-143` project and intent schemas | Run | Project identity, interpreted objective, autonomy, and planning snapshots are run aggregate inputs. |
| `145-170` risk and gate policy override schemas | Gate | Risk policy, required gates, and enforcement overrides are policy inputs for runtime gates. |
| `172-196` `SubagentRunStatusSchema`, `SubagentRunRecordSchema` | Subagent | Delegated-work status, scope, deliverables, evidence refs, and return summary are the Subagent lifecycle contract. |
| `198-206` `RunEventSchema` | Evidence | Events are durable proof/history records; embedded gate fields are event facts, not ownership transfer to Run. |
| `208-217` `EvidenceItemSchema` | Evidence | Evidence item key, status, summary, source, and metadata are proof records. |
| `219-240` `RunSetFileSchema` root | Run as aggregate shell | The root composes context-owned projections into one persisted run-set file. |
| `219-240` `route.phase`, `route.subPhase` | Cycle vocabulary inside Run projection | Run persists the current route; Cycle owns phase/subphase meaning and legal movement. |
| `219-240` `policy` | Gate projection inside Run aggregate | Run persists policy configuration; Gate owns policy semantics. |
| `219-240` `events`, `evidence` | Evidence projections inside Run aggregate | Run persists these arrays; Evidence owns proof/event semantics. |
| `219-240` `subagents` | Subagent projection inside Run aggregate | Run persists the array; Subagent owns lifecycle and deliverable-contract semantics. |
| `242-259` exported inferred types | Same owner as source schema | Type ownership follows the schema or field group each type projects. |

Forbidden interpretation: C2-C7 must not treat `run-set.schema.ts` as proof that Run owns
Subagent deliverables, Evidence sufficiency, Gate policy, or Cycle vocabulary. It is currently a
persistence colocation file, not a bounded-context merger.

## Forbidden Ownership Leaks

1. Gate must not write directly to `.planning/run-set.json`; it returns a verdict for Run to persist.
2. Evidence must not transition phases; Cycle owns lifecycle movement.
3. Skill routing must not alter risk class or bypass Gate policy.
4. Subagent deliverables must not be stored only in Gate metadata; the lifecycle contract must be visible in Run/Subagent records.
5. Technical support modules must not become owners of business decisions because they are convenient import locations.

## Shared / Support Categories

| Support category | Files | Constraint |
|---|---|---|
| Storage support | `storage/atomic-write.ts`, `file-lock.ts`, `json.ts`, `safe-write.ts`, `yaml.ts` | Persistence primitives only; domain decisions stay in Run/Evidence. |
| Runtime support | `runtime/*` | Runtime capability facts only; Gate decides policy impact. |
| Install support | `install/*` | Filesystem install mechanics only; Skill owns catalog semantics. |
| Security support | `security/redaction.ts` | Cross-context redaction utility; no policy ownership beyond secret masking. |
| Shared kernel | `types/*`, `schemas/common.ts`, root `index.ts` | Stable primitives and exports only; avoid adding workflow logic here. |

## C1 Verdict

C1 is satisfied when this map, the file-to-context CSV, migration implications, and the
spec-verification report all pass saturation review. This document does not authorize C2 code
movement by itself.

## Falsifies-If

```yaml
Falsifies-If:
  kill-condition: A future C2/C3 refactor moves code contrary to the ownership tables without updating this map and the spec verification report.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/excellence-application/05-architecture/core-file-to-context.csv
  on-fail: Reopen C1 as SPEC_DRIFT and block Stream C code movement until ownership is reconciled.
```
