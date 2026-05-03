# 01 - Three Convergent Architectures

Status: final proposal candidate

Scope: design-level only, no implementation code.

## Summary

Pipeline Fractale V4 should converge on a hybrid RMS design: a local
event-sourced state kernel owns truth, runtime adapters bind it to
Claude/Codex/Hermes, and one MCP server exposes the same kernel as portable
tools/resources. Skills and subagents remain execution surfaces, not state
owners. Books are durable knowledge artifacts that shape policy, evidence and
operating practice, but they do not mutate kernel state directly.

## Candidate A - MCP-Centric RMS Server

### Shape

The RMS is primarily an MCP server. Claude, Codex, Hermes and future runtimes
call RMS tools such as transition, classify risk, evaluate guard, record
evidence, resolve final state and inspect capability. The server owns canonical
registries and run state.

### Surface Roles

| Surface | Role |
|---|---|
| MCP/server | Main authority. Exposes tools for transitions/guards, resources for current run/evidence/capabilities, and prompts for cycle-specific guidance. |
| Skills | Thin client procedures. They explain how to use the RMS server for Discovery, Cadrage, Build, Validation, Release, Run and Learning. |
| Subagents | Isolated review, research, testing or critique. Their output must be submitted back as Evidence Set entries before affecting final state. |
| Books | Served as MCP resources: risk book, policy book, gate book, runtime binding book, cycle book, evidence book, runbook book and learning book. |

### State Ownership

The MCP server owns Run Set, Evidence Set, Capability Set, Binding Set, guard
registry, transition graph, convergence samples and final-state commit.

### Pros

- Strong cross-runtime portability because MCP is the most standardized shared primitive.
- One kernel means guard semantics do not drift across skills or runtime hooks.
- Easy for external tools to inspect RMS state through resources.

### Cons

- Hard dependency on MCP availability.
- Synchronous blocking is still limited by runtime hook capabilities.
- Offline/local-only operation becomes weaker unless the server is bundled locally.

### Failure Modes

- MCP unavailable: runtime must fall back to read-only guidance or file-only audit, not silently allow M/E/C transitions.
- MCP state and local files diverge: final state must block until reconciliation.
- Runtime cannot synchronously block: MCP can decide block, but adapter may only audit after the fact.
- Server becomes too broad: if it owns orchestration, policy, docs and execution, it risks becoming a monolith.

## Candidate B - Runtime-Native Skill And Hook Pack

### Shape

The RMS is installed as runtime-native hooks, skills, subagent definitions and
local registry files. Claude, Codex and Hermes each get native bindings that call
shared harness commands.

### Surface Roles

| Surface | Role |
|---|---|
| MCP/server | Optional. Used for external integrations and state inspection, but not the primary path. |
| Skills | Main user-facing surface: `classify-risk`, `route-run`, `execute-build`, `validate-evidence`, `close-run`, `review-learning`. |
| Subagents | Native runtime workers: explorer, planner, executor, verifier, security reviewer, critic and researcher. |
| Books | Local Markdown/reference packs loaded by skills: cycle, policy, risk, evidence, runtime, runbooks and postmortems. |

### State Ownership

A local file kernel owns state under `.rms/`. Hooks update Run Set and Evidence
Set, while skills guide the agent through allowed transitions.

### Pros

- Works well offline and inside each runtime's native UX.
- Faster MVP path because hooks and skills already exist on all three platforms.
- Human-facing workflow is natural: users invoke skills, not raw MCP tools.

### Cons

- Highest risk of semantic drift across platforms.
- Hooks may be unavailable, feature-flagged or unable to hard-block.
- Skill prose can accidentally become policy if kernel boundaries are weak.

### Failure Modes

- Hooks disabled: gates become advisory; M/E/C must block or close with runtime-missing/gaps.
- Skill bypasses kernel: state changes without append-only events become invalid.
- Subagent output stays in chat only: final state cannot rely on it.
- Runtime-specific permissions are mistaken for RMS policy.

## Candidate C - Hybrid Event-Sourced RMS Kernel

### Shape

The RMS is a local kernel with append-only events, validated snapshots and
runtime adapters. MCP, hooks, skills and subagents are all clients of the same
kernel.

### Surface Roles

| Surface | Role |
|---|---|
| MCP/server | First-class adapter exposing the kernel as tools/resources. If MCP is unavailable, adapters can still use the same local kernel through file/CLI bindings when risk allows. |
| Skills | Procedural UX. They select workflows, load books and instruct agents how to operate. Every state-changing action goes through kernel transitions and evidence intake. |
| Subagents | Bounded workers. They never own final state. Outputs enter the Evidence Set through evidence intake. |
| Books | Durable knowledge sources, versioned separately from run state. |

### Books

| Book | Purpose |
|---|---|
| Risk Book | T/F/M/E/C classification and forcing signals. |
| Policy Book | Mandatory gates, bypass rules and human checkpoints. |
| Cycle Book | Macro-cycles, semantic substates and transition graph. |
| Evidence Book | Proof requirements by cycle, risk and final candidate. |
| Runtime Book | Capability and binding semantics for Claude/Codex/Hermes. |
| Operations Book | Runbooks, incident response, rollback and SLO/SLA practice. |
| Learning Book | Postmortems, calibration notes and reusable patterns. |

Books inform registries and skills. They are not mutable runtime state.

### State Ownership

The kernel owns:

- RunEnvelope and HarnessMachineState;
- append-only events;
- Run Set snapshot;
- Evidence Set;
- Convergence Set;
- Capability Set and Binding Set references;
- guard decision records;
- final-state commit.

DerivedView is computed from registries, Evidence Set and Convergence Set. The
fractal lens is never writable state.

### Pros

- Best balance of portability, enforceability and offline resilience.
- One state authority avoids split-brain between MCP, hooks, skills and chat.
- Runtime differences stay in Binding Sets, not business logic.
- Skills and subagents remain useful without becoming sources of truth.

### Cons

- More up-front design discipline than Candidate B.
- Requires a precise guard merge algorithm and registry split.
- Requires adapters to resist direct writes to state files.

### Failure Modes

- Adapter writes state directly: invalid unless an append-only event exists.
- Binding claims `can_block=true` incorrectly: M/E/C enforcement becomes unsafe.
- DerivedView cache drifts from Evidence/Convergence Sets: snapshot validation must fail.
- MCP unavailable: continue only if local kernel and risk policy allow file-only fallback.
- Evidence stale/conflicted: final `DONE_VERIFIED` must block.

## Final Recommendation

Choose Candidate C.

The final RMS should be a local event-sourced state kernel with multiple
adapters:

1. Hooks provide runtime enforcement where the platform can block.
2. MCP exposes portable tools/resources for inspection, integration and cross-runtime use.
3. Skills provide human-facing procedures and reusable workflow guidance.
4. Subagents provide isolated labor and review, but results count only after evidence intake.
5. Books provide stable knowledge and policy context, not mutable run state.

This design preserves the V2 correction: macro-cycle, cycle-specific substate
and fractal lens stay separate. It also resolves the core open risk: the RMS has
one authority for state and final-state decisions, while runtime-specific
weaknesses are handled through Capability and Binding Sets.

## Recommended Ownership Boundaries

| Surface | Owns | Must not own |
|---|---|---|
| RMS kernel | State transitions, guards, evidence intake, convergence, final commit. | Runtime UX, model prompting. |
| MCP server | Portable access to kernel tools/resources. | Independent state truth. |
| Hooks/adapters | Runtime binding and enforcement. | Guard semantics. |
| Skills | Procedure, UX, book loading. | Final-state authority. |
| Subagents | Bounded investigation/execution outputs. | State transitions. |
| Books | Durable policy and operational knowledge. | Mutable run state. |

## Design-Level Failure Policy

- If state authority conflicts, the append-only event log wins over snapshots.
- If runtime capability is unknown, block until capability discovery.
- If a required gate cannot block, M/E/C cannot silently degrade.
- If evidence is missing, stale or conflicted, `DONE_VERIFIED` is unavailable.
- If convergence is flat, oscillating or diverging, close only as blocked/gapped when policy allows.
- If subagent output is not recorded in Evidence Set or events, it is non-authoritative.
