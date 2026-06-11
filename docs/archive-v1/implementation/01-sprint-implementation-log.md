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
- Runtime-facing artifact vocabulary is hooks, skills, and subagents. No separate HIMA runtime
  artifact axis exists for generated reference prose.

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
- Canonical operational catalogs for skills, hooks, and subagents:
  `getSkillsCatalog()`, `getHooksCatalog()`, `getSubagentsCatalog()`, and
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
  - hooks: `artifacts/hooks/<id>.md`
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
- CLI now exposes `harness artifacts` with `--kind all|skills|hooks|subagents`, `--base-dir`,
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

Sprint 12 result:

- Core now exposes target-aware catalog artifact installation through
  `planArtifactInstall()` and `installCatalogArtifacts()`.
- Catalog artifact installation materializes the operational catalog into the selected platform
  directory instead of treating install-artifacts as a portable generation alias:
  - Codex installs under `.codex/skills/<id>/SKILL.md`, `.codex/hooks/<id>.md`, and
    `.codex/agents/<id>.md`;
  - Claude installs under `.claude/skills/<id>/SKILL.md`, `.claude/hooks/<id>.md`, and
    `.claude/agents/<id>.md`;
  - Hermes installs under `.hermes/skills/<id>/SKILL.md`, `.hermes/hooks/<id>.md`, and
    `.hermes/agents/<id>.md`.
- CLI now exposes `harness install-artifacts <target>` with `--root`,
  `--kind all|skills|hooks|subagents`, `--apply`, and `--json`.
- MCP now exposes target-aware `rms.install_artifacts` plus legacy
  `harness:install_artifacts`; both default to dry-run and call the same core install service.
- MCP install writes are clamped to the MCP server project root so `apply:true` cannot install
  artifacts into arbitrary global runtime directories through a caller-supplied `root`.
- Platform adapter config writes now use the shared safe-write boundary guard instead of direct
  `writeFile`, so project-local apply rejects symlinked or hardlinked config targets before
  writing.
- Focused core tests cover dry-run no-write behavior, the Codex/Claude/Hermes layout matrix,
  selected-kind apply behavior, idempotent second apply behavior, invalid target rejection, and
  symlinked platform-root refusal when the OS permits symlink creation in the test environment.
- CLI and MCP tests cover target-aware dry-run/apply behavior and assert runtime platform paths,
  not portable `artifacts/` paths.
- Adapter tests cover hardlinked config target refusal for Codex, Claude, and Hermes, plus
  conditional symlink target refusal when the OS permits symlink creation in the test environment.
- Verification:
  - `npx pnpm@10.33.2 exec vitest run packages/core/test/artifact-install.test.ts packages/core/test/artifact-generation.test.ts packages/adapter-codex/test/index.test.ts packages/adapter-claude/test/index.test.ts packages/adapter-hermes/test/index.test.ts packages/cli/test/index.test.ts packages/mcp-server/test/index.test.ts`
    passed: 7 files, 74 tests.
  - `npx pnpm@10.33.2 typecheck` passed.
  - `npx pnpm@10.33.2 test` passed: 22 files, 180 tests.
  - `npx pnpm@10.33.2 lint` passed: Biome checked 83 files.
  - `npx pnpm@10.33.2 audit --audit-level low` passed: no known vulnerabilities.
  - `npx pnpm@10.33.2 build` passed.
  - Built CLI smoke confirmed `install-artifacts codex --kind skills` dry-run wrote no file,
    apply wrote 10 skills under `.codex/skills`, and `classify-risk/SKILL.md` contained the
    canonical catalog marker.

Sprint 13 result:

- Runtime artifact installation now produces audit and rollback metadata from the same catalog
  writer used for actual files:
  - each entry records artifact kind/id, relative path, write status, previous SHA-256 hash, next
    SHA-256 hash, and rollback action (`delete`, `restore`, or `none`);
  - metadata is derived from generated descriptors and existing file content, not from a second
    catalog or stale manifest authority.
- `installCatalogArtifacts()` now returns an artifact install manifest in apply results and can
  persist it explicitly with `writeManifest:true`.
- Artifact install manifest persistence is explicit and safe:
  - dry-run plus `writeManifest:true` is refused;
  - apply writes `.planning/artifact-install-manifest.json` through `safeAtomicWriteFile`;
  - CLI exposes `--writeManifest` for `harness install-artifacts <target>`;
  - MCP exposes `writeManifest` for `rms.install_artifacts` / `harness:install_artifacts` while
    preserving the server-root clamp from Sprint 12.
- Existing platform install manifest persistence was hardened to use `safeAtomicWriteFile` as well,
  closing the `.planning` symlink / hardlink bypass risk found during Sprint 13 security review.
- Package/install smoke coverage now runs against built `dist` artifacts:
  - root script `smoke:package`;
  - `scripts/package-smoke.mjs` validates built CLI dry-run no-write behavior, apply behavior, and
    the canonical marker in `.codex/skills/classify-risk/SKILL.md`;
  - `.github/workflows/hima-ci.yml` runs install, typecheck, test, lint, low audit, build, and
    package smoke.
- Verification:
  - `npx pnpm@10.33.2 exec vitest run packages/core/test/artifact-install.test.ts packages/core/test/install.test.ts packages/core/test/artifact-generation.test.ts packages/cli/test/index.test.ts packages/mcp-server/test/index.test.ts`
    passed: 5 files, 68 tests.
  - `npx pnpm@10.33.2 typecheck` passed.
  - `npx pnpm@10.33.2 test` passed: 22 files, 189 tests.
  - `npx pnpm@10.33.2 lint` passed: Biome checked 84 files.
  - `npx pnpm@10.33.2 audit --audit-level low` passed: no known vulnerabilities.
  - `npx pnpm@10.33.2 build` passed.
  - `npx pnpm@10.33.2 smoke:package` passed: built CLI dry-run wrote 0 artifacts and apply
    wrote 10 Codex skills with the canonical marker.

Sprint 14 result:

- Runtime artifact install manifests are now executable rollback inputs instead of passive audit
  output.
- Core rollback API:
  - `planCatalogArtifactRollback()` reads `.planning/artifact-install-manifest.json` by default;
  - `rollbackCatalogArtifacts()` defaults to dry-run and deletes only newly-created managed
    artifacts when explicitly applied;
  - replaced managed artifacts return `manual_restore_required` because previous content is not
    persisted in the manifest.
- Rollback safety rules:
  - target paths and reported relative paths are recomputed from the shared canonical
    `kind + id` platform path helper, not trusted from manifest absolute or relative paths;
  - manifest reads must stay inside the project root and refuse symlinked/hardlinked manifest
    files;
  - delete and restore preconditions verify current file safety, managed marker, and SHA-256
    `nextHash`;
  - apply revalidates delete candidates immediately before unlink, validates file identity through
    an open handle plus path `dev/ino`, and avoids partial deletes when blockers are present.
- CLI now exposes `harness rollback-artifacts` with `--root`, optional `--manifestFile`,
  `--apply`, and `--json`.
- MCP now exposes `rms.rollback_artifacts` plus `harness:rollback_artifacts`; rollback roots use
  the same MCP server-root clamp as `install_artifacts`.
- Package smoke now covers built CLI install manifest writing, rollback dry-run no-delete, and
  rollback apply deletion.
- Verification:
  - `npx pnpm@10.33.2 exec vitest run packages/core/test/artifact-rollback.test.ts packages/core/test/artifact-install.test.ts packages/cli/test/index.test.ts packages/mcp-server/test/index.test.ts`
    passed: 4 files, 74 tests.
  - `npx pnpm@10.33.2 typecheck` passed.
  - `npx pnpm@10.33.2 test` passed: 23 files, 210 tests.
  - `npx pnpm@10.33.2 lint` passed: Biome checked 87 files.
  - `npx pnpm@10.33.2 audit --audit-level low` passed: no known vulnerabilities.
  - `npx pnpm@10.33.2 build` passed.
  - `npx pnpm@10.33.2 smoke:package` passed: built CLI dry-run wrote 0 artifacts, apply wrote
    10 Codex skills, rollback dry-run deleted 0 artifacts, and rollback apply deleted 10 skills.

Sprint 15 result:

- Release/package smoke now validates the package set as tarballs instead of only using workspace
  links:
  - root script `smoke:tarball`;
  - `scripts/package-tarball-smoke.mjs` runs `pnpm pack` for core, adapters, CLI, and MCP server;
  - the smoke creates an external temporary consumer project, installs the generated tarballs, imports
    `@harness/core`, runs the installed CLI against artifact install/rollback, and starts the installed
    MCP server to verify `tools/list` exposes `rms.rollback_artifacts`.
- CI now runs `smoke:tarball` after build and the existing package smoke.
- The leader verification caught a Windows cleanup regression: the MCP subprocess could keep the
  temporary consumer directory busy after a successful JSON result. The smoke now ends stdin and waits
  for MCP process closure before deleting the temp tree.
- Verification:
  - `npx pnpm@10.33.2 build` passed.
  - `npx pnpm@10.33.2 smoke:tarball` passed: 6 packages packed, 10 core skills exposed, 10 Codex
    skills installed, rollback dry-run deleted 0 artifacts, rollback apply deleted 10 artifacts, and
    MCP exposed 26 tools.
  - `npx pnpm@10.33.2 lint` passed: Biome checked 88 files.

Sprint 16 result:

- Executable hook/gate contracts are now covered through runtime surfaces, not only pure core
  functions:
  - CLI `harness hook <event>` tests cover stdin JSON, dry-run no-write behavior, persisted
    `GATE_EVALUATED` events, invalid JSON/payload failures, and canonical/native adapter event
    aliases;
  - CLI hook event mapping now derives native event names from the canonical runtime profiles so
    Claude/Codex/Hermes hook aliases do not drift from the source of truth.
- MCP gate execution now has behavior coverage:
  - `rms.evaluate_gate` is tested as dry-run/no-write;
  - `harness:evaluate_gate` is tested as a persisted policy event with secret redaction.
- MCP artifact generation write confinement now matches install/rollback confinement:
  - generated artifact writes require the requested root to stay under the MCP server project root;
  - tests prove outside-root apply calls are refused without writing artifacts.
- Planning transitions now leave a durable audit trail:
  - `requestTransition()` appends a `STATE_TRANSITIONED` run-set event while preserving existing
    run-set data;
  - failed terminal implicit transitions are tested to reject without partial writes;
  - transition event IDs use `randomUUID()` instead of timestamp-only IDs.
- Sprint 16 validation blockers were closed after specialist review:
  - MCP project-root write tools now route through the MCP server-root confinement helper, including
    gate evaluation, transition, runtime inspection/binding, evidence, convergence, close-run, and
    raw audit-event logging;
  - transition reasons and raw MCP audit payloads share the core redaction helper, so token/password
    style secrets are not persisted in run-set audit data;
  - structured `toolInput` / `toolOutput` previews are redacted before JSON previewing, closing the
    nested `password` / `token` / `apiKey` preview leak found during security revalidation;
  - CLI hook stdin is capped at 1 MiB and timeboxed before JSON parsing, with an oversized-payload
    test proving no event is written on rejection.
- Verification:
  - `npx pnpm@10.33.2 exec vitest run packages/core/test/request-transition.test.ts packages/core/test/transition.test.ts packages/cli/test/index.test.ts packages/mcp-server/test/index.test.ts`
    passed: 4 files, 65 tests.
  - `npx pnpm@10.33.2 typecheck` passed.
  - `npx pnpm@10.33.2 test` passed: 24 files, 223 tests.
  - `npx pnpm@10.33.2 lint` passed: Biome checked 90 files.
  - `npx pnpm@10.33.2 audit --audit-level low` passed: no known vulnerabilities.
  - `npx pnpm@10.33.2 build` passed.
  - `npx pnpm@10.33.2 smoke:package` passed: built CLI install/rollback smoke succeeded.
  - `npx pnpm@10.33.2 smoke:tarball` passed: 6 packages packed, installed into an external
    temporary consumer, CLI install/rollback succeeded, and MCP exposed 26 tools.

Sprint 17 result:

- Release/package readiness now has a local executable gate while preserving the accepted
  private-first project decision.
- A shared package policy source of truth lives in `scripts/package-policy.mjs` and defines the
  canonical package set, essential packed files, package directory mapping, and tarball manifest
  reader.
- Package manifests now declare:
  - private package status;
  - private `UNLICENSED` licensing status;
  - Node `>=20`;
  - package descriptions and keywords;
  - explicit packed file surface through `files: ["dist"]`.
- `pnpm package:readiness` reports public-release blockers and metadata warnings without attempting
  a publish. Current expected mode is `private-first-advisory`: package-level `private:true` blocks
  public npm publication until a later visibility decision.
- The readiness evaluator is exported for tests, and the non-canonical internal dependency guard now
  blocks any `@harness/*` dependency that is outside the canonical package set.
- `pnpm smoke:tarball` now inspects packed tarball contents directly:
  - every package must contain `package/package.json`, `package/dist/index.js`, and
    `package/dist/index.d.ts`;
  - packed dependency manifests must not contain `workspace:`, `file:`, or `link:` protocols;
  - the smoke still installs all tarballs into an external temporary consumer and verifies CLI plus
    MCP runtime behavior.
- CI now runs `package:readiness` after build and before package smokes.
- Release readiness policy is documented in `docs/implementation/02-release-readiness-policy.md`.
- Verification:
  - `npx pnpm@10.33.2 exec vitest run packages/core/test/package-readiness.test.ts` passed: 1
    file, 2 tests, including the `@harness/not-canonical` dependency blocker.
  - `npx pnpm@10.33.2 typecheck` passed.
  - `npx pnpm@10.33.2 test` passed: 25 files, 225 tests.
  - `npx pnpm@10.33.2 lint` passed: Biome checked 93 files.
  - `npx pnpm@10.33.2 audit --audit-level low` passed: no known vulnerabilities.
  - `npx pnpm@10.33.2 build` passed.
  - `npx pnpm@10.33.2 package:readiness` passed in `private-first-advisory` mode: 6 packages
    checked, 6 expected private-publication blockers, and 14 warnings for repository metadata plus
    source `workspace:*` dependencies that tarball smoke must prove rewritten.
  - `npx pnpm@10.33.2 smoke:package` passed.
  - `npx pnpm@10.33.2 smoke:tarball` passed: 6 packages packed, packed manifest/essential-file
    checks passed, no local dependency protocols leaked, external consumer install succeeded, CLI
    install/rollback succeeded, and MCP exposed 26 tools.

Sprint 18 result:

- Platform hook lifecycle is now first-class and manifest-driven:
  - `readInstallManifest()` validates `.planning/install-manifest.json` as the authority for
    platform lifecycle commands;
  - manifest reads refuse out-of-root paths, symlinked roots/parents/targets, hardlinked manifests,
    mismatched project roots, mismatched platform directories, and mismatched hooks directories;
  - CLI exposes `harness uninstall-platform` and `harness repair-platform`, both dry-run by default
    and both deriving target/platform paths from the validated install manifest.
- Runtime adapters now provide conservative removal functions:
  - Codex removes only exact managed `[[hooks]]` blocks and leaves user config plus
    `codex_hooks=true` intact;
  - Claude removes only matching HIMA command hook entries and preserves unrelated settings/hooks;
  - Hermes removes matching HIMA hooks and removes the managed harness plugin only when it has no
    custom fields.
- `safeAtomicWriteFile()` was hardened after security review:
  - temporary writes use exclusive create semantics;
  - the write target is revalidated before rename;
  - the target directory identity is checked before rename;
  - temporary files are cleaned up on failure.
- Package smokes now cover both lifecycle tracks:
  - `smoke:package` verifies built CLI platform install, uninstall dry-run no-mutation, uninstall
    apply, repair apply, artifact install, artifact rollback dry-run, and artifact rollback apply;
  - `smoke:tarball` verifies the same platform lifecycle path from an external consumer project
    installed from packed tarballs.
- Verification:
  - `npx pnpm@10.33.2 typecheck` passed.
  - `npx pnpm@10.33.2 test` passed: 25 files, 233 tests.
  - `npx pnpm@10.33.2 lint` passed: Biome checked 93 files.
  - `npx pnpm@10.33.2 audit --audit-level low` passed: no known vulnerabilities.
  - `npx pnpm@10.33.2 build` passed.
  - `npx pnpm@10.33.2 package:readiness` passed in `private-first-advisory` mode: 6 packages
    checked, 6 expected private-publication blockers, and 14 warnings.
  - `npx pnpm@10.33.2 smoke:package` passed: platform hooks added/removed/repaired `5/5/5`,
    artifact dry-run wrote 0, artifact apply wrote 10, rollback dry-run deleted 0, rollback apply
    deleted 10.
  - `npx pnpm@10.33.2 smoke:tarball` passed: 6 packages packed, packed manifest/essential-file
    checks passed, no local dependency protocols leaked, external consumer install succeeded,
    platform hooks added/removed/repaired `5/5/5`, artifact install/rollback succeeded, and MCP
    exposed 26 tools.

Sprint 19 result:

- MCP now has platform lifecycle parity with the CLI:
  - `rms.install_platform` / `harness:install_platform` plan or write the platform install manifest
    and optionally apply target adapter hook config;
  - `rms.uninstall_platform` / `harness:uninstall_platform` remove managed hook registrations from
    the validated install manifest and default to dry-run;
  - `rms.repair_platform` / `harness:repair_platform` re-apply managed hook registrations from the
    validated install manifest and default to dry-run.
- The MCP layer remains a thin facade:
  - project roots are clamped through the same MCP server-root helper used by install/rollback
    artifacts;
  - install-manifest authority still lives in core through `readInstallManifest()`;
  - platform config mutation still lives in the runtime adapters.
- `@harness/mcp-server` now declares adapter package dependencies so packed MCP installs can execute
  platform lifecycle tools without relying on workspace-only imports.
- `smoke:tarball` now explicitly verifies `tools/list` contains `rms.install_platform`,
  `rms.uninstall_platform`, and `rms.repair_platform`.
- Verification:
  - `npx pnpm@10.33.2 install --frozen-lockfile` passed.
  - `npx pnpm@10.33.2 typecheck` passed.
  - `npx pnpm@10.33.2 exec vitest run packages/mcp-server/test/index.test.ts` passed: 1 file, 24
    tests.
  - `npx pnpm@10.33.2 test` passed: 25 files, 235 tests.
  - `npx pnpm@10.33.2 lint` passed: Biome checked 93 files.
  - `npx pnpm@10.33.2 audit --audit-level low` passed: no known vulnerabilities.
  - `npx pnpm@10.33.2 build` passed.
  - `npx pnpm@10.33.2 package:readiness` passed in `private-first-advisory` mode: 6 packages
    checked, 6 expected private-publication blockers, and 17 warnings.
  - `npx pnpm@10.33.2 smoke:package` passed: platform hooks added/removed/repaired `5/5/5`,
    artifact dry-run wrote 0, artifact apply wrote 10, rollback dry-run deleted 0, rollback apply
    deleted 10.
  - `npx pnpm@10.33.2 smoke:tarball` passed: 6 packages packed, packed manifest/essential-file
    checks passed, no local dependency protocols leaked, external consumer install succeeded,
    platform hooks added/removed/repaired `5/5/5`, artifact install/rollback succeeded, and MCP
    exposed 32 tools including the platform lifecycle tools.

Sprint 20 result:

- Runtime lifecycle orchestration is implemented through CLI and MCP surfaces:
  - CLI exposes `harness lifecycle apply`, `harness lifecycle uninstall`, and
    `harness lifecycle repair`;
  - MCP exposes `rms.apply_lifecycle`, `rms.uninstall_lifecycle`, and
    `rms.repair_lifecycle`, with `harness:*` compatibility aliases.
- Lifecycle apply composes platform hook registration plus catalog artifact installation and can
  write lifecycle manifests when applied.
- Lifecycle uninstall rolls back catalog artifacts from the artifact manifest before removing
  managed platform hooks from the platform install manifest.
- Lifecycle repair re-applies managed platform hooks and catalog artifacts from manifests.
- Runtime-facing artifact vocabulary was corrected end to end: catalog artifacts are now
  skills, hooks, and subagents.
- README status now reflects executable implementation work instead of the earlier
  architecture-only phase, and lists the executable hook command aliases.
- Core, CLI, MCP, package smokes, and implementation docs were updated to remove the obsolete
  generated-reference artifact axis.
- Verification:
  - Core targeted tests passed: catalog, artifact generation, artifact install, artifact rollback,
    and lifecycle install tests.
  - CLI typecheck, test, build, and `node scripts/package-smoke.mjs` passed.
  - MCP typecheck and targeted MCP tests passed.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm test` passed: 25 files, 245 tests.
  - `corepack pnpm lint` passed: Biome checked 94 files.
  - `corepack pnpm audit --audit-level low` passed: no known vulnerabilities.
  - `corepack pnpm build` passed.
  - `corepack pnpm package:readiness` passed in `private-first-advisory` mode.
  - `corepack pnpm smoke:package` passed: lifecycle hooks added/removed `5/5`, lifecycle
    artifacts written `10`, platform hooks added/removed/repaired `5/5/5`, and artifact
    rollback apply deleted `10`.
  - `corepack pnpm smoke:tarball` passed: 6 packages packed, external consumer install
    succeeded, lifecycle hooks added/removed `5/5`, lifecycle blockers surfaced for a tampered
    artifact, rollback apply deleted `10`, and MCP exposed 38 tools.

Sprint 21 result:

- RMS contract hardening tightened the executable schema boundary without turning logical sets into
  closed-world documents:
  - `ProjectSet`, `IntentSet`, and `PolicySet` now have typed known fields plus
    forward-compatible unknown fields;
  - `SubagentRunRecord` now requires `agentId` and preserves portable runtime/scope/evidence
    metadata;
  - `current-risk.yaml#/promotion_history` now uses typed audit entries instead of a completely
    free-form map.
- Opaque RMS data remains advisory unless a typed service explicitly reads it:
  - context injection only serializes route/risk/gate facts, not project/intent/policy/subagent or
    evidence metadata payloads;
  - convergence ignores advisory `intent` or `policy` fields that attempt to authorize
    finalization or override mandatory evidence;
  - ordinary evidence metadata round-trips, but human-only evidence still requires the exact trusted
    channel rule (`source: "human"` or `metadata.verifiedHuman === true`).
- MCP request hardening now rejects malformed boundaries instead of silently coercing them:
  - non-object `tools/call.arguments` is rejected;
  - non-object gate payloads are rejected;
  - non-object raw `harness:log_event` payloads are rejected;
  - `rms.record_evidence` schema and behavior keep `source`, `metadata`, `id`, and `createdAt`
    outside the MCP trust boundary.
- Focused verification:
  - `corepack pnpm exec vitest run packages/core/test/planning-store.test.ts packages/core/test/evidence.test.ts packages/core/test/gates.test.ts packages/core/test/convergence.test.ts packages/mcp-server/test/index.test.ts`
    passed: 5 files, 110 tests.
  - `corepack pnpm --filter @harness/core typecheck` passed.
  - `corepack pnpm --filter @harness/mcp-server typecheck` passed.

Sprint 22 result:

- RMS schema preservation now has property-based coverage with `fast-check`:
  - unknown future fields on `ProjectSet`, `IntentSet`, and `PolicySet` round-trip as data;
  - evidence metadata remains opaque object data;
  - `SubagentRunRecord` preserves metadata and future fields while still requiring `agentId`;
  - non-object `project`, `intent`, and `policy` roots are rejected across generated cases.
- CLI primitive parsing is stricter and more consistent with MCP boundary validation:
  - integer flags reject partial numeric strings such as `42abc` and decimal input where an integer
    is required;
  - percent flags reject partial numeric strings such as `85abc`;
  - boolean flags reject non-boolean primitive values instead of silently treating them as false.
- Focused verification:
  - `corepack pnpm exec vitest run packages/core/test/run-set-schema.property.test.ts packages/core/test/planning-store.test.ts packages/cli/test/index.test.ts`
    passed: 3 files, 63 tests.
  - `corepack pnpm --filter @harness/core typecheck` passed.
  - `corepack pnpm --filter @harness/cli typecheck` passed.

Sprint 23 result:

- User feedback corrected the runtime artifact vocabulary:
  - there is no HIMA runtime artifact family named `book` or `books`;
  - canonical managed runtime artifacts are exactly `skill`, `hook`, and `subagent`;
  - reference docs, runbooks, playbooks, manuals, ADRs, and generated views remain durable
    documentation only.
- Proposal docs were aligned where the stale term could affect implementation:
  - the taxonomy file is now `03-skills-hooks-subagents-taxonomy.md`;
  - Cycle 03 artifact contracts now define the manifest over governed skills, hooks, and
    subagents only;
  - reference docs were removed from runtime artifact manifests and moved back to
    non-executable documentation/provenance status;
  - the integrated proposal now makes runtime hooks a first-class section with concrete MVP
    hooks.
- CI now has a vocabulary guard:
  - `scripts/guard-runtime-artifact-vocab.mjs` fails on stale runtime-axis patterns where the
    old documentation-surface term is used as a runtime family, manifest kind, artifact id
    namespace, or managed catalog header kind;
  - the guard is attached to `corepack pnpm lint`;
  - the scan avoids loose `book` matching so legitimate `runbook` and `playbook` documentation
    terms remain valid.
- Runtime regression coverage now locks the source of truth:
  - catalog artifact selections are `all`, `skills`, `hooks`, and `subagents`;
  - generated artifact kinds are exactly `hook`, `skill`, and `subagent`;
  - artifact rollback rejects a manifest entry whose runtime kind uses the old
    documentation-surface term.
- Verification:
  - `node scripts/guard-runtime-artifact-vocab.mjs` passed.
  - `corepack pnpm --filter @harness/core test` passed after the package-local
    test script was aligned with the root Vitest configuration: 21 files, 179 tests.
  - `corepack pnpm exec vitest run packages/core/test/artifact-generation.test.ts packages/core/test/artifact-rollback.test.ts`
    passed: 2 files, 25 tests.
  - `corepack pnpm test` passed: 26 files, 287 tests.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm lint` passed: Biome checked 96 files plus the runtime artifact vocabulary
    guard.
  - `corepack pnpm build` passed.
  - `corepack pnpm audit --audit-level low` passed: no known vulnerabilities.
  - `corepack pnpm package:readiness` passed in `private-first-advisory` mode with the expected
    private-publication blockers.
  - `corepack pnpm smoke:package` passed.
  - `corepack pnpm smoke:tarball` passed: 6 packages packed, external consumer install
    succeeded, lifecycle hooks added/removed `5/5`, lifecycle artifacts written `10`, artifact
    rollback apply deleted `10`, and MCP exposed 38 tools.

Sprint 24 result:

- Active risk vocabulary was harmonized to the canonical `T/L/M/H/C` model:
  - old non-canonical L aliases were migrated to `L`;
  - old non-canonical H and accented H aliases were migrated to `H`;
  - active final-proposal and hooks-first spec docs now use `T/L`, `M/H/C`, and `H/C`
    policy bands.
- The migration was intentionally scoped:
  - active final proposal docs, hooks-first specs, implementation docs, package code, and the docs
    index are guarded;
  - archival research, business-model, and older state-machine history docs remain outside the
    guard until a provenance-preserving archive migration is planned.
- `scripts/guard-risk-vocab.mjs` now fails lint on stale active-scope risk forms:
  - slash forms for the old class model;
  - scalar and quoted JSON/YAML risk fields including `risk_class`, `current_risk_class`,
    `proposed_risk_class`, and `minimum_class`;
  - old compact risk arrays, risk-policy namespaces, rank-order strings, and prose references to
    legacy L/H proof, gap, route, class, and signal aliases;
  - old French L/H labels in guarded scopes.
- Runtime boundary coverage was strengthened:
  - `packages/core/test/canonical.test.ts` now explicitly rejects legacy L, H, and accented H
    aliases at `RiskClassSchema`.
- Test execution was hardened:
  - root `test` now runs through `scripts/run-tests.mjs`;
  - the runner preserves the existing core build + Vitest behavior and normalizes bare
    `--bail` to `--bail=1`, so `npm test -- --bail` is valid with Vitest 4.
- Verification:
  - `corepack pnpm guard:risk-vocab` passed.
  - `corepack pnpm lint` passed: Biome checked 98 files, then both vocabulary guards passed.
  - `corepack pnpm exec vitest run packages/core/test/canonical.test.ts` passed: 1 file, 7 tests.
  - `corepack pnpm test` passed: 26 files, 288 tests.
  - `npm test -- --bail` passed: 26 files, 288 tests.
  - `corepack pnpm --filter @harness/core test` passed: 21 files, 180 tests.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm build` passed when run without a concurrent core rebuild.
  - `corepack pnpm audit --audit-level low` passed: no known vulnerabilities.
  - `corepack pnpm package:readiness` passed in `private-first-advisory` mode with the expected
    private-publication blockers.
  - `corepack pnpm smoke:package` passed.
  - `corepack pnpm smoke:tarball` passed: 6 packages packed, external consumer install
    succeeded, lifecycle hooks added/removed `5/5`, lifecycle artifacts written `10`, artifact
    rollback apply deleted `10`, and MCP exposed 38 tools.
- Post-review hardening:
  - Independent verification found additional active-scope legacy L/H risk aliases in
    promotion/downgrade examples, risk-order examples, closing policy refs, evidence prose, and one
    non-canonical boolean `risk_allowed` gap field.
  - The active docs were migrated to `L`/`H`; the gap field was renamed to
    `gap_allowed_by_risk_policy` so `risk_allowed` remains reserved for per-risk T/L/M/H/C maps.
  - `scripts/guard-risk-vocab.mjs` now catches these forms: boolean `risk_allowed`, old transition
    `from`/`to` risk values, risk-order list entries, YAML risk map keys, closing policy namespaces,
    hyphenated risk prose, conditional L-risk policy phrases, and non-canonical English
    L/H-risk wording.
  - `scripts/guard-risk-vocab.test.mjs` now injects a temporary active-scope fixture and proves the
    guard rejects unquoted YAML boolean assignments to `risk_allowed` before removing the fixture.
  - `scripts/run-tests.mjs` now strips pnpm's forwarded `--` separator before passing arguments to
    Vitest, so scoped test filters are honored instead of accidentally running the whole suite.
  - Post-hardening checks passed: `corepack pnpm guard:risk-vocab`, targeted active-scope risk scan,
    `corepack pnpm lint`, `corepack pnpm exec vitest run packages/core/test/canonical.test.ts`,
    `corepack pnpm test -- packages/core/test/canonical.test.ts --bail`, expected failure for
    `corepack pnpm test -- __definitely_no_such_test_file__ --bail`, and `corepack pnpm test`.

Sprint 25 result:

- CLI and MCP documentation now has executable contract coverage:
  - `packages/cli/src/index.ts` exports `getCliCommandSurface()`;
  - `packages/mcp-server/src/index.ts` exports `getMcpToolSurface()`;
  - `packages/cli/test/index.test.ts` asserts the documented command table equals the executable
    command tree, with no stale extras in the canonical command surface;
  - `packages/mcp-server/test/index.test.ts` asserts documented MCP tool tables equal `tools/list`
    and that every listed tool has an execution handler instead of falling through to unknown-tool.
- `docs/conception/09-cli-commands-spec.md` was replaced with an English, implementation-aligned
  CLI contract for the current command tree.
- `docs/conception/11-mcp-tools-spec.md` was added as the canonical MCP tool contract for
  `@harness/mcp-server`, with `rms.*` as the primary namespace and `harness:*` as compatibility
  aliases.
- Runtime binding docs now register the MCP binary as `harness-mcp-server` with empty args instead
  of the obsolete `harness mcp-server` shape.
- MCP open questions were aligned with the executable MVP:
  - there is no current `harness mcp` CLI namespace;
  - third-party MCP registry management is deferred;
  - MCP verification is covered by server package tests and the executable `tools/list` contract for
    v0.1.
- Verification:
  - `corepack pnpm --filter @harness/cli test` passed: 45 tests.
  - `corepack pnpm --filter @harness/mcp-server test` passed: 43 tests.
  - `corepack pnpm guard:risk-vocab` passed.
  - `corepack pnpm lint` passed after formatting the CLI contract helper.
  - `corepack pnpm test` passed: 26 files, 291 tests.
  - `corepack pnpm typecheck` passed after widening CLI command introspection to handle citty's
    resolvable metadata type.
  - `corepack pnpm build` passed.
  - `corepack pnpm audit --audit-level low` passed: no known vulnerabilities.
  - `corepack pnpm package:readiness` passed in `private-first-advisory` mode with the expected
    private-publication blockers.
  - `corepack pnpm smoke:package` passed.
  - `corepack pnpm smoke:tarball` passed: 6 packages packed, lifecycle hooks added/removed `5/5`,
    lifecycle artifacts written `10`, artifact rollback apply deleted `10`, and MCP exposed 38
    tools.

Sprint 26 result:

- Runtime proof enforcement is now executable:
  - `RuntimeProofType` is canonicalized as `config_read`, `manifest_digest`, `dry_run`,
    `negative_fixture`, `event_fire`, and `manual_attestation`.
  - Runtime hook capabilities in `.planning/run-set.json` can store `proofs`.
  - Blocking runtime bindings now require accepted `negative_fixture` or accepted `event_fire`
    before returning `status=native` with `canBlock=true`.
  - Accepted `manual_attestation` is preserved as evidence but does not authorize native blocking.
- The runtime bootstrapping path was kept intact:
  - platform adapters register supported hooks from the runtime profile, not from proof-qualified
    runtime bindings;
  - this lets installation create hooks before proof collection while policy gates still require
    proof before hard enforcement.
- MCP runtime inspection now accepts hook `proofs` and exposes the proof schema in `tools/list`.
- CLI digest-only runtime binding now reports blocking hooks as `stale` rather than pretending they
  are native.
- Documentation was updated:
  - `docs/conception/04-runtime-bindings-spec.md` now includes the executable blocking proof
    contract;
  - `docs/conception/11-mcp-tools-spec.md` now documents runtime proof inputs;
  - `docs/INDEX.md` line counts were refreshed for conception specs.
- Test infrastructure was hardened:
  - `scripts/run-tests.mjs` now builds adapter packages before root `vitest`, preventing stale
    `dist/` adapters from masking MCP behavior.
- Verification:
  - `corepack pnpm --filter @harness/core test` passed: 21 files, 185 tests.
  - `corepack pnpm --filter @harness/adapter-codex test` passed: 7 tests.
  - `corepack pnpm --filter @harness/adapter-claude test` passed: 7 tests.
  - `corepack pnpm --filter @harness/adapter-hermes test` passed: 9 tests.
  - `corepack pnpm --filter @harness/mcp-server test` passed after rebuilding adapters: 44 tests.
  - `corepack pnpm --filter @harness/cli test` passed: 45 tests.
  - `corepack pnpm lint` passed after formatting, including runtime artifact and risk vocabulary
    guards.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm test` passed: 26 files, 297 tests.
  - `corepack pnpm build` passed.
  - `corepack pnpm audit --audit-level low` passed: no known vulnerabilities.
  - `corepack pnpm package:readiness` passed in `private-first-advisory` mode with the expected
    private-publication blockers.
  - `corepack pnpm smoke:package` passed.
  - `corepack pnpm smoke:tarball` passed: 6 packages packed, lifecycle hooks added/removed `5/5`,
    lifecycle artifacts written `10`, artifact rollback apply deleted `10`, and MCP exposed 38
    tools.

Sprint 27 result:

- Runtime proof submission is now reachable from the CLI, not only MCP:
  - `harness runtime inspect` accepts `--hooksJson` with a JSON object keyed by canonical
    `GateType`;
  - the CLI parser validates hook overrides through the shared core `RuntimeHooksInputSchema`;
  - malformed JSON, non-string input, and unknown gate names are rejected before persistence.
- Blocking proof semantics were tightened:
  - supported blocking hooks still remain `stale` after digest-only inspection;
  - an accepted `negative_fixture` or accepted `event_fire` proof must include `observedAt` before
    the binding can become `status=native` with `canBlock=true`;
  - `manual_attestation` remains evidence only and cannot authorize native blocking by itself.
- Runtime proof persistence is secret-aware:
  - proof `detail`, hook `notes`, and runtime `knownLimitations` are redacted before they are stored
    in `.planning/run-set.json`;
  - CLI coverage now proves a secret-shaped proof detail is persisted as `[REDACTED]`.
- Documentation was aligned with the executable surface:
  - `docs/conception/09-cli-commands-spec.md` now documents `--hooksJson`, the proof payload shape,
    the binding command, and the digest-only stale rule;
  - `docs/conception/04-runtime-bindings-spec.md` and `docs/conception/11-mcp-tools-spec.md`
    remain aligned with the accepted proof plus `observedAt` rule;
  - `docs/INDEX.md` conception spec line counts were refreshed.
- Verification:
  - `corepack pnpm --filter @harness/cli test` passed: 47 tests.
  - `corepack pnpm lint` passed after Biome organized imports.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm --filter @harness/core test` passed: 21 files, 187 tests.
  - `corepack pnpm --filter @harness/mcp-server test` passed: 44 tests.
  - `corepack pnpm test` passed: 26 files, 301 tests.
  - `corepack pnpm build` passed.
  - `corepack pnpm audit --audit-level low` passed: no known vulnerabilities.
  - `corepack pnpm package:readiness` passed in `private-first-advisory` mode with the expected
    private-publication blockers.
  - `corepack pnpm smoke:package` passed.
  - `corepack pnpm smoke:tarball` passed: 6 packages packed, lifecycle hooks added/removed `5/5`,
    lifecycle artifacts written `10`, artifact rollback apply deleted `10`, and MCP exposed 38
    tools.

Sprint 28 result:

- Runtime proof trust is now separated from caller input:
  - `harness runtime inspect --hooksJson` and MCP `rms.inspect_runtime` can still store proof-shaped
    facts, but caller-submitted `accepted` proofs are downgraded to `candidate`;
  - verifier-bound proof fields from untrusted input are stripped before persistence, so CLI/MCP
    callers cannot forge a native blocking binding by setting `status=accepted`;
  - `trustProofs` remains internal; the public `probeRuntime()` acquisition path is the only core
    barrel-exported path that mints trusted runtime probe evidence.
- The core can now mint trusted runtime probe evidence:
  - `probeRuntime()` reads target runtime config, validates managed hook registrations, reads the
    install manifest when present, and emits core-minted `config_read` and `manifest_digest`
    proofs;
  - Codex probes require both managed `[[hooks]]` entries and `[features] codex_hooks = true`; a
    matching hook block with a missing or false feature flag remains non-native;
  - native blocking requires a proof minted by `core-runtime-probe` with `observedAt`, `target`,
    `gateType`, `configDigest`, `result=blocked_expected_fixture`, and a verifier digest.
- Codex installation now repairs disabled hook support:
  - `adapter-codex` replaces an existing `codex_hooks = false` line with `codex_hooks = true`
    before appending managed hook registrations;
  - this keeps install/apply behavior aligned with the trusted probe, which refuses Codex hook
    proofs unless the feature flag is enabled.
- CLI and MCP parity was extended:
  - `harness runtime probe <target> [--bind] [--json]` probes runtime config and may bind
    immediately;
  - `rms.probe_runtime` and `harness:probe_runtime` expose the same path through MCP.
- Runtime secret redaction was broadened for proof details, hook notes, and runtime limitations:
  - key-value secrets, bearer tokens, OpenAI-style `sk-` tokens, GitHub classic/fine-grained tokens,
    AWS access keys, Slack tokens, npm tokens, JWTs, and PEM private keys are redacted before
    persistence.
- Documentation was aligned with the executable trust model:
  - `docs/conception/04-runtime-bindings-spec.md` now requires core-minted verifier-bound proof for
    native blocking;
  - `docs/conception/09-cli-commands-spec.md` documents `harness runtime probe`;
  - `docs/conception/11-mcp-tools-spec.md` documents `rms.probe_runtime` and the candidate-only
    rule for caller-submitted proofs;
  - `docs/propositions/pipeline-fractal-v4-specs/0002-runtime-probe-and-freshness.spec.md` now
    requires core-minted trusted proof for hard enforcement.
- Verification:
  - `corepack pnpm --filter @harness/core test` passed: 22 files, 193 tests.
  - `corepack pnpm --filter @harness/adapter-codex test` passed: 8 tests.
  - `corepack pnpm --filter @harness/cli test` passed: 48 tests.
  - `corepack pnpm --filter @harness/mcp-server test` passed: 45 tests.
  - `corepack pnpm lint` passed.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm test` passed: 27 files, 310 tests.
  - `corepack pnpm build` passed.
  - `corepack pnpm audit --audit-level low` passed: no known vulnerabilities.
  - `corepack pnpm package:readiness` passed in `private-first-advisory` mode with the expected
    private-publication blockers.
  - `corepack pnpm smoke:package` passed.
  - `corepack pnpm smoke:tarball` passed: 6 packages packed, lifecycle hooks added/removed `5/5`,
    lifecycle artifacts written `10`, artifact rollback apply deleted `10`, and MCP exposed 40
    tools.

Sprint 29 result:

- Trusted runtime blocking proofs now have an executable freshness window:
  - `isTrustedRuntimeProof()` still verifies `status=accepted`, `verifier=core-runtime-probe`,
    target, gate, config digest, result, parseable `observedAt`, and `proofDigest`;
  - it now also rejects proofs observed before the stored capability inspection, after the binding
    inspection, or more than 15 minutes before binding time;
  - `bindRuntime()` treats a stale, future-dated, or expired trusted blocking proof as `stale` with
    `canBlock=false`.
- Runtime probe trust was tightened after reviewer feedback:
  - config registration alone never mints `negative_fixture`;
  - `harness runtime probe --verifyBlockingFixtures` and MCP `verifyBlockingFixtures: true`
    explicitly execute managed blocking fixtures before storing accepted `negative_fixture` proof;
  - MCP `rms.probe_runtime` no longer accepts a caller-controlled `inspectedAt`; the trusted proof
    timestamp is server-observed;
  - trusted probe `configDigest` is now tied to the observed runtime config content, runtime profile
    digest, and install manifest digest instead of only the static runtime profile digest;
  - without fixture verification, registered blocking hooks remain `stale` after `--bind`.
- Regression coverage now proves the trust window:
  - a valid proof inside the capability/binding window remains native;
  - a core-minted proof from an older capability inspection is stale;
  - a future-dated proof is stale;
  - a proof older than the trusted 15-minute window is stale;
  - a future-dated capability/binding timestamp is stale even when the proof is internally
    consistent;
  - a runtime config content change changes the trusted probe digest;
  - MCP ignores rogue caller-supplied `inspectedAt` on `rms.probe_runtime`;
  - config-only runtime probe does not mint `negative_fixture`;
  - fixture-verified runtime probe can mint accepted `negative_fixture`;
  - public `inspectRuntime()` still strips verifier-bound metadata (`target`, `gateType`,
    `configDigest`, `result`, `verifier`, and `proofDigest`) and downgrades caller proofs to
    `candidate`.
- Convergence fixtures were corrected to use runtime binding timestamps that satisfy the new proof
  window instead of accidentally relying on future-dated fixture proofs.
- Documentation was aligned:
  - `docs/conception/04-runtime-bindings-spec.md`, `docs/conception/09-cli-commands-spec.md`,
    `docs/conception/11-mcp-tools-spec.md`, and
    `docs/propositions/pipeline-fractal-v4-specs/0002-runtime-probe-and-freshness.spec.md` now
    state the 15-minute freshness window and stale/future-proof rejection rules;
  - `docs/INDEX.md` line counts were refreshed for the changed docs.
- Verification:
  - `corepack pnpm exec vitest run --root . packages/core/test/runtime-bindings.test.ts packages/core/test/convergence.test.ts` passed: 38 tests.
  - `corepack pnpm exec vitest run --root . packages/core/test/runtime-probe.test.ts packages/core/test/runtime-bindings.test.ts packages/cli/test/index.test.ts packages/mcp-server/test/index.test.ts` passed: 4 files, 123 tests.
  - `corepack pnpm --filter @harness/core test` passed: 22 files, 197 tests.
  - `corepack pnpm lint` passed.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm test` passed: 27 files, 316 tests.
  - `corepack pnpm build` passed.
  - `corepack pnpm audit --audit-level low` passed: no known vulnerabilities.
  - `corepack pnpm package:readiness` passed in `private-first-advisory` mode with the expected
    private-publication blockers.
  - `corepack pnpm smoke:package` passed.
  - `corepack pnpm smoke:tarball` passed: 6 packages packed, lifecycle hooks added/removed `5/5`,
    lifecycle artifacts written `10`, artifact rollback apply deleted `10`, and MCP exposed 40
    tools.

Sprint 30 result:

- Documentation drift is now guarded instead of manually patched:
  - `scripts/refresh-docs-index.mjs` refreshes `docs/INDEX.md` numbering, line counts, category
    totals, document totals, and audit totals from the actual files;
  - `corepack pnpm docs:index` writes the refreshed index;
  - `corepack pnpm guard:docs-index` and `corepack pnpm lint` fail when the index is stale.
- Runtime artifact vocabulary guard coverage was tightened:
  - `scripts/guard-runtime-artifact-vocab.test.mjs` proves stale book-as-runtime-artifact fixtures
    fail the guard;
  - vocabulary guards now tolerate temporary files removed between directory listing and read,
    avoiding false failures during parallel guard/test execution.
- Runtime proof trust tests now cover additional H-risk edge cases:
  - runtime config digest changes when the install manifest changes, not only when runtime config
    text changes;
  - runtime probe fails closed and persists no accepted `negative_fixture` when the install
    manifest belongs to another project root;
  - trusted proof payload tampering after digest creation leaves blocking bindings `stale`;
  - MCP `rms.probe_runtime` persists proof timestamps from the server-observed clock and ignores a
    malicious caller-supplied `inspectedAt`;
  - lifecycle uninstall refuses symlinked and hardlinked install manifests before platform hook
    removal, preserving hook config and proving the remove callback is not called.
- Specs and executable schema wording were aligned:
  - runtime proof `configDigest` wording now distinguishes the static runtime profile digest from
    the observed runtime config/profile/manifest snapshot digest;
  - the hooks-first specs workbench now reflects partial implementation and `rms.probe_runtime` as
    the trusted acquisition path.
- Verification:
  - `corepack pnpm guard:artifact-vocab:test` passed.
  - `corepack pnpm guard:risk-vocab:test` passed.
  - `corepack pnpm guard:docs-index` passed.
  - `corepack pnpm exec vitest run --root . packages/core/test/install.test.ts packages/core/test/runtime-probe.test.ts packages/core/test/runtime-bindings.test.ts packages/mcp-server/test/index.test.ts` passed:
    4 files, 95 tests.
  - `corepack pnpm lint` passed with the docs index guard included.

Sprint 31 result:

- Runtime binding writes now have explicit non-regression coverage for canonical `run-set.json`
  preservation:
  - `inspectRuntimeWithTrustedProofs()` may add or replace only the selected
    `runtimeCapabilities[target]` entry while preserving existing capabilities for other targets;
  - `bindRuntime()` may add or replace only `runtimeBindings`;
  - the test proves `project`, `intent`, `policy`, `route`, `events`, `evidence`, `subagents`, and
    `finalization` survive runtime inspection plus binding unchanged.
- The new preservation fixture also validates the trusted proof timing contract by using a proof
  observed after capability inspection and before binding inspection.
- Verification:
  - `corepack pnpm exec vitest run --root . packages/core/test/runtime-bindings.test.ts` passed:
    26 tests.

Sprint 32 result:

- The Sprint 31 false-confidence gap is now closed:
  - the core preservation test now seeds a preexisting `runtimeCapabilities.claude` entry before
    inspecting and binding `codex`;
  - the test proves the `claude` capability survives unchanged while the selected `codex`
    capability is updated.
- MCP runtime tools now have their own preservation regression:
  - `rms.inspect_runtime` and `rms.bind_runtime` are exercised through `dispatchRequest`;
  - the MCP test seeds `project`, `intent`, `policy`, `route`, `events`, `evidence`, `subagents`,
    `finalization`, and a second runtime capability, then proves all are preserved after MCP
    runtime inspect plus bind.
- Verification:
  - `corepack pnpm exec vitest run --root . packages/core/test/runtime-bindings.test.ts packages/mcp-server/test/index.test.ts`
    passed: 2 files, 73 tests.
  - `corepack pnpm lint` passed.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm test` passed when rerun without concurrent package builds: 27 files, 325 tests.
  - `corepack pnpm build` passed.
  - `corepack pnpm audit --audit-level low` passed: no known vulnerabilities.
  - `corepack pnpm package:readiness` passed in `private-first-advisory` mode with the expected
    private-publication blockers.
  - `corepack pnpm smoke:package` passed.
  - `corepack pnpm smoke:tarball` passed: 6 packages packed, lifecycle hooks added/removed `5/5`,
    lifecycle artifacts written `10`, artifact rollback apply deleted `10`, and MCP exposed 40
    tools.
  - Independent code review passed with no Sprint 32 findings.

Sprint 33 result:

- Runtime binding set writes are now forward-compatible:
  - `RuntimeBindingSetSchema` preserves unknown sibling fields with a catchall, matching the opaque
    extension pattern used by the other RMS sets;
  - `bindRuntime()` now merges the existing `runtimeBindings` object before replacing
    `activeTarget` and `gates`, so future extension fields survive runtime rebinding.
- The core and MCP preservation fixtures now seed `futureRuntimeBindingField` and prove it remains
  unchanged after runtime bind.
- Verification:
  - `corepack pnpm exec vitest run --root . packages/core/test/runtime-bindings.test.ts packages/mcp-server/test/index.test.ts packages/core/test/canonical.test.ts packages/core/test/planning-store.test.ts`
    passed: 4 files, 93 tests.
  - `corepack pnpm lint` passed.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm test` passed: 27 files, 325 tests.

Sprint 34 result:

- Runtime binding preservation tests now also prove stale gates are discarded:
  - the core fixture seeds a preexisting stale `runtimeBindings.gates.pre_tool` before rebinding;
  - the MCP fixture seeds a preexisting obsolete `runtimeBindings.gates.pre_tool` before calling
    `rms.bind_runtime`;
  - both tests assert the extension field survives while the stale gate binding is replaced by a
    newly computed binding.
- Verification:
  - `corepack pnpm exec vitest run --root . packages/core/test/runtime-bindings.test.ts packages/mcp-server/test/index.test.ts`
    passed: 2 files, 73 tests.
  - `corepack pnpm lint` passed.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm test` passed: 27 files, 325 tests.

Sprint 35 result:

- Sprint 34 review found the MCP fixture was obsolete but not explicitly stale.
- The MCP preservation fixture now matches the core fixture:
  - it seeds `runtimeBindings.gates.pre_tool.status = stale`;
  - it seeds `canBlock = false`;
  - it still proves `futureRuntimeBindingField` survives while the stale gate binding is replaced.
- Verification:
  - `corepack pnpm exec vitest run --root . packages/core/test/runtime-bindings.test.ts packages/mcp-server/test/index.test.ts`
    passed: 2 files, 73 tests.
  - `corepack pnpm lint` passed.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm test` passed: 27 files, 325 tests.

Sprint 36 result:

- Temporary test-directory hygiene is now guarded:
  - Biome ignores `.tmp-*` directories, so interrupted MCP temp roots do not pollute lint;
  - runtime artifact and risk vocabulary guards skip `.tmp-*` directories during recursive walks;
  - the runtime artifact vocabulary guard test now creates a stale fixture under `.tmp-*` and
    proves it is ignored while the active scoped fixture is still rejected.
- The leftover generated `.tmp-harness-mcp-log-payload-*` directory was removed after verifying the
  resolved path was inside the HIMA workspace and had a `.tmp-*` leaf name.
- Verification:
  - `corepack pnpm guard:artifact-vocab:test` passed.
  - `corepack pnpm guard:risk-vocab:test` passed.
  - `corepack pnpm lint` passed.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm test` passed: 27 files, 325 tests.
  - Independent Sprint 36 code review passed with no findings.
  - Independent Sprint 36 verification passed for no remaining `.tmp-*` directories, guard tests,
    lint, typecheck, and full tests.
- Autopilot continuity note:
  - the independent verifier closed a stale parent runtime marker while verifying stop conditions;
  - this was not a product completion signal, so the parent and HIMA-scoped autopilot state were
    restored to active execution with `max_iterations = 1000`.

Sprint 37 result:

- MCP runtime digest wording is now aligned with the executable runtime-proof contract:
  - `rms.inspect_runtime` now describes `configDigest` as the observed runtime config content
    digest, not a runtime-profile-only digest;
  - the MCP surface test asserts that public JSON Schema description, so future drift is caught by
    tests instead of relying on manual doc review.
- Verification:
  - `corepack pnpm exec vitest run --root . packages/mcp-server/test/index.test.ts` passed:
    1 file, 47 tests.
  - `corepack pnpm lint` passed.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm test` passed: 27 files, 325 tests.
  - Independent code review passed.
  - Independent verification initially reproduced the known concurrent build/typecheck race while
    other package builds/tests were active; `corepack pnpm typecheck` was rerun alone and passed.

Sprint 38 result:

- Package build/typecheck/test commands now share a reentrant build lock:
  - `scripts/with-build-lock.mjs` serializes commands that clean or consume package `dist/`
    outputs;
  - root `build`, `typecheck`, and `test` hold the lock across their full command chain;
  - package-local build, typecheck, and test scripts use the same lock and skip reacquisition when
    called from an already locked root command;
  - the lock uses a hidden `.tmp-hima-build-lock` directory, writes heartbeat metadata while held,
    removes stale locks only after the stale threshold, and defaults the wait timeout above that
    stale threshold.
- The lock directly addresses the Sprint 37 verifier race where concurrent package builds could
  clean `@harness/core/dist` while CLI typecheck resolved `@harness/core` declarations.
- Verification:
  - `corepack pnpm guard:build-lock:test` passed.
  - the build-lock test covers reentrancy, stale lock recovery, and a live heartbeat lock that must
    not be stolen by a waiter.
  - the build-lock test also covers Windows `node` by-name argument preservation for values with
    spaces and shell metacharacters.
  - `corepack pnpm lint` passed.
  - `corepack pnpm typecheck` and `corepack pnpm test` passed when launched in parallel:
    typecheck completed, and tests passed with 27 files and 325 tests.
  - `corepack pnpm build` passed.
  - `corepack pnpm package:readiness` passed in `private-first-advisory` mode with the expected
    private package blockers.
  - `corepack pnpm audit --audit-level low` passed: no known vulnerabilities.
  - `corepack pnpm smoke:package` passed.
  - `corepack pnpm smoke:tarball` passed: 6 packages packed and MCP exposed 40 tools.
  - no `.tmp-hima-build-lock*` directories remained after verification.
  - Independent review initially blocked stale-timeout, live-lock stealing, and Windows `node`
    by-name argument handling gaps; all were fixed and the final targeted re-review passed.

Sprint 39 result:

- Artifact rollback now supports explicit previous-content restore snapshots:
  - default install manifests remain hash-only, so existing behavior still requires manual restore
    for replaced files;
  - `captureRestoreSnapshots` is opt-in and is accepted only when artifacts are applied and an
    install manifest is written;
  - snapshots are recorded only for previous content already marked as the expected managed HIMA
    catalog artifact with the same kind and id;
  - unmanaged overwritten content and content matching known plaintext-secret patterns are never
    stored in the manifest, even when force-overwritten.
  - unchanged artifacts never receive restore snapshots; idempotent capture manifests keep
    `rollback.action = none` without self-invalidating rollback metadata.
- Rollback apply now reports both `deletedPaths` and `restoredPaths`:
  - delete rollback entries still remove matching managed files;
  - restore rollback entries write the validated snapshot back through the same safe atomic write
    path;
  - restore snapshots are revalidated against the previous hash and managed artifact header before
    planning or applying rollback.
- Lifecycle uninstall now validates a supplied artifact manifest path before existence probing, so
  missing absolute paths outside the project root are rejected instead of becoming a filesystem
  existence oracle.
- CLI and MCP surfaces expose the same contract:
  - CLI: `harness install-artifacts <target> --apply --writeManifest --captureRestoreSnapshots`;
  - MCP: `rms.install_artifacts` / `harness:install_artifacts` with `apply: true`,
    `writeManifest: true`, and `captureRestoreSnapshots: true`;
  - rollback JSON responses include `artifactsRestored` and `restoredPaths`.
- Verification:
  - `corepack pnpm --filter @harness/core build` passed.
  - `corepack pnpm exec vitest run --root . packages/core/test/artifact-install.test.ts
    packages/core/test/artifact-rollback.test.ts packages/core/test/install.test.ts
    packages/cli/test/index.test.ts packages/mcp-server/test/index.test.ts` passed:
    5 files, 149 tests.
  - `corepack pnpm lint` passed.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm test` passed: 27 files, 337 tests.
  - `corepack pnpm build` passed.
  - `corepack pnpm package:readiness` passed in `private-first-advisory` mode with the expected
    private package blockers.
  - `corepack pnpm audit --audit-level low` passed: no known vulnerabilities.
  - `corepack pnpm smoke:package` passed.
  - `corepack pnpm smoke:tarball` passed: 6 packages packed and MCP exposed 40 tools.

Sprint 40 result:

- Lifecycle uninstall summaries now distinguish artifact deletes from artifact restores:
  - `uninstallRuntimeLifecycle()` returns `artifactsDeleted` and `artifactsRestored`;
  - CLI human output includes both counts;
  - CLI/MCP JSON expose both arrays through the shared lifecycle result.
- The core lifecycle test now covers a mixed uninstall where rollback restores one replaced managed
  hook artifact from a validated snapshot and deletes the remaining newly installed hook artifacts
  before platform hooks are removed.
- Verification:
  - `corepack pnpm exec vitest run --root . packages/core/test/install.test.ts
    packages/cli/test/index.test.ts packages/mcp-server/test/index.test.ts` passed.
  - `corepack pnpm lint` passed.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm test` passed: 27 files, 338 tests.
  - `corepack pnpm build` passed.
  - `corepack pnpm package:readiness` passed in `private-first-advisory` mode with the expected
    private package blockers.
  - `corepack pnpm audit --audit-level low` passed: no known vulnerabilities.
  - `corepack pnpm smoke:package` passed.
  - `corepack pnpm smoke:tarball` passed: 6 packages packed and MCP exposed 40 tools.

Sprint 41 result:

- Package and tarball smoke coverage now exercise restore snapshots through real CLI execution:
  - `scripts/package-smoke.mjs` seeds a previous managed `gate-policy` hook, installs hooks with
    `--captureRestoreSnapshots`, verifies the written manifest captured the previous managed hook
    content, then rolls back and proves that hook is restored instead of deleted;
  - `scripts/package-tarball-smoke.mjs` repeats the same restore-snapshot path from a temporary
    consumer project using the packed CLI tarball, so the packaged release surface is covered too;
  - both smokes continue to cover the default delete rollback path for newly installed skill
    artifacts;
  - the restore checks derive non-seeded hook paths from the install manifest, compare the deleted
    path set exactly after path normalization, and assert that only the preexisting `gate-policy`
    hook is restored.
- Verification:
  - `corepack pnpm exec biome check scripts/package-smoke.mjs scripts/package-tarball-smoke.mjs`
    passed.
  - `corepack pnpm build` passed.
  - `corepack pnpm smoke:package` passed with `restoreApplyArtifactsWritten = 8`,
    `restoreRollbackDeleted = 7`, and `restoreRollbackRestored = 1`.
  - `corepack pnpm smoke:tarball` passed: 6 packages packed, MCP exposed 40 tools, and the tarball
    CLI path reported `restoreInstallArtifactsWritten = 8`, `restoreRollbackDeleted = 7`, and
    `restoreRollbackRestored = 1`.

Sprint 42 result:

- Trusted runtime proof freshness now includes explicit runtime profile version binding:
  - canonical runtime profiles expose `runtimeVersion` values for Claude, Codex, and Hermes;
  - static runtime profile digests include `runtimeVersion`;
  - trusted runtime probe proof payloads and `proofDigest` computation include `runtimeVersion`;
  - `bindRuntime()` treats accepted blocking proofs as stale when proof `runtimeVersion` differs
    from the stored runtime capability version;
  - observed runtime config digests include target identity, `runtimeVersion`, runtime profile
    digest, runtime config file digest, and install manifest digest.
- Runtime capability and binding persistence now carries `runtimeVersion` through the core schema,
  CLI inspection/probe outputs, MCP `rms.inspect_runtime`, and MCP `rms.probe_runtime`.
- Caller-submitted proof payloads remain candidate-only:
  - CLI `--hooksJson` and MCP `rms.inspect_runtime` may receive trusted-looking fields such as
    `verifier`, `runtimeVersion`, and `proofDigest`;
  - the core strips verifier-bound fields from untrusted input before writing `run-set.json`;
  - only `probeRuntime()` / `rms.probe_runtime` can mint accepted trusted proof records.
- Specs were synchronized:
  - `docs/conception/04-runtime-bindings-spec.md` now documents canonical runtime profile versions
    and `runtimeVersion`-bound proof requirements;
  - `docs/conception/09-cli-commands-spec.md` documents `--runtimeVersion` and versioned digest
    output;
  - `docs/conception/11-mcp-tools-spec.md` documents MCP runtime version input and trusted proof
    requirements;
  - `docs/propositions/pipeline-fractal-v4-specs/0002-runtime-probe-and-freshness.spec.md` now
    includes runtime-version invalidation in the probe trust model.
- Verification:
  - targeted runtime/CLI/MCP suite passed: 6 files, 156 tests.
  - `corepack pnpm docs:index` passed.
  - `corepack pnpm lint` passed.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm test` passed: 27 files, 340 tests.
  - `corepack pnpm build` passed.
  - `corepack pnpm package:readiness` passed in `private-first-advisory` mode with the expected
    private package blockers.
  - `corepack pnpm audit --audit-level low` passed: no known vulnerabilities.
  - `corepack pnpm smoke:package` passed with `restoreRollbackDeleted = 7` and
    `restoreRollbackRestored = 1`.
  - `corepack pnpm smoke:tarball` passed: 6 packages packed, MCP exposed 40 tools, and the tarball
    CLI path reported `restoreInstallArtifactsWritten = 8`, `restoreRollbackDeleted = 7`, and
    `restoreRollbackRestored = 1`.
  - `git diff --check` passed.
  - recursive `.tmp-*` scan returned no leftover temporary directories.

Sprint 43 result:

- Route-required runtime binding handling is now a pure assessment over the canonical binding table:
  - `bindRuntime()` remains the only writer for the active target's complete
    `GateType -> RuntimeBinding` map;
  - `assessRouteRuntimeBindings()` derives required gates from baseline risk policy, planned
    delegation, and explicit per-risk policy overrides;
  - convergence now calls this helper instead of keeping private required-gate logic;
  - no route-specific binding rows or second persisted binding table were added.
- Required-gate derivation is DRY:
  - `mergeRequiredGates()` deduplicates baseline, delegation, and per-risk override gates while
    preserving first-seen order;
  - planned subagents after an initial runtime bind now cause convergence to assess
    `subagent_start` and `subagent_stop` against the existing binding table;
  - Codex `subagent_stop` remains a `missing` runtime gap rather than becoming native through a
    route requirement.
- Runtime assessment tests were hardened:
  - direct assessment covers `capability_unknown` and native non-blocking bindings when blocking is
    required;
  - supported non-blocking hooks bind native without blocking proof;
  - forged proof input cannot make unsupported Codex `subagent_stop` native;
  - convergence covers policy-required gates, delegated gates, and deduped policy/delegation
    requirements.
- Specs were synchronized:
  - the runtime binding spec now states route-required handling is assessment, not stored
    synthesis;
  - the runtime probe freshness spec no longer requires a second synthesized binding table;
  - RMS set docs now describe derived route-required gates for executable v1;
  - the core API spec names `assessRouteRuntimeBindings()` as a pure read model.
- Verification:
  - `corepack pnpm exec vitest run --root . packages/core/test/baseline-policy.test.ts
    packages/core/test/convergence.test.ts packages/core/test/runtime-bindings.test.ts` passed:
    3 files, 53 tests.
  - `corepack pnpm docs:index` passed.
  - `corepack pnpm lint` passed.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm test` passed: 27 files, 349 tests.
  - `corepack pnpm build` passed.
  - `corepack pnpm package:readiness` passed in `private-first-advisory` mode with the expected
    private package blockers.
  - `corepack pnpm audit --audit-level low` passed: no known vulnerabilities.
  - `corepack pnpm smoke:package` passed.
  - `corepack pnpm smoke:tarball` passed: 6 packages packed and MCP exposed 40 tools.
  - `git diff --check` passed.
  - recursive `.tmp-*` scan returned no leftover temporary directories.
  - Independent code review passed for the executable implementation and flagged stale docs; the
    route freshness action, RuntimeBindingSet storage projection, and old route gate-list wording
    were corrected.
  - Independent verifier passed the Sprint 43 claim that route-required runtime binding handling is
    a pure assessment over `run-set.json.runtimeBindings`, not a second persisted binding table.
  - Post-review doc verification passed: `corepack pnpm docs:index`, `corepack pnpm lint`, and
    `git diff --check`.

Sprint 44 result:

- Route-required runtime binding assessment is now directly inspectable without reading convergence
  output:
  - CLI command: `harness runtime assess-route [--root <path>] [--json]`;
  - MCP tool: `rms.assess_route_runtime_bindings`;
  - both surfaces are read-only diagnostics over current risk, route, planned subagents, policy
    overrides, and `run-set.json.runtimeBindings`.
- The diagnostic output includes route context and the convergence read model:
  - `riskClass`;
  - `activeTarget`;
  - `healthy`;
  - `requiredGates`;
  - `assessments`;
  - `gaps`.
- Tests now prove delegated route gaps are operator-visible:
  - the CLI JSON surface exposes `subagent_start` and `subagent_stop` as required gates for a
    delegated M-risk route;
  - the CLI human surface prints the active target, risk class, required gates, and missing
    `subagent_stop` runtime binding;
  - the MCP tool exposes the same assessment while leaving `runtimeBindings`, `events`, and
    `finalization` unchanged.
- Specs were synchronized:
  - `docs/conception/09-cli-commands-spec.md` documents `harness runtime assess-route`;
  - `docs/conception/11-mcp-tools-spec.md` documents `rms.assess_route_runtime_bindings`;
  - both specs state that the output is a `RuntimeBindingHealth` read model enriched with
    `riskClass` and `activeTarget`.
- Verification:
  - targeted CLI/MCP suite passed: 2 files, 103 tests.
  - `corepack pnpm docs:index` passed.
  - `corepack pnpm lint` passed.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm test` passed: 27 files, 352 tests.
  - `corepack pnpm build` passed.
  - `corepack pnpm package:readiness` passed in `private-first-advisory` mode with the expected
    private package blockers.
  - `corepack pnpm audit --audit-level low` passed: no known vulnerabilities.
  - `corepack pnpm smoke:package` passed with `applyArtifactsWritten = 10`,
    `restoreRollbackDeleted = 7`, and `restoreRollbackRestored = 1`.
  - `corepack pnpm smoke:tarball` passed: 6 packages packed and MCP exposed 41 tools.
  - `git diff --check` passed.
  - recursive `.tmp-*` scan returned no leftover temporary directories.

Sprint 45 result:

- The packaged CLI/tarball path now proves `harness runtime assess-route --json` against a real
  temporary `.planning/` project:
  - `scripts/package-tarball-smoke.mjs` resolves the installed tarball `@harness/core` and
    `@harness/cli` entries from the temporary consumer project;
  - the smoke initializes a route assessment target through the packaged CLI;
  - the smoke installs Codex hooks, probes Codex runtime, binds runtime gates, and then adjusts the
    temporary project to an M-risk delegated route through the packaged core planning API;
  - the command under test is executed through the installed tarball CLI, not the source test
    harness.
- The smoke asserts the operational contract:
  - `riskClass` is `M`;
  - `activeTarget` is `codex`;
  - required gates include `user_prompt`, `pre_tool`, `stop`, `subagent_start`, and
    `subagent_stop`;
  - `pre_tool` is a native enforceable blocking binding after trusted probe verification;
  - Codex `subagent_stop` remains a missing, non-enforceable, route-required binding gap;
  - every file in `.planning/` is byte-for-byte identical before and after
    `runtime assess-route`, proving the packaged command is read-only across the full planning
    tree.
- The tarball smoke summary now includes:
  - `routeAssessRequiredGates`;
  - `routeAssessGaps`;
  - `routeAssessSubagentStopBlocked`;
  - `routeAssessReadOnly`.
- Verification:
  - `corepack pnpm docs:index` passed.
  - `corepack pnpm lint` passed.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm test` passed: 27 files, 352 tests.
  - `corepack pnpm build` passed.
  - `corepack pnpm smoke:package` passed with `applyArtifactsWritten = 10`,
    `restoreRollbackDeleted = 7`, and `restoreRollbackRestored = 1`.
  - `corepack pnpm package:readiness` passed in `private-first-advisory` mode with the expected
    private package blockers.
  - `corepack pnpm audit --audit-level low` passed: no known vulnerabilities.
  - `corepack pnpm smoke:tarball` passed: 6 packages packed, 41 MCP tools exposed,
    `routeAssessRequiredGates = 7`, `routeAssessGaps = 2`, `routeAssessSubagentStopBlocked = true`,
    and `routeAssessReadOnly = true`.
  - `git diff --check` passed.
  - recursive `.tmp-*` scan returned no leftover temporary directories.

Sprint 46 result:

- The packaged MCP server/tarball path now proves `rms.assess_route_runtime_bindings` through
  JSON-RPC `tools/call` against a real temporary `.planning/` project:
  - the tarball smoke reuses the same packaged core + CLI fixture path as the CLI assessment smoke;
  - the MCP process is started from the installed tarball entrypoint in the temporary consumer
    project;
  - the request uses canonical MCP shape:
    `tools/call -> { name: "rms.assess_route_runtime_bindings", arguments: { root } }`;
  - assertions read `result.structuredContent`, not the JSON text block.
- The smoke asserts the same operational contract as the CLI route diagnostic:
  - `riskClass` is `M`;
  - `activeTarget` is `codex`;
  - required gates include `user_prompt`, `pre_tool`, `stop`, `subagent_start`, and
    `subagent_stop`;
  - `pre_tool` is a native enforceable blocking binding;
  - Codex `subagent_stop` remains a missing, non-enforceable, route-required binding gap;
  - every file in `.planning/` is byte-for-byte identical before and after the MCP tool call,
    proving the packaged MCP tool is read-only across the full planning tree.
- The tarball smoke summary now includes:
  - `mcpRouteAssessRequiredGates`;
  - `mcpRouteAssessGaps`;
  - `mcpRouteAssessSubagentStopBlocked`;
  - `mcpRouteAssessReadOnly`.
- Verification:
  - `corepack pnpm docs:index` passed.
  - `corepack pnpm lint` passed.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm test` passed: 27 files, 352 tests.
  - `corepack pnpm build` passed.
  - `corepack pnpm smoke:package` passed with `applyArtifactsWritten = 10`,
    `restoreRollbackDeleted = 7`, and `restoreRollbackRestored = 1`.
  - `corepack pnpm package:readiness` passed in `private-first-advisory` mode with the expected
    private package blockers.
  - `corepack pnpm audit --audit-level low` passed: no known vulnerabilities.
  - `corepack pnpm smoke:tarball` passed: 6 packages packed, 41 MCP tools exposed,
    `routeAssessRequiredGates = 7`, `routeAssessGaps = 2`, `routeAssessSubagentStopBlocked = true`,
    `routeAssessReadOnly = true`, `mcpRouteAssessRequiredGates = 7`,
    `mcpRouteAssessGaps = 2`, `mcpRouteAssessSubagentStopBlocked = true`, and
    `mcpRouteAssessReadOnly = true`.
  - `git diff --check` passed.
  - recursive `.tmp-*` scan returned no leftover temporary directories.

Sprint 47 result:

- Package readiness now has an explicit strict opt-in without changing the default
  private-first advisory contract:
  - `summarizePackageReadiness(..., { strict: true })` returns
    `mode = "release-gate-strict"` and gates `ok` on `releaseReady`;
  - default readiness still returns `ok = true` for the current private-first package set;
  - default readiness returns `mode = "release-gate"` and `ok = false` if any non-private
    blocker appears;
  - the script accepts strict mode through `--strict`,
    `HIMA_PACKAGE_READINESS_STRICT=1`, or `HIMA_PACKAGE_READINESS_MODE=strict`.
- The release readiness policy now documents the distinction between advisory
  private-first CI checks and explicit strict release-candidate checks.
- Verification:
  - targeted package readiness tests passed: 1 file, 5 tests.
  - `corepack pnpm docs:index` passed.
  - `corepack pnpm lint` passed.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm test` passed: 27 files, 355 tests.
  - `corepack pnpm build` passed.
  - `corepack pnpm package:readiness` passed in `private-first-advisory` mode with expected
    private package blockers.
  - `node scripts/package-readiness.mjs --strict` returned the expected strict non-zero result:
    `mode = "release-gate-strict"`, `ok = false`, and `releaseReady = false`.
  - `corepack pnpm audit --audit-level low` passed: no known vulnerabilities.
  - `corepack pnpm smoke:package` passed.
  - `corepack pnpm smoke:tarball` passed: 6 packages packed, 41 MCP tools exposed, and route
    assessment read-only checks passed for CLI and MCP.
  - `git diff --check` passed.
  - recursive `.tmp-*` scan returned no leftover temporary directories.

Sprint 48 result:

- Strict package readiness is now exposed as a canonical workspace script:
  - `pnpm package:readiness` remains the default private-first advisory command;
  - `pnpm package:readiness:strict` runs the same readiness model with `--strict`;
  - the root package manifest is covered by a regression test so the strict script does not drift
    from the executable entrypoint.
- The release readiness policy now names the strict workspace script as the operator-facing command
  while preserving the CI contract that default package readiness stays advisory until a public
  release decision exists.
- Verification:
  - targeted package readiness tests passed: 1 file, 6 tests.
  - `corepack pnpm docs:index` passed.
  - `corepack pnpm lint` passed.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm test` passed: 27 files, 356 tests.
  - `corepack pnpm build` passed.
  - `corepack pnpm package:readiness` passed in `private-first-advisory` mode with expected
    private package blockers.
  - `corepack pnpm package:readiness:strict` returned the expected strict non-zero result:
    `mode = "release-gate-strict"`, `ok = false`, and `releaseReady = false`.
  - `corepack pnpm audit --audit-level low` passed: no known vulnerabilities.
  - `corepack pnpm smoke:package` passed.
  - `corepack pnpm smoke:tarball` passed: 6 packages packed, 41 MCP tools exposed, and route
    assessment read-only checks passed for CLI and MCP.
  - `git diff --check` passed.
  - recursive `.tmp-*` scan returned no leftover temporary directories.

Sprint 49 result:

- Package readiness now has executable help text:
  - `node scripts/package-readiness.mjs --help` prints the default advisory mode, strict
    release-candidate mode, and strict environment variables;
  - help exits before manifest scanning, so it is safe for discovery and automation;
  - usage text is exported for regression testing instead of being duplicated in docs.
- The release readiness policy now points operators to the executable help summary.
- Verification:
  - targeted package readiness tests passed: 1 file, 7 tests.
  - `node scripts/package-readiness.mjs --help` exited successfully and printed the strict/advisory
    mode summary.
  - `corepack pnpm docs:index` passed.
  - `corepack pnpm lint` passed.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm test` passed: 27 files, 357 tests.
  - `corepack pnpm build` passed.
  - `corepack pnpm package:readiness` passed in `private-first-advisory` mode with expected
    private package blockers.
  - `corepack pnpm package:readiness:strict` returned the expected strict non-zero result:
    `mode = "release-gate-strict"`, `ok = false`, and `releaseReady = false`.
  - `corepack pnpm audit --audit-level low` passed: no known vulnerabilities.
  - `corepack pnpm smoke:package` passed.
  - `corepack pnpm smoke:tarball` passed: 6 packages packed, 41 MCP tools exposed, and route
    assessment read-only checks passed for CLI and MCP.

Sprint 50 result:

- Package readiness now has real process-level test coverage in addition to imported function
  tests:
  - the test suite spawns `node scripts/package-readiness.mjs --help` and verifies usage output;
  - it spawns default readiness and verifies `private-first-advisory` exits successfully;
  - it spawns `--strict` and environment-driven strict readiness and verifies the expected non-zero
    `release-gate-strict` result.
- Verification:
  - targeted package readiness tests passed: 1 file, 8 tests.
  - `node scripts/package-readiness.mjs -h` exited successfully.
  - `HIMA_PACKAGE_READINESS_MODE=strict node scripts/package-readiness.mjs` returned the expected
    strict non-zero result.
  - `corepack pnpm docs:index` passed.
  - `corepack pnpm lint` passed.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm test` passed: 27 files, 358 tests.
  - `corepack pnpm build` passed.
  - `corepack pnpm package:readiness` passed in `private-first-advisory` mode with expected
    private package blockers.
  - `corepack pnpm package:readiness:strict` returned the expected strict non-zero result:
    `mode = "release-gate-strict"`, `ok = false`, and `releaseReady = false`.
  - `corepack pnpm audit --audit-level low` passed: no known vulnerabilities.
  - `corepack pnpm smoke:package` passed.
  - `corepack pnpm smoke:tarball` passed: 6 packages packed, 41 MCP tools exposed, and route
    assessment read-only checks passed for CLI and MCP.
  - `git diff --check` passed.
  - recursive `.tmp-*` scan returned no leftover temporary directories.

Sprint 51 result:

- Package readiness help now names the canonical workspace scripts:
  - `pnpm package:readiness` for default advisory private-first readiness;
  - `pnpm package:readiness:strict` for strict release-candidate readiness;
  - the direct `node scripts/package-readiness.mjs` usage remains documented for script-level
    execution.
- The process-level help test now verifies the workspace strict script is present in real `--help`
  output.
- Verification:
  - targeted package readiness tests passed: 1 file, 8 tests.
  - `node scripts/package-readiness.mjs --help` exited successfully and printed the workspace script
    commands.
  - `corepack pnpm docs:index` passed.
  - `corepack pnpm lint` passed.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm test` passed: 27 files, 358 tests.
  - `corepack pnpm build` passed.
  - `corepack pnpm package:readiness` passed in `private-first-advisory` mode with expected
    private package blockers.
  - `corepack pnpm package:readiness:strict` returned the expected strict non-zero result:
    `mode = "release-gate-strict"`, `ok = false`, and `releaseReady = false`.
  - `corepack pnpm audit --audit-level low` passed: no known vulnerabilities.
  - `corepack pnpm smoke:package` passed.
  - `corepack pnpm smoke:tarball` passed: 6 packages packed, 41 MCP tools exposed, and route
    assessment read-only checks passed for CLI and MCP.
  - `git diff --check` passed.
  - recursive `.tmp-*` scan returned no leftover temporary directories.

Sprint 52 result:

- Package readiness now fails closed for unknown CLI arguments:
  - misspelled flags such as `--strcit` are rejected before manifest scanning;
  - the script prints the usage text to stderr and exits with status `2`;
  - `--help` / `-h`, `--strict`, and strict environment variables keep their previous behavior.
- Process-level coverage now verifies the unknown-argument failure path.
- Verification:
  - targeted package readiness tests passed: 1 file, 8 tests.
  - `node scripts/package-readiness.mjs --strcit` returned exit code `2` with the expected unknown
    option message.
  - `node scripts/package-readiness.mjs --help` passed.
  - `corepack pnpm docs:index` passed.
  - `corepack pnpm lint` passed: Biome checked 106 files.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm test` passed: 27 files, 358 tests.
  - `corepack pnpm build` passed.
  - `corepack pnpm package:readiness` passed in `private-first-advisory` mode with 6 intentional
    private-package blockers and 17 metadata/workspace-protocol warnings.
  - `corepack pnpm package:readiness:strict` returned the expected exit code `1` in
    `release-gate-strict` mode while packages remain private.
  - `corepack pnpm audit --audit-level low` passed with no known vulnerabilities.
  - `corepack pnpm smoke:package` passed.
  - `corepack pnpm smoke:tarball` passed: 6 packages packed, 41 MCP tools observed, and route-assess
    read-only checks preserved.
  - `git diff --check` passed.
  - Root `.tmp-*` scan returned no leftover temporary directories.

Sprint 53 result:

- Claude Code now has an executable hook-output contract:
  - Claude runtime profile commands append `--format claude`;
  - `harness hook` keeps the native HIMA JSON output by default and emits Claude Code-compatible
    `continue` / `hookSpecificOutput` JSON only when `--format claude` is requested;
  - adapter-generated `.claude/settings.json` now registers the Claude-specific command shape.
- Real Claude Code smoke testing found and closed two runtime bugs:
  - prior smoke showed Claude accepted the task while rejecting every hook JSON response with
    `Hook JSON output validation failed`;
  - the fixed smoke produced zero hook validation failures and showed Claude accepting
    `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, and `Stop` hook responses;
  - review then tightened the Claude contract: non-blocked hooks no longer emit unsupported
    top-level `decision: "approve"`, `PreToolUse` blocks are represented through
    `hookSpecificOutput.permissionDecision = "deny"`, and no ordinary tool denial uses global
    `continue: false`;
  - HIMA was also dropping Claude's snake_case hook payload fields, so `PreToolUse:Bash` looked
    like an empty non-write event; snake_case payload normalization now preserves hook metadata,
    `tool_name`, `tool_input`, `tool_output`, prompt content, and transcript/session identifiers;
  - shell write detection now recognizes common Bash/PowerShell write commands and extracts
    redirection / `Out-File` targets before policy evaluation.
- Real smoke evidence:
  - `claude-live-format-20260504-003207` proved the Claude output schema was accepted:
    `CLAUDE_EXIT_CODE=0`, `HOOK_VALIDATION_FAILURES=0`, and `SMOKE_FILE_CONTENT=HIMA_CLAUDE_TOOL_OK`;
  - `claude-live-normalized-20260504-003728` proved payload normalization and shell write policy:
    `CLAUDE_EXIT_CODE=0`, `HOOK_VALIDATION_FAILURES=0`, `NON_WRITE_PRE_TOOL_EVENTS=0`,
    `WRITE_ZONE_PRE_TOOL_EVENTS=1`, and `SMOKE_FILE_CONTENT=HIMA_CLAUDE_TOOL_OK`;
  - `claude-live-contract-20260504-005351` proved the post-review Claude contract:
    `CLAUDE_EXIT_CODE=0`, `HOOK_VALIDATION_FAILURES=0`, `CLAUDE_CONTRACT_FAILURES=0`,
    `NON_WRITE_PRE_TOOL_EVENTS=0`, `WRITE_ZONE_PRE_TOOL_EVENTS=1`, and
    `SMOKE_FILE_CONTENT=HIMA_CLAUDE_TOOL_OK`;
  - the normalized run persisted five gate events in the isolated `.planning/run-set.json`:
    `session_start allow`, `user_prompt allow`, `pre_tool warn`, `post_tool allow`, and `stop warn`.
- Runtime logs are stored under `.planning/loop/runtime-smoke/`:
  - `claude-live-contract-20260504-005351.stream.jsonl`;
  - `claude-live-contract-20260504-005351.debug.log`;
  - `claude-live-contract-20260504-005351.stderr.log`;
  - `claude-live-contract-20260504-005351.summary.log`;
  - `claude-live-normalized-20260504-003728.stream.jsonl`;
  - `claude-live-normalized-20260504-003728.debug.log`;
  - `claude-live-normalized-20260504-003728.stderr.log`;
  - `claude-live-normalized-20260504-003728.summary.log`.
- Verification:
  - targeted runtime tests passed after review fixes: 5 files, 114 tests.
  - real Claude Code smoke passed twice after rebuild, with the final normalized run proving no
    hook JSON validation failures and no non-write `pre_tool` regression.
  - `corepack pnpm docs:index` passed.
  - `corepack pnpm lint` passed: Biome checked 106 files and both vocabulary guards passed.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm test` passed: 27 files, 377 tests.
  - `corepack pnpm build` passed.
  - `corepack pnpm package:readiness` passed in `private-first-advisory` mode with 6 intentional
    private-package blockers and 17 metadata/workspace-protocol warnings.
  - `corepack pnpm package:readiness:strict` returned the expected exit code `1` in
    `release-gate-strict` mode while packages remain private.
  - `corepack pnpm audit --audit-level low` passed with no known vulnerabilities.
  - `corepack pnpm smoke:package` passed.
  - `corepack pnpm smoke:tarball` passed: 6 packages packed, 41 MCP tools observed, and route-assess
    read-only checks preserved.
  - `git diff --check` passed.
  - Root `.tmp-*` scan returned no leftover temporary directories.

Sprint 54 result:

- The Claude Code benchmark is now a real isolated product loop instead of a one-shot smoke:
  - `scripts/claude-hima-stress-benchmark.mjs` creates a fresh workspace under
    `.planning/loop/benchmarks/hima-stress-app/<timestamp>-iteration-###/`;
  - the runner initializes HIMA, transitions the run to `build/Execute`, installs Claude hooks with
    an explicit local `node packages/cli/dist/index.js` command prefix, runs Claude Code with project
    settings and an empty strict MCP config, then executes workspace test/build checks;
  - every iteration persists `prompt.md`, `preflight.json`, `settings.snapshot.json`, raw Claude
    stream/debug/stderr logs, the isolated `.planning/run-set.json`, and a markdown benchmark
    artifact under `.omx/artifacts/`.
- Iterations 3-9 formed a closed benchmark-feedback loop:
  - iteration 3 proved Claude could build the offline HIMA Stress Console, but exposed false PASS
    accounting and Windows `npm.cmd` spawn failures in post-run checks;
  - iteration 4 proved direct Node package checks and strict package-check accounting, but exposed
    absolute-path write-zone false positives and documentary force-signal false positives;
  - iteration 5 proved absolute path normalization and content-safe force-signal handling, leaving
    only missing Run Set evidence at `stop`;
  - iteration 6 proved Claude can add accepted `ci_green`, `sast_clean`, and `secrets_clean`
    evidence, but exposed `/dev/null` redirection as a false write target;
  - iteration 7 proved evidence and `stop allow`, but exposed `scripts/build.js` as a legitimate
    small-app build artifact outside the Execute write zones;
  - iteration 8 proved `scripts/` support, but exposed `2>&1` file-descriptor merge tokens as false
    write targets;
  - iteration 9 passed cleanly with Claude exit `0`, hook validation failures `0`, invalid Claude
    contract markers `0`, package check failures `0`, gate warnings `0`, gate blocks `0`, and
    `stop allow` after accepted evidence.
- Gate policy hardening from real Claude output:
  - `pre_tool` now normalizes absolute project-root paths, including Git Bash `/c/...` paths, before
    comparing them with relative write zones;
  - shell write detection now recognizes Bash and PowerShell write commands while ignoring null
    device redirections and file-descriptor merge tokens;
  - force-signal promotion for writes is based on target paths and shell command text, not arbitrary
    file content such as UI labels mentioning auth, PII, schema, migrations, or infra;
  - `build/Execute` write zones now include small offline-app roots (`index.html`, `styles.css`,
    `app.js`, `build.js`, `package.json`, README/report files, `test/`, and `scripts/`) while keeping
    pre-build phases constrained.
- Verification:
  - targeted gate tests passed after policy fixes: 22 files, 261 tests.
  - `corepack pnpm build` passed after regenerating the hook CLI used by Claude.
  - real Claude Code benchmark iteration 9 passed with zero hook/policy/package failures and
    accepted stop evidence.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm test` passed: 27 files, 394 tests.
  - `corepack pnpm lint` passed after Biome import organization fixes.

Sprint 55 result:

- The Claude Code POC now has an explicit skill-first development entrypoint:
  - `hima-enter` is generated from the operational catalog like other portable skills;
  - it is scoped to development-mode entry, risk/mode selection, route binding, and initial
    verification, with OMX explicitly out of scope;
  - generated artifacts remain limited to skills, hooks, and subagents.
- The kernel now exposes a single state mutation for development entry:
  - core service `enterDevelopment()` binds phase, subphase, operating mode, risk class, active
    gates, route, intent, and a `DEVELOPMENT_MODE_ENTERED` event;
  - CLI command `harness enter` exposes the same contract for Claude skills and shell usage;
  - MCP tool `rms.enter_development` plus compatibility alias `harness:enter_development` expose the
    same contract for MCP callers.
- Guard behavior:
  - risk policy is enforced at entry time;
  - `bypass` remains allowed only on T/L routes;
  - H/C routes can use `auto` or `pairing`, with human checkpoint requirements still carried by the
    existing risk policy and stop/convergence gates.
- Verification target:
  - targeted core, CLI, MCP, artifact, runtime probe, lifecycle, typecheck, build, lint, and Claude
    runtime probe checks should be rerun after this sprint's edits before claiming package-ready.

Sprint 56 result:

- The first Codex-local 60-iteration pilot exposed a real adapter gap:
  - the project-local `.codex/config.toml` was installed, but managed commands emitted native HIMA
    hook JSON rather than Codex hook JSON;
  - the adapter also used the legacy `[[hooks]] event = ...` TOML shape instead of Codex's documented
    `[[hooks.<Event>]]` / `[[hooks.<Event>.hooks]]` inline hook tables.
- Codex runtime alignment:
  - Codex runtime profile commands now append `--format codex`;
  - `harness hook --format codex` emits Codex-shaped `hookSpecificOutput`, deny, block, and empty
    allow responses instead of leaking internal HIMA fields;
  - the Codex adapter writes official inline TOML hook tables and replaces stale managed HIMA hook
    blocks instead of leaving duplicate hooks behind;
  - runtime probe detection now recognizes official Codex hook tables when deciding whether a gate is
    registered.
- State hygiene fixes from the pilot:
  - `enterDevelopment()` clears old finalization gaps when reopening development mode;
  - convergence ignores historical `post_tool` policy blocks that occurred before the latest
    `DEVELOPMENT_MODE_ENTERED` event.
- Verification:
  - targeted adapter/probe/profile tests passed: 25 tests.
  - targeted CLI/MCP/install/adapter tests passed: 161 tests.

## Remaining Product Gaps

- Documentation outside this implementation log may still need a synchronization pass against the
  executable contracts.
- Verification is local; no remote CI run has been observed.
- The workspace contains many untracked implementation files, so this log verifies the working tree,
  not committed history.
- Public package release remains intentionally blocked: package versions are `0.0.0`, packages remain
  private, repository metadata is not canonicalized, and license remains `UNLICENSED` until a public
  release decision exists.
- Historical and archival docs outside the active guarded scopes still contain old risk vocabulary;
  they need a provenance-aware migration or explicit historical-vocabulary note.
- Proposal-era docs outside the Sprint 23-29 scopes still need a pass to align RMS set contracts,
  CLI parsing, MCP boundary rules, and runtime proof trust with the executable implementation.

## Next Sprint Recommendation

Move from RMS contract hardening to release/runtime polish:

1. Wire strict readiness into CI only after repository URL/license/visibility decisions exist.
2. Continue docs synchronization for proposal-era references that describe stale hook or RMS
   contract details.
3. Add remote CI observation once a remote is available; current evidence remains local.
4. Run a provenance-aware archive/business-doc migration for old risk vocabulary, or add explicit
   historical mapping notes where preserving the old wording is intentional.
