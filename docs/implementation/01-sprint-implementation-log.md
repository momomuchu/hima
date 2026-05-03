# HIMA Implementation Sprint Log

Status: sprint evidence
Date: 2026-05-03

This file records the implementation decisions and verification evidence for the first executable PFV4 harness slices. The goal is to keep product intent, runtime contracts, and code evidence aligned.

## Product Decisions Applied

- Runtime implementation is TypeScript in the `hima` workspace.
- The physical runtime state model is strict: `.planning/state.yaml`, `.planning/current-risk.yaml`, and `.planning/run-set.json`.
- Logical RMS sets live inside `run-set.json`; no runtime sidecar event log is required for the MVP.
- Canonical executable vocabulary is `RiskClass = T/L/M/H/C`, `OperatingMode = bypass/auto/pairing`, and `GateType = session_start/user_prompt/pre_tool/post_tool/stop/subagent_start/subagent_stop`.
- Runtime name is not enforcement proof. Binding and capability facts must be stored in `run-set.json` and used by gates.

## Sprint 1 - Workspace and Canonical Core

Implemented:

- pnpm workspace with `@harness/core`, `@harness/cli`, and `@harness/mcp-server`.
- Canonical type arrays and Zod schemas.
- Three-file `.planning` initialization and schema-validated storage.
- Baseline risk policy and evidence sufficiency checks.

## Sprint 2 - State, Risk, Gates, CLI, Install

Implemented:

- 8 macro-cycle x 7 subphase sequence helpers and transition validation.
- Risk classifier with forcing signals, bypass eligibility, operating mode and deployment strategy output.
- Gate engine for all seven canonical gates.
- CLI commands: `init`, `status`, `hook`, `transition`, `evidence add`, `risk classify`, `doctor`, `validate`, and `install`.
- Safe platform install core services with dry-run default and optional `.planning/install-manifest.json`.

Important correction:

- A proposed `.planning/loop/events.jsonl` sidecar was removed because it violates the accepted strict three-file runtime model.

## Sprint 3 - Hooks-First Runtime and MCP

Implemented:

- Typed Runtime Capability Set and Runtime Binding Set under `run-set.json`.
- `inspectRuntime` and `bindRuntime` core APIs.
- Runtime binding enforcement for governed `M/H/C` routes on `user_prompt`, `pre_tool`, `stop`, `subagent_start`, and `subagent_stop`.
- MCP `rms.*` tools: `rms.get_state`, `rms.transition`, `rms.classify_risk`, `rms.record_evidence`, `rms.evaluate_gate`, `rms.inspect_runtime`, and `rms.bind_runtime`.
- Backward-compatible MCP `harness:*` aliases.
- CLI hook aliases for platform command names such as `pre-tool-use` and `user-prompt-submit`.

## Sprint 4 - Runtime Profiles and Adapters

Implemented:

- Canonical runtime profiles for `claude`, `codex`, and `hermes`.
- Single source of truth for hook command names:
  `session-start`, `user-prompt-submit`, `pre-tool-use`, `post-tool-use`, `stop`,
  `subagent-start`, and `subagent-stop`.
- Safe dry-run install actions that register all canonical gate hooks and enable
  `codex_hooks=true` for Codex.
- `@harness/adapter-codex`, `@harness/adapter-claude`, and `@harness/adapter-hermes`.
- Adapter previews for Codex config, Claude settings hooks, and Hermes gateway plugin hooks.
- Adapter previews use `getRuntimeProfile()` and `toHookCommand()` from core instead of
  duplicating native hook maps or building commands manually.
- Non-destructive adapter operation semantics: merge/append only, no overwrite action.

Important correction:

- `user_prompt`, `pre_tool`, and `post_tool` initially generated naive command aliases
  (`user-prompt`, `pre-tool`, `post-tool`). They now generate executable CLI aliases
  (`user-prompt-submit`, `pre-tool-use`, `post-tool-use`).
- The CLI initially duplicated hook alias parsing in a second manual table. It now derives
  runtime event parsing from `GATE_TYPES` and `toHookCommand()` so core remains the source
  of truth for executable hook names.

## Sprint 5 - Adapter Apply, Digest Freshness, Operational Catalogs

Implemented:

- Safe adapter apply services:
  - `applyCodexHookConfig()` writes `config.toml` by preserving existing text,
    enabling `codex_hooks=true`, and appending missing hook blocks.
  - `applyClaudeSettings()` writes `settings.json` by preserving existing settings and
    merging hook arrays by event.
  - `applyHermesHookConfig()` writes the MVP deterministic `hermes.config.json` contract
    by preserving existing gateway/plugin data and appending missing hooks.
- Adapter apply is idempotent: repeated calls add zero duplicate hooks.
- Runtime `configDigest` support is optional and backward-compatible on capabilities,
  hook capabilities, and bindings.
- `computeRuntimeProfileDigest()` and `computeRuntimeHookDigest()` provide deterministic
  SHA-256 digests from canonical runtime profile facts.
- `bindRuntime()` / `buildRuntimeBindings()` can mark bindings `stale` on digest mismatch
  while preserving old run-set data with no digest.
- Canonical operational catalogs for skills, books, and subagents:
  `getSkillsCatalog()`, `getBooksCatalog()`, `getSubagentsCatalog()`, and
  `getOperationalCatalog()`.
- Catalog entries are pure core data and reference only canonical cycles, gates, risk classes,
  operating modes, and evidence keys.

Important correction:

- Adapter apply currently treats `root` as the platform config directory, not necessarily the
  project root. This is deterministic and tested, but Sprint 6 should expose a clearer CLI/MCP
  contract before users rely on it.

## Verification Evidence

Commands run from `hima/`:

```text
npx pnpm@10.33.2 test
npx pnpm@10.33.2 lint
npx pnpm@10.33.2 typecheck
npx pnpm@10.33.2 build
```

Sprint 3 result:

- Tests: 12 files, 67 tests passed.
- Lint: Biome checked 54 files, no errors.
- Typecheck: core, CLI and MCP passed.
- Build: core, CLI and MCP dist artifacts regenerated.
- CLI smoke: `init`, `status`, `install codex`, `evidence add`, `risk classify`, and `hook pre-tool-use` passed.
- MCP smoke: compiled `packages/mcp-server/dist/index.js` handled `initialize`, `tools/list`, `rms.inspect_runtime`, `rms.bind_runtime`, `rms.evaluate_gate`, and `rms.get_state`.

Sprint 4 result:

- Tests: 16 files, 77 tests passed.
- Lint: Biome checked 68 files, no errors.
- Typecheck: core, CLI, MCP server, Codex adapter, Claude adapter, and Hermes adapter passed.
- Build: core, CLI, MCP server, Codex adapter, Claude adapter, and Hermes adapter passed.
- Smoke: core `toHookCommand()` returns executable CLI aliases.
- Smoke: Codex preview emits `harness hook pre-tool-use` for `pre_tool`.
- Smoke: Claude preview emits `harness hook user-prompt-submit` for `user_prompt`.
- Smoke: Hermes preview emits `harness hook pre-tool-use` for `pre_tool`.
- Smoke: CLI parses `subagent-start`, `subagent-stop`, and `pre-tool-use` from the built bundle.

Sprint 5 result:

- Tests: 17 files, 93 tests passed.
- Lint: Biome checked 71 files, no errors.
- Typecheck: core, CLI, MCP server, Codex adapter, Claude adapter, and Hermes adapter passed.
- Build: core, CLI, MCP server, Codex adapter, Claude adapter, and Hermes adapter passed.
- Smoke: adapter apply idempotency verified from built bundles:
  Codex `5 -> 0` hooks, Claude `7 -> 0` hooks, Hermes `6 -> 0` hooks.
- Smoke: core exports digest helpers and catalogs from the built bundle.
- Independent Sprint 5 audit verdict: PASS.

Sprint 6 result:

- Implemented first-class convergence scoring and `closeRun()` finalization.
- Exposed runtime digests, catalogs, convergence, and close-run through CLI and MCP.
- Added legacy MCP aliases for catalog/digest/convergence/close tools.
- Tests: 18 files, 119 tests passed.
- Lint, typecheck, and build passed.

Sprint 7 result:

- Runtime binding assessment now distinguishes availability from blocking capability.
- `session_start` and `post_tool` are allowed as observable gates; blocking gates still require native blocking.
- Critical `post_tool` policy violations persist as `GATE_EVALUATED` blockers.
- `closeRun()` is idempotent and writes closing/closed state transitions.
- Secret redaction is recursive and key-aware for hook metadata and previews.
- Security re-review passed after redaction hardening.

Sprint 8 result:

- Centralized write zones in `packages/core/src/policy/write-zones.ts`.
- Centralized canonical user-facing vocabularies in core: gate decisions, evidence statuses,
  confidence levels, change types, runtime statuses, and defaults.
- CLI, MCP, and adapters now consume core constants instead of local enum copies.
- Added tests for MCP schema enum/default alignment and write-zone helpers.

Sprint 9 result:

- Fixed read-only `pre_tool` calls with `path` being incorrectly treated as writes.
- Added policy-level mandatory evidence alternatives so trusted `explicit_human_signature`
  can satisfy the H/C human checkpoint without weakening other evidence.
- Derived `GateDecision` from canonical `GATE_DECISIONS`.
- Replaced the non-canonical test macro-cycle `verify` with `validation`.
- Added full schema-option tests and write-zone matrix tests.

Sprint 10 result:

- `handleHook()` now fails closed when `.planning` state is missing or invalid.
- Accepted `human_validation` and `explicit_human_signature` evidence now require a trusted
  human channel (`source: "human"` or `metadata.verifiedHuman=true`).
- MCP `record_evidence` cannot forge accepted human-only evidence through `source: "agent"`.
- Runtime bindings no longer trust caller-supplied `nativeEvent` / `canBlock` claims; native
  bindings require trusted runtime profile agreement and matching digest proof.
- Write-capable tools with no parsed target path now warn/block instead of allowing.
- Migration ADR checks now require structured accepted `key: "adr"` evidence, not substring matches.
- MCP `harness:log_event` reason text and core persisted hook reasons are redacted.
- Tests: 20 files, 151 tests passed.
- Lint: Biome checked 78 files, no errors.
- Typecheck: core, CLI, MCP server, Codex adapter, Claude adapter, and Hermes adapter passed.
- Audit: no known vulnerabilities found at `--audit-level low`.
- Build: all six packages passed.
- CLI smoke: `node packages\cli\dist\index.js runtime digest codex --json` returned a deterministic
  SHA-256 digest.

Sprint 11 result:

- Core now generates concrete operational artifacts from `getOperationalCatalog()`:
  - skills: `artifacts/skills/<id>/SKILL.md`
  - books: `artifacts/books/<id>.md`
  - subagents: `artifacts/subagents/<id>.md`
- Artifact generation remains DRY: `packages/core/src/catalogs/operational-catalog.ts` is the
  source of truth; generated files are materialized outputs, not a second catalog.
- Writes are dry-run by default through planning, apply explicitly through
  `writeCatalogArtifacts()`, and refuse unmanaged existing files unless future callers opt into
  force-style behavior.
- Artifact writes now harden the filesystem boundary:
  - generated paths must remain inside the output root;
  - symlinked artifact directories or target files are refused before writing;
  - managed-file detection validates the expected generated marker position plus kind/id;
  - MCP `apply:true` requires `baseDir` to stay under the declared project `root`.
- CLI now exposes `harness artifacts` with `--kind all|skills|books|subagents`, `--base-dir`,
  `--apply`, and `--json`.
- MCP now exposes `rms.generate_artifacts` plus legacy `harness:generate_artifacts`; both default
  to dry-run and call the same core service as the CLI.
- Tests now cover deterministic generated counts, `SKILL.md` frontmatter, dry-run no-write,
  selected-kind apply, idempotent managed writes, unmanaged overwrite refusal, CLI JSON/human
  surface, MCP dry-run/apply behavior, MCP root-boundary refusal, and symlink write refusal when
  the OS permits symlink creation in the test environment.
- Verification after hardening:
  - `npx pnpm@10.33.2 exec vitest run packages/core/test/artifact-generation.test.ts packages/mcp-server/test/index.test.ts packages/cli/test/index.test.ts`
    passed: 3 files, 41 tests.
  - `npx pnpm@10.33.2 typecheck` passed.
  - `npx pnpm@10.33.2 test` passed: 21 files, 161 tests.
  - `npx pnpm@10.33.2 lint` passed: Biome checked 80 files.
  - `npx pnpm@10.33.2 audit --audit-level low` passed: no known vulnerabilities.
  - `npx pnpm@10.33.2 build` passed.
  - Built CLI smoke generated 10 skills, dry-run wrote 0 files, apply wrote 10 files, and
    `classify-risk/SKILL.md` contained valid frontmatter plus managed marker.

Sprint 12 verification lane D result:

- Core now has target-aware runtime artifact install coverage for
  `planArtifactInstall()` and `installCatalogArtifacts()`.
- Runtime artifact installation materializes the operational catalog into the selected platform
  directory instead of treating install-artifacts as a portable generation alias:
  - Codex installs under `.codex/skills/<id>/SKILL.md`, `.codex/books/<id>.md`, and
    `.codex/agents/<id>.md`;
  - Claude installs under `.claude/skills/<id>/SKILL.md`, `.claude/books/<id>.md`, and
    `.claude/agents/<id>.md`;
  - Hermes installs under `.hermes/skills/<id>/SKILL.md`, `.hermes/books/<id>.md`, and
    `.hermes/agents/<id>.md`.
- Focused core tests cover dry-run no-write behavior, the Codex/Claude/Hermes layout matrix,
  selected-kind apply behavior, idempotent second apply behavior, invalid target rejection, and
  symlinked platform-root refusal when the OS permits symlink creation in the test environment.
- No core implementation patch was required by this lane; the new regression tests passed against
  the existing shared catalog artifact writer and safe-write helper.
- Verification:
  - `corepack pnpm exec vitest run packages/core/test/artifact-install.test.ts`
    passed: 1 file, 6 tests.
  - Full workspace validation was not run in this lane.

## Remaining Product Gaps

- Documentation outside this implementation log may still need a synchronization pass against the
  executable contracts.
- CLI and MCP install-artifact surfaces were not validated in lane D.
- Verification is local; no remote CI or package-publish/install test has been run.
- The workspace contains many untracked implementation files, so this log verifies the working tree,
  not committed history.

## Next Sprint Recommendation

Move from runtime artifact installation to package/install smoke coverage and docs sync:

1. Add package/install smoke tests that run against built artifacts in a temp workspace.
2. Synchronize conception and implementation docs with the final Sprint 10 runtime contracts.
3. Add CLI/MCP validation for target-aware runtime artifact installation.
4. Add CI workflow equivalents for `typecheck`, `test`, `lint`, `audit`, and `build`.
