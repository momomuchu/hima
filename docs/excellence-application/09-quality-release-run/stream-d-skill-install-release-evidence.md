# Stream D Skill Install Release Evidence

Date: 2026-05-14  
Cycle: `cycle-15-quality-release-application`  
Bounded unit: D-skills install/resolver surface from cycles 13 and 14.

## Route

Primary route: `09-quality-release-run/quality-engineering-excellence-book`, Path B
pre-release gate check plus `test-portfolio-scorecard.md` and `risk-based-testing-matrix.md`.

Secondary review packet shape: `software-delivery-governance-excellence-book/07-review-verification-and-acceptance/templates/review-evidence-packet-template.md`.

This packet decides release evidence for the D-skills slice only. It does not approve public
package release, runtime adapter exposure, hook coverage, MCP tooling, skill linting, or bulk
skill migration.

## Scoped Outputs

| Output | Evidence | Verdict |
|---|---|---|
| Durable skill scope paths | `packages/core/src/install/artifact-paths.ts`; focused tests cover public/user/org/project paths. | PASS for core install path semantics. |
| Skill resolver precedence | `packages/core/src/install/skill-resolver.ts`; focused tests cover public < user < org < project and no-org default resolution. | PASS for deterministic resolver behavior. |
| Schema-gated installer | `packages/core/src/install/skills-install.ts`; focused tests cover unsafe descriptor rejection and locked frontmatter write. | PASS for write-planning validation. |
| Dry-run no-write behavior | Focused test checks planned project skill path remains absent after dry-run. | PASS. |
| Managed overwrite safety | Focused test refuses unmanaged existing skill content unless `force` is explicit. | PASS for accidental overwrite prevention. |
| Managed header ownership | Cycle 14 fix validates `source` and emits the managed header from descriptor metadata. | PASS after regression test. |
| Generated frontmatter compatibility | Cycle 15 parser round-trip test parses rendered frontmatter with `yaml` and validates it through `parseSkillFrontmatter`. | PASS after added fixture. |
| Runtime adapter exposure | Not implemented by D-S1. | DEFER to future Stream D adapter work. |
| Skill lint rules | Not implemented by D-S1. | DEFER to HARV-02 / skill-lint cycle. |
| Bulk generated skill migration | Not implemented by D-S1. | DEFER to G-harvest skill installation cycles. |

## Risk-Based Testing Matrix

| Risk | Impact | Probability | Detectability | Reversibility | Current signal | Gate |
|---|---:|---:|---:|---:|---|---|
| Path traversal writes outside intended scope | 5 | 2 | 2 | 3 | schema-gated unsafe name rejection and path-boundary resolver tests | block if missing |
| Wrong skill selected when duplicate names exist | 4 | 3 | 2 | 4 | precedence fixture across all four durable scopes | block if missing |
| No-org installations fail by default | 3 | 3 | 2 | 4 | no-org default resolver fixture plus explicit-org rejection fixture | block if missing |
| Dry-run mutates filesystem | 4 | 2 | 2 | 5 | dry-run absence check | block if missing |
| Existing manual skill overwritten silently | 4 | 2 | 2 | 4 | unmanaged overwrite rejection test | block if missing |
| Rendered frontmatter cannot be parsed by consumers | 4 | 2 | 3 | 4 | YAML parser round-trip plus locked schema validation | block if missing before bulk migration |
| Release overclaim before runtime exposure | 3 | 3 | 4 | 5 | this packet records runtime adapter exposure as deferred | warn/block by claim |

## Test Portfolio Scorecard

| Layer | Count | Runtime | Unique risk covered | Maintenance pain |
|---|---:|---|---|---|
| Unit / filesystem fixture | 12 focused tests in `skills-install.test.ts` | ~2-3s focused | installer planning, writes, resolver precedence, no-org default, overwrite refusal, managed-source validation, parser round-trip | Low; temp dirs and direct file assertions. |
| Full core regression | 32 files / 331 tests | ~6-10s | package-level regression after D-skill exports and install changes | Moderate; broad but fast enough for closure. |
| Lint/static/docs guard | `corepack pnpm lint`; `docs:index`; inventory compare | seconds | import order, vocab guards, docs-index drift, source inventory truth | Low. |
| Build/type declarations | `corepack pnpm build` | ~20-35s | exported package surface and declaration generation | Low to moderate. |
| Runtime adapter/E2E | 0 | n/a | none yet | Deferred; not in D-S1 scope. |

Decision:

- Add: parser round-trip fixture for generated `SKILL.md` frontmatter.
- Rewrite: none.
- Delete: none.
- Quarantine: none.
- Move lower in stack: not applicable; current focused filesystem fixtures are the cheapest reliable signal.

## Release Limits

This D-skills slice is **core-ready**, not product-release-ready.

Allowed claims:

- Core can plan and write schema-gated `.hima/skills/{name}/SKILL.md` artifacts under public/user/project/org durable scopes.
- Core can resolve skill candidates with deterministic public < user < org < project precedence.
- Focused and full core verification passed for the D-skill install/resolver slice.

Blocked claims:

- HIMA runtime adapters load or execute installed skills.
- Skill linting, MCP exposure, prompt-file generation, hook integration, or bulk otherskill migration is complete.
- Public package release readiness is proven by this slice alone.

## Rollback / Recovery

| Failure | Recovery path |
|---|---|
| Generated skill files need removal before integration | Use the returned `writtenPaths` from `installHimaSkills`, or remove the scoped `.hima/skills/{name}/SKILL.md` files from the selected scope root. |
| Managed generated file must be replaced | Re-run `installHimaSkills({ dryRun: false })`; it updates managed files and reports unchanged paths. |
| Manual skill exists at target path | Installer blocks by default; rerun only with explicit `force` after owner review. |
| Scope root misconfigured | Default resolver omits org when `orgRoot` is absent; explicit org operations fail closed. |
| Runtime integration finds parser incompatibility | Parser round-trip fixture is now the regression anchor; add the consuming parser case before migration. |

## Deferred Gap Owners

| Gap | Owner cycle / route | Required evidence before pass |
|---|---|---|
| Runtime adapter exposure | Future Stream D adapter work | Adapter-level fixture proving installed skills are discoverable by Codex/Claude/Hermes binding layer. |
| D-hooks integration | Cycle 16+ D-hooks | Hook dry-run and focused hook tests for new gate events. |
| Skill lint rules | HARV-02 / `skill-lint.ts` | Lint matrix and negative fixtures for malformed generated/manual skills. |
| Bulk generated skill migration | G-harvest skill installation cycles | Sample migration fixture, rollback list, parser round-trip on generated corpus, and no-overwrite proof. |
| Public package release | Later release checklist | Package readiness, tarball smoke, adapter coverage, changelog/release notes, and release owner approval. |

## Evidence Table

| Check | Latest result | Interpretation |
|---|---|---|
| Focused skill install test | PASS, 1 file / 12 tests | D-skill release-relevant fixtures pass. |
| Full core test suite | PASS, 32 files / 331 tests | No known core regression. |
| `corepack pnpm lint` | PASS | Static style, vocab guards, and docs-index check are clean. |
| `corepack pnpm docs:index` | PASS | Docs index regenerated after new evidence packet. |
| `corepack pnpm build` | PASS | Package build/declaration surface is clean after the parser fixture and evidence packet. |
| Inventory compare | PASS, `SRC_COUNT=67`, `CSV_COUNT=67`, `DIFF_COUNT=0` | No source inventory drift is present. |
| Post-tool dry-run | PASS, `{}` | Hook dry-run accepted touched claim-bearing files. |

## Verdict

Decision: `PASS for D-skills core slice` after full closure gates and saturation critic pass.

Release gate: `HOLD for broader Stream D / public release` until deferred runtime, hook, lint, and bulk migration owners close their evidence.

Allowed next action: proceed to closure gates, critic review, then D-hooks planning if Cycle 15 closes.

Blocked actions: marking all Stream D complete, claiming runtime skill invocation, or starting public release packaging from this packet alone.

## Evidence / Inference / Assumption / Risk

- **Evidence:** The quality book requires risk-first release evidence; the focused test suite now maps each D-skill failure mode to a concrete fixture.
- **Inference:** The D-skills core install/resolver surface has enough local evidence to be treated as stable input for the next Stream D hook work.
- **Assumption:** Runtime adapters will consume the generated Markdown/frontmatter format rather than a separate compiled artifact.
- **Risk:** Adapter behavior can still invalidate the integration path; that risk is explicitly deferred and must be proven at adapter level before runtime skill invocation is claimed.
