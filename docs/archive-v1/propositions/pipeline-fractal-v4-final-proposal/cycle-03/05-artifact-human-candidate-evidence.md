# 05 - Artifact, Human, And Candidate Evidence Contracts

Status: Cycle 03 contract proposal

## Purpose

This document closes the Cycle 02 P0 blockers for:

- artifact manifests and drift policy for skills, hooks, and subagents;
- subagent evidence packet intake;
- `HumanCheckpoint` schema and legality rules;
- `CandidateEvidence` import protocol for inactive or non-development
  artifacts.

These contracts preserve the Cycle 02 authority model:

```text
registries and RMS kernel = executable authority
skills = procedures that request kernel actions
hooks = runtime enforcement and context-injection adapters
subagents = bounded evidence producers
reference docs = durable explanatory references
inactive artifacts = candidate evidence until imported
```

No artifact in this document may directly mutate `.rms/`, protected state
fields, final state, derived evidence status, or derived convergence status.

## Sources Used

- `../03-skills-hooks-subagents-taxonomy.md`
- `cycle-02/03-mcp-tool-contracts.md`
- `cycle-02/04-registry-storage-layout.md`
- `cycle-02/05-verification-fixtures.md`
- `cycle-02/06-audit-red-team.md`

## Contract Principles

1. Artifact identity and drift are registry-backed facts, not inferred from file
   names.
2. A drifted core skill or schema-less subagent output is not executable
   authority.
3. Reference doc prose never weakens registry, policy, guard, evidence, or closing
   rules.
4. Human approval is scoped, expiring, auditable evidence; it is not blanket
   permission.
5. Inactive and non-development artifacts are `candidate_evidence` until the
   kernel imports them into an active run.
6. Accepted evidence may block a transition. Evidence acceptance is not the same
   as final-state approval.
7. Every rejected intake, illegal checkpoint, drift conflict, and failed import
   must leave a structured failure record when the kernel can append events.

## Registry And Storage Placement

Cycle 02 registry/storage layout gains these authored registry files and runtime
artifact locations:

```text
.rms/
  registry/
    artifacts/
      artifact-manifest.yaml
      artifact-drift-policy.yaml
      subagent-output-schemas.yaml
      candidate-evidence-policy.yaml
    policies/
      human-checkpoint-policy.yaml
    schemas/
      artifact-manifest.schema.json
      artifact-drift.schema.json
      subagent-evidence-packet.schema.json
      human-checkpoint.schema.json
      candidate-evidence.schema.json
      candidate-evidence-import.schema.json
  runs/
    <run_id>/
      decisions/
        human-checkpoints.jsonl
        artifact-drift-decisions.jsonl
        candidate-import-decisions.jsonl
      artifacts/
        subagents/
        candidate-evidence/
        human-checkpoints/
```

The manifest and policies are committed source artifacts. Run-local decisions
and payloads are append-only runtime artifacts. Generated reference doc views
may be committed only when their provenance points back to a registry digest,
but they are not installable runtime artifacts and do not appear in
`artifact-manifest.yaml`.

## Artifact Manifest Contract

`artifact-manifest.yaml` is the source of truth for governed skills, hooks, and
subagents. It is validated by `rms.validate_registry` before executable use.

Required top-level fields:

```yaml
schema_version: "1.0"
manifest_id: "pfv4-artifacts"
manifest_version: "pfv4-artifacts-v1"
registry_version: "pfv4-registry-v1"
registry_digest: "sha256:..."
canonical_charset: "ascii"
artifacts:
  - artifact_id: "skill.pfv4-stop-gate"
    artifact_kind: "skill"
    name: "pfv4-stop-gate"
    lifecycle: "mvp_core"
    version: "1.0.0"
    source_ref: "skills/pfv4-stop-gate/SKILL.md"
    installed_refs:
      - runtime: "codex"
        path: ".codex/skills/pfv4-stop-gate/SKILL.md"
        required: true
    content_hash: "sha256:..."
    schema_version: "skill-contract-v1"
    authority: "procedure"
    allowed_kernel_tools:
      - "rms.get_state"
      - "rms.evaluate_evidence"
      - "rms.evaluate_convergence"
      - "rms.close_run"
    forbidden_actions:
      - "direct_rms_write"
      - "direct_final_state_write"
    drift_policy_ref: "core_skill_fail_closed"
    evidence_output_schema_ref: "NOT_APPLICABLE"
```

Artifact entry fields:

| Field | Required | Meaning |
|---|---:|---|
| `artifact_id` | Yes | Stable ASCII id, namespaced as `skill.*`, `hook.*`, or `subagent.*`. |
| `artifact_kind` | Yes | `skill`, `hook`, or `subagent`. |
| `name` | Yes | Invocation or display name. |
| `lifecycle` | Yes | `mvp_core`, `mvp_optional`, `later`, `deprecated`, or `historical`. |
| `version` | Yes | Artifact semantic version or registry-controlled version. |
| `source_ref` | Yes | Repository source path or generated runtime artifact source. |
| `installed_refs` | Yes | Runtime-specific installed locations for managed runtime artifacts. |
| `content_hash` | Yes | Hash of canonical source content or generated output. |
| `schema_version` | Yes | Contract schema expected for artifact metadata/output. |
| `authority` | Yes | `procedure`, `runtime_hook`, or `evidence_producer`. |
| `allowed_kernel_tools` | Yes | MCP tools the artifact may call or request through parent. |
| `forbidden_actions` | Yes | Explicit denied actions used by territory and runtime guards. |
| `drift_policy_ref` | Yes | Policy id in `artifact-drift-policy.yaml`. |
| `evidence_output_schema_ref` | Yes | Required for subagents; `NOT_APPLICABLE` otherwise. |

Authority values:

| Artifact kind | `authority` | May request transition? | May append evidence directly? | May decide final state? |
|---|---|---:|---:|---:|
| `skill` | `procedure` | Yes, through kernel tools | Only through `rms.record_evidence` | No |
| `hook` | `runtime_hook` | No; may block, inject context, or request evaluation | Only through kernel-mediated hook events | No |
| `subagent` | `evidence_producer` | No | No; parent/kernel intake only | No |

### Artifact Drift Policy

`artifact-drift-policy.yaml` defines how runtime installation facts are compared
with manifest facts.

Required policy fields:

```yaml
schema_version: "1.0"
policies:
  core_skill_fail_closed:
    applies_to:
      artifact_kind: "skill"
      lifecycle: "mvp_core"
    compare:
      - "content_hash"
      - "schema_version"
      - "allowed_kernel_tools"
      - "forbidden_actions"
    on_match: "allow"
    on_missing: "block"
    on_hash_mismatch: "block"
    on_schema_mismatch: "block"
    allowed_degraded_use: false
    event_on_failure: "ARTIFACT_DRIFT_BLOCKED"
    required_action: "sync_or_reconcile_artifact"
```

Drift decisions:

| Decision | Meaning | Continuation |
|---|---|---|
| `allow` | Installed artifact matches manifest fields. | Artifact may be invoked within route policy. |
| `warn` | Non-authoritative display or doc drift only. | Continue with drift evidence. |
| `degrade` | L-risk optional artifact has declared fallback. | Continue only with `DEGRADED_ROUTE_ACCEPTED`. |
| `block` | Core artifact, schema, authority, or policy drift. | Do not invoke or rely on artifact. |

Core drift blocks:

- missing core skill, hook, or subagent;
- content hash mismatch for core skill or hook;
- hook binding mismatch against the runtime adapter declaration;
- subagent output schema mismatch;
- reference doc contradiction with executable policy or guard registry;
- artifact declares broader authority than its manifest;
- installed artifact permits a forbidden action.

Reference doc drift that affects only display aliases or examples may warn for `T/L`
runs. Reference doc drift that contradicts risk, evidence, closing, runtime, territory,
or human checkpoint policy blocks executable reliance until reconciled. This is
documentation or registry drift, not runtime artifact drift.

## Subagent Evidence Packet Intake

Subagents return evidence candidates, not accepted evidence. The parent or MCP
kernel imports the packet through `rms.record_evidence` or a future
`rms.import_subagent_packet` wrapper that calls the same evidence engine.

Required packet shape:

```json
{
  "schema_version": "subagent-evidence-packet-v1",
  "packet_id": "sep_state_invariant_001",
  "run_id": "run_2026-05-03_001",
  "subagent": {
    "artifact_id": "subagent.state-invariant-reviewer",
    "name": "state-invariant-reviewer",
    "version": "1.0.0",
    "content_hash": "sha256:..."
  },
  "task": {
    "task_id": "subtask_001",
    "requested_by": "codex-main",
    "purpose": "check state invariants before transition",
    "allowed_scope": ["state_v12", "registry_v4"],
    "forbidden_actions": ["write_file", "direct_rms_write"]
  },
  "basis": {
    "state_refs": ["state_v12"],
    "registry_version": "pfv4-registry-v1",
    "registry_digest": "sha256:...",
    "evidence_refs_read": [],
    "artifact_refs_read": []
  },
  "verdict": {
    "result": "block",
    "confidence": "high",
    "summary": "cycle_substate is null",
    "recommended_action": "reject transition and repair state input"
  },
  "findings": [
    {
      "finding_id": "inv_no_null",
      "severity": "block",
      "target_ref": "state_v12",
      "path": "harness_machine.cycle_substate",
      "claim": "null is invalid",
      "evidence_refs": ["state_v12"],
      "policy_refs": ["no_null_rule"]
    }
  ],
  "limitations": [],
  "integrity": {
    "created_at": "2026-05-03T00:00:00Z",
    "packet_hash": "sha256:...",
    "redaction_status": "redacted",
    "direct_mutation_attempted": false
  }
}
```

Intake checks:

| Check | Failure code |
|---|---|
| Packet validates against registered schema. | `SUBAGENT_PACKET_SCHEMA_INVALID` |
| Manifest entry exists and hash/schema match drift policy. | `ARTIFACT_DRIFT_BLOCKED` |
| Packet run id matches active run. | `RUN_MISMATCH` |
| Basis state, registry, and evidence refs are present and fresh. | `SUBAGENT_PACKET_STALE` |
| Scope does not exceed assigned read/write boundaries. | `SUBAGENT_SCOPE_VIOLATION` |
| Packet contains no direct `.rms/` mutation attempt. | `SUBAGENT_AUTHORITY_VIOLATION` |
| Findings include target refs and policy refs. | `SUBAGENT_PACKET_INCOMPLETE` |
| Conflicts with existing evidence are declared or detected. | `EVIDENCE_CONFLICTED` |

Accepted packets become Evidence Set items with:

```json
{
  "evidence_type": "review-verdict",
  "producer": "subagent",
  "producer_ref": "subagent.state-invariant-reviewer",
  "source_packet_ref": "sep_state_invariant_001",
  "scope_refs": ["state_v12", "registry_v4"],
  "result": "block",
  "freshness_basis": {
    "valid_after_event_id": "evt_state_v12",
    "invalidated_by": []
  },
  "conflicts": [],
  "gaps": []
}
```

Acceptance semantics:

- `result=approve` may satisfy a review requirement only if evidence policy
  names that subagent type as acceptable for the current risk and transition.
- `result=block` is accepted evidence and blocks the related transition or final
  candidate until resolved.
- `confidence=low` cannot satisfy M/H/C independent review requirements.
- A stale packet may be stored as rejected intake evidence, but cannot satisfy
  current evidence requirements.

## HumanCheckpoint Schema

`HumanCheckpoint` is a signed or attributable human decision record. It is
stored in `decisions/human-checkpoints.jsonl` and referenced by Evidence Set
items. It can authorize only the explicit next action named in the record.

Required shape:

```json
{
  "schema_version": "human-checkpoint-v1",
  "checkpoint_id": "hcp_0001",
  "run_id": "run_2026-05-03_001",
  "checkpoint_type": "risk_acceptance",
  "status": "approved",
  "created_at": "2026-05-03T00:00:00Z",
  "expires_at": "2026-05-03T02:00:00Z",
  "requested_by": {
    "actor_type": "agent",
    "actor_id": "codex-main",
    "runtime": "codex"
  },
  "decider": {
    "actor_type": "human",
    "actor_id": "operator_local",
    "identity_basis": "runtime_authenticated_user"
  },
  "scope": {
    "risk_class": "H",
    "supervision_mode": "pairing",
    "allowed_next_action": "apply_migration_to_declared_files",
    "allowed_transition_id": "build_to_validation",
    "target_refs": ["route_2026-05-03_001"],
    "target_paths": ["src/migrations/001.sql"],
    "non_scope": ["production_deploy", "secrets_rotation"]
  },
  "decision": {
    "decision_text": "Approve applying the reviewed migration file only.",
    "residual_gaps_accepted": [],
    "conditions": ["run validation immediately after edit"],
    "rejected_alternatives": ["autonomous production deploy"]
  },
  "evidence_refs": ["ev_review_001", "gd_risk_001"],
  "policy_refs": ["risk_policy.H.requires_checkpoint"],
  "integrity": {
    "checkpoint_hash": "sha256:...",
    "redaction_status": "redacted"
  }
}
```

Required fields:

| Field | Required | Meaning |
|---|---:|---|
| `checkpoint_id` | Yes | Stable append-only checkpoint id. |
| `checkpoint_type` | Yes | `risk_acceptance`, `destructive_action`, `external_production`, `policy_exception`, `final_gap_acceptance`, or `ambiguity_resolution`. |
| `status` | Yes | `requested`, `approved`, `rejected`, `expired`, `superseded`, or `invalid`. |
| `expires_at` | Yes | Expiry timestamp or `END_OF_RUN` for allowed L-risk checkpoints. |
| `decider` | Yes for approval/rejection | Human actor and identity basis. |
| `scope` | Yes | Risk, mode, allowed action, transition, paths, and non-scope. |
| `decision` | Yes for approval/rejection | Plain decision, gaps, conditions, and rejected alternatives. |
| `evidence_refs` | Yes | Evidence available to the human when deciding. |
| `policy_refs` | Yes | Policy rules that required or accepted the checkpoint. |

Legality rules:

1. Vague approvals such as "looks good" are invalid for M/H/C, destructive,
   external-production, or final-gap decisions.
2. A checkpoint cannot authorize actions outside `allowed_next_action`,
   `allowed_transition_id`, `target_refs`, and `target_paths`.
3. Expired checkpoints cannot satisfy current guard or evidence requirements.
4. A rejected checkpoint blocks the requested action until a materially changed
   request is submitted with new evidence.
5. A checkpoint cannot override missing required evidence for `DONE_VERIFIED`.
6. A checkpoint cannot permit bypass for `H/C` unless the risk policy explicitly
   defines that exception, and `C` still requires human-visible final review.
7. A checkpoint accepting residual gaps may allow `DONE_WITH_GAPS` only when the
   risk and closing policy allow those exact gaps.
8. Checkpoints are invalidated by risk promotion, route replacement, target path
   expansion, runtime binding degradation, or conflicting evidence after
   approval unless policy marks the change as non-material.

Failure modes:

| Failure | Required result |
|---|---|
| Missing decider for approval | `HUMAN_CHECKPOINT_INVALID`; block. |
| Vague decision text | `HUMAN_CHECKPOINT_AMBIGUOUS`; block for M+. |
| Expired checkpoint | `HUMAN_CHECKPOINT_EXPIRED`; block or request renewal. |
| Wrong action or path | `HUMAN_CHECKPOINT_SCOPE_MISMATCH`; block. |
| Rejected checkpoint | `HUMAN_CHECKPOINT_REJECTED`; block requested action. |
| New conflicting evidence | Mark checkpoint `superseded` or invalid for affected action. |
| Attempts to approve `DONE_VERIFIED` with missing evidence | `EVIDENCE_INSUFFICIENT`; block verified final state. |

## CandidateEvidence Import Protocol

Inactive or non-development artifacts include architecture docs, research notes,
planning drafts, reference docs, screenshots, external reports, or conversations produced
while `pipeline_activation=inactive` or outside a governed development route.
They are not authoritative Evidence Set items until imported.

Candidate evidence shape:

```json
{
  "schema_version": "candidate-evidence-v1",
  "candidate_id": "cand_arch_001",
  "origin": {
    "origin_kind": "inactive_architecture_run",
    "origin_run_id": "run_arch_001",
    "origin_activation": "inactive",
    "origin_macro_cycle": "NOT_APPLICABLE",
    "origin_artifact_ref": "docs/propositions/example.md",
    "created_at": "2026-05-03T00:00:00Z"
  },
  "classification": {
    "candidate_type": "architecture_contract",
    "trust_level": "untrusted_until_imported",
    "intended_cycle": "CONCEPTION",
    "intended_evidence_type": "design-rationale"
  },
  "content": {
    "summary": "Proposes artifact drift controls",
    "content_hash": "sha256:...",
    "redaction_status": "redacted"
  },
  "provenance": {
    "author_type": "agent",
    "author_id": "codex-main",
    "source_refs": ["cycle-02/06-audit-red-team.md"],
    "registry_version_at_creation": "UNKNOWN"
  },
  "known_gaps": [
    "not validated against active registry"
  ]
}
```

Import request shape:

```json
{
  "schema_version": "candidate-evidence-import-v1",
  "import_id": "cei_0001",
  "run_id": "run_2026-05-03_001",
  "candidate_id": "cand_arch_001",
  "requested_by": "codex-main",
  "import_target": {
    "macro_cycle": "CONCEPTION",
    "cycle_substate": "conception.contract_design",
    "evidence_type": "design-rationale",
    "scope_refs": ["route_2026-05-03_001"],
    "artifact_refs": ["docs/propositions/example.md"]
  },
  "validation": {
    "registry_version": "pfv4-registry-v1",
    "registry_digest": "sha256:...",
    "freshness_against_event": "evt_route_planned",
    "conflict_policy": "block_on_policy_conflict"
  },
  "authority_requested": "supporting_evidence"
}
```

Import authority:

| Actor | May request import? | May accept import? |
|---|---:|---:|
| Skill | Yes, through kernel tool | No |
| Subagent | No; may recommend | No |
| Human | Yes through checkpoint or operator command | Kernel still validates |
| MCP/state kernel | Yes | Yes, after policy/evidence checks |

Import rules:

1. Candidate artifacts may enter only as `supporting_evidence`,
   `design-rationale`, `research-source`, `decision-context`, or
   `accepted-gap-rationale`; never as direct `verification_result`.
2. The import target must be an active run and registered cycle/substate unless
   the import is into an inactive conversation index.
3. Candidate evidence must be fresh against route, scope, registry, and target
   artifact hash or it imports with an explicit gap and cannot satisfy
   `DONE_VERIFIED`.
4. If candidate content conflicts with registry or policy, registry wins and the
   import is blocked or accepted only as conflict evidence.
5. Non-development artifacts cannot arm a development run by themselves. They
   can inform Cadrage, Conception, or Learning after import.
6. A candidate from an inactive architecture run cannot count as independent
   validation evidence unless a policy-approved reviewer or human checkpoint
   revalidates it against the active state.
7. Imported candidate evidence must keep provenance, original hash, import
   event id, trust level, accepted gaps, and conflict status.

Accepted import Evidence Set item:

```json
{
  "evidence_type": "design-rationale",
  "producer": "candidate_import",
  "candidate_id": "cand_arch_001",
  "import_id": "cei_0001",
  "scope_refs": ["route_2026-05-03_001"],
  "artifact_refs": ["docs/propositions/example.md"],
  "summary": "Imported inactive architecture proposal as supporting rationale",
  "result": "pass",
  "freshness_basis": {
    "valid_after_event_id": "evt_route_planned",
    "invalidated_by": []
  },
  "trust_level": "supporting_only",
  "conflicts": [],
  "gaps": ["not independent runtime verification"]
}
```

Failure modes:

| Failure | Required result |
|---|---|
| Candidate lacks provenance or hash | `CANDIDATE_EVIDENCE_INVALID`; block import. |
| Target run is closed | `RUN_CLOSED`; reject final-state mutation. |
| Target cycle/substate is unregistered | `REGISTRY_VERSION_MISMATCH` or `INVARIANT_VIOLATION`. |
| Candidate predates route/risk/runtime change | `CANDIDATE_EVIDENCE_STALE`; import only with gap or block. |
| Candidate conflicts with policy registry | `CANDIDATE_EVIDENCE_CONFLICTED`; registry wins. |
| Import asks for `verification_result` authority | `CANDIDATE_AUTHORITY_DENIED`; block. |
| MCP/kernel unavailable for import | Artifact remains candidate; no `DONE_VERIFIED`. |

## Event Types

Cycle 03 adds these event types to the registry candidate:

```text
ARTIFACT_MANIFEST_VALIDATED
ARTIFACT_DRIFT_DETECTED
ARTIFACT_DRIFT_ALLOWED
ARTIFACT_DRIFT_BLOCKED
SUBAGENT_PACKET_RECEIVED
SUBAGENT_PACKET_ACCEPTED
SUBAGENT_PACKET_REJECTED
HUMAN_CHECKPOINT_REQUESTED
HUMAN_CHECKPOINT_APPROVED
HUMAN_CHECKPOINT_REJECTED
HUMAN_CHECKPOINT_EXPIRED
HUMAN_CHECKPOINT_INVALIDATED
CANDIDATE_EVIDENCE_REGISTERED
CANDIDATE_EVIDENCE_IMPORT_REQUESTED
CANDIDATE_EVIDENCE_IMPORTED
CANDIDATE_EVIDENCE_REJECTED
```

These events do not directly commit final state. They feed guard, evidence, and
closing evaluation.

## Fixtures

### VF-ARTIFACT-001 - Core Skill Hash Drift Blocks Auto Invocation

Input:

```yaml
artifact:
  artifact_id: skill.pfv4-stop-gate
  lifecycle: mvp_core
  manifest_hash: hash_current
  installed_hash: hash_old
request:
  operation: auto_invoke
```

Expected outcome: `BLOCK`

Expected checks:

- Drift policy returns `ARTIFACT_DRIFT_BLOCKED`.
- `pfv4-stop-gate` is not invoked.
- Required action is sync or reconcile the installed artifact.

### VF-ARTIFACT-002 - Reference doc Policy Contradiction Blocks Executable Reliance

Input:

```yaml
reference_doc_claim:
  doc_ref: docs/risk-and-policy.md
  claim: M risk may use bypass after self-review
registry_rule:
  policy_ref: risk_policy.M.bypass_forbidden
run:
  risk_class: M
```

Expected outcome: `BLOCK`

Expected checks:

- Registry wins over reference doc prose.
- Drift evidence is recorded.
- Bypass remains blocked.

### VF-ARTIFACT-003 - Display-Only Reference Doc Drift Warns For L Work

Input:

```yaml
reference_doc_claim:
  doc_ref: docs/cycle-playbooks.md
  issue: display_alias_typo
affected_guard: none
run:
  risk_class: L
```

Expected outcome: `PASS`

Expected checks:

- Drift decision is `warn`.
- Evidence records documentation debt.
- No executable guard is weakened.

### VF-SUBAGENT-004 - Schema-Less Packet Is Rejected

Input:

```yaml
subagent_result:
  subagent: evidence-auditor
  schema_version: MISSING
  verdict: approve
  findings: []
```

Expected outcome: `BLOCK`

Expected checks:

- Intake returns `SUBAGENT_PACKET_SCHEMA_INVALID`.
- Verdict cannot satisfy evidence requirements.
- Rejection event is recorded.

### VF-SUBAGENT-005 - Stale Packet Cannot Satisfy M Review

Input:

```yaml
packet:
  schema_version: subagent-evidence-packet-v1
  subagent: evidence-auditor
  basis:
    state_refs: [state_v10]
  verdict:
    result: approve
events:
  latest_state_change: state_v12
risk_class: M
```

Expected outcome: `BLOCK`

Expected checks:

- Packet may be retained as stale rejected evidence.
- M independent review remains unsatisfied.
- Required action is rerun subagent against `state_v12`.

### VF-HUMAN-001 - Vague Approval Is Invalid For H risk

Input:

```yaml
checkpoint:
  checkpoint_type: risk_acceptance
  status: approved
  risk_class: H
  decision_text: looks good
  allowed_next_action: UNKNOWN
```

Expected outcome: `BLOCK`

Expected checks:

- Checkpoint returns `HUMAN_CHECKPOINT_AMBIGUOUS`.
- H-risk action remains blocked.
- A precise allowed action and evidence refs are required.

### VF-HUMAN-002 - Expired Approval Cannot Authorize Action

Input:

```yaml
checkpoint:
  status: approved
  expires_at: "2026-05-03T01:00:00Z"
request:
  timestamp: "2026-05-03T02:00:00Z"
  action: apply_migration_to_declared_files
```

Expected outcome: `BLOCK`

Expected checks:

- Checkpoint is marked expired or invalid for the action.
- Guard requires renewal or reroute.

### VF-HUMAN-003 - Approval For Wrong Path Blocks

Input:

```yaml
checkpoint:
  status: approved
  target_paths: ["src/migrations/001.sql"]
request:
  action: write_file
  target_path: "src/migrations/002.sql"
```

Expected outcome: `BLOCK`

Expected checks:

- Guard returns `HUMAN_CHECKPOINT_SCOPE_MISMATCH`.
- Approval cannot be broadened by inference.

### VF-HUMAN-004 - Rejected Checkpoint Blocks Same Request

Input:

```yaml
checkpoint:
  status: rejected
  allowed_transition_id: build_to_validation
request:
  transition_id: build_to_validation
  material_change_since_rejection: false
```

Expected outcome: `BLOCK`

Expected checks:

- Same request cannot proceed.
- A retry requires new evidence or changed scope.

### VF-CAND-001 - Inactive Architecture Doc Is Supporting Only

Input:

```yaml
candidate:
  origin_activation: inactive
  candidate_type: architecture_contract
import_request:
  evidence_type: design-rationale
  authority_requested: supporting_evidence
```

Expected outcome: `PASS`

Expected checks:

- Candidate imports as supporting evidence.
- It cannot satisfy runtime verification or final `DONE_VERIFIED` alone.
- Provenance and original hash are retained.

### VF-CAND-002 - Candidate Requests Verification Authority

Input:

```yaml
candidate:
  origin_kind: inactive_architecture_run
import_request:
  evidence_type: verification_result
  authority_requested: authoritative_verification
```

Expected outcome: `BLOCK`

Expected checks:

- Import returns `CANDIDATE_AUTHORITY_DENIED`.
- Artifact remains candidate or imports only after retargeting to supporting
  evidence.

### VF-CAND-003 - Candidate Conflicts With Registry

Input:

```yaml
candidate_claim:
  claim: H risk may use bypass
registry_rule:
  policy_ref: risk_policy.H.bypass_forbidden
import_request:
  conflict_policy: block_on_policy_conflict
```

Expected outcome: `BLOCK`

Expected checks:

- Registry wins.
- Candidate is rejected or recorded as conflict evidence.
- Runtime guard is not weakened.

### VF-CAND-004 - Stale Candidate Imports With Gap Only

Input:

```yaml
candidate:
  content_hash: hash_a
  created_before_event: evt_route_v1
events:
  latest_route_event: evt_route_v2
import_request:
  freshness_against_event: evt_route_v2
risk_class: L
```

Expected outcome: `PASS`

Expected checks:

- Import is allowed only with an explicit freshness gap.
- Evidence cannot contribute to `DONE_VERIFIED` until refreshed or reviewed.

## Decision Status

| P0 blocker | Status | Closing contract |
|---|---|---|
| Skill/hook/subagent manifest and drift policy | `closed_by_contract` | Artifact manifest, drift policy, event types, and fixtures. |
| Subagent output intake | `closed_by_contract` | Evidence packet schema, intake checks, acceptance semantics, fixtures. |
| Human checkpoint schema | `closed_by_contract` | `HumanCheckpoint` fields, legality rules, invalidation, fixtures. |
| Inactive/non-development artifact import | `closed_by_contract` | `CandidateEvidence` and import protocol with authority limits and fixtures. |

## Implementation Notes

- JSON Schema should use `additionalProperties: false` for all objects.
- `null` is invalid; use `UNKNOWN`, `UNSET`, or `NOT_APPLICABLE`.
- Hashes should be computed over canonical normalized content, not platform
  line-ending variants.
- Runtime adapters may report drift, but only the kernel decides whether drift
  blocks, warns, or degrades.
- These contracts do not add new direct writers to `.rms/`; all accepted
  packets, checkpoints, and imports still pass through kernel transaction rules.
