# 01 - Supersession And Decision Delta

Status: Cycle 03 supersession ADR and PFV4-OD delta

## Purpose

Cycle 02 accepted the Hybrid Event-Sourced RMS Kernel architecture but blocked
implementation handoff because older V2 and conception sources still contained
overlapping or incompatible assumptions.

This document closes that ambiguity. It defines which sources remain current,
which source material is imported into executable contracts, which records are
historical, and which assumptions are superseded. It also maps every
`PFV4-OD-*` decision to an implementation owner and one of the Cycle 03 stop
statuses:

- `closed_by_contract`
- `closed_by_fixture`
- `deferred_out_of_mvp`
- `still_blocking`

## ADR-001 - Supersession Authority

### Decision

For PFV4 implementation work, the current authority order is:

```text
Cycle 03 executable contracts
> Cycle 02 implementation-shaped contracts and fixtures
> Cycle 01 integrated Candidate C architecture
> imported V2 state-machine values
> historical conception and transversal sources
```

The executable architecture is:

```text
event-sourced RMS kernel
> local transaction library
> MCP adapter/tools/resources
> runtime adapters/hooks
> skills
> subagents
> books
```

The kernel owns state truth. The MCP server is the default portable transport
and control facade. The local transaction library is the only allowed fallback
mutation path when MCP transport is unavailable. Runtime adapters enforce or
report capabilities. Skills request procedures. Subagents return evidence
candidates. Books explain contracts. None of MCP, skills, subagents, books,
hooks, snapshots or legacy planning files may become independent state
authorities.

### Consequences

- Any new implementation object must be derived from Cycle 03/Cycle 02
  contracts, not from older prose.
- If an older source conflicts with the kernel event log, registry, guard,
  evidence, runtime binding, transaction or closing contracts, the older source
  loses.
- V2 remains useful only where values are explicitly imported into registries,
  schemas, fixtures or policy files.
- Cycle 01 "P0 closed" language is superseded where Cycle 02 audit found that
  an implementation object, schema, algorithm or fixture was still missing.
- Implementation handoff remains blocked until every `still_blocking` row in
  the decision delta is resolved by a later Cycle 03 contract or fixture.

### Scope

This ADR governs PFV4 executable planning for:

- state model and transition registries;
- RMS kernel storage and transaction behavior;
- MCP tool contracts;
- guard merge and policy overlays;
- evidence, convergence and closing;
- runtime binding and degradation;
- skills, subagents, books and candidate evidence import.

It does not rewrite historical documents. Older documents remain available as
evidence of design history unless this ADR marks their assumptions as imported
or superseded.

## Source Supersession Register

| Source | Status | Executable use | Supersession note |
|---|---|---|---|
| `cycle-03/00-cycle-03-brief.md` | current | Defines Cycle 03 stop statuses and required lanes. | Governs this cycle until Cycle 03 integration supersedes it. |
| `cycle-02/07-cycle-02-integration.md` | current | Provides the accepted authority rule, blocker list and Cycle 03 backlog. | Current for readiness verdict and backlog; superseded later only by Cycle 03 integration. |
| `cycle-02/06-audit-red-team.md` | current | Provides the implementation handoff rejection and required fixes. | Current negative authority: implementation remains blocked where this audit says contracts are absent. |
| `cycle-02/03-mcp-tool-contracts.md` | imported | Imports MCP envelope, mutation tools, error codes, event emission and degraded behavior. | Tool names and invariants stand unless narrowed by later schemas. |
| `cycle-02/04-registry-storage-layout.md` | imported | Imports `.rms/` layout, event-log authority, transaction order, registry split and fallback boundary. | File names are contract defaults, not final generated schemas. |
| `cycle-02/05-verification-fixtures.md` | imported | Imports PASS/BLOCK fixtures for schema, guards, convergence, runtime, evidence, drift, MCP outage and final states. | Fixture classes are acceptance requirements; exact test filenames remain future work. |
| `cycle-02/01-discovery-gap-audit.md` | imported | Imports the contradiction list that Cycle 03 must close. | Replaced as open backlog by Cycle 02 integration where resolved. |
| `cycle-02/02-planning-implementation-roadmap.md` | imported | Imports schema-first and fixture-first implementation sequencing. | Roadmap is advisory after Cycle 03 contracts refine owners. |
| `cycle-02/00-cycle-02-brief.md` | historical | Shows the previous cycle question and lane setup. | Superseded by Cycle 03 brief for current work. |
| `../06-integrated-final-proposal.md` | current | Provides Candidate C and the top-level authority split. | Current for architecture direction; superseded for claims that P0 decisions are implementation-ready. |
| `../07-decision-matrix.md` | imported | Imports rejection of MCP-only and runtime-native authority. | Scoring is historical; authority order is imported. |
| `../04-single-mcp-state-kernel.md` | imported | Imports one external MCP facade over the RMS kernel. | Superseded where it implies MCP server itself owns all kernel authority. |
| `../03-skills-subagents-books-taxonomy.md` | imported | Imports role boundaries for skills, subagents and books. | Superseded where any artifact is treated as direct state authority. |
| `../02-edge-case-red-team.md` | imported | Imports edge cases that must become fixtures. | Scenario list remains input to fixture coverage. |
| `../05-convergence-validation-cycle.md` | imported | Imports convergence as score, samples and divergence signals. | Superseded where max attempts alone appears sufficient. |
| `../01-three-convergent-architectures.md` | historical | Preserves rejected architecture alternatives. | Candidate C has superseded Candidates A and B for executable planning. |
| `../../pipeline-fractal-v4-state-machine/06-open-decisions.md` | superseded | Supplies PFV4-OD IDs, options and recommended defaults only. | This document replaces the old open/blocked status register for Cycle 03 work. |
| `../../pipeline-fractal-v4-state-machine/01-state-model.md` | imported | Imports RunEnvelope, HarnessMachineState, DerivedView, no-null and activation/final-state shape. | Superseded where state can be edited directly outside kernel events. |
| `../../pipeline-fractal-v4-state-machine/02-cycle-specific-substates.md` | imported | Imports semantic cycle substates. | Superseded where generic seven-step lens names are stored as substates. |
| `../../pipeline-fractal-v4-state-machine/03-meta-states-and-modes.md` | imported | Imports activation, runtime, evidence and convergence meta-region vocabulary. | Superseded where meta-regions mutate macro/substate directly. |
| `../../pipeline-fractal-v4-state-machine/04-guard-matrix.md` | imported | Imports guard overlay categories and risk/supervision intent. | Superseded where guard merge remains prose or allows weakening hard blocks. |
| `../../pipeline-fractal-v4-state-machine/05-convergence-model.md` | imported | Imports convergence concepts and loop detection direction. | Superseded until thresholds and fixtures are executable. |
| `../../pipeline-fractal-v4-state-machine/08-transition-catalog.md` | imported | Imports transition vocabulary and allowed edge candidates. | Superseded where free transitions or unguarded jumps are allowed. |
| `../../pipeline-fractal-v4-state-machine/09-validation-checklist.md` | imported | Imports validation expectations for fixtures. | Superseded by Cycle 02 fixture IDs where expectations differ. |
| `../../pipeline-fractal-v4-state-machine/10-critical-review.md` | historical | Preserves review rationale and known risks. | Not an executable authority. |
| `../../pipeline-fractal-v4-state-machine/README.md` | historical | Preserves V2 folder intent. | Superseded by this Cycle 03 source register for authority status. |
| `../../pipeline-fractal-v4-state-machine-v1-draft.md` | historical | Preserves early draft context. | Superseded for all executable state-machine assumptions. |
| `../../../conception/01-state-machine-spec.md` | superseded | May provide historical vocabulary only. | Superseded by event-sourced kernel state and registry contracts. |
| `../../../conception/03-rms-sets-schema.md` | imported | Imports set naming and initial field coverage where compatible. | Superseded by no-null, event-log, per-run versioning and registry schemas. |
| `../../../conception/04-runtime-bindings-spec.md` | imported | Imports runtime binding concerns. | Superseded where hooks, crashes, disabled gates or timeouts fail open for M/E/C. |
| `../../../conception/05-gates-policy-spec.md` | imported | Imports gate and policy vocabulary. | Superseded by deterministic guard merge and risk/runtime policy contracts. |
| `../../../conception/06-skills-catalog-spec.md` | imported | Imports skill catalog candidates. | Superseded where skills directly mutate protected RMS state. |
| `../../../conception/07-subagents-catalog-spec.md` | imported | Imports subagent catalog candidates. | Superseded where subagents are treated as authoritative without parent/kernel intake. |
| `../../../conception/08-planning-state-schema.md` | superseded | Historical planning-state reference only. | Superseded by `.rms/runs/<run_id>/events.jsonl` plus projections. |
| `../../../conception/09-cli-commands-spec.md` | imported | Imports CLI command surface candidates. | Superseded where CLI writes bypass the local transaction library. |
| `../../../conception/10-core-api-spec.md` | imported | Imports API surface candidates. | Superseded by Cycle 02 MCP tool contracts and kernel module split. |
| `../../../transversal/harness-state-machine.md` | imported | Imports original red cards and risk of fake enforcement. | Superseded where French/generic state values conflict with ASCII registries. |
| `../../../transversal/risk-classification.md` | imported | Imports risk forcing-signal intent. | Superseded by ASCII `T/F/M/E/C` identifiers and executable risk policy. |
| `../../../transversal/quality-model.md` | historical | Preserves quality rationale. | Not an executable guard authority unless imported into evidence policy. |
| `../../../transversal/cross-cutting-activities.md` | historical | Preserves common activity taxonomy. | Not an executable substate authority. |

## Rejected Legacy Assumptions

The following assumptions are rejected for implementation:

1. The MCP server is the kernel and all local state mutation is impossible when
   MCP transport is down.
2. Runtime-native skills, hooks or files may be independent state authorities.
3. Markdown guard prose is sufficient for executable enforcement.
4. A single monolithic `guards.yaml` is enough once risk, runtime, territory,
   evidence, convergence and closing overlays exist.
5. Max attempts alone is a convergence model.
6. Evidence status may be manually asserted by an agent or skill.
7. `DONE_VERIFIED` can be selected without fresh verified evidence and verified
   convergence.
8. Final states are macro-cycles.
9. Generic fractal lenses such as `EXECUTE` or `VERIFY` are stored substates.
10. Every macro-cycle must expose exactly seven primary substates.
11. `null` is a valid representation for unknown, absent or not-applicable
    state.
12. Runtime names prove enforceability.
13. Hook failures, disabled hooks or timeouts may fail open for M/E/C governed
    enforcement.
14. Post-run audit is equivalent to pre-action blocking for M/E/C territory or
    runtime gates.
15. Books can override registries.
16. Subagent verdicts are authoritative before parent/kernel evidence intake.
17. Skill output can commit final state directly.
18. Non-development architecture, research or planning artifacts are
    authoritative pipeline evidence without import.
19. Snapshots can advance ahead of the append-only event log.
20. Legacy `.planning` or planning-state files can be read as PFV4 state
    authority.
21. French or accented identifiers are executable canonical values.
22. A human approval sentence is enough for E/C checkpoint semantics without
    signer, scope, allowed action, residual risk and expiry.

## PFV4-OD Decision Delta

| Decision | Cycle 03 status | Implementation owner | Contract now in force | Remaining work |
|---|---|---|---|---|
| PFV4-OD-001 cycle substate cardinality | closed_by_contract | `state/substates.yaml`, `state/lens-map.yaml`, `registry/schemas/substate.schema.json` | Variable semantic substates are canonical. Each active substate maps to exactly one primary derived lens. Stored generic lens substates are invalid. | Convert imported V2 substates into registry rows and validation fixtures. |
| PFV4-OD-002 transition topology | closed_by_contract | `state/transitions.yaml`, `guard-engine`, transition fixtures | Explicit directed graph is canonical. Free transitions are forbidden even when guards otherwise allow. | Encode rework edges and unknown-edge fixture pack. |
| PFV4-OD-003 non-development representation | closed_by_fixture | `candidate_evidence.schema.json`, `CANDIDATE_EVIDENCE_IMPORTED` event, `VF-SCHEMA-003` | Inactive non-development runs may expose derived lenses while `harness_machine.status=NOT_ACTIVE`; artifacts are only `candidate_evidence` until imported. | Define full CandidateEvidence import protocol in Cycle 03 lane 05. |
| PFV4-OD-004 activation gate | closed_by_contract | activation transition registry, `rms.start_run`, `rms.plan_route`, `rms.transition` | `candidate -> armed` requires Intent, Policy, Capability, Binding, Route and Risk readiness; `armed -> active` requires registered cycle start. | Add readiness schema fields and fixtures for missing sets. |
| PFV4-OD-005 risk and supervision matrix | closed_by_contract | `policies/risk-policy.yaml`, supervision overlay registry, `HumanCheckpoint` policy | ASCII `T/F/M/E/C` are canonical. Bypass is allowed for T, conditional for F, blocked for M and forbidden for E/C. C forbids autonomous final decision without checkpoint. | Mechanize classifier forcing signals under PFV4-OD-006. |
| PFV4-OD-006 risk classification mechanization | still_blocking | `risk-classifier`, `policies/risk-policy.yaml`, forcing-signal registry | Agent proposal plus forcing-signal minima is the required shape; downgrades require explicit evidence and event history. | Cycle 03 must define signal taxonomy, minima, promotion/downgrade rules and fixtures. |
| PFV4-OD-007 convergence thresholds | still_blocking | `convergence-engine`, `policies/convergence-policy.yaml`, convergence fixtures | Max attempts alone is rejected. Convergence uses score, samples, progress events, repeated patterns and divergence signals. | Cycle 03 must define initial thresholds, score caps, sampling windows and loop fixtures. |
| PFV4-OD-008 evidence status semantics | still_blocking | `evidence-engine`, `evidence-requirements.schema.json`, freshness graph | Evidence status is derived from required proof, observed proof, freshness, conflicts and accepted gaps. Manual status writes are invalid. | Cycle 03 must define EvidenceRequirement schema and invalidation graph. |
| PFV4-OD-009 runtime degradation policy | still_blocking | `binding-set.schema.json`, runtime registries, runtime overlay fixtures | Runtime name proves nothing. Binding Set decides `native`, `fallback`, `noop_traced`, `missing` or `capability_unknown`. M/E/C fail closed for missing enforcement by default. | Cycle 03 must define complete Binding Set fields and runtime degradation matrix. |
| PFV4-OD-010 declarative guard registry location | closed_by_contract | `guards/base-guards.yaml`, overlay registries, `merged.guards.generated.json` | Split guard registries plus a generated merged guard cache are canonical. Markdown-only guards are invalid. | Cycle 03 lane 02 must define total merge lattice and weakening rules. |
| PFV4-OD-011 English and ASCII canonicalization | closed_by_contract | registry manifest, schemas, migration glossary | English ASCII identifiers are canonical for executable state, events, guards, risk, mode, evidence and final states. French labels are display aliases only. | Add migration alias table when schemas are authored. |
| PFV4-OD-012 territory enforcement scope | still_blocking | territory overlay registry, runtime binding check, path/tool/action schema | Layered enforcement is canonical: registry source of truth, runtime hooks when available, audit fallback only when risk policy allows. | Cycle 03 must define enforcement fixtures and degraded fallback legality by risk. |
| PFV4-OD-013 final state and closing protocol | still_blocking | `rms.close_run`, `policies/closing-policy.yaml`, final-state fixtures | Final state is not a macro-cycle. Closing is `final candidate -> evidence evaluation -> convergence evaluation -> policy/runtime check -> append final event`. | Cycle 03 must define closing transaction details, late evidence and reopen/correction protocol. |

## Implementation Object Ownership

| Object | Owns decisions | Authority boundary |
|---|---|---|
| `registry-manifest.yaml` | PFV4-OD-010, PFV4-OD-011 | Pins registry version, source imports, ASCII language rule and generated cache digests. |
| `state/substates.yaml` and `state/lens-map.yaml` | PFV4-OD-001 | Authoritative semantic substates and derived lens mapping. |
| `state/transitions.yaml` | PFV4-OD-002, PFV4-OD-004 | Authoritative activation, internal, macro, rework and closing transition graph. |
| `policies/risk-policy.yaml` | PFV4-OD-005, PFV4-OD-006 | Risk minima, forcing signals, supervision legality, promotions and downgrades. |
| `policies/convergence-policy.yaml` | PFV4-OD-007 | Thresholds, sampling windows, loop detection and score caps. |
| `evidence-requirements.schema.json` and `policies/evidence-policy.yaml` | PFV4-OD-008 | Required proof by cycle, risk, transition and final candidate; freshness and conflict derivation. |
| `runtimes/*.yaml` and `binding-set.schema.json` | PFV4-OD-009 | Runtime primitive mapping, blocking ability, fallback strategy and fail-open risk. |
| `guards/*.yaml` and `merged.guards.generated.json` | PFV4-OD-010, PFV4-OD-012 | Guard overlays, merged verdict and territory/runtime enforcement result. |
| `candidate_evidence.schema.json` and import event registry | PFV4-OD-003 | Boundary between inactive artifacts and authoritative Evidence Set entries. |
| `policies/closing-policy.yaml` and `rms.close_run` | PFV4-OD-013 | Final-state candidate, stop-gate evaluation and immutable closure. |
| `HumanCheckpoint` schema | PFV4-OD-005, PFV4-OD-006, PFV4-OD-013 | Human-visible acceptance, signer, scope, residual risk, allowed action and expiry. |
| local transaction library | PFV4-OD-004, PFV4-OD-009, PFV4-OD-013 | Only fallback mutation path when MCP transport is unavailable. |
| MCP adapter/tools | PFV4-OD-004, PFV4-OD-008, PFV4-OD-013 | Default transport for kernel mutation and projection reads; never separate truth. |

## MVP Deferral Decisions

No PFV4-OD-001 through PFV4-OD-013 decision is deferred out of MVP.

The following expansions are out of MVP but do not change the OD statuses:

- additional runtime adapters beyond the first Codex binding stubs;
- full book generation and publishing workflow;
- fully automatic risk classification without human validation path;
- non-core skill marketplace drift policy;
- historical run migration beyond explicit import or
  `NOT_MIGRATED_UNVERIFIABLE`.

## Handoff Gate

Schema-first implementation planning may start only after the remaining
`still_blocking` decisions have Cycle 03 artifacts:

- PFV4-OD-006: risk classifier mechanics;
- PFV4-OD-007: convergence thresholds;
- PFV4-OD-008: evidence status semantics;
- PFV4-OD-009: runtime degradation policy;
- PFV4-OD-012: territory enforcement scope;
- PFV4-OD-013: closing protocol.

Until then the correct readiness verdict is:

```text
Architecture direction: accepted
Supersession authority: closed
PFV4-OD delta: partly closed
Implementation handoff: blocked
```
