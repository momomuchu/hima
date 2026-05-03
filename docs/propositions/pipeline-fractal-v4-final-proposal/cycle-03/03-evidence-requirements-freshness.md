# 03 - Evidence Requirements And Freshness

Status: Cycle 03 contract proposal

## Purpose

Cycle 02 blocked implementation because evidence semantics were still labels.
This contract turns evidence into registry-driven data that an implementation can
evaluate without prose judgement.

The executable rule is:

```text
derived_view.evidence_status =
  evaluate(EvidenceRequirement registry, Evidence Set, EventLog, Route Set,
           Risk Policy, Runtime Binding Set, Registry Manifest, final candidate)
```

`evidence_status` is never written directly. It is derived from required proof
types, observed proof items, freshness, conflicts, accepted gaps and late
evidence rules.

## Sources Used

- `cycle-02/03-mcp-tool-contracts.md`
- `cycle-02/04-registry-storage-layout.md`
- `cycle-02/05-verification-fixtures.md`
- `cycle-02/06-audit-red-team.md`
- `cycle-02/07-cycle-02-integration.md`
- `../02-edge-case-red-team.md`
- `../../pipeline-fractal-v4-state-machine/01-state-model.md`
- `../../pipeline-fractal-v4-state-machine/04-guard-matrix.md`
- `../../pipeline-fractal-v4-state-machine/05-convergence-model.md`
- `../../pipeline-fractal-v4-state-machine/06-open-decisions.md`

## Registry Placement

Evidence requirements live in the executable registry, not in books or comments.

```text
.rms/registry/
  policies/
    evidence-policy.yaml
  schemas/
    evidence-requirement.schema.json
    evidence-item.schema.json
    evidence-evaluation.schema.json
```

`registry/registry-manifest.yaml` must include `policies/evidence-policy.yaml`
and its digest. A run pins the registry digest in `run-manifest.json` and in
every event. Evidence recorded under a different registry digest is stale for
final-state authorization unless a migration or compatibility rule imports it.

## EvidenceRequirement Schema

An `EvidenceRequirement` is the unit the evaluator tries to satisfy.

Conceptual JSON shape:

```json
{
  "schema_version": "1.0",
  "requirement_id": "req_evid_build_m_tests",
  "applies_to": {
    "run_kind": ["development", "validation"],
    "macro_cycle": ["BUILD", "VALIDATION"],
    "cycle_substate": ["build.local_quality_check", "validation.regression_gate"],
    "risk_class": ["M", "E", "C"],
    "supervision_mode": ["pairing", "auto_decision"],
    "final_candidate": ["DONE_VERIFIED", "DONE_WITH_GAPS"],
    "runtime_degradation": ["none", "policy_allowed_fallback"],
    "route_mode": ["solo_execute", "team", "ralph", "manual_checkpoint"]
  },
  "proof": {
    "proof_type": "tests",
    "accepted_item_types": ["command-result", "ci-result", "test-report"],
    "required_result": ["pass"],
    "minimum_independence": "same_agent_ok",
    "minimum_depth": "targeted",
    "allow_superseded": false
  },
  "freshness": {
    "fresh_against": [
      "latest_scope_event",
      "latest_route_event",
      "latest_touched_file_event",
      "latest_registry_validation_event",
      "latest_runtime_binding_event",
      "latest_risk_event"
    ],
    "dependency_match": "all",
    "ttl_policy": "run_current",
    "late_arrival_policy": "normal_before_close_audit_after_close"
  },
  "gap_policy": {
    "gap_allowed": false,
    "gap_allowed_for_risk": ["T", "F"],
    "gap_final_state_cap": "DONE_WITH_GAPS",
    "forbidden_gap_classes": ["security", "rollback", "human_checkpoint", "runtime_hard_gate"]
  },
  "conflict_policy": {
    "conflict_blocks": true,
    "resolution_required": "kernel_arbitration_or_independent_review"
  },
  "severity": "block",
  "status_effect": {
    "missing": "partial_or_missing",
    "stale": "stale",
    "conflicted": "conflicted",
    "satisfied": "contributes_to_verified"
  }
}
```

Schema rules:

- All fields use ASCII identifiers.
- No field accepts `null`; use `UNKNOWN`, `UNSET` or `NOT_APPLICABLE`.
- `requirement_id` is stable across registry versions unless semantics change.
- `applies_to` may use lists or `ANY`, but not omitted dimensions.
- `proof.proof_type` must be registered in `evidence-policy.yaml`.
- `freshness.fresh_against` entries must map to known event selectors.
- `gap_policy.gap_allowed=false` means the requirement cannot be waived into
  `DONE_WITH_GAPS`.
- `severity=block` requirements are required for `DONE_VERIFIED`.
- `severity=warn` requirements may create accepted gaps when risk policy allows.

## EvidenceItem Schema

Evidence items are append-only in meaning. Corrections create new items with
`supersedes_evidence_id`.

```json
{
  "schema_version": "1.0",
  "evidence_id": "ev_tests_001",
  "evidence_type": "command-result",
  "proof_type": "tests",
  "producer": {
    "actor_type": "agent",
    "actor_id": "codex-main",
    "runtime": "codex",
    "independence": "same_agent"
  },
  "result": "pass",
  "summary": "targeted tests passed",
  "proves": {
    "requirement_ids": ["req_evid_build_m_tests"],
    "claim": "regression tests pass for current route"
  },
  "depends_on": {
    "run_id": "run_2026-05-03_001",
    "state_refs": ["state_v42"],
    "event_refs": ["evt_patch_complete"],
    "route_id": "route_2026-05-03_001",
    "route_version": "route_v2",
    "scope_version": "scope_v3",
    "risk_class": "M",
    "registry_version": "pfv4-registry-v1",
    "registry_digest": "sha256:...",
    "capability_set_id": "cap_codex_2026-05-03",
    "binding_set_id": "binding_codex_v1",
    "runtime_fingerprint": "runtime_fp_001",
    "artifact_refs": [
      {
        "path": "docs/propositions/pipeline-fractal-v4-final-proposal/cycle-03/03-evidence-requirements-freshness.md",
        "content_digest": "sha256:...",
        "role": "changed_file"
      }
    ]
  },
  "freshness_basis": {
    "valid_after_event_id": "evt_patch_complete",
    "observed_latest_event_ids": {
      "scope": "evt_scope_v3",
      "route": "evt_route_v2",
      "files": "evt_patch_complete",
      "registry": "evt_registry_validated",
      "runtime": "evt_runtime_binding_checked",
      "risk": "evt_risk_classified"
    }
  },
  "gaps": [],
  "conflicts": [],
  "supersedes_evidence_id": "UNSET",
  "late_class": "not_late"
}
```

Required item rules:

- `proves.requirement_ids` may be empty only for candidate evidence or audit
  evidence. Such items do not satisfy stop gates until imported or mapped.
- `depends_on.artifact_refs` is required for proof about file content.
- `depends_on.route_version` is required for route-scoped proof.
- `depends_on.registry_digest` is required for final-state proof.
- `depends_on.binding_set_id` is required for runtime or degraded-route proof.
- `result=fail` can be valid evidence, but it satisfies only blocker,
  conflict, audit or learning requirements.
- Evidence from a subagent is candidate proof until parent/kernel intake records
  it as an `EvidenceItem`.

## Proof Types

Proof types are registry identifiers. The evaluator reasons over proof types,
not command names or prose summaries.

| Proof type | Accepted item types | Main use |
|---|---|---|
| `intent-scope` | `intent-record`, `scope-record`, `route-record` | Shows what is in scope and out of scope. |
| `route-decision` | `route-record`, `guard-decision` | Shows the route and rejected alternatives. |
| `risk-classification` | `risk-decision`, `human-checkpoint` | Shows current risk class and forcing signals. |
| `territory-check` | `guard-decision`, `runtime-audit` | Shows path/tool/action was allowed or degraded. |
| `runtime-binding-check` | `binding-decision`, `runtime-audit` | Shows required primitives are native, allowed fallback, or blocked. |
| `change-summary` | `diff-summary`, `event-record` | Shows what changed and what files/artifacts are affected. |
| `tests` | `command-result`, `ci-result`, `test-report` | Shows executable behavior remains valid. |
| `static-analysis` | `command-result`, `lint-report`, `typecheck-report` | Shows code or schema shape is valid. |
| `schema-validation` | `schema-report`, `registry-validation` | Shows events, sets, registries and artifacts validate. |
| `review-verdict` | `review-report`, `subagent-report`, `human-checkpoint` | Shows independent or required review result. |
| `security-review` | `review-report`, `scanner-report`, `human-checkpoint` | Shows security-sensitive claims were checked. |
| `rollback-proof` | `rollback-plan`, `restore-test`, `human-checkpoint` | Shows recovery path for E/C or release-sensitive work. |
| `deployment-proof` | `release-report`, `smoke-test`, `ops-check` | Shows release/run handoff is safe. |
| `monitoring-proof` | `runtime-sample`, `alert-check`, `runbook-check` | Shows RUN obligations are met. |
| `learning-capture` | `retrospective`, `book-update`, `decision-record` | Shows Apprentissage outputs are captured. |
| `degradation-acceptance` | `degraded-route-record`, `human-checkpoint` | Shows fallback was declared and risk-allowed. |
| `conflict-resolution` | `arbitration-record`, `independent-review`, `human-checkpoint` | Resolves conflicting evidence. |
| `late-evidence-audit` | `audit-record`, `correction-record`, `reopen-record` | Records evidence after closure without mutating final state. |

## Required Proofs By Risk

This table gives minimum requirements. Cycle, final state and runtime rules can
add stricter requirements.

| Risk | Minimum for progress | Minimum for `DONE_VERIFIED` | Gap policy |
|---|---|---|---|
| `T` | `intent-scope`, `change-summary`, one relevant verification proof | Fresh required proofs plus no conflicts. | Gaps allowed if explicit and owned. |
| `F` | `intent-scope`, `route-decision`, `change-summary`, targeted verification | Fresh targeted verification, territory/runtime checks when files or tools were touched. | Non-critical gaps allowed for `DONE_WITH_GAPS`. |
| `M` | All F proofs plus `risk-classification`, `runtime-binding-check`, `tests` or equivalent schema validation, review when stop gate requires it | Fresh full required set, no stale hard-gate proof, no unresolved gaps for block requirements. | `DONE_WITH_GAPS` allowed only for non-critical warn requirements. |
| `E` | All M proofs plus independent review, security or rollback proof when applicable, human checkpoint when policy requires | Fresh independent proof, rollback/security/human proof for affected dimensions, no unresolved hard gaps. | Residual E gaps cannot be hidden by `DONE_WITH_GAPS`. |
| `C` | All E proofs plus explicit human-visible checkpoint and independent safety/security review | Fresh maximum proof set, current human checkpoint, rollback proof, no unresolved conflicts or gaps. | `DONE_WITH_GAPS` forbidden for critical residual gaps. |

## Required Proofs By Cycle

| Macro-cycle | Required proof families |
|---|---|
| `DISCOVERY` | `intent-scope`, source/provenance proof, open-question record, candidate-evidence labels for non-authoritative artifacts. |
| `CADRAGE` | `intent-scope`, `risk-classification`, scope boundary, route options, rejected alternatives. |
| `CONCEPTION` | design decision record, `route-decision`, review-verdict for M+, architecture/security review for E/C. |
| `BUILD` | `change-summary`, `territory-check`, `runtime-binding-check`, tests/static-analysis/schema-validation according to artifact type. |
| `VALIDATION` | verification result, regression or acceptance proof, conflict scan, stale evidence scan. |
| `RELEASE` | deployment-proof, rollback-proof for M+, human checkpoint for E/C release decisions. |
| `RUN` | monitoring-proof, runtime sample, incident/rollback readiness when operational risk is M+. |
| `APPRENTISSAGE` | learning-capture, decision update, book/registry drift record when generated. |

Cycle evidence may satisfy final evidence only when it is still fresh against
all selected invalidation dimensions.

## Required Proofs By Final State

| Final state candidate | Evidence requirement |
|---|---|
| `DONE_VERIFIED` | Every applicable block requirement is satisfied by passing, fresh, non-conflicted evidence; all required independent/human proofs are current; no accepted gaps remain for block requirements. |
| `DONE_WITH_GAPS` | Work is safe to stop; all block requirements that cannot be waived are satisfied; every gap has owner, reason, affected requirement, expiry or follow-up, and risk policy allows it. |
| `BLOCKED_NEEDS_USER` | Evidence names the missing human decision, affected action, risk class, and why autonomous continuation is forbidden. |
| `BLOCKED_RUNTIME_MISSING` | Evidence names required primitive, binding status, rejected fallback, risk class, and blocked actions. |
| `BLOCKED_POLICY` | Evidence names policy id, violated requirement, current state, and required recovery. |
| `MAX_ATTEMPTS_REACHED` | Evidence names attempts, last distinct hypotheses, and why convergence did not verify. |
| `LOOP_DETECTED` | Evidence names repeated pattern, missing new signal, and reroute/checkpoint requirement. |
| `CANCELLED` | Evidence names cancellation request/source and last safe state. |
| `ABORTED` | Evidence names abort reason, integrity state, and recovery boundary. |

## Freshness Selectors

Freshness selectors map requirements to EventLog queries.

| Selector | Latest event types that can satisfy it |
|---|---|
| `latest_scope_event` | `INTENT_CAPTURED`, `SCOPE_CHANGED`, `ROUTE_PLANNED`, `STATE_TRANSITION_COMMITTED` with scope effect. |
| `latest_route_event` | `ROUTE_PLANNED`, `ROUTE_REPLACED`, `DEGRADED_ROUTE_ACCEPTED`, `DEGRADED_ROUTE_REJECTED`. |
| `latest_touched_file_event` | `STATE_TRANSITION_COMMITTED`, `TOOL_SUCCEEDED`, `TOOL_FAILED`, `FILE_ARTIFACT_CHANGED`, `EVIDENCE_RECORDED` with artifact supersession. |
| `latest_registry_validation_event` | `REGISTRY_VALIDATED`, `REGISTRY_INVALID`, `MIGRATION_APPLIED`. |
| `latest_runtime_capability_event` | `CAPABILITY_DISCOVERED`, `CAPABILITY_DISCOVERY_FAILED`, `RUNTIME_CONTEXT_CHANGED`. |
| `latest_runtime_binding_event` | `BINDING_RESOLVED`, `RUNTIME_BINDING_CHECKED`, `DEGRADED_ROUTE_ACCEPTED`, `DEGRADED_ROUTE_REJECTED`. |
| `latest_risk_event` | `RISK_CLASSIFIED`, `RISK_CLASS_PROMOTED`, `RISK_DOWNGRADE_ACCEPTED`, `HUMAN_CHECKPOINT_RECORDED`. |
| `latest_final_candidate_event` | `FINAL_STATE_CANDIDATE`, `EVIDENCE_EVALUATED`, `CONVERGENCE_EVALUATED`. |
| `latest_conflict_event` | `EVIDENCE_CONFLICT_RECORDED`, `EVIDENCE_CONFLICT_RESOLVED`. |

An evidence item is fresh for a requirement only when its
`freshness_basis.observed_latest_event_ids` are equal to or later than the
current selector values for every required dimension.

## Invalidation Graph

The graph is directional: a newer event invalidates only evidence that depends
on the affected dimension.

```text
scope change
  -> route-decision evidence
  -> tests/static-analysis/review tied to previous scope
  -> final-state evidence

route change
  -> route-decision evidence
  -> territory-check evidence
  -> runtime-binding evidence for route-required gates
  -> tests/reviews claiming route completion
  -> final-state evidence

touched file or artifact change
  -> tests for that path or dependent paths
  -> static-analysis for that path or dependent paths
  -> review-verdict for that path or artifact
  -> change-summary
  -> final-state evidence

registry change or migration
  -> schema-validation evidence
  -> guard/risk/evidence/convergence evaluations under old digest
  -> final-state evidence unless compatibility is recorded

runtime capability change
  -> runtime-binding-check evidence
  -> degraded-route acceptance
  -> territory/runtime guard evidence
  -> final-state evidence for governed actions

runtime binding change
  -> route-decision evidence when required gates changed
  -> runtime-binding-check evidence
  -> degradation-acceptance evidence
  -> final-state evidence

risk classification or promotion
  -> required proof set
  -> bypass/supervision evidence
  -> review/security/human checkpoint requirements
  -> final-state evidence

supervision mode change
  -> human checkpoint evidence
  -> bypass legality evidence
  -> final-state evidence

conflicting evidence recorded
  -> affected requirement status
  -> final-state evidence until resolved

late evidence after closure
  -> audit/correction path
  -> no mutation of final state
```

Path dependency rules:

- A file proof is invalidated by direct changes to that file.
- A file proof is also invalidated by changes to registered dependent files, for
  example schema changes invalidating generated type tests.
- If dependency data is unavailable, the evaluator treats the evidence as stale
  for `DONE_VERIFIED` and may allow `with_gaps` only when risk policy permits.

## Status Derivation

The evaluator computes a per-requirement result, then folds the results into
`derived_view.evidence_status`.

Per-requirement statuses:

| Status | Meaning |
|---|---|
| `missing` | No accepted item claims the requirement. |
| `partial` | Some accepted items exist but required result, depth, independence or dimensions are incomplete. |
| `sufficient` | Required items are present and fresh enough for progress, but not enough for `DONE_VERIFIED`. |
| `with_gaps` | Required items are present except explicit owned gaps that risk policy allows. |
| `verified` | Required items are present, passing, fresh, independent enough, non-conflicted and gap-free for the target. |
| `stale` | A required item predates a relevant invalidation selector or lacks dependency data. |
| `conflicted` | Accepted items disagree on a material claim or a blocking verdict exists for the same requirement. |
| `NOT_APPLICABLE` | Requirement does not apply to the target under registry rules. |

Fold order is fail-closed:

```text
if any applicable requirement is conflicted -> conflicted
else if any applicable block requirement is stale -> stale
else if all applicable requirements are NOT_APPLICABLE -> NOT_APPLICABLE
else if any applicable block requirement is missing -> missing
else if any applicable block requirement is partial -> partial
else if any applicable requirement has accepted gaps -> with_gaps
else if all applicable block requirements are verified
     and all warn requirements are verified or risk-allowed gaps -> verified
else if all applicable block requirements are sufficient -> sufficient
else -> partial
```

Final-state caps:

- `DONE_VERIFIED` requires folded status `verified`.
- `DONE_WITH_GAPS` requires folded status `with_gaps` or `sufficient`, with
  explicit gap records and no E/C residual hard gap.
- `stale` and `conflicted` block both `DONE_VERIFIED` and direct
  `DONE_WITH_GAPS` until the stale/conflict dimension is resolved or the run
  closes as a blocked final state.
- `missing` and `partial` block `DONE_VERIFIED`.
- Blocked final states require enough evidence to explain the block, not enough
  evidence to prove success.

## Late Evidence Rules

Late evidence is evidence whose producer event occurs after the state or final
candidate it tries to affect.

Before closure:

- Late evidence may be accepted if it is fresh against current selectors.
- If late evidence conflicts with an earlier passing item, the affected
  requirement becomes `conflicted`.
- If late evidence supersedes earlier proof and carries required freshness
  metadata, the earlier item remains stored but is ignored for satisfaction.
- A final candidate in `closing` must rerun evidence evaluation when late
  material evidence arrives before `RUN_CLOSED`.

After closure:

- `pipeline_activation=closed` is immutable for protected fields.
- Late evidence cannot mutate `final_state`, snapshots or prior evidence items.
- Passing late evidence may be recorded as `LATE_EVIDENCE_RECORDED` for audit or
  Apprentissage.
- Failing or conflicting late evidence must be recorded as
  `LATE_EVIDENCE_REJECTED_FOR_MUTATION` or `CORRECTION_CANDIDATE_RECORDED`.
- Reopening requires a new registered `REOPEN_REQUESTED` or correction flow; it
  is not part of this evidence evaluator.
- If append-only audit is unavailable, the runtime must report inability to
  record late evidence and must not claim the closed run was updated.

## Evaluation Output

`rms.evaluate_evidence` returns a structured evaluation record:

```json
{
  "schema_version": "1.0",
  "evaluation_id": "eval_evidence_001",
  "run_id": "run_2026-05-03_001",
  "target": {
    "target_type": "final_state",
    "candidate": "DONE_VERIFIED",
    "state_ref": "state_v42",
    "route_version": "route_v2",
    "registry_digest": "sha256:..."
  },
  "evidence_status": "stale",
  "requirement_results": [
    {
      "requirement_id": "req_evid_build_m_tests",
      "status": "stale",
      "matched_evidence_ids": ["ev_tests_001"],
      "missing_proof_types": [],
      "stale_against": ["latest_touched_file_event"],
      "conflicts": [],
      "gaps": []
    }
  ],
  "allowed_final_states": ["BLOCKED_POLICY"],
  "done_verified_allowed": false,
  "done_with_gaps_allowed": false,
  "required_action": "refresh tests against evt_patch_002",
  "event_ids": ["evt_evidence_evaluated"]
}
```

The evaluation event is itself evidence for closing. If any state-changing,
route-changing, registry-changing, runtime-changing, risk-changing or
file-changing event occurs after `evt_evidence_evaluated`, the evaluation is
stale for final-state commit.

## Fixture Pack

These fixtures extend Cycle 02 `VF-EVID-*` and `VF-FINAL-*`.

### EVREQ-001 - Missing Block Requirement Produces Missing

Input:

```yaml
risk_class: M
target:
  final_candidate: DONE_VERIFIED
requirements:
  - requirement_id: req_evid_build_m_tests
    severity: block
    proof_type: tests
evidence_set:
  items: []
```

Expected outcome: `BLOCK`

Expected checks:

- Requirement result is `missing`.
- Folded `evidence_status` is `missing`.
- `DONE_VERIFIED` is unavailable.
- Required action names `req_evid_build_m_tests`.

### EVREQ-002 - Partial Independence Produces Partial

Input:

```yaml
risk_class: E
requirement:
  requirement_id: req_evid_e_review
  proof_type: review-verdict
  minimum_independence: independent_agent
evidence_set:
  items:
    - evidence_id: ev_self_review
      proof_type: review-verdict
      result: approve
      producer:
        independence: same_agent
```

Expected outcome: `BLOCK`

Expected checks:

- Requirement result is `partial`.
- The gap is not accepted automatically.
- `DONE_VERIFIED` is blocked until independent review or policy-approved human
  checkpoint exists.

### EVREQ-003 - Fresh M Evidence Verifies Stop Gate

Input:

```yaml
risk_class: M
target:
  final_candidate: DONE_VERIFIED
current_selectors:
  scope: evt_scope_v3
  route: evt_route_v2
  files: evt_patch_complete
  registry: evt_registry_validated
  runtime: evt_runtime_binding_checked
  risk: evt_risk_classified
evidence_set:
  items:
    - evidence_id: ev_tests
      proof_type: tests
      result: pass
      freshness_basis:
        observed_latest_event_ids:
          files: evt_patch_complete
          route: evt_route_v2
    - evidence_id: ev_binding
      proof_type: runtime-binding-check
      result: pass
      freshness_basis:
        observed_latest_event_ids:
          runtime: evt_runtime_binding_checked
    - evidence_id: ev_review
      proof_type: review-verdict
      result: approve
      freshness_basis:
        observed_latest_event_ids:
          scope: evt_scope_v3
          registry: evt_registry_validated
          risk: evt_risk_classified
```

Expected outcome: `PASS`

Expected checks:

- Every applicable block requirement is `verified`.
- Folded `evidence_status` is `verified`.
- Evidence gate allows `DONE_VERIFIED` to continue to convergence/runtime/final
  commit checks.

### EVREQ-004 - Route Change Invalidates Tests

Input:

```yaml
events:
  - event_id: evt_tests_passed
    event_type: EVIDENCE_RECORDED
    route_version: route_v1
  - event_id: evt_route_changed
    event_type: ROUTE_REPLACED
    route_version: route_v2
evidence_set:
  items:
    - evidence_id: ev_tests
      proof_type: tests
      depends_on:
        route_version: route_v1
      freshness_basis:
        observed_latest_event_ids:
          route: evt_route_v1
```

Expected outcome: `BLOCK`

Expected checks:

- Tests are stale against `latest_route_event`.
- Folded status is `stale`.
- Required action is to refresh route-scoped proof for `route_v2`.

### EVREQ-005 - File Change Invalidates Review But Not Runtime Binding

Input:

```yaml
events:
  - event_id: evt_review_approved
    event_type: EVIDENCE_RECORDED
  - event_id: evt_file_changed
    event_type: FILE_ARTIFACT_CHANGED
    path: src/kernel/evidence.ts
evidence_set:
  items:
    - evidence_id: ev_review
      proof_type: review-verdict
      depends_on:
        artifact_refs:
          - path: src/kernel/evidence.ts
    - evidence_id: ev_binding
      proof_type: runtime-binding-check
      depends_on:
        binding_set_id: binding_codex_v1
```

Expected outcome: `BLOCK`

Expected checks:

- `ev_review` is stale for requirements depending on `src/kernel/evidence.ts`.
- `ev_binding` remains fresh unless a runtime selector changed.
- Folded final status is stale if the review is a block requirement.

### EVREQ-006 - Risk Promotion Adds New Required Proof

Input:

```yaml
before:
  risk_class: F
  evidence_status: verified
after:
  event_type: RISK_CLASS_PROMOTED
  risk_class: E
evidence_set:
  items:
    - proof_type: tests
      result: pass
    - proof_type: change-summary
      result: pass
missing:
  - independent_review
  - rollback_proof
```

Expected outcome: `BLOCK`

Expected checks:

- Previous F verification does not satisfy E requirements.
- Folded status becomes `missing` or `partial`.
- `DONE_VERIFIED` is blocked until newly applicable E proofs are present.

### EVREQ-007 - Registry Migration Stales Schema Evidence

Input:

```yaml
events:
  - event_id: evt_schema_validated
    event_type: EVIDENCE_RECORDED
    registry_digest: sha256:old
  - event_id: evt_migration
    event_type: MIGRATION_APPLIED
    registry_digest: sha256:new
evidence_set:
  items:
    - evidence_id: ev_schema
      proof_type: schema-validation
      depends_on:
        registry_digest: sha256:old
```

Expected outcome: `BLOCK`

Expected checks:

- Schema evidence is stale against `latest_registry_validation_event`.
- Compatibility import is required before old evidence can satisfy new
  requirements.

### EVREQ-008 - Accepted Low-Risk Gap Produces With Gaps

Input:

```yaml
risk_class: F
target:
  final_candidate: DONE_WITH_GAPS
requirement:
  requirement_id: req_evid_f_optional_ci
  severity: warn
  gap_policy:
    gap_allowed: true
evidence_set:
  items:
    - evidence_id: ev_local_tests
      proof_type: tests
      result: pass
accepted_gaps:
  - requirement_id: req_evid_f_optional_ci
    owner: agent
    reason: ci_unavailable_docs_only_change
    follow_up: NOT_APPLICABLE
```

Expected outcome: `PASS`

Expected checks:

- Folded status is `with_gaps`.
- `DONE_WITH_GAPS` is allowed.
- `DONE_VERIFIED` remains blocked.

### EVREQ-009 - E Gap Cannot Be Hidden By DONE_WITH_GAPS

Input:

```yaml
risk_class: E
target:
  final_candidate: DONE_WITH_GAPS
accepted_gaps:
  - requirement_id: req_evid_e_rollback
    gap_class: rollback
    owner: agent
```

Expected outcome: `BLOCK`

Expected checks:

- Gap policy rejects the accepted gap.
- `DONE_WITH_GAPS` is unavailable.
- Final candidate must remain blocked or require human/policy recovery.

### EVREQ-010 - Conflicting Reviews Produce Conflicted

Input:

```yaml
evidence_set:
  items:
    - evidence_id: ev_review_approve
      proof_type: review-verdict
      result: approve
      producer:
        actor_id: evidence-auditor
    - evidence_id: ev_security_block
      proof_type: security-review
      result: block
      conflicts:
        - ev_review_approve
```

Expected outcome: `BLOCK`

Expected checks:

- Affected requirement is `conflicted`.
- Folded status is `conflicted`.
- No final success state is allowed until conflict resolution evidence exists.

### EVREQ-011 - Late Evidence Before Closure Reopens Evaluation

Input:

```yaml
run:
  pipeline_activation: closing
  final_candidate: DONE_VERIFIED
events:
  - event_id: evt_evidence_evaluated
    event_type: EVIDENCE_EVALUATED
    evidence_status: verified
  - event_id: evt_late_ci_fail
    event_type: EVIDENCE_RECORDED
    proof_type: tests
    result: fail
    arrived_after_event: evt_evidence_evaluated
```

Expected outcome: `BLOCK`

Expected checks:

- Final commit cannot reuse `evt_evidence_evaluated`.
- Evidence status becomes `conflicted` or `stale` for the final candidate.
- Closing must rerun evidence evaluation.

### EVREQ-012 - Late Evidence After Closure Cannot Mutate Final State

Input:

```yaml
run:
  pipeline_activation: closed
  final_state: DONE_VERIFIED
late_evidence:
  proof_type: ci-result
  result: fail
request:
  operation: mutate_final_state
  value: DONE_WITH_GAPS
```

Expected outcome: `BLOCK`

Expected checks:

- Protected final state is immutable.
- Late evidence is recorded only as audit/correction candidate if append is
  available.
- The evaluator does not rewrite prior evidence status.

### EVREQ-013 - Runtime Binding Change Stales Degraded Route Acceptance

Input:

```yaml
risk_class: M
events:
  - event_id: evt_degraded_route_accepted
    event_type: DEGRADED_ROUTE_ACCEPTED
    binding_set_id: binding_v1
  - event_id: evt_binding_changed
    event_type: BINDING_RESOLVED
    binding_set_id: binding_v2
evidence_set:
  items:
    - evidence_id: ev_degrade
      proof_type: degradation-acceptance
      depends_on:
        binding_set_id: binding_v1
```

Expected outcome: `BLOCK`

Expected checks:

- Degradation acceptance is stale against `latest_runtime_binding_event`.
- Route/runtime evidence must be refreshed for `binding_v2`.
- M work remains fail-closed until policy allows the current fallback.

### EVREQ-014 - Blocked Final State Needs Block Evidence Only

Input:

```yaml
target:
  final_candidate: BLOCKED_RUNTIME_MISSING
risk_class: M
evidence_set:
  items:
    - evidence_id: ev_binding_missing
      proof_type: runtime-binding-check
      result: block
      summary: pre_tool_write_guard missing and audit fallback rejected
```

Expected outcome: `PASS`

Expected checks:

- Evaluator does not require success tests for a blocked final state.
- Evidence is sufficient to explain `BLOCKED_RUNTIME_MISSING`.
- The run must not be reported as `DONE_VERIFIED` or `DONE_WITH_GAPS`.

## Implementation Readiness Result

This lane closes PFV4-OD-008 for schema-first planning if the implementation
uses:

- `EvidenceRequirement` registry entries for cycle, risk and final state;
- append-only `EvidenceItem` records with dependency and freshness metadata;
- the invalidation graph above;
- fail-closed status derivation;
- fixture coverage for missing, partial, stale, conflicted, with-gaps,
  verified and late-evidence behavior.

It does not close convergence thresholds, human checkpoint schema, candidate
evidence import schema, or runtime degradation policy by itself. Those remain
owned by the adjacent Cycle 03 lanes.
