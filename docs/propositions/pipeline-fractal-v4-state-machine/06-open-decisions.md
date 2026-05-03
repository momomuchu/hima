# 06 - Open Decisions

Status: draft decision register

## Purpose

This document lists the decisions that must be closed before the Pipeline
Fractale V4 state machine can move from design proposal to executable registry.

Each decision keeps the same shape:

```text
Decision ID
Question
Why it matters
Options
Recommended default
Blocking level
Dependencies
```

## Blocking Levels

| Level | Meaning |
|---|---|
| `P0` | Blocks executable state machine implementation. |
| `P1` | Blocks reliable guard, evidence, or runtime enforcement. |
| `P2` | Blocks documentation consistency or operator usability, but not the first implementation. |

## Decision Register

### PFV4-OD-001 - Cycle Substate Cardinality

**Question**: Must every macro-cycle expose exactly seven primary substates, or may each cycle define a variable number of semantic substates?

**Why it matters**: The V2 proposal rejects storing the generic fractal steps as substates. A fixed count keeps visual symmetry, but can force artificial states. A variable count preserves semantic accuracy, but requires stronger validation that every substate maps to one primary derived fractal lens.

**Options**:

| Option | Description | Tradeoff |
|---|---|---|
| A | Exactly seven primary substates per macro-cycle. | Simple to render and compare, but risks recreating `BUILD.Observer`-style generic states. |
| B | Variable semantic substates, each mapped to one primary lens by registry. | Matches `02-cycle-specific-substates.md`, but needs registry validation. |
| C | Variable substates plus required coverage of all seven lenses per macro-cycle. | Preserves semantic states and lens completeness, but may still create filler states. |

**Recommended default**: Option B. Keep substates semantic and require every active substate to map to one primary lens; allow missing lenses only outside an active harness machine.

**Blocking level**: `P0`

**Dependencies**: `02-cycle-specific-substates.md`; `harness-state-machine.md` RED CARD 5 on formal DoR/DoD; transition catalog work.

### PFV4-OD-002 - Internal Transition Topology

**Question**: Are internal substate transitions strictly linear inside each macro-cycle, or may they loop and jump locally?

**Why it matters**: A strict line is easier to audit, but real runs need rework paths such as `validation.defect_triage -> build.slice_plan` and local returns after failed evidence. Without a topology decision, convergence and loop detection cannot be made deterministic.

**Options**:

| Option | Description | Tradeoff |
|---|---|---|
| A | Strict linear progression only. | Simple but unrealistic for validation, release, and incident flows. |
| B | Directed graph with explicit allowed transitions. | Practical and auditable, but requires a transition registry. |
| C | Free transitions if guards pass. | Flexible but weakens diagnosis and loop detection. |

**Recommended default**: Option B. Define an explicit directed transition graph per macro-cycle, with rework edges named and guarded.

**Blocking level**: `P0`

**Dependencies**: `02-cycle-specific-substates.md`; `04-guard-matrix.md`; convergence model; `harness-state-machine.md` RED CARD 5.

### PFV4-OD-003 - Non-Development Run Representation

**Question**: Which non-development runs may use a derived fractal lens without activating the full pipeline?

**Why it matters**: `01-state-model.md` allows runs such as `conversation`, `research`, `architecture`, and `planning` to remain `pipeline_activation=inactive` while still using a lens for reasoning. If this boundary is vague, ordinary analysis could accidentally enter development governance, or development work could stay outside the harness.

**Options**:

| Option | Description | Tradeoff |
|---|---|---|
| A | Non-development runs never use a derived lens. | Clean separation, but loses the common reasoning grammar. |
| B | Non-development runs may use a derived lens in `derived_view`, while `harness_machine.status=NOT_ACTIVE`. | Matches V2 state object; needs activation guards. |
| C | Any run with a lens becomes `pipeline_activation=candidate`. | Easier to capture work, but over-activates casual analysis. |

**Recommended default**: Option B. Permit `derived_view.primary_lens` for non-development work, but enforce `pipeline_activation=inactive -> harness_machine.status=NOT_ACTIVE`; no `macro_cycle` or `cycle_substate` is interpreted while the harness machine is inactive.

**Blocking level**: `P0`

**Dependencies**: `01-state-model.md` invariants; `03-meta-states-and-modes.md`; pipeline activation decision PFV4-OD-004.

### PFV4-OD-004 - Pipeline Activation Gate

**Question**: What exact event and guard set moves a run from `candidate` to `armed`, then from `armed` to `active`?

**Why it matters**: Development mode is not a supervision mode. The proposal needs a deterministic activation gate so that the RMS knows when macro-cycle and substate fields become mandatory.

**Options**:

| Option | Description | Tradeoff |
|---|---|---|
| A | Human command activates the pipeline. | Clear authority, but creates friction and inconsistent capture. |
| B | RMS activates when Intent, Policy, Capability, Route, and Risk are ready. | Automatable and auditable, but depends on formal artifacts. |
| C | Any write task activates the pipeline immediately. | Safe for code writes, but too broad for docs/design work. |

**Recommended default**: Option B. Transition `candidate -> armed` only when Intent Set, Policy Set, Capability Set, Route, and initial risk class exist. Transition `armed -> active` only on `CYCLE_START` with a target macro-cycle.

**Blocking level**: `P0`

**Dependencies**: `01-state-model.md`; `03-meta-states-and-modes.md`; `04-guard-matrix.md` macro transition guards; risk RED-01.

### PFV4-OD-005 - Risk And Supervision Guard Matrix Canonicalization

**Question**: Which risk/mode combinations are structurally allowed, warned, blocked, or escalated?

**Why it matters**: The transversal documents agree that bypass is allowed for `T`, conditional for `F`, and forbidden for `E/C`; they are stricter or less explicit around `M` and `C` auto-decision. The executable matrix must remove ambiguity.

**Options**:

| Option | Description | Tradeoff |
|---|---|---|
| A | Use the risk-classification mapping as canonical. | Richest risk detail, but uses the French accented high-risk class and broader prose. |
| B | Use the V2 guard matrix as canonical. | Already aligned with state object, but less detailed on F bypass conditions. |
| C | Create a normalized executable overlay from both references. | Best implementation surface, but requires one more registry artifact. |

**Recommended default**: Option C. Canonical registry should use ASCII classes `T/F/M/E/C`, map the French accented high-risk class to `E`, and enforce: bypass allowed for `T`, conditional for `F`, blocked for `M`, forbidden for `E/C`; `C` forbids autonomous auto-decision and requires pairing or an explicit human checkpoint before any critical transition.

**Blocking level**: `P0`

**Dependencies**: `04-guard-matrix.md`; `risk-classification.md` RED-04; `harness-state-machine.md` founding decision on bypass; PFV4-OD-011.

### PFV4-OD-006 - Risk Classification Mechanization

**Question**: What deterministic mechanism assigns and promotes `risk_class`?

**Why it matters**: Guards, evidence depth, bypass, human checkpoints, and convergence sampling all depend on risk. A subjective class invalidates every derived guard.

**Options**:

| Option | Description | Tradeoff |
|---|---|---|
| A | Manual developer classification only. | Simple, but not deterministic and weak against rubber-stamping. |
| B | Agent proposes, human validates, forcing signals override the proposal. | Balances automation and control. |
| C | Fully automatic classifier from diff, labels, and registries. | Strongest consistency, but requires implementation maturity. |

**Recommended default**: Option B for V4 initial implementation, with an explicit path to C after registry tests exist. Forcing signals from `risk-classification.md` must set class minima.

**Blocking level**: `P0`

**Dependencies**: `risk-classification.md` RED-01 and RED-02; `harness-state-machine.md` RED CARD 1; `04-guard-matrix.md` risk overlay.

### PFV4-OD-007 - Convergence Model Thresholds

**Question**: What signals and thresholds decide `converging`, `flat`, `oscillating`, `diverging`, `verified`, `LOOP_DETECTED`, and `MAX_ATTEMPTS_REACHED`?

**Why it matters**: V2 states that max iterations are only a fuse, not the convergence model. Without concrete thresholds, the machine cannot tell productive rework from an infinite loop.

**Options**:

| Option | Description | Tradeoff |
|---|---|---|
| A | Use max attempts only. | Easy to implement, but explicitly rejected by V2. |
| B | Score-based convergence with progress events, stalled samples, and divergence signals. | Matches `01-state-model.md` and `03-meta-states-and-modes.md`; needs thresholds. |
| C | Human-only convergence judgment. | Flexible, but not executable and weak for bypass/auto modes. |

**Recommended default**: Option B. Define convergence as a scored region with named progress events, stale sample windows, repeated-state pattern detection, and risk-adjusted sampling frequency.

**Blocking level**: `P0`

**Dependencies**: `05-convergence-model.md`; `01-state-model.md` convergence object; `03-meta-states-and-modes.md` derived convergence status; `04-guard-matrix.md` convergence overlay.

### PFV4-OD-008 - Evidence Status Semantics

**Question**: What precise rules move the derived evidence status between `missing`, `partial`, `sufficient`, `with_gaps`, `verified`, `stale`, and `conflicted`?

**Why it matters**: `DONE_VERIFIED` requires `verified`; `DONE_WITH_GAPS` may use `with_gaps`; `stale` and `conflicted` should block or reroute. If the statuses are only labels, final states are not trustworthy.

**Options**:

| Option | Description | Tradeoff |
|---|---|---|
| A | Evidence status is manually declared. | Low implementation cost, but weak stop gates. |
| B | Evidence status is derived from required evidence per risk, cycle, and final candidate. | Auditable and compatible with guards, but needs schemas. |
| C | Evidence status is per artifact only, never global. | Granular, but harder for final state decisions. |

**Recommended default**: Option B. Derive `derived_view.evidence_status` from an Evidence Set that records required proofs, observed proofs, freshness, conflicts, and accepted gaps. Do not store an independently editable `meta_regions.evidence`.

**Blocking level**: `P0`

**Dependencies**: `01-state-model.md` derived view; `03-meta-states-and-modes.md` derived evidence status; `04-guard-matrix.md` evidence overlay; `harness-state-machine.md` RED CARD 5.

### PFV4-OD-009 - Runtime Degradation Policy

**Question**: When may a missing runtime primitive degrade to a fallback route instead of blocking?

**Why it matters**: V2 introduces runtime meta-region values such as `capability_unknown`, `capability_degraded`, `runtime_missing`, and `tool_failed`. The guard matrix says missing hooks may warn for `T/F` but block for `M+` if enforcement is needed. This needs one enforceable rule.

**Options**:

| Option | Description | Tradeoff |
|---|---|---|
| A | Any missing primitive blocks. | Safest, but brittle across Codex, Claude, and other runtimes. |
| B | Fallback allowed only when declared in Capability/Binding sets and risk policy permits it. | Practical and traceable. |
| C | Runtime chooses best effort automatically. | Flexible, but unsafe for guard enforcement. |

**Recommended default**: Option B. `capability_unknown` blocks until discovery; `runtime_missing` blocks; `capability_degraded` may continue only with a declared fallback, route degradation evidence, and risk/mode allowance. For `M+`, enforcement primitives cannot silently downgrade.

**Blocking level**: `P1`

**Dependencies**: `03-meta-states-and-modes.md` runtime region; `04-guard-matrix.md` runtime overlay; runtime sets/bindings proposal; `harness-state-machine.md` RED CARD 3.

### PFV4-OD-010 - Declarative Guard Registry Location

**Question**: Where are base guards and overlays stored for executable evaluation?

**Why it matters**: `04-guard-matrix.md` proposes declarative files such as `.rms/registry/guards.yaml`. Until the registry boundary exists, guards remain prose and cannot be tested deterministically.

**Options**:

| Option | Description | Tradeoff |
|---|---|---|
| A | Keep guards only in Markdown. | Good for discussion, not executable. |
| B | Single `guards.yaml` file. | Simple start, but may become monolithic. |
| C | Split registry: base guards, risk overlays, mode overlays, runtime overlays, territory overlays, evidence overlays. | More files, but clean ownership and testability. |

**Recommended default**: Option C, with a generated or validated merged view used by the RMS.

**Blocking level**: `P1`

**Dependencies**: `04-guard-matrix.md` Open Point; `harness-state-machine.md` RED CARD 3 and RED CARD 5.

### PFV4-OD-011 - English And ASCII Canonicalization

**Question**: Which language and character set are canonical for executable state values, events, guards, and documentation?

**Why it matters**: Existing transversal docs use French terms and an accented high-risk class; V2 state values use English/ASCII such as `BUILD`, `EXECUTE`, `auto_decision`, and `E`. Implementation needs one stable canonical vocabulary while preserving readable French source material.

**Options**:

| Option | Description | Tradeoff |
|---|---|---|
| A | French canonical vocabulary, including accented values. | Matches older docs, but increases implementation and cross-runtime friction. |
| B | English ASCII canonical values, French labels allowed as display aliases. | Best for code, registries, logs, and multi-runtime use. |
| C | Mixed language values by document origin. | Avoids migration now, but guarantees drift. |

**Recommended default**: Option B. All executable state, event, guard, risk, mode, evidence, and final-state identifiers should be English ASCII. French terms remain accepted as prose labels or migration aliases only.

**Blocking level**: `P1`

**Dependencies**: `01-state-model.md`; `02-cycle-specific-substates.md`; `harness-state-machine.md` uses accented French risk and substep terms; `risk-classification.md`; registry schema.

### PFV4-OD-012 - Territory Enforcement Scope

**Question**: Which enforcement layer is authoritative for territory writes: declarative boundaries, runtime hooks, post-run audit, or all of them?

**Why it matters**: The transversal state-machine RED CARD 3 says declarative permission is insufficient. V2 guard evaluation includes `territory_overlay(path/tool/action)`, but the actual enforcement path must be chosen before implementation.

**Options**:

| Option | Description | Tradeoff |
|---|---|---|
| A | Declarative boundaries only. | Easy to document, but not effective enforcement. |
| B | Runtime hook enforcement before writes. | Strong when hooks exist, but runtime-specific. |
| C | Layered enforcement: declarative registry, runtime hooks when available, post-run audit fallback, and risk-based blocking when fallback is too weak. | Strongest and compatible with runtime degradation policy. |

**Recommended default**: Option C. The registry is the source of truth, runtime hooks enforce when available, and post-run audit is only acceptable for low-risk cases where policy allows degraded enforcement.

**Blocking level**: `P0`

**Dependencies**: `harness-state-machine.md` RED CARD 3; `04-guard-matrix.md` territory and runtime overlays; PFV4-OD-009.

### PFV4-OD-013 - Final State And Closing Protocol

**Question**: What exact protocol moves `pipeline_activation` from `active` to `closing` to `closed`, and chooses the final state?

**Why it matters**: Final states are not macro-cycles. A run can only close when evidence, convergence, and policy gates agree. Without a closing protocol, `DONE_VERIFIED`, `DONE_WITH_GAPS`, and blocked states may be asserted inconsistently.

**Options**:

| Option | Description | Tradeoff |
|---|---|---|
| A | Final state chosen directly by the agent. | Fast, but weak evidence guarantees. |
| B | Final state candidate enters `closing`; stop gate validates evidence, convergence, and unresolved blockers. | Matches V2 activation and evidence design. |
| C | Human always chooses final state. | Strong oversight, but too much friction for T/F. |

**Recommended default**: Option B. Require a final-state candidate, Evidence Set evaluation, convergence verdict, policy/runtime blocker check, and append-only closing event before `closed`.

**Blocking level**: `P0`

**Dependencies**: `01-state-model.md` final states and invariants; `03-meta-states-and-modes.md` activation states; `04-guard-matrix.md` evidence overlay; PFV4-OD-007 and PFV4-OD-008.

## Implementation Readiness Summary

The first executable implementation is blocked until these decisions are closed:

- PFV4-OD-001: cycle substate cardinality
- PFV4-OD-002: internal transition topology
- PFV4-OD-003: non-development run representation
- PFV4-OD-004: pipeline activation gate
- PFV4-OD-005: risk and supervision guard matrix canonicalization
- PFV4-OD-006: risk classification mechanization
- PFV4-OD-007: convergence model thresholds
- PFV4-OD-008: evidence status semantics
- PFV4-OD-012: territory enforcement scope
- PFV4-OD-013: final state and closing protocol

The following decisions can be closed during or just before implementation, but
should not be left implicit:

- PFV4-OD-009: runtime degradation policy
- PFV4-OD-010: declarative guard registry location
- PFV4-OD-011: English and ASCII canonicalization
