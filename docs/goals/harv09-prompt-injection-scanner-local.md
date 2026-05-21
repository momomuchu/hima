---
claim-bearing: true
status: COMPLETE
cycle: cycle-83-harv09-prompt-injection-scanner-local
created: 2026-05-15
---

# HARV-09 Prompt-Injection Scanner Local Proof

## Result

Cycle 83 implemented the repo-local HARV-09 deterministic prompt-injection scanner and a local
`session_start` warning path.

HARV-09 remains open as a full master-goal row because no live runtime SessionStart blocking, real
context-file load prevention, runtime skill invocation, or real `~/.hima` install occurred. The
construction ledger remains:

| Done | Total | Percent |
|---:|---:|---:|
| 119 | 155 | 76.8% |

## Implemented Surface

| Artifact | Result |
|---|---|
| `packages/core/src/security/prompt-injection-scan.ts` | Adds deterministic scanning for 10 prompt-injection threat patterns and 14 invisible Unicode controls. |
| `packages/core/src/gates/evaluate-gate.ts` | Adds local `session_start` warning for normalized prompt/metadata scanner hits. |
| `packages/core/test/prompt-injection-scan.test.ts` | Covers clean input, malicious phrases, invisible Unicode controls, and multi-source identity. |
| `packages/core/test/gates.test.ts` | Covers local `session_start` warning behavior for prompt-injection indicators. |
| `packages/core/src/index.ts` | Exports the scanner surface. |

## Behavior

The scanner reports:

| Detection family | Examples |
|---|---|
| Threat patterns | Ignore previous instructions, override/reveal system prompt, disable safety, exfiltrate secrets, privileged role assumption, tool-result forgery, hidden instructions, jailbreak language, obey-only-this-message. |
| Invisible Unicode | Zero-width joiners/spaces, byte-order mark, word joiner, bidi embeddings/overrides, and directional isolates. |
| Evidence fields | Finding id, category, severity, line, column, index, escaped excerpt, and source identity for multi-source scans. |

## Boundary

This is local scanner and local gate-warning proof only. It does not prove:

- live runtime SessionStart blocking;
- real context files were blocked before loading;
- Claude/Codex/Hermes adapter protection;
- runtime skill invocation;
- real `~/.hima` skill installation;
- beta evidence, publication, payment, legal, market, H3 OS, benchmark, or SIEM evidence.

## Verification

| Check | Result |
|---|---|
| Focused core tests | PASS: `corepack pnpm --filter @harness/core test -- prompt-injection-scan.test.ts gates.test.ts` ran through the package runner with 436/436 tests passing. |
| Clean-input test | PASS: scanner returns `clean` and no findings for normal context. |
| Malicious-pattern test | PASS: scanner reports multiple prompt-injection ids for deterministic phrases. |
| Invisible-Unicode test | PASS: scanner reports zero-width and bidi controls with escaped excerpts. |
| SessionStart test | PASS: local gate returns `warn` with `PROMPT_INJECTION_DETECTED` for scanner hits. |

```yaml
Falsifies-If:
  kill-condition: This local scanner proof is used as proof of live runtime blocking, real context-file load prevention, adapter protection, or real ~/.hima installation.
  checkpoint-date: 2026-05-29
  evidence-anchor: docs/goals/harv09-prompt-injection-scanner-local.md
  on-fail: Reopen cycle-83 as BLOCKED_HARV09_PROXY_COMPLETION and restore the live-runtime/user-home blockers.
```
