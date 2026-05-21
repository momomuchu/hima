---
cycle-id: cycle-90-h3-install-matrix-execution
claim-bearing: true
status: BLOCKED
opened: 2026-05-15
closed: 2026-05-15
supersedes: cycle-89-harv17-prompt-cache-boundary-local
next-cycle: cycle-91-harv18-anti-bypass-local-detection
---

# Cycle 90 BLOCKED - H3 Install Matrix Execution

## 1. Result

Cycle 90 produced real Windows and WSL2 Linux H3 install-matrix transcripts, but it did not close H3.

The remaining blocker is the macOS transcript. The current Windows workspace and WSL2 Ubuntu
environment cannot produce real macOS evidence. The prepared manual CI workflow can only count as
equivalent evidence after explicit CI authorization.

## 2. Delivered Evidence

| Artifact | Result |
|---|---|
| `docs/goals/evidence/h3-install-windows.md` | PASS: Windows 10.0.19045/X64, Node 20.19.0, pnpm 10.33.2, Claude/Codex/Hermes install/artifact/lifecycle/runtime-probe/self-test commands exited 0. |
| `docs/goals/evidence/h3-install-linux.md` | PASS: WSL2 Ubuntu/Linux x86_64, Node 22.22.2, pnpm 10.33.2, Claude/Codex/Hermes install/artifact/lifecycle/runtime-probe/self-test commands exited 0. |
| `scripts/h3-install-matrix-transcript.ps1` | Updated to initialize planning state and run non-interactive frozen dependency installation before probes. |
| `scripts/h3-install-matrix-transcript.sh` | Added Unix-like transcript capture for Linux/macOS-style shells. |

## 3. Blocker

| Missing requirement | Why it blocks H3 |
|---|---|
| `docs/goals/evidence/h3-install-macos.md` | H3 requires Linux + macOS + Windows install proof. Windows and Linux are necessary but insufficient. |

## 4. Verification Evidence

| Check | Result |
|---|---|
| PowerShell transcript run | PASS: Windows transcript failure count 0. |
| WSL bash transcript run | PASS: Linux transcript failure count 0. |
| `corepack pnpm docs:index` | PASS after transcript/doc updates. |
| `corepack pnpm lint` | PASS after transcript/doc updates. |
| `corepack pnpm build` | PASS after transcript/doc updates. |
| Post-tool dry-run | PASS: hook post-tool-use allowed with no policy violations. |
| Saturation sweep | PASS: H3 remains unchecked; macOS PASS and all-three-OS completion claims are absent. |

## 5. Non-Goals Preserved

Cycle 90 did not:

- claim macOS install proof;
- mark H3 complete;
- run GitHub Actions or external CI;
- publish packages;
- launch runtime/model sessions;
- write to real user-home paths.

```yaml
Falsifies-If:
  kill-condition: H3 is marked complete from Windows plus Linux evidence without real macOS evidence or explicitly authorized CI logs.
  checkpoint-date: 2026-05-29
  evidence-anchor: docs/goals/archive/cycle-90-BLOCKED-2026-05-15.md
  on-fail: Reopen cycle-90 as BLOCKED_H3_PROXY_COMPLETION and restore the macOS blocker.
```
