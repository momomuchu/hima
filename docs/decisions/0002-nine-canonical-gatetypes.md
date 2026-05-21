# 0002 - Nine Canonical GateTypes

Status: accepted

Date: 2026-05-20

## Decision

The canonical set of PFV4 `GateType` values is nine, not seven. The two
additional gates are `pre_compact` and `post_compact`. This set supersedes the
seven-gate list in `docs/conception/00-canonical-runtime-contract.md` §6
(prior to the update accompanying this ADR).

```ts
export type GateType =
  | "session_start"
  | "user_prompt"
  | "pre_tool"
  | "post_tool"
  | "pre_compact"
  | "post_compact"
  | "stop"
  | "subagent_start"
  | "subagent_stop";
```

## Context

Two independent sources disagree on the GateType count:

- `docs/conception/00-canonical-runtime-contract.md` §6 — lists 7 gates
  (omits `pre_compact` and `post_compact`).
- `docs/conception/05-gates-policy-spec.md` §1 — lists 9 gates (includes
  `pre_compact` and `post_compact`), specifies their semantics, bypass rules,
  and binding to native `PreCompact`/`PostCompact` hook events.

The implementation is the ground truth. Both gates are present and active:

- `packages/core/src/gates/compaction-continuity.ts` — implements the
  continuity-preservation logic that `pre_compact` and `post_compact` rely on.
- `packages/core/src/gates/evaluate-gate.ts` — the `evaluateGate` switch
  handles `pre_compact` (via `evaluatePreCompact`) and `post_compact` (via
  `evaluatePostCompact`), consistent with the nine-member `GateType` union in
  `docs/conception/05-gates-policy-spec.md` §10.1.

The seven-gate contract document was never updated after the compaction gates
were designed and implemented. This is a documentation gap: no architecture
choice was deferred or reversed.

### Why `pre_compact` and `post_compact` are distinct gates

None of the original seven gates covers context compaction:

- `pre_tool` / `post_tool` guard individual tool calls. Compaction is not a
  tool call — it is a host-runtime lifecycle event that truncates the active
  context window.
- `stop` is terminal. Compaction is a mid-run continuity event; the run
  continues after it.
- `session_start` fires once at session open. Compaction can fire multiple
  times within a single session.

`pre_compact` must fail-closed when the required planning state is absent
before context is discarded. `post_compact` must verify that the restored route
matches the pre-compaction snapshot before the run continues under M/H/C risk.
Neither behavior fits any existing gate without semantic distortion.

## Consequences

- `docs/conception/00-canonical-runtime-contract.md` §6 is updated (in the
  same commit as this ADR) to list all nine `GateType` values and add
  `pre_compact` / `post_compact` rows to the gate property table.
- The §11 risk-to-gate baseline table remains valid; `pre_compact` and
  `post_compact` are implicit for any run that encounters a compaction event,
  regardless of risk class, consistent with §6.3 of the gates policy spec
  (bypass never permitted for either gate).
- The §7 runtime-hook mapping table in the contract is updated to include the
  native `PreCompact` / `PostCompact` events for Claude and Codex.
- Future specs and implementations must treat nine as the authoritative count.
  Any document claiming fewer gates without a superseding ADR is out of date.
- No implementation change is required; this ADR documents the existing
  behaviour.

Falsifies-If:
  kill-condition: A future implementation removes pre_compact or post_compact from the evaluate-gate switch, or a superseding ADR reduces the canonical count below nine, without providing an equivalent continuity-preservation mechanism at a different named gate.
  checkpoint-date: 2026-11-20
  evidence-anchor: docs/decisions/0002-nine-canonical-gatetypes.md
  on-fail: Open a new ADR documenting the gate removal or consolidation, update 00-canonical-runtime-contract.md §6 accordingly, and add a regression test confirming continuity is preserved under the new scheme.
