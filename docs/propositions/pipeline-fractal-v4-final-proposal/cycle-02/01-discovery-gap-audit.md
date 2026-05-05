# 01 - Discovery Gap Audit

Status: Cycle 02 discovery lane

Scope: audit of what Cycle 01 missed or left too implicit before the final
Pipeline Fractale V4 proposal can become implementation-shaped.

## Source Snapshot

Primary sources reviewed:

- `pipeline-fractal-v4-final-proposal/00-cycle-protocol.md`
- `pipeline-fractal-v4-final-proposal/01-three-convergent-architectures.md`
- `pipeline-fractal-v4-final-proposal/02-edge-case-red-team.md`
- `pipeline-fractal-v4-final-proposal/03-skills-hooks-subagents-taxonomy.md`
- `pipeline-fractal-v4-final-proposal/04-single-mcp-state-kernel.md`
- `pipeline-fractal-v4-final-proposal/05-convergence-validation-cycle.md`
- `pipeline-fractal-v4-final-proposal/06-integrated-final-proposal.md`
- `pipeline-fractal-v4-final-proposal/07-decision-matrix.md`
- `pipeline-fractal-v4-final-proposal/cycle-02/00-cycle-02-brief.md`
- `pipeline-fractal-v4-state-machine/*`
- `rms-runtime-sets-v1-draft.md`
- relevant older conception/transversal docs where they contradict V4:
  `docs/conception/01-state-machine-spec.md`,
  `docs/conception/04-runtime-bindings-spec.md`,
  `docs/conception/08-planning-state-schema.md`,
  `docs/transversal/harness-state-machine.md`.

## Executive Finding

Cycle 01 converged the authority order, but it did not yet make the control
plane executable.

The biggest missed pattern is that Cycle 01 says "one event-sourced kernel owns
truth" while several unresolved documents still describe direct file rewrites,
fail-open hooks, old universal substates, incomplete transaction fallback,
ambiguous route invalidation, and unowned recovery paths. These are not polish
issues. They decide whether the V4 kernel can safely mutate state, block unsafe
routes, import evidence, recover from outages, and prove final state.

Severity scale:

- P0: blocks implementation contract.
- P1: blocks reliable enforcement, auditability, or cross-runtime operation.
- P2: blocks consistency or operator usability, but can be deferred after MVP.

## Gap Findings

| ID | Severity | Gap | What Cycle 01 missed | Evidence | Required Cycle 02 output |
|---|---|---|---|---|---|
| GAP-01 | P0 | Supersession rule is still not a real contract. | Cycle 01 named legacy spec supersession as open, but did not define a migration or precedence rule. Older docs still call the 56-state universal sub-cycle implementation-ready and store `SubPhase`/`RiskClass` values that conflict with V4 English/ASCII semantic substates. | Cycle 01 lists "Legacy spec supersession" as still open (`06-integrated-final-proposal.md:209`). The older spec declares universal substates (`docs/conception/01-state-machine-spec.md:27`, `docs/conception/01-state-machine-spec.md:41`) and accented risk enum (`docs/conception/01-state-machine-spec.md:110`). | A supersession ADR draft or explicit compatibility matrix: old field, V4 field, allowed migration alias, forbidden executable value. |
| GAP-02 | P0 | Storage authority is split across `.rms/`, `.planning/state/`, `.planning/agent/current-state.yaml`, snapshots, and logs. | Cycle 01 says event log wins, but did not decide which file is the guarded write surface, which files are projections, and which paths hooks must read. | Cycle 01 leaves local kernel storage open (`06-integrated-final-proposal.md:207`). RMS V1 proposes `.rms/runs/<run-id>/events.jsonl` and set files (`rms-runtime-sets-v1-draft.md:282`). Older state schema says `.planning/state/*.yaml` views are updated in place and JSONL logs are authority (`docs/conception/08-planning-state-schema.md:16`, `docs/conception/08-planning-state-schema.md:22`), while the older state-machine spec names `.planning/agent/current-state.yaml` authoritative (`docs/conception/01-state-machine-spec.md:961`, `docs/conception/01-state-machine-spec.md:1014`). | A single storage ownership table: canonical write, projection, cache, rebuild source, hook read path, and conflict winner. |
| GAP-03 | P0 | MCP outage fallback contradicts file-only mutation claims. | Cycle 01 accepts local file/CLI fallback in some places, but the red-team and MCP-kernel docs also block canonical mutation when MCP is unavailable unless a transaction fallback exists. That fallback is still undefined. | Red-team says file-only degraded mode is read/append-only unless a local transaction fallback exists (`02-edge-case-red-team.md:23`). MCP kernel says MCP unavailable means no governed `DONE_VERIFIED` (`04-single-mcp-state-kernel.md:267`). Taxonomy allows a file adapter against `.rms/` if MCP is unavailable (`03-skills-hooks-subagents-taxonomy.md:60`). Older runtime bindings say "file-only mode" reads/writes `.rms/` directly (`docs/conception/04-runtime-bindings-spec.md:615`). | Exact fallback transaction rule: allowed operations, lock primitive, event append order, snapshot rebuild, risk limits, and final-state eligibility. |
| GAP-04 | P0 | Event append atomicity and locking are acknowledged but not designed. | Cycle 01 says all mutations append events and fail if append fails, but did not specify event IDs, idempotency, concurrent sessions, file locks, partial writes, or deduplication. | MCP kernel requires mutating tools to append an event before returning (`04-single-mcp-state-kernel.md:95`) and blocks mutation if append fails (`04-single-mcp-state-kernel.md:262`). RMS V1 includes "locks ou zones d'ecriture" in Run Set (`rms-runtime-sets-v1-draft.md:223`) but no mechanism. | An event transaction mini-spec: event id generation, compare-and-swap or lock file, append/fsync/rename order, duplicate command handling, and recovery from half-written JSONL. |
| GAP-05 | P0 | Guard merge is still a formula, not an executable conflict algorithm. | Cycle 01 named the merge algorithm as open but did not classify impossible overlay combinations. The critical missing case remains: `block` from risk, `degrade` from runtime, `warn` from evidence, `reroute` from convergence. | Open decision names deterministic ordering and conflict resolution as missing (`06-integrated-final-proposal.md:203`). Critical review asks what verdict wins when overlays disagree (`pipeline-fractal-v4-state-machine/10-critical-review.md:179`). Guard matrix allows six decisions (`pipeline-fractal-v4-state-machine/04-guard-matrix.md:177`). | A precedence lattice and fixtures for every decision pair: `block`, `escalate`, `reroute`, `degrade`, `warn`, `allow`. |
| GAP-06 | P0 | Activation, suspension, closing, and late evidence are still under-specified. | Cycle 01 handles edge cases narratively, but did not produce a state table for what can be read, written, appended, imported, or reopened in `candidate`, `armed`, `active`, `suspended`, `closing`, and `closed`. | State model defines activation states (`pipeline-fractal-v4-state-machine/01-state-model.md:150`). Open decisions mark activation and closing protocol P0 (`pipeline-fractal-v4-state-machine/06-open-decisions.md:92`, `pipeline-fractal-v4-state-machine/06-open-decisions.md:276`). Red-team says late evidence cannot rewrite closure and needs correction/reopen event (`02-edge-case-red-team.md:26`). | Activation x permission matrix, including late evidence import, reopen/correction event, suspended writes, and `closing` test/evidence permissions. |
| GAP-07 | P0 | Evidence freshness invalidation is named, but dependency tracking is missing. | Cycle 01 says stale evidence blocks `DONE_VERIFIED`; it does not define how an evidence item declares which diff, files, route, runtime binding, risk class, registry version, or subagent snapshot it proves. | Red-team requires freshness against the last state-changing event and invalidation after scope/risk/runtime/touched-file mutation (`02-edge-case-red-team.md:19`). Open decision says evidence requirement schema is still missing (`06-integrated-final-proposal.md:205`). | Evidence schema with `proves`, `depends_on`, `fresh_against_event`, `touched_paths`, `registry_version`, `route_version`, `runtime_capability_version`, and invalidation rules. |
| GAP-08 | P0 | Risk classifier mechanics lack an executable forcing-signal source. | Cycle 01 keeps risk classification as a skill and open decision, but did not identify the canonical inputs or the "never downgrade" lifecycle. | Integrated proposal leaves risk classifier mechanics open (`06-integrated-final-proposal.md:204`). State-machine open decision marks risk mechanization P0 (`pipeline-fractal-v4-state-machine/06-open-decisions.md:132`). State model allows `UNCLASSIFIED` only before classification and forbids unsafe modes (`pipeline-fractal-v4-state-machine/01-state-model.md:240`, `pipeline-fractal-v4-state-machine/01-state-model.md:306`). | Risk classifier contract: input facts, path overrides, diff signals, manual override format, promotion-only rule, downgrade prohibition, and forced minima fixtures. |
| GAP-09 | P0 | Runtime fail-open policy is contradicted by older binding docs. | Cycle 01 says M/H/C cannot silently degrade, but older runtime binding docs intentionally fail open on missing hooks and unhandled errors. Without explicit supersession or risk override, implementation can choose either. | Red-team blocks M+ when enforcement is absent and blocks H/C by default on fail-open runtime (`02-edge-case-red-team.md:18`). MCP kernel says missing enforcement blocks M+ when required (`04-single-mcp-state-kernel.md:261`). Older runtime bindings skip all gate enforcement when `codex_hooks=false` (`docs/conception/04-runtime-bindings-spec.md:611`) and exit 0 on unhandled errors (`docs/conception/04-runtime-bindings-spec.md:638`). | Runtime degradation contract that overrides or supersedes older fail-open behavior by risk class and gate criticality. |
| GAP-10 | P0 | Non-development evidence import is not fixture-ready. | Cycle 01 says inactive artifacts become candidate evidence, but it does not define import identity, provenance, review requirements, or how an inactive design doc becomes Cadrage/Conception evidence without laundering unverified claims. | Red-team identifies inactive artifacts as candidate evidence only until imported through an active transition (`02-edge-case-red-team.md:15`). State model allows non-dev `run_kind` with inactive pipeline (`pipeline-fractal-v4-state-machine/01-state-model.md:134`). | Import contract: candidate evidence type, provenance, required review, import transition, freshness baseline, and rejection cases. |
| GAP-11 | P1 | Actor authority and identity are too shallow. | Event fields include `actor`, but Cycle 01 does not define actor identity, human approval authenticity, subagent identity, tool caller trust, or forged local MCP/tool requests. | MCP kernel event example includes `actor` only as a string (`04-single-mcp-state-kernel.md:155`). Red-team says checkpoint approval must name decision/risk/gaps/action (`02-edge-case-red-team.md:25`). | Actor model: actor id, runtime id, human approval evidence, subagent parent run id, tool caller trust boundary, and audit signature/hash expectations. |
| GAP-12 | P1 | Capability Set freshness and invalidation are missing. | Cycle 01 requires runtime discovery, but not when to refresh capabilities or what invalidates them: config change, runtime upgrade, feature flag change, MCP registration change, shell/sandbox change, or resumed session. | RMS V1 says Capability Set should be produced by inspection where possible (`rms-runtime-sets-v1-draft.md:106`). MCP kernel blocks unknown capability until discovery (`04-single-mcp-state-kernel.md:230`). | Capability freshness rule: per-session or per-run versioning, invalidation triggers, stale capability final-state effect, and minimum fields for Codex/Claude/Hermes. |
| GAP-13 | P1 | Subagent result schema is not authoritative enough for evidence intake. | Cycle 01 says subagents return evidence candidates, but not the minimal schema, conflict semantics, snapshot hash, allowed files, independence level, or how parent acceptance is recorded. | Taxonomy says subagents do not write `.rms/` and only become evidence after intake (`03-skills-hooks-subagents-taxonomy.md:235`). Red-team blocks final state while subagent evidence is conflicted (`02-edge-case-red-team.md:20`). | Subagent return contract with task id, source snapshot hash, allowed scope, verdict, evidence refs, confidence, conflicts, and parent intake event. |
| GAP-14 | P1 | Docs/registry drift handling lacks an update workflow. | Cycle 01 says registries win over reference docs, but not how contradictions become learning items, who owns the update, or whether implementation is blocked only for safety prose. | Red-team blocks implementation planning when a reference doc claims a different safety/risk rule than executable registry (`02-edge-case-red-team.md:22`). Taxonomy says reference docs do not override registries (`03-skills-hooks-subagents-taxonomy.md:237`). | Drift workflow: detect, classify safety vs explanatory, block/downgrade rule, Apprentissage update event, and reference doc version metadata. |
| GAP-15 | P1 | Multi-run and same-repo concurrency are not bounded. | V4 assumes one run enough for MVP but does not say whether concurrent runs are forbidden, queued, namespaced, or allowed with territory locks. | RMS V1 Run Set mentions locks/write zones (`rms-runtime-sets-v1-draft.md:223`). Older spec sketches `current-state/{itemId}.yaml` migration (`docs/conception/01-state-machine-spec.md:1034`). Cycle 01 leaves storage/locks open (`06-integrated-final-proposal.md:207`). | MVP concurrency decision: single active run lock, queue behavior, blocked concurrent mutation, or namespaced runs with territory locks. |
| GAP-16 | P1 | Registry versioning and generated views are not specified. | Cycle 01 names registry split, but not registry version identity, generated merged view cache, migration strategy, or what happens if registry changes mid-run. | Integrated proposal leaves registry split open (`06-integrated-final-proposal.md:202`). State checklist requires snapshot/current events and registries to be coherent (`pipeline-fractal-v4-state-machine/09-validation-checklist.md:65`, `pipeline-fractal-v4-state-machine/09-validation-checklist.md:193`). | Registry contract: version id, compatibility range, merged-view generation, mid-run registry-change event, and fixture for stale registry evidence. |
| GAP-17 | P1 | Tool contracts lack error taxonomy and idempotency. | Cycle 01 lists MCP tools but does not define request/response errors, retry behavior, idempotency keys, partial success, or stable failure codes. | Cycle 02 brief asks for MCP tools to accept/return/fail with exact contracts (`cycle-02/00-cycle-02-brief.md:34`). MCP kernel lists tools but not schemas (`04-single-mcp-state-kernel.md:77`). | MCP tool contract template: input schema, success output, error codes, idempotency key, events emitted, and no-event failure cases. |
| GAP-18 | P1 | Human checkpoint evidence is not durable enough. | Cycle 01 blocks vague "ok" for H/C, but does not define the artifact that proves a human accepted risk, scope, residual gaps, or irreversible action. | Red-team requires checkpoints to name decision, risk class, residual gaps, and allowed next action (`02-edge-case-red-team.md:25`). State-machine open decision requires closing with policy/runtime blocker checks (`pipeline-fractal-v4-state-machine/06-open-decisions.md:286`). | Human checkpoint schema: prompt, exact options, selected option, actor, timestamp, scope, expiry, residual gaps accepted, and revoke/reopen semantics. |
| GAP-19 | P2 | MVP cut still mixes proof-of-thesis with operator experience. | Cycle 01 MVP includes many skills, hooks, and subagents, but the first executable proof may only need kernel, registry, runtime probe, transition, evidence, and stop-gate flows. | Taxonomy MVP lists eight skills, six subagents, six reference docs (`03-skills-hooks-subagents-taxonomy.md:165`). Integrated proposal later narrows some subagents/reference docs but still includes broad procedure surface (`06-integrated-final-proposal.md:214`). | Split MVP into "kernel contract MVP" and "operator UX MVP" so implementation can prove invariants before installing the full workflow pack. |
| GAP-20 | P2 | Naming and value canonicalization need a migration-facing glossary, not just a rule. | Cycle 01 says English ASCII canonical values, but older docs and examples include French and accented values. Implementers need a conversion table to avoid accidental mixed enums. | State-machine open decision recommends English ASCII with French display aliases (`pipeline-fractal-v4-state-machine/06-open-decisions.md:234`, `pipeline-fractal-v4-state-machine/06-open-decisions.md:246`). Older schema uses French `sub_phase` and accented classes (`docs/conception/08-planning-state-schema.md:68`, `docs/conception/08-planning-state-schema.md:178`). | Canonical vocabulary appendix: machine id, display alias, legacy aliases, migration status, and forbidden values. |

## Source Contradictions

### CONTR-01 - Event-sourced kernel vs direct file rewrites

The final proposal says all mutating tools append an event before returning and
mutation fails when event append fails (`04-single-mcp-state-kernel.md:95`,
`04-single-mcp-state-kernel.md:262`). Older planning schema rewrites
`state.yaml`, `mode.yaml`, `current-risk.yaml`, and `run.yaml` in place, with
JSONL as rebuild source (`docs/conception/08-planning-state-schema.md:491`,
`docs/conception/08-planning-state-schema.md:510`). This can be reconciled, but
Cycle 01 did not state the rule: projections may be rewritten only after the
event is durable, and projection mismatch must trigger rebuild/block.

Severity: P0.

### CONTR-02 - Fail-closed M/H/C policy vs fail-open runtime bindings

Cycle 01 red-team and MCP-kernel docs require M+ blocking when required
enforcement is absent (`02-edge-case-red-team.md:18`,
`04-single-mcp-state-kernel.md:261`). Older runtime binding design says missing
Codex hooks skip all gate enforcement and unhandled hook errors exit 0
fail-open (`docs/conception/04-runtime-bindings-spec.md:611`,
`docs/conception/04-runtime-bindings-spec.md:638`).

Severity: P0.

### CONTR-03 - Semantic substates vs universal sub-cycle

V4 state-machine docs separate `macro_cycle`, `cycle_substate`, and derived
lens, while older implementation-ready docs encode `CYCLE.SubPhase` with 56
universal composite states (`docs/conception/01-state-machine-spec.md:27`,
`docs/conception/01-state-machine-spec.md:41`). Cycle 01 names this as legacy
supersession, but implementation still has two credible schemas.

Severity: P0.

### CONTR-04 - MCP unavailable means no governed final verification vs file-only direct writes

The MCP kernel says MCP unavailable means runtime may continue only outside the
governed pipeline and no RMS `DONE_VERIFIED` (`04-single-mcp-state-kernel.md:267`).
The taxonomy allows a file adapter when MCP is unavailable
(`03-skills-hooks-subagents-taxonomy.md:60`), while older bindings say file-only
mode reads/writes `.rms/` directly (`docs/conception/04-runtime-bindings-spec.md:615`).
This needs a transaction fallback, not another prose exception.

Severity: P0.

## Hidden Assumptions To Make Explicit

- The local kernel is available even when MCP transport is unavailable.
- A state mutation can be made atomic using local filesystem primitives on all
  supported OSes.
- A runtime adapter cannot forge capability or binding facts that make unsafe
  gates appear enforceable.
- Human approval can be represented as durable evidence without requiring a
  network identity provider in MVP.
- There is at most one active governed run per workspace unless territory locks
  are introduced.
- Registry changes are rare during a run, or every run pins registry versions.
- Candidate evidence from inactive runs is never trusted until imported by an
  active transition.
- `DONE_VERIFIED` means current evidence, current registry, current route, and
  current runtime capability all align, not merely that tests once passed.

## Edge Cases Not Yet Covered Enough

| Edge case | Why Cycle 01 coverage is insufficient | Severity |
|---|---|---|
| Two agents or sessions append events for the same run concurrently. | Cycle 01 has append-only language but no lock/idempotency rule. | P0 |
| MCP server unavailable after guard allow but before event append. | Needs atomic request lifecycle and recovery decision. | P0 |
| Registry changes after evidence was recorded but before close. | Evidence freshness currently tracks diff/route/risk, not registry version. | P1 |
| Runtime capability changes mid-run, e.g. hooks disabled or config edited. | Capability freshness and invalidation are not specified. | P1 |
| User approval expires or is contradicted by later scope expansion. | Checkpoint schema lacks expiry and scope binding. | P1 |
| Subagent returns useful result after parent route changed. | Needs source snapshot and route dependency on subagent evidence. | P1 |
| Closed run receives evidence that proves the final state wrong. | Red-team names late evidence, but reopen/correction event is not contracted. | P0 |
| File projection rebuild produces a different state than latest snapshot. | Needs conflict verdict and recovery path. | P0 |
| Reference doc says safety policy A, registry says safety policy B, and route already started. | Drift handling exists only as planning blocker, not mid-run policy. | P1 |
| L-risk T/L degraded route later promotes to M because touched files changed. | Needs automatic reclassification and degraded-route invalidation. | P0 |

## Severity Summary

P0 blockers:

- legacy supersession and migration;
- storage authority and file projections;
- MCP/file fallback transaction rule;
- event atomicity, locking, and idempotency;
- guard merge precedence;
- activation/suspension/closing/late-evidence matrix;
- evidence dependency/freshness schema;
- executable risk classification;
- fail-open runtime contradiction;
- non-dev evidence import.

P1 blockers:

- actor identity and approval authenticity;
- Capability Set freshness;
- subagent result schema;
- docs/registry drift workflow;
- concurrent run policy;
- registry versioning;
- MCP tool error/idempotency contracts;
- human checkpoint schema.

P2 gaps:

- MVP cut should separate kernel contract from operator UX;
- canonical vocabulary needs migration aliases.

## Recommended Cycle 02 Discovery Conclusion

Cycle 02 should not reopen the architecture choice. Candidate C remains the
right direction. The discovery result is that the next lanes must turn the
authority thesis into contracts in this order:

1. Storage and transaction model.
2. Registry split, versioning, and guard merge lattice.
3. MCP tool contracts with error/idempotency semantics.
4. Evidence/risk/capability freshness contracts.
5. Activation, closing, late-evidence, and reopen protocol.
6. Supersession/migration appendix for older `.planning` and universal-subphase
   docs.

Until those contracts exist, implementation would still be able to satisfy one
source document while violating another.
