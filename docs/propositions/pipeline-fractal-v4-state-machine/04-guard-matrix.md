# 04 - Guard Matrix

Statut: draft de conception

## Probleme A Corriger

Les anciennes transitions utilisent des guards trop generiques:

```text
dorSatisfied
dodSatisfied
riskClassDefined
humanValidationObtained
```

Ces guards ne sont pas evaluables sans contexte.

Une DoR de Discovery T n'a rien a voir avec une DoR de Release C.

La V2 doit donc calculer les guards depuis une matrice:

```text
GuardDecision =
  base_guard(cycle, substate, transition)
  + risk_overlay(T/F/M/E/C)
  + supervision_overlay(pairing/auto_decision/bypass)
  + runtime_overlay(capabilities/bindings)
  + territory_overlay(path/tool/action)
  + evidence_overlay(required proofs)
  + convergence_overlay(progress/stall/divergence)
```

## Classes De Risque

| Code | Nom | Sens court |
|---|---|---|
| `T` | Trivial | Changement reversible, faible surface, preuve simple. |
| `F` | Faible | Changement isole, pas de donnees sensibles, peu de dependances. |
| `M` | Moyen | Impact utilisateur ou systeme reel, verification standard. |
| `E` | Eleve | Auth, PII, paiement, API publique, schema DB, infra prod, release risquee. |
| `C` | Critique | Donnees sensibles, refonte archi, multi-services, obligation reglementaire, rupture contrat. |

## Types De Guard

| Guard | Question |
|---|---|
| `entry_guard` | Peut-on entrer dans ce substate ? |
| `exit_guard` | Peut-on sortir de ce substate ? |
| `transition_guard` | Peut-on aller de A vers B ? |
| `territory_guard` | L'action touche-t-elle un territoire autorise ? |
| `runtime_guard` | Le runtime sait-il executer cette route ? |
| `evidence_guard` | Les preuves attendues existent-elles ? |
| `human_guard` | Faut-il un checkpoint humain ? |
| `convergence_guard` | Le run progresse-t-il suffisamment ? |

## Base Matrix - Macro Transitions

| From | To | Base guard | Evidence minimale |
|---|---|---|---|
| `IDLE` | `DISCOVERY` | Intent Set present | intent captured |
| `DISCOVERY` | `CADRAGE` | discovery verdict != no-go | discovery handoff |
| `CADRAGE` | `CONCEPTION` | DoR package valide | cadrage handoff |
| `CONCEPTION` | `BUILD` | route/design/gates definis | build handoff |
| `BUILD` | `VALIDATION` | change summary + build evidence | diff + command results |
| `VALIDATION` | `RELEASE` | validation verdict GO or GO_WITH_GAPS | validation report |
| `RELEASE` | `RUN` | release proof or explicit no-release reason | release/run handoff |
| `RUN_SAMPLE` | `APPRENTISSAGE` | operational sample captured; Run remains long-lived | run sample report |
| `APPRENTISSAGE` | `IDLE` | learning captured + final state decided | final record |

`RUN_SAMPLE` is intentional: Run is a long-lived operations cycle. A delivery
run can transmit a sample to Apprentissage without implying that operations are
complete.

## Risk Overlay Matrix

| Requirement | T | F | M | E | C |
|---|---:|---:|---:|---:|---:|
| risk class explicit | required | required | required | required + rationale | required + rationale |
| bypass | allowed | conditional | blocked by default | forbidden | forbidden |
| human checkpoint | none | none unless warning | recommended on ambiguity | required at critical gates | required |
| design artifact | optional | light | required if new behavior | ADR required | ADR + independent review |
| tests | existing or simple check | unit/integration relevant | integration + acceptance | e2e/security/perf relevant | full risk-based suite |
| rollback/feature flag | optional | recommended | recommended | required | required + tested |
| evidence depth | minimal | light | standard | reinforced | maximal |
| convergence sampling | final only | per cycle | per macro gate | per macro gate + risk event | frequent + human-visible |

## Supervision Overlay Matrix

| Guard concern | Pairing | Auto-decision | Bypass |
|---|---|---|---|
| substate exit | human ACK can be required often | autonomous unless policy says checkpoint | autonomous if T/F |
| macro transition | human can validate synchronously | gate validation required for M+ | only T/F and automatic gates |
| ambiguity | discuss immediately | agent resolves if low-risk, otherwise ask | block if ambiguity affects risk/scope |
| E/C | allowed with human visibility | checkpoint required | forbidden |
| final state | human can accept gaps explicitly | Evidence Set decides | Evidence Set decides, but only T/F |

## Runtime Overlay

| Runtime condition | Guard result |
|---|---|
| required primitive available | allow |
| primitive missing but fallback declared | warn + route_degraded |
| primitive missing and no fallback | block |
| hook unavailable but post-run check possible | warn for T/F, block for M+ if enforcement needed |
| sandbox/permission weaker than policy requires | block or require human override if M only |
| runtime capability unknown | block until capability discovery |

Runtime guards must inspect enforceability metadata, not only runtime name:

| Metadata | Meaning |
|---|---|
| `required_gate` | Abstract RMS gate needed by the action. |
| `binding_status` | `native`, `fallback`, `noop_traced`, `missing`. |
| `can_block` | Whether the runtime primitive can synchronously block. |
| `fallback_strategy` | Declared fallback when native binding is absent. |
| `fail_open_risk` | Whether hook/tool failure would allow unsafe continuation. |
| `trace_event` | Event that proves the binding decision was recorded. |

## Territory Overlay

Territory guards use:

```text
macro_cycle + cycle_substate + tool + target_path + action_type
```

Examples:

| Situation | Result |
|---|---|
| `build.implementation_slice` writes code/tests | allow if scope includes path |
| `discovery.problem_frame` writes code | block |
| `conception.gate_design` reads code | allow |
| `validation.test_execution` writes test report | allow |
| any state writes `boundaries.yaml` by agent | block |
| `suspended` writes anything except append audit | block |

## Evidence Overlay

| Final candidate | Required evidence |
|---|---|
| `DONE_VERIFIED` | Evidence Set satisfies risk class and all blocking gates pass. |
| `DONE_WITH_GAPS` | Evidence is sufficient to stop, but gaps are explicit, owned, and non-E/C residual. |
| `BLOCKED_NEEDS_USER` | blocker, attempted recovery, and exact human decision needed. |
| `BLOCKED_RUNTIME_MISSING` | capability missing, fallback attempted or rejected, required runtime named. |
| `BLOCKED_POLICY` | violated policy, reason, blocked action, required correction. |
| `LOOP_DETECTED` | repeated state pattern plus no convergence evidence. |

## Guard Decision Output

Every guard should return a structured decision.

```json
{
  "decision": "block",
  "gate": "territory_guard",
  "reason": "BUILD-only write attempted from discovery.problem_frame",
  "severity": "hard",
  "risk_class": "M",
  "runtime_binding": {
    "required_gate": "territory_guard",
    "binding_status": "native",
    "can_block": true,
    "fallback_strategy": "NOT_APPLICABLE",
    "fail_open_risk": false,
    "trace_event": "GATE_DECISION_RECORDED"
  },
  "required_action": "move to BUILD.implementation_slice or produce design artifact only",
  "evidence_required": ["state_transition_event", "blocked_tool_event"]
}
```

Allowed values:

```text
allow
warn
block
escalate
degrade
reroute
```

## Example 1 - Trivial Doc Fix

```text
run_kind=development
risk_class=T
supervision_mode=bypass
substate=build.implementation_slice
action=write docs typo
```

Result:

```text
allow
```

Required evidence:

- diff summary;
- no tests if docs-only, or explicit no-test reason;
- final stop gate.

## Example 2 - Auth Change

```text
risk_class initially M
file touched: auth/session.ts
```

Risk overlay forces:

```text
RISK_CLASS_PROMOTE -> E minimum
bypass forbidden
human checkpoint required
security evidence required
```

## Example 3 - Runtime Missing Hook

```text
runtime=codex
required gate=pre_tool enforcement
codex_hooks=false
risk_class=M
```

Result:

```text
block or reroute
```

For T/F, a wrapper or post-run check might be acceptable. For M+, enforcement
cannot be silently downgraded unless policy explicitly allows it.

## Open Point

The guard matrix should become declarative before implementation.

Candidate file:

```text
.rms/registry/guards.yaml
```

with separate overlays:

```text
.rms/registry/risk-overlays.yaml
.rms/registry/mode-overlays.yaml
.rms/registry/territory-overlays.yaml
```
