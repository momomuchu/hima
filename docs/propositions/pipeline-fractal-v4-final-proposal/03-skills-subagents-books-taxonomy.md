# 03 - Skills, Subagents, And Books Taxonomy

Status: final proposal candidate

## Purpose

Pipeline Fractale V4 needs three operator-facing artifact families:

1. **Skills**: reusable procedures invoked by the agent or user.
2. **Subagents**: bounded workers that produce evidence or review results.
3. **Books**: durable knowledge surfaces used by humans and agents.

These artifacts must not become an alternate state machine. The RMS/state kernel
remains authoritative for run state, transitions, guard decisions, evidence
status, convergence status, and final states.

```text
Skills = procedures
Subagents = isolated workers
Books = durable knowledge and policy references
MCP/state kernel = authority for state, guards, events, and evidence
```

## Design Constraints From V4

- The active state is `RunEnvelope + HarnessMachineState + DerivedView`.
- `macro_cycle`, `cycle_substate`, and derived fractal lens are separate.
- The lens is derived from the substate registry; it is not directly edited.
- Evidence Set and Convergence Set are authoritative; derived statuses are views.
- Every transition changing activation, macro-cycle, substate, risk, supervision
  mode, or final state must append an event.
- Runtime Capability Set and Runtime Binding Set decide which skills,
  subagents, hooks, and MCP servers can be used.
- Skills and subagents can propose state changes; only the state kernel commits
  them after guard evaluation.

## Authority Model

| Artifact | May read state? | May write state? | May append evidence? | May decide final state? |
|---|---:|---:|---:|---:|
| Skill | Yes, through MCP or file fallback | No direct write; requests transitions | Through MCP evidence API only | No; requests final candidate |
| Subagent | Snapshot only | No | Returns evidence candidate to parent/kernel | No |
| Book | Static/read-only during run, except learning append after approval | No live state | No | No |
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

If MCP is unavailable, a runtime may use a file adapter against `.rms/`, but the
same kernel rules still apply. The fallback must be traced as runtime
degradation and cannot silently satisfy M/E/C enforcement gaps.

## Skills Taxonomy

Skills are short, reusable workflows. They should be portable across Claude,
Codex, and Hermes as `SKILL.md` artifacts, with platform-specific installation
handled by Runtime Binding Sets.

### Core MVP Skills

| Skill | Purpose | Invoked when | Inputs | Outputs | Authority boundary | State kernel relation |
|---|---|---|---|---|---|---|
| `pfv4-intake` | Capture user intent and decide whether the pipeline is inactive, candidate, or already armed. | `user_prompt` gate or explicit operator command. | Raw prompt, cwd, Project Set, active run if any. | Intent draft, run_kind, activation recommendation, ambiguities. | Cannot arm pipeline directly. | Calls `request_transition(PIPELINE_CANDIDATE)` only if guard allows. |
| `pfv4-risk-classify` | Assign and promote T/F/M/E/C risk. | Before `candidate -> armed`, before writes, and on force signals. | Intent Set, target paths, diff summary if available, policy registry. | Risk decision, promotion rationale, forced minima. | Cannot downgrade risk during a run. | Requests `RISK_CLASS_SET` or `RISK_CLASS_PROMOTE`; kernel commits. |
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
| `pfv4-learning-capture` | Convert final run evidence into learning records and discovery seeds. | Pattern mining, policy calibration proposals, book update PRs. |
| `pfv4-human-checkpoint` | Format human checkpoint requests with exact decision, risk, and consequences. | Native approval UIs, signatures, audit-friendly validation logs. |

## Subagents Taxonomy

Subagents are workers, not controllers. They should receive a frozen state
snapshot, explicit task, allowed files or read scope, evidence requirements, and
return schema. They must not mutate `.rms/` directly.

### Core MVP Subagents

| Subagent | Purpose | Invoked when | Inputs | Outputs | Authority boundary | State kernel relation |
|---|---|---|---|---|---|---|
| `state-invariant-reviewer` | Check state shape, no-null rule, substate ownership, and transition invariants. | Before implementation readiness, before `DONE_VERIFIED` for state-machine work. | State snapshot, registries, transition proposal. | Invariant verdict, violations, suggested correction. | Read-only reviewer. | Output becomes `review-verdict` evidence if accepted. |
| `risk-policy-reviewer` | Review risk class, force signals, bypass legality, and supervision mode. | Risk promotion, M/E/C work, bypass request, policy ambiguity. | Intent, paths/diff, Policy Set, risk decision. | Approve/block/promote recommendation. | Cannot set risk directly. | Kernel may commit risk transition after guard evaluation. |
| `route-architect` | Evaluate route quality across cycles, gates, skills, subagents, MCP, and runtime limits. | Before `PIPELINE_ARM` or reroute. | Intent, Capability, Binding, Policy, current state. | Route critique, selected route recommendation, rejected alternatives. | Advisory only. | Feeds Route Set candidate; kernel validates. |
| `evidence-auditor` | Determine whether evidence is present, fresh, relevant, independent, and decisive. | Stop gate, macro handoff, E/C review. | Evidence Set, required evidence matrix, run history. | Evidence status recommendation and missing items. | Cannot mark completion. | Kernel recomputes status; output can be evidence item. |
| `convergence-critic` | Detect stagnation, oscillation, divergence, and repeated failed strategies. | After failed checks, repeated rework, or low convergence score. | Events, convergence samples, defect deltas, current route. | Convergence verdict and reroute/checkpoint recommendation. | Cannot extend iteration budget. | Kernel records samples and applies convergence guard. |
| `runtime-binding-inspector` | Verify whether claimed runtime gates, MCP servers, hooks, and subagent capabilities are real. | Install, session start, runtime degraded, M+ enforcement questions. | Runtime config, Capability Set, Binding Set. | Capability mismatch list, degradation classification. | Cannot relax policy. | Feeds runtime overlay and `BLOCKED_RUNTIME_MISSING` decisions. |
| `security-safety-reviewer` | Review secrets, PII, auth, infra, destructive actions, and compliance triggers. | Safety meta-region signal or E/C risk. | Diff/paths, policies, threat model if present. | Safety verdict, forced risk signals, missing evidence. | Cannot approve destructive action alone. | Kernel may open checkpoint or promote risk. |

### Later Subagents

| Subagent | Purpose | Later expansion |
|---|---|---|
| `product-acceptance-reviewer` | Check acceptance criteria and user value evidence. | Product metrics, stakeholder simulation, UX research linkage. |
| `release-ops-reviewer` | Review rollback, canary, smoke, SLO, and incident readiness. | Live observability integrations and deployment system checks. |
| `learning-curator` | Extract reusable patterns from completed runs. | Book update proposals, policy calibration, trend reports. |
| `registry-linter` | Validate YAML/JSON registries and generated derived views. | Schema generation, registry diff risk scoring. |
| `cross-runtime-portability-reviewer` | Compare Claude/Codex/Hermes parity for skills, hooks, and subagents. | Runtime adapter contract tests and compatibility matrices. |

## Books Taxonomy

Books are durable references. They are not live state. A book can be a Markdown
document, registry-backed generated view, or curated knowledge file. During a
run, books are read-only unless the active cycle is `APPRENTISSAGE` and the
kernel allows a policy/doc update.

### Core MVP Books

| Book | Purpose | Invoked/read when | Inputs | Outputs | Authority boundary | State kernel relation |
|---|---|---|---|---|---|---|
| `State Kernel Book` | Explain the canonical state object, no-null rule, activation states, final states, and invariants. | Any skill/subagent needing state semantics. | State model, transition catalog, validation checklist. | Human-readable state contract. | Descriptive; executable schemas still win. | Mirrors schema/registry; never overrides kernel. |
| `Cycle Playbooks Book` | Describe each macro-cycle, semantic substates, exit evidence, handoffs, and allowed rework. | Route planning, transition requests, handoffs. | Substate registry, transition catalog. | Per-cycle playbooks. | Cannot create new substates by prose. | Generated/validated from substate and transition registries. |
| `Risk And Policy Book` | Explain T/F/M/E/C, supervision modes, bypass, checkpoints, and forced promotions. | Risk classification, guard review, human checkpoint. | Policy Set, risk overlays, mode overlays. | Operator-readable policy rationale. | Prose cannot weaken Policy Set. | Policy registry is source; book is display/explanation. |
| `Evidence And Convergence Book` | Define evidence quality, required evidence by risk, convergence signals, stagnation, divergence, and stop rules. | Evidence collection, stop gate, loop recovery. | Evidence requirements, Convergence Set rules. | Evidence checklist and convergence guide. | Cannot authorize done. | Kernel computes derived evidence/convergence statuses. |
| `Runtime Bindings Book` | Explain RMS concepts mapped to Claude, Codex, Hermes, including degraded/no-op bindings. | Install, runtime probe, route planning. | Runtime Binding Set, Capability Set examples. | Runtime portability guide. | Cannot claim unavailable capability. | Runtime overlay uses inspected Capability/Binding Sets. |
| `MCP And Tools Book` | Define approved MCP servers, tool boundaries, secrets handling, and file fallback behavior. | Route selection and tool use. | MCP registry, Project Set, security policies. | Tool use guide and MCP contract. | Cannot grant tool authority. | Kernel checks MCP health and permitted servers. |
| `Human Checkpoint Book` | Standardize human checkpoint formats, required decisions, signatures, and rejection handling. | E/C work, destructive actions, policy escalation. | Policy Set, human meta-region rules. | Checkpoint templates. | Cannot replace actual human decision evidence. | Kernel records checkpoint events and human meta-region. |
| `Learning Book` | Capture approved reusable patterns, rejected patterns, calibration notes, and discovery seeds. | `APPRENTISSAGE` and future Discovery. | Final records, Evidence Sets, decision logs. | Learning records and seed backlog. | Updates only after learning gate. | Kernel appends learning evidence before book update. |

### Later Books

| Book | Purpose | Later expansion |
|---|---|---|
| `Security And Compliance Book` | Dedicated mapping for OWASP, privacy, regulated data, production risk, and audit trails. | Compliance-specific evidence templates and policy overlays. |
| `Release And Operations Book` | Release, Run, incident, rollback, SLO, and postmortem procedures. | Deployment integrations and operational sample ingestion. |
| `Cross-Runtime Cookbook` | Concrete examples for installing and using V4 on Claude, Codex, Hermes, and future runtimes. | Runtime-specific troubleshooting and adapter examples. |
| `Registry Authoring Book` | How to safely edit guard, substate, policy, runtime, and evidence registries. | Schema-aware editor guidance and ADR templates. |

## Invocation Matrix By Pipeline State

| State or event | Skills | Subagents | Books |
|---|---|---|---|
| `pipeline_activation=inactive` | `pfv4-intake` only if request may become a run | None by default | State Kernel Book, Cycle Playbooks Book |
| `candidate -> armed` | `pfv4-risk-classify`, `pfv4-runtime-probe`, `pfv4-route` | `risk-policy-reviewer`, `route-architect`, `runtime-binding-inspector` if M+ or degraded | Risk And Policy, Runtime Bindings, MCP And Tools |
| `CYCLE_START` | `pfv4-transition` | `state-invariant-reviewer` for registry/state-machine work | State Kernel, Cycle Playbooks |
| Build write | `pfv4-evidence`, `pfv4-transition` | Security/risk reviewer if force signal appears | Risk And Policy, Evidence And Convergence |
| Validation | `pfv4-evidence`, `pfv4-stop-gate` | `evidence-auditor`, `product-acceptance-reviewer` later | Evidence And Convergence |
| Runtime degraded | `pfv4-runtime-probe`, `pfv4-route` | `runtime-binding-inspector` | Runtime Bindings |
| Stagnation/oscillation | `pfv4-loop-recover` | `convergence-critic` | Evidence And Convergence |
| Human checkpoint | `pfv4-human-checkpoint` later | `risk-policy-reviewer` or `security-safety-reviewer` | Human Checkpoint |
| Learning | `pfv4-learning-capture` later | `learning-curator` later | Learning Book |

## MVP Cut

The MVP should ship only what proves the V4 control-plane thesis:

### Skills

1. `pfv4-intake`
2. `pfv4-risk-classify`
3. `pfv4-runtime-probe`
4. `pfv4-route`
5. `pfv4-transition`
6. `pfv4-evidence`
7. `pfv4-stop-gate`
8. `pfv4-loop-recover`

### Subagents

1. `risk-policy-reviewer`
2. `route-architect`
3. `evidence-auditor`
4. `convergence-critic`
5. `runtime-binding-inspector`
6. `state-invariant-reviewer`

### Books

1. `State Kernel Book`
2. `Cycle Playbooks Book`
3. `Risk And Policy Book`
4. `Evidence And Convergence Book`
5. `Runtime Bindings Book`
6. `MCP And Tools Book`

### MVP Non-Goals

- Marketplace of skills.
- Autonomous book rewriting outside `APPRENTISSAGE`.
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
3. Add `learning-curator` and `Learning Book` updates after final records are
   trustworthy.
4. Add cross-runtime portability reviews once all adapters implement the same
   kernel-facing contract.
5. Add specialized security/compliance books only after policy overlays are
   executable, not merely documented.

## Naming Rules

- Skills use `pfv4-<verb-or-workflow>` because they are procedures.
- Subagents use `<domain>-<role>` because they are worker identities.
- Books use `<Domain> Book` because they are durable references, not commands.
- Executable state, event, guard, risk, mode, evidence, and final-state names
  remain English ASCII.
- French labels may appear as display aliases only.

## Key Decisions

- Skills do not own state. They call the MCP/state kernel.
- Subagents do not write `.rms/`. They return structured outputs that become
  evidence only after parent/kernel intake.
- Books do not override registries. They explain, render, and teach the
  executable contracts.
- Runtime degradation is visible. Missing hooks, MCP, or subagent support must
  affect guards and final-state eligibility.
- The smallest useful taxonomy is intentionally small: eight skills, six
  subagents, and six books for MVP.

