# 04 - Single MCP State Kernel

Status: final proposal draft

## Position

Pipeline Fractale V4 should expose one MCP server as the canonical RMS state and
control kernel.

The MCP kernel is not the agent, not the workflow skill layer, and not the
runtime hook implementation. It owns canonical state, append-only events, guard
decisions, runtime binding checks, evidence evaluation, and state projections.
Skills remain portable procedures, subagents remain isolated work lanes, hooks
remain runtime-native gates, and reference docs/docs remain durable operating knowledge.

This follows the RMS split already proposed:

```text
Runtime = executor
RMS = controller
Hooks = gates
Skills = procedures
Subagents = isolated workers
MCP = external tools and state/control interface
Evidence Set = source of done
```

## Why One MCP Server

Use one MCP server because guard evaluation needs a single consistent read of
Intent, Policy, Capability, Binding, Route, Run, Evidence, Convergence and
Registry state. Splitting these across many MCP servers creates distributed
authority exactly where the harness needs atomic decisions.

One server also fits the cross-runtime portability evidence: Claude, Codex and
Hermes all support MCP, while hooks, permissions, subagents and logs diverge
substantially by runtime. MCP is the strongest shared interface; runtime hooks
are not isomorphic and must remain behind Binding Set adapters.

```text
One MCP state/control kernel
Many runtime bindings
Many skills
Many subagents
Many reference docs
```

The server may be internally modular, but externally there should be one
authority for state reads, state transitions, guard decisions and evidence
status.

## State Sets Owned By The MCP Kernel

| Set | Ownership rule |
|---|---|
| Project Set | Read/write through controlled project-memory operations; no live run state. |
| Intent Set | Created per run; records scope, non-scope, risk, autonomy, deliverable and done criteria. |
| Runtime Capability Set | Produced by inspection where possible; blocks if unknown for required capabilities. |
| Runtime Binding Set | Maps abstract RMS concepts to concrete runtime primitives and fallback enforceability. |
| Policy Set | Canonical risk, supervision, guard, evidence, territory and closing policy. |
| Route Set | Executable decision record: mode, runtime, pipeline, gates, skills, subagents, MCP needs, rejected alternatives. |
| Run Set | Current projection of live execution; never replaces the append-only event log. |
| Evidence Set | Source of completion truth; required before `DONE_VERIFIED`. |
| Convergence Set | Progress, stalls, repeated patterns, divergence signals, thresholds and convergence verdict. |
| Registry Set | Versioned machine registries: cycles, substates, transitions, lens mappings, guards, overlays and final-state rules. |

The kernel may expose derived views, but derived values are not independently
editable. `primary_lens` is derived from `cycle_substate`; evidence status is
derived from Evidence Set; convergence status is derived from Convergence Set.

## MCP Tools

Minimum tool surface:

| Tool | Purpose |
|---|---|
| `rms.start_run` | Create run id, Intent Set, initial event and candidate/armed activation state. |
| `rms.inspect_runtime` | Produce or refresh Runtime Capability Set from current runtime facts. |
| `rms.bind_runtime` | Resolve Runtime Binding Set from abstract gates/tools/workers to runtime primitives. |
| `rms.classify_risk` | Assign or promote risk class using policy rules and forcing signals. |
| `rms.plan_route` | Create Route Set from Intent, Policy, Capability and Binding. |
| `rms.transition` | Request state transition; evaluates guards before commit. |
| `rms.evaluate_guard` | Return structured allow/warn/block/escalate/degrade/reroute decision without committing state. |
| `rms.record_event` | Append a typed event for runtime callbacks that cannot call richer tools. |
| `rms.record_evidence` | Add command/test/review/subagent/runtime proof into Evidence Set. |
| `rms.evaluate_evidence` | Derive evidence status and gaps for a phase or final-state candidate. |
| `rms.evaluate_convergence` | Update convergence score/status from event and evidence history. |
| `rms.close_run` | Move active -> closing -> closed after stop, evidence, convergence, runtime and policy gates pass. |
| `rms.get_state` | Return canonical state snapshot plus derived view. |
| `rms.get_events` | Return event-log slice by run id, cursor, type or time. |
| `rms.validate_registry` | Validate state/guard/transition registries before executable use. |
| `rms.check_territory` | Evaluate path/tool/action permission against current state and policy. |
| `rms.check_runtime_binding` | Decide whether a required primitive is native, fallback, `noop_traced` or missing. |

All mutating tools append an event before returning. If an event cannot be
appended, the mutation fails.

## MCP Resources

| Resource | Contents |
|---|---|
| `rms://runs/{run_id}/state` | Canonical run snapshot and derived view. |
| `rms://runs/{run_id}/events` | Append-only JSONL event stream. |
| `rms://runs/{run_id}/intent` | Intent Set. |
| `rms://runs/{run_id}/route` | Route Set. |
| `rms://runs/{run_id}/evidence` | Evidence Set and derived evidence status. |
| `rms://runs/{run_id}/convergence` | Convergence Set and verdict. |
| `rms://project` | Project Set. |
| `rms://runtime/capabilities/{runtime}` | Runtime Capability Set. |
| `rms://runtime/bindings/{runtime}` | Runtime Binding Set. |
| `rms://registry/guards` | Merged executable guard matrix. |
| `rms://registry/transitions` | Macro and substate transition graph. |
| `rms://registry/lenses` | Substate-to-fractal-lens mapping. |
| `rms://registry/policies` | Policy overlays by risk, supervision, runtime, territory and evidence. |

Resources are read surfaces. Mutations go through tools so that guards, events
and invariants are applied consistently.

## MCP Prompts

Prompts should be thin wrappers around state/control operations, not hidden
policy engines.

| Prompt | Purpose |
|---|---|
| `rms.prompt.triage` | Ask an agent to summarize intent signals before `rms.start_run` or `rms.classify_risk`. |
| `rms.prompt.route_explanation` | Produce a human-readable Route Set rationale from canonical data. |
| `rms.prompt.guard_failure` | Explain a block/escalate/degrade decision and required recovery. |
| `rms.prompt.evidence_gap` | Explain missing proof required for `DONE_VERIFIED` or `DONE_WITH_GAPS`. |
| `rms.prompt.closing_summary` | Produce final report from Events, Evidence and Final State. |

Prompts may format and explain. They must not be the source of truth for state
transitions.

## Operations

The kernel supports five operation classes:

| Class | Meaning |
|---|---|
| Capture | Create Intent, Capability, Binding, Policy and Route records. |
| Decide | Evaluate guards, territory, runtime bindings, risk, evidence and convergence. |
| Mutate | Transition state only through guarded tools. |
| Project | Expose derived views for agents/hooks without making projections authoritative. |
| Close | Choose final states only through stop/evidence/convergence/policy checks. |

No operation may write `pipeline_activation`, `macro_cycle`, `cycle_substate`,
`risk_class`, `supervision_mode` or `final_state` without an append-only event.

## Event Log

Each run has one append-only event log. Run Set is a projection over this log,
not a replacement.

Minimum event fields:

```json
{
  "event_id": "evt_...",
  "run_id": "run_...",
  "timestamp": "2026-05-03T00:00:00Z",
  "actor": "agent|hook|mcp|human|subagent|runtime",
  "event_type": "STATE_TRANSITION_REQUESTED",
  "state_before_ref": "hash_or_version",
  "state_after_ref": "hash_or_version",
  "decision_ref": "guard_decision_id",
  "evidence_refs": [],
  "runtime": "codex",
  "binding_status": "native",
  "severity": "info|warn|block|error",
  "payload": {}
}
```

Required event types include:

```text
RUN_STARTED
INTENT_CAPTURED
CAPABILITY_DISCOVERED
BINDING_RESOLVED
RISK_CLASSIFIED
ROUTE_PLANNED
GUARD_EVALUATED
STATE_TRANSITION_REQUESTED
STATE_TRANSITION_COMMITTED
STATE_TRANSITION_BLOCKED
TERRITORY_CHECKED
RUNTIME_BINDING_CHECKED
EVIDENCE_RECORDED
EVIDENCE_EVALUATED
CONVERGENCE_EVALUATED
DEGRADED_ROUTE_ACCEPTED
DEGRADED_ROUTE_REJECTED
FINAL_STATE_CANDIDATE
RUN_CLOSING
RUN_CLOSED
```

## Guard Evaluation

The kernel evaluates guards with the merged matrix:

```text
GuardDecision =
  base_guard(cycle, substate, transition)
  + risk_overlay(T/L/M/H/C)
  + supervision_overlay(pairing/auto_decision/bypass)
  + runtime_overlay(capabilities/bindings)
  + territory_overlay(path/tool/action)
  + evidence_overlay(required proofs)
  + convergence_overlay(progress/stall/divergence)
```

Every decision returns:

```json
{
  "decision": "allow|warn|block|escalate|degrade|reroute",
  "gate": "runtime_guard",
  "reason": "required pre_tool gate missing and no acceptable fallback",
  "severity": "hard",
  "risk_class": "M",
  "required_action": "reroute to runtime with blocking pre_tool gate or lower scope/risk",
  "evidence_required": ["guard_decision_event", "runtime_binding_check_event"]
}
```

Guard decisions are deterministic for the same inputs and registry version. If
required capability data is unknown, the result is block until discovery.

## Runtime Binding Checks

The kernel never assumes that a runtime name implies enforceability. It checks
binding metadata:

```text
required_gate
binding_status = native | fallback | noop_traced | missing
can_block
fallback_strategy
fail_open_risk
trace_event
```

Policy:

- `native` allows if policy and guard conditions pass.
- `fallback` allows only when the fallback is declared and risk/mode policy permits it.
- `noop_traced` is acceptable only for non-enforcement concerns or L-risk warnings.
- `missing` blocks unless the route can be changed before action.
- `capability_unknown` blocks until runtime discovery.
- for M/H/C work, enforcement primitives cannot silently degrade.

## Failure And Degraded Modes

| Condition | Result |
|---|---|
| Capability unknown | Block and request discovery. |
| Required primitive missing, no fallback | `BLOCKED_RUNTIME_MISSING`. |
| Hook unavailable, post-run audit possible | Warn for T/L if policy allows; block for M+ when enforcement is required. |
| Event append fails | Block mutation; state cannot advance. |
| Evidence stale/conflicted | Block `DONE_VERIFIED`; reroute or close with gaps only if allowed. |
| Repeated state pattern without progress | `LOOP_DETECTED` candidate. |
| Runtime tool failure | Record event, update runtime meta-region, reroute or block by policy. |
| Registry invalid | Block executable state-machine use. |
| MCP unavailable | Runtime may continue only outside governed pipeline; no `DONE_VERIFIED` from RMS. |

A degraded route must produce evidence: the missing primitive, selected
fallback, risk allowance, guard decision and remaining gap.

## What Must Stay Outside MCP

| Outside MCP | Reason |
|---|---|
| Runtime hooks | Hook mechanics differ across Claude, Codex and Hermes; Binding Set maps them. |
| Skills | Skills are portable procedures and workflow entrypoints, not canonical state owners. |
| Subagent execution | Subagents are isolated work lanes; only their outputs/events enter RMS state. |
| Long-form reference docs/manuals | Reference docs hold durable knowledge; the kernel references them but does not become documentation storage. |
| Shell execution | Runtime tools execute commands; MCP records decisions/evidence and may expose checks. |
| Secrets and credentials | Runtime-native auth stores remain authoritative; MCP stores references and redacted capability facts only. |
| Model/provider selection internals | Runtime and route policy choose bindings; MCP should not become a model broker unless represented as policy. |
| UI/dashboard | Dashboard reads resources/events; it does not own state. |
| External product/business systems | Integrate via separate tools or adapters; RMS records references and evidence. |

## MVP Boundary

The first implementation should include:

- one local MCP server exposing the tools/resources above;
- JSON schemas for all owned sets;
- append-only `events.jsonl` per run;
- declarative guard registry with risk, supervision, runtime, territory,
  evidence and convergence overlays;
- runtime binding registries for Codex, Claude and Hermes;
- evidence evaluation sufficient to distinguish `DONE_VERIFIED` from
  `DONE_WITH_GAPS`;
- closing protocol for `active -> closing -> closed`;
- tests for invariant violations, degraded routes, missing runtime primitives
  and final-state blocking.

## Design Consequence

The MCP kernel is the stateful RMS spine. It centralizes authority only where
central authority is required: state, events, guards, bindings, evidence,
convergence and final states.

Everything procedural, explanatory, runtime-specific, or work-producing stays
outside MCP and binds into it through events, tools, resources and evidence.
