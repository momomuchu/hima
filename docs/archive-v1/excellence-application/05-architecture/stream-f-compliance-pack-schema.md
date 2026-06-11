---
claim-bearing: true
status: COMPLETE
created: 2026-05-14
cycle: cycle-37-stream-f-compliance-pack-schema
---

# Stream F - Compliance Pack Schema

## Result

Cycle 37 added a local developer-session compliance-pack artifact contract and CLI skeleton:

- `CompliancePackSchema` in `packages/core/src/schemas/compliance-pack.schema.ts`
- `harness compliance-pack write`
- `harness compliance-pack validate`

The surface is intentionally local-only. It validates and writes draft or blocked evidence-pack
artifacts, but it does not launch SWE-bench, execute runtimes, invoke model sessions, or certify EU
AI Act compliance.

## Artifact Contract

Compliance packs use:

```text
kind: developer-session-compliance-pack
claimBoundary: evidence_pack_not_compliance_certification
status: draft | blocked | assembled
```

Draft packs require evidence references for:

- risk classification;
- run-set state;
- hash-chained ledger;
- runtime evidence.

Blocked packs require:

- `blockReason`;
- `unavailableEvidence`.

Assembled packs are reserved for a future generation cycle and require benchmark result plus
compliance mapping evidence. The current CLI writer deliberately allows only `draft` and `blocked`.

## CLI Boundary

`harness compliance-pack write` persists artifacts under:

```text
<root>/.planning/compliance-packs/<session-id>.<status>.json
```

The command parses every artifact through `CompliancePackSchema` before writing and returns
`externalSessionsLaunched: false`.

`harness compliance-pack validate <file>` validates a JSON file through the same schema and reports
status, session id, runtime target, and claim boundary without executing anything.

## Verification

| Check | Result |
|---|---|
| `corepack pnpm --filter @harness/core test -- compliance-pack-schema.test.ts` | PASS: 381 tests through the package runner. |
| `corepack pnpm --filter @harness/cli test` | PASS: 86 tests. |
| `corepack pnpm exec biome check packages/core/src/schemas/compliance-pack.schema.ts packages/core/test/compliance-pack-schema.test.ts packages/cli/src/index.ts packages/cli/test/index.test.ts docs/conception/09-cli-commands-spec.md` | PASS. |
| `corepack pnpm docs:index` | PASS. |
| `corepack pnpm lint` | PASS. |
| `corepack pnpm build` | PASS. |
| Built CLI write+validate smoke | PASS: draft artifact validated with `externalSessionsLaunched: false`. |
| Post-tool dry-run | PASS against repo root. |
| Saturation sweep | PASS with only expected non-certification and fake-certification rejection hits. |

## Non-Goals

Cycle 37 did not:

- run SWE-bench Verified;
- execute real runtime/model sessions;
- generate real EU AI Act evidence packs;
- claim Article-level compliance;
- verify SIEM ingest.

```yaml
Falsifies-If:
  kill-condition: Compliance pack artifacts claim real runtime/EU AI Act compliance without real evidence, omit required evidence references, or launch external runtime/model sessions.
  checkpoint-date: 2026-05-28
  evidence-anchor: packages/core/src/schemas/compliance-pack.schema.ts
  on-fail: Reopen cycle-37 as BLOCKED_COMPLIANCE_PACK_SCHEMA and restore draft/blocked local-only semantics.
```
