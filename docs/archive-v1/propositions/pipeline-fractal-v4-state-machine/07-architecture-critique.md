# 07 - Architecture Critique

Status: integration critique

## Purpose

This file captures the architecture review lane for the Pipeline Fractale V4
state machine proposal. It focuses on real design gaps that would make an
implementation ambiguous, not on conceptual gaps already implied by the model.

## Central Correction

The main V2 correction is valid: `macro_cycle`, `cycle_substate`, and the
fractal lens must be separate concepts.

```text
macro_cycle       = which lifecycle territory is active
cycle_substate    = semantic state inside that cycle
derived lens      = common seven-step reasoning view derived from substate
```

The seven fractal steps remain useful as a grammar for reasoning, evidence, and
visualization. They should not be persisted as identical substates for every
macro-cycle.

## Findings

| ID | Finding | Risk | Integration status |
|---|---|---|---|
| ACR-01 | State authority was split between top-level fields, meta-regions, and derived statuses. | Executable guards could read inconsistent evidence or convergence values. | Corrected in `01-state-model.md`, `03-meta-states-and-modes.md`, `05-convergence-model.md`, `08-transition-catalog.md`, and `09-validation-checklist.md`: Evidence Set and Convergence Set are source of truth; `derived_view` exposes statuses. |
| ACR-02 | `NONE` blurred inactive runs, idle harness, and unknown values. | Non-dev work could be mistaken for an active harness state, or active runs could hide missing fields. | Corrected in `01-state-model.md`, `06-open-decisions.md`, `08-transition-catalog.md`, and `09-validation-checklist.md`: inactive uses `harness_machine.status=NOT_ACTIVE`; armed idle uses `IDLE`. |
| ACR-03 | The fractal lens could drift if stored independently from `cycle_substate`. | A run might claim `EXECUTE` while sitting in a definition or review substate. | Corrected as design rule: lens is derived from the substate registry and can be materialized only as a validated view. |
| ACR-04 | Run was modeled like a normal finite development cycle. | Operations can last months or years; learning consumes samples, not necessarily the end of Run. | Corrected in `02-cycle-specific-substates.md`, `04-guard-matrix.md`, `08-transition-catalog.md`, and checklist: Run emits `run.learning_sample_handoff`; Release hands off to Run, while Apprentissage consumes operational samples. |
| ACR-05 | Some cycle-specific substates lost semantic coverage from the seven-step lens. | V2 could become semantic but incomplete, especially for decision capture and increment definition. | Corrected in `02-cycle-specific-substates.md` and `08-transition-catalog.md`: Cadrage and Conception add decision capture; Build adds increment definition; Release adds scope definition before rollback and approval. |
| ACR-06 | Critical risk (`C`) was too permissive for `auto_decision`. | A critical run could proceed without the visibility the risk model demands. | Corrected in `03-meta-states-and-modes.md`, `06-open-decisions.md`, and `09-validation-checklist.md`: C forbids autonomous auto-decision and requires pairing or explicit human checkpoint. |
| ACR-07 | Runtime binding was described as availability, not enforceability. | The RMS could believe a gate is blocked even when the runtime can only audit after the fact. | Corrected in `04-guard-matrix.md`: runtime overlay includes `required_gate`, `binding_status`, `can_block`, `fallback_strategy`, `fail_open_risk`, and trace event. |

## Remaining Architecture Decisions

These are not optional polish; they block a reliable executable registry:

- Decide whether V2 supersedes `docs/conception/01-state-machine-spec.md` or is a new proposal pending ADR.
- Choose the exact executable registry split: substate registry, transition graph, guard overlays, risk classifier, evidence requirements, convergence thresholds, and runtime bindings.
- Define migration semantics for any existing `subPhase`, `macro_state=NONE`, or universal seven-step state snapshots.
- Decide whether the first implementation stores only snapshot + append-only events, or also stores derived view caches with validation.
- Specify how Run samples are linked to learning without closing or resetting the operational Run.

## Implementation Guidance

For the first executable version, keep the model conservative:

```text
RunEnvelope
+ HarnessMachineState when active
+ DerivedView computed from registries and evidence/convergence sets
+ Append-only events as audit source
```

Do not implement `meta_regions.evidence`, `meta_regions.convergence`, or a
writable `fractal_lens`. Those are views over more authoritative objects.

Do not implement `macro_cycle=NONE`. Use:

- `harness_machine.status=NOT_ACTIVE` outside the active harness;
- `harness_machine.status=IDLE`, `macro_cycle=IDLE`, `cycle_substate=IDLE` when
  the pipeline is armed but no real cycle is running;
- real macro-cycle plus semantic substate when active.

## Readiness Verdict

The V2 design is now a better architecture surface than the monolithic V1. It is
still not implementation-ready until the P0 decisions in `06-open-decisions.md`
are closed and the older "implementation-ready" spec is explicitly superseded,
migrated, or downgraded to historical reference.
