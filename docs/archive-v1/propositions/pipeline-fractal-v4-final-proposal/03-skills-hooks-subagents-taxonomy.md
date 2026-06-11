# 03 - Skills, Hooks, And Subagents Taxonomy

Status: final proposal candidate, Sprint 23 vocabulary correction

## Purpose

Pipeline Fractale V4 has exactly three runtime-facing artifact families:

1. **Skills**: reusable procedures invoked by the agent or user.
2. **Hooks**: runtime enforcement, capability proof, and context-injection
   surfaces bound to canonical gates.
3. **Subagents**: bounded workers that produce evidence candidates or review
   results.

Documentation, manuals, runbooks, playbooks, ADRs, generated reference views,
and learning notes are not runtime artifact families. They may inform humans or
be imported as candidate evidence, but they are not installable runtime
artifacts and never become an alternate state machine.

```text
Skills = procedures
Hooks = runtime enforcement and capability proof
Subagents = isolated workers
Reference docs = explanatory input, never runtime authority
MCP/state kernel = authority for state, guards, events, and evidence
```

## Design Constraints From V4

- The active state is `RunEnvelope + HarnessMachineState + DerivedView`.
- `macro_cycle`, `cycle_substate`, and derived fractal lens are separate.
- The lens is derived from the substate registry; it is not directly edited.
- Evidence Set and Convergence Set are authoritative; derived statuses are
  views.
- Every transition changing activation, macro-cycle, substate, risk,
  supervision mode, or final state must append an event.
- Runtime Capability Set and Runtime Binding Set decide which skills, hooks,
  subagents, and MCP servers can be used.
- Skills and subagents can propose state changes; only the state kernel commits
  them after guard evaluation.
- Hooks can block, warn, inject context, or collect evidence only when their
  Binding Set proves the runtime can enforce that gate.

## Authority Model

| Artifact | May read state? | May write state? | May append evidence? | May decide final state? |
|---|---:|---:|---:|---:|
| Skill | Yes, through MCP or declared fallback | No direct write; requests transitions | Through MCP evidence API only | No; requests final candidate |
| Hook | Yes, through canonical hook runner | No direct write; returns gate decision to kernel | Can produce hook-decision evidence through kernel | No |
| Subagent | Snapshot only | No | Returns evidence candidate to parent/kernel | No |
| Reference doc/manual/runbook/playbook | Read-only input | No | No; can become candidate evidence after import | No |
| MCP/state kernel | Yes | Yes | Yes | Yes, after guards |

### State Kernel Surface

The canonical MCP/state kernel should expose a small command vocabulary:

| Kernel operation | Purpose |
|---|---|
| `get_run_state(run_id)` | Return current RunEnvelope, HarnessMachineState, DerivedView, and convergence summary. |
| `evaluate_guard(request)` | Evaluate base, risk, supervision, runtime, territory, evidence, and convergence overlays. |
| `request_transition(event)` | Validate and commit a state transition with append-only event emission. |
| `append_evidence(item)` | Validate and append an Evidence Set item. |
| `sample_convergence(signal)` | Add a convergence sample and recompute derived convergence status. |
| `open_checkpoint(reason)` | Move human meta-region to checkpoint-required/waiting-user when policy demands it. |
| `propose_final_state(candidate)` | Enter `closing` only if evidence and convergence make the candidate evaluable. |

If MCP is unavailable, a runtime may use a declared local transaction fallback
against `.planning/`, but the same kernel rules still apply. The fallback must
be traced as runtime degradation and cannot silently satisfy M/H/C enforcement
gaps.

## Skills Taxonomy

Skills are short, reusable workflows. They should be portable across Claude,
Codex, and Hermes as `SKILL.md` artifacts, with platform-specific installation
handled by Runtime Binding Sets.

### Core MVP Skills

| Skill | Purpose | Invoked when | Inputs | Outputs | Authority boundary | State kernel relation |
|---|---|---|---|---|---|---|
| `pfv4-intake` | Capture user intent and decide whether the pipeline is inactive, candidate, or already armed. | `user_prompt` gate or explicit operator command. | Raw prompt, cwd, Project Set, active run if any. | Intent draft, run_kind, activation recommendation, ambiguities. | Cannot arm pipeline directly. | Calls `request_transition(PIPELINE_CANDIDATE)` only if guard allows. |
| `pfv4-risk-classify` | Assign and promote T/L/M/H/C risk. | Before `candidate -> armed`, before writes, and on force signals. | Intent Set, target paths, diff summary if available, policy registry. | Risk decision, promotion rationale, forced minima. | Cannot downgrade risk during a run. | Requests `RISK_CLASS_SET` or `RISK_CLASS_PROMOTE`; kernel commits. |
| `pfv4-route` | Build the Route Set from intent, risk, policy, capabilities, and bindings. | `candidate -> armed` preparation. | Project, Intent, Capability, Binding, Policy Sets. | Route Set candidate, selected supervision mode, required gates, required skills/subagents/MCP. | Cannot activate a cycle itself. | Kernel validates route before `PIPELINE_ARM`. |
| `pfv4-transition` | Request substate or macro-cycle transitions by semantic event. | At substate completion, macro handoff, rework, suspend, resume, or close. | Current state, transition ID, produced evidence refs. | Transition request with reason and evidence refs. | Cannot bypass guard matrix. | Calls `evaluate_guard`, then `request_transition`. |
| `pfv4-evidence` | Normalize tool output, diff summaries, reviews, screenshots, and subagent results into Evidence Set items. | `post_tool`, `subagent_stop`, validation, stop gate. | Tool result, command output, file list, reviewer result. | Typed evidence item or rejected evidence with reason. | Cannot mark global evidence `verified`. | Calls `append_evidence`; kernel recomputes derived evidence status. |
| `pfv4-stop-gate` | Decide whether a final candidate is allowed, downgraded, or blocked. | Runtime `stop` gate or explicit finalization command. | Run Set, Evidence Set, Convergence Set, Policy Set. | Final-state candidate: `DONE_VERIFIED`, `DONE_WITH_GAPS`, or blocked state. | Cannot self-assert completion. | Calls `propose_final_state`; kernel commits `FINAL_COMMIT` only after guards. |
| `pfv4-runtime-probe` | Detect runtime capabilities, bindings, hook availability, MCP health, and limitations. | Session start or install/doctor command. | Runtime environment, config files, available tools/MCP. | Runtime Capability Set candidate and degradation notes. | Cannot pretend unsupported gates are enforceable. | Kernel stores capability snapshot and uses it in runtime overlay. |
| `pfv4-loop-recover` | Diagnose flat, oscillating, or diverging convergence and propose a reroute. | Convergence samples indicate stagnation, oscillation, divergence, or max attempts. | Convergence Set, events, defects, current substate. | Recovery hypothesis, reroute proposal, checkpoint recommendation. | Cannot repeat same failed fix without new hypothesis. | Calls `sample_convergence`; may request rework transition or checkpoint. |

### Later Skills

| Skill | Purpose | Later expansion |
|---|---|---|
| `pfv4-install` | Install hooks, MCP, skills, subagents, and instructions for each runtime. | Multi-runtime profiles, dry-run diff, enterprise policy overlays. |
| `pfv4-doctor` | Validate registry, bindings, state invariants, and acceptance fixtures. | CI integration, auto-repair suggestions, compatibility reports. |
| `pfv4-visual-verify` | Collect visual evidence for UI work. | Browser automation, screenshot diff, accessibility artifact ingestion. |
| `pfv4-release-prepare` | Assemble release evidence, rollback readiness, SBOM, and approval packs. | Canary/SLO integration and artifact signing. |
| `pfv4-learning-capture` | Convert final run evidence into learning records and discovery seeds. | Pattern mining, policy calibration proposals, documentation update PRs. |
| `pfv4-human-checkpoint` | Format human checkpoint requests with exact decision, risk, and consequences. | Native approval UIs, signatures, audit-friendly validation logs. |

## Hooks Taxonomy

Hooks are runtime-bound gate implementations. They prove what the active runtime
can enforce before, during, or after a user/agent action. Hook decisions are
inputs to the kernel, not policy overrides.

### Core MVP Hooks

| Hook | Purpose | Canonical gates | Authority boundary | State kernel relation |
|---|---|---|---|---|
| `risk-classification` | Apply canonical risk taxonomy, rank ordering, forcing signals, and operating mode mapping. | `session_start`, `user_prompt`, `pre_tool` | Cannot downgrade risk or override policy. | Produces risk-related guard/evidence facts. |
| `state-machine` | Enforce canonical macro-cycle route, status, and guarded phase progression. | `session_start`, `post_tool`, `stop` | Cannot commit transitions directly. | Calls or feeds guard evaluation before transition requests. |
| `gate-policy` | Enforce lifecycle gate decisions, violation classes, and stop conditions. | All canonical gates | Cannot weaken risk, supervision, territory, or evidence overlays. | Returns allow/warn/block/context decisions for kernel handling. |
| `runtime-bindings` | Map platform hook capabilities to canonical `GateType` enforcement. | `session_start`, `user_prompt`, `pre_tool`, `stop` | Cannot claim missing capabilities. | Feeds Binding Set and runtime degradation decisions. |
| `platform-adapters` | Preserve Claude, Codex, and Hermes portability expectations. | All canonical gates | Cannot make platform-specific shortcuts canonical. | Normalizes platform payloads/responses around canonical hook events. |
| `convergence` | Detect iteration loops, stagnation, divergence, and transition readiness. | `post_tool`, `stop` | Cannot increase budget without policy. | Adds convergence samples and recovery signals. |
| `close-finalization` | Gate final-state selection, known gaps, residual risk, and completion evidence. | `stop` | Cannot fabricate completion. | Blocks or proposes final-state candidates through the kernel. |
| `evidence-management` | Capture accepted evidence keys, subagent output, gaps, and sufficiency checks. | `post_tool`, `stop`, `subagent_stop` | Cannot mark evidence verified without policy requirements. | Appends or rejects Evidence Set items through the kernel. |

## Subagents Taxonomy

Subagents are workers, not controllers. They should receive a frozen state
snapshot, explicit task, allowed files or read scope, evidence requirements, and
return schema. They must not mutate `.planning/` directly.

### Core MVP Subagents

| Subagent | Purpose | Invoked when | Inputs | Outputs | Authority boundary | State kernel relation |
|---|---|---|---|---|---|---|
| `state-invariant-reviewer` | Check state shape, no-null rule, substate ownership, and transition invariants. | Before implementation readiness, before `DONE_VERIFIED` for state-machine work. | State snapshot, registries, transition proposal. | Invariant verdict, violations, suggested correction. | Read-only reviewer. | Output becomes `review-verdict` evidence if accepted. |
| `risk-policy-reviewer` | Review risk class, force signals, bypass legality, and supervision mode. | Risk promotion, M/H/C work, bypass request, policy ambiguity. | Intent, paths/diff, Policy Set, risk decision. | Approve/block/promote recommendation. | Cannot set risk directly. | Kernel may commit risk transition after guard evaluation. |
| `route-architect` | Evaluate route quality across cycles, gates, skills, hooks, subagents, MCP, and runtime limits. | Before `PIPELINE_ARM` or reroute. | Intent, Capability, Binding, Policy, current state. | Route critique, selected route recommendation, rejected alternatives. | Advisory only. | Feeds Route Set candidate; kernel validates. |
| `evidence-auditor` | Determine whether evidence is present, fresh, relevant, independent, and decisive. | Stop gate, macro handoff, H/C review. | Evidence Set, required evidence matrix, run history. | Evidence status recommendation and missing items. | Cannot mark completion. | Kernel recomputes status; output can be evidence item. |
| `convergence-critic` | Detect stagnation, oscillation, divergence, and repeated failed strategies. | After failed checks, repeated rework, or low convergence score. | Events, convergence samples, defect deltas, current route. | Convergence verdict and reroute/checkpoint recommendation. | Cannot extend iteration budget. | Kernel records samples and applies convergence guard. |
| `runtime-binding-inspector` | Verify whether claimed runtime gates, MCP servers, hooks, and subagent capabilities are real. | Install, session start, runtime degraded, M+ enforcement questions. | Runtime config, Capability Set, Binding Set. | Capability mismatch list, degradation classification. | Cannot relax policy. | Feeds runtime overlay and `BLOCKED_RUNTIME_MISSING` decisions. |
| `security-safety-reviewer` | Review secrets, PII, auth, infra, destructive actions, and compliance triggers. | Safety meta-region signal or H/C risk. | Diff/paths, policies, threat model if present. | Safety verdict, forced risk signals, missing evidence. | Cannot approve destructive action alone. | Kernel may open checkpoint or promote risk. |

### Later Subagents

| Subagent | Purpose | Later expansion |
|---|---|---|
| `product-acceptance-reviewer` | Check acceptance criteria and user value evidence. | Product metrics, stakeholder simulation, UX research linkage. |
| `release-ops-reviewer` | Review rollback, canary, smoke, SLO, and incident readiness. | Live observability integrations and deployment system checks. |
| `learning-curator` | Extract reusable patterns from completed runs. | Documentation update proposals, policy calibration, trend reports. |
| `registry-linter` | Validate YAML/JSON registries and generated derived views. | Schema generation, registry diff risk scoring. |
| `cross-runtime-portability-reviewer` | Compare Claude/Codex/Hermes parity for skills, hooks, and subagents. | Runtime adapter contract tests and compatibility matrices. |

## Reference Documentation Boundary

Reference docs are useful, but they are not runtime artifacts. They include:

| Reference material | Valid purpose | Boundary |
|---|---|---|
| State/kernel manuals | Explain schemas, no-null rule, activation and final states. | Executable schemas and registries win. |
| Cycle playbooks | Explain macro-cycles, semantic substates, handoffs, and rework. | Cannot create new substates by prose. |
| Risk/policy docs | Explain T/L/M/H/C, bypass, supervision, and checkpoints. | Cannot weaken Policy Set. |
| Evidence/convergence docs | Explain proof quality, freshness, convergence, and stop rules. | Cannot authorize done. |
| Runtime binding docs | Explain Claude/Codex/Hermes capability semantics. | Cannot claim unavailable capability. |
| Operations runbooks | Explain release, incident, rollback, SLO, and postmortem procedures. | Operational evidence still goes through kernel intake. |
| Learning notes | Capture approved patterns, rejected patterns, and calibration notes. | Updates only after learning gate. |

## Invocation Matrix By Pipeline State

| State or event | Skills | Hooks | Subagents | Reference docs |
|---|---|---|---|---|
| `pipeline_activation=inactive` | `pfv4-intake` only if request may become a run | `session_start`, `user_prompt` when available | None by default | State/kernel and cycle playbook docs |
| `candidate -> armed` | `pfv4-risk-classify`, `pfv4-runtime-probe`, `pfv4-route` | risk, runtime, route and gate-policy hooks | `risk-policy-reviewer`, `route-architect`, `runtime-binding-inspector` if M+ or degraded | Risk/policy and runtime binding docs |
| `CYCLE_START` | `pfv4-transition` | state-machine hook | `state-invariant-reviewer` for registry/state-machine work | Cycle playbooks |
| Build write | `pfv4-evidence`, `pfv4-transition` | `pre_tool`, `post_tool` hooks | Security/risk reviewer if force signal appears | Risk/policy and evidence docs |
| Validation | `pfv4-evidence`, `pfv4-stop-gate` | evidence-management and close-finalization hooks | `evidence-auditor`, `product-acceptance-reviewer` later | Evidence/convergence docs |
| Runtime degraded | `pfv4-runtime-probe`, `pfv4-route` | runtime-bindings hook | `runtime-binding-inspector` | Runtime binding docs |
| Stagnation/oscillation | `pfv4-loop-recover` | convergence hook | `convergence-critic` | Evidence/convergence docs |
| Human checkpoint | `pfv4-human-checkpoint` later | gate-policy hook | `risk-policy-reviewer` or `security-safety-reviewer` | Checkpoint templates |
| Learning | `pfv4-learning-capture` later | evidence-management and convergence hooks | `learning-curator` later | Learning notes |

## MVP Cut

The MVP should ship only what proves the V4 control-plane thesis.

### Skills

1. `pfv4-intake`
2. `pfv4-risk-classify`
3. `pfv4-runtime-probe`
4. `pfv4-route`
5. `pfv4-transition`
6. `pfv4-evidence`
7. `pfv4-stop-gate`
8. `pfv4-loop-recover`

### Hooks

1. `risk-classification`
2. `state-machine`
3. `gate-policy`
4. `runtime-bindings`
5. `platform-adapters`
6. `convergence`
7. `close-finalization`
8. `evidence-management`

### Subagents

1. `risk-policy-reviewer`
2. `route-architect`
3. `evidence-auditor`
4. `convergence-critic`
5. `runtime-binding-inspector`
6. `state-invariant-reviewer`

### MVP Non-Goals

- Marketplace of skills.
- Autonomous documentation rewriting outside `APPRENTISSAGE`.
- Subagents that spawn subagents.
- Cross-repo orchestration.
- Runtime-specific advanced hooks beyond the canonical gate bindings.
- Semantic memory as an authority source.

## Expansion Path

After the MVP validates state transitions, guard evaluation, evidence capture,
and runtime degradation, expand in this order:

1. Add `pfv4-install` and `pfv4-doctor` for reliable deployment and registry
   validation.
2. Add release, operations, and visual verification skills once Build and
   Validation are stable.
3. Add `learning-curator` and generated learning docs after final records are
   trustworthy.
4. Add cross-runtime portability reviews once all adapters implement the same
   kernel-facing contract.
5. Add specialized security/compliance docs only after policy overlays are
   executable, not merely documented.

## Naming Rules

- Skills use `pfv4-<verb-or-workflow>` because they are procedures.
- Hooks use `<domain>` because they bind runtime capability to canonical gates.
- Subagents use `<domain>-<role>` because they are worker identities.
- Reference docs use ordinary documentation names and are not installable
  runtime artifact kinds.
- Executable state, event, guard, risk, mode, evidence, and final-state names
  remain English ASCII.
- French labels may appear as display aliases only.

## Key Decisions

- Runtime-facing artifact kinds are exactly `skill`, `hook`, and `subagent`.
- Skills do not own state. They call the MCP/state kernel.
- Hooks do not own policy. They provide runtime enforceability facts for the
  kernel.
- Subagents do not write `.planning/`. They return structured outputs that
  become evidence only after parent/kernel intake.
- Reference docs do not override registries. They explain, render, and teach
  executable contracts.
- Runtime degradation is visible. Missing hooks, MCP, or subagent support must
  affect guards and final-state eligibility.
- The smallest useful taxonomy is intentionally small: eight skills, eight
  hooks, and six subagents for MVP.

