# Behaviors Catalog — Pipeline Fractale v4

> **Status**: PLANNED (draft)
> **Spec version**: 0.1
> **Date**: 2026-05-20
> **Scope**: hima runtime kernel — all platforms (Claude Code / Codex / Hermes)
> **Dependencies**: `00-canonical-runtime-contract.md`, `03-rms-sets-schema.md`,
> `04-runtime-bindings-spec.md`, `05-gates-policy-spec.md`, `06-skills-catalog-spec.md`,
> `07-subagents-catalog-spec.md`, `08-planning-state-schema.md`
> **Source of truth**: this document for the Conception cycle
>
> **Claim-bearing**: yes — every behavior entry carries a `Falsifies-If` block per
> `05-gates-policy-spec.md §8.4`.

---

## Sommaire

1. [Purpose and positioning](#1-purpose-and-positioning)
2. [Relation to Skills and Subagents catalogs](#2-relation-to-skills-and-subagents-catalogs)
3. [Behavior entry schema](#3-behavior-entry-schema)
4. [Catalog — Foundational](#4-catalog--foundational)
5. [Catalog — Epistemic quality](#5-catalog--epistemic-quality)
6. [Catalog — Enforcement teeth](#6-catalog--enforcement-teeth)
7. [Catalog — Delegation and watcher](#7-catalog--delegation-and-watcher)
8. [Coverage status index](#8-coverage-status-index)
9. [GateType count resolution (7 vs 9)](#9-gatetype-count-resolution-7-vs-9)
10. [Open backlog items](#10-open-backlog-items)

---

## 1. Purpose and positioning

A **behavior** is a named, gate-enforced invariant that governs *how* the runtime agent reasons
and acts — orthogonal to *what* work it performs (Skills) and *who* it delegates to (Subagents).
Behaviors are not soft guidelines; each one is enforced at one or more canonical `GateType` points
and produces or requires a specific `EvidenceRecord` in `.planning/run-set.json`.

Three first-class governed artifacts now exist in the hima catalog:

| Artifact | Governs | Catalog |
|---|---|---|
| **Skill** | What workflow to execute | `06-skills-catalog-spec.md` |
| **Subagent** | Who executes a delegated task | `07-subagents-catalog-spec.md` |
| **Behavior** | How the runtime reasons and acts | this document |

Skills and Subagents describe *capability*. Behaviors describe *epistemic and procedural discipline*
that applies regardless of which skill or subagent is active. A behavior can constrain many skills;
a skill never overrides a behavior.

### 1.1 Why a separate catalog is needed

The prior harness relied on two mechanisms that this catalog replaces or supplements:

1. **Keyword/regex scanners over output text** — these produce false positives when an agent
   merely *discusses* a concept whose keyword appears in prose, and false negatives when genuine
   shortcut work bypasses the trigger word entirely. Action-signal classification based on tool
   semantics and argument shape is strictly more reliable (see BEH-000).

2. **Development-entry auto-promotion as a proxy for intent** — promoting the `development_entry`
   field when the agent discusses implementation does not verify that implementation evidence
   actually exists. A dedicated evidence-state classifier at the `post_tool` gate closes this gap.

The Behaviors Catalog makes these invariants explicit, testable, and falsifiable.

---

## 2. Relation to Skills and Subagents catalogs

### 2.1 Vocabulary contract

All terms in this document conform to the canonical vocabulary established in
`00-canonical-runtime-contract.md`. Specifically:

- Gate points are identified by `GateType` values (`session_start`, `user_prompt`, `pre_tool`,
  `post_tool`, `pre_compact`, `post_compact`, `stop`, `subagent_start`, `subagent_stop`) —
  never by raw adapter event names such as `PreToolUse` or `SessionStart`.
- Risk is expressed as `RiskClass` ∈ { `T`, `L`, `M`, `H`, `C` } with ordinal rank 0–4.
  Risk classes are compared by rank, never lexicographically.
- Operating modes are `bypass | auto | pairing` only. Checkpoint and visibility are policy
  attributes of `auto`, not separate modes.
- Runtime state is written to exactly three canonical files: `.planning/state.yaml`,
  `.planning/current-risk.yaml`, `.planning/run-set.json`. No behavior may introduce
  a fourth physical runtime file.
- Subagents return structured JSON to the parent thread; the parent thread writes to
  `.planning/run-set.json`. Subagents never write to `.planning/` directly.
- Kill-switch and abort semantics are expressed as a `CYCLE_ABORT` event producing a
  `CANCELLED` `FinalState`, never as an external daemon process.

### 2.2 Behavior vs. Skill boundary

A Skill describes a *procedure* (ordered steps, inputs, outputs, evidence produced). A Behavior
describes an *invariant* (classifier, gate check, evidence key required/produced, block condition).
A skill may *satisfy* a behavior by producing the required evidence key. A behavior never encodes
business-domain logic; it encodes epistemic discipline.

### 2.3 Behavior vs. Subagent boundary

A Subagent is a typed delegate with its own scope, toolset, and deliverable contract. A behavior
may *require* a subagent (e.g., the critic-gate behavior requires a `reviewer` subagent result
in the Evidence Set) but is not itself a subagent. The watcher role is a behavior-defined subagent
role, not a free-standing autonomous process.

---

## 3. Behavior entry schema

Every entry in this catalog uses the following schema. All fields are mandatory unless marked
optional.

```yaml
id: BEH-NNN                          # Sequential, zero-padded, foundational first
name: <human-readable name>
coverage: IMPLEMENTED | PARTIAL | MISSING   # From coverage audit as of 2026-05-20
principle: |
  One paragraph. Describes WHY this invariant exists — the failure mode it prevents —
  and WHAT the gate does at a conceptual level. No implementation detail.

enforcing_gates:
  - <GateType>                       # One or more canonical GateType values

classifier:
  # MUST be action-signal based. Permitted signal sources:
  #   tool_type:   the name of the tool being invoked (Read, Write, Edit, Bash, etc.)
  #   tool_args:   the shape or content of tool arguments (file path, command text)
  #   file_diff:   the content of a file change (pattern in written bytes)
  #   evidence_state: the current contents of the EvidenceSet or RunSet
  #   prompt_pattern: structural features of the user prompt (NOT keyword presence in output)
  # NEVER: a regex applied to the agent's output text.
  method: <tool_type | tool_args | file_diff | evidence_state | prompt_pattern | composite>
  description: |
    Concrete description of what signal is read and how the classification decision is made.

evidence_key_produced: <run-set.json path or "none">
evidence_key_required: <run-set.json path or "none">

risk_floor: T | L | M | H | C       # Minimum risk class at which this behavior blocks (not just warns)

degraded_mode:
  codex: |
    Behavior when running on Codex. Codex lacks subagent_start/subagent_stop gates
    (runtime-profiles.ts: supported:false). Describe fallback.
  hermes: |
    Behavior when running on Hermes. Hermes stop gate is advisory (canBlock:false per
    runtime-profiles.ts:64). Describe fallback.

falsifies_if: |
  Precise, falsifiable condition under which this behavior's claim would be disproven.
  A single passing counter-example suffices. Must be concrete enough to derive a test.
```

---

## 4. Catalog — Foundational

---

### BEH-000 — Action-Signal Classification

```yaml
id: BEH-000
name: Action-Signal Classification
coverage: MISSING

principle: |
  The harness must classify agent actions from tool-semantic signals — tool type, argument
  shape, and file diff content — rather than from keyword or regex scanning of output text.
  Keyword scanners produce false positives: an agent that discusses a concept in prose
  triggers the keyword without performing the action. They produce false negatives: an
  agent that performs genuine shortcut work without using the trigger word escapes
  detection. The current development-entry auto-promotion proxy suffers both failure modes.
  This behavior establishes a unified action-signal classifier as the authoritative
  classification surface that all other behaviors in this catalog build upon.

  The classifier reads three signal channels at every gate event:
  (1) tool_type — the name of the tool invoked, which carries inherent semantic weight
      (Write implies state mutation; Read implies observation; Bash implies execution);
  (2) tool_args — the argument shape, which narrows intent (a Write to src/ in Execute
      subphase is expected; a Write to src/ in Observer subphase is anomalous);
  (3) file_diff — the byte-level content of what was written, which can confirm or
      contradict the declared intent.
  The classifier emits a structured ActionSignal record into run-set.json for every
  gate event. Downstream behaviors consume ActionSignal records; they do not re-read
  raw output text.

enforcing_gates:
  - pre_tool
  - post_tool

classifier:
  method: composite
  description: |
    At pre_tool: read toolName and toolInput from the GateEvent. Map toolName to a
    semantic class (READ_ONLY | WRITE_MUTATION | EXECUTE_SIDE_EFFECT | META_CONTROL).
    Extract the target path from toolInput and compare against the write-zone matrix
    for the current SubPhase. Produce an ActionSignal with fields:
      { toolName, semanticClass, targetPath, subPhase, phase, riskClass,
        zoneCompliance: "allowed" | "anomalous" | "forbidden" }
    At post_tool: read toolOutput and compute a content hash of any written bytes.
    Append { contentHash, linesAdded, linesRemoved, suppressionPatternFound: bool }
    to the ActionSignal record. Store in run-set.json#/events[].action_signal.

evidence_key_produced: .planning/run-set.json#/events[].action_signal
evidence_key_required: none

risk_floor: T

degraded_mode:
  codex: |
    pre_tool and post_tool are both supported on Codex with canBlock:true. No degradation.
    ActionSignal records are produced normally.
  hermes: |
    pre_tool is supported on Hermes with canBlock:true. post_tool canBlock is false but
    the gate still fires and can record. ActionSignal records are produced normally;
    content hash from post_tool is advisory on Hermes (cannot retroactively block).

falsifies_if: |
  A Write tool call completes against a path that is anomalous for the current SubPhase
  without producing an ActionSignal record in run-set.json#/events, OR a keyword appears
  in agent output text and triggers a gate decision in the absence of any corresponding
  tool call in the same gate window. Either case disproves the claim that classification
  is action-signal based.
```

---

## 5. Catalog — Epistemic quality

---

### BEH-010 — Read-Before-Write

```yaml
id: BEH-010
name: Read-Before-Write
coverage: MISSING

principle: |
  An agent must not write to a file path it has not read in the current session. Writing
  to an unread file creates silent state corruption: the agent cannot know whether its
  write is compatible with the current file contents. This is the most fundamental safety
  invariant for a write-gate harness. The gate tracks a session read-set — a set of
  canonical file paths that have been the target of a Read tool call in this run — and
  refuses Write or Edit tool calls whose target path is absent from the read-set. The
  constraint is path-exact: reading a directory listing does not count as reading a file.
  At risk class T or L the violation produces a warn; at M or above it produces a block.

enforcing_gates:
  - pre_tool

classifier:
  method: composite
  description: |
    Maintain a sessionReadSet: Set<string> field in GateEvaluationContext, populated on
    every post_tool event where toolName is "Read" and the call succeeded. At pre_tool,
    when toolName is "Write" or "Edit", check whether toolInput.file_path is present in
    sessionReadSet. If absent, emit a READ_BEFORE_WRITE_VIOLATION. Exception: new-file
    creation (path does not exist on disk) is allowed without a prior read.

evidence_key_produced: none (gate verdict only)
evidence_key_required: none

risk_floor: M

degraded_mode:
  codex: |
    pre_tool is supported and blocking on Codex. Full enforcement. No degradation.
  hermes: |
    pre_tool is supported and blocking on Hermes. Full enforcement. No degradation.

falsifies_if: |
  A Write or Edit tool call against an existing file path that was not read earlier in
  the same session completes without a READ_BEFORE_WRITE_VIOLATION gate event being
  recorded in run-set.json. One such unblocked mutation disproves this behavior.
```

---

### BEH-011 — Unjustified Suppression Guard

```yaml
id: BEH-011
name: Unjustified Suppression Guard
coverage: MISSING

principle: |
  Warning and lint suppressions inserted without an inline justification comment are silent
  quality holes: they hide real defects from static analysis while producing no audit trail.
  This behavior scans the content of every file write for suppression directives
  (eslint-disable, @ts-ignore, @ts-nocheck, #noqa, @SuppressWarnings) and requires that
  each directive be accompanied by an inline justification comment on the same line or
  the immediately preceding line. The anti-bypass-clause scanner covers gate-bypass patterns;
  this behavior covers tool-output suppression patterns in written source files.

enforcing_gates:
  - post_tool

classifier:
  method: file_diff
  description: |
    After a Write or Edit tool call, scan the written content for suppression directive
    patterns: eslint-disable, @ts-ignore, @ts-nocheck, #noqa, @SuppressWarnings (and
    language equivalents). For each match, check whether the same line or the immediately
    preceding line contains a comment token followed by non-whitespace text (the justification).
    If a suppression directive lacks a justification, emit UNJUSTIFIED_SUPPRESSION.
    The suppression directive pattern matching operates on file bytes, not on output text.

evidence_key_produced: none (gate verdict only; violation logged to run-set.json#/events)
evidence_key_required: none

risk_floor: M

degraded_mode:
  codex: |
    post_tool fires on Codex but canBlock is false. The violation is recorded in run-set.json
    and surfaces as a blocker at the stop gate via policy-event-blockers. The suppression
    is not prevented in-flight but does block DONE_VERIFIED.
  hermes: |
    Same as Codex — post_tool is observable but advisory. The violation propagates to the
    stop gate as a policy event. On Hermes the stop gate is also advisory (canBlock:false),
    so the violation produces a DONE_WITH_GAPS outcome rather than BLOCKED_POLICY. This
    is a known capability gap requiring the user's attention.

falsifies_if: |
  A file write containing an eslint-disable or @ts-ignore directive without an adjacent
  justification comment reaches DONE_VERIFIED without a UNJUSTIFIED_SUPPRESSION violation
  in run-set.json. One such case disproves this behavior.
```

---

### BEH-012 — Chesterton's Fence Delete Guard

```yaml
id: BEH-012
name: Chesterton's Fence Delete Guard
coverage: MISSING

principle: |
  No file or code block should be deleted unless the deleting agent can articulate why it
  exists. Irreversible deletions of code whose purpose is unknown are a recurring source
  of regressions. The principle — Chesterton's Fence — holds that a structure must not be
  removed until its purpose is understood. This behavior intercepts deletion tool calls,
  reads the first fifty lines of the deletion target to detect whether a rationale comment
  is present, and blocks or warns accordingly. A rationale comment is any comment token
  followed by one of the recognized rationale markers: why, rationale, purpose, NOTE,
  FIXME, TODO (the last two indicate the code is known-pending, which is sufficient to
  demonstrate awareness of purpose).

enforcing_gates:
  - pre_tool

classifier:
  method: composite
  description: |
    At pre_tool, detect deletion intent: toolName is "Bash" and toolInput.command matches
    a deletion pattern (rm, unlink, rimraf, del) targeting a file path, OR toolName is
    "Write" with empty content targeting an existing path (truncation-as-deletion).
    For each deletion target that exists on disk, read the first 50 lines of the target.
    Check for a comment line containing at least one of: why, rationale, purpose, NOTE,
    FIXME, TODO (case-insensitive). If absent, emit CHESTERTON_FENCE_VIOLATION.
    The classifier operates on tool arguments and file bytes, not on output text.

evidence_key_produced: none (gate verdict only)
evidence_key_required: none

risk_floor: M

degraded_mode:
  codex: |
    pre_tool is supported and blocking on Codex. Full enforcement. No degradation.
  hermes: |
    pre_tool is supported and blocking on Hermes. Full enforcement. No degradation.

falsifies_if: |
  A file deletion completes against an existing file that contains no recognized rationale
  comment, without a CHESTERTON_FENCE_VIOLATION being recorded in run-set.json. One such
  unblocked deletion disproves this behavior.
```

---

### BEH-013 — Calibrated Uncertainty / Claim Source

```yaml
id: BEH-013
name: Calibrated Uncertainty — Claim Source Field
coverage: MISSING

principle: |
  Agent claims vary in epistemic reliability depending on their source. A claim derived
  from a file read in the current session is verifiable. A claim derived from a grep
  match is inferential. A claim sourced from training-time knowledge is unverified.
  A claim citing an external URL or benchmark number is external and may be stale.
  Without explicit source tagging, DONE_VERIFIED can be reached on inferred or
  hallucinated evidence. This behavior requires that every EvidenceRecord written to
  the Evidence Set include a claimSource field declaring the epistemic origin of the
  claim. At risk class M and above, the stop gate requires at least one verified
  (read-from-disk in this session) evidence item per mandatory evidence key.

enforcing_gates:
  - stop

classifier:
  method: evidence_state
  description: |
    At the stop gate, iterate all EvidenceRecord entries in run-set.json#/evidenceSet
    that correspond to mandatory evidence keys for the current riskClass. For each
    mandatory key, check that at least one record carries claimSource: "verified"
    (meaning the evidence was produced by a Read or Grep tool call in this session
    against a file that exists on disk). If a mandatory key has only records with
    claimSource: "inferred" or "external", emit UNVERIFIED_MANDATORY_CLAIM and
    block DONE_VERIFIED for risk class M+.

evidence_key_produced: none (constraint on existing evidence records)
evidence_key_required: |
  EvidenceRecord.claimSource field present on all items in
  run-set.json#/evidenceSet (schema extension required)

risk_floor: M

degraded_mode:
  codex: |
    stop gate is supported and blocking on Codex. Full enforcement. No degradation.
  hermes: |
    stop gate is advisory on Hermes (canBlock:false). An UNVERIFIED_MANDATORY_CLAIM
    violation is recorded but cannot prevent completion. This produces DONE_WITH_GAPS.
    Hermes users should treat any DONE_WITH_GAPS outcome as requiring manual verification
    before promotion.

falsifies_if: |
  A run reaches DONE_VERIFIED at risk class M or above where a mandatory evidence key
  has no record with claimSource: "verified" in the Evidence Set. One such case
  disproves this behavior.
```

---

### BEH-014 — Anti-Sycophancy Re-Verify on Challenge

```yaml
id: BEH-014
name: Anti-Sycophancy — Re-Verify on Challenge
coverage: MISSING

principle: |
  When a user challenges a prior gate verdict or block decision, an agent that reverses
  its position without new evidence undermines the entire gate model. Capitulation to
  social pressure — the sycophancy failure mode — is indistinguishable from a legitimate
  reconsideration unless the reversal is accompanied by new evidence or a human override
  token. This behavior detects the structural pattern of a user prompt that follows a
  prior block verdict and asks for the blocked action to proceed, and requires either
  (a) a new evidence item that was absent at the time of the original block, or (b) an
  explicit human_override evidence key with a timestamped rationale, before the run
  may continue past the challenged decision point.

enforcing_gates:
  - user_prompt

classifier:
  method: prompt_pattern
  description: |
    At user_prompt gate, check whether the current RunSet.events log contains a recent
    gate event with verdict: "block" in the last N events (configurable, default 3).
    If yes, and if the incoming user prompt contains structural features indicating
    reversal intent — imperative phrases directed at the blocked action, explicit
    references to the prior block, or dismissal phrasing — check the EvidenceSet for
    either (a) a new EvidenceRecord with timestamp after the block event, or (b) a
    human_override record with non-empty rationale field. If neither is present,
    emit SYCOPHANCY_BYPASS_ATTEMPTED and inject context reminding the agent that
    re-verification evidence is required before proceeding.
    Prompt pattern detection operates on structural features (imperative mood,
    reference to prior decision) not on keyword presence in output text.

evidence_key_produced: none
evidence_key_required: |
  human_override evidence record OR new EvidenceRecord post-dating the prior block

risk_floor: L

degraded_mode:
  codex: |
    user_prompt is supported and blocking on Codex. Full enforcement. No degradation.
  hermes: |
    user_prompt is supported and blocking on Hermes. Full enforcement. No degradation.

falsifies_if: |
  A run resumes past a prior block verdict in response to a user challenge, without
  any new EvidenceRecord or human_override record post-dating the block, and reaches
  any non-BLOCKED FinalState. One such case disproves this behavior.
```

---

## 6. Catalog — Enforcement teeth

---

### BEH-020 — Critic Gate Before Verify-to-Capitalize Transition

```yaml
id: BEH-020
name: Critic Gate — Reviewer Required Before Verify-to-Capitalize
coverage: PARTIAL

principle: |
  The reviewer subagent is specified as mandatory at phase=build, sub_phase=Verify for
  risk class M and above (07-subagents-catalog-spec.md §2.1). However, this requirement
  is currently advisory: no gate blocks the transition from build/Verify to build/Capitalize
  if reviewer evidence is absent. An agent can skip the reviewer entirely and reach
  DONE_VERIFIED if other evidence items pass. This behavior makes the critic gate a
  runtime-enforced transition condition, not a soft recommendation. The Verify-to-Capitalize
  transition is gated on the presence of a reviewer subagent result in the Evidence Set
  for all runs at risk class M and above.

enforcing_gates:
  - subagent_stop

classifier:
  method: evidence_state
  description: |
    At the transition from build/Verify to build/Capitalize (enforced via
    transition-policy.ts evaluateTransitionGovernance), check that
    run-set.json#/evidence/subagents/reviewer is present and carries
    verdict: "APPROVED" or verdict: "CHANGES_REQUIRED" (both are valid; CHANGES_REQUIRED
    means the agent must act on objections before re-attempting). If the key is absent,
    emit MISSING_REVIEW_EVIDENCE with verdict: "block" for riskClass >= M.
    The classifier reads the evidence_state; it does not scan the agent's output text.

evidence_key_produced: none (constraint on transition precondition)
evidence_key_required: .planning/run-set.json#/evidence/subagents/reviewer

risk_floor: M

degraded_mode:
  codex: |
    subagent_start and subagent_stop are not supported on Codex (runtime-profiles.ts:
    supported:false). The reviewer subagent cannot be spawned or validated through the
    normal gate lifecycle. Degraded behavior: the transition check falls back to verifying
    that a review evidence record was manually appended to run-set.json by the parent
    thread using a pre_tool Write event. If no such record exists, the stop gate emits
    MISSING_REVIEW_EVIDENCE as a policy event blocker.
  hermes: |
    subagent_start is not supported on Hermes (supported:false). subagent_stop is
    observable but advisory (canBlock:false). Degraded behavior: same as Codex —
    fall back to evidence record presence check at stop gate. On Hermes the stop gate
    is also advisory, so the outcome is DONE_WITH_GAPS if reviewer evidence is absent.

falsifies_if: |
  A run at risk class M or above transitions from build/Verify to build/Capitalize and
  subsequently reaches DONE_VERIFIED without a reviewer evidence record in
  run-set.json#/evidence/subagents/reviewer. One such case disproves this behavior.
```

---

### BEH-021 — Dimension-Specific Retry and Escalation Policy

```yaml
id: BEH-021
name: Dimension-Specific Retry and Escalation Policy
coverage: MISSING

principle: |
  The current harness applies a uniform three-attempt cap to all quality failures,
  regardless of which quality dimension failed. A security finding and a missing test
  have fundamentally different recovery strategies: a security finding at risk class H
  should escalate to human review on the first failure, not after two retries; a missing
  unit test is recoverable autonomously within the standard cap. Collapsing all failure
  dimensions into the same retry/escalate path means the system either over-blocks on
  recoverable failures or under-reacts to security findings. This behavior introduces
  a qualityDimension field on gate violations and a per-dimension policy that varies
  the retry count and escalation trigger accordingly.

enforcing_gates:
  - stop
  - subagent_stop

classifier:
  method: evidence_state
  description: |
    When a gate violation is emitted, classify it by qualityDimension:
      "security"    — SAST finding, threat model gap, ASVS violation
      "tests"       — missing unit/integration/e2e test, red test not resolved
      "review"      — MISSING_REVIEW_EVIDENCE, CHANGES_REQUIRED unresolved
      "evidence"    — DONE_WITHOUT_EVIDENCE, UNVERIFIED_MANDATORY_CLAIM
      "suppression" — UNJUSTIFIED_SUPPRESSION
    Apply dimension-specific policy from PolicyConfig.dimensionRetryPolicy:
      security:   maxAttempts=1, escalateImmediately=true  (for H/C)
      tests:      maxAttempts=3, escalateImmediately=false
      review:     maxAttempts=2, escalateImmediately=false
      evidence:   maxAttempts=2, escalateImmediately=true  (for H/C)
      suppression: maxAttempts=3, escalateImmediately=false

evidence_key_produced: none
evidence_key_required: none

risk_floor: M

degraded_mode:
  codex: |
    stop gate is supported and blocking on Codex. Dimension policy applies normally.
  hermes: |
    stop gate is advisory on Hermes. Dimension escalation policy is recorded but
    cannot force a block. Outcomes degrade to DONE_WITH_GAPS for escalation cases.

falsifies_if: |
  A security-dimension gate violation at risk class H occurs and the run continues
  to a second attempt without a BLOCKED_NEEDS_USER event being emitted, OR a
  tests-dimension violation at risk class M causes an immediate BLOCKED_NEEDS_USER
  on the first attempt without exhausting the three-attempt cap. Either case disproves
  this behavior's per-dimension policy claims.
```

---

### BEH-022 — Loop Detection with LOOP_DETECTED Final State Emission

```yaml
id: BEH-022
name: Loop Detection — Sliding Window with LOOP_DETECTED Emission
coverage: MISSING

principle: |
  LOOP_DETECTED is a registered FinalState in canonical.ts but nothing in the runtime
  currently produces it. The state-machine spec references stateVisitCounts but the
  machine.ts implementation is a stub. Without a functioning loop detector, an agent
  can spin indefinitely on identical tool calls, accumulating cost with no progress
  and no termination signal. This behavior implements a sliding-window loop detector:
  a bounded ring buffer of (toolName, argsHash, resultHash) triples accumulated from
  run-set.json events. Two identical consecutive triples produce a warn; three produce
  a block with LOOP_DETECTED as the FinalState. The detector operates on the event log,
  not on output text.

enforcing_gates:
  - post_tool

classifier:
  method: composite
  description: |
    After every post_tool event, compute (toolName, argsHash(toolInput),
    resultHash(toolOutput)) where argsHash and resultHash are stable content hashes
    (e.g., SHA-256 of JSON-canonical serialization). Maintain a bounded ring buffer
    of the last 10 triples in the run context. If the current triple matches the
    immediately preceding triple: warn (LOOP_WARNING). If the current triple matches
    the two immediately preceding triples (three consecutive identical triples):
    emit LOOP_DETECTED with verdict: "block" and finalState: "LOOP_DETECTED".
    The ring buffer lives in run-set.json#/loopDetector for persistence across
    context compaction events.

evidence_key_produced: .planning/run-set.json#/loopDetector (ring buffer)
evidence_key_required: none

risk_floor: T

degraded_mode:
  codex: |
    post_tool fires on Codex but canBlock is false. LOOP_DETECTED cannot force
    termination in-flight. The violation is promoted to a stop gate blocker via
    policy-event-blockers, producing BLOCKED_POLICY at the next stop attempt.
  hermes: |
    Same as Codex for post_tool. Additionally, stop gate on Hermes is advisory.
    LOOP_DETECTED on Hermes produces DONE_WITH_GAPS unless the user intervenes.
    This is a critical capability gap for Hermes on long-running tasks.

falsifies_if: |
  Three consecutive post_tool events with identical (toolName, argsHash, resultHash)
  triples occur within a single run without a LOOP_DETECTED block verdict being emitted.
  One such sequence disproves this behavior.
```

---

### BEH-023 — Three-State Completion Status

```yaml
id: BEH-023
name: Three-State Completion Status
coverage: PARTIAL

principle: |
  The current stop gate distinguishes only two completion states: evidence sufficient
  (DONE_VERIFIED) and evidence insufficient (DONE_WITHOUT_EVIDENCE). The intermediate
  state — work implemented but not yet tested, or action attempted but result unconfirmed
  — has no type-system representation. This gap means an agent can present a half-verified
  result as DONE_VERIFIED, or fail to communicate the distinction between a tested result
  and an untested one. This behavior introduces a three-value completion status on
  EvidenceRecord items: DONE_VERIFIED (implemented and verified), DONE_UNTESTED
  (implemented but tests not run or passing), ATTEMPTED_UNCONFIRMED (action attempted
  but outcome not confirmed by a subsequent read or test). The stop gate checks for
  DONE_UNTESTED or ATTEMPTED_UNCONFIRMED items and emits a warn (L/M) or block (H/C).

enforcing_gates:
  - stop

classifier:
  method: evidence_state
  description: |
    At the stop gate, scan all EvidenceRecord items in run-set.json#/evidenceSet for
    completionStatus field. If any mandatory evidence key carries
    completionStatus: "DONE_UNTESTED" or "ATTEMPTED_UNCONFIRMED":
      - riskClass T/L: emit warn, allow DONE_WITH_GAPS
      - riskClass M:   emit warn, require agent to upgrade or explicitly acknowledge
      - riskClass H/C: emit block, require upgrade to DONE_VERIFIED

evidence_key_produced: none (constraint on EvidenceRecord schema field)
evidence_key_required: |
  EvidenceRecord.completionStatus field present on all items
  (schema extension to run-set.json#/evidenceSet records required)

risk_floor: H

degraded_mode:
  codex: |
    stop gate is supported and blocking on Codex. Full enforcement. No degradation.
  hermes: |
    stop gate is advisory on Hermes. Block degrades to DONE_WITH_GAPS.

falsifies_if: |
  A run at risk class H or C reaches DONE_VERIFIED where any mandatory evidence record
  carries completionStatus: "DONE_UNTESTED" without a subsequent record upgrading it
  to "DONE_VERIFIED". One such case disproves this behavior.
```

---

## 7. Catalog — Delegation and watcher

---

### BEH-030 — Subagent Contract Schema Completeness

```yaml
id: BEH-030
name: Subagent Contract Schema — Budget and Failure Protocol Fields
coverage: PARTIAL

principle: |
  The subagent_start gate validates that a subagent contract carries objective, task,
  scope, deliverables, and tool policy. Two fields that govern safety and cost are
  currently absent from the contract schema: (1) a budget field (maxTurns, timeoutMs)
  that constrains how long a subagent may run before the parent thread treats it as
  failed, and (2) a failurePolicy field that declares what the parent should do on
  timeout, error, or deliverable-missing outcomes (gap | retry | block). Without these
  fields the parent thread has no machine-readable instruction for subagent failure
  recovery; it falls back to ad-hoc behavior. This behavior requires both fields to be
  present in the SubagentInput at subagent_start for risk class M and above.

enforcing_gates:
  - subagent_start

classifier:
  method: tool_args
  description: |
    At subagent_start, read the SubagentInput metadata. Check for the presence of:
      metadata.budget.maxTurns: number (required at M+)
      metadata.budget.timeoutMs: number (required at H/C)
      metadata.failurePolicy.onTimeout: "gap" | "retry" | "block" (required at M+)
      metadata.failurePolicy.onError: "gap" | "retry" | "block" (required at M+)
      metadata.failurePolicy.maxRetries: number (required if onError is "retry")
    If any required field is absent for the current riskClass, emit
    SUBAGENT_CONTRACT_INCOMPLETE and block the spawn.

evidence_key_produced: none (gate verdict only)
evidence_key_required: none

risk_floor: M

degraded_mode:
  codex: |
    subagent_start is not supported on Codex (runtime-profiles.ts: supported:false).
    Contract validation cannot occur at spawn time. The parent thread must validate
    the SubagentInput schema before issuing the delegate_task call. Violation is
    recorded as a WARN in run-set.json if the validation is performed via a pre_tool
    Write check on the subagent definition file.
  hermes: |
    subagent_start is not supported on Hermes. Same degraded path as Codex.

falsifies_if: |
  A subagent is spawned at risk class M or above with a SubagentInput that lacks the
  budget or failurePolicy fields without a SUBAGENT_CONTRACT_INCOMPLETE block verdict
  being emitted. One such spawn disproves this behavior.
```

---

### BEH-031 — Watcher Subagent Role for High-Risk Runs

```yaml
id: BEH-031
name: Watcher Subagent — Required for H/C Risk Class
coverage: MISSING

principle: |
  High-risk and critical-risk runs require continuous observability that a single linear
  gate chain cannot provide. A watcher subagent is a read-only, evidence-collecting role
  whose sole purpose is to monitor the event log of the parent run and surface anomalies
  — repeated violations, stalled progress, evidence gaps — back to the parent thread
  through the standard subagent output mechanism. The watcher is not a daemon; it operates
  as repeated subagent_start/subagent_stop cycles on the event log, consistent with the
  no-daemon constraint in the canonical contract (05-gates-policy-spec.md §7.2). The
  subagent_start gate checks for a registered watcher in the active SubagentRunRecord
  list when riskClass is H or C, and emits a warn if none is present.

enforcing_gates:
  - subagent_start

classifier:
  method: evidence_state
  description: |
    At every subagent_start event where the current riskClass is H or C, check
    run-set.json#/runSet/subagents for an entry with role: "watcher" and
    status: "requested" | "running" | "completed". If no such entry exists, emit
    WATCHER_NOT_REGISTERED as a warn. The watcher must have:
      allowedTools: [Read, Grep]   (read-only — no Write, no Bash)
      scope: [".planning/"]        (event log and run state only)
      role: "watcher"
    The parent thread is responsible for writing watcher output to
    run-set.json#/evidence/subagents/watcher — the watcher never writes directly.

evidence_key_produced: .planning/run-set.json#/evidence/subagents/watcher
evidence_key_required: none

risk_floor: H

degraded_mode:
  codex: |
    subagent_start is not supported on Codex. The watcher cannot be spawned via the
    gate. The parent thread must manually register a watcher record in run-set.json
    before beginning work at H/C. If not present, a WATCHER_NOT_REGISTERED warn is
    emitted at the next stop gate check via policy-event-blockers.
  hermes: |
    subagent_start is not supported on Hermes. Same degraded path as Codex.
    On Hermes, stop gate is advisory, so the warn does not block. This is an accepted
    capability gap for Hermes at H/C risk; users are responsible for external oversight.

falsifies_if: |
  A run at risk class H or C completes without any watcher SubagentRunRecord in
  run-set.json#/runSet/subagents and without a WATCHER_NOT_REGISTERED event in
  the gate event log. One such completion disproves this behavior.
```

---

### BEH-032 — In-Band Kill Switch via CYCLE_ABORT

```yaml
id: BEH-032
name: In-Band Kill Switch — CYCLE_ABORT Event
coverage: PARTIAL

principle: |
  An operator must be able to terminate a running agent session immediately and
  produce an auditable abort record. The canonical mechanism is the CYCLE_ABORT event,
  which transitions the state machine to the CANCELLED FinalState and writes an
  abort-report entry to run-set.json. No out-of-band daemon or external kill signal
  is used; the kill switch is in-band and expressed as a gate event, consistent with
  the no-daemon constraint. The CYCLE_ABORT event must be invokable via the CLI
  (harness abort) and via a dedicated MCP tool. The abort record must include: runId,
  ts, triggeredBy (human | gate | policy), reason, and the last 10 gate events from
  the ring buffer for post-mortem use.

enforcing_gates:
  - user_prompt
  - pre_tool

classifier:
  method: prompt_pattern
  description: |
    At user_prompt, detect an explicit abort instruction (structural: imperative directed
    at stopping the current run, not general negation). On detection, or on programmatic
    invocation via CLI/MCP, emit CYCLE_ABORT event, set FinalState to CANCELLED, and
    write abort-report to run-set.json#/abort_reports[]. The report includes the last
    10 ActionSignal entries from the loop detector ring buffer (BEH-022) if available.

evidence_key_produced: .planning/run-set.json#/abort_reports[]
evidence_key_required: none

risk_floor: T

degraded_mode:
  codex: |
    user_prompt is supported on Codex. In-band abort works normally.
  hermes: |
    user_prompt is supported on Hermes. In-band abort works normally. The stop gate
    advisory limitation does not affect abort — CYCLE_ABORT bypasses the stop gate
    and writes directly to FinalState: CANCELLED.

falsifies_if: |
  A CYCLE_ABORT event is triggered (via CLI or prompt) and the run does not transition
  to FinalState: CANCELLED, or no abort-report entry appears in run-set.json#/abort_reports.
  Either condition disproves this behavior.
```

---

## 8. Coverage status index

Summary of behavior coverage as of 2026-05-20, derived from the three coverage audit files
in `.planning/behavior-system/`.

| ID | Name | Coverage | Primary gap |
|---|---|---|---|
| BEH-000 | Action-Signal Classification | MISSING | Replaces keyword/regex scanners; foundational for all other behaviors |
| BEH-010 | Read-Before-Write | MISSING | No sessionReadSet in GateEvaluationContext |
| BEH-011 | Unjustified Suppression Guard | MISSING | anti-bypass-clause.ts covers gate bypass; file-content suppression scan is absent |
| BEH-012 | Chesterton's Fence Delete Guard | MISSING | No deletion-target rationale scanner in pre_tool |
| BEH-013 | Calibrated Uncertainty / Claim Source | MISSING | No claimSource field on EvidenceRecord |
| BEH-014 | Anti-Sycophancy Re-Verify | MISSING | No challenge-then-capitulate pattern detector |
| BEH-020 | Critic Gate Before Verify-to-Capitalize | PARTIAL | Reviewer is advisory in spec; not a runtime-enforced transition condition |
| BEH-021 | Dimension-Specific Retry Policy | MISSING | Uniform 3-attempt cap across all quality dimensions |
| BEH-022 | Loop Detection with LOOP_DETECTED Emission | MISSING | LOOP_DETECTED FinalState registered but never emitted |
| BEH-023 | Three-State Completion Status | PARTIAL | Only binary sufficient/insufficient; DONE_UNTESTED has no type |
| BEH-030 | Subagent Contract — Budget and Failure Fields | PARTIAL | Budget and failurePolicy fields absent from SubagentInput schema |
| BEH-031 | Watcher Subagent for H/C | MISSING | No watcher role in SubagentRunRecord schema |
| BEH-032 | In-Band Kill Switch / CYCLE_ABORT | PARTIAL | CYCLE_ABORT event and writeAbortReport exist; CLI/MCP surface and ring-buffer inclusion are incomplete |

Implementation priority order (highest leverage first):
1. BEH-000 — foundational; all other behaviors depend on reliable signal sourcing
2. BEH-022 — loop detection; LOOP_DETECTED is a registered but dead FinalState
3. BEH-020 — critic gate; reviewer skip is the largest quality hole in the current gate chain
4. BEH-010 — read-before-write; highest-impact safety gap for a write-gate harness
5. BEH-011 + BEH-012 — suppression guard + delete guard; pair naturally as post_tool and pre_tool extensions

---

## 9. GateType count resolution (7 vs 9)

### Current inconsistency

Two canonical documents disagree on the number of `GateType` values:

- `00-canonical-runtime-contract.md §6` (lines 148–156) lists **7 GateTypes**:
  `session_start`, `user_prompt`, `pre_tool`, `post_tool`, `stop`,
  `subagent_start`, `subagent_stop`.

- `05-gates-policy-spec.md §1` (lines 28–39) lists **9 GateTypes**, adding:
  `pre_compact` and `post_compact`.

This is a pre-existing internal inconsistency identified in
`.planning/behavior-system/reconciliation-and-contradictions.md §2 C-1`.

### Recommendation

Adopt the 9-gate set from `05-gates-policy-spec.md` as the operative definition.
The rationale: `pre_compact` and `post_compact` are already implemented in the runtime
(`packages/core/src/gates/compaction-continuity.ts`, `evaluate-gate.ts:629–660`),
already have semantic detail in §1 of the gates-policy spec, and serve a distinct
function (context-compaction continuity) that none of the 7 existing gates covers.
Omitting them from the canonical contract is a documentation gap, not an architectural
decision. The 7-gate list in the canonical contract should be updated to 9.

### Required action

An Architecture Decision Record is needed before this spec can move from PLANNED to
ACCEPTED. The ADR should formally adopt the 9-gate set and update
`00-canonical-runtime-contract.md §6` to list all nine values. Until the ADR is
recorded, this spec treats 9 gates as operative and notes the discrepancy explicitly.

This document itself uses all 9 `GateType` values (see BEH entries above) because
the compaction gates are already live in the implementation.

---

## 10. Open backlog items

These items were identified during the reconciliation pass and the coverage audits.
They are tracked here as explicit open work, not silent assumptions.

| Item | Source | Priority |
|---|---|---|
| ADR for 7→9 GateType adoption | §9 above | High — blocks PLANNED→ACCEPTED transition |
| `claimSource` field on EvidenceRecord schema | BEH-013 | High — schema change in `run-set.schema.ts` and `canonical.ts` |
| `completionStatus` field on EvidenceRecord | BEH-023 | High — schema change |
| `budget` + `failurePolicy` fields on SubagentInput | BEH-030 | Medium — schema change in subagent types |
| `role: "watcher"` added to SubagentRunRecord role enum | BEH-031 | Medium — schema change |
| `qualityDimension` field on GateViolationType context | BEH-021 | Medium — type system extension |
| `dimensionRetryPolicy` in PolicyConfig | BEH-021 | Medium — policy schema extension |
| `sessionReadSet` in GateEvaluationContext | BEH-010 | High — runtime context extension |
| LoopDetector ring buffer in run-set.json | BEH-022 | High — new schema section |
| Transition guard in transition-policy.ts for BEH-020 | BEH-020 | High — behavior change |
| transcript retention for H/C sessions (non-benchmark) | coverage-C §7.13 | Low — policy extension |

---

*Trace: `.planning/behavior-system/spec-draft-notes.md`*
*Coverage audit sources: `.planning/behavior-system/coverage-A-epistemic-quality.md`,
`.planning/behavior-system/coverage-B-strategic-decisional.md`,
`.planning/behavior-system/coverage-C-comms-exec-enforcement.md`*
*Reconciliation source: `.planning/behavior-system/reconciliation-and-contradictions.md`*
