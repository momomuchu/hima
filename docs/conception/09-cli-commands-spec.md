# CLI Commands Specification - @harness/cli

> Status: implementation-aligned executable contract
> Package: `@harness/cli`
> Source of truth: `packages/cli/src/index.ts` exports `getCliCommandSurface()`
> Verification: `packages/cli/test/index.test.ts` checks this file against the executable command tree
> Date: 2026-05-03

---

## 1. Contract

The CLI exposes one binary: `harness`.

The executable command tree is the source of truth. This document is the human-facing contract for that tree, and tests fail when a command exists in code but is missing here.

Runtime artifacts are always the triad `skills`, `hooks`, and `subagents`. There is no fourth runtime artifact family.

State storage is always `.planning/` with the three canonical files:

| File | Purpose |
|------|---------|
| `.planning/state.yaml` | Current macro-cycle, subphase, operating mode, and run identifiers |
| `.planning/current-risk.yaml` | Current T/L/M/H/C risk state and risk evidence summary |
| `.planning/run-set.json` | Current run events, evidence, convergence, runtime bindings, and install manifests |

All platform and artifact write paths are dry-run by default unless the command has an explicit `--apply` or write flag.

---

## 2. Command Surface

| Command | Purpose | Write behavior |
|---------|---------|----------------|
| `harness` | Root binary and command namespace. | None |
| `harness init` | Create the three canonical `.planning/` files. | Writes project state files |
| `harness status` | Show current harness state. | None |
| `harness convergence` | Evaluate convergence from `.planning/` state. | None |
| `harness close` | Close the current run from convergence evaluation. | Writes run closure data |
| `harness hook` | Evaluate a runtime hook event from JSON stdin. | Writes gate event unless `--dryRun` is set |
| `harness transition` | Transition to another macro-cycle and optional subphase. | Writes state transition |
| `harness enter` | Enter governed development mode with phase, subphase, mode, risk, and intent. | Writes state, current risk, route, intent, active gates, and entry event |
| `harness evidence` | Evidence command namespace. | None |
| `harness evidence add` | Append an evidence item to `.planning/run-set.json`. | Writes evidence |
| `harness risk` | Risk command namespace. | None |
| `harness risk classify` | Classify a changeset risk level from pragmatic CLI flags. | None |
| `harness doctor` | Validate local harness installation and `.planning/` state files. | None today; `--fix` is reserved |
| `harness validate` | Machine-friendly read-only validation for project state. | None |
| `harness install` | Plan or write a safe platform install manifest. | Dry-run by default; `--writeManifest` and `--apply` write |
| `harness catalog` | Inspect the operational catalog. | None |
| `harness artifacts` | Plan or write catalog-driven operational artifacts. | Dry-run by default; `--apply` writes |
| `harness install-artifacts` | Plan or write target platform catalog artifacts. | Dry-run by default; `--apply` writes, `--writeManifest` persists rollback metadata, and `--captureRestoreSnapshots` opt-in stores previous managed artifact content |
| `harness rollback-artifacts` | Plan or apply rollback of target platform catalog artifacts. | Dry-run by default; `--apply` deletes rollbackable files and restores files that carry valid restore snapshots |
| `harness uninstall-platform` | Plan or remove managed platform hook registrations from an install manifest. | Dry-run by default; `--apply` removes managed hooks |
| `harness repair-platform` | Plan or re-apply managed platform hook registrations from an install manifest. | Dry-run by default; `--apply` writes managed hooks |
| `harness lifecycle` | Lifecycle command namespace for hooks plus catalog artifacts. | None |
| `harness lifecycle apply` | Plan or apply the full platform hooks plus catalog artifacts lifecycle. | Dry-run by default; `--apply` writes |
| `harness lifecycle uninstall` | Plan or uninstall platform hooks plus rollback catalog artifacts. | Dry-run by default; `--apply` removes managed files |
| `harness lifecycle repair` | Plan or repair platform hooks plus catalog artifacts from manifests. | Dry-run by default; `--apply` writes |
| `harness runtime` | Runtime metadata command namespace. | None |
| `harness runtime digest` | Print the runtime profile version and digest for a target. | None |
| `harness runtime inspect` | Inspect and persist runtime capabilities for a target, including optional hook proof overrides. | Writes runtime capability observation |
| `harness runtime bind` | Bind inspected runtime capabilities to required gates. | Writes runtime binding state |
| `harness runtime probe` | Read target runtime config and persist core-minted runtime proofs. | Writes trusted runtime capability observation and optionally bindings |
| `harness runtime assess-route` | Assess route-required runtime bindings from current `.planning/` state. | None |

---

## 3. Common Arguments

Most project-scoped commands accept `--root <path>`. When omitted, the command uses the current working directory.

Most inspection commands accept `--json` to print a machine-readable JSON payload.

Canonical platform targets are `claude`, `codex`, and `hermes`.

Canonical artifact selections are `all`, `skills`, `hooks`, and `subagents`.

---

## 4. Development Entry

`harness enter` is the executable entrypoint for the `hima-enter` skill. It binds the first
development route through the kernel instead of relying on manual `.planning/` edits.

```bash
harness enter [--root <path>] [--phase build] [--subPhase Execute] [--mode auto] [--riskClass T] [--objective "..."] [--prompt "..."] [--json]
```

Defaults are intentionally conservative for a development POC:

| Field | Default | Source of truth |
|-------|---------|-----------------|
| `phase` | `build` | Canonical `MacroCycle` |
| `subPhase` | `Execute` | Canonical `SubPhase` |
| `mode` | `auto` | Canonical `OperatingMode` |
| `riskClass` | `T` | Canonical `RiskClass` |

The command validates the selected mode against the risk policy. For example, `--mode bypass`
with `--riskClass H` is rejected because bypass is allowed only for T/L routes.

Writes:

- `.planning/state.yaml`: active phase, subphase, mode, active gates, status, timestamp.
- `.planning/current-risk.yaml`: effective risk class, rank, bypass flag, human checkpoint flag.
- `.planning/run-set.json`: intent, route, `DEVELOPMENT_MODE_ENTERED` event, active finalization.

The command does not classify by itself. The caller should use `harness risk classify` first when
the risk is not already known, then pass the selected class into `harness enter`.

---

## 5. Hook Invocation

`harness hook` is the executable bridge between platform-native hooks and the harness policy engine.

```bash
harness hook <event> [--root <path>] [--dryRun]
```

The event argument may be either a canonical `GateType` or a runtime-native event alias that maps to one.

Canonical gate types are:

| GateType | Runtime purpose |
|----------|-----------------|
| `session_start` | Inject startup context and inspect active state |
| `user_prompt` | Evaluate user intent and operating-mode constraints |
| `pre_tool` | Block, allow, or inject context before tool execution |
| `post_tool` | Collect evidence and detect post-tool policy violations |
| `stop` | Evaluate completion and convergence before the agent stops |
| `subagent_start` | Track delegated execution start |
| `subagent_stop` | Collect delegated execution result evidence |

Hook input is JSON on stdin. Hook output is JSON on stdout. A missing `.planning/` directory must fail open for hook invocations so legacy projects do not become unusable.

---

## 6. Runtime Inspection And Binding

`harness runtime inspect` persists observed runtime capability data for a target platform.

```bash
harness runtime inspect <target> [--root <path>] [--configDigest <digest>] [--runtimeVersion <version>] [--status <status>] [--hooksJson <json>] [--json]
```

`--hooksJson` accepts a JSON object keyed by canonical `GateType`. Each value follows the runtime hook capability input schema:

```json
{
  "pre_tool": {
    "proofs": [
      {
        "type": "negative_fixture",
        "status": "accepted",
        "observedAt": "2026-05-03T00:00:00.000Z",
        "detail": "fixture blocked the documented operation"
      }
    ]
  }
}
```

Caller-submitted proofs are stored as candidate evidence, even when the payload says `status: "accepted"`. They cannot promote a blocking hook to native-enforceable status. Proof `detail`, hook `notes`, and runtime limitations are redacted before persistence.

`--runtimeVersion` records the observed runtime profile version on the capability and every derived binding. When omitted, known targets use the canonical profile version from `@harness/core`.

`harness runtime probe` is the trusted acquisition path. It reads target runtime config, checks managed hook registrations, emits core-minted `config_read` and `manifest_digest` proofs, and may bind immediately with `--bind`. Trusted proof `configDigest` is bound to the observed runtime config content plus canonical `runtimeVersion`, runtime profile digest, and install manifest digest, so config, manifest, or profile-version drift requires a fresh probe.

By default, config registration alone never mints a blocking `negative_fixture` proof. Add `--verifyBlockingFixtures` to execute managed blocking fixtures; only fixtures that return the documented block result are persisted as accepted `negative_fixture` proofs.

```bash
harness runtime probe <target> [--root <path>] [--bind] [--verifyBlockingFixtures] [--json]
```

Blocking hooks are native-enforceable only when the runtime profile supports blocking and the inspected hook includes a core-minted accepted `negative_fixture` or accepted `event_fire` proof with `observedAt`, `verifier`, `target`, `runtimeVersion`, `gateType`, `configDigest`, `result`, and `proofDigest`. The proof must be observed no earlier than the stored capability inspection, no later than the binding inspection, and no older than 15 minutes at binding time. `manual_attestation` is useful evidence but never upgrades a blocking hook to native-enforceable status by itself.

`harness runtime bind` converts the last inspection into gate-level runtime bindings.

```bash
harness runtime bind <target> [--root <path>] [--expectedDigest <digest>] [--currentDigest <digest>] [--json]
```

Digest-only inspection, stale trusted proofs, future-dated trusted proofs, and caller-submitted proof inspection are intentionally insufficient for blocking hooks. A supported blocking hook remains `stale` until the trusted executable proof contract above is satisfied.

`harness runtime assess-route` is a read-only diagnostic over the current route, risk state,
planned subagents, policy overrides, and `run-set.json.runtimeBindings`.

```bash
harness runtime assess-route [--root <path>] [--json]
```

The command returns the convergence `RuntimeBindingHealth` read model with route context:
`riskClass`, `activeTarget`, `healthy`, `requiredGates`, `assessments`, and `gaps`. It never writes
bindings or route-specific gate rows.

---

## 7. Risk Classification

`harness risk classify` returns a canonical T/L/M/H/C risk class from CLI flags and changeset metadata.

```bash
harness risk classify --files "packages/core/src/index.ts" --linesChanged 80 --json
```

Important flags:

| Flag | Purpose |
|------|---------|
| `--files <paths>` | Changed files as comma, newline, or semicolon separated paths |
| `--dependency` | Dependency update signal |
| `--schema` | Schema or database shape change signal |
| `--auth` | Authentication or authorization signal |
| `--infra` | Infrastructure or production configuration signal |
| `--destructive` | Destructive or breaking change signal |
| `--publicApi` | Public API contract signal |
| `--migration` | Runtime or data migration signal |
| `--securitySensitive` | Security or privacy sensitive signal |
| `--externalIntegration` | External service integration signal |
| `--linesChanged <n>` | Approximate net changed lines |
| `--testCoverage <n>` | Approximate coverage percentage |
| `--confidence <level>` | Implementation confidence |

The command is read-only. Persisted risk state is updated by runtime policy paths, not by this classifier preview command.

---

## 8. Platform Installation

The platform lifecycle is intentionally split:

| Need | Command |
|------|---------|
| Plan/write only the platform install manifest | `harness install` |
| Generate repo-local catalog artifacts | `harness artifacts` |
| Install catalog artifacts into a target platform directory | `harness install-artifacts` |
| Apply platform hooks and catalog artifacts together | `harness lifecycle apply` |
| Remove managed platform hooks only | `harness uninstall-platform` |
| Repair managed platform hooks only | `harness repair-platform` |
| Remove hooks and rollback artifacts together | `harness lifecycle uninstall` |
| Repair hooks and artifacts together | `harness lifecycle repair` |

This split keeps platform hook writes, artifact writes, lifecycle manifests, and rollback behavior separately testable.

`harness lifecycle uninstall --json` reports rollback effects separately as `artifactsDeleted` and
`artifactsRestored`. Human output mirrors both counts so mixed rollback plans are visible before
platform hook removal.

Artifact rollback uses `.planning/artifact-install-manifest.json` by default. Manifest persistence is
explicit: `harness install-artifacts <target> --apply --writeManifest`.

Previous-content restore snapshots are also explicit:

```bash
harness install-artifacts <target> --apply --writeManifest --captureRestoreSnapshots
```

The snapshot option is rejected without `--apply` and `--writeManifest`. Even when enabled, the CLI
stores only previous content that is already marked as the expected managed HIMA catalog artifact
with the same kind and id and does not match known plaintext-secret patterns. Unmanaged or
secret-like overwritten content remains hash-only and requires manual restore.

---

## 8. Exit Contract

| Code | Meaning |
|------|---------|
| `0` | Command completed successfully |
| `1` | Command failed, validation failed, or a plan has blockers |
| `2` | Reserved for policy block decisions |
| `3` | Reserved for invalid planning state |

Commands that produce an `ok: false` plan set a non-zero exit code when the plan is directly actionable by automation.
