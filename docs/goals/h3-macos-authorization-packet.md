---
claim-bearing: true
status: BLOCKED_AUTHORIZATION_PACKET
cycle-id: cycle-96-external-authorization-required
created: 2026-05-15
evidence-target: docs/goals/evidence/h3-install-macos.md
---

# H3 macOS Authorization Packet

## Purpose

This packet defines the smallest next authorized action that can unblock H3 install-matrix proof.
It is not authorization, not macOS evidence, and not a substitute for
`docs/goals/evidence/h3-install-macos.md`.

H3 remains open until the macOS transcript exists, comes from a real macOS environment or
authorized macOS CI job, and records zero failures for the required Claude, Codex, and Hermes
install-matrix commands.

## Current State

| Field | Current value |
|---|---|
| Cycle | `cycle-96-external-authorization-required` |
| Master ledger | 119/155, 76.8% |
| Linux H3 transcript | `docs/goals/evidence/h3-install-linux.md` exists and is prior partial H3 evidence |
| Windows H3 transcript | `docs/goals/evidence/h3-install-windows.md` exists and is prior partial H3 evidence |
| macOS H3 transcript | `docs/goals/evidence/h3-install-macos.md` is missing |
| H3 row | Open |

## Authorized Route A: Real macOS Host

Use this route only after explicit access to a real macOS physical host, VM, or equivalent
macOS environment is available.

Prerequisites:

- Clean or intentionally recorded checkout/source state.
- Node, Corepack, pnpm, git, and either PowerShell or a POSIX shell available on the macOS host.
- Transcript retention approved.
- No external runtime/model sessions launched unless separately authorized.
- No real user-home install under `~/.hima` unless separately authorized.

Allowed command shapes:

```powershell
./scripts/h3-install-matrix-transcript.ps1 -OsLabel macos -OutputPath docs/goals/evidence/h3-install-macos.md
```

```bash
./scripts/h3-install-matrix-transcript.sh macos docs/goals/evidence/h3-install-macos.md
```

The transcript must identify the host as macOS in the recorded platform/toolchain section, not only
in the caller-provided `OsLabel`.

## Authorized Route B: Manual GitHub Actions CI

Use this route only after explicit authorization to run the manual CI workflow.

Workflow:

- `.github/workflows/h3-install-matrix.yml`
- Trigger: `workflow_dispatch`
- Required matrix leg: `macos-latest`
- Expected shell: `pwsh`
- Expected artifact: `h3-install-macos` containing `h3-install-macos.md`

Required import step:

1. Download the `h3-install-macos` artifact.
2. Verify the artifact records the checkout SHA, OS image, shell, command log, generated artifacts,
   and `Failure count | 0`.
3. Commit or otherwise preserve the artifact content as
   `docs/goals/evidence/h3-install-macos.md`.

The Linux and Windows matrix legs may run as part of the workflow, but they do not substitute for
the macOS leg.

## Acceptance Checks After Transcript Exists

The macOS transcript is acceptable only if all checks pass:

| Check | Required result |
|---|---|
| File exists | `docs/goals/evidence/h3-install-macos.md` exists. |
| OS label | Contains `OS label | macos`. |
| Platform evidence | Contains macOS host or CI platform evidence beyond the caller-provided label. |
| Target coverage | Contains target sections for `claude`, `codex`, and `hermes`. |
| Install commands | Records install, install-artifacts, lifecycle apply, runtime probe, and self-test command output for each target. |
| Failure count | Contains `Failure count | 0`. |
| No proxy evidence | Does not rely on a simulated OS name, local fixture-only output, or this packet as proof. |

After those checks pass, run:

```powershell
corepack pnpm docs:index
corepack pnpm lint
node packages/cli/dist/index.js hook post-tool-use --root . --dryRun
```

Only after the real transcript and verification checks pass can a later cycle consider closing the
H3 master row.

## Stop Conditions

Stop without closing H3 if any condition occurs:

- No explicit authorization to use a real macOS environment or run the manual CI workflow.
- No macOS host, VM, or authorized macOS CI job is available.
- The workflow is prepared but not run.
- The macOS artifact is missing.
- The transcript records a nonzero failure count.
- The transcript records only a simulated `macos` label without macOS platform evidence.
- The command log, source SHA, or generated artifact paths do not match the recorded source state.
- The run launches external runtime/model sessions without separate authorization.
- The run writes to real `~/.hima` without separate authorization.

## Verification For This Packet

This packet is locally complete when it names the two allowed authorization routes, the required
evidence file, post-transcript acceptance checks, and stop conditions. Local completion of this
packet does not change the construction ledger and does not close Cycle 96.

```yaml
Falsifies-If:
  kill-condition: This packet is used as proof that H3 macOS install testing happened, or H3 is closed without docs/goals/evidence/h3-install-macos.md containing a real zero-failure macOS transcript.
  checkpoint-date: 2026-05-29
  evidence-anchor: docs/goals/h3-macos-authorization-packet.md
  on-fail: Reopen H3 as BLOCKED_MACOS_TRANSCRIPT_MISSING and remove any proxy completion claim.
```
