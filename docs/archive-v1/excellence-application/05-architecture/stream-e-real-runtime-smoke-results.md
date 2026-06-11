# Stream E - Real-Runtime Smoke Results

Status: ACCEPTED  
Cycle: 30  
Date: 2026-05-14

## 1. Decision

Cycle 30 reached an honest blocked-preflight result.

No Claude Code, Codex CLI, or Hermes model session was launched. Claude Code and Codex CLI binaries
are present, but external runtime/model spend was not explicitly authorized in the active thread.
Hermes is not available on PATH. The correct result is therefore blocked evidence, not a simulated
runtime transcript.

## 2. Preflight Evidence

Evidence bundle:

- `docs/excellence-application/05-architecture/runtime-session-evidence/cycle-30/preflight.json`

Binary detection:

| Runtime | Found | Version | Session status |
|---|---:|---|---|
| Claude Code | yes | `2.1.141 (Claude Code)` | `BLOCKED_AUTHORIZATION` |
| Codex CLI | yes | `codex-cli 0.130.0` | `BLOCKED_AUTHORIZATION` |
| Hermes | no | n/a | `BLOCKED_BINARY_AND_AUTHORIZATION` |

Authorization boundary:

- external runtime sessions authorized: no;
- model/API spend authorized: no;
- credentialed sessions launched: no.

## 3. Local Preflight

`corepack pnpm smoke:runtime-session` passed before close.

Observed local install/hook dry-run shape:

| Runtime | Hooks planned | Unsupported hooks | Degraded hooks |
|---|---:|---|---|
| Claude Code | 9 | none | `session_start`, `post_tool`, `post_compact` |
| Codex CLI | 7 | `subagent_start`, `subagent_stop` | `session_start`, `post_tool`, `post_compact` |
| Hermes | 8 | `subagent_start` | `session_start`, `post_tool`, `post_compact`, `stop`, `subagent_stop` |

This proves the local copied-fixture preflight still works. It does not prove real runtime behavior.

## 4. Runtime Verdicts

| Runtime | Verdict | Why |
|---|---|---|
| Claude Code | BLOCKED | Binary exists, but launching a credentialed model session would spend/consume runtime access without explicit authorization. |
| Codex CLI | BLOCKED | Binary exists, but launching a model session would spend/consume runtime access without explicit authorization. |
| Hermes | BLOCKED | Binary not found on PATH, and no external runtime/session authorization is present. |

## 5. Non-Claims

This result does not claim:

- adapter production readiness;
- real-runtime E2E completion;
- Stream F benchmark readiness;
- SWE-bench readiness;
- five-client compatibility;
- compliance pack generation.

## 6. Next Action

Future external smoke execution needs a single explicit authorization boundary:

- which runtimes may be launched;
- whether model/API cost is allowed;
- where transcripts may be stored;
- whether missing Hermes should be skipped, installed, or replaced by a documented blocked result.

Until that boundary exists, safe construction should continue on local Stream F harness surfaces that
do not require external model sessions.

```yaml
Falsifies-If:
  kill-condition: This blocked preflight is reported as executed Claude/Codex/Hermes session evidence; a model session is launched without explicit authorization; Hermes is treated as available despite missing binary evidence; or package/local smoke tests are used as benchmark readiness proof.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/excellence-application/05-architecture/runtime-session-evidence/cycle-30/preflight.json
  on-fail: Reopen cycle-30 as BLOCKED_REAL_RUNTIME_SMOKE_EVIDENCE and separate executed transcripts from blocked preflight evidence.
```

