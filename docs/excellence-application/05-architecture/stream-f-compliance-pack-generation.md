---
claim-bearing: true
status: COMPLETE
created: 2026-05-14
cycle: cycle-38-stream-f-compliance-pack-generation
---

# Stream F - Compliance Pack Generation

## Result

Cycle 38 added local assembled-pack generation through:

```text
harness compliance-pack assemble
```

The command verifies every required evidence reference exists inside the selected project root before
writing an assembled developer-session compliance pack under:

```text
<root>/.planning/compliance-packs/<session-id>.assembled.json
```

It still does not run SWE-bench, execute Claude/Codex/Hermes, invoke model sessions, call external
services, or certify EU AI Act compliance.

## Required Evidence References

An assembled pack requires all six references:

- `riskClassificationPath`
- `runSetPath`
- `ledgerPath`
- `runtimeEvidencePath`
- `benchmarkResultPath`
- `complianceMappingPath`

Every reference must be relative to the selected root and must resolve inside that root. Missing
files block generation before any assembled pack is written.

## Implementation

`assembleCompliancePackArtifact()` in `packages/cli/src/index.ts`:

- parses the runtime target and session id;
- verifies every evidence reference with filesystem access checks;
- rejects absolute or root-escaping reference paths;
- parses the assembled artifact through `CompliancePackSchema`;
- writes via `safeAtomicWriteFile()`;
- returns `externalSessionsLaunched: false`.

## Verification

| Check | Result |
|---|---|
| `corepack pnpm --filter @harness/cli test` | PASS: 90 tests. |
| `corepack pnpm exec biome check packages/cli/src/index.ts packages/cli/test/index.test.ts docs/conception/09-cli-commands-spec.md` | PASS. |
| `corepack pnpm docs:index` | PASS. |
| `corepack pnpm lint` | PASS. |
| `corepack pnpm build` | PASS. |
| Built CLI assemble+validate smoke | PASS: assembled pack verified six local evidence paths and validated with `externalSessionsLaunched: false`. |
| Post-tool dry-run | PASS against repo root. |
| Saturation sweep | PASS with only expected non-certification and missing-evidence rejection hits. |

## Non-Goals

Cycle 38 did not:

- run SWE-bench Verified;
- execute real runtime/model sessions;
- decide whether evidence content is legally sufficient;
- certify EU AI Act compliance;
- verify SIEM ingest.

```yaml
Falsifies-If:
  kill-condition: Compliance pack generation succeeds with missing required evidence, writes packs outside root, claims EU AI Act compliance, or launches external runtime/model sessions.
  checkpoint-date: 2026-05-28
  evidence-anchor: packages/cli/src/index.ts
  on-fail: Reopen cycle-38 as BLOCKED_COMPLIANCE_PACK_GENERATION and restore local evidence-reference verification.
```
