---
spec-id: SPEC-017
title: hima — Onboarding Apply (how `hima init` answers become `HimaConfig`, and how `HimaConfig` surfaces at runtime)
claim-bearing: true
status: DRAFT
date: 2026-07-02
standard-basis: ISO/IEC/IEEE 29148:2018 (requirement statements, traceability); companion to SPEC-016 (elicitation)
ssot: packages/hima-core/src/config.ts (HimaConfig, loadConfig, resolveStageForceSkills, resolveStageInjectSkills, resolveStageForceSkillsForFloor, resolveRole) is the code SSOT this spec formalizes. packages/hima-cli/src/setup.ts is the existing scaffold/hook-wiring code this spec extends (not replaces).
companion: docs/specs/SPEC-016-onboarding-questions.md (the accepted Q-001–Q-005 question set).
  This spec was originally drafted before SPEC-016 landed, against an assumed 8-question set; it
  was reconciled against SPEC-016's real, accepted 5-question set in an integration pass
  (2026-07-02) that also resolved SPEC-016's OQ-4 (§5). No `[RECONCILE]` tags remain outstanding —
  every A-item below traces to a real Q-id. SPEC-017 is authoritative on the APPLY mechanism;
  SPEC-016 is authoritative on the ELICITATION wording/order.
supersedes: none — first formal statement of the onboarding write/apply path. Does NOT supersede `hima setup` (packages/hima-cli/src/setup.ts): `hima init` is a superset command that reuses `hima setup`'s hook-wiring and scaffold, then additionally writes a populated config (see §1).
traces: docs/specs/SPEC-VISION.md V-010/V-011/V-013a, docs/specs/SPEC-PRIMITIVE.md P-002/P-005/P-006/INV-2, docs/decisions/0006-base-tier-agnostic-primitives.md, docs/specs/SPEC-014-onboarding-new-agent.md
---

# SPEC-017 — hima Onboarding Apply

## §0 About this document

SPEC-016 specifies WHAT `hima init` asks and in what order. This document specifies what
happens to the answers: which file(s) they are written into, in what shape, under what
merge/idempotency rule, and how the resulting `HimaConfig` then governs a running cycle (which
stage's `forceSkills`/`injectSkills` get selected, and how the `base` (8 meta) tier + the
swappable default dev-cycle pack (7 stage skills, ADR-0006) fit into that resolution). Every
statement carries an `A-00x` id, a criticality tag `[CRIT|HIGH|MEDIUM|LOW][BLOCKS:x]`
(`spec-criticality.md`), and traces to a `V-`/`P-`/`OD-`/ADR id and a code location. The code
(`config.ts`) is SSOT for the resolver; this spec is SSOT for the NEW write path (`hima init`
does not exist in code yet — this is the pre-implementation spec-gate required by
`SHORT-TERM-GOAL.md` DONE criterion 2).

**§0.1 What `hima init` v1 does NOT ask (scope boundary, corrected in this integration pass).**
SPEC-016's accepted question set is exactly **Q-001 (runtimes), Q-002 (cycle pack on/off), Q-003
(enable corpus source), Q-004 (enforcement floor), Q-005 (wire hooks now)** — 5 questions, per
SPEC-016 §2/§3. An earlier draft of this spec assumed a longer 8-question set (per-stage
force/inject overrides, per-role model overrides, project-vs-user scope, a re-run merge prompt)
that SPEC-016 does not contain. `hima init` v1 does **not** interactively ask about
`stageSkills`/`roles` overrides or write-target scope — those remain **hand-edit-only** on
`.hima/config.json` for v1 (surfaced via the commented starter file, A-017). `hima init` v1 always
writes to **project scope** (`<root>/.hima/config.json`); user-scope
(`~/.hima/config.json`) is not offered as an interactive choice. This is a v1 scope decision, not
an oversight — see §5 for the full Q-id ↔ A-item map and the dropped fabricated items.

---

## §1 Relationship: `hima init` vs `hima setup`

- **A-001** `[CRITICAL][BLOCKS:critical]` `hima init` is a **superset** of `hima setup`
  (`packages/hima-cli/src/setup.ts`). It performs the same two steps `runSetup()` performs today
  — hook-wiring (`mergeClaudeHooks`/`wireClaudeHooks` into `<root>/.claude/settings.json`) and
  scaffold (`.hima/state/`, `.hima/current-risk.json`) — and ADDS a third step: writing a
  **populated** `.hima/config.json` in place of the scaffold's current `{}` stub
  (`setup.ts:332-341`). `hima setup` itself is unchanged and remains the non-interactive,
  zero-question path (CI-safe, idempotent, no prompts). Trace: `setup.ts` `scaffold()`;
  SHORT-TERM-GOAL Part B bullet 3.
- **A-002** `[CRITICAL][BLOCKS:critical]` **(Q-001, coding-agent runtime(s) — corrected in this
  integration pass.)** Q-001's answer DOES land in `HimaConfig`, exactly as SPEC-016 §2 Q-001
  specifies: `NEW field: runtimes` — `Schema.optional(Schema.Array(Schema.Literal("claude","codex","hermes","opencode")))`.
  This field's **only consumer is `hima init`'s own write-time hook-wiring loop** (Q-005): for
  each runtime in `HimaConfig.runtimes`, `hima init` calls the existing
  `runSetup({ root, runtime, himaBinPath })` once (`setup.ts:165`, unchanged signature) — this is
  what lets a multi-runtime Q-001 answer wire hooks for every selected runtime, including on a
  later re-run, without re-asking. **`HimaConfig.runtimes` is never read by the live gate-time
  dispatch path** (`dispatchTranslate()` / `pickAttack()`, `run-gate.ts:56`) — those continue to
  receive `runtime` directly from the hook invocation context (CLI `--format` flag / hook payload)
  exactly as today, unchanged by this spec. This scoping keeps "which runtimes this project
  targets" (a `hima init` bookkeeping fact, informational) separate from "which runtime is
  handling this specific gate event" (a live dispatch fact, always sourced from the invocation
  itself) — avoiding INV-2's original concern (two authoritative sources for the same live fact)
  while still giving `HimaConfig` a persisted record of Q-001's answer. Trace: `setup.ts`
  `SetupOpts.runtime`, `dispatch.ts` `dispatchTranslate`, SPEC-VISION V-013a (per-runtime
  adapters).

---

## §2 The transform — answers → `HimaConfig` fields

Each row names the real onboarding question (§5), the exact `HimaConfig` field it writes
(`config.ts:63-71`), and the resolution semantics that field feeds at runtime.

- **A-003** `[CRITICAL][BLOCKS:critical]` **(Q-004, enforcement floor.)** Writes to
  **`<root>/.hima/current-risk.json`** as `{"risk_class": "<answer>"}` — **not** into
  `HimaConfig`. This resolves SPEC-016's own OQ-4 ("two candidate landing spots… pick one, not
  both"): this integration pass picks the pre-existing scaffold file, not a new
  `HimaConfig.defaultFloor` field — see §5 for the resolution rationale and the matching edit made
  to SPEC-016 Q-004. `hima init` reuses the identical scaffold write `hima setup` already performs
  (`setup.ts:20,343-352`) rather than inventing a second write path; the only NEW behavior is that
  `hima init` writes the user's Q-004 *answer* instead of the scaffold's hardcoded `"T"`. Default
  when Q-004 is skipped: `"T"`, matching the existing scaffold default. **Real build gap named by
  SPEC-016 (unaffected by this pick):** `resolveRiskClass()` reads `ward.floor` only
  (`risk-class.ts:29`) and `createWard`'s caller (`router.ts:357`) does not yet read
  `current-risk.json` before calling `createWard(root, { id, entryPoint, floor })` — wiring that
  read is real, named build work this spec commits to, not a documentation nuance. Trace:
  `packages/schemas/src/risk.ts` `RiskClass`; `ward.ts` `Ward.floor`; `ward-store.ts` `createWard`.
- **A-004** `[HIGH][BLOCKS:high]` **(Q-002, "use the default dev-cycle pack" vs "define my own
  cycle later.")** Two sub-answers, both on `HimaConfig`:
  - Answer = "use the default dev-cycle pack" (default) → `cycle` is **omitted entirely** from
    the written file (`HimaConfig.cycle`, `config.ts:67`, type `CycleDef`) and `useDevCyclePack`
    is also omitted. Per the loader's own contract ("Absent fields fall back to founder defaults"
    — `config.ts:61`), omission — not a copied-in duplicate of `DEV_CYCLE` — is what keeps the
    cycle swappable without a kernel change (SPEC-PRIMITIVE INV-2 / ADR-0006). Writing a frozen
    copy of `DEV_CYCLE` into every project's config would silently defeat that invariant the
    first time the shipped default cycle is revised upstream.
  - Answer = "I'll define my own cycle later" → writes `NEW field: useDevCyclePack: false`
    exactly as SPEC-016 Q-002 specifies (`Schema.optional(Schema.Boolean)`); `cycle` stays
    omitted. `hima init` v1 does **not** author a full `CycleDef` interactively (a multi-stage
    schema is out of scope for a question-flow); it emits a `messages[]` line pointing at the
    `cycle` block in the starter reference file (§4) for manual editing. **`useDevCyclePack: false`
    has no runtime effect until SPEC-016's OQ-2 is closed** (`resolveStageForceSkills`/
    `resolveStageInjectSkills` always fall back to their `devCycle` argument at step 3 today,
    `config.ts:167-170,206-209` — there is no branch that skips it). This spec does not close
    OQ-2; it only commits to writing the field with the exact name/type/semantics SPEC-016 names,
    so the future consumer has a stable value to read.
  - A **custom** `CycleDef` (full replacement) is written to `HimaConfig.cycle` only when a user
    hand-authors one directly in `.hima/config.json`; `hima init` never constructs one.
- **A-005** `[HIGH][BLOCKS:high]` **(Q-003, enable hima's private corpus skill source.)** Writes
  `NEW field: enabledSources` exactly as SPEC-016 Q-003 specifies:
  `Schema.optional(Schema.Array(Schema.Literal("base","corpus","user","project")))`. Answer "No"
  (default) writes `["base","user","project"]`; answer "Yes" writes
  `["base","corpus","user","project"]`. **This field has no filter consumer today** — nothing
  between `resolveStageForceSkills`'s output and `pickAttack`'s consumption of `forceSkills`
  checks `SkillRef.source` against `enabledSources` (SPEC-016 OQ-3). This spec does **not** close
  OQ-3 or OQ-7 (§6/§8 name them as open dependencies, not resolved by this write path alone) — it
  only commits to the field's exact write shape.
- **A-006 / A-007 / A-008 / A-009 / A-010 — DROPPED (were fabricated in the pre-SPEC-016 draft).**
  The original draft of this spec assumed a longer question set (per-stage force/inject
  overrides, per-role model/skill/stage overrides, project-vs-user write scope, a re-run
  merge-vs-fresh prompt) that SPEC-016's real, accepted 5-question set does not contain — see §0.1
  and §5. `hima init` v1 does not write `HimaConfig.stageSkills[*]`, `HimaConfig.roles[*]`, or
  select a non-project write target interactively; those remain hand-edit-only on
  `.hima/config.json` for v1 (surfaced via the commented starter file, A-017), resolved by the
  same existing resolvers (`resolveStageForceSkills`, `resolveStageInjectSkills`, `resolveRole`)
  whether the values arrive via `hima init` or by hand. If a future `hima init` revision adds an
  interactive per-stage/per-role/scope question, it reopens SPEC-016 as DRAFT first (per SPEC-016
  R-002's question-count Falsifies-If) and this spec is amended to add the corresponding A-item —
  it does not retroactively resurrect A-006–A-010 as written.

---

## §3 Runtime surfacing — how the written config governs a stage

- **A-011** `[HIGH][BLOCKS:high]` Every value that ends up in `stageSkills`/`cycle` — whether
  written by `hima init` (v1: `cycle`/`useDevCyclePack` only, per A-004) or by hand-editing
  `.hima/config.json` (`stageSkills`/`roles`, per §0.1) — is consumed at gate-time **exclusively**
  through the existing resolver chain: `resolveStageForceSkills(config, stageId, devCycle)`
  (`config.ts:150-174`) → optionally floor-scaled by
  `resolveStageForceSkillsForFloor(base, stageId, floor)` (`config.ts:328-355`) → fed to
  `pickAttack` (SPEC-PRIMITIVE P-005/P-006, `forcing-primitive.ts:61-146`). `hima init` writes
  data; it never bypasses or duplicates this resolution logic, and this spec introduces no new
  resolver.
- **A-012** `[HIGH][BLOCKS:high]` **Base (8 meta) + default dev-cycle pack (7 stage-bound skills)
  mapping — current state, not yet closed. Corrected in this integration pass (critique F3): the
  7-skill `hima-survey`/`hima-charter`/`hima-blueprint`/`hima-forge`/`hima-trial`/`hima-verdict`/
  `hima-stewardship` set is the `default dev-cycle pack` — a swappable pack, NOT the `base` tier.**
  ADR-0006 explicitly assigns this 7-skill set to the swappable pack and explicitly *rejects*
  folding it into `base` ("base = opinionated dev-cycle (rejected)"); `base` per ADR-0006 is the
  8 **meta/orchestration** skills only (planning, research, review, verification, cleanup,
  intake, batch-questioning, project-disciplines, triage — `.planning/research/HIMA-BASE-SKILLS.md`
  §"Meta / orchestration skills"). As of this spec, `DEV_CYCLE` (`cycle.ts:52-131`) hardcodes
  `corpus-*` `SkillRef`s directly into every stage's `forceSkills` (e.g. discovery forces
  `{source:"corpus", id:"corpus-technical-analysis-discovery"}`) — it references **neither** the
  `base`-tier meta skills **nor** the default-dev-cycle-pack's own 7 named skills yet. `hima init`
  therefore **cannot yet** offer "use the [base tier / default pack]" as a meaningfully different
  answer from "use the shipped `DEV_CYCLE`" — all three are the same corpus-sourced list today.
  This is the same underlying fact SPEC-016 OQ-7 tracks (Q-002/Q-003's combined defaults
  force-reference a `corpus` `SkillRef` even when Q-003 declares `corpus` unavailable) — closing
  the SHORT-TERM-GOAL Part B bullet 3 dependency ("ship the base tier + default dev-cycle pack")
  closes both OQ-7 and this A-item's open dependency in one build step. Tracked in this spec's
  Falsifies-If (§8), not a defect this spec introduces. Once the pack ships (either as the new
  `DEV_CYCLE` default, or as an alternate `CycleDef` a project's `cycle` field can reference),
  Q-002's answer maps onto the **same** mechanism in A-004 unchanged — only which `CycleDef` the
  `devCycle` parameter resolves to at runtime changes, never the write logic.
- **A-013** `[MEDIUM][BLOCKS:none]` `hima init`'s terminal messages (mirroring
  `SetupResult.messages`, `setup.ts:180-191`) MUST state the effective precedence order in plain
  language at the end of a run — e.g. *"Any per-stage overrides you hand-edit into
  .hima/config.json beat a custom cycle, which beats the shipped default dev-cycle pack."* (v1
  never sets per-stage overrides itself, per §0.1 — the message describes the resolver's standing
  precedence, not something this run just did) — per the founder's `feature-poc.md`
  founder-readable-wording requirement for M+ feature work.

---

## §4 Write behavior of `hima init`

- **A-014** `[CRITICAL][BLOCKS:critical]` **Location.** Default target is
  `<root>/.hima/config.json` (project scope — the only scope `hima init` v1 writes to, per §0.1).
  `hima init` reuses the existing `safeAtomicWriteFile` helper (`@hima/storage-core`, already
  imported by `setup.ts`) — it does not invent a second file-write path.
- **A-015** `[HIGH][BLOCKS:high]` **Idempotency / re-run.** `hima init` v1 only ever writes
  top-level `runtimes`, `useDevCyclePack`, `enabledSources`, and (rarely) `cycle` (per A-002/A-004,
  A-005) — it never writes `stageSkills`/`roles` sub-fields (§0.1, A-006–A-010 dropped). When the
  target file already exists and decodes successfully via `decodeHimaConfigEither`, `hima init`
  **merges** its own new top-level keys into it using the identical per-key semantics `config.ts`'s
  own `mergeTwo` uses internally (`config.ts:452-476`): any pre-existing hand-edited
  `stageSkills`/`roles`/`cycle` entries `hima init` did not touch this run **survive unchanged** —
  merging only ever adds/replaces the keys `hima init` itself writes. **Forward guard (per
  critique F5):** because `hima init` v1's own writes are whole-value replacements of top-level
  scalars/arrays it fully owns, `mergeTwo`'s per-key (not per-sub-field) semantics are safe to
  reuse as-is for this spec's write set. If a future `hima init` revision starts writing partial
  `stageSkills[stageId]`/`roles[roleId]` sub-fields interactively (reopening SPEC-016 as DRAFT
  first, per A-006–A-010's drop note), it MUST NOT reuse `mergeTwo` verbatim for that write — it
  must read the existing per-key object first and merge only the touched sub-fields, or a
  hand-set `force`/`inject`/`model` sub-field on an untouched stage/role would be silently
  discarded (`mergeOptionalRecords`, `config.ts:483-489`, replaces a touched key's entire
  sub-object wholesale). When the existing file exists but **fails to decode** (mirrors
  `tryLoadOne`'s own failure path, `config.ts:407-437`), `hima init` does **not** silently
  overwrite it — it errors naming the file and asks the user to fix or delete it first. No re-run
  of `hima init` may cause silent data loss on a config a human has hand-edited
  (`[ALWAYS][PRESERVE]`).
- **A-016** `[MEDIUM][BLOCKS:low]` **Structural idempotency.** Re-running `hima init` with
  identical answers against an already-populated config MUST yield a file that decodes to a
  `HimaConfig` value structurally identical to before (key order / whitespace may differ; the
  decoded value may not).
- **A-017** `[HIGH][BLOCKS:high]` **Commented starter config.** The live `.hima/config.json`
  MUST remain strict JSON: `config.ts`'s loader calls `JSON.parse` (no JSONC/comment support),
  and `decodeHimaConfigEither` silently **drops** unknown keys rather than erroring on them
  (Effect `Schema.Struct` default decode behavior) — so an inline `"//": "comment"` pseudo-key
  would decode-succeed yet persist as confusing dead data rather than documentation. `hima init`
  therefore writes a **sibling** documentation file, `<root>/.hima/config.example.jsonc`,
  containing a fully-populated, `//`-commented example of every `HimaConfig` field
  (`stageSkills`, `cycle`, `roles`) explaining precedence and defaults inline. `loadConfig` never
  reads this file (it only globs `.json`, not `.jsonc` — `config.ts:123-125`); it exists purely
  for copy-paste hand-editing — this is also where a user acting on Q-002's "define my own cycle
  later" or the §0.1 hand-edit-only `stageSkills`/`roles` paths is pointed. SPEC-016 names no
  competing commentary mechanism, so no reconciliation is outstanding here.
- **A-018** `[LOW][BLOCKS:none]` `hima init` SHOULD accept a `--yes` non-interactive flag that
  accepts every default (equivalent in effect to running `hima setup` alone — an empty overlay)
  for CI/scripted onboarding. Not required for cycle-99's DONE criteria; a convenience.

---

## §5 Coupling to SPEC-016 — real question set (reconciled in this integration pass)

SPEC-016's accepted question set is exactly 5 questions (SPEC-016 §2/§3). The table below replaces
the earlier 8-row assumed table — that draft (Q-001..Q-008 as previously listed here) does not
match SPEC-016's real questions at all past the ids Q-001–Q-005, and A-006/A-008/A-009/A-010 that
depended on the fabricated Q-006/Q-007/Q-008 rows have been dropped (§2). No `[RECONCILE]` tags
remain.

| Real Q-id | Real question (SPEC-016 §2) | A-items depending on it |
|---|---|---|
| Q-001 | Which coding-agent runtime(s) will use hima on this project? (multi-select: claude\|codex\|hermes\|opencode) | A-002 |
| Q-002 | Use hima's default dev-cycle pack, or bring your own cycle later? (single-select) | A-004, A-012, A-013 |
| Q-003 | Enable hima's private corpus skill source? (boolean, default No) | A-005 |
| Q-004 | How strict should hima's default enforcement floor be? (single-select: Advisory T \| Standard M \| Strict H) | A-003 |
| Q-005 | Wire runtime hooks now? (boolean, default yes) | A-001, A-002 (hook-wiring loop) |

**OQ-4 resolution (this integration pass, 2026-07-02):** SPEC-016's Q-004 originally named two
candidate landing spots for the floor answer — a new `HimaConfig.defaultFloor` field, or the
pre-existing `.hima/current-risk.json` scaffold file — and left the choice to SPEC-017 (its own
OQ-4). This spec picks **`.hima/current-risk.json`**, not a new `HimaConfig` field (A-003), and
SPEC-016 Q-004/§3/§4 were edited in the same pass to match: no `defaultFloor` field is introduced.
Rationale: this mirrors A-002's identical separation-of-concerns decision for Q-001 (operational/
per-run state — floor, live dispatch runtime — stays out of the `HimaConfig` customization
overlay); it also means no `HimaConfig` schema change is needed for Q-004 at all, only wiring
`createWard`'s caller (`router.ts:357`) to read the existing file before calling `createWard`.

If SPEC-016's question set is revised in a future pass (new Q-id, merged/split question, changed
default), whoever edits it MUST update this table and the affected A-item in the same pass — per
the fix applied here, letting the two specs drift apart again is the exact defect this integration
pass corrects.

---

## §6 Invariants (claim-bearing)

- **INV-1** `[CRITICAL][BLOCKS:critical]` `hima init` never writes a value that fails
  `decodeHimaConfigEither`. (A-014, A-015)
- **INV-2** `[CRITICAL][BLOCKS:critical]` **(Corrected in this integration pass — see A-002/A-003
  and SPEC-016 OQ-4's resolution.)** `hima init` never persists the risk floor inside
  `HimaConfig` — it stays in `.hima/current-risk.json`. `hima init` MAY persist the
  *runtime-targeting list* (`HimaConfig.runtimes`, per SPEC-016 Q-001) for its own hook-wiring
  bookkeeping, but the *live dispatch runtime* for any single gate event is never read from
  `HimaConfig` — it always comes from the hook invocation context (CLI `--format` flag / hook
  payload), exactly as `dispatchTranslate()`/`pickAttack()` do today. In other words: floor is
  fully excluded from `HimaConfig`; runtime may be recorded in `HimaConfig` for bookkeeping but is
  never the *source of truth* a live gate event reads from. (A-002, A-003)
- **INV-3** `[CRITICAL][BLOCKS:high]` `hima init` never writes a materialized copy of `DEV_CYCLE`
  when the user chose "use the default" — omission is what preserves cycle swappability
  (SPEC-PRIMITIVE INV-2). (A-004)
- **INV-4** `[HIGH][BLOCKS:high]` Re-running `hima init` never silently discards a hand-edited,
  validly-decoding existing config, including `stageSkills`/`roles` entries `hima init` itself
  never writes. (A-015, A-016)
- **INV-5** `[CRITICAL][BLOCKS:critical]` Every `A-00x` in this spec traces to a real Q-id in
  SPEC-016's accepted §2/§3 question set — no A-item may reference a Q-id, question wording, or
  answer branch that SPEC-016 does not actually contain. (§5; all A-items)
- **INV-6** `[HIGH][BLOCKS:medium]` This spec's base/default-dev-cycle-pack framing (A-012) never
  contradicts ADR-0006's accepted tier boundary (`base` = 8 meta/orchestration skills only; the
  7 stage-bound skills are the swappable default pack, not `base`). (A-012)

---

## §7 Contract map (spec → code SSOT)

| Concept | Contract (schemas/config) | Write path (this spec) |
|---|---|---|
| Runtime-targeting list (bookkeeping only, NOT live dispatch source) | `NEW field: HimaConfig.runtimes` | A-002 |
| Dev-cycle pack opt-out flag | `NEW field: HimaConfig.useDevCyclePack` | A-004 |
| Enabled skill sources | `NEW field: HimaConfig.enabledSources` | A-005 |
| Cycle replacement (hand-authored only, v1) | `@hima/schemas` `CycleDef`, `HimaConfig.cycle` | A-004, A-012 |
| Stage skill override (hand-edit only, v1 — not asked by `hima init`) | `config.ts` `StageSkillOverride`, `resolveStageForceSkills`/`resolveStageInjectSkills` | §0.1, A-011, A-017 |
| Role override (hand-edit only, v1 — not asked by `hima init`) | `config.ts` `RoleOverride`, `resolveRole` | §0.1, A-011, A-017 |
| Risk floor (NOT in HimaConfig) | `.hima/current-risk.json`, `@hima/schemas` `RiskClass` | A-003 |
| Live dispatch runtime (NOT read from HimaConfig) | `setup.ts` `SetupOpts.runtime`, `dispatch.ts` `dispatchTranslate` | A-002 |
| File write | `@hima/storage-core` `safeAtomicWriteFile` | A-014 |
| Merge on re-run | `config.ts` `mergeTwo`/`mergeOptionalRecords` (same top-level-key semantics reused; sub-field merge is a forward guard, not yet needed) | A-015, A-016 |

---

## §8 Rigor conformance (29148) + falsifier

Per-statement: `Necessary` ☐ `Unambiguous` ☐ `Verifiable` ☐ `Feasible` ☐ `Traceable` ☐ (checked by
the independent rigor pass — not this authoring pass). Every `A-00x` above names a code location
in the existing SSOT (`config.ts`/`setup.ts`) or explicitly scopes a NEW write path against it —
verifiable once `hima init` is implemented against this spec. **Per critique F7, the rigor pass
MUST cross-check each A-item's cited Q-id against SPEC-016's real §2/§3 text — not only against
`config.ts` — since the defect this integration pass fixed (F1: fabricated Q-ids) is invisible to
a code-only cross-check.**

Falsifies-If:
  kill-condition: >
    hima init writes a value to .hima/config.json that fails decodeHimaConfigEither (violating
    INV-1).
  checkpoint-date: 2026-07-13
  evidence-anchor: packages/hima-core/src/config.ts
  on-fail: reopen SPEC-017 as DRAFT; re-derive the failing write path from config.ts before hima
    init implementation proceeds.

Falsifies-If:
  kill-condition: >
    The risk floor is persisted inside HimaConfig instead of .hima/current-risk.json, OR the live
    dispatch runtime for a gate event is read from HimaConfig instead of the hook invocation
    context (violating INV-2/A-002/A-003).
  checkpoint-date: 2026-07-13
  evidence-anchor: packages/hima-core/src/config.ts
  on-fail: reopen SPEC-017 as DRAFT; re-derive A-002/A-003's write/read split before hima init
    implementation proceeds.

Falsifies-If:
  kill-condition: >
    "Use the default dev-cycle pack" writes a materialized copy of DEV_CYCLE instead of omitting
    the cycle field (violating INV-3/A-004).
  checkpoint-date: 2026-07-13
  evidence-anchor: packages/schemas/src/cycle.ts
  on-fail: reopen SPEC-017 as DRAFT; fix the write path to omit `cycle` before hima init
    implementation proceeds.

Falsifies-If:
  kill-condition: >
    Re-running hima init silently discards a hand-edited, validly-decoding existing config
    (violating INV-4/A-015), including a hand-set stageSkills/roles sub-field on an untouched key.
  checkpoint-date: 2026-07-13
  evidence-anchor: packages/hima-core/src/config.ts
  on-fail: reopen SPEC-017 as DRAFT; if the loss came from a partial-answer merge on
    stageSkills/roles, apply A-015's forward-guard (sub-field-preserving merge) before hima init
    implementation proceeds.

Falsifies-If:
  kill-condition: >
    hima init ships before the base tier + default dev-cycle pack dependency named in A-012 is
    resolved one way or the other (implemented, or explicitly deferred with founder sign-off) —
    SHORT-TERM-GOAL Part B bullet 3 — which is the same underlying gap SPEC-016 OQ-7 names.
  checkpoint-date: 2026-07-13
  evidence-anchor: docs/decisions/0006-base-tier-agnostic-primitives.md
  on-fail: reopen SPEC-017 as DRAFT; close SPEC-016 OQ-7 and this spec's A-012 dependency together
    before hima init implementation proceeds.

Falsifies-If:
  kill-condition: >
    Any A-item's cited Q-id, question wording, or answer branch diverges from SPEC-016's real,
    accepted §2/§3 question set without the A-item being corrected in the same pass (violating
    INV-5) — this is the exact defect (F1) this integration pass fixed; regressing to an assumed
    or stale question set is a repeat of that defect, not a new one.
  checkpoint-date: 2026-07-13
  evidence-anchor: docs/specs/SPEC-016-onboarding-questions.md §2
  on-fail: reopen SPEC-017 as DRAFT; re-derive §2/§5's A-item ↔ Q-id map against SPEC-016's then-
    current §2/§3 before hima init implementation proceeds.

Falsifies-If:
  kill-condition: >
    Any statement in this spec describes the 7-skill survey/charter/blueprint/forge/trial/verdict/
    stewardship set as the `base` tier rather than the swappable default dev-cycle pack, contradicting
    ADR-0006's accepted tier boundary (violating INV-6).
  checkpoint-date: 2026-07-13
  evidence-anchor: docs/decisions/0006-base-tier-agnostic-primitives.md
  on-fail: reopen SPEC-017 as DRAFT; correct the base/pack framing against ADR-0006 before hima
    init implementation proceeds.
