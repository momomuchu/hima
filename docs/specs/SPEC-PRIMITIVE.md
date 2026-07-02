---
spec-id: SPEC-PRIMITIVE
title: hima — The Primitive (the governed cycle)
claim-bearing: true
status: DRAFT
date: 2026-07-02
standard-basis: ISO/IEC/IEEE 29148:2018 (requirement statements); traces to docs/specs/SPEC-VISION.md V-010/V-011/V-017/V-019/V-021
ssot: the built code is the source of truth — packages/schemas/src/{cycle,ward}.ts + packages/hima-core/src/{forcing-primitive,ward-store,ward-transitions,trace}.ts
supersedes: (none — first formal statement of the primitive; the code predates and is authoritative)
---

# SPEC-PRIMITIVE — hima

## §0 About this document

SPEC-VISION V-010 fixed the irreducible primitive of hima as **the cycle**, and V-011 fixed
**forcing (the right skill/context/role) as the *mechanism*** that governs each stage — not the
primitive itself. This document specifies that primitive against the **already-built, certified
code** (the code is SSOT; this spec formalizes and traces it). Each statement carries a `P-00x`
id, a criticality tag, and traces up to a `V-00x` and down to a code location.

---

## §1 Definition — the cycle is the primitive

- **P-001** `[CRITICAL][BLOCKS:critical]` (⇽ V-010) The irreducible unit hima governs is a
  **cycle**: a named, ordered sequence of **stages**. Contract: `CycleDef = { id, name, stages }`
  where `stages: StageDef[]` — `packages/schemas/src/cycle.ts:27-33`.
- **P-002** `[CRITICAL][BLOCKS:high]` (⇽ V-010) **The cycle is DATA, not hardcoded.**
  Because a `CycleDef` is a decodable value (`decodeCycleDef` — `cycle.ts:36`), the cycle is
  **pluggable**: the shipped `DEV_CYCLE` (8 stages: discovery, analysis, spec, design, impl, test,
  verify, maintenance — `cycle.ts:52-131`) is **one instance**, replaceable by another cycle
  (e.g. a sales-cycle) without changing the kernel.

## §2 The stage — the governable step

- **P-003** `[CRITICAL][BLOCKS:high]` (⇽ V-010) A stage is `StageDef = { id, name, forceSkills, injectSkills,
  entryAllowed }` — `cycle.ts:13-19`. `forceSkills` are activated (forced) on entry; `injectSkills`
  are injected as background; `entryAllowed` gates entry given current state.

## §3 The execution context — the Ward

- **P-004** `[CRITICAL][BLOCKS:critical]` (⇽ V-021) Every run is a **Ward** — the live per-run context carried
  across gate events: `Ward = { id, entryPoint, floor, openStage, skillRegister, verdicts, deferred? }`
  — `packages/schemas/src/ward.ts:55-63`. `openStage` is the cycle stage currently executing;
  `floor` is the enforced minimum `RiskClass`; `skillRegister` is the ordered set of skills active
  for the run; `verdicts` accumulate per-stage outcomes. Lifecycle: `createWard`/`resumeWard`/
  `advanceStage` — `packages/hima-core/src/ward-store.ts`.

## §4 The governing mechanism — forcing (pickAttack)

- **P-005** `[CRITICAL][BLOCKS:critical]` (⇽ V-011) Each stage is governed by **`pickAttack()`** — the
  pure forcing primitive that returns the **strongest available `ForceAction`** for a gate event via a
  **6-rung ladder**: `noop/observe-only → rich-inject → constrained-inject → skill-force →
  deferred-block → hard-block` — `packages/hima-core/src/forcing-primitive.ts:61-146`. The rung
  chosen depends on the runtime's capability cell (can it block? how does it inject?), so the *same*
  discipline degrades gracefully across Claude/Codex/Hermes/OpenCode.
- **P-006** `[HIGH][BLOCKS:high]` (⇽ V-011) A stage's `forceSkills` that are **not yet in the Ward's
  `skillRegister`** are forced (rung 4 `skill-force` on a `canBlock` cell), i.e. the gate blocks until
  the required skill is invoked — `forcing-primitive.ts:92-109`. Forcing is thus **the mechanism**
  that makes "the right skill/context at the right moment" real (V-011), not the primitive.

## §5 The advancement rule — V&V gate per stage

- **P-007** `[CRITICAL][BLOCKS:critical]` (⇽ V-006/V-021) A stage may advance **only when its
  `StageVerdict` is sealed**. `StageVerdict = { stage, status, evidence }` with
  `status ∈ { blocked, partial, done, done-verified, done-validated }` — `ward.ts:27-37`.
  `blocked`/`partial` **cannot advance**; only a `done*` seal (with evidence) closes a stage.
  Transition engine: `checkStageGate`/`writeStageVerdict`/`closeWard` —
  `packages/hima-core/src/ward-transitions.ts`; driven by `hima hook stage-advance`.
- **P-008** `[CRITICAL][BLOCKS:high]` (⇽ V-006) This is what makes a task **validated end-to-end,
  deterministically, without a manual verify-spawn**: the verdict seal is *in the loop*, not an
  operator action after the fact.

## §6 The measure — the trace

- **P-009** `[HIGH][BLOCKS:low]` (⇽ V-019) Every stage transition and force decision emits a
  **`TraceEvent`** to `.hima/state/trace/<session>.jsonl` — `packages/hima-core/src/trace.ts`,
  viewable via `hima trace`. The trace is the **measure of effectiveness**: from it, exactly what
  happened / which stage was passed / why is reconstructable.

## §7 Decomposition — cycle → stages → behaviors → trivial acts

- **P-010** `[HIGH][BLOCKS:low]` (⇽ V-017) The primitive **emanates downward**: a cycle decomposes
  into stage behaviors; a stage decomposes into behaviors evaluated by the gate/behavior engine
  (`packages/hima-core/src/behavior-core/`, `gates-core/evaluate-gate.ts`); the smallest is a
  trivial act (a single tool call at `pre_tool`). Each level is governable and gated by the same
  `pickAttack` mechanism.

## §8 Invariants (claim-bearing)

- **INV-1** `[CRITICAL][BLOCKS:critical]` No stage advances without a sealed `done*` `StageVerdict`
  carrying evidence. (P-007)
- **INV-2** `[CRITICAL][BLOCKS:high]` The cycle is data (a decodable `CycleDef`), never hardcoded;
  swapping the cycle needs no kernel change. (P-002)
- **INV-3** `[CRITICAL][BLOCKS:high]` The cycle is the unit; forcing is the mechanism. The kernel
  never conflates them: `pickAttack` governs stages of a cycle; it is not itself the primitive. (P-005)
- **INV-4** `[HIGH][BLOCKS:low]` Every run is a Ward and every Ward transition is traced. (P-004, P-009)

## §9 Contract map (spec → code SSOT)

| Concept | Contract (schemas) | Engine (core) |
|---|---|---|
| Cycle / Stage | `cycle.ts` `CycleDef`/`StageDef`/`DEV_CYCLE` | `config.ts` `resolveStageForceSkills` |
| Run context | `ward.ts` `Ward`/`StageVerdict` | `ward-store.ts`, `ward-transitions.ts` |
| Forcing | `force-action.ts` `ForceAction`, `capability.ts` `GateCapabilityCell` | `forcing-primitive.ts` `pickAttack` |
| Gate/behavior | `gate.ts` `GateEvent`/`GateVerdict` | `gates-core/evaluate-gate.ts`, `behavior-core/` |
| Trace | `trace.ts` `TraceEvent` | `trace.ts`, CLI `hima trace` |

## §10 Rigor conformance (29148) + falsifier

Per-statement: `Necessary` ☐ `Unambiguous` ☐ `Verifiable` ☐ `Feasible` ☐ `Traceable` ☐ (checked by
the independent rigor pass). Every `P-00x` above names a code location → **verifiable against SSOT**.

Falsifies-If:
  kill-condition: >
    The kernel governs a unit other than an ordered stage-cycle (violating P-001/INV-3), OR a stage
    is allowed to advance without a sealed done* StageVerdict (violating P-007/INV-1), OR the cycle
    is hardcoded such that swapping it requires a kernel change (violating P-002/INV-2).
  checkpoint-date: 2026-08-01
  evidence-anchor: packages/schemas/src/cycle.ts
  on-fail: reopen SPEC-PRIMITIVE as DRAFT; re-derive from the code SSOT; if the code itself diverges
    from V-010/V-011, escalate to a SPEC-VISION revision before dependent contract work proceeds.
