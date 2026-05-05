# MCP Tools Specification - @harness/mcp-server

> Status: implementation-aligned executable contract
> Package: `@harness/mcp-server`
> Source of truth: `packages/mcp-server/src/index.ts` exports `getMcpToolSurface()`
> Verification: `packages/mcp-server/test/index.test.ts` checks this file against `tools/list`
> Date: 2026-05-03

---

## 1. Contract

The MCP server is the single machine interface for reading and mutating harness state from agents.

The executable tool list is the source of truth. This document is the human-facing contract for that list, and tests fail when a tool exists in code but is missing here.

The canonical namespace is `rms.*`. The `harness:*` namespace remains as a compatibility alias surface for callers that already integrated the earlier MCP contract.

All tools that touch project files operate on `.planning/`. The runtime artifact triad is always `skills`, `hooks`, and `subagents`.

---

## 2. Canonical RMS Tools

| Tool | Purpose |
|------|---------|
| `rms.get_state` | Read the current RMS planning state from the project `.planning/` files. |
| `rms.transition` | Request an RMS planning transition through `@harness/core` `requestTransition()`. |
| `rms.enter_development` | Enter governed development mode by binding phase, subphase, operating mode, risk class, and intent in `.planning/`. |
| `rms.classify_risk` | Classify RMS risk for a changeset through `@harness/core` `classifyRisk()`. |
| `rms.record_evidence` | Append an RMS evidence item to `.planning/run-set.json`. |
| `rms.evaluate_gate` | Evaluate a canonical `GateType` through `@harness/core` `handleHook()`. |
| `rms.inspect_runtime` | Inspect runtime capabilities and store them in `.planning/run-set.json`. |
| `rms.bind_runtime` | Bind inspected runtime capabilities to canonical gates in `.planning/run-set.json`. |
| `rms.probe_runtime` | Read target runtime config and store core-minted trusted runtime proofs in `.planning/run-set.json`. |
| `rms.assess_route_runtime_bindings` | Assess route-required runtime bindings from current `.planning/` state without mutating files. |
| `rms.get_catalog` | Read the operational catalog exposed by `@harness/core`. |
| `rms.generate_artifacts` | Generate catalog-driven skill, hook, and subagent artifacts. Defaults to dry-run; `apply: true` writes. |
| `rms.install_artifacts` | Install catalog-driven skill, hook, and subagent artifacts. Defaults to dry-run; `apply: true` writes, `writeManifest: true` persists rollback metadata, and `captureRestoreSnapshots: true` opt-in stores previous managed artifact content. |
| `rms.install_platform` | Plan/write a platform install manifest and optionally apply target hook config. Defaults to dry-run. |
| `rms.uninstall_platform` | Remove managed platform hook registrations from a validated install manifest. Defaults to dry-run. |
| `rms.repair_platform` | Re-apply managed platform hook registrations from a validated install manifest. Defaults to dry-run. |
| `rms.apply_lifecycle` | Orchestrate platform hook install and catalog artifact install together. Defaults to dry-run. |
| `rms.uninstall_lifecycle` | Orchestrate catalog artifact rollback and managed platform hook removal together. Defaults to dry-run; reports deleted and restored artifact paths separately. |
| `rms.repair_lifecycle` | Orchestrate platform hook repair and catalog artifact repair together. Defaults to dry-run. |
| `rms.rollback_artifacts` | Roll back installed catalog-driven artifacts from an install manifest. Defaults to dry-run; `apply: true` deletes rollbackable files and restores files that carry valid restore snapshots. |
| `rms.runtime_digest` | Compute deterministic runtime profile digests for a target. |
| `rms.evaluate_convergence` | Evaluate run convergence from the current planning project. |
| `rms.close_run` | Close the current run using convergence evaluation and write finalization to `run-set.json`. |

---

## 3. Compatibility Alias Tools

| Tool | Canonical equivalent |
|------|----------------------|
| `harness:get_state` | `rms.get_state` |
| `harness:get_risk_class` | Current risk-state read helper |
| `harness:evaluate_gate` | `rms.evaluate_gate` |
| `harness:record_evidence` | `rms.record_evidence` |
| `harness:log_event` | Append a run event to `.planning/run-set.json` |
| `harness:enter_development` | `rms.enter_development` |
| `harness:get_catalog` | `rms.get_catalog` |
| `harness:generate_artifacts` | `rms.generate_artifacts` |
| `harness:install_artifacts` | `rms.install_artifacts` |
| `harness:install_platform` | `rms.install_platform` |
| `harness:uninstall_platform` | `rms.uninstall_platform` |
| `harness:repair_platform` | `rms.repair_platform` |
| `harness:apply_lifecycle` | `rms.apply_lifecycle` |
| `harness:uninstall_lifecycle` | `rms.uninstall_lifecycle` |
| `harness:repair_lifecycle` | `rms.repair_lifecycle` |
| `harness:rollback_artifacts` | `rms.rollback_artifacts` |
| `harness:runtime_digest` | `rms.runtime_digest` |
| `harness:probe_runtime` | `rms.probe_runtime` |
| `harness:evaluate_convergence` | `rms.evaluate_convergence` |
| `harness:close_run` | `rms.close_run` |

Compatibility aliases are supported at the same level as canonical tools for v0.1. New docs and generated artifacts should use `rms.*`.

---

## 4. Tool Families

| Family | Tools |
|--------|-------|
| State read/write | `rms.get_state`, `rms.transition`, `rms.enter_development`, `rms.evaluate_convergence`, `rms.close_run` |
| Risk | `rms.classify_risk`, `harness:get_risk_class` |
| Evidence and events | `rms.record_evidence`, `harness:log_event` |
| Gates and hooks | `rms.evaluate_gate` |
| Runtime bindings | `rms.runtime_digest`, `rms.inspect_runtime`, `rms.probe_runtime`, `rms.bind_runtime`, `rms.assess_route_runtime_bindings` |
| Catalog artifacts | `rms.get_catalog`, `rms.generate_artifacts`, `rms.install_artifacts`, `rms.rollback_artifacts` |
| Platform lifecycle | `rms.install_platform`, `rms.uninstall_platform`, `rms.repair_platform`, `rms.apply_lifecycle`, `rms.uninstall_lifecycle`, `rms.repair_lifecycle` |

---

## 5. Runtime Proof Inputs

`rms.inspect_runtime` accepts optional `runtimeVersion` plus hook capability overrides under `hooks.<GateType>`. When omitted, known targets use the canonical profile version from `@harness/core`.

Each hook may include `proofs`, an array of runtime probe evidence records:

| Field | Values |
|-------|--------|
| `type` | `config_read`, `manifest_digest`, `dry_run`, `negative_fixture`, `event_fire`, `manual_attestation` |
| `status` | `candidate`, `accepted`, `rejected` |
| `observedAt` | Optional timestamp string |
| `detail` | Optional human-readable detail |
| `verifier` | Optional verifier identifier; ignored for caller-submitted trust |
| `target` | Optional runtime target; ignored for caller-submitted trust |
| `runtimeVersion` | Optional runtime profile version; ignored for caller-submitted trust |
| `gateType` | Optional canonical gate type; ignored for caller-submitted trust |
| `configDigest` | Optional runtime config digest; ignored for caller-submitted trust |
| `result` | Optional verifier result; ignored for caller-submitted trust |
| `proofDigest` | Optional verifier digest; ignored for caller-submitted trust |

Caller-submitted proof records through `rms.inspect_runtime` are candidate-only. Even if a caller sends `status: "accepted"` or trusted-looking fields, the core strips verifier-bound fields and stores the proof as `candidate`.

`rms.probe_runtime` is the trusted acquisition path. It reads the target runtime config, verifies managed hook registrations, emits core-minted `config_read` and `manifest_digest` proofs, and may bind immediately when `bind: true`. The MCP caller cannot supply the probe timestamp; trusted proof `observedAt` is server-observed. Trusted proof `configDigest` is bound to the observed runtime config content plus canonical `runtimeVersion`, runtime profile digest, and install manifest digest, so config, manifest, or profile-version drift requires a fresh probe.

Config registration alone never mints a blocking `negative_fixture` proof. Set `verifyBlockingFixtures: true` to execute managed blocking fixtures; only fixtures that return the documented block result are persisted as accepted `negative_fixture` proofs.

`rms.bind_runtime` treats accepted `negative_fixture` and accepted `event_fire` as native-equivalent blocking proof only when the proof was minted by `core-runtime-probe` and includes `observedAt`, `verifier`, `target`, `runtimeVersion`, `gateType`, `configDigest`, `result`, and `proofDigest`. The proof must be observed no earlier than the stored capability inspection, no later than the binding inspection, and no older than 15 minutes at binding time. `manual_attestation` is stored as evidence but never makes a blocking hook native.

Before persistence, the core redacts known secret patterns in proof `detail`, hook `notes`, and runtime `knownLimitations`.

`rms.assess_route_runtime_bindings` accepts only optional `root` and returns the convergence
`RuntimeBindingHealth` read model with route context: `riskClass`, `activeTarget`, `healthy`,
`requiredGates`, `assessments`, and `gaps`. It derives required gates from current risk, planned
subagents, and policy overrides, then assesses `run-set.json.runtimeBindings` without persisting a
second route-specific binding table.

---

## 6. Safety Rules

Tools that can change files default to planning or dry-run semantics unless their schema contains an explicit apply/write field set by the caller.

`rms.install_artifacts` accepts `captureRestoreSnapshots: true` only with both `apply: true` and
`writeManifest: true`. The server stores snapshots only for previous content that is already the
expected managed HIMA catalog artifact with the same kind and id and does not match known
plaintext-secret patterns. Unmanaged or secret-like overwritten content remains hash-only and
requires manual restore during `rms.rollback_artifacts`.

All tools that accept `root` must keep the resolved project root under the MCP server working directory. This prevents an agent from using the MCP server as an arbitrary filesystem write primitive.

Tool responses are JSON-serializable and redact known secret fields before exposing runtime or event payloads.
