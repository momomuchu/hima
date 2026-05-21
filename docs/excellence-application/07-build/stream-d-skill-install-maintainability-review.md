# Stream D Skill Install Maintainability Review

Date: 2026-05-14  
Cycle: `cycle-14-build-quality-application`  
Bounded unit: Cycle-13 D-S1/HARV-10 skill install and resolver surface.

## Route

Primary route: `07-build/code-quality-maintainability-excellence-book`, `templates/implementation-checklist.md`.

Reason: this is a narrow implementation-quality pass over existing TypeScript code. It checks
understandability, reversibility, local evidence, and proportional documentation before Stream D
hooks begin.

Adjacent routes explicitly out of scope:

| Adjacent risk | Disposition |
|---|---|
| Release confidence / test strategy | Routed to the queued Cycle 15 quality-release application. |
| Security/privacy/compliance | No credential, customer data, network, or policy claim changed; unsafe path and managed-header inputs remain locally tested. |
| Architecture/platform/integration | No new bounded context or adapter runtime contract introduced. Runtime adapter exposure remains future Stream D adapter work. |
| Customer/legal/accounting | No customer-facing contract, billing, legal notice, or procurement claim changed. |

## Source Interpretation

| Source | Supports here | Does not prove |
|---|---|---|
| `07-build/code-quality-maintainability-excellence-book/templates/implementation-checklist.md` | Small, reversible, locally evidenced implementation review. | Release readiness, security approval, architecture approval, or customer sufficiency. |
| `07-build/code-quality-maintainability-excellence-book/01-maintainability-model/templates/local-evidence-adequacy-review.md` | Local artifacts and source-limit discipline before accepting maintainability action. | That any source-backed suggestion is locally correct without tests. |
| OpenHands skills docs and agent-server skill API | Source correction that OpenHands loads sandbox/public/user/org/project. | That HIMA should implement sandbox as a durable install scope. |

## Local Evidence Inventory

| Evidence family | Artifact | Interpretation | Gap |
|---|---|---|---|
| Code surface | `packages/core/src/install/artifact-paths.ts`, `skill-resolver.ts`, `skills-install.ts` | Skill path, resolution, and install planning are isolated to the install boundary. | Runtime adapter exposure is intentionally future work. |
| Tests | `packages/core/test/skills-install.test.ts` | Covers dry-run, schema rejection, writes, idempotence, unmanaged overwrite refusal, precedence, no-org default resolution, unsafe lookup, explicit org rejection, managed source rejection, and generated frontmatter parser round-trip added in Cycle 15. | Runtime adapter discovery remains future work. |
| Docs | `docs/excellence-application/05-architecture/stream-d-skill-scope-install.md`, `docs/goals/COMPLETE-CONSTRUCTION-GOAL.md` | Source correction and non-goals are recorded. | Older research notes still preserve historical wording; they are not current goal truth. |
| Tool output | Cycle-13 closure and Cycle-14 focused checks | Focused skill tests and lint passed after maintainability fixes. | Full gate set must pass before Cycle 14 closes. |

## Findings

| ID | Finding | Verdict | Evidence / action |
|---|---|---|---|
| C14-F1 | `HimaSkillInstallDescriptor.source` existed but generated managed headers were hardcoded or caller-provided in `body`, making ownership ambiguous. | fix-now | `renderSkillFile` now emits the managed header from descriptor `source`; generated catalog bodies no longer carry their own header; source values are validated before planning. |
| C14-F2 | Empty list frontmatter rendered as a bare YAML key with no explicit array value, which is harder to read and can parse as null in common YAML tooling. | fix-now | `yamlArrayField` now renders empty arrays as `field: []`; tests assert `requires_tools: []` and `fallback_for_toolsets: []`. |
| C14-F3 | Default no-org resolution was fixed in Cycle 13 after critic feedback. | no-action | Existing tests now cover default public/user/project behavior without `orgRoot` and explicit org rejection. |
| C14-F4 | Runtime adapter exposure for installed skills remains absent. | defer-with-owner | This is future Stream D adapter work, not a maintainability defect in the install boundary. |
| C14-F5 | Older research notes contain historical OpenHands four-scope wording. | defer-with-owner | Current truth surfaces are corrected; historical research notes should be handled only if promoted to active goal truth. |

## Implementation Checklist

| Gate | Result | Evidence |
|---|---|---|
| Diff is small, reviewable, and reversible | PASS | One installer file, one focused test file, one review doc. |
| Names express domain intent | PASS | `yamlArrayField`, `parseHimaSkillSource`, and managed-header emission describe the boundary directly. |
| New abstraction has real use | PASS | `yamlArrayField` removes four repeated list-rendering branches; `parseHimaSkillSource` protects managed header rendering. |
| Error handling is explicit | PASS | Unsafe managed source values throw before write planning. |
| Changed behavior is verified | PASS | Focused `skills-install.test.ts` now includes 11 passing tests. |
| Docs are useful and owned | PASS | This review is the durable Cycle 14 artifact; no ADR/changelog needed. |
| Adjacent risks are routed | PASS | Quality-release and runtime adapter work remain queued, not silently approved here. |

## Verdict

Decision: `pass-evidence` after full closure gates and saturation review pass.

Allowed next action: run full core tests, docs index, build, inventory, post-tool dry-run, then send to a critic for Cycle 14 saturation.

Blocked actions: D-hooks implementation, MCP tooling, prompt-file generation, skill linting, bulk skill migration, or release-confidence claims before the queued quality-release application.

Outcome trigger: if runtime adapters parse `SKILL.md` with a different parser or add provider-specific frontmatter fields, add adapter-level parser fixtures before broad skill migration.

## Evidence / Inference / Assumption / Risk

- **Evidence:** The implementation checklist requires actual diff and local checks; the changed code and focused tests are present in the repo.
- **Inference:** Making managed headers source-driven and empty arrays explicit reduces future maintainer confusion without widening the behavior surface.
- **Assumption:** The durable install artifact format remains Markdown with YAML-like frontmatter and an HTML managed marker.
- **Risk:** Adapter-level parsing can still differ from the core YAML parser round-trip and must be proven before runtime invocation or bulk migration is claimed.
