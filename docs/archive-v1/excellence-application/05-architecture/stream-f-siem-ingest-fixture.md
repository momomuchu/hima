---
claim-bearing: true
status: COMPLETE
created: 2026-05-14
cycle: cycle-43-stream-f-siem-ingest-fixture
---

# Stream F - SIEM Ingest Fixture

## Result

Cycle 43 added a local SIEM-like ingest fixture:

- `SiemIngestRecordSchema`
- `SiemIngestFixtureSchema`
- `runLocalSiemFixture`
- `harness siem-fixture`

The fixture generates deterministic local HIMA ledger data, maps each ledger entry into a
SIEM-like record, validates security-log fields, and writes a local fixture artifact under
`.planning/siem-fixtures/`.

## Scope Boundary

This is local normalization evidence only. It does not transmit data to a SIEM, prove external SIEM
integration, prove production ingest, or satisfy final F5 compliance pack + SIEM ingest acceptance.

The fixture contract requires:

- `fixtureScope: "local_only_no_external_siem"`;
- `source: "hima-ledger"`;
- integrity fields for ledger sequence, previous hash, event hash, and signature presence;
- `externalTransmissions: false`;
- `externalSessionsLaunched: false`.

## Drift Detection

The validator fails when:

- required integrity fields are missing;
- hash fields are malformed;
- signature presence is not recorded as true;
- local evidence anchor kind is missing;
- a record claims external transmission or external session execution.

Focused tests reject records with missing `eventHash` and records claiming external transmission.

## Verification

| Check | Result |
|---|---|
| `corepack pnpm --filter @harness/core test -- local-siem-fixture.test.ts` | PASS: 402 tests through the package runner. |
| `corepack pnpm --filter @harness/cli test` | PASS: 109 tests. |
| `corepack pnpm exec biome check ...siem fixture touched files...` | PASS. |
| Built CLI SIEM fixture smoke | PASS: 5 local records, valid ledger, no external transmission, no external sessions. |
| `corepack pnpm docs:index` | PASS. |
| `corepack pnpm lint` | PASS. |
| `corepack pnpm build` | PASS. |
| Post-tool dry-run | PASS: `post_tool` allowed with no policy violations. |
| Saturation sweep | PASS: only expected guardrail wording and negative-test hits remained. |

## Non-Goals

Cycle 43 did not:

- send data to a SIEM;
- run Claude Code, Codex CLI, Hermes, SWE-bench, or model sessions;
- prove production ingest throughput;
- satisfy final F5 compliance pack + SIEM ingest acceptance.

```yaml
Falsifies-If:
  kill-condition: Local SIEM ingest fixtures are presented as external SIEM integration evidence or transmit data outside the local project.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/excellence-application/05-architecture/stream-f-siem-ingest-fixture.md
  on-fail: Reopen cycle-43 as BLOCKED_SIEM_FIXTURE_OVERCLAIM and restore local-only scope.
```
