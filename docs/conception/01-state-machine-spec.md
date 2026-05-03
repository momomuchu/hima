# State Machine Spec — Pipeline Fractale v4

> **Statut** : v1.0 — Spec de conception, implémentation-ready.
> **Date** : 2026-05-03
> **Auteur** : conception agent (synthèse checkpoint-implementation.md + harness-state-machine.md + seven-steps.md)
> **Package cible** : `packages/core/src/state-machine/`
> **Résout** : Q2 (formaliser la state machine) et Q7 (multi-états) du rapport Discovery

---

## 1. States Enumeration

### 1.1 Macro-states (8 cycle phases)

```
IDLE
DISCOVERY
CADRAGE
CONCEPTION
BUILD
VALIDATION
RELEASE
RUN
APPRENTISSAGE
```

### 1.2 Sub-phase states (micro-FSM — universal sub-cycle within each macro-state)

Each active macro-state hosts one active sub-phase. Notation: `CYCLE.SubPhase`.

```
*.Observer
*.Définir
*.Concevoir
*.Exécuter
*.Vérifier
*.Capitaliser
*.Transmettre
```

Full enumeration of composite states (56 states = 8 cycles × 7 sub-phases):

```
DISCOVERY.Observer   CADRAGE.Observer   CONCEPTION.Observer   BUILD.Observer
DISCOVERY.Définir    CADRAGE.Définir    CONCEPTION.Définir    BUILD.Définir
DISCOVERY.Concevoir  CADRAGE.Concevoir  CONCEPTION.Concevoir  BUILD.Concevoir
DISCOVERY.Exécuter   CADRAGE.Exécuter   CONCEPTION.Exécuter   BUILD.Exécuter
DISCOVERY.Vérifier   CADRAGE.Vérifier   CONCEPTION.Vérifier   BUILD.Vérifier
DISCOVERY.Capitaliser CADRAGE.Capitaliser CONCEPTION.Capitaliser BUILD.Capitaliser
DISCOVERY.Transmettre CADRAGE.Transmettre CONCEPTION.Transmettre BUILD.Transmettre

VALIDATION.Observer  RELEASE.Observer   RUN.Observer          APPRENTISSAGE.Observer
VALIDATION.Définir   RELEASE.Définir    RUN.Définir           APPRENTISSAGE.Définir
VALIDATION.Concevoir RELEASE.Concevoir  RUN.Concevoir         APPRENTISSAGE.Concevoir
VALIDATION.Exécuter  RELEASE.Exécuter   RUN.Exécuter          APPRENTISSAGE.Exécuter
VALIDATION.Vérifier  RELEASE.Vérifier   RUN.Vérifier          APPRENTISSAGE.Vérifier
VALIDATION.Capitaliser RELEASE.Capitaliser RUN.Capitaliser    APPRENTISSAGE.Capitaliser
VALIDATION.Transmettre RELEASE.Transmettre RUN.Transmettre    APPRENTISSAGE.Transmettre
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
DONE_VERIFIED              — APPRENTISSAGE.Transmettre completed with full DoD
DONE_WITH_GAPS             — cycle completed but with open risks / GO-with-reserves
BLOCKED_NEEDS_USER         — ERROR.ESCALATED unresolved, human action required
BLOCKED_RUNTIME_MISSING    — dependency or tool absent; auto-recovery impossible
BLOCKED_POLICY             — bypass attempted on É/C; structurally prevented
MAX_ATTEMPTS_REACHED       — ERROR.RECOVERABLE hit 3 retries without recovery
LOOP_DETECTED              — same state visited 3× in one session without forward progress
CANCELLED                  — CYCLE_ABORT issued by human
```

---

## 2. Context Schema

```typescript
// packages/core/src/state-machine/types.ts

export type MacroState =
  | 'IDLE'
  | 'DISCOVERY'
  | 'CADRAGE'
  | 'CONCEPTION'
  | 'BUILD'
  | 'VALIDATION'
  | 'RELEASE'
  | 'RUN'
  | 'APPRENTISSAGE';

export type SubPhase =
  | 'Observer'
  | 'Définir'
  | 'Concevoir'
  | 'Exécuter'
  | 'Vérifier'
  | 'Capitaliser'
  | 'Transmettre';

export type RiskClass = 'T' | 'F' | 'M' | 'É' | 'C';
export type OperatingMode = 'pairing' | 'auto' | 'bypass';
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
  gate: keyof GateStatus;
  value: boolean;
  ts: string;           // ISO 8601
  source: 'agent' | 'ci' | 'human';
  notes?: string;
}

export interface LastTransition {
  from: string;         // e.g. "BUILD.Concevoir"
  to: string;           // e.g. "BUILD.Exécuter"
  event: HarnessEvent['type'];
  ts: string;
  triggered_by: 'agent' | 'human' | 'ci' | 'hook';
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
| T001 | IDLE                      | DISCOVERY.Observer       | CYCLE_START      | `dorCheckInitiated`                                               |
| T008 | DISCOVERY.Transmettre     | CADRAGE.Observer         | CYCLE_COMPLETE   | `dorSatisfied`, `riskClassDefined`; + `humanValidationObtained` if É/C |
| T015 | CADRAGE.Transmettre       | CONCEPTION.Observer      | CYCLE_COMPLETE   | `dorSatisfied`, `visionValidated`, `perfBudgetSet`               |
| T022 | CONCEPTION.Transmettre    | BUILD.Observer           | CYCLE_COMPLETE   | `adrSigned`, `dodConceptionSatisfied`                            |
| T030 | BUILD.Transmettre         | VALIDATION.Observer      | CYCLE_COMPLETE   | `testsGreen`, `ciGatesGreen`, `dodSatisfiedPartial`              |
| T037 | VALIDATION.Transmettre    | RELEASE.Observer         | CYCLE_COMPLETE   | `dodSatisfiedFull`, `humanValidationObtained`; + `rollbackPlanTested` if É/C |
| T044 | RELEASE.Transmettre       | RUN.Observer             | CYCLE_COMPLETE   | `smokeTestsGreen`, `sloStable`                                   |
| T051 | RUN.Transmettre           | APPRENTISSAGE.Observer   | CYCLE_COMPLETE   | —                                                                 |
| T058 | APPRENTISSAGE.Transmettre | IDLE                     | CYCLE_COMPLETE   | —                                                                 |

### 3.2 Micro-FSM sub-phase progression (within each active cycle)

Same pattern for all 8 cycles. Listed generically as `CYCLE.*`:

| ID    | From             | To               | Event             | Guards                                    |
|-------|------------------|------------------|-------------------|-------------------------------------------|
| S001  | CYCLE.Observer   | CYCLE.Définir    | SUBSTEP_COMPLETE  | `substepOutputExists`                     |
| S002  | CYCLE.Définir    | CYCLE.Concevoir  | SUBSTEP_COMPLETE  | `substepOutputExists`, `riskClassAssigned`|
| S003  | CYCLE.Concevoir  | CYCLE.Exécuter   | SUBSTEP_COMPLETE  | `substepOutputExists`; + `humanValidationObtained` if mode=pairing or É/C |
| S004  | CYCLE.Exécuter   | CYCLE.Vérifier   | SUBSTEP_COMPLETE  | `substepOutputExists`                     |
| S005  | CYCLE.Vérifier   | CYCLE.Capitaliser| SUBSTEP_COMPLETE  | `verifyVerdictEmitted`                    |
| S006  | CYCLE.Capitaliser| CYCLE.Transmettre| SUBSTEP_COMPLETE  | `substepOutputExists`                     |

### 3.3 Skip transitions (T/F only)

| ID    | From             | To               | Event         | Guards                                   |
|-------|------------------|------------------|---------------|------------------------------------------|
| SK001 | CYCLE.Observer   | CYCLE.Concevoir  | SUBSTEP_SKIP  | `riskClassIn(['T','F'])`, `skipAllowed`  |
| SK002 | CYCLE.Observer   | CYCLE.Exécuter   | SUBSTEP_SKIP  | `riskClassIn(['T'])`, `skipAllowed`      |

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
| R001 | VALIDATION.*  | BUILD.Vérifier     | DOD_FAIL          | —                         |
| R002 | RELEASE.*     | BUILD.Vérifier     | ROLLBACK_REQUEST  | `rollbackStateAvailable`  |

### 3.6 Mode transitions (orthogonal — from any non-ABORTED state)

| ID   | From | To           | Event            | Guards                                              |
|------|------|--------------|------------------|-----------------------------------------------------|
| M001 | ANY  | same + pairing | MODE_SET_PAIRING | —                                                  |
| M002 | ANY  | same + auto  | MODE_SET_AUTO    | —                                                   |
| M003 | ANY  | same + bypass| MODE_SET_BYPASS  | `bypassAllowed` (riskClass ∈ {T,F}) OR `humanOverrideRecorded` (riskClass=M only) |

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
| RC02 | ANY  | SUSPENDED → same | RISK_CLASS_PROMOTE | `promotionAcknowledgedByAgent`; + `humanValidationObtained` if new class É/C |

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
  ctx.evidence.some(e => e.gate === 'dod_satisfied' && e.source === 'ci');

export const dodSatisfiedFull = (ctx: HarnessMachineContext): boolean =>
  ctx.gatesPassed.includes('dod_satisfied') &&
  ctx.gatesPassed.includes('human_validation_obtained');

export const humanValidationObtained = (ctx: HarnessMachineContext): boolean =>
  ctx.gatesPassed.includes('human_validation_obtained');

export const humanApprovalRecorded = (ctx: HarnessMachineContext): boolean =>
  ctx.evidence.some(e => e.gate === 'human_validation_obtained' && e.source === 'human');

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
  ctx.macroState === 'CONCEPTION';

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
  ctx.riskClass !== null && ['T', 'F'].includes(ctx.riskClass);

// NEVER true for É or C — structural impossibility, not convention
export const bypassStructurallyImpossible = (ctx: HarnessMachineContext): boolean =>
  ctx.riskClass !== null && ['É', 'C'].includes(ctx.riskClass);

export const riskClassIn =
  (classes: RiskClass[]) =>
  (ctx: HarnessMachineContext): boolean =>
    ctx.riskClass !== null && classes.includes(ctx.riskClass);

export const humanRequiredForRiskClass = (ctx: HarnessMachineContext): boolean =>
  ctx.riskClass !== null && ['É', 'C'].includes(ctx.riskClass);

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
  ctx.lastStableState !== null && ctx.lastStableState.startsWith('BUILD');

export const dorCheckInitiated = (_ctx: HarnessMachineContext): boolean =>
  true; // always true at CYCLE_START — DoR check is the first action of Observer

export const humanOverrideRecorded = (ctx: HarnessMachineContext): boolean =>
  ctx.evidence.some(e => e.gate === 'human_validation_obtained' &&
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

/** Append one JSONL line to logs/state-transitions.jsonl */
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
    item: ctx.activeItemRef,
    notes: event.notes ?? null,
  };
  appendJsonl('.planning/logs/state-transitions.jsonl', entry);
};

// --- State persistence ---

/** Overwrite .planning/agent/current-state.yaml with current context snapshot */
export const persistState = (ctx: HarnessMachineContext): void => {
  writeYaml('.planning/agent/current-state.yaml', {
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

/** Emit HARNESS_SYNC to re-derive effective permissions from current state */
export const emitHarnessSync = (ctx: HarnessMachineContext): void => {
  syncBoundaries(ctx); // verifies boundaries.yaml coherence with §5.2 matrix
};

/** Write abort report artifact */
export const writeAbortReport = (ctx: HarnessMachineContext): void => {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  writeMarkdown(`.planning/agent/abort-report-${ts}.md`, {
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
│   │   ├── DISCOVERY             (compound sequential)
│   │   │   ├── Observer          (simple)
│   │   │   ├── Définir           (simple)
│   │   │   ├── Concevoir         (simple)
│   │   │   ├── Exécuter          (simple) ← territory code/ W ONLY here in BUILD
│   │   │   ├── Vérifier          (simple)
│   │   │   ├── Capitaliser       (simple)
│   │   │   └── Transmettre       (simple)
│   │   ├── CADRAGE               (same 7 sub-states)
│   │   ├── CONCEPTION            (same 7 sub-states)
│   │   ├── BUILD                 (same 7 sub-states — code/ W in Exécuter only)
│   │   ├── VALIDATION            (same 7 sub-states)
│   │   ├── RELEASE               (same 7 sub-states)
│   │   ├── RUN                   (same 7 sub-states)
│   │   └── APPRENTISSAGE         (same 7 sub-states)
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
│  │  [BUILD.Exécuter]   │  │  ERROR.RECOVERABLE           │  │
│  │  (frozen)           │  │  (active, resolving issue)   │  │
│  └─────────────────────┘  └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Final States

Mapping to RMS terminal states with triggering conditions and required artifacts.

| Final State              | Triggers                                                                | Required Artifact                               |
|--------------------------|-------------------------------------------------------------------------|-------------------------------------------------|
| `DONE_VERIFIED`          | `APPRENTISSAGE.Transmettre` + `CYCLE_COMPLETE` + `dodSatisfiedFull`     | `docs/` Transmettre artefact; DORA metrics updated |
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
  Observer:    { on: { SUBSTEP_COMPLETE: { target: 'Définir',    guard: 'substepOutputExists' },
                       SUBSTEP_SKIP:     { target: 'Concevoir',  guard: 'skipAllowed' } } },
  Définir:     { on: { SUBSTEP_COMPLETE: { target: 'Concevoir',  guard: 'riskClassAssigned' } } },
  Concevoir:   { on: { SUBSTEP_COMPLETE: { target: 'Exécuter',   guard: 'substepOutputExists' } } },
  Exécuter:    { on: { SUBSTEP_COMPLETE: { target: 'Vérifier',   guard: 'substepOutputExists' } } },
  Vérifier:    { on: { SUBSTEP_COMPLETE: { target: 'Capitaliser',guard: 'verifyVerdictEmitted' } } },
  Capitaliser: { on: { SUBSTEP_COMPLETE: { target: 'Transmettre',guard: 'substepOutputExists' } } },
  Transmettre: { type: 'final' as const },
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
          target: 'DISCOVERY',
          guard: 'dorSatisfied',
          actions: ['resetAttemptCount', 'logTransition', 'persistState'],
        },
      },
    },

    DISCOVERY: {
      initial: 'Observer',
      entry: [assign({ macroState: 'DISCOVERY', cycleStartedAt: () => new Date().toISOString() }), 'incrementStateVisitCount'],
      states: {
        ...subCycleStates,
      },
      onDone: {
        target: 'CADRAGE',
        guard: ({ context }) => guards.dorSatisfied(context) && guards.riskClassDefined(context),
        actions: ['logTransition', 'persistState'],
      },
    },

    CADRAGE: {
      initial: 'Observer',
      entry: [assign({ macroState: 'CADRAGE' }), 'incrementStateVisitCount'],
      states: { ...subCycleStates },
      onDone: {
        target: 'CONCEPTION',
        guard: ({ context }) => guards.dorSatisfied(context) && guards.visionValidated(context),
        actions: ['logTransition', 'persistState'],
      },
    },

    CONCEPTION: {
      initial: 'Observer',
      entry: [assign({ macroState: 'CONCEPTION' }), 'incrementStateVisitCount'],
      states: { ...subCycleStates },
      onDone: {
        target: 'BUILD',
        guard: ({ context }) => guards.adrSigned(context) && guards.dodConceptionSatisfied(context),
        actions: ['logTransition', 'persistState'],
      },
    },

    BUILD: {
      initial: 'Observer',
      entry: [assign({ macroState: 'BUILD' }), 'incrementStateVisitCount'],
      states: { ...subCycleStates },
      on: {
        DOD_FAIL: {
          // stay in BUILD — no-op; validation sends ROLLBACK_REQUEST
        },
      },
      onDone: {
        target: 'VALIDATION',
        guard: ({ context }) => guards.testsGreen(context) && guards.ciGatesGreen(context),
        actions: ['logTransition', 'persistState'],
      },
    },

    VALIDATION: {
      initial: 'Observer',
      entry: [assign({ macroState: 'VALIDATION' }), 'incrementStateVisitCount'],
      states: { ...subCycleStates },
      on: {
        DOD_FAIL: {
          target: 'BUILD.Vérifier',
          actions: ['snapshotLastStableState', 'logTransition', 'persistState'],
        },
      },
      onDone: {
        target: 'RELEASE',
        guard: ({ context }) =>
          guards.dodSatisfiedFull(context) && guards.humanValidationObtained(context),
        actions: ['logTransition', 'persistState'],
      },
    },

    RELEASE: {
      initial: 'Observer',
      entry: [assign({ macroState: 'RELEASE' }), 'incrementStateVisitCount'],
      states: { ...subCycleStates },
      on: {
        ROLLBACK_REQUEST: {
          target: 'BUILD.Vérifier',
          guard: 'rollbackStateAvailable',
          actions: ['snapshotLastStableState', 'logTransition', 'persistState'],
        },
      },
      onDone: {
        target: 'RUN',
        actions: ['logTransition', 'persistState'],
      },
    },

    RUN: {
      initial: 'Observer',
      entry: [assign({ macroState: 'RUN' }), 'incrementStateVisitCount'],
      states: { ...subCycleStates },
      onDone: {
        target: 'APPRENTISSAGE',
        actions: ['logTransition', 'persistState'],
      },
    },

    APPRENTISSAGE: {
      initial: 'Observer',
      entry: [assign({ macroState: 'APPRENTISSAGE' }), 'incrementStateVisitCount'],
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

### 9.1 Mapping to `.planning/state/state.yaml`

> D15 decision: YAML for state machine state (3–5 files max), JSONL append-only for logs.

```
.planning/
├── agent/
│   ├── current-state.yaml        ← primary state snapshot (overwritten on every transition)
│   ├── boundaries.yaml           ← territory permissions (human-only write)
│   └── abort-report-{ts}.md      ← written on every ABORTED entry
└── logs/
    └── state-transitions.jsonl   ← append-only, never truncated
```

### 9.2 `current-state.yaml` schema (authoritative)

```yaml
# .planning/agent/current-state.yaml
version: "1"
updated_at: "2026-05-03T14:32:00Z"   # ISO 8601
session_id: "sess_abc123"             # UUID

macro_state: "BUILD"                  # MacroState enum value
micro_state: "Exécuter"              # SubPhase enum value | null
mode: "auto"                          # pairing | auto | bypass
risk_class: "M"                       # T | F | M | É | C | null

active_item_ref: ".planning/02-backlog/items/PBI-042.md"
active_cycle_start: "2026-05-03T09:00:00Z"
gates_passed: ["dor_satisfied", "risk_class_defined"]
gates_pending: ["dod_satisfied", "human_validation_obtained"]

last_transition:
  from: "BUILD.Concevoir"
  to: "BUILD.Exécuter"
  event: "SUBSTEP_COMPLETE"
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
2. `current-state.yaml` is written atomically (write to `.tmp`, then rename).
3. `state-transitions.jsonl` is append-only — never truncate, never rewrite.
4. On `SESSION_START`, the harness reads `current-state.yaml` to restore context. If the file is absent or invalid, the machine starts in `IDLE`.
5. `boundaries.yaml` is never written by the machine — it is a human-controlled config file.
6. The XState `hist` pseudo-state handles deep history restoration; `lastStableState` in context provides the YAML-level equivalent for cross-session resume.

---

## 10. Open Questions Resolved

### Q2 — How to formalize the state machine

**Question (from Discovery §Q2)**: formal schema of states, transitions, conditions, authorized actions.

**Resolution**: This document is the answer. The formalization uses three layers:

1. **Conceptual** (this document — `docs/conception/01-state-machine-spec.md`): human-readable spec with TypeScript types, guard signatures, action signatures, and xstate skeleton. Source of truth for architectural decisions.

2. **Executable** (`.planning/agent/boundaries.yaml` + `current-state.yaml`): runtime YAML files derived from this spec. The machine reads `current-state.yaml` at every hook invocation and updates it atomically. `boundaries.yaml` encodes the territory permission matrix (§5.2 of `harness-state-machine.md`) as a static config.

3. **Log** (`logs/state-transitions.jsonl`): append-only event sourcing log. The full state history can be reconstructed from this log alone — the machine is a pure event-sourced system.

**Consequence of inaction (resolved)**: the harness was a black box. With this spec, any agent or developer can determine from the current state exactly what writes are authorized, what guards must be satisfied before any transition, and what the complete event history was for any session.

---

### Q7 — Multi-state (parallel cycles)

**Question (from Discovery §Q7)**: how to transition from strict mono-state to multi-state where each PBI/sprint/release has its own state?

**Resolution**: the current spec implements strict mono-state (one active `MacroCycle` at a time). The path to multi-state is defined as follows:

**Precondition**: the mono-state machine must complete at least 2 full cycles without ABORTED or MAX_ATTEMPTS_REACHED. This validates the core semantics before increasing complexity.

**Migration path** (when ready):
1. Replace the single `HarnessMachineContext` with a `Map<itemId, HarnessMachineContext>` — each PBI gets its own machine instance.
2. The `ActiveCycle` compound state becomes a parallel state with N orthogonal regions — one per active item.
3. The territory permission matrix (§5.2) must be extended: if two active items both target `BUILD.Exécuter`, the `code/` territory requires a per-item scope (e.g. file-path prefix) to prevent overlap.
4. `current-state.yaml` becomes `current-state/{itemId}.yaml` (one file per active machine).
5. `state-transitions.jsonl` gains an `item_id` field (already included in the log schema above).

**Why deferred**: the territory conflict resolution for parallel builds (two agents writing to overlapping files) requires the worktree isolation strategy (per `rules/agents.md`). That infrastructure must be validated before multi-state is safe.

---

*Spec ready for implementation. Next step: `packages/core/src/state-machine/` scaffold — create `types.ts`, `guards.ts`, `actions.ts`, `machine.ts` from the skeletons above.*
