---
claim-bearing: true
status: COMPLETE
created: 2026-05-15
cycle: cycle-91-harv18-anti-bypass-local-detection
---

# HARV-18 Anti-Bypass Local Detection

## Result

Cycle 91 added local, deterministic HARV-18 bypass-attempt detection for prompt, tool, post-tool,
and subagent-start gate inputs.

This is local core enforcement evidence only. It does not prove real runtime permission enforcement,
adapter hook firing in live sessions, real `~/.hima` installation, or external model behavior.

## Delivered Artifacts

| Artifact | Coverage |
|---|---|
| `packages/core/src/security/anti-bypass-clause.ts` | Central anti-bypass finding catalog, evidence anchor, and scanner for no-verify flags, skipped gates, bypass mode, disabled hooks, ignored policy, forced override, and hook-wiring mutation attempts. |
| `packages/core/src/gates/evaluate-gate.ts` | Reuses the helper for `user_prompt`, `pre_tool`, `post_tool`, and `subagent_start` decisions. |
| `packages/core/test/anti-bypass-clause.test.ts` | Direct helper tests for prompt variants, hook-wiring mutation, and catalog uniqueness/order. |
| `packages/core/test/gates.test.ts` | Gate-level tests for pre-tool hook-wiring mutation and subagent bypass instructions. |
| `packages/core/test/handle-hook.test.ts` | Hook-service test proving normalized `PreToolUse` payloads block hook-wiring bypass attempts and persist redacted evidence. |

## Boundary

| Claim | Status |
|---|---|
| Local bypass attempt detection exists in core gate evaluation | COMPLETE. |
| Runtime permission enforcement is proven in Claude/Codex/Hermes sessions | OPEN. |
| Adapter hook wiring is proven in real runtime sessions | OPEN. |
| Real `~/.hima` installation and invocation are proven | OPEN. |

## Verification

| Check | Result |
|---|---|
| `corepack pnpm --filter @harness/core test -- anti-bypass-clause.test.ts gates.test.ts handle-hook.test.ts` | PASS: 46 files / 471 tests. |
| Full verification gates | Recorded in the Cycle 91 archive after docs refresh. |

```yaml
Falsifies-If:
  kill-condition: HARV-18 is marked complete end-to-end while runtime permission enforcement, adapter hook wiring, real runtime bypass attempts, or real user-home installation remain unproven.
  checkpoint-date: 2026-05-29
  evidence-anchor: docs/goals/harv18-anti-bypass-local.md
  on-fail: Reopen cycle-91 as BLOCKED_HARV18_OVERCLAIM and restore runtime/user-home blockers.
```
