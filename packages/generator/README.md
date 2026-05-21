# @harness/generator

Compiles the **otherskill excellence consommable** into three hima catalog artifacts:

- `skill-catalog-entries.ts` — typed `SkillCatalogEntry[]` array for inclusion in `operational-catalog.ts`
- `keyword-registry.json` — keyword → skillId routing table, with `forcedInvoke` / `stage` metadata from activation rules
- `activate-skills.json` — the 16 structural `activate-Pn` skills (P1–P16), each scoping a window of the dev-cycle spine

---

## Pipeline

```
PARSE → MAP → VALIDATE → EMIT(staging) → VERIFY+canary
```

| Stage | What happens |
|-------|-------------|
| **PARSE** | Reads `--corpus <dir>` (skill markdown files) and `--activation-rules <file>` into `RawSkill[]` + `RawRule[]` |
| **MAP** | `mapSkill()` derives id, title, purpose, activation envelope, owns/outOfScope from each `RawSkill`. `mapKeywordRegistry()` cross-references HARD rules. `buildActivateSkill()` constructs the 16 preset entries from `PRESETS` + HARD-rule sets per window. |
| **VALIDATE** | Every draft is parsed through `SkillCatalogEntrySchema` and `ActivateSkillSchema` (Zod). Validation errors accumulate in `errors[]`; the run does not abort early. |
| **EMIT** | On `passed && !dryRun`, writes three files to `src/generated/` (content-addressed — file is skipped if content is unchanged). |
| **VERIFY** | Non-vacuity canary runs unconditionally (see below). `passed = errors.length === 0 && canary.passed`. |

---

## CLI

```
node scripts/generate-consommable-artifacts.mjs \
  --corpus <dir> \
  --activation-rules <file> \
  [--dry-run] \
  [--canary-only] \
  [--out-dir <dir>]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--corpus <dir>` | Yes (unless `--canary-only`) | Root directory of excellence-book skill markdown files |
| `--activation-rules <file>` | Yes (unless `--canary-only`) | Path to the activation rules file (HARD/SOFT rule table) |
| `--dry-run` | No | Runs PARSE → MAP → VALIDATE and canary, prints results, but skips all file writes |
| `--canary-only` | No | Skips corpus parse entirely; runs only the non-vacuity canary and exits |
| `--out-dir <dir>` | No | Override staging output directory (default: `src/generated/` relative to package root) |

Exit codes: `0` = PASS, `1` = FAIL (validation errors or canary failure), `2` = bad usage (missing required flags).

Stdout summary:

```
skills:   42/42 valid
activate: 16/16 valid
keywords: 87 entries
canary:   canary OK — validator rejected malformed entry with 3 issues
written:  3 file(s)
RESULT:   PASS
```

---

## Non-vacuity canary

Runs at every invocation (including `--dry-run`). Injects a deliberately malformed entry — non-kebab `id`, empty required arrays, missing `operatingModes` — and asserts the Zod schema rejects it with **at least 3 distinct issues**. If the schema accepts the malformed entry, the canary fails and the whole run fails, regardless of whether real skills validated cleanly. This guards against accidental schema relaxation making validation vacuous.

---

## Idempotency

Emit is **content-addressed**: `writeIfChanged()` reads the existing file, compares byte-for-byte, and skips the write if content is identical. Re-running the generator on the same corpus produces zero writes and the same `PASS` result. Managed blocks (`<!-- HIMA:SKILL-ARTIFACT ... -->`) in `activate-skills.json` entries are stamped at generation time and are stable across runs for the same input.

---

## Tidy-First Slice-2 wiring relationship

The generator emits to `src/generated/` (architecture decision D1: **staging only**). It does **not** mutate `operational-catalog.ts` directly. Appending the generated `GENERATED_SKILL_ENTRIES` array into `operational-catalog.ts` is a separate structural commit — Tidy-First Slice 2 — performed after the staging artifacts are reviewed and committed. This keeps the behavioral change (new catalog entries activate in production) isolated from the structural change (generator plumbing).

---

## Outputs (src/generated/)

| File | Type | Description |
|------|------|-------------|
| `skill-catalog-entries.ts` | TypeScript module | `export const GENERATED_SKILL_ENTRIES: readonly SkillCatalogEntry[]` — append to `operational-catalog.ts` in Slice 2 |
| `keyword-registry.json` | JSON | `KeywordRegistryDraft[]` — skillId, keywords[], forcedInvoke, stage |
| `activate-skills.json` | JSON | 16 `activate-Pn` skill objects with frontmatter, window, hardSets, body |

---

## The 16 activate-Pn presets

| Preset | Name | Spine window | Intent |
|--------|------|-------------|--------|
| P1 | full | 1–13 | Raw problem all the way to a measured, financed product |
| P2 | product-discovery | 1–4 | Raw problem to written spec |
| P3 | idea-to-design | 1–5 | Idea to validated UX design |
| P4 | idea-to-arch | 1–6 | Idea to architecture decision record |
| P5 | strategy | 2–3 | Positioning + technical discovery |
| P6 | discovery | 3–4 | Technical discovery + spec in one pass |
| P7 | discovery-to-design | 3–5 | Discovery into spec + UX-complete design |
| P8 | discovery-to-arch | 3–6 | Discovery through to architected solution |
| P9 | spec-to-ship | 4–9 | Design, architect, build, and ship an existing spec |
| P10 | design-only | 5–5 | UX flows, component designs, usability validation |
| P11 | arch-to-ship | 6–9 | Architect, implement, and ship |
| P12 | build-to-ship | 8–9 | Implement, test, and release |
| P13 | aiml-feature | 7–9 | AI/ML feature design, implement, ship |
| P14 | gtm | 10–13 | Acquire users, retain, measure, unit economics |
| P15 | have-idea-to-ship | 2–9 | Formed idea with rough positioning to shipped product |
| P16 | scope | 1–1 | Single targeted decision rule, no traversal |

Each `activate-Pn` skill body lists the HARD-rule disciplines (non-skippable even in bypass) that fall within its window. A skipped HARD discipline BLOCKs the run in every mode.

---

## Requirements

- Node.js >= 20
- Built via `pnpm build` (tsup, ESM output to `dist/`)
