# DoD — SPEC-018 Delegation-First gate

Tier: H
Task: spec018-delegation-first

## Goal

WHEN a governed task at criticality **High or Critical** performs an **implementation** Write/Edit
at a **work-bearing stage** (build/impl/review/qa) from the **main session thread** (no active
delegated/sub-agent context), THE SYSTEM SHALL **block** that write (hook exit 2) with a directive
naming the required roles (≥1 implementer + ≥1 independent verifier) and the action that satisfies
it. Below High it SHALL NOT block (warn at M, inert at T/L). It SHALL never block reads, plans,
spec writes, or writes originating from a delegated lane.

## Acceptance criteria (Given/When/Then)

- **A1 [CRITICAL]** Given an H task at a work-bearing stage in the main thread, When it Write/Edits an
  implementation file with no delegation active, Then the decision is BLOCK and the reason names both
  roles + the satisfying action.
  - Example: stage=build, crit=H, actor=main, delegationActive=false, path=`src/service.ts` → block.
- **A2 [CRITICAL]** Given the identical write but from a delegated lane/sub-agent context
  (delegationActive=true), When evaluated, Then the decision is ALLOW.
  - Example: same as A1 but delegationActive=true → allow.
- **A3 [CRITICAL]** Given any criticality, When the write target is a read/plan/spec/non-impl path,
  Then the gate never blocks.
  - Example: crit=H, main thread, path=`docs/x.md` → allow (not an impl file).
- **A4 [HIGH]** Given crit=M (main thread, work-bearing, impl file, no delegation), Then WARN (advisory,
  non-blocking, exit 0) — not block.
- **A5 [HIGH]** Given crit=T or L, Then the gate is inert (no decision emitted).
- **A6 [HIGH]** The block reason string contains both role names ("implementer" and "verifier") and a
  concrete satisfying action.
- **A7 [MEDIUM]** The minimum lane count N defaults to 2 and is read from config; overriding it is
  reflected (documented; enforcement of the exact count is best-effort, the gate's binary decision is
  block-vs-allow).
- **A8 [HIGH]** Full existing suite stays green (no regression); claim-bearing guard stays green.

## Non-goals

- NOT implementing the mechanical hima→norm rename (separate S wave, per ADR-0008).
- NOT forcing the model to actually fan out after the block (same limit as planner-write-guard — we
  force the gate, not the agent's compliance).
- NOT a new manual bookkeeping surface for the operator — delegation detection uses existing signals.
- NOT changing BEH-023 Stop gate; only composing with it.

## Write-scope (allowlist)

- packages/hima-core/src/behavior-core/beh-delegation-first.ts   (new: pure decideDelegationFirst + BEH_DELEGATION_FIRST descriptor)
- packages/hima-core/src/behavior-core/delegation-lane.ts        (new: marker read/write — .hima/state/lane/<sessionId>)
- packages/hima-core/src/behavior-core/registry.ts               (register BEH_DELEGATION_FIRST on pre_tool)
- packages/hima-core/src/index.ts                                (export decideDelegationFirst / lane helpers)
- packages/hima-cli/src/router.ts                                (handleDelegate + auto-mark child on subagent-start)
- packages/hima-cli/src/index.ts                                 (new `hima delegate` subcommand)
- packages/hima-core/test/beh-delegation-first.test.ts           (RED: truth table)
- packages/hima-core/test/delegation-lane.test.ts               (RED: marker helper)
- packages/hima-cli/test/e2e-delegation-first.test.ts            (RED: live pre_tool block/allow via CLI)

Read-only allowed anywhere. No writes outside this list except the frozen DoD's own trace in .mnm/.

## Assumptions (reversible defaults, logged)

- **AS1** No delegation signal exists in the live payload (explorer-confirmed). We create one: a lane
  marker file `.hima/state/lane/<sessionId>` — **presence ⇒ delegated lane ⇒ allow; absence ⇒ main
  thread ⇒ block at H+**. The marker is written by (a) `hima delegate` (the explicit runtime-agnostic
  seal, SPEC-018 D-004) and (b) auto on sub-agent start for the child session id. The ambiguity
  mitigation is NOT global-fail-to-warn (that would defeat the gate); it is the explicit seal +
  the D-009 escape hatch. **Residual (named, cannot fully verify live here):** whether a Claude Task
  sub-agent's PreToolUse carries its own child sessionId (so auto-marking matches) is a live-wire
  behavior I cannot end-to-end prove in this run → auto-detect on Claude is PARTIAL; the explicit
  seal path is fully proven.
- **AS2** "Work-bearing stage" = the DEV_CYCLE stages where implementation happens (build/impl + review
  + qa); exact ids taken from the map. Discovery/spec/plan stages are NOT work-bearing.
- **AS3** "Implementation file" reuses the existing impl-file notion if one exists (src/**.ts etc.);
  else mirror the planner-write-guard's target classification.
- **AS4** H+ = criticality ∈ {H, C} using the existing criticality type. Threshold at H per SPEC-018 D-001/D-007.

## Budget

- Iterations: diagnostic ~H. Cost ceiling: standard H. Stop on ceiling → STUCK-BUDGET (honest PARTIAL).
