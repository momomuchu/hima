---
spec-id: SPEC-016
title: hima — Onboarding Questions (the `hima init` question set)
claim-bearing: true
status: DRAFT
date: 2026-07-02
standard-basis: ISO/IEC/IEEE 29148:2018 (requirement statements, StRS-shaped); traces to
  docs/specs/SPEC-VISION.md V-006/V-009/V-010/V-013a, docs/specs/SPEC-PRIMITIVE.md P-002/INV-2,
  docs/decisions/0006-base-tier-agnostic-primitives.md OD-2
ssot-today: packages/hima-core/src/config.ts (HimaConfig), packages/hima-cli/src/setup.ts
  (existing static `hima setup`), packages/schemas/src/{skill-ref,cycle,ward,risk}.ts
supersedes: (none — first formal statement of the `hima init` question set)
companion: docs/specs/SPEC-017 (how the answers below get APPLIED — write HimaConfig, wire
  hooks, surface per-stage suggestions). SPEC-016 is question-set only; it writes nothing.
---

# SPEC-016 — Onboarding Questions

## §0 About this document

`hima init` is the interactive front door: a stranger clones hima, runs `hima init`, and answers
a **short, ordered set of questions** whose answers become a working `HimaConfig` (or trigger a
`hima setup`-equivalent side effect, e.g. hook wiring). This spec is **question-set only** — it
does not implement `hima init`, does not edit `HimaConfig`, and does not touch `setup.ts`. It
names, for each question: the exact prompt, the answer type, the options + default, the *why*,
and the exact `HimaConfig` field (existing or `NEW field:`) the answer will set. SPEC-017 (build)
consumes this table to implement the write path.

**Founder constraint honored:** as few questions as truly needed; every default is safe and
reversible so a user can hit Enter through the whole flow and get a working, ungoverned-by-surprise
project. This mirrors ADR-0006's own design constraint ("a stranger cloning hima gets a working
default … out of the box") applied to the *question flow itself*, not just the skill set.

**Reading the two axes on each requirement:** `[criticality][BLOCKS:x]` per
`~/.claude/rules/spec-criticality.md`. Axis 1 = how load-bearing the question is to hima's
identity; Axis 2 = what else in the onboarding flow depends on this answer landing first.

---

## §1 Ordering rule

- **R-001** `[HIGH][BLOCKS:critical]` Questions run in the fixed order Q-001 → Q-005 below.
  Rationale: Q-001 (runtime) determines which hook-wiring path Q-005 exercises. Q-002/Q-003 must
  precede Q-004 (floor) because `resolveStageForceSkillsForFloor`'s Strict(H)/Critical(C) extras
  (`STAGE_FLOOR_EXTRAS`, `packages/hima-core/src/config.ts:230-308`) are **entirely
  `{source:"corpus", ...}`** references — every single extra skill listed for every stage at H and
  C is corpus-sourced. Recommending Strict(H) at Q-004 before knowing whether `corpus` is enabled
  (Q-003) risks the floor question steering a stranger toward an enforcement level whose own
  extras cannot resolve — the same unresolvable-reference risk named in OQ-7. Reordering is a
  scope change, not a copy edit.
- **R-002** `[CRITICAL][BLOCKS:critical]` Every question MUST have a safe default reachable by
  pressing Enter with zero input. `hima init` with all-defaults MUST produce a valid, decodable
  `HimaConfig` (verifiable: `decodeHimaConfigEither` returns `Right`).
- **R-003** `[MEDIUM][BLOCKS:none]` `hima init` MAY be re-run; answers should pre-fill from the
  existing `.hima/config.json` when present (upgrade path), not re-ask from scratch. This is a
  SPEC-017/build concern, noted here only so the question text below doesn't assume a green field.

---

## §2 The question set

### Q-001 — Which coding-agent runtime(s) will use hima on this project?

- **Prompt text:** `"Which coding agent(s) do you run this project through? (space to select, enter to confirm)"`
- **Answer type:** multi-select (checkbox list), minimum 1 selection enforced.
- **Options:** `Claude Code (claude)` · `Codex (codex)` · `Hermes (hermes)` · `OpenCode (opencode)`.
- **Default:** auto-detected single selection, reusing `resolveRuntime()`'s existing detection
  order (`.claude/` dir → claude; `.codex/` dir or `AGENTS.md` → codex; otherwise → claude) —
  `packages/hima-cli/src/setup.ts:280-295`. The detected runtime is pre-checked; Enter accepts it.
- **Why:** hima's forcing mechanism (`pickAttack`) picks a runtime-specific `GateCapabilityCell`
  (⇽ V-013/V-013a) — the CLI's `--format` flag and `dispatchTranslate()` route
  (`packages/hima-core/src/dispatch.ts`) both need to know which adapter(s) to wire. A project can
  legitimately run more than one coding agent (e.g. Claude for interactive, Codex for CI) —
  hence multi-select, not the single-runtime choice `hima setup --runtime` offers today.
- **Sets:** `NEW field: runtimes` on `HimaConfig` — `Schema.optional(Schema.Array(Schema.Literal("claude","codex","hermes","opencode")))`.
  Today `SetupOpts.runtime` (`setup.ts:165`) is a single, non-persisted CLI flag; nothing in
  `HimaConfig` records "which runtimes this project targets" so a re-run of `hima init`/`hima setup`
  can wire all of them without re-asking. The `RuntimeTarget` literal type already exists
  (`packages/hima-core/src/capability-map-v3.ts:26` / `forcing-primitive.ts:26`, both
  `"claude" | "codex" | "hermes" | "opencode"`) — the new field's literal values must match it
  exactly (open question OQ-1, §4).
- **Force vs advisory:** N/A (a config write, not a gate) — but its downstream effect (Q-005 hook
  wiring) is a real side effect, not advisory.
- **Criticality:** `[CRITICAL][BLOCKS:critical]` — every later gate-behavior decision reads
  `RuntimeTarget`; getting this wrong means hooks get wired for the wrong host or not at all.
- **Traces to:** V-009 (user orchestrates agents from the terminal), V-013a (per-runtime adapters
  are a named dependency).

### Q-002 — Which cycle should hima govern this project with?

- **Prompt text:** `"Use hima's default dev-cycle pack (discovery → analysis → spec → design → impl → test → verify → maintenance), or bring your own cycle later?"`
- **Answer type:** single-select.
- **Options:** `Use the default dev-cycle pack (recommended)` · `I'll define my own cycle later (skip the default pack's forced skills for now)`.
- **Default:** `Use the default dev-cycle pack` — matches the shipped `DEV_CYCLE` fallback that
  `resolveStageForceSkills`/`resolveStageInjectSkills` already apply when no override is present
  (`packages/hima-core/src/config.ts:150-213`), so choosing the default writes **nothing** —
  the existing step-3 fallback already does the right thing.
- **Why:** SPEC-PRIMITIVE P-002/INV-2 requires the cycle to be **data, not hardcoded** — a fresh
  clone needs a *working* cycle out of the box (ADR-0006), but a user with their own methodology
  must be able to opt the default pack **off** without deleting/rewriting `DEV_CYCLE` itself. This
  is exactly ADR-0006's base(agnostic)/dev-cycle-pack(swappable) boundary, asked as one question.
- **Sets:**
  - `Use the default dev-cycle pack` → sets nothing (`HimaConfig.cycle` stays `undefined`; the
    existing DEV_CYCLE fallback in `config.ts` step 3 governs).
  - `I'll define my own cycle later` → `NEW field: useDevCyclePack` — `Schema.optional(Schema.Boolean)`,
    written as `false`. **Today this field would be inert**: `resolveStageForceSkills`/
    `resolveStageInjectSkills` always fall back to the `devCycle` argument they're called with
    (`config.ts:167-170`, `:206-209`) — there is no code path that skips step 3. Making
    `useDevCyclePack: false` actually suppress the fallback is real, named build work (open
    question OQ-2, §4), not a documentation nuance.
  - A **custom** `CycleDef` (full replacement) is written to the **existing** `HimaConfig.cycle`
    field (`config.ts:67`, `CycleDef` from `@hima/schemas`) only when a user hand-authors one —
    `hima init` does not attempt to build a `CycleDef` interactively; it only asks the on/off
    question above and defers custom-cycle authoring to manual `.hima/config.json` editing.
- **Force vs advisory:** the *choice* is advisory (either path is legitimate per ADR-0006); once
  chosen, the resulting `forceSkills` per stage are forced per the existing `pickAttack` ladder —
  unchanged by this question.
- **Criticality:** `[CRITICAL][BLOCKS:high]` — determines whether any stage-bound skill is forced
  at all for this project.
- **Traces to:** V-010, SPEC-PRIMITIVE P-002/INV-2, ADR-0006 (base vs default-pack boundary).

### Q-003 — Enable hima's private corpus skill source?

- **Prompt text:** `"Enable hima's corpus skill source? Only say yes if you have the founder's
  private corpus-* excellence-book collection installed. (base/user/project sources are always
  available and are not asked about.)"`
- **Answer type:** boolean (yes/no). Collapsed from an earlier 4-branch multi-select design
  (`base`/`corpus`/`user`/`project`) per critique finding F2: `base` was always locked-on and
  `user`/`project` are local-directory tiers a stranger has no reason to disable at onboarding
  time (they are either present-and-empty or absent — nothing to opt out of); the only tier worth
  asking about at `hima init` time is `corpus`, since it is the one tier gated on private,
  not-universally-available assets. A 4-branch prompt whose 3 non-corpus branches never vary is
  ceremony, not a question.
- **Options:** `Yes (I have the founder's private corpus)` · `No (default)`.
- **Default:** `No`. Rationale: ADR-0006 / `.planning/research/HIMA-BASE-SKILLS.md` §"What this
  is" states base must be "generic: no dependency on the founder's private corpus … a stranger
  cloning hima gets a working default cycle" — defaulting `corpus` on would silently reference
  `corpus-*` skill ids (`DEV_CYCLE`'s own `forceSkills` already reference
  `corpus-technical-analysis-discovery` etc., `packages/schemas/src/cycle.ts:60,69-70,79,88,97-98,107,116,125`
  — every stage's L/M `forceSkills` today is exclusively `corpus`-sourced) that a stranger's
  environment does not have installed.
- **Why:** `SkillRef.source` is already a closed 4-literal tier (`packages/schemas/src/skill-ref.ts:12`,
  `"base" | "corpus" | "user" | "project"`), matching ADR-0006's `base < corpus < user < project`
  resolution order. When a stage's forced `SkillRef` names a `source` the project has declared
  unavailable, the downstream coding-agent runtime (Claude Code / Codex / Hermes / OpenCode) has no
  installed skill under that id to invoke when hima's PreToolUse gate forces it — the forced
  invocation the runtime receives via `dispatchTranslate()` (`packages/hima-core/src/dispatch.ts`,
  fed by `pickAttack()` at `packages/hima-core/src/run-gate.ts:56`) either errors or silently
  no-ops in the runtime's own skill-invocation path. (Corrected per critique F3: there is no
  "resolve" step inside hima itself — `SkillRef` is never looked up against a registry in
  `hima-core`; the failure happens one layer downstream, in the coding-agent runtime that receives
  the forced reference.)
- **Sets:** `NEW field: enabledSources` — `Schema.optional(Schema.Array(Schema.Literal("base","corpus","user","project")))`.
  `No` (default) writes `["base","user","project"]`; `Yes` writes `["base","corpus","user","project"]`.
  The field keeps its full 4-literal array shape (matching `SkillRef.source`) even though the
  question only exposes one boolean toggle, so a future `hima init` revision can expose per-tier
  control without a field-shape change. **This field has no effect until SPEC-017/build closes
  OQ-7 (§4)** — see OQ-7 for why the field is not yet load-bearing and what must ship before it is.
- **Force vs advisory:** the *toggle* is advisory (a capability declaration); once a source is
  enabled, any `SkillRef` from it participates in the normal force/inject ladder unchanged.
- **Criticality:** `[HIGH][BLOCKS:high]` — wrong here means an unavailable-in-this-repo corpus
  skill gets force-attempted against a stranger clone once OQ-7 is closed and the field becomes
  load-bearing.
- **Traces to:** ADR-0006 (four-provenance-tier model), V-016 (hima governs above the agent, not by
  assuming the founder's private corpus is universally present).

### Q-004 — How strict should hima's default enforcement floor be?

- **Prompt text:** `"Set the default enforcement floor for new work: Advisory (T — inject only, never block), Standard (M — recommended), or Strict (H — hard-block where the runtime allows)?"`
- **Answer type:** single-select.
- **Options:** `Advisory (T)` · `Standard (M — recommended default)` · `Strict (H)`.
  (`C` — Critical — is intentionally NOT offered as an onboarding default: per
  `packages/schemas/src/risk.ts:9-22` C is the top of `RISK_ORDER` and per
  `.planning/research/HIMA-BASE-SKILLS.md` is reserved for genuinely critical structural signals,
  not a floor a user should pick as a blanket starting posture.)
- **Default:** `Standard (M)`. Rationale: T (the code's own zero-config fallback,
  `resolveRiskClass()` → `ward?.floor ?? "T"`, `packages/hima-core/src/risk-class.ts:29`) is the
  *safest* engineering default but under-delivers on V-006's promise ("validated end-to-end … a
  real DoD") if a fresh project silently never forces anything; M is the lowest floor at which
  `resolveStageForceSkillsForFloor`'s H/C extras are still dormant but the base dev-cycle
  `forceSkills` are already active (`config.ts:230-355` — extras only trigger at
  `RISK_ORDER[floor] >= RISK_ORDER["H"]`, `config.ts:334`), giving a working-but-not-heavy first
  experience.
- **Why:** answers V-006's success criterion directly — "you launch a task and it completes
  end-to-end, validated … in a controlled and deterministic way" requires *some* non-zero floor;
  asking the strictness up front avoids every project silently inheriting the bare T fallback.
- **Sets:** **No new `HimaConfig` field.** Writes to the existing
  `<root>/.hima/current-risk.json` scaffold file as `{"risk_class": "<answer>"}`, reusing the file
  `hima setup` already creates (`packages/hima-cli/src/setup.ts:20,343-352`) rather than a new
  `HimaConfig.defaultFloor` field. **OQ-4 RESOLVED (integration pass, 2026-07-02):** this question
  originally had two candidate landing spots — (a) a new `HimaConfig.defaultFloor`, or (b) wiring
  the pre-existing, currently-orphaned `.hima/current-risk.json` into `createWard`
  (`packages/hima-core/src/ward-store.ts:64`) — since `resolveRiskClass()` reads `ward.floor` only
  (`risk-class.ts:29`) and nothing consults `current-risk.json` today. SPEC-017 A-003 picks (b):
  no `HimaConfig` schema change for this question at all; `createWard`'s caller
  (`packages/hima-cli/src/router.ts:357`) must be wired to read `current-risk.json` as the seed
  floor before calling `createWard(root, { id, entryPoint, floor })` when no per-run override is
  given. This mirrors Q-001's own separation of "operational/per-run state" (floor, live dispatch
  runtime) from the `HimaConfig` customization overlay (stageSkills/cycle/roles/runtimes-for-
  hook-wiring). Wiring `current-risk.json` into `createWard`'s call site is real, named build
  work this spec commits to, not yet implemented.
- **Force vs advisory:** the floor itself governs whether later gates can hard-block
  (`enforcementStrength: "hard"` in `GateCapabilityCell`, `packages/schemas/src/capability.ts:29-33`)
  vs. only advise — Advisory(T)/Standard(M) never raise `pickAttack` past what the runtime's
  capability cell already allows; Strict(H) is the first floor where `resolveStageForceSkillsForFloor`
  actually adds extra forced corpus skills per stage (`config.ts:230-308`).
- **Criticality:** `[CRITICAL][BLOCKS:high]` — sets the baseline for every gate decision made for
  the life of the project until explicitly promoted per-run.
- **Traces to:** V-006, V-021 (governance rule — gate cannot advance without a sealed verdict,
  floor determines how hard that gate can enforce), SPEC-PRIMITIVE P-005/P-006.

### Q-005 — Wire runtime hooks now?

- **Prompt text:** `"Wire hima's hooks into the runtime(s) selected in Q-001 now? (idempotent — safe to re-run any time via hima setup)"`
- **Answer type:** boolean (yes/no).
- **Default:** `yes`. Rationale: `mergeClaudeHooks()` is documented and tested as idempotent
  (`packages/hima-cli/src/setup.ts:68-84` — "hima-managed entries are replaced, unrelated entries
  … preserved"), and V-006's zero-manual-verify-spawn promise cannot hold if hooks are never wired
  — an unwired project is a project where hima observes nothing.
- **Why:** this is the one Q&A item with a **real side effect today** — it is exactly what
  `hima setup` already does (`runSetup()`, `packages/hima-cli/src/setup.ts:209-270`): merge the 7
  Claude hook events into `.claude/settings.json` (for `claude` in Q-001's selection), or emit the
  existing best-effort manual-wiring note for `codex`/`hermes` (`setup.ts:230-234`), plus scaffold
  `.hima/state/`, `.hima/config.json`, `.hima/current-risk.json`.
- **Sets:** **no new `HimaConfig` field.** On `yes`, `hima init` calls the existing `runSetup()`
  once per runtime selected in Q-001 (today `runSetup` accepts one `runtime` per call —
  `SetupOpts.runtime`, `setup.ts:165` — so multi-runtime Q-001 answers mean `hima init` loops the
  existing single-runtime call, not a new `setup.ts` API; `opencode` is not yet supported by
  `runSetup` per its own type — `setup.ts:165` omits it — open question OQ-5, §4). On `no`,
  `hima init` still performs the `.hima/` scaffold and config write (Q-001–Q-004 answers persist)
  but skips the hook-file merge step; the user runs `hima setup` manually later.
- **Force vs advisory:** advisory choice; the *result* of choosing yes is a hard mechanism (hooks
  that can hard-block per the runtime's capability cell) — this question is the one place where
  declining has a real governance consequence worth naming explicitly in the prompt text itself
  ("idempotent — safe to re-run any time").
- **Criticality:** `[HIGH][BLOCKS:low]` — deferring hook-wiring doesn't block config being valid,
  but does block V-006's promise from taking effect until the user runs `hima setup` themselves.
- **Traces to:** V-006, V-008 (the governed environment is the coding agent itself — hooks are how
  hima binds to it).

---

## §3 Summary table

| Q-id | Answer type | Default | HimaConfig field | Status |
|---|---|---|---|---|
| Q-001 runtime(s) | multi-select | auto-detect (single, pre-checked) | `NEW field: runtimes` | new |
| Q-002 cycle | single-select | default dev-cycle pack | `cycle` (existing, only for custom) / `NEW field: useDevCyclePack` (opt-out) | mixed |
| Q-003 enable corpus source | boolean | No (`["base","user","project"]`) | `NEW field: enabledSources` | new — inert until OQ-7 closes |
| Q-004 enforcement floor | single-select | Standard (M) | none — writes existing `.hima/current-risk.json` (OQ-4 resolved) | existing file, new answer |
| Q-005 wire hooks now | boolean | yes | none — invokes existing `runSetup()` | existing behavior, reused |

---

## §4 Open questions for SPEC-017 / build (named here, not resolved)

- **OQ-1** `[HIGH][BLOCKS:high]` Where does `RuntimeTarget` get exported from for `HimaConfig` to
  reference it in `packages/hima-core/src/config.ts`? It is currently defined twice, locally, as a
  type (not a `Schema.Literal`) in `capability-map-v3.ts` and `forcing-primitive.ts` — neither is a
  decodable Effect Schema. `HimaConfig.runtimes` needs a `Schema.Literal(...)` mirroring those
  string values, or a shared schema needs to be promoted to `@hima/schemas`.
- **OQ-2** `[CRITICAL][BLOCKS:high]` `useDevCyclePack: false` has no consumer today.
  `resolveStageForceSkills`/`resolveStageInjectSkills` (`config.ts:150-213`) always fall back to
  their `devCycle` argument at step 3 — there is no branch that skips it. Build must decide: pass
  an empty/undefined `devCycle` from the call site when the flag is false, or add a fourth
  early-return branch inside the resolvers themselves.
- **OQ-3** `[HIGH][BLOCKS:medium]` `enabledSources` has no filter consumer today. Nothing between
  `resolveStageForceSkills`'s output and `pickAttack`'s consumption of `forceSkills` currently
  checks `SkillRef.source` against an enabled-sources allowlist.
- **OQ-4** `[CRITICAL][BLOCKS:high]` **RESOLVED (integration pass, 2026-07-02).** Was: a candidate
  new `HimaConfig.defaultFloor` vs. the pre-existing, currently-orphaned `.hima/current-risk.json`
  (`setup.ts:343-352`) — two candidate seeds for a new ward's floor, neither wired into
  `ward-store.ts`'s `createWard` today. Resolution: `.hima/current-risk.json` is the single
  landing spot (see Q-004 §2 "Sets" and SPEC-017 A-003); no `HimaConfig.defaultFloor` field is
  introduced. Remaining build work (not resolved by this pick, still open): wire
  `createWard`'s caller (`packages/hima-cli/src/router.ts:357`) to read `current-risk.json` before
  constructing the `CreateWardOpts.floor` it passes in.
- **OQ-5** `[MEDIUM][BLOCKS:low]` `runSetup`'s `SetupOpts.runtime` type
  (`"claude" | "codex" | "hermes"`, `setup.ts:165`) does not include `"opencode"`, even though
  `capability-map-v3.ts`/`forcing-primitive.ts`'s `RuntimeTarget` and the CLI's own `--runtime` flag
  parsing (`index.ts:97,117,176-184`) already do. Q-001/Q-005 need `runSetup` widened to accept
  `"opencode"` (currently `index.ts:416-417` explicitly falls back to auto-detection for
  `"opencode"` rather than passing it through) before an OpenCode-only answer can wire hooks.
- **OQ-6** `[MEDIUM][BLOCKS:none]` Re-run/upgrade behavior (R-003, §1) — pre-filling `hima init`
  answers from an existing `.hima/config.json` — is named but not specified here; SPEC-017 should
  state the exact precedence (existing config value vs. re-asked default) if `hima init` is
  expected to be idempotent-safe to re-run, matching `hima setup`'s own idempotency contract.
- **OQ-7** `[CRITICAL][BLOCKS:critical]` **Q-002+Q-003's own recommended defaults already trigger
  this document's own §5 kill-condition, TODAY, against the real codebase — not a future-build
  risk.** `DEV_CYCLE` (`packages/schemas/src/cycle.ts:60,69-70,79,88,97-98,107,116,125`)
  unconditionally force-references `corpus`-sourced `SkillRef`s for every stage at floors L/M, and
  `resolveStageForceSkills`/`resolveStageInjectSkills`'s step-3 fallback
  (`packages/hima-core/src/config.ts:167-170,206-209`) reads that list with **no filter of any
  kind** — `enabledSources` (Q-003) is not consulted anywhere in the resolution chain (see OQ-3).
  So a fresh clone that accepts Q-002's default ("use the default dev-cycle pack") and Q-003's
  default ("corpus disabled") gets, on its very first gate, a forced `SkillRef` whose `source`
  ("corpus") it just declared unavailable — exactly the scenario §5's kill-condition clause 3
  forbids. **This must be resolved before `hima init` ships with these two defaults as written,**
  one of:
  (a) re-source `DEV_CYCLE`'s `forceSkills` to reference the `base`-tier meta-skill pack once it
      ships (the same SHORT-TERM-GOAL Part B bullet 3 dependency SPEC-017 A-012 already tracks for
      an unrelated reason — closing that dependency closes this one too), removing the shipped
      default's `corpus` dependency entirely; or
  (b) make `resolveStageForceSkills`/`resolveStageInjectSkills` filter their resolved output
      (all three precedence steps, not a new downstream consumer bolted on after step 3) by
      `config.enabledSources` before returning it — at the cost that a stranger who declines
      `corpus` and keeps the default pack gets **zero** forced skills at L/M until they either
      enable `corpus` or the base pack (option a) ships.
  SPEC-017 MUST pick (a) XOR (b) — not both, not neither — before `hima init` implementation
  proceeds; leaving both `enabledSources` and `DEV_CYCLE` as they are today is not an acceptable
  resolution. Traces to: ADR-0006, SPEC-017 A-012, this file's §5 Falsifies-If clause 3.

---

## §5 Rigor conformance (29148) + falsifier

Per-statement: `Necessary` ☐ `Unambiguous` ☐ `Verifiable` ☐ `Feasible` ☐ `Traceable` ☐ (checked by
the independent rigor pass — a separate reviewer, never the author). Every `Q-00x`/`NEW field:`
above names a code location → verifiable against the SSOT files listed in the frontmatter.

Falsifies-If:
  kill-condition: >
    hima init ships asking more than 5 top-level questions without an explicit, evidenced
    justification recorded in this file (violating the lean-onboarding founder constraint in §0).
  checkpoint-date: 2026-07-13
  evidence-anchor: docs/specs/SPEC-016-onboarding-questions.md §2
  on-fail: reopen SPEC-016 as DRAFT; either justify the extra question inline in §2 with a
    criticality tag, or remove it before any `hima init` implementation proceeds.

Falsifies-If:
  kill-condition: >
    Any question lacks a safe zero-input default such that all-Enter does not produce a decodable
    HimaConfig (violating R-002).
  checkpoint-date: 2026-07-13
  evidence-anchor: packages/hima-core/src/config.ts
  on-fail: reopen SPEC-016 as DRAFT; add the missing default; re-verify
    `decodeHimaConfigEither(allDefaultAnswers)` returns `Right` before `hima init` implementation
    proceeds.

Falsifies-If:
  kill-condition: >
    The base tier's default answers (Q-002 "use the default dev-cycle pack" + Q-003 "corpus
    disabled") cause a fresh clone with no corpus/private setup to force-reference a SkillRef whose
    source is not enabled (violating ADR-0006's "a stranger cloning hima gets a working default …
    out of the box" guarantee). Per OQ-7 this is TRUE TODAY against the real DEV_CYCLE, not a
    hypothetical.
  checkpoint-date: 2026-07-13
  evidence-anchor: packages/schemas/src/cycle.ts
  on-fail: SPEC-017 must close OQ-7 (pick option (a) or (b), not both/neither) before any `hima
    init` implementation ships Q-002/Q-003's stated defaults; reopen SPEC-016 as DRAFT if OQ-7
    remains open past SPEC-017's own acceptance.

Falsifies-If:
  kill-condition: >
    SPEC-017/build implements a NEW field named in §2 with different semantics than stated here
    (field name, type, or which HimaConfig path it writes to) without reopening this spec as DRAFT
    first.
  checkpoint-date: 2026-07-13
  evidence-anchor: docs/specs/SPEC-017-onboarding-apply.md §2
  on-fail: reopen SPEC-016 as DRAFT; reconcile the field's stated semantics against SPEC-017's §2
    transform table before SPEC-017 or any `hima init` implementation proceeds — per
    docs/goals/SHORT-TERM-GOAL.md's own spec-gate ("SPEC-016/017 authored + accepted before any
    hima init implementation").
