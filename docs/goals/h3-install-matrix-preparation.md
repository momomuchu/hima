---
claim-bearing: true
status: COMPLETE
cycle: cycle-76-h3-install-matrix-preparation
created: 2026-05-14
---

# H3 Install-Matrix Preparation

## Result

Cycle 76 completed local preparation for the H3 install-matrix requirement.

H3 remains OPEN. No Linux, macOS, or Windows install transcript was produced in this cycle, and no
local dry-run in this file counts as OS install proof.

Current ledger impact:

| Done | Total | Percent |
|---:|---:|---:|
| 118 | 155 | 76.1% |

## H3 Closure Rule

The master H3 row can close only after all three evidence files exist and contain real command
transcripts from the named operating system:

| OS | Required evidence file | Status |
|---|---|---|
| Linux | `docs/goals/evidence/h3-install-linux.md` | PASS transcript created in Cycle 90; H3 still open until macOS also exists |
| macOS | `docs/goals/evidence/h3-install-macos.md` | Missing |
| Windows | `docs/goals/evidence/h3-install-windows.md` | PASS transcript created in Cycle 90; H3 still open until macOS also exists |

Each transcript must come from an actual OS run. CI logs are acceptable only if the job clearly
records the OS image, shell, checkout SHA, command log, and generated artifacts. Simulated OS names,
local dry-runs, docs-only templates, and repo-local fixture installs do not close H3.

Transcript scripts:

- `scripts/h3-install-matrix-transcript.ps1` for PowerShell-capable Windows/Linux/macOS runs.
- `scripts/h3-install-matrix-transcript.sh` for local Linux/macOS-style shells when PowerShell is
  unavailable.

## Required Transcript Fields

Each OS evidence file must include:

| Field | Required content |
|---|---|
| Host identity | OS name, version, architecture, shell, terminal/runtime context, and whether it is local VM, CI, or physical machine. |
| Toolchain | Node version, corepack version, pnpm version, npm version if used, git version, and package-manager cache state if non-default. |
| Source state | Repository URL or local source path, git SHA, branch, dirty-tree status, and CLI source used: local build, packed tarball, or published package. |
| Timebox | Start timestamp, end timestamp, timezone, and operator/session id if available. |
| Workspace | Clean temporary project path, cleanup policy, and proof that the path is OS-local rather than a reused repo fixture. |
| Targets | Explicit target list: `claude`, `codex`, and `hermes`, or a justified skip with blocker evidence. |
| Install command | Full `harness install <target> --root <temp-project> --apply --writeManifest --json` command and JSON output. |
| Artifact command | Full `harness install-artifacts <target> --root <temp-project> --apply --writeManifest --captureRestoreSnapshots --json` or `harness lifecycle apply <target> --root <temp-project> --apply --json` command and JSON output. |
| Probe command | Full `harness runtime probe <target> --root <temp-project> --bind --verifyBlockingFixtures --json` command and JSON output. |
| Self-test command | Full `harness self-test --root <temp-project> --target <target> --json` command and JSON output. |
| Manifest outputs | Resulting platform manifest path, artifact manifest path, platform directory, hook directory, and catalog artifact paths. |
| Rollback | `harness lifecycle uninstall --root <temp-project> --platformManifestFile <file> --artifactManifestFile <file> --apply --json` output, or an explicit reason rollback was not possible. |
| Repair | `harness lifecycle repair --root <temp-project> --manifestFile <file> --apply --json` output when repair behavior is part of the run. |
| Logs | Redacted stdout/stderr, failure traces, warnings, and unsupported/degraded hook lists. |
| Verdict | Pass/fail per target, unresolved blockers, and whether `externalRuntimeSessionsLaunched` stayed false or a separately authorized runtime run happened. |

## Future OS Command Template

Run this template independently on Linux, macOS, and Windows. Replace `<target>` with each runtime
target and `<temp-project>` with a clean disposable project path on that OS.

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm build
node packages/cli/dist/index.js init --root <temp-project>
node packages/cli/dist/index.js install <target> --root <temp-project> --apply --writeManifest --json
node packages/cli/dist/index.js install-artifacts <target> --root <temp-project> --apply --writeManifest --captureRestoreSnapshots --json
node packages/cli/dist/index.js lifecycle apply <target> --root <temp-project> --apply --json
node packages/cli/dist/index.js runtime probe <target> --root <temp-project> --bind --verifyBlockingFixtures --json
node packages/cli/dist/index.js self-test --root <temp-project> --target <target> --json
node packages/cli/dist/index.js lifecycle repair --root <temp-project> --manifestFile <platform-manifest-file> --apply --json
node packages/cli/dist/index.js lifecycle uninstall --root <temp-project> --platformManifestFile <platform-manifest-file> --artifactManifestFile <artifact-manifest-file> --apply --json
```

Command-shape note: `lifecycle uninstall` is manifest-based, not target-based. `lifecycle repair`
uses `--manifestFile` rather than a target argument.

Cycle 90 correction: runtime probe binding requires canonical `.planning` state in the disposable
project, so `harness init --root <temp-project>` is now part of the H3 transcript command sequence.

## Local Preflight Evidence

Cycle 76 verified local command surfaces and dry-run behavior only.

| Check | Local result |
|---|---|
| `install --help` | PASS: usage is `harness install [OPTIONS] <TARGET>` with dry-run default, `--apply`, `--writeManifest`, and `--json`. |
| `lifecycle apply --help` | PASS: dry-run by default unless `--apply`; supports target, `--kind`, `--skipManifests`, and `--json`. |
| `install-artifacts --help` | PASS: dry-run by default unless `--apply`; supports manifest writes and restore snapshot capture. |
| `runtime probe --help` | PASS: supports `--bind`, `--verifyBlockingFixtures`, and `--json`. |
| `lifecycle uninstall --help` | PASS: manifest-based rollback command with `--platformManifestFile`, `--artifactManifestFile`, `--apply`, and `--json`. |
| `lifecycle repair --help` | PASS: manifest-based repair command with `--manifestFile`, `--kind`, `--apply`, and `--json`. |
| `self-test --root . --json` | PASS: `ok: true`; `externalRuntimeSessionsLaunched: false`; Claude planned 9 hooks, Codex planned 7 hooks, Hermes planned 8 hooks; runtime execution stayed `blocked_by_design`. |
| `install <target> --root . --dryRun --json` | PASS for Claude, Codex, and Hermes; dry-run true and manifestWritten false. |
| `lifecycle apply <target> --root . --json` | PASS for Claude, Codex, and Hermes in dry-run mode; plans platform install and catalog artifact install. |
| `runtime digest claude --json` | PASS: `claude-profile-v2`, digest `72f66a64e090b123893ead667746844314e1281d978d02f709412b0c5e6c66bd`. |
| `runtime digest codex --json` | PASS: `codex-profile-v1`, digest `c379b81cd1289338751cd8a2d133184e60eaf3ea9bb0e7390c9765918c6a6d9b`. |
| `runtime digest hermes --json` | PASS: `hermes-profile-v1`, digest `70fa166fe5dfa5416b0303bd815391402ee01822cb52bfe2c6823516a56ded86`. |

Local preflight confirms that the repo can produce deterministic install plans, lifecycle plans,
runtime profile digests, and local self-test dry-runs. It does not prove install success on Linux,
macOS, or Windows.

## Target-Specific Local Findings

| Target | Local dry-run finding | H3 effect |
|---|---|---|
| Claude | Platform and hooks directories exist locally; 9 hook registrations planned; unsupported hook list empty in self-test. | Preparation only. Needs real OS install transcript. |
| Codex | Platform and hooks directories exist locally; 7 hook registrations planned; `subagent_start` and `subagent_stop` are unsupported by runtime profile. | Preparation only. Needs real OS install transcript. |
| Hermes | `.hermes` platform directory absent locally; dry-run still plans 8 hooks; `subagent_start` unsupported and `subagent_stop` observable/non-blocking. | Preparation only. Needs real OS install transcript and runtime availability note. |

## Non-Goals Preserved

Cycle 76 did not:

- mark H3 complete;
- run Linux, macOS, or Windows OS install tests;
- write to real `~/.hima`;
- launch external runtime/model sessions;
- publish to npm or create a public release;
- tag a repository release;
- contact beta users;
- wire Stripe, publish a sale page, or claim revenue;
- claim legal certification, market validation, benchmark completion, stress completion, or external SIEM integration.

## Verification

| Check | Result |
|---|---|
| H3 template structure | PASS: Linux, macOS, Windows transcript files and required fields are named. |
| Command-shape check | PASS: lifecycle uninstall and repair help were inspected before adding the template. |
| No proxy completion | PASS: this artifact states that H3 remains OPEN and dry-runs do not count as OS proof. |
| Local preflight | PASS: install, lifecycle, self-test, and digest surfaces were inspected locally. |
| Master truth surface | PASS: `docs/goals/COMPLETE-CONSTRUCTION-GOAL.md` keeps H3 unchecked and records this artifact separately. |

```yaml
Falsifies-If:
  kill-condition: This preparation artifact is used as proof that install was tested on Linux, macOS, and Windows, or H3 is closed without the three OS transcript files.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/goals/h3-install-matrix-preparation.md
  on-fail: Reopen cycle-76 as BLOCKED_H3_PROXY_COMPLETION and restore the H3 install blocker.
```
