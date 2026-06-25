# 0004 — hima v3 architecture build: Effect Schema, package layout, walking skeleton

- Status: **accepted** — 2026-06-25 (founder authorized real implementation in TDD/DDD this session: "ce qu'on demande, c'est une réelle implémentation de l'architecture qu'on a proposée avec un TDD/DDD")
- Criticality: [CRITICAL][BLOCKS:critical]
- Source: `.planning/architecture/` v3 design set — `ARCHITECTURE-v3.md`, `ARCHITECTURE-FLOW-v3.md`, `ENTRYPOINTS-v3.md`, `PARALLELIZATION-v3.md`, `BEHAVIOR-CATALOG-v3.md`, `AMENDMENT-001..003`, `DISCIPLINES-v3.md`; codebase reconciliation report (2026-06-25)

## Decisions

- [CRITICAL][BLOCKS:critical] **Effect Schema for new contract boundaries.** New `packages/schemas`
  uses `effect` (Effect Schema) as the contract language for `GateEvent`, `GateResult`,
  `ForceAction`, `GateCapabilityCell`, `GateViolation`, `SkillRef`, `Ward`, `CycleDef`/`StageDef`.
  Per founder's explicit directive (resolves DA-06) and ARCHITECTURE-v3 §C3 (Effect Schema only at
  I/O boundaries — no Effect.gen/Layers/Services in core). Legacy `@harness/core` KEEPS Zod 4
  (strangler-fig; no rip-out). Overrides the reconciliation report's "Zod-for-skeleton" suggestion.

- [CRITICAL][BLOCKS:critical] **Walking-skeleton MVP, Claude-Code first, TDD.** Prove end-to-end:
  sigil → ward → one stage skill-force → verdict, on the universal base (`user_prompt` + `pre_tool`).
  Other runtimes, full parallelization/roles, pluggable-cycle UX, maintenance stage = post-MVP.

- [HIGH][BLOCKS:high] **Package layout.** CREATE `packages/schemas` (Effect). EXTEND `core`
  (`forcing-primitive.ts`/pickAttack, `keyword-core`/pickSigil, `ward.ts`, `skill-state.ts`,
  8-field capability-map). EXTEND `hima-cli` (wire evaluateGate → pickAttack → adapter translate +
  canary + ward). EXTEND `storage-core` (upgrade capability-map to 8 fields incl. `canBlock`,
  `enforcementStrength`, `compensatingMechanism`, `maxInjectionBytes`, `universal`). CREATE
  `adapter-claude-v3` (real enforcement shim: stdin → parse → evaluateGate → pickAttack →
  exhaustive ForceAction switch → exit 2). `@hima/behavior-core` = canonical behaviors home.
  Treat `@harness/*` legacy series as superseded; all new code is `@hima/*`.

- [HIGH][BLOCKS:high] **Add `forceIntent` to GateResult/Verdict** (typed discriminated union:
  SkillGate | ContextInject | DeferredBlock). The one structural change to the existing engine
  needed before pickAttack can consume verdicts.

- [HIGH][BLOCKS:low] **Cycle/skills/agents are DATA, not hardcoded.** Cycle = `CycleDef`/`StageDef`
  (AMENDMENT-003, pluggable cycle; dev-cycle is the shipped default). Skills = `SkillRef` pluggable
  registry (AMENDMENT-001). Agent count = work-driven, not criticality (AMENDMENT-002).

- [MEDIUM][BLOCKS:none] **Naming = hybrid-plat**: full/run/spec, ward, sigil, literal stages;
  `ulw` = alias of `full`.

## Alternatives rejected

1. **Zod 4 for the skeleton** — rejected: founder explicitly chose Effect. (Pragmatic but overrides intent.)
2. **Big-bang parallel build across all packages** — rejected: the walking skeleton is a sequential
   dependency spine (schemas → keyword → pickAttack → ward → cli → adapter); parallel codegen here
   raises slop risk and violates KISS. Forced parallelization is hima's RUNTIME behavior, applied to
   independent work later, not to the foundational spine.

Falsifies-If:
  kill-condition: The walking skeleton cannot enforce a skill-force hard-block on Claude Code's user_prompt/pre_tool end-to-end (the agent's Write executes despite a required skill not loaded).
  checkpoint-date: 2026-07-01
  evidence-anchor: packages/hima-core/test/e2e-skill-force.test.ts
  on-fail: the forcing-function premise is wrong for the universal base; stop and re-examine ARCHITECTURE-v3 §C2 before building further packages.
