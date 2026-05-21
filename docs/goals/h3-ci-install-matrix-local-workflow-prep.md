---
claim-bearing: true
status: COMPLETE
cycle: cycle-79-h3-ci-install-matrix-local-workflow-prep
created: 2026-05-14
---

# H3 CI Install-Matrix Local Workflow Preparation

## Result

Cycle 79 prepared a manual-only CI workflow shape for future H3 Linux, macOS, and Windows install
transcripts.

H3 remains OPEN. No CI run was triggered, and no OS transcript file was created under
`docs/goals/evidence/`.

The construction ledger remains:

| Done | Total | Percent |
|---:|---:|---:|
| 119 | 155 | 76.8% |

## Prepared Artifacts

| Artifact | Purpose |
|---|---|
| `.github/workflows/h3-install-matrix.yml` | Manual `workflow_dispatch` matrix for `ubuntu-latest`, `macos-latest`, and `windows-latest`. |
| `scripts/h3-install-matrix-transcript.ps1` | Cross-platform PowerShell transcript generator that runs local install, artifact install, lifecycle apply, runtime probe, and self-test commands per target. |
| `scripts/h3-install-matrix-transcript.sh` | Bash transcript generator for local Linux/macOS-style shells when PowerShell is unavailable. |

The workflow uploads transcript artifacts named:

- `h3-install-linux`
- `h3-install-macos`
- `h3-install-windows`

Those uploaded artifacts are not automatically committed. A future reviewer must inspect them and
copy accepted PASS transcripts into:

- `docs/goals/evidence/h3-install-linux.md`
- `docs/goals/evidence/h3-install-macos.md`
- `docs/goals/evidence/h3-install-windows.md`

Cycle 90 produced local Windows and WSL2 Linux transcripts at
`docs/goals/evidence/h3-install-windows.md` and `docs/goals/evidence/h3-install-linux.md` after
adding the missing `harness init --root <temp-root>` precondition. The Linux run also required
non-interactive CI-mode dependency installation so the Linux Rollup optional package was installed.
The macOS transcript remains missing, so H3 remains open.

## Workflow Boundary

The workflow is manual-only:

```yaml
on:
  workflow_dispatch:
```

It is not attached to `push`, `pull_request`, `schedule`, or release events. Adding the file to the
repo does not run CI and does not create H3 proof.

## Transcript Coverage

For each OS runner, the script captures:

| Section | Evidence |
|---|---|
| Host identity | OS label, PowerShell version, platform description, architecture, timestamps, temp root, repo root. |
| Toolchain | Node, corepack, pnpm, git SHA, git status. |
| Dependency install | `corepack pnpm install --frozen-lockfile`. |
| Build precondition | `corepack pnpm build`. |
| Planning initialization | `harness init --root <temp-root>` creates canonical `.planning` state before runtime probes bind. |
| Claude target | `install`, `install-artifacts`, `lifecycle apply`, `runtime probe`, and `self-test`. |
| Codex target | `install`, `install-artifacts`, `lifecycle apply`, `runtime probe`, and `self-test`. |
| Hermes target | `install`, `install-artifacts`, `lifecycle apply`, `runtime probe`, and `self-test`. |
| Verdict | PASS only when every local command exits 0; otherwise failure list and nonzero exit. |

## H3 Closure Rule

The H3 master row can close only after:

1. the manual workflow or equivalent real OS runs have executed on Linux, macOS, and Windows;
2. each uploaded transcript has been reviewed;
3. accepted transcript content is copied into the three `docs/goals/evidence/h3-install-*.md`
   files;
4. each evidence file has a PASS/FAIL/BLOCKED verdict and no fake OS or local-only substitute; and
5. the master H3 row is updated in the same pass with saturation checks.

## Non-Goals Preserved

Cycle 79 did not:

- run GitHub Actions;
- run Linux, macOS, or Windows install tests;
- create `docs/goals/evidence/h3-install-linux.md`;
- create `docs/goals/evidence/h3-install-macos.md`;
- create `docs/goals/evidence/h3-install-windows.md`;
- mark H3 complete;
- launch runtime/model sessions;
- write to real `~/.hima`;
- publish, tag, contact users, wire payments, or claim beta/revenue/launch/legal/market/SIEM proof.

## Verification

| Check | Result |
|---|---|
| Workflow trigger check | PASS: workflow uses `workflow_dispatch` only. |
| Matrix check | PASS: workflow names linux, macos, and windows runner entries. |
| Transcript linkage | PASS: workflow uploads artifacts but does not create the three `docs/goals/evidence/h3-install-*.md` files. |
| Script parse check | PASS: PowerShell parser accepts `scripts/h3-install-matrix-transcript.ps1`. |

```yaml
Falsifies-If:
  kill-condition: This workflow preparation is treated as Linux/macOS/Windows install proof, or fake transcript files are created without real OS run logs.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/goals/h3-ci-install-matrix-local-workflow-prep.md
  on-fail: Reopen cycle-79 as BLOCKED_H3_CI_PROXY_COMPLETION and restore the H3 blocker.
```
