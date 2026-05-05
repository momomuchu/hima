# 07 - Cycle 02 Integration

Status: Cycle 02 integrated verdict

## Executive Verdict

Cycle 02 improves the proposal from "architecture direction" to "contract
skeleton", but it still rejects implementation handoff.

```text
Architecture direction: accepted
Control-plane shape: accepted with constraints
Implementation contract: blocked
Next cycle: P0 executable contracts
```

The important result is not that Candidate C is perfect. The important result
is that every independent lane converges on the same authority rule:

```text
event-sourced RMS kernel > MCP facade > runtime adapters/hooks > skills >
subagents > reference docs
```

The single MCP server remains the right external state/control surface, but it
must expose the kernel. It must not become an informal monolith where state,
guard policy, evidence policy, runtime degradation and storage semantics are
hidden inside one server implementation.

## What Cycle 02 Added

Cycle 01 selected the architecture. Cycle 02 made the missing implementation
surface visible.

| Lane | Output | Main contribution |
|---|---|---|
| Discovery gap audit | `01-discovery-gap-audit.md` | Found the real P0 contradictions: storage authority, MCP outage fallback, append atomicity, guard merge, runtime fail-open, evidence freshness and legacy supersession. |
| Implementation roadmap | `02-planning-implementation-roadmap.md` | Converted the work into ordered phases and blocked code until contracts are fixture-backed. |
| MCP tool contracts | `03-mcp-tool-contracts.md` | Defined request/response envelopes, tool authority, event emission, errors, degradation and final-state semantics. |
| Registry/storage layout | `04-registry-storage-layout.md` | Proposed `.rms/` layout, event log, snapshots, registries, locks, transaction order and migration shape. |
| Verification fixtures | `05-verification-fixtures.md` | Turned edge cases into PASS/BLOCK fixtures for schema, guards, runtime, evidence, subagents, drift, MCP outage and final state. |
| Audit/red-team | `06-audit-red-team.md` | Rejected implementation handoff and named the remaining executable contracts required before build. |

## Decision Delta

Cycle 02 does not merely repeat the V2 open decisions. It moves each decision
toward an implementation object. Some are now directionally closed; several are
still blocked because they need schemas, algorithms or fixtures.

| Decision | Cycle 02 result | Implementation object | Status |
|---|---|---|---|
| PFV4-OD-001 cycle substate cardinality | Variable semantic substates remain the default; lens values stay derived. | `state/substates.yaml`, `state/lens-map.yaml`, registry validation fixtures. | Direction closed, schema pending. |
| PFV4-OD-002 transition topology | Explicit directed graph wins; free transitions are forbidden. | `state/transitions.yaml`, transition guard fixtures. | Direction closed, graph pending. |
| PFV4-OD-003 non-development representation | Non-development runs use `NOT_ACTIVE`; artifacts are `candidate_evidence` until imported. | `candidate_evidence` schema and import event. | Partly closed, import contract pending. |
| PFV4-OD-004 activation gate | `candidate -> armed -> active` requires Intent, Policy, Capability, Binding, Route and Risk readiness. | activation transition registry, `rms.start_run`, `rms.plan_route`, `rms.transition`. | Partly closed, readiness formula pending. |
| PFV4-OD-005 risk/supervision matrix | T/L/M/H/C defaults are accepted; C forbids autonomous final decisions. | `risk-policy.yaml`, supervision overlays, HumanCheckpoint policy. | Direction closed, policy fixtures pending. |
| PFV4-OD-006 risk classifier mechanics | Forcing signals set minima; downgrade needs evidence. | risk classifier contract and forcing-signal registry. | Blocked. |
| PFV4-OD-007 convergence thresholds | Max iteration is only a fuse; convergence uses score, samples and divergence signals. | `convergence-policy.yaml`, convergence fixtures, score caps. | Blocked. |
| PFV4-OD-008 evidence status semantics | Evidence is derived from Evidence Set, freshness, conflicts and accepted gaps. | evidence requirement schema and freshness invalidation rules. | Blocked. |
| PFV4-OD-009 runtime degradation policy | Runtime name proves nothing; Binding Set decides native/fallback/missing/unknown. | `binding-set.schema.json`, runtime registries, degraded-route fixtures. | Partly closed, concrete runtime facts pending. |
| PFV4-OD-010 guard registry location | Split registries plus generated merged guard cache. | `guards/*.yaml`, `merged.guards.generated.json`. | Direction closed, merge algorithm pending. |
| PFV4-OD-011 English/ASCII canonicalization | Executable identifiers are English ASCII. | registry schemas and migration glossary. | Direction closed, migration pending. |
| PFV4-OD-012 territory enforcement scope | Layered registry plus runtime binding plus audit fallback. | territory overlay, runtime binding check, path/tool/action schema. | Partly closed, enforcement fixtures pending. |
| PFV4-OD-013 closing protocol | Final states live outside macro-cycles; closing is a guarded transaction. | `rms.close_run`, closing policy, final-state fixtures. | Partly closed, closing transaction pending. |

## Blockers That Remain Real

These are not conceptual gaps. They are executable gaps that would cause a
broken or ambiguous implementation if coding started now.

| Blocker | Why it blocks implementation | Required Cycle 03 artifact |
|---|---|---|
| Supersession is not a hard decision record. | Older docs still contain incompatible direct-state and universal-subcycle assumptions. | Supersession ADR and decision-delta table. |
| MCP fallback boundary is still too soft. | If MCP is down, it is unclear whether the kernel library, CLI fallback or MCP server owns mutation. | Authority/fallback transaction contract. |
| Guard merge is still prose. | `block/escalate/reroute/degrade/warn/allow` needs total order, conflict handling and fixture examples. | Guard merge lattice and algorithm. |
| Evidence freshness is still abstract. | Freshness must know what invalidates evidence: route change, file change, registry change, runtime binding change or scope change. | EvidenceRequirement and freshness graph contract. |
| Risk classifier is not mechanized. | The model needs forcing signals, minima, promotions, downgrade legality and human override rules. | Risk classifier policy contract. |
| Runtime degradation can still fail open if implemented naively. | `can_block=false` plus `fallback=post_run_audit` must block M/H/C enforcement by default. | Runtime degradation matrix and Binding Set schema. |
| Artifact drift control is not executable. | Skills, hooks and subagents need registered versions, hashes and authority levels. | Artifact manifest and drift policy. |
| Human checkpoint is not hard enough. | H/C acceptance cannot be free prose. It needs signer, scope, residual risk, expiration and allowed effect. | HumanCheckpoint schema. |
| Non-development import is underdefined. | Architecture/research artifacts must not silently become pipeline evidence. | CandidateEvidence import protocol. |
| Storage recovery is not fully testable. | Pending transaction, stale lock, corrupt snapshot and append failure need deterministic recovery outcomes. | Storage recovery fixture pack. |

## Nested Cycle Result

The user request is explicitly for iteration inside iteration. Cycle 02 now has
that structure:

```text
Discovery found contradictions.
Planning ordered the implementation phases.
Contract lanes proposed MCP and storage surfaces.
Verification turned claims into fixtures.
Audit rejected premature implementation.
Integration converts the rejection into the next cycle backlog.
```

This is the right behavior for the harness: a blocked audit is not a failure of
the process. It prevents a false green light.

## Convergence Assessment

Cycle 02 improves the readiness score, but the score is capped because P0
contracts are not executable yet.

| Dimension | Cycle 01 | Cycle 02 |
|---|---:|---:|
| Architecture choice | 0.78 | 0.90 |
| Authority separation | 0.70 | 0.84 |
| MCP/kernel boundary | 0.55 | 0.70 |
| Storage model | 0.30 | 0.68 |
| Guard algorithm | 0.25 | 0.46 |
| Evidence/convergence model | 0.35 | 0.55 |
| Runtime degradation policy | 0.40 | 0.62 |
| Fixture coverage | 0.20 | 0.72 |
| Implementation readiness | 0.32 | 0.58 |

Cycle 02 readiness is therefore:

```text
weighted readiness: 0.64
implementation handoff cap: 0.58
effective readiness: 0.58
```

The cap is intentional. Any build started above this point would invent missing
rules in code instead of implementing decided contracts.

## Cycle 03 Backlog

Cycle 03 must be narrower and more executable. It should not reopen the whole
architecture unless an artifact proves a contradiction.

Required outputs:

1. `01-supersession-and-decision-delta.md`
   - hard ADR-style supersession rule;
   - list of historical docs and imported sections;
   - rejected legacy assumptions.
2. `02-guard-merge-lattice.md`
   - decision total order;
   - overlay merge algorithm;
   - weakening rules;
   - conflict examples.
3. `03-evidence-requirements-freshness.md`
   - EvidenceRequirement schema shape;
   - invalidation triggers;
   - stale/conflicted/verified derivation.
4. `04-risk-runtime-degradation.md`
   - risk forcing signals;
   - bypass matrix;
   - Binding Set degradation rules;
   - M/H/C fail-closed guarantees.
5. `05-artifact-human-candidate-evidence.md`
   - skill/hook/subagent artifact manifest;
   - HumanCheckpoint schema;
   - CandidateEvidence import protocol.
6. `06-cycle-03-audit.md`
   - audit against Cycle 02 blockers;
   - implementation handoff verdict.

## Integrated Recommendation

Keep Candidate C as the final architecture:

```text
Hybrid Event-Sourced RMS Kernel
+ one MCP state/control server
+ runtime adapters/hooks
+ portable skills
+ bounded subagents
+ durable reference docs
```

But refine the authority language:

```text
The kernel is the authority.
The MCP server is the default transport and control facade.
The local transaction library is the only allowed fallback mutation path.
Skills, hooks and subagents never mutate protected RMS state directly.
Reference docs never override executable registries or kernel decisions.
```

Cycle 03 should now decide the remaining P0 contracts. If Cycle 03 passes audit,
the next phase can become schema-first implementation planning. If Cycle 03
fails audit, the loop continues on the exact blocked contract, not on the whole
proposal.
