# 06 - Integrated Final Proposal

Status: Cycle 01 integrated recommendation

## Verdict

The strongest architecture is Candidate C:

```text
Hybrid Event-Sourced RMS Kernel
+ one MCP state/control server
+ runtime adapters/hooks
+ portable skills
+ bounded subagents
+ durable reference docs
```

This is not a compromise by vagueness. It is a separation of authority:

- the RMS kernel owns truth;
- MCP exposes the kernel portably;
- runtime adapters enforce where each platform can actually enforce;
- skills guide procedures;
- subagents produce bounded evidence;
- reference docs preserve durable knowledge.

## Why Candidate C Wins

Candidate A is right that MCP is the best shared interface across Claude, Codex
and Hermes. It fails if MCP becomes the whole system and every local operation
depends on server availability.

Candidate B is right that skills/hooks feel natural in each runtime. It fails if
skills or runtime hooks become independent state authorities.

Candidate C takes the durable parts of both:

```text
local event-sourced kernel = authority
single MCP server          = portable state/control interface
runtime bindings          = enforcement translation
skills                    = procedural UX
subagents                 = isolated work
reference docs            = durable knowledge
```

## Final Shape

### 1. RMS Kernel

The RMS kernel is the real control plane. It owns:

- `RunEnvelope`;
- `HarnessMachineState`;
- append-only event log;
- Run Set snapshot;
- Intent, Policy, Route, Capability and Binding Sets;
- Evidence Set;
- Convergence Set;
- guard decision records;
- final-state commit.

The event log wins over snapshots. Derived views are validated projections, not
sources of truth.

### 2. Single MCP Server

The MCP server is the public state/control surface for the kernel.

It exposes tools like:

- `rms.start_run`;
- `rms.inspect_runtime`;
- `rms.bind_runtime`;
- `rms.classify_risk`;
- `rms.plan_route`;
- `rms.transition`;
- `rms.evaluate_guard`;
- `rms.record_evidence`;
- `rms.evaluate_convergence`;
- `rms.close_run`.

It exposes resources like:

- `rms://runs/{run_id}/state`;
- `rms://runs/{run_id}/events`;
- `rms://runs/{run_id}/evidence`;
- `rms://runtime/capabilities/{runtime}`;
- `rms://runtime/bindings/{runtime}`;
- `rms://registry/guards`;
- `rms://registry/transitions`.

There should be one MCP server externally because guard decisions need one
consistent read of state, policy, runtime capability, evidence and convergence.

### 3. Runtime Adapters

Runtime adapters bind the RMS to Claude, Codex, Hermes or later runtimes.

They own runtime-specific mechanics:

- hook names;
- permission model;
- sandbox facts;
- subagent limits;
- skill paths;
- MCP transport config;
- can-block vs audit-only behavior.

They do not own policy semantics. They report capability and binding facts to
the kernel.

### 4. Runtime Hooks

Runtime hooks are the executable policy boundary inside each coding runtime.
They may block, inject context, record observations, or request kernel
evaluation. They do not own policy semantics and do not mutate protected state
directly.

MVP hooks:

| Hook | Purpose |
|---|---|
| `risk-classification` | Classify or promote T/L/M/H/C risk before routing. |
| `state-machine` | Validate transitions against the canonical machine. |
| `gate-policy` | Enforce `session_start`, `user_prompt`, `pre_tool`, `post_tool`, `stop`, `subagent_start`, and `subagent_stop`. |
| `runtime-bindings` | Report runtime capability, degradation, and hard-gate support. |
| `platform-adapters` | Translate Codex, Claude, Hermes, and later runtime hook events. |
| `convergence` | Detect stagnation, oscillation, divergence, and insufficient evidence. |
| `close-finalization` | Guard final-state commits. |
| `evidence-management` | Normalize hook observations into kernel-mediated evidence events. |

### 5. Skills

Skills are reusable procedures. MVP skills:

| Skill | Purpose |
|---|---|
| `pfv4-intake` | Capture user intent and decide inactive/candidate/armed recommendation. |
| `pfv4-risk-classify` | Assign or promote T/L/M/H/C risk. |
| `pfv4-runtime-probe` | Detect runtime capabilities, bindings and degradation. |
| `pfv4-route` | Build Route Set candidate. |
| `pfv4-transition` | Request semantic state transitions. |
| `pfv4-evidence` | Normalize outputs into Evidence Set items. |
| `pfv4-stop-gate` | Evaluate final candidate readiness. |
| `pfv4-loop-recover` | Diagnose stagnation, oscillation and divergence. |

Skills may request transitions and append evidence through the kernel. They
never write state directly and never decide final state alone.

### 6. Subagents

Subagents are bounded evidence or review lanes. MVP subagents:

| Subagent | Purpose |
|---|---|
| `risk-policy-reviewer` | Review risk, bypass legality and supervision mode. |
| `route-architect` | Challenge Route Set quality. |
| `evidence-auditor` | Check evidence freshness, relevance, independence and decision power. |
| `convergence-critic` | Detect flat/oscillating/diverging loops. |
| `runtime-binding-inspector` | Verify claimed runtime gates and MCP/hook capabilities. |
| `state-invariant-reviewer` | Check no-null rule, substate ownership and transition invariants. |

Subagents do not mutate `.rms/`. Their outputs become evidence only after parent
or kernel intake.

### 7. Reference Docs

Reference docs are durable knowledge surfaces. MVP reference docs:

| Reference | Purpose |
|---|---|
| State Kernel Reference | Canonical state object, no-null rule, activation and final states. |
| Cycle Playbooks Reference | Macro-cycles, semantic substates, handoffs and rework. |
| Risk And Policy Reference | T/L/M/H/C, bypass, supervision and checkpoints. |
| Evidence And Convergence Reference | Required proof, evidence quality and convergence rules. |
| Runtime Bindings Reference | Claude/Codex/Hermes capability and binding semantics. |
| MCP And Tools Reference | Approved MCP/tool boundaries, secrets handling and fallback. |

Reference docs do not override registries. They explain and teach executable contracts.

## Edge-Case Policy

The final proposal must fail closed for:

- inactive artifacts used as authoritative pipeline evidence;
- long-lived Run treated as finished too early;
- critical risk under autonomous auto-decision;
- missing runtime hard gates;
- stale or conflicted evidence;
- subagent disagreement;
- skill/hook drift;
- MCP outage during governed transitions;
- repeated loops without a new hypothesis;
- ambiguous human checkpoint for H/C;
- late evidence after closure.

For T/L work, degraded operation may continue only if traced and never claimed as
`DONE_VERIFIED` without the required evidence.

For M/H/C work, missing enforceability blocks unless an explicit declared
fallback is policy-allowed and evidence-backed. For C, autonomous auto-decision
is not allowed.

## P0 Decisions Closed By This Cycle

| Decision | Cycle 01 resolution |
|---|---|
| Non-development representation | Inactive work uses `harness_machine.status=NOT_ACTIVE`; artifacts become `candidate_evidence` until imported by an active transition. |
| MCP role | One MCP server exposes the RMS kernel; internally modular, externally one authority. |
| Skills role | Skills are procedures and UX; no direct state writes or final-state authority. |
| Subagents role | Subagents are bounded workers; outputs become evidence only after intake. |
| Reference docs role | Reference docs are durable reference/teaching surfaces; registries and kernel remain authoritative. |
| Runtime degradation | Missing capability blocks until discovery; degraded route must be traced and risk-allowed; M/H/C cannot silently fail open. |

## P0 Decisions Still Open

These remain real blockers before implementation:

| Decision | Why still open |
|---|---|
| Registry split | Need concrete file/schema split for transitions, guards, policies, evidence requirements, runtime bindings and lens mapping. |
| Guard merge algorithm | Need deterministic ordering, conflict resolution and test fixtures for overlays. |
| Risk classifier mechanics | Need executable forcing signals and downgrade/promotion rules. |
| Evidence requirement schema | Need per-cycle/per-risk/per-final-state required proofs. |
| Convergence thresholds | Need initial sample windows, score caps and loop detection parameters. |
| Local kernel storage | Need choose layout: `.rms/runs/{id}/events.jsonl`, snapshots, registry versions, locks. |
| MCP outage fallback | Need exact transaction fallback rule for file/CLI mode. |
| Legacy spec supersession | Need ADR saying whether V2/final proposal supersedes `docs/conception/01-state-machine-spec.md`. |

## Implementation MVP

The first implementation should not start with every skill/hook/subagent.

Start with:

1. kernel schemas and append-only event log;
2. registry validation;
3. one local MCP server with read/write tools;
4. Codex runtime binding first, Claude/Hermes binding stubs next;
5. `risk-classification`, `state-machine`, `gate-policy`, `runtime-bindings`;
6. `pfv4-intake`, `pfv4-risk-classify`, `pfv4-runtime-probe`,
   `pfv4-route`, `pfv4-transition`, `pfv4-evidence`, `pfv4-stop-gate`;
7. `risk-policy-reviewer`, `evidence-auditor`,
   `runtime-binding-inspector`, `state-invariant-reviewer`;
8. State Kernel, Risk/Policy, Evidence/Convergence and Runtime Binding reference docs.

Add release/ops/learning expansion only after state transitions, guard
evaluation, evidence capture and degraded runtime handling are executable.

## Cycle 02 Backlog

Next cycle should not produce another philosophical proposal. It should produce
implementation-shaped contracts:

1. `.rms/` storage layout proposal.
2. registry file split and minimal schemas.
3. guard merge algorithm.
4. first MCP tool contract schema.
5. acceptance fixtures for edge cases in `02-edge-case-red-team.md`.
6. ADR that supersedes or reconciles the older implementation-ready FSM spec.

## Readiness Verdict

Cycle 01 converges on the architecture direction, but not on implementation
details.

```text
Architecture direction: converged
Implementation contract: not ready
Next useful cycle: registry/kernel/MCP contract design
```
