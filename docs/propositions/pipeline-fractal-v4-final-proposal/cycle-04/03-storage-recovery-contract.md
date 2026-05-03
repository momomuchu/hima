# 03 - Storage Recovery Contract

Status: Cycle 04 storage recovery contract

## Purpose

This contract closes the storage recovery blocker left by Cycle 02 and Cycle 03.
It turns the event-sourced `.rms/` storage rules into deterministic startup and
mutation behavior for these failure classes:

- pending transaction after restart;
- stale run lock;
- corrupt or contradictory snapshot;
- partial append or invalid JSONL line;
- broken event digest chain;
- snapshot rebuild and replay;
- concurrent writer conflict;
- final-state implications.

The contract preserves the Cycle 02 authority order:

```text
event log = authoritative history
snapshot  = rebuildable projection
manifest  = index over committed event digest and snapshot refs
lock      = concurrency hint, never authority
transaction intent = recovery evidence, never committed state by itself
```

## Non-Negotiable Invariants

| Invariant | Rule |
|---|---|
| Append before projection | A mutation succeeds only after the event line is durably appended and digest-linked. |
| No event rewrite | Recovery never edits, reorders, truncates, or silently repairs committed event lines. |
| Replay wins | If replay and snapshot disagree, snapshot is invalid and must be rebuilt or blocked. |
| Pending is blocking | New governed transitions are blocked while unresolved pending transactions exist. |
| Locks are not truth | A lock can be broken by recovery rules, but cannot prove a transaction committed. |
| Corruption is explicit | Malformed events, digest breaks and unrebuildable snapshots enter integrity states. |
| Closed is stricter | Closed runs allow only append-only audit/recovery/correction events, not protected mutation. |
| No null recovery | Recovery records explicit sentinels such as `UNKNOWN`, `UNSET`, `NOT_APPLICABLE` and recovery status values. |

## Recovery State Machine

Startup and each mutating transaction evaluate a storage integrity state before
guard evaluation.

```text
UNCHECKED
  -> HEALTHY
  -> RECOVERY_REQUIRED
  -> RECOVERING
  -> RECOVERED
  -> DEGRADED_READ_ONLY
  -> BLOCKED_CORRUPT_LOG
  -> BLOCKED_DIGEST_CHAIN
  -> BLOCKED_PENDING_TX
  -> BLOCKED_LOCK_CONFLICT
```

### State Definitions

| State | Meaning | Writes allowed | Reads allowed | Required next action |
|---|---|---|---|---|
| `UNCHECKED` | Storage has not been inspected in this process. | No | No authoritative reads | Run startup integrity scan. |
| `HEALTHY` | Manifest, event log, digest chain, pending dirs and current snapshot agree. | Yes | Yes | Normal operation. |
| `RECOVERY_REQUIRED` | A recoverable mismatch exists. | Recovery only | Degraded reads may show last valid prefix | Enter recovery transaction. |
| `RECOVERING` | Recovery holds run lock and is resolving storage. | Recovery only | Degraded reads only | Complete or fail recovery. |
| `RECOVERED` | Recovery finished and projections/manifest now match event replay. | Yes after recheck | Yes | Emit or expose recovery result. |
| `DEGRADED_READ_ONLY` | Valid prefix exists but authoritative mutation is unsafe. | No | Valid prefix only, marked degraded | Operator or kernel repair. |
| `BLOCKED_CORRUPT_LOG` | Event log has malformed or invalid JSON before a complete valid suffix cannot be proven. | No | Valid prefix only if policy permits | Manual quarantine or restore. |
| `BLOCKED_DIGEST_CHAIN` | Event digest chain breaks in committed history. | No | Valid prefix only if policy permits | Manual decision; no automatic repair. |
| `BLOCKED_PENDING_TX` | Pending transaction cannot be resolved automatically. | No | Yes, marked blocked | Mark failed if log writable or require operator repair. |
| `BLOCKED_LOCK_CONFLICT` | Active non-stale lock or writer generation conflict exists. | No | Yes | Retry after lock release or stale-lock recovery. |

## Startup Integrity Algorithm

On `rms.startup`, `rms.get_state`, `rms.transition`, `rms.record_evidence`,
`rms.evaluate_convergence`, `rms.close_run`, or local transaction fallback load,
the kernel runs these checks in order:

1. Validate registry availability and run manifest JSON.
2. Check for an active run lock and decide whether it is current, stale or
   foreign.
3. Parse `events.jsonl` line by line as JSONL.
4. Validate each complete line against `event.schema.json`.
5. Recompute each event digest and verify `prev_event_digest`.
6. Compare latest valid event digest with `run-manifest.json.event_log_digest`.
7. Enumerate `transactions/pending/*.json`, `committed/*.json` and
   `failed/*.json`.
8. Validate current snapshot refs and embedded source event digest.
9. Replay events to an in-memory projection.
10. Compare replay projection to snapshots and manifest final-state fields.
11. Enter one integrity state and return it with every startup response.

The scan is deterministic. If multiple problems exist, precedence is:

```text
corrupt committed event
> digest chain break
> unresolved pending transaction
> active non-stale lock
> manifest/event mismatch
> snapshot corruption
> stale generated cache
```

## Transaction State Machine

Each mutating operation creates one transaction intent and moves it through this
state machine:

```text
PLANNED
  -> LOCK_ACQUIRED
  -> VALIDATED
  -> INTENT_WRITTEN
  -> EVENT_APPENDED
  -> PROJECTIONS_WRITTEN
  -> MANIFEST_UPDATED
  -> COMMITTED

Failure exits:
  VALIDATED -> REJECTED
  INTENT_WRITTEN -> FAILED_BEFORE_APPEND
  EVENT_APPENDED -> RECOVERABLE_AFTER_APPEND
  PROJECTIONS_WRITTEN -> RECOVERABLE_AFTER_APPEND
  MANIFEST_UPDATED -> RECOVERABLE_AFTER_APPEND
  any state -> ABORTED_LOCK_LOST
```

### Transaction Intent Fields

`transactions/pending/<tx_id>.json` is required before event append.

```json
{
  "schema_version": "1.0",
  "tx_id": "tx_000123",
  "run_id": "run_2026-05-03_001",
  "request_id": "req_0042",
  "tool": "rms.transition",
  "actor_id": "codex-main",
  "created_at": "2026-05-03T00:00:00Z",
  "transaction_state": "INTENT_WRITTEN",
  "expected_prev_event_digest": "sha256:...",
  "expected_next_sequence": 42,
  "intended_event_ids": ["evt_000042"],
  "idempotency_key": "route-42-build-to-validate",
  "state_before_ref": "snap_current_000041",
  "final_state_candidate": "UNSET",
  "recovery_policy": "auto_fail_before_append_auto_rebuild_after_append"
}
```

Intent files are recovery inputs. They do not prove protected state changed.

## Pending Transaction Recovery

At startup, a non-empty `transactions/pending/` directory puts the run in
`RECOVERY_REQUIRED` before any governed transition.

| Observed condition | Recovery result | Required event behavior |
|---|---|---|
| Intent exists, intended event is absent, latest digest equals `expected_prev_event_digest` | Move intent to `failed`; mutation did not occur. | Append `TRANSACTION_FAILED` if log writable; otherwise keep `BLOCKED_PENDING_TX`. |
| Intent exists, intended event is absent, latest digest advanced by another valid event | Mark intent `failed_conflict`; do not replay it. | Append `TRANSACTION_FAILED` if log writable, naming observed digest. |
| Intended event exists and validates, projections missing or stale | Replay through intended event, rebuild snapshots and manifest, move intent to `committed`. | No duplicate domain event. Optional recovery audit event only if registry defines one. |
| Intended event exists but manifest digest points before it | Replay through event, update manifest, move intent to `committed`. | No duplicate domain event. |
| Intended event exists but digest invalid | Enter `BLOCKED_DIGEST_CHAIN`; leave intent pending. | No new event unless append after valid prefix is explicitly allowed by repair policy. |
| Intent JSON invalid | Enter `BLOCKED_PENDING_TX`; quarantine only with operator/admin repair. | No automatic event from invalid intent. |
| Multiple pending intents | Resolve only if exactly one intended event chain order is provable; otherwise `BLOCKED_PENDING_TX`. | Do not guess ordering. |

Idempotent retry is allowed only when request id or idempotency key matches the
pending intent and the observed log state proves the first attempt did not append
the event.

## Stale Lock Recovery

`run.lock` contains structured metadata:

```json
{
  "schema_version": "1.0",
  "run_id": "run_2026-05-03_001",
  "lock_id": "lock_0008",
  "owner_runtime": "codex",
  "owner_actor_id": "codex-main",
  "owner_process": "pid_or_UNKNOWN",
  "acquired_at": "2026-05-03T00:00:00Z",
  "heartbeat_at": "2026-05-03T00:00:20Z",
  "expected_prev_event_digest": "sha256:...",
  "writer_generation": 8,
  "operation": "rms.close_run"
}
```

Stale lock recovery is legal only when all of these checks pass:

1. `heartbeat_at` is older than `lock_stale_after_seconds`.
2. The owner process is absent or `UNKNOWN` and no live heartbeat file was
   updated after the stale threshold.
3. The event log latest digest still equals the lock's expected digest, or a
   pending transaction explains the advanced digest.
4. The recovering writer acquires a new lock using atomic create and a higher
   `writer_generation`.

If any check is uncertain, the state is `BLOCKED_LOCK_CONFLICT`, not stale.
Breaking a stale lock never commits or fails a transaction by itself. It only
allows the recovery scan to proceed to pending transaction resolution.

## Corrupt Snapshot Replay

A snapshot is corrupt when it is unreadable JSON, schema-invalid, contains
`null`, references an unknown registry version, embeds an event digest that does
not match the manifest, or contradicts replay.

| Snapshot condition | Recovery action |
|---|---|
| Snapshot missing | Rebuild from events and pinned registry. |
| Snapshot unreadable or schema-invalid | Move aside to recovery quarantine if supported; rebuild. |
| Snapshot digest older than manifest but event log valid | Rebuild to latest event. |
| Snapshot digest newer than manifest | Discard snapshot; replay wins. |
| Snapshot says closed without `RUN_CLOSED` event | Discard snapshot; final state reverts to replay result. |
| Snapshot says mutable after `RUN_CLOSED` event | Rebuild closed snapshot from event log. |
| Replay cannot build because registry missing or invalid | `RECOVERY_REQUIRED` with registry blocker; no mutation. |

Snapshot rebuild must write temporary files, validate them, then atomically
rename into `snapshots/`. A failed rebuild after a valid event log leaves the run
in `DEGRADED_READ_ONLY` or `BLOCKED_PENDING_TX`, never `HEALTHY`.

## Partial Append And Invalid JSONL Handling

The event log is JSONL: each committed event is exactly one complete JSON object
terminated by newline.

### Tail Partial Append

If the last physical line is not valid JSON and all prior lines validate:

- treat prior lines as the valid committed prefix;
- do not truncate automatically;
- enter `RECOVERY_REQUIRED`;
- require recovery to quarantine the partial tail into an audit artifact or
  block if quarantine is not available;
- fail the pending transaction if its intended event is the partial tail;
- rebuild snapshots from the valid prefix.

Automatic quarantine is allowed only when implemented as append-preserving copy
semantics: the original corrupt log is preserved under recovery artifacts and a
new repaired log is created by admin repair policy. The MVP kernel may instead
block with `BLOCKED_CORRUPT_LOG`.

### Invalid JSONL Before Tail

If an invalid or schema-invalid line appears before later complete lines:

- enter `BLOCKED_CORRUPT_LOG`;
- do not trust later lines;
- no automatic replay past the corrupt line;
- no final state may be committed;
- reads may expose only the valid prefix with a corruption warning.

### Append Failure With No Bytes Written

If append returns failure and no new complete event is present, the mutation
returns `EVENT_APPEND_FAILED`, leaves the pending intent and blocks startup until
it is marked failed or retried idempotently.

## Event Digest Chain Repair Or Blocking

Digest fields are integrity controls, not advisory metadata.

| Digest condition | Result |
|---|---|
| First event has `prev_event_digest=UNSET` and valid digest | Continue. |
| Event `N.prev_event_digest` equals event `N-1.event_digest` and digest recomputes | Continue. |
| Tail event is complete JSON but digest mismatch | `BLOCKED_DIGEST_CHAIN`; no automatic repair. |
| Tail event references wrong previous digest but pending intent expected old digest | `BLOCKED_DIGEST_CHAIN`; possible stale writer conflict. |
| Manifest digest older than valid event log | Rebuild manifest from replay after pending transaction check. |
| Manifest digest newer or unknown to event log | `RECOVERY_REQUIRED`; if no matching event exists, block mutation and rebuild manifest only to valid log after admin/recovery policy. |
| Decision stream digest differs but run event log valid | Mark decision projection stale; rebuild companion stream if source events contain enough data, otherwise block affected guard/final decisions. |

Automatic chain "repair" may only repair derived references such as manifest
digest, snapshot refs and generated decision projections. It must never rewrite
an event's `prev_event_digest` or `event_digest`.

## Snapshot Rebuild Contract

`rms.rebuild_snapshots` is a recovery-only kernel primitive used by startup and
transaction recovery.

Input requirements:

- valid pinned registry digest;
- valid event prefix ending at a known event digest;
- no unresolved digest break before target event;
- explicit rebuild reason.

Output requirements:

- `snapshots/current-state.json`;
- `snapshots/run-set.json`;
- `snapshots/evidence-set.json`;
- `snapshots/convergence-set.json`;
- `snapshots/latest-guard-decision.json` when derivable;
- `snapshots/closed-state.json` only if replay contains `RUN_CLOSED`;
- updated manifest refs and `event_log_digest`.

Rebuild is successful only after every generated snapshot validates against its
schema and the manifest update is atomic. If a companion projection cannot be
rebuilt but is not needed for current state reads, the run may enter
`DEGRADED_READ_ONLY`; it cannot enter `HEALTHY`.

## Concurrent Writer Rules

Concurrent writers are controlled by lock plus optimistic digest checks.

1. Every mutating writer must acquire `runs/<run_id>/locks/run.lock` with atomic
   create semantics.
2. The writer records `expected_prev_event_digest` in both lock and pending
   intent.
3. Immediately before append, the writer re-reads the manifest and latest event
   digest.
4. If the digest changed, the writer aborts with `LOCK_CONFLICT` and moves any
   pre-append intent to failed.
5. After append and before manifest update, recovery can complete the committed
   event if the writer dies.
6. Two writers with the same idempotency key can converge only when the first
   intended event is present and identical; otherwise the second writer blocks.
7. Closed runs reject protected mutations even if a writer acquired a stale lock
   before closure.

The event sequence number is allocated from the latest committed event at append
time. A sequence gap is a digest-chain failure unless a registry-defined
migration event explains it.

## Final State Implications

Storage integrity gates final states:

| Integrity condition | `DONE_VERIFIED` | `DONE_WITH_GAPS` | Blocked final states |
|---|---|---|---|
| `HEALTHY` | Allowed if evidence and convergence pass. | Allowed if policy permits gaps. | Allowed when matching blocker exists. |
| `RECOVERED` | Allowed only after a fresh startup recheck returns `HEALTHY`. | Same as `DONE_VERIFIED`. | Allowed after recovery evidence. |
| `DEGRADED_READ_ONLY` | Blocked. | Blocked unless closing policy explicitly allows storage gap for low risk. | `BLOCKED_POLICY` or `BLOCKED_RUNTIME_MISSING` may be proposed if append works. |
| `BLOCKED_PENDING_TX` | Blocked. | Blocked. | May not close unless a new failure event can be appended and policy permits blocked stop. |
| `BLOCKED_CORRUPT_LOG` | Blocked. | Blocked. | Blocked if append chain is unsafe; report storage blocker outside final commit. |
| `BLOCKED_DIGEST_CHAIN` | Blocked. | Blocked. | Blocked if no safe append point exists. |
| `BLOCKED_LOCK_CONFLICT` | Blocked until retry. | Blocked until retry. | Blocked until lock resolves. |

`RUN_CLOSED` is valid only when the closing transaction event sequence,
manifest digest, snapshots and `closed-state.json` all agree. If a snapshot
claims closure but replay does not, the run is not closed. If replay contains
`RUN_CLOSED` and snapshots are corrupt, the run remains closed after rebuild.

Late evidence, recovery audit and correction events after closure are append-only
and cannot mutate the final state except through the explicit Cycle 04 closing
reopen/correction protocol.

## MCP And Local Fallback Behavior

The MCP server and local transaction fallback must use the same recovery library
and state machine.

| Condition | MCP behavior | Local fallback behavior |
|---|---|---|
| MCP transport down, storage healthy, T/F declared fallback | Local library may mutate if policy allows. | Must append events and mark degraded. |
| MCP transport down, M/E/C governed transition | Block unless native-equivalent fallback is declared. | No direct manual `.rms/` writes. |
| Startup finds recovery required | MCP starts in recovery mode. | Same recovery mode; no stronger claims. |
| Recovery blocks on corrupt log | Return structured storage error. | Return same error; no file edits outside repair primitive. |

## New Error Codes

These codes extend the Cycle 02 MCP common errors:

| Code | Meaning | Retryable |
|---|---|---|
| `STORAGE_RECOVERY_REQUIRED` | Startup found recoverable storage mismatch. | true after recovery |
| `PENDING_TRANSACTION_BLOCKED` | Pending transaction cannot be resolved automatically. | false until repair |
| `STALE_LOCK_RECOVERED` | Stale lock was safely broken and recovery continued. | true |
| `LOCK_STILL_ACTIVE` | Lock is current or cannot be proven stale. | true |
| `CORRUPT_EVENT_LOG` | JSONL parse/schema corruption blocks replay. | false |
| `PARTIAL_APPEND_DETECTED` | Tail line is incomplete or invalid after append failure. | conditional |
| `DIGEST_CHAIN_BROKEN` | Event digest chain does not validate. | false |
| `SNAPSHOT_REBUILT` | Snapshot was discarded and rebuilt from replay. | true |
| `SNAPSHOT_REBUILD_FAILED` | Replay valid but projection could not be rebuilt. | false |
| `MANIFEST_REPAIRED_FROM_REPLAY` | Manifest refs/digest were updated from valid replay. | true |

## Fixture Pack

These fixture families close the storage recovery blocker. They should become
schema-first tests before implementation.

### SR-001 - Pending Intent Before Append

Input:

```yaml
pending:
  tx_id: tx_001
  expected_prev_event_digest: sha256:event_041
  intended_event_ids: [evt_000042]
events:
  latest_digest: sha256:event_041
  contains_evt_000042: false
```

Expected: `PASS` recovery. Move intent to failed, append
`TRANSACTION_FAILED` if writable, leave state at event 41, no projection
advance.

### SR-002 - Pending Intent After Append Before Snapshot

Input:

```yaml
pending:
  tx_id: tx_002
  expected_prev_event_digest: sha256:event_041
  intended_event_ids: [evt_000042]
events:
  latest_digest: sha256:event_042
  contains_evt_000042: true
snapshots:
  current_state_digest: sha256:event_041
manifest:
  event_log_digest: sha256:event_041
```

Expected: `PASS` recovery. Replay through `evt_000042`, rebuild snapshots,
update manifest to event 42, move transaction to committed, do not duplicate the
domain event.

### SR-003 - Multiple Pending Intents Ambiguous

Input:

```yaml
pending:
  - tx_id: tx_003a
    intended_event_ids: [evt_000042]
  - tx_id: tx_003b
    intended_event_ids: [evt_000042]
events:
  contains_evt_000042: false
```

Expected: `BLOCK`. Enter `BLOCKED_PENDING_TX`; no guessed winner; no governed
transition.

### SR-004 - Stale Lock With No Append

Input:

```yaml
lock:
  heartbeat_age_seconds: 900
  stale_after_seconds: 120
  owner_process_alive: false
  expected_prev_event_digest: sha256:event_041
events:
  latest_digest: sha256:event_041
```

Expected: `PASS` recovery. Break stale lock, acquire new generation, continue
startup scan. State does not advance from lock recovery alone.

### SR-005 - Active Lock Cannot Be Proven Stale

Input:

```yaml
lock:
  heartbeat_age_seconds: 30
  stale_after_seconds: 120
  owner_process_alive: UNKNOWN
```

Expected: `BLOCK`. Return `LOCK_STILL_ACTIVE` or `BLOCKED_LOCK_CONFLICT`; no
write.

### SR-006 - Corrupt Snapshot Rebuilds From Valid Event Log

Input:

```yaml
events:
  digest_chain: valid
  latest_digest: sha256:event_050
snapshot:
  current_state_json: invalid
manifest:
  event_log_digest: sha256:event_050
```

Expected: `PASS` recovery. Discard snapshot, replay events, rebuild snapshots,
return `SNAPSHOT_REBUILT`.

### SR-007 - Snapshot Claims DONE_VERIFIED Without RUN_CLOSED

Input:

```yaml
events:
  contains_run_closed: false
snapshot:
  final_state: DONE_VERIFIED
  pipeline_activation: closed
```

Expected: `BLOCK` for final claim, `PASS` for replay recovery. Replay wins;
rebuilt snapshot is not closed.

### SR-008 - Tail Partial Append

Input:

```yaml
events_jsonl:
  valid_lines: 41
  tail: '{"event_id":"evt_000042","event_type":"STATE_TRANSITION'
pending:
  intended_event_ids: [evt_000042]
```

Expected: `BLOCK` or recovery quarantine according to configured repair policy.
The partial tail is not a committed event. Rebuild only from the valid prefix.

### SR-009 - Invalid JSONL Before Later Lines

Input:

```yaml
events_jsonl:
  line_20: '{bad json'
  line_21: '{"event_id":"evt_000021"}'
```

Expected: `BLOCK`. Enter `BLOCKED_CORRUPT_LOG`; do not replay line 21; no final
state commit.

### SR-010 - Digest Chain Break At Complete Event

Input:

```yaml
events:
  line_41_digest: sha256:event_041
  line_42_prev_event_digest: sha256:wrong
  line_42_json_valid: true
```

Expected: `BLOCK`. Enter `BLOCKED_DIGEST_CHAIN`; no automatic event rewrite.

### SR-011 - Manifest Behind Valid Event Log

Input:

```yaml
events:
  latest_digest: sha256:event_042
  digest_chain: valid
manifest:
  event_log_digest: sha256:event_041
pending:
  tx_id: tx_011
  intended_event_ids: [evt_000042]
```

Expected: `PASS` recovery. Complete after-append recovery, rebuild snapshots,
repair manifest from replay, commit transaction.

### SR-012 - Concurrent Writer Digest Changed

Input:

```yaml
writer:
  expected_prev_event_digest: sha256:event_041
before_append:
  observed_latest_digest: sha256:event_042
```

Expected: `BLOCK`. Abort with `LOCK_CONFLICT`; do not append an event based on
stale state.

### SR-013 - Closed Run Snapshot Corrupt But RUN_CLOSED Exists

Input:

```yaml
events:
  contains_run_closed: true
  latest_event_type: RUN_CLOSED
  digest_chain: valid
snapshot:
  closed_state_json: invalid
```

Expected: `PASS` recovery. Rebuild closed snapshot from replay; run remains
closed; protected mutation remains rejected.

### SR-014 - Append Failure During Final Commit

Input:

```yaml
request:
  tool: rms.close_run
  final_candidate: DONE_VERIFIED
derived_view:
  evidence_status: verified
  convergence_status: verified
event_log:
  append_available: false
```

Expected: `BLOCK`. Return `EVENT_APPEND_FAILED`; no final state, manifest or
snapshot advances.

### SR-015 - Recovery Cannot Rebuild Evidence Projection

Input:

```yaml
events:
  digest_chain: valid
  latest_digest: sha256:event_060
registry:
  evidence_policy_available: false
```

Expected: `BLOCK`. Enter `DEGRADED_READ_ONLY` or recovery blocker; no
`DONE_VERIFIED`; evidence status cannot be guessed.

## Decision Delta

Closed defaults for storage recovery:

- Pending transactions are mandatory recovery gates and block new governed
  transitions until resolved.
- Stale locks can be broken only with heartbeat, process and digest evidence.
- Corrupt snapshots are discarded; event replay wins.
- Tail partial appends are not committed events; invalid middle JSONL blocks
  replay past corruption.
- Digest chain breaks block automatically; recovery may repair only derived
  refs, never committed event lines.
- Snapshot rebuild is a first-class recovery primitive with schema validation.
- Startup exposes explicit integrity states before all reads and writes.
- Concurrent writers require both lock ownership and optimistic digest match.
- Final state commits require storage integrity; storage blockers prevent
  `DONE_VERIFIED`.

## Remaining Boundary

This contract does not define the concrete JSON Schemas or filesystem repair
CLI. It defines the executable behavior those schemas and tools must preserve.
With these fixtures present, the storage recovery P0 blocker can move from
`still_blocking` to `closed_by_contract` and `closed_by_fixture`, subject to the
Cycle 04 audit.
