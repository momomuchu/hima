---
claim-bearing: true
status: CURRENT
cycle-id: cycle-73-runtime-external-evidence-boundary
last-updated: 2026-05-15 cycle-96-external-authorization-required
---

# Runtime / External Evidence Boundary

## Scope Boundary

This ledger maps remaining construction-goal gaps to the real evidence required to close them. It does not run external sessions, write to real `~/.hima`, publish packages, contact users, wire payments, or claim beta, revenue, launch, market, legal, or runtime completion.

Current checklist snapshot after Cycle 95:

| Done | Total | Percent |
|---:|---:|---:|
| 119 | 155 | 76.8% |

## Remaining Requirement Families

| Family | Open Master Rows | Current Local Evidence | Required Real Evidence | Authorization Class | Stop Condition |
|---|---|---|---|---|---|
| Adapter real E2E | Claude, Codex, Hermes adapter E2E rows. | Adapter packages, system prompts, hook bindings, install modules, local smoke fixtures, blocked preflight artifacts, Cycle 78 authorization/runbook prep, and Cycle 80 blocker review exist. | Real Claude Code, Codex, and Hermes sessions on a coding task, with transcripts, hook payloads, ledgers, accepted evidence, and passing adapter E2E tests. | External runtime/model authorization; Hermes availability required. | Stop if authorization, credentials, runtime binary, cost approval, or transcript capture is absent. |
| Runtime suite and parity | F1 5-scenario suite, F3 cross-runtime parity. | Local self-test dry-runs, synthetic parity fixtures, fail-closed parity authorization, and Cycle 78 authorization field runbook exist. | The same governed scenarios executed across real runtime targets with equivalent gate, ledger, and evidence outputs. | External runtime/model authorization. | Stop if any target is unavailable, authorization is absent, credential scope is missing, cost budget is missing, or transcript retention is not defined. |
| Benchmark execution | F2 SWE-bench Verified subset. | Benchmark plan/result schemas, fixtures, validator, write command, fail-closed authorization preflight, and Cycle 78 authorization field runbook exist. | Authorized 10-20 instance governed-vs-baseline run with transcripts, before/after tests, overhead, and cost accounting. | Benchmark spend/credential authorization. | Stop if authorization file is missing, blocked, or does not cover cost, credential scope, evidence retention, and transcript retention. |
| Stress/concurrency | F4 100 concurrent transitions. | Deterministic local 100-entry stress fixture exists. | Production-like concurrent transition stress with lock contention, hash-chain evidence, and failure analysis. | Local or external depending on environment; must not hit production. | Stop if target environment is not explicitly defined and disposable. |
| Compliance/SIEM | F5 compliance pack generation + SIEM ingest. | Compliance pack schemas/assembly and local SIEM-like fixture exist. | Pack from a real H-class run plus external Splunk/Datadog/Sentinel ingest proof. | External service/account authorization; legal-copy boundary. | Stop if external SIEM account, test destination, or data-retention permission is absent. |
| Final critic over results | F6 saturation critic over test results. | Per-cycle local saturation sweeps exist. | Critic pass over actual runtime, benchmark, stress, compliance, SIEM, install, beta, and launch artifacts. | Depends on prior evidence lanes. | Stop if upstream results are still proxy/local-only. |
| Real `~/.hima` book skill installs | 00-idea-pmf, 01-strategy-positioning, 02-analysis-discovery, 03-specification, 04-design-ux-ui, 05-architecture, 07-build, 09-quality-release-run install rows. | Repo-local fixtures for all in-scope books, resolver/frontmatter tests, and Cycle 81 authorization/runbook prep exist. | Real user-home install under `~/.hima/skills/{book}/`, runtime resolution, invocation proof from a Hima cycle, and restore evidence. | Real user-home write authorization. | Stop if write target is outside repo, target home is unresolved, backup fails, dry-run paths mismatch, or explicit permission is absent. |
| Harvested skills real implementation/invocation | HARV-01, 02, 04, 07, 08, 09, 11, 13, 17, 18, 16. | Repo-local SKILL.md fixtures exist for the harvested names; Cycle 81 maps implementation vs real-install/live-invocation blockers; Cycle 82 implements HARV-08 local service and JSONL capture; Cycle 83 implements HARV-09 local scanner and `session_start` warning tests; Cycle 84 implements HARV-11 local SubagentStart tool-deny tests; Cycle 85 implements HARV-02 local SKILL.md linting tests; Cycle 86 implements HARV-04 local mode-exclusion helper and catalog tests; Cycle 87 implements HARV-07 local layered evidence-gate evaluator and tests; Cycle 88 implements HARV-13 local compaction-continuity helper and tests; Cycle 89 implements HARV-17 local prompt-cache boundary evaluator and tests; Cycle 91 implements HARV-18 local anti-bypass detection for prompt, tool, post-tool, and subagent-start gate inputs; Cycle 92 implements HARV-16 local PreferenceRouter candidate evaluation; Cycle 94 implements HARV-01 cleanup-plan/regression-evidence enforcement in local `post_tool` and traced `subagent_stop` gates. | HARV-01 still needs live runtime invocation, adapter hook firing, actual dogfood cleanup workflow execution, and real install proof; HARV-02 still needs CI enforcement and broader parity decision; HARV-04 still requires live runtime persistence, hook wiring, real invocation, adapter behavior, real install proof, and historical ten-transition parity review; HARV-07 still requires held-out evaluator execution, suite promotion automation, real runtime/model evidence, adapter behavior, and real install proof; HARV-09 still requires live runtime SessionStart blocking and real context-file load prevention before closure; HARV-11 still requires live subagent runtime execution and adapter permission projection before closure; HARV-13 still requires real compaction adapter invocation, runtime hook firing proof, live critical-state preservation, and real install proof; HARV-17 still requires real prompt-cache integration, cache-hit/freshness proof, live invalidation behavior, adapter behavior, and real install proof; HARV-18 still requires live runtime permission enforcement, live adapter hook firing proof, real bypass-attempt transcripts, and real install proof; HARV-16 still requires live route evaluation, model/runtime execution, adapter behavior, learned preference evidence, and real install proof. | Mixed: local code/test for implementation; runtime/model/user-home authorization for live invocation. | Stop if a row would require live runtime or user-home proof without authorization. |
| Install review | H3. | Prior docs and API review artifacts exist; Cycle 74 reconciled H2, Cycle 75 completed the H1 conception-spec drift pass, Cycle 76 prepared `docs/goals/h3-install-matrix-preparation.md`, Cycle 79 prepared a manual-only H3 CI transcript workflow, and Cycle 90 produced real Windows and WSL2 Linux PASS transcripts at `docs/goals/evidence/h3-install-windows.md` and `docs/goals/evidence/h3-install-linux.md`. | Real macOS install transcript for H3. | H3 needs macOS environment or CI authorization for the remaining coverage. | Stop if OS coverage is simulated but reported as real or workflow prep is treated as OS proof. |
| Closed beta | H8. | ICP worksheet and north-star metric define beta thresholds and activation event. | 10 external users, three scenarios, survey records, saturation summary, activation/feedback evidence. | User-contact and beta-program authorization. | Stop if no permission to contact users or collect/store beta data. |
| Public release | I1, I2, I3, I6. | Local packages and docs exist; repo remains dirty/private-local in this session. | Public GitHub visibility, v1.0.0 tag, release notes, npm registry publication, and launch snapshot. | External publication authorization. | Stop if repo visibility, npm credentials, release tag, or publication approval is absent. |
| Sale page, payment, launch posts | I4, I5. | Strategy, claims register, ICP worksheet, message hierarchy, and metric docs exist. | Live sale page, Stripe Connect/test transaction evidence, founding-cohort copy review, Show HN/dev.to/r/devops/Discord post links. | External account/payment/public-post authorization. | Stop if any external post, payment, or public page action is not explicitly authorized. |

## Authorization Matrix

| Authorization Class | Includes | Not Authorized By Default |
|---|---|---|
| Local code/test | Scoped repo-local edits, deterministic tests, docs, fixtures, dry-runs. | External runtime launches, user-home writes, publication, payments, user contact. |
| External runtime/model | Claude Code, Codex, Hermes, model-backed sessions, live adapter invocation. | Any cost/credential-bearing run without explicit scope and budget. |
| Real user-home write | Writing to `~/.hima`, installing real skills, invoking user-home catalog. | Repo-local `.hima` fixtures do not count as real installs. |
| Benchmark spend | SWE-bench Verified execution, governed-vs-baseline model runs, cost accounting. | Dry-run benchmark plans do not count as benchmark execution. |
| External service | SIEM ingest, Stripe, hosted sale page, telemetry endpoints. | Local fixture output does not count as external integration. |
| Public release | GitHub visibility, npm publish, tags, release notes, launch posts. | Local package builds do not count as publication. |
| User contact | Closed beta recruitment, surveys, interviews, data collection. | ICP worksheets and local hypotheses do not count as user evidence. |

## Next Executable Lanes

| Lane | Safe Now? | Next Action |
|---|---|---|
| H3 install matrix execution | Linux + Windows PASS only. | Linux and Windows PASS transcripts exist; use `docs/goals/h3-macos-authorization-packet.md` to authorize either a real macOS host run or manual CI route, then record the transcript at `docs/goals/evidence/h3-install-macos.md` using `docs/goals/h3-install-matrix-preparation.md` plus `.github/workflows/h3-install-matrix.yml`. |
| Runtime evidence authorization prep | Complete locally. | Use `docs/goals/runtime-evidence-authorization-prep.md` only as a runbook; do not treat it as authorization or execution evidence. |
| Runtime E2E | No. | Wait for explicit runtime/model authorization and Hermes availability. |
| Real `~/.hima` install authorization prep | Complete locally. | Use `docs/goals/real-user-home-install-authorization-prep.md` only as a runbook; do not treat it as installation evidence. |
| Real `~/.hima` installs | No. | Wait for explicit user-home write authorization. |
| Stress/SIEM external execution | No. | Use `docs/goals/stress-siem-authorization-packet.md` as the local packet for F4/F5/F6; wait for an explicitly disposable stress environment, external SIEM destination, data-retention permission, real H-class pack source, and legal-copy boundary before execution. |
| HARV-08 local service implementation | Complete locally. | Use `docs/goals/harv08-human-handoff-local-service.md` as local proof only; live invocation and real install proof remain blocked. |
| HARV-09 local scanner implementation | Complete locally. | Use `docs/goals/harv09-prompt-injection-scanner-local.md` as local proof only; live runtime blocking, real context-file load prevention, runtime invocation, and real install proof remain blocked. |
| HARV-11 inherited subagent tool-deny local work | Complete locally. | Use `docs/goals/harv11-subagent-tool-deny-local.md` as local proof only; live subagent runtime execution, adapter permission projection, and real install proof remain blocked. |
| HARV-02 skill-linting local work | Complete locally. | Use `docs/goals/harv02-skill-linting-local.md` as local proof only; CI enforcement, full agnix parity, live runtime scans, and real user-home scans remain blocked. |
| HARV-04 mode state-machine local work | Complete locally. | Use `docs/goals/harv04-mode-state-machine-local.md` as local proof only; live runtime persistence, real invocation, adapter behavior, real install proof, and historical ten-transition parity remain blocked. |
| HARV-07 layered evidence-gate local work | Complete locally. | Use `docs/goals/harv07-layered-evidence-gate-local.md` as local proof only; held-out execution, suite promotion automation, real runtime/model evidence, adapter behavior, and real install proof remain blocked. |
| HARV-13 local compaction hook work | Complete locally. | Use `docs/goals/harv13-compaction-hook-local.md` as local proof only; real compaction adapter invocation, runtime hook firing proof, live critical-state preservation, and real install proof remain blocked. |
| HARV-17 prompt-cache boundary local work | Complete locally. | Use `docs/goals/harv17-prompt-cache-boundary-local.md` as local proof only; real prompt-cache integration, cache-hit/freshness runtime proof, invalidation runtime behavior, adapter behavior, and real user-home proof remain blocked. |
| HARV-18 anti-bypass local detection | Complete locally. | Use `docs/goals/harv18-anti-bypass-local.md` as local proof only; live runtime permission enforcement, adapter hook firing proof, real bypass-attempt transcripts, and real user-home proof remain blocked. |
| HARV-16 PreferenceRouter local proof | Complete locally. | Use `docs/goals/harv16-preference-router-local.md` as local proof only; live route evaluation, model/runtime execution, adapter behavior, learned preference evidence, and real user-home proof remain blocked. |
| HARV-01 ai-slop-cleaner local proof | Complete locally. | Use `docs/goals/harv01-ai-slop-cleaner-local.md` as local proof only; live runtime invocation, adapter hook firing, actual dogfood cleanup workflow execution, and real user-home proof remain blocked. |
| Post-HARV-01 residual local work | No. | `docs/goals/post-harv01-residual-boundary-review.md` found no additional safe local-only lane; proceed only after explicit authorization or matching environment evidence. |
| Packet coverage audit | Complete locally. | `docs/goals/external-authorization-packet-coverage-audit.md` maps all 36 open rows to packets/prep surfaces; do not treat packet coverage as execution evidence. |
| Closed beta/public launch/payment | No. | Use `docs/goals/beta-release-authorization-packet.md` as the local packet for H8 and I1-I6; wait for explicit user-contact, publication, payment, hosting, and public-post authorization before execution. |

## Falsifiers

| Falsifier | Required Correction |
|---|---|
| A local fixture is counted as a real runtime session, real user-home install, beta, npm publication, sale-page, payment, or public launch. | Reopen this cycle and restore the corresponding blocker. |
| The master goal is marked complete while any external evidence lane remains missing. | Reopen completion audit and remove completion claim. |
| The H3 row is closed without direct evidence matching its row wording, or H2 closure is used as release-readiness evidence. | Reopen the row or amend the master goal with a traceable reason. |
| A public or payment action happens without explicit authorization. | Stop immediately and record incident scope. |

```yaml
Falsifies-If:
  kill-condition: Boundary artifact marks runtime sessions, real installs, beta, npm publication, sale-page/Stripe, revenue, legal compliance, or market validation complete without linked real-world evidence.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/goals/runtime-external-evidence-boundary.md
  on-fail: Reopen cycle-73 as BLOCKED_EXTERNAL_EVIDENCE_OVERCLAIM and restore external-evidence blockers.
```
