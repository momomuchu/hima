---
claim-bearing: true
status: COMPLETE
created: 2026-05-14
cycle: cycle-68-api-stability-review
---

# Stream H - API Stability Review

## Result

Cycle 68 reviewed `packages/core/src/index.ts`, the package barrel for `@harness/core`.

The package is not publicly released: `packages/core/package.json` still has `"private": true`,
`"version": "0.0.0"`, and `"license": "UNLICENSED"`. This review is therefore an API stability
inventory, not npm publication evidence.

## Export Inventory

| Export group | Current barrel surface | Stability verdict | Rationale |
|---|---|---|---|
| Catalogs | `./catalogs/index.js` | Stable | Catalog discovery and routing are central public primitives for adapters/CLI. |
| Convergence | `./convergence/evaluate-convergence.js` | Stable | Run closure uses this as an evidence/readiness boundary. |
| Domain events/run | `./domain/events.js`, `./domain/run/index.js` | Stable | DDD-facing aggregate/event contracts are intended shared-kernel surfaces. |
| Evidence | `./evidence/evaluate-evidence.js` | Stable | Evidence sufficiency is a core public gate primitive. |
| Gates | `./gates/evaluate-gate.js` | Stable | Gate evaluation is the main policy API and is used by hook services. |
| Governance | `./governance/load-dor-dod.js` | Stable | DoR/DoD loading is a named governance primitive. |
| Install/artifacts/runtime lifecycle | `artifact-install`, `artifact-rollback`, `platform-install`, `runtime-lifecycle` | Provisional | Required by CLI/install workflows, but filesystem side effects make this sensitive before real install tests. |
| Skill install/resolve | `skill-resolver`, `skills-install` | Stable | Durable scope and schema-gated skill resolution are already heavily tested. |
| Policy | `baseline-policy`, `write-zones` | Stable | These are deterministic policy inputs to gates. |
| Repositories | `./repositories/index.js` | Provisional | Repository adapters are useful, but persistence boundaries may change after real runtime runs. |
| Risk classifier | explicit types/functions from `risk-classifier/index.js`, `maxRiskClass` | Stable | Risk classification is a public governance primitive. |
| Runtime bindings/probe/profiles | selected runtime-binding functions/types plus probe/profile exports | Provisional | Runtime capability assessment is public, but final adapter E2E proof is still absent. |
| Schemas | benchmark, compliance, current-risk, gate-event, run-set, runtime-parity, SIEM, skill, state | Stable | Zod schemas are validation contracts and should remain importable. |
| Security | `hard-limits`, `redaction` | Provisional | Redaction is stable; hard-limits currently covers one selected D-H7 boundary only. |
| Services | add evidence, close run, enter development, status, hook handling, init, transition | Stable | These are application-service entry points used by CLI/MCP/adapters. |
| SIEM/stress | `local-siem-fixture`, `local-stress-fixture` | Provisional | They are explicitly local fixture surfaces, not production SIEM/load proof. |
| State machine | `machine`, `transition` | Stable | Canonical lifecycle transition API. |
| Storage | events log, hash-chain ledger, planning paths/store, safe write | Provisional | Some storage APIs are useful externally, but they expose persistence internals and may need narrower facades before v1. |
| Canonical types/errors | `types/canonical`, `types/errors` | Stable | Shared vocabulary and error contracts should remain public. |

## Drift Actions

No export removal is required in Cycle 68. Breaking removals would create churn before the real
runtime E2E and install evidence exists.

Before public v1.0 release:

1. Keep `@harness/core` private until npm publication is explicitly authorized.
2. Revisit provisional export groups after adapter E2E and real install proof.
3. If storage internals are not meant for external consumers, add narrower facade exports before
   publishing rather than silently removing them later.
4. Treat `security/hard-limits` as provisional until token budget, subagent inheritance, and runtime
   adapter proof are either implemented or explicitly out of v1 scope.

## Verification

| Check | Result |
|---|---|
| `packages/core/src/index.ts` inventory | PASS: every current export group is represented above. |
| Package release boundary | PASS: `packages/core/package.json` is private, version `0.0.0`, and not release evidence. |
| `corepack pnpm exec biome check ...API review touched files...` | PASS. |
| `corepack pnpm docs:index` | PASS. |
| `corepack pnpm lint` | PASS. |
| Post-tool dry-run | PASS: `post_tool` allowed with no policy violations. |
| Saturation sweep | PASS: only expected release-boundary language, static target text, and explicit non-goals remained. |

```yaml
Falsifies-If:
  kill-condition: API review claims public release readiness, npm publication, or stable v1 API compatibility while package metadata remains private/unreleased or export groups are unreviewed.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/excellence-application/05-architecture/stream-h-api-stability-review.md
  on-fail: Reopen cycle-68 as BLOCKED_API_STABILITY_OVERCLAIM and restore export inventory gaps.
```
