# State Machine Spec — Pipeline Fractale v4

> **Statut** : v1.0 — Spec de conception, implémentation-ready.
> **Date** : 2026-05-03
> **Auteur** : conception agent (synthèse checkpoint-implementation.md + harness-state-machine.md + seven-steps.md)
> **Package cible** : `packages/core/src/state-machine/`
> **Résout** : Q2 (formaliser la state machine) et Q7 (multi-états) du rapport `discovery`

---

## 1. States Enumeration

### 1.1 Macro-states (8 cycle phases)

```
IDLE
discovery
cadrage
conception
build
validation
release
run
learning
```

### 1.2 Sub-phase states (micro-FSM — universal sub-cycle within each macro-state)

Each active macro-state hosts one active sub-phase. Notation: `CYCLE.SubPhase`.

```
*.Observer
*.Define
*.Design
*.Execute
*.Verify
*.Capitalize
*.Transmit
```

Full enumeration of composite states (56 states = 8 cycles × 7 sub-phases):

```
discovery.Observer   cadrage.Observer   conception.Observer   build.Observer
discovery.Define     cadrage.Define     conception.Define     build.Define
discovery.Design     cadrage.Design     conception.Design     build.Design
discovery.Execute    cadrage.Execute    conception.Execute    build.Execute
discovery.Verify     cadrage.Verify     conception.Verify     build.Verify
discovery.Capitalize cadrage.Capitalize conception.Capitalize build.Capitalize
discovery.Transmit   cadrage.Transmit   conception.Transmit   build.Transmit

validation.Observer  release.Observer   run.Observer          learning.Observer
validation.Define    release.Define     run.Define            learning.Define
validation.Design    release.Design     run.Design            learning.Design
validation.Execute   release.Execute    run.Execute           learning.Execute
validation.Verify    release.Verify     run.Verify            learning.Verify
validation.Capitalize release.Capitalize run.Capitalize       learning.Capitalize
validation.Transmit  release.Transmit   run.Transmit          learning.Transmit
```

### 1.3 Meta-states (orthogonal — activatable from any state)

```
ERROR.RECOVERABLE     — quality gate failure, invariant violation; max 3 auto-retries
ERROR.ESCALATED       — human intervention required
SUSPENDED             — voluntary pause; all writes forbidden; resumes to last_state
ABORTED               — terminal; only audit-append writes allowed
```

### 1.4 Final states (RMS terminal states)

```
DONE_VERIFIED              — learning.Transmit completed with full DoD
DONE_WITH_GAPS             — cycle completed but with open risks / GO-with-reserves
BLOCKED_NEEDS_USER         — ERROR.ESCALATED unresolved, human action required
BLOCKED_RUNTIME_MISSING    — dependency or tool absent; auto-recovery impossible
BLOCKED_POLICY             — bypass attempted on H/C; structurally prevented
MAX_ATTEMPTS_REACHED       — ERROR.RECOVERABLE hit 3 retries without recovery
LOOP_DETECTED              — same state visited 3× in one session without forward progress
CANCELLED                  — CYCLE_ABORT issued by human
```

---

## 2. Context Schema

```typescript
// packages/core/src/state-machine/types.ts

export type MacroCycle =
  | 'discovery'
  | 'cadrage'
  | 'conception'
  | 'build'
  | 'validation'
  | 'release'
  | 'run'
  | 'learning';

export type MacroState = 'IDLE' | MacroCycle;

export type SubPhase =
  | 'Observer'
  | 'Define'
  | 'Design'
  | 'Execute'
  | 'Verify'
  | 'Capitalize'
  | 'Transmit';

export type RiskClass = 'T' | 'L' | 'M' | 'H' | 'C';
export type OperatingMode = 'bypass' | 'auto' | 'pairing';
export type GateType =
  | 'session_start'
  | 'user_prompt'
  | 'pre_tool'
  | 'post_tool'
  | 'stop'
  | 'subagent_start'
  | 'subagent_stop';
export type ErrorSubState = 'RECOVERABLE' | 'ESCALATED' | null;
export type FinalState =
  | 'DONE_VERIFIED'
  | 'DONE_WITH_GAPS'
  | 'BLOCKED_NEEDS_USER'
  | 'BLOCKED_RUNTIME_MISSING'
  | 'BLOCKED_POLICY'
  | 'MAX_ATTEMPTS_REACHED'
  | 'LOOP_DETECTED'
  | 'CANCELLED';

export interface GateStatus {
  dor_satisfied: boolean;
  dod_satisfied: boolean;
  human_validation_obtained: boolean;
  critical_path_clear: boolean;
  rollback_plan_tested: boolean;
  risk_class_defined: boolean;
  vision_validated: boolean;
  adr_signed: boolean;
}

export interface EvidenceRecord {
  status_key: keyof GateStatus;
  value: boolean;
  ts: string;           // ISO 8601
  source: 'agent' | 'ci' | 'human';
  notes?: string;
}

export interface LastTransition {
  from: string;         // e.g. "build.Design"
  to: string;           // e.g. "build.Execute"
  event: HarnessEvent['type'];
  ts: string;
  triggered_by: 'agent' | 'human' | 'ci' | 'hook';
  gate_type: GateType | null;
}

export interface HarnessMachineContext {
  // Identity
  runId: string;             // UUID for this machine instance (project-scoped)
  sessionId: string;         // UUID for current Claude Code session

  // Position
  macroState: MacroState;
  subPhase: SubPhase | null; // null when IDLE or in meta-state

  // Configuration (orthogonal to state)
  riskClass: RiskClass | null;
  mode: OperatingMode;

  // Active item
  activeItemRef: string | null;  // path to .planning/02-backlog/items/PBI-NNN.md
  cycleStartedAt: string | null; // ISO 8601

  // Gate tracking
  gatesPassed: Array<keyof GateStatus>;
  gatesPending: Array<keyof GateStatus>;
  evidence: EvidenceRecord[];

  // Iteration safety
  attemptCount: number;          // resets on forward transition
  stateVisitCounts: Record<string, number>; // state key → visit count (loop detection)

  // Error / suspension
  errorSubState: ErrorSubState;
  suspendReason: string | null;
  lastStableState: string | null; // snapshot before ERROR/SUSPENDED

  // Final outcome
  finalState: FinalState | null;

  // History
  lastTransition: LastTransition | null;
  promotionHistory: Array<{
    from: RiskClass;
    to: RiskClass;
    ts: string;
    justification: string;
  }>;
}
```

---

## 3. Transitions

Complete transition table. Format: `ID | From → To | Event | Guards required`.

### 3.1 Macro-cycle nominal path

| ID   | From                      | To                       | Event            | Guards                                                            |
|------|---------------------------|--------------------------|------------------|-------------------------------------------------------------------|
| T001 | IDLE                  | discovery.Observer    | CYCLE_START      | `dorCheckInitiated`                                               |
| T008 | discovery.Transmit    | cadrage.Observer      | CYCLE_COMPLETE   | `dorSatisfied`, `riskClassDefined`; + `humanValidationObtained` if H/C |
| T015 | cadrage.Transmit      | conception.Observer   | CYCLE_COMPLETE   | `dorSatisfied`, `visionValidated`, `perfBudgetSet`               |
| T022 | conception.Transmit   | build.Observer        | CYCLE_COMPLETE   | `adrSigned`, `dodConceptionSatisfied`                            |
| T030 | build.Transmit        | validation.Observer   | CYCLE_COMPLETE   | `testsGreen`, `ciGatesGreen`, `dodSatisfiedPartial`              |
| T037 | validation.Transmit   | release.Observer      | CYCLE_COMPLETE   | `dodSatisfiedFull`, `humanValidationObtained`; + `rollbackPlanTested` if H/C |
| T044 | release.Transmit      | run.Observer          | CYCLE_COMPLETE   | `smokeTestsGreen`, `sloStable`                                   |
| T051 | run.Transmit          | learning.Observer     | CYCLE_COMPLETE   | —                                                                 |
| T058 | learning.Transmit     | IDLE                  | CYCLE_COMPLETE   | —                                                                 |

### 3.2 Micro-FSM sub-phase progression (within each active cycle)

Same pattern for all 8 cycles. Listed generically as `CYCLE.*`:

| ID    | From             | To               | Event             | Guards                                    |
|-------|------------------|------------------|-------------------|-------------------------------------------|
| S001  | CYCLE.Observer   | CYCLE.Define    | SUBSTEP_COMPLETE  | `substepOutputExists`                     |
| S002  | CYCLE.Define    | CYCLE.Design  | SUBSTEP_COMPLETE  | `substepOutputExists`, `riskClassAssigned`|
| S003  | CYCLE.Design  | CYCLE.Execute   | SUBSTEP_COMPLETE  | `substepOutputExists`; + `humanValidationObtained` if mode=pairing or H/C |
| S004  | CYCLE.Execute   | CYCLE.Verify   | SUBSTEP_COMPLETE  | `substepOutputExists`                     |
| S005  | CYCLE.Verify   | CYCLE.Capitalize| SUBSTEP_COMPLETE  | `verifyVerdictEmitted`                    |
| S006  | CYCLE.Capitalize| CYCLE.Transmit| SUBSTEP_COMPLETE  | `substepOutputExists`                     |

### 3.3 Skip transitions (T/L only)

| ID    | From             | To               | Event         | Guards                                   |
|-------|------------------|------------------|---------------|------------------------------------------|
| SK001 | CYCLE.Observer   | CYCLE.Design  | SUBSTEP_SKIP  | `riskClassIn(['T','L'])`, `skipAllowed`  |
| SK002 | CYCLE.Observer   | CYCLE.Execute   | SUBSTEP_SKIP  | `riskClassIn(['T'])`, `skipAllowed`      |

### 3.4 Error transitions (orthogonal — from any state)

| ID   | From                  | To                  | Event                | Guards                         |
|------|-----------------------|---------------------|----------------------|--------------------------------|
| E001 | ANY                   | ERROR.RECOVERABLE   | ERROR_DETECTED       | —                              |
| E002 | ERROR.RECOVERABLE     | last_stable_state   | ERROR_RECOVERED      | `lastStableStateExists`        |
| E003 | ERROR.RECOVERABLE     | MAX_ATTEMPTS_REACHED| ERROR_DETECTED (×3)  | `attemptCount >= 3`            |
| E004 | ERROR.RECOVERABLE     | ERROR.ESCALATED     | HUMAN_VALIDATE       | —                              |
| E005 | ERROR.ESCALATED       | last_stable_state   | ERROR_RECOVERED      | `humanApprovalRecorded`        |
| E006 | ERROR.ESCALATED       | ABORTED             | ERROR_UNRECOVERABLE  | —                              |

### 3.5 Rollback transitions

| ID   | From          | To                 | Event             | Guards                    |
|------|---------------|--------------------|-------------------|---------------------------|
| R001 | validation.*  | build.Verify     | DOD_FAIL          | —                         |
| R002 | release.*     | build.Verify     | ROLLBACK_REQUEST  | `rollbackStateAvailable`  |

### 3.6 Mode transitions (orthogonal — from any non-ABORTED state)

| ID   | From | To           | Event            | Guards                                              |
|------|------|--------------|------------------|-----------------------------------------------------|
| M001 | ANY  | same + pairing | MODE_SET_PAIRING | —                                                  |
| M002 | ANY  | same + auto | MODE_SET_AUTO | —                                              |
| M003 | ANY  | same + bypass| MODE_SET_BYPASS  | `bypassAllowed` (riskClass ∈ {T,L}) OR `humanOverrideRecorded` (riskClass=M only) |

### 3.7 Suspension / resumption

| ID   | From      | To               | Event         | Guards                        |
|------|-----------|------------------|---------------|-------------------------------|
| SP01 | ANY       | SUSPENDED        | CYCLE_SUSPEND | —                             |
| SP02 | SUSPENDED | last_stable_state| SESSION_START | `savedStateExists`            |
| SP03 | SUSPENDED | ABORTED          | CYCLE_ABORT   | —                             |

### 3.8 Risk class transitions

| ID   | From | To   | Event              | Guards                              |
|------|------|------|--------------------|-------------------------------------|
| RC01 | ANY  | same | RISK_CLASS_SET     | `riskClassNotYetSet`                |
| RC02 | ANY  | SUSPENDED → same | RISK_CLASS_PROMOTE | `promotionAcknowledgedByAgent`; + `humanValidationObtained` if new class H/C |

---

## 4. Guards

Each guard is a pure predicate: `(context: HarnessMachineContext, event: HarnessEvent) => boolean`.

```typescript
// packages/core/src/state-machine/guards.ts

import type { HarnessMachineContext, RiskClass } from './types';

// --- Gate guards ---

export const dorSatisfied = (ctx: HarnessMachineContext): boolean =>
  ctx.gatesPassed.includes('dor_satisfied');

export const dodSatisfiedPartial = (ctx: HarnessMachineContext): boolean =>
  ctx.gatesPassed.includes('dod_satisfied') &&
  ctx.evidence.some(e => e.status_key === 'dod_satisfied' && e.source === 'ci');

export const dodSatisfiedFull = (ctx: HarnessMachineContext): boolean =>
  ctx.gatesPassed.includes('dod_satisfied') &&
  ctx.gatesPassed.includes('human_validation_obtained');

export const humanValidationObtained = (ctx: HarnessMachineContext): boolean =>
  ctx.gatesPassed.includes('human_validation_obtained');

export const humanApprovalRecorded = (ctx: HarnessMachineContext): boolean =>
  ctx.evidence.some(e => e.status_key === 'human_validation_obtained' && e.source === 'human');

export const riskClassDefined = (ctx: HarnessMachineContext): boolean =>
  ctx.riskClass !== null;

export const riskClassAssigned = riskClassDefined;

export const riskClassNotYetSet = (ctx: HarnessMachineContext): boolean =>
  ctx.riskClass === null;

export const visionValidated = (ctx: HarnessMachineContext): boolean =>
  ctx.gatesPassed.includes('vision_validated');

export const perfBudgetSet = (ctx: HarnessMachineContext): boolean =>
  ctx.evidence.some(e => e.notes?.includes('perf_budget'));

export const adrSigned = (ctx: HarnessMachineContext): boolean =>
  ctx.gatesPassed.includes('adr_signed');

export const dodConceptionSatisfied = (ctx: HarnessMachineContext): boolean =>
  ctx.gatesPassed.includes('dod_satisfied') &&
  ctx.macroState === 'conception';

export const rollbackPlanTested = (ctx: HarnessMachineContext): boolean =>
  ctx.gatesPassed.includes('rollback_plan_tested');

export const criticalPathClear = (ctx: HarnessMachineContext): boolean =>
  ctx.gatesPassed.includes('critical_path_clear');

export const testsGreen = (ctx: HarnessMachineContext): boolean =>
  ctx.evidence.some(e => e.notes?.includes('tests_green') && e.source === 'ci');

export const ciGatesGreen = (ctx: HarnessMachineContext): boolean =>
  ctx.evidence.some(e => e.notes?.includes('ci_gates_green') && e.source === 'ci');

export const smokeTestsGreen = (ctx: HarnessMachineContext): boolean =>
  ctx.evidence.some(e => e.notes?.includes('smoke_tests_green') && e.source === 'ci');

export const sloStable = (ctx: HarnessMachineContext): boolean =>
  ctx.evidence.some(e => e.notes?.includes('slo_stable'));

// --- Risk-class gates ---

export const bypassAllowed = (ctx: HarnessMachineContext): boolean =>
  ctx.riskClass !== null && ['T', 'L'].includes(ctx.riskClass);

// NEVER true for H or C — structural impossibility, not convention
export const bypassStructurallyImpossible = (ctx: HarnessMachineContext): boolean =>
  ctx.riskClass !== null && ['H', 'C'].includes(ctx.riskClass);

export const riskClassIn =
  (classes: RiskClass[]) =>
  (ctx: HarnessMachineContext): boolean =>
    ctx.riskClass !== null && classes.includes(ctx.riskClass);

export const humanRequiredForRiskClass = (ctx: HarnessMachineContext): boolean =>
  ctx.riskClass !== null && ['H', 'C'].includes(ctx.riskClass);

// --- Evidence / sub-step guards ---

export const substepOutputExists = (ctx: HarnessMachineContext): boolean =>
  ctx.lastTransition !== null; // weakest check; runtime validates artifact presence on disk

export const verifyVerdictEmitted = (ctx: HarnessMachineContext): boolean =>
  ctx.evidence.some(e => e.notes?.match(/verdict:(GO|NO-GO|GO_WITH_RESERVES)/));

export const skipAllowed = (ctx: HarnessMachineContext): boolean =>
  bypassAllowed(ctx) || (ctx.mode === 'bypass' && bypassAllowed(ctx));

// --- Iteration safety ---

export const maxAttemptsReached = (ctx: HarnessMachineContext): boolean =>
  ctx.attemptCount >= 3;

export const loopDetected = (ctx: HarnessMachineContext): boolean => {
  const key = `${ctx.macroState}.${ctx.subPhase ?? ''}`;
  return (ctx.stateVisitCounts[key] ?? 0) >= 3;
};

// --- State existence guards ---

export const lastStableStateExists = (ctx: HarnessMachineContext): boolean =>
  ctx.lastStableState !== null;

export const savedStateExists = lastStableStateExists;

export const rollbackStateAvailable = (ctx: HarnessMachineContext): boolean =>
  ctx.lastStableState !== null && ctx.lastStableState.startsWith('build');

export const dorCheckInitiated = (_ctx: HarnessMachineContext): boolean =>
  true; // always true at CYCLE_START — DoR check is the first action of Observer

export const humanOverrideRecorded = (ctx: HarnessMachineContext): boolean =>
  ctx.evidence.some(e => e.status_key === 'human_validation_obtained' &&
    e.notes?.includes('HUMAN_OVERRIDE'));

export const promotionAcknowledgedByAgent = (_ctx: HarnessMachineContext): boolean =>
  true; // RISK_CLASS_PROMOTE event carries justification field; always proceed to SUSPEND
```

---

## 5. Actions

Side effects executed on transition entry/exit. Each action is a named function with no return value (fire-and-forget, but must not fail silently).

```typescript
// packages/core/src/state-machine/actions.ts

import type { HarnessMachineContext, HarnessEvent, LastTransition } from './types';

// --- Logging ---

/** Append a transition entry to the run_set.transition_history projection in .planning/run-set.json */
export const logTransition = (
  ctx: HarnessMachineContext,
  event: HarnessEvent,
  toState: string
): void => {
  const entry: TransitionLogEntry = {
    ts: new Date().toISOString(),
    session: ctx.sessionId,
    from: `${ctx.macroState}.${ctx.subPhase ?? 'null'}`,
    to: toState,
    event: event.type,
    guards: resolvedGuards(ctx, event),   // snapshot of evaluated guard results
    mode: ctx.mode,
    risk_class: ctx.riskClass,
    triggered_by: event.triggeredBy ?? 'agent',
    gate_type: event.gateType ?? null,
    item: ctx.activeItemRef,
    notes: event.notes ?? null,
  };
  appendRunSetProjection('.planning/run-set.json', 'transition_history', entry);
};

// --- State persistence ---

/** Overwrite .planning/state.yaml with current context snapshot */
export const persistState = (ctx: HarnessMachineContext): void => {
  writeYaml('.planning/state.yaml', {
    version: '1',
    updated_at: new Date().toISOString(),
    session_id: ctx.sessionId,
    macro_state: ctx.macroState,
    micro_state: ctx.subPhase,
    mode: ctx.mode,
    risk_class: ctx.riskClass,
    active_item_ref: ctx.activeItemRef,
    active_cycle_start: ctx.cycleStartedAt,
    gates_passed: ctx.gatesPassed,
    gates_pending: ctx.gatesPending,
    last_transition: ctx.lastTransition,
    error_state: ctx.errorSubState,
    suspend_reason: ctx.suspendReason,
    final_state: ctx.finalState,
  });
};

// --- Context mutations (XState assign actions) ---

export const snapshotLastStableState = assign<HarnessMachineContext>({
  lastStableState: (ctx) => `${ctx.macroState}.${ctx.subPhase ?? ''}`,
});

export const resetAttemptCount = assign<HarnessMachineContext>({
  attemptCount: 0,
});

export const incrementAttemptCount = assign<HarnessMachineContext>({
  attemptCount: (ctx) => ctx.attemptCount + 1,
});

export const incrementStateVisitCount = assign<HarnessMachineContext>({
  stateVisitCounts: (ctx) => {
    const key = `${ctx.macroState}.${ctx.subPhase ?? ''}`;
    return { ...ctx.stateVisitCounts, [key]: (ctx.stateVisitCounts[key] ?? 0) + 1 };
  },
});

export const setMode = assign<HarnessMachineContext, ModeSetEvent>({
  mode: (_, event) => event.mode,
});

export const setRiskClass = assign<HarnessMachineContext, RiskClassSetEvent>({
  riskClass: (_, event) => event.riskClass,
});

export const recordPromotion = assign<HarnessMachineContext, RiskClassPromoteEvent>({
  promotionHistory: (ctx, event) => [
    ...ctx.promotionHistory,
    { from: ctx.riskClass!, to: event.newClass, ts: new Date().toISOString(), justification: event.justification },
  ],
  riskClass: (_, event) => event.newClass,
});

export const recordGatePassed = assign<HarnessMachineContext, GatePassEvent>({
  gatesPassed: (ctx, event) => Array.from(new Set([...ctx.gatesPassed, event.gate])),
  gatesPending: (ctx, event) => ctx.gatesPending.filter(g => g !== event.gate),
  evidence: (ctx, event) => [...ctx.evidence, event.evidence],
});

export const setFinalState = assign<HarnessMachineContext, FinalStateEvent>({
  finalState: (_, event) => event.state,
});

// --- Event emission ---

/** Emit HARNESS_SYNC to re-derive effective permissions from current state and run-set projections */
export const emitHarnessSync = (ctx: HarnessMachineContext): void => {
  syncRunSetProjections(ctx); // refreshes logical RMS projections in .planning/run-set.json
};

/** Write abort report artifact */
export const writeAbortReport = (ctx: HarnessMachineContext): void => {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  writeRunSetProjection('.planning/run-set.json', 'abort_reports', {
    report_id: `abort-report-${ts}`,
    cycle_aborted: ctx.macroState,
    substep_at_abort: ctx.subPhase,
    risk_class: ctx.riskClass,
    item_ref: ctx.activeItemRef,
    abort_ts: new Date().toISOString(),
    session_id: ctx.sessionId,
    last_stable_state: ctx.lastStableState,
    human_action_required: 'Reclassify item or respecify acceptance criteria',
  });
};

/** Check territory write permission against §5.2 matrix before any agent write */
export const checkTerritoryPermission = (
  ctx: HarnessMachineContext,
  territory: Territory,
  operation: 'R' | 'W'
): boolean => {
  const matrixKey = `${ctx.macroState}.${ctx.subPhase ?? '*'}`;
  const allowed = TERRITORY_MATRIX[matrixKey]?.[territory];
  if (operation === 'W' && allowed !== 'W') {
    logTransition(ctx, { type: 'TERRITORY_VIOLATION', territory, operation }, matrixKey);
    throw new TerritoryViolationError(matrixKey, territory);
  }
  return true;
};
```

---

## 6. Hierarchical States

### 6.1 Structure

The machine is a **Harel statechart**: two levels of hierarchy, with meta-states as orthogonal regions.

```
HarnessMachine
├── IDLE                          (simple state)
├── ActiveCycle                   (compound parallel)
│   ├── MacroCycle                (compound sequential — one of 8)
│   │   ├── discovery             (compound sequential)
│   │   │   ├── Observer          (simple)
│   │   │   ├── Define           (simple)
│   │   │   ├── Design         (simple)
│   │   │   ├── Execute          (simple) ← territory code/ W ONLY here in build
│   │   │   ├── Verify          (simple)
│   │   │   ├── Capitalize       (simple)
│   │   │   └── Transmit       (simple)
│   │   ├── cadrage               (same 7 sub-states)
│   │   ├── conception            (same 7 sub-states)
│   │   ├── build                 (same 7 sub-states — code/ W in Execute only)
│   │   ├── validation            (same 7 sub-states)
│   │   ├── release               (same 7 sub-states)
│   │   ├── run                   (same 7 sub-states)
│   │   └── learning              (same 7 sub-states)
│   └── MetaRegion                (orthogonal region — active simultaneously)
│       ├── ERROR                 (compound: RECOVERABLE | ESCALATED)
│       └── SUSPENDED             (simple)
└── ABORTED                       (terminal)
```

### 6.2 Fractal pattern

The fractal property is architectural, not implemented as runtime nesting. The micro-FSM is the same 7-state sequence re-instantiated for each macro-cycle. At runtime, this is represented as a single `subPhase` field in context — not as nested machines — for simplicity (D7: mono-state strict).

### 6.3 Parallel regions

The `MetaRegion` is orthogonal to the active `MacroCycle`. When `ERROR_DETECTED` fires, the machine enters `ERROR.RECOVERABLE` while remembering the active `MacroCycle.SubPhase` in `lastStableState`. The macro-cycle does not exit — it is suspended in place. On `ERROR_RECOVERED`, the macro-cycle resumes from `lastStableState`.

```
┌─────────────────────────────────────────────────────────────┐
│ ActiveCycle (parallel)                                      │
│                                                             │
│  ┌─────────────────────┐  ┌──────────────────────────────┐  │
│  │ MacroCycle          │  │ MetaRegion                   │  │
│  │  [build.Execute]   │  │  ERROR.RECOVERABLE           │  │
│  │  (frozen)           │  │  (active, resolving issue)   │  │
│  └─────────────────────┘  └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Final States

Mapping to RMS terminal states with triggering conditions and required artifacts.

| Final State              | Triggers                                                                | Required Artifact                               |
|--------------------------|-------------------------------------------------------------------------|-------------------------------------------------|
| `DONE_VERIFIED`          | `learning.Transmit` + `CYCLE_COMPLETE` + `dodSatisfiedFull`     | `docs/` Transmit artefact; DORA metrics updated |
| `DONE_WITH_GAPS`         | `CYCLE_COMPLETE` + verdict = `GO_WITH_RESERVES`                         | Open risk items in `.planning/08-risks/`        |
| `BLOCKED_NEEDS_USER`     | `ERROR.ESCALATED` with no human response                                | `abort-report-{ts}.md` + log entry              |
| `BLOCKED_RUNTIME_MISSING`| `ERROR_DETECTED` where error type = `DEPENDENCY_MISSING`                | Log entry with missing dependency name          |
| `BLOCKED_POLICY`         | `MODE_SET_BYPASS` guard `bypassStructurallyImpossible` = true           | Log entry flagging the policy violation attempt |
| `MAX_ATTEMPTS_REACHED`   | `attemptCount >= 3` on `ERROR.RECOVERABLE`                              | `abort-report-{ts}.md`                          |
| `LOOP_DETECTED`          | `stateVisitCounts[key] >= 3` in same session                            | Log entry; escalate to `BLOCKED_NEEDS_USER`     |
| `CANCELLED`              | `CYCLE_ABORT` event from human                                          | `abort-report-{ts}.md` (human_action = "WIP commit done") |

---

## 8. XState v5 Config Skeleton

```typescript
// packages/core/src/state-machine/machine.ts

import { setup, createMachine, assign } from 'xstate';
import type { HarnessMachineContext, HarnessEvent } from './types';
import * as guards from './guards';
import * as actions from './actions';

// Sub-cycle states shared across all 8 macro-cycles
const subCycleStates = {
  Observer:    { on: { SUBSTEP_COMPLETE: { target: 'Define',    guard: 'substepOutputExists' },
                       SUBSTEP_SKIP:     { target: 'Design',  guard: 'skipAllowed' } } },
  Define:     { on: { SUBSTEP_COMPLETE: { target: 'Design',  guard: 'riskClassAssigned' } } },
  Design:   { on: { SUBSTEP_COMPLETE: { target: 'Execute',   guard: 'substepOutputExists' } } },
  Execute:    { on: { SUBSTEP_COMPLETE: { target: 'Verify',   guard: 'substepOutputExists' } } },
  Verify:    { on: { SUBSTEP_COMPLETE: { target: 'Capitalize',guard: 'verifyVerdictEmitted' } } },
  Capitalize: { on: { SUBSTEP_COMPLETE: { target: 'Transmit',guard: 'substepOutputExists' } } },
  Transmit: { type: 'final' as const },
};

export const harnessMachine = setup({
  types: {} as {
    context: HarnessMachineContext;
    events: HarnessEvent;
  },
  guards: {
    dorSatisfied:              ({ context }) => guards.dorSatisfied(context),
    dodSatisfiedFull:          ({ context }) => guards.dodSatisfiedFull(context),
    dodSatisfiedPartial:       ({ context }) => guards.dodSatisfiedPartial(context),
    humanValidationObtained:   ({ context }) => guards.humanValidationObtained(context),
    riskClassDefined:          ({ context }) => guards.riskClassDefined(context),
    riskClassAssigned:         ({ context }) => guards.riskClassAssigned(context),
    bypassAllowed:             ({ context }) => guards.bypassAllowed(context),
    bypassStructurallyImpossible: ({ context }) => guards.bypassStructurallyImpossible(context),
    maxAttemptsReached:        ({ context }) => guards.maxAttemptsReached(context),
    loopDetected:              ({ context }) => guards.loopDetected(context),
    skipAllowed:               ({ context }) => guards.skipAllowed(context),
    substepOutputExists:       ({ context }) => guards.substepOutputExists(context),
    verifyVerdictEmitted:      ({ context }) => guards.verifyVerdictEmitted(context),
    lastStableStateExists:     ({ context }) => guards.lastStableStateExists(context),
    rollbackStateAvailable:    ({ context }) => guards.rollbackStateAvailable(context),
    adrSigned:                 ({ context }) => guards.adrSigned(context),
    visionValidated:           ({ context }) => guards.visionValidated(context),
    testsGreen:                ({ context }) => guards.testsGreen(context),
    ciGatesGreen:              ({ context }) => guards.ciGatesGreen(context),
    rollbackPlanTested:        ({ context }) => guards.rollbackPlanTested(context),
    humanOverrideRecorded:     ({ context }) => guards.humanOverrideRecorded(context),
  },
  actions: {
    logTransition:             ({ context, event }, params: { to: string }) =>
                                 actions.logTransition(context, event, params.to),
    persistState:              ({ context }) => actions.persistState(context),
    snapshotLastStableState:   actions.snapshotLastStableState,
    resetAttemptCount:         actions.resetAttemptCount,
    incrementAttemptCount:     actions.incrementAttemptCount,
    incrementStateVisitCount:  actions.incrementStateVisitCount,
    setMode:                   actions.setMode,
    setRiskClass:              actions.setRiskClass,
    recordPromotion:           actions.recordPromotion,
    recordGatePassed:          actions.recordGatePassed,
    emitHarnessSync:           ({ context }) => actions.emitHarnessSync(context),
    writeAbortReport:          ({ context }) => actions.writeAbortReport(context),
  },
}).createMachine({
  id: 'harness',
  initial: 'IDLE',
  context: (): HarnessMachineContext => ({
    runId: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
    macroState: 'IDLE',
    subPhase: null,
    riskClass: null,
    mode: 'auto',
    activeItemRef: null,
    cycleStartedAt: null,
    gatesPassed: [],
    gatesPending: [],
    evidence: [],
    attemptCount: 0,
    stateVisitCounts: {},
    errorSubState: null,
    suspendReason: null,
    lastStableState: null,
    finalState: null,
    lastTransition: null,
    promotionHistory: [],
  }),

  on: {
    // Global transitions (from any state)
    ERROR_DETECTED: {
      target: '.ERROR.RECOVERABLE',
      actions: ['snapshotLastStableState', 'incrementAttemptCount', 'persistState'],
    },
    CYCLE_ABORT: {
      target: '.ABORTED',
      actions: ['writeAbortReport', 'persistState'],
    },
    CYCLE_SUSPEND: {
      target: '.SUSPENDED',
      actions: ['snapshotLastStableState', 'persistState'],
    },
    MODE_SET_PAIRING: { actions: [{ type: 'setMode', params: { mode: 'pairing' } }, 'persistState'] },
    MODE_SET_AUTO:    { actions: [{ type: 'setMode', params: { mode: 'auto' } }, 'persistState'] },
    MODE_SET_BYPASS: {
      guard: ({ context }) => guards.bypassAllowed(context) || guards.humanOverrideRecorded(context),
      actions: [{ type: 'setMode', params: { mode: 'bypass' } }, 'persistState'],
    },
    RISK_CLASS_SET: {
      guard: 'riskClassNotYetSet',
      actions: ['setRiskClass', 'persistState'],
    },
    RISK_CLASS_PROMOTE: {
      actions: ['recordPromotion', 'persistState'],
      target: '.SUSPENDED',
    },
    GATE_PASS: {
      actions: ['recordGatePassed', 'persistState'],
    },
    SESSION_START: {
      actions: ['emitHarnessSync', 'persistState'],
    },
  },

  states: {
    IDLE: {
      entry: ['persistState'],
      on: {
        CYCLE_START: {
          target: 'discovery',
          guard: 'dorSatisfied',
          actions: ['resetAttemptCount', 'logTransition', 'persistState'],
        },
      },
    },

    discovery: {
      initial: 'Observer',
      entry: [assign({ macroState: 'discovery', cycleStartedAt: () => new Date().toISOString() }), 'incrementStateVisitCount'],
      states: {
        ...subCycleStates,
      },
      onDone: {
        target: 'cadrage',
        guard: ({ context }) => guards.dorSatisfied(context) && guards.riskClassDefined(context),
        actions: ['logTransition', 'persistState'],
      },
    },

    cadrage: {
      initial: 'Observer',
      entry: [assign({ macroState: 'cadrage' }), 'incrementStateVisitCount'],
      states: { ...subCycleStates },
      onDone: {
        target: 'conception',
        guard: ({ context }) => guards.dorSatisfied(context) && guards.visionValidated(context),
        actions: ['logTransition', 'persistState'],
      },
    },

    conception: {
      initial: 'Observer',
      entry: [assign({ macroState: 'conception' }), 'incrementStateVisitCount'],
      states: { ...subCycleStates },
      onDone: {
        target: 'build',
        guard: ({ context }) => guards.adrSigned(context) && guards.dodConceptionSatisfied(context),
        actions: ['logTransition', 'persistState'],
      },
    },

    build: {
      initial: 'Observer',
      entry: [assign({ macroState: 'build' }), 'incrementStateVisitCount'],
      states: { ...subCycleStates },
      on: {
        DOD_FAIL: {
          // stay in build — no-op; validation sends ROLLBACK_REQUEST
        },
      },
      onDone: {
        target: 'validation',
        guard: ({ context }) => guards.testsGreen(context) && guards.ciGatesGreen(context),
        actions: ['logTransition', 'persistState'],
      },
    },

    validation: {
      initial: 'Observer',
      entry: [assign({ macroState: 'validation' }), 'incrementStateVisitCount'],
      states: { ...subCycleStates },
      on: {
        DOD_FAIL: {
          target: 'build.Verify',
          actions: ['snapshotLastStableState', 'logTransition', 'persistState'],
        },
      },
      onDone: {
        target: 'release',
        guard: ({ context }) =>
          guards.dodSatisfiedFull(context) && guards.humanValidationObtained(context),
        actions: ['logTransition', 'persistState'],
      },
    },

    release: {
      initial: 'Observer',
      entry: [assign({ macroState: 'release' }), 'incrementStateVisitCount'],
      states: { ...subCycleStates },
      on: {
        ROLLBACK_REQUEST: {
          target: 'build.Verify',
          guard: 'rollbackStateAvailable',
          actions: ['snapshotLastStableState', 'logTransition', 'persistState'],
        },
      },
      onDone: {
        target: 'run',
        actions: ['logTransition', 'persistState'],
      },
    },

    run: {
      initial: 'Observer',
      entry: [assign({ macroState: 'run' }), 'incrementStateVisitCount'],
      states: { ...subCycleStates },
      onDone: {
        target: 'learning',
        actions: ['logTransition', 'persistState'],
      },
    },

    learning: {
      initial: 'Observer',
      entry: [assign({ macroState: 'learning' }), 'incrementStateVisitCount'],
      states: { ...subCycleStates },
      onDone: {
        target: 'IDLE',
        actions: [
          assign({ finalState: 'DONE_VERIFIED' }),
          'logTransition',
          'persistState',
        ],
      },
    },

    ERROR: {
      initial: 'RECOVERABLE',
      states: {
        RECOVERABLE: {
          on: {
            ERROR_RECOVERED: {
              target: '#harness.hist',
              guard: 'lastStableStateExists',
              actions: ['resetAttemptCount', 'logTransition', 'persistState'],
            },
            HUMAN_VALIDATE: {
              target: 'ESCALATED',
              actions: ['logTransition', 'persistState'],
            },
            ERROR_DETECTED: [
              {
                target: '#harness.MAX_ATTEMPTS_REACHED',
                guard: 'maxAttemptsReached',
                actions: ['writeAbortReport', 'persistState'],
              },
              {
                actions: ['incrementAttemptCount', 'persistState'],
              },
            ],
          },
        },
        ESCALATED: {
          on: {
            ERROR_RECOVERED: {
              target: '#harness.hist',
              guard: 'humanApprovalRecorded',
              actions: ['resetAttemptCount', 'logTransition', 'persistState'],
            },
            ERROR_UNRECOVERABLE: {
              target: '#harness.ABORTED',
              actions: ['writeAbortReport', 'persistState'],
            },
          },
        },
      },
    },

    SUSPENDED: {
      on: {
        SESSION_START: {
          target: '#harness.hist',
          guard: 'savedStateExists',
          actions: ['emitHarnessSync', 'logTransition', 'persistState'],
        },
        CYCLE_ABORT: {
          target: 'ABORTED',
          actions: ['writeAbortReport', 'persistState'],
        },
      },
    },

    ABORTED: {
      type: 'final',
      entry: [assign({ finalState: 'CANCELLED' }), 'persistState'],
    },

    MAX_ATTEMPTS_REACHED: {
      type: 'final',
      entry: [assign({ finalState: 'MAX_ATTEMPTS_REACHED' }), 'persistState'],
    },

    // History pseudo-state for resumption after ERROR/SUSPENDED
    hist: {
      type: 'history',
      history: 'deep',
    },
  },
});
```

---

## 9. State Persistence

### 9.1 Mapping to the canonical `.planning/` files

PFV4 uses exactly three physical runtime files. RMS Sets are logical sections/projections inside these files, never separate physical files.

```
.planning/
├── state.yaml          ← primary state snapshot (overwritten atomically on every transition)
├── current-risk.yaml   ← current RiskClass, justification, promotions/demotions
└── run-set.json        ← logical RMS projections: route_set, policy_set, evidence_set, transition_history, abort_reports
```

### 9.2 `state.yaml` schema (authoritative)

```yaml
# .planning/state.yaml
version: "1"
updated_at: "2026-05-03T14:32:00Z"   # ISO 8601
session_id: "sess_abc123"             # UUID

macro_state: "build"                  # MacroState enum value
micro_state: "Execute"              # SubPhase enum value | null
mode: "auto"                          # bypass | auto | pairing
risk_class: "M"                       # T | L | M | H | C | null

active_item_ref: ".planning/02-backlog/items/PBI-042.md"
active_cycle_start: "2026-05-03T09:00:00Z"
gates_passed: ["dor_satisfied", "risk_class_defined"]
gates_pending: ["dod_satisfied", "human_validation_obtained"]

last_transition:
  from: "build.Design"
  to: "build.Execute"
  event: "SUBSTEP_COMPLETE"
  gate_type: "post_tool"              # GateType | null
  ts: "2026-05-03T14:32:00Z"
  triggered_by: "agent"

error_state: null                     # null | RECOVERABLE | ESCALATED
suspend_reason: null
last_stable_state: null
final_state: null                     # null | FinalState enum value
attempt_count: 0
```

### 9.3 Persistence rules

1. `persistState` action is called on **every transition** — no exception.
2. `state.yaml` is written atomically (write to `.tmp`, then rename).
3. Transition history is appended to the `transition_history` projection inside `.planning/run-set.json`; no JSONL transition file is canonical.
4. On `session_start`, the harness reads `state.yaml` to restore context. If the file is absent or invalid, the machine starts in `IDLE`.
5. Risk decisions and promotion/demotion history are persisted in `.planning/current-risk.yaml`.
6. Policy, route, evidence, transition, and abort-report data are logical RMS projections inside `.planning/run-set.json`.
7. The XState `hist` pseudo-state handles deep history restoration; `lastStableState` in context provides the YAML-level equivalent for cross-session resume.

---

## 10. Open Questions Resolved

### Q2 — How to formalize the state machine

**Question (from `discovery` §Q2)**: formal schema of states, transitions, conditions, authorized actions.

**Resolution**: This document is the answer. The formalization uses three layers:

1. **Conceptual** (this document — `docs/conception/01-state-machine-spec.md`): human-readable spec with TypeScript types, guard signatures, action signatures, and xstate skeleton. Source of truth for architectural decisions.

2. **Executable** (`.planning/state.yaml`, `.planning/current-risk.yaml`, `.planning/run-set.json`): strict runtime storage files derived from this spec. The machine reads `state.yaml` at each GateType decision and updates it atomically.

3. **RMS projections** (`.planning/run-set.json`): logical sections for `policy_set`, `route_set`, `evidence_set`, `transition_history`, and abort reports. Hooks are runtime adapters that trigger GateType decisions; GateType is the canonical internal policy point.

**Consequence of inaction (resolved)**: the harness was a black box. With this spec, any agent or developer can determine from the current state exactly what writes are authorized, what guards must be satisfied before any transition, and what the complete transition history was for any session.

---

### Q7 — Multi-state (parallel cycles)

**Question (from `discovery` §Q7)**: how to transition from strict mono-state to multi-state where each PBI/sprint/release has its own state?

**Resolution**: the current spec implements strict mono-state (one active `MacroCycle` at a time). The path to multi-state is defined as follows:

**Precondition**: the mono-state machine must complete at least 2 full cycles without ABORTED or MAX_ATTEMPTS_REACHED. This validates the core semantics before increasing complexity.

**Migration path** (when ready):
1. Replace the single `HarnessMachineContext` with a `Map<itemId, HarnessMachineContext>` — each PBI gets its own machine instance.
2. The `ActiveCycle` compound state becomes a parallel state with N orthogonal regions — one per active item.
3. The territory permission matrix (§5.2) must be extended: if two active items both target `build.Execute`, the `code/` territory requires a per-item scope (e.g. file-path prefix) to prevent overlap.
4. `.planning/state.yaml` keeps the active item index and per-item state snapshots as logical sections.
5. `.planning/run-set.json` transition entries include an `item_id` field.

**Why deferred**: the territory conflict resolution for parallel builds (two agents writing to overlapping files) requires the worktree isolation strategy (per `rules/agents.md`). That infrastructure must be validated before multi-state is safe.

---

*Spec ready for implementation. Next step: `packages/core/src/state-machine/` scaffold — create `types.ts`, `guards.ts`, `actions.ts`, `machine.ts` from the skeletons above.*
