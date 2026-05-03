# 0001 - Hooks-First Runtime Binding Layer Spec

Status: draft v1

## Summary

Pipeline Fractale V4 uses hooks as the primary runtime enforcement surface.
The RMS kernel owns state, policy, guards, evidence, convergence and final
state. MCP exposes that kernel portably. Runtime hooks prove whether a given
agent runtime can actually enforce a gate before, during, or after an action.

This spec exists because the Cycle 04 architecture is kernel-complete but not
hook-verified. The next implementation step must therefore be schema and fixture
planning for hooks before runtime adapter code starts.

## Non-Negotiable Rule

```text
Runtime name is not enforcement proof.
```

A route may claim governed enforcement only from a fresh Binding Set entry
backed by capability evidence. A missing, stale, unknown, `noop_traced`, or
audit-only hard gate cannot produce `DONE_VERIFIED` for M/E/C work.

## Authority Rule

```text
RMS event log and pinned registries
> local transaction and recovery library
> MCP adapter/tools/resources
> runtime adapters/hooks
> skills
> subagents
> books
```

Hooks do not override the event log or registries. Hooks provide enforceability
facts. The RMS decides whether those facts allow, warn, degrade, reroute,
escalate, block, or cap final state.

## Canonical Gates

Only these gates are portable in the MVP:

| Canonical gate | Purpose | Blocking requirement |
|---|---|---|
| `session_start` | Load project, runtime, capability and active-run context. | Not required to block. |
| `user_prompt` | Detect bypass/mode violations and inject risk/policy context. | Required when native hook supports it; missing binding caps or blocks M/E/C. |
| `pre_tool` | Prevent governed writes before side effects. | Required for M/E/C hard enforcement. |
| `post_tool` | Capture evidence and detect forbidden output patterns after action. | Evidence gate only; not equivalent to pre-side-effect enforcement. |
| `stop` | Prevent or cap final closure when evidence/runtime proof is incomplete. | Required for `DONE_VERIFIED` where native stop blocking exists. |
| `subagent_stop` | Require subagent evidence packets and parent intake. | Required where available; absent bindings cap or block by policy. |

## Platform Hook Binding Matrix

| Gate | Claude Code | Codex | Hermes |
|---|---|---|---|
| `session_start` | `SessionStart` | `SessionStart` | `on_session_start` or `session:start` |
| `user_prompt` | `UserPromptSubmit` | `UserPromptSubmit` | `pre_llm_call` |
| `pre_tool` | `PreToolUse` | `PreToolUse` | `pre_tool_call` |
| `post_tool` | `PostToolUse` | `PostToolUse` | `post_tool_call` or `transform_tool_result` |
| `stop` | `Stop` | `Stop` | `on_session_end` plus `on_session_finalize` |
| `subagent_stop` | `SubagentStop` | unavailable: `missing` or `noop_traced` | `subagent_stop` plugin hook |

Codex hooks require:

```toml
[features]
codex_hooks = true
```

Codex `PreToolUse` is a guardrail, not a complete enforcement boundary. The
Binding Set must represent its current limitations explicitly, including
unsupported or incompletely intercepted tool paths.

Hermes has multiple hook surfaces. The spec treats plugin hooks as the primary
portable Hermes surface for CLI and gateway. Shell hooks may be generated as a
deployment convenience only when their blocking semantics match the Binding Set.
Gateway hooks are transport-level extensions, not the MVP default.

## Binding Set Contract

Every required Route Set gate must resolve to exactly one Binding Set entry.
Missing entries are synthesized as `binding_status=missing`; they are not
treated as optional.

Required fields:

```yaml
binding_id: "binding.codex.pre_tool_write_guard"
schema_version: "1.0"
runtime: "claude|codex|hermes"
required_gate: "pre_tool_write_guard"
canonical_gate: "pre_tool"
gate_class: "enforcement|observation|checkpoint|evidence|advisory|transport"
binding_status: "native|fallback|noop_traced|missing|capability_unknown"
capability_status: "available|missing|UNKNOWN|stale|failed_probe"
can_block: true
native_primitive: "PreToolUse"
fallback_strategy: "NOT_APPLICABLE"
fallback_class: "native_equivalent|pre_action_check|post_action_audit|manual_checkpoint|read_only|NOT_APPLICABLE"
fallback_can_block: false
fail_open_risk: false
risk_allowed:
  T: true
  F: true
  M: true
  E: true
  C: true
supervision_allowed:
  bypass: false
  auto_decision: true
  pairing: true
evidence_required:
  - "runtime-binding-check"
trace_event: "RUNTIME_BINDING_CHECKED"
last_inspected_event_id: "evt_capability_001"
freshness_basis:
  invalidated_by:
    - "runtime_config_change"
    - "registry_digest_change"
    - "hook_install_change"
proof:
  probe_id: "probe.codex.pre_tool.deny"
  proof_type: "config_read|dry_run|negative_fixture|event_fire|manual_attestation"
  observed_block_shape: "permissionDecision.deny"
  observed_failure_mode: "UNSET"
notes: "UNSET"
```

No field may be `null`. Unknown values use `UNKNOWN`. Inapplicable values use
`NOT_APPLICABLE`. Not-yet-bound references use `UNSET`.

## Capability Set Contract

The runtime capability probe must produce:

```yaml
runtime: "codex"
runtime_version: "0.128.0"
runtime_surface: "cli|app|gateway|ide|unknown"
os: "windows|wsl|linux|macos|unknown"
hooks_available: true
hooks_feature_flags:
  codex_hooks: true
canonical_hook_subset:
  - "session_start"
  - "user_prompt"
  - "pre_tool"
  - "post_tool"
  - "stop"
missing_hooks:
  - "subagent_stop"
blocking_support:
  user_prompt: true
  pre_tool: true
  stop: true
  subagent_stop: false
limitations:
  - "codex_subagent_stop_unavailable"
  - "codex_pre_tool_incomplete_tool_interception"
detected_at: "2026-05-03T00:00:00Z"
capability_event_id: "evt_capability_001"
freshness:
  registry_digest: "sha256:..."
  config_digest: "sha256:..."
  hook_install_digest: "sha256:..."
```

## Hook Entry Point

Every platform registration calls the canonical command shape:

```text
harness hook <canonical-event-name>
```

Accepted names:

```text
session-start
user-prompt-submit
pre-tool-use
post-tool-use
stop
subagent-stop
```

Processing sequence:

1. Parse the platform payload into a canonical Hook Event.
2. Load active run, Policy Set, Binding Set, Capability Set and Evidence Set.
3. Evaluate the gate against risk, supervision, territory, evidence and runtime
   degradation rules.
4. Append a runtime event before reporting mutation or final-state success.
5. Return platform-native allow, block, warn, context or continuation response.
6. On hook logic error, allow the runtime process to continue only when blocking
   would deadlock or corrupt the platform session; record `HOOK_ERROR` and cap
   final verification until the error is inspected.

## Fail-Open Boundary Versus Fail-Closed RMS

Some platforms intentionally continue when a hook crashes, times out, or returns
unsupported output. PFV4 accepts that platform reality, but it does not treat
that continuation as verified governance.

```text
Platform may fail open to preserve the user session.
RMS must fail closed for governed M/E/C claims.
```

Examples:

| Runtime condition | Route/final effect |
|---|---|
| Hook command crashes during non-governed T/F work. | `warn` or `degrade`; evidence required. |
| Hook command crashes during M/E/C hard enforcement. | Block route activation or cap final state. |
| `pre_tool` cannot see target path before side effect. | Block governed write unless target expansion fallback is native-equivalent. |
| `post_tool` detects violation after action. | Record violation, invalidate evidence, block final verified closure. |
| `stop` cannot hard-block on Hermes. | Do not claim hard stop enforcement; cap final state according to policy. |

## Final-State Ceilings

| Runtime binding condition | Max final state |
|---|---|
| Fresh required native blocking bindings and sufficient evidence. | `DONE_VERIFIED` |
| T/F degraded accepted route. | `DONE_WITH_GAPS` unless optional policy allows verified closure. |
| M native-equivalent fallback with fresh proof and no residual gap. | `DONE_VERIFIED` by explicit policy only. |
| M non-native fallback accepted with residual gap. | `DONE_WITH_GAPS` |
| E/C residual runtime gap. | `BLOCKED_POLICY` |
| Required binding missing, unknown, stale, noop, or audit-only. | `BLOCKED_RUNTIME_MISSING` or route-specific blocked final state. |
| Event append unavailable during block/degrade/final mutation. | No final mutation committed. |

## Installer Requirements

The installer must:

- preserve existing non-harness hooks;
- install one harness command per canonical event where the platform supports
  it;
- set Codex `[features] codex_hooks = true`;
- register Claude `UserPromptSubmit` and Hermes `pre_llm_call`, not only tool
  and stop hooks;
- write an install manifest with file paths, digests, hook commands, scope and
  warnings;
- support dry-run output before writing configs;
- mark unsupported gates in the Binding Set rather than silently omitting them.

## MUST Acceptance Criteria

1. MUST register or explicitly mark all six canonical gates for each runtime.
2. MUST set Codex `[features] codex_hooks = true` during Codex install.
3. MUST represent Codex `subagent_stop` as `missing` or `noop_traced`, never
   `native`.
4. MUST classify any required M/E/C enforcement binding with `can_block=false`
   as degraded or blocked.
5. MUST block M/E/C route activation when a required enforcement binding is
   `missing`, `capability_unknown`, `stale`, or `noop_traced`.
6. MUST block E/C governed mutation when fallback is not `native_equivalent`,
   even with human approval.
7. MUST allow M `native_equivalent` fallback only when
   `fallback_can_block=true` and fresh `RUNTIME_BINDING_CHECKED` evidence
   exists.
8. MUST forbid `DONE_VERIFIED` when required runtime binding evidence is
   missing, stale, conflicted, noop, or audit-only for an M/E/C hard gate.
9. MUST append a runtime event for every hook decision with gate, verdict, run
   id, risk class, binding status, capability status and reason.
10. MUST synthesize `binding_status=missing` when a Route Set requires a gate
    that has no Binding Set entry.
11. MUST use hook-derived capability facts, not runtime name, to decide
    enforceability.
12. MUST preserve blocked final records with affected gate, risk class, binding
    status, rejected fallback, evidence refs and recovery action.

## SHOULD Acceptance Criteria

1. SHOULD expose hook installer dry-run output listing files to write, hooks to
   register and warnings.
2. SHOULD preserve existing user/platform hooks and append harness hooks without
   deleting non-harness entries.
3. SHOULD support project-scope and global-scope installation where the
   platform supports both.
4. SHOULD log `DONE_WITH_GAPS` or blocked records instead of pretending hard
   stop blocking exists where only finalization/audit exists.
5. SHOULD keep platform-specific extensions outside the portable
   `PlatformAdapter` interface.
6. SHOULD make skills and subagents portable but subordinate to hook/runtime
   binding decisions.
7. SHOULD make fixture failures explain the exact binding or freshness field
   that caused the block.

## Fixture Matrix

| ID | Name | Input | Expected |
|---|---|---|---|
| `PFV4-HOOK-001` | Codex hooks flag required | Codex config lacks `codex_hooks=true` | Capability Set has `hooks_available=false`; required M route blocks. |
| `PFV4-HOOK-002` | Codex install enables hooks | Codex install dry-run | Planned config includes `[features] codex_hooks = true`. |
| `PFV4-HOOK-003` | Claude native pre-tool blocks | Claude `PreToolUse`, risk M, forbidden write | `block`; event appended before response. |
| `PFV4-HOOK-004` | Hermes pre-tool blocks | Hermes `pre_tool_call`, risk M, forbidden write | `block` if Binding Set proves pre-action blocking. |
| `PFV4-HOOK-005` | Hermes stop cannot hard block | Hermes finalization, missing evidence | No `DONE_VERIFIED`; capped or blocked final record. |
| `PFV4-HOOK-006` | Codex subagent stop unavailable | Required `subagent_stop`, runtime Codex | `missing`/`noop_traced`; M/E/C hard requirement blocks or caps final. |
| `PFV4-HOOK-007` | Missing binding is not optional | Route requires `pre_tool_write_guard`, binding list empty | `BLOCKED_RUNTIME_MISSING`. |
| `PFV4-HOOK-008` | Capability unknown blocks | Required gate has `capability_status=UNKNOWN` | `CAPABILITY_UNKNOWN`; runtime inspection required. |
| `PFV4-HOOK-009` | Stale probe blocks final | Registry changed after last inspected event | `DONE_VERIFIED` blocked until re-probe. |
| `PFV4-HOOK-010` | M audit-only fallback blocks write | `fallback_class=post_action_audit`, `fallback_can_block=false` | Governed write blocked. |
| `PFV4-HOOK-011` | M native-equivalent fallback continues | Native-equivalent fallback, fresh evidence | `degrade` or policy `allow`; never silent allow. |
| `PFV4-HOOK-012` | E non-native fallback blocks | Risk E, fallback `pre_action_check`, human approved | Block; human approval is not sufficient. |
| `PFV4-HOOK-013` | C auto-decision blocks | Risk C, native binding, `auto_decision` | Block; pairing plus checkpoint required. |
| `PFV4-HOOK-014` | Hook error caps final | Hook handler throws before decision | Log `HOOK_ERROR`; no `DONE_VERIFIED` until inspected. |
| `PFV4-HOOK-015` | Event append failure prevents final | Block/degrade/final event cannot append | No final mutation committed. |
| `PFV4-HOOK-016` | Existing hooks preserved | Existing platform config has non-harness hook | Installer keeps existing hook and adds harness hook. |
| `PFV4-HOOK-017` | Runtime name is not proof | Runtime says Codex but no hook flag/probe | Required M route blocks. |
| `PFV4-HOOK-018` | T observation fallback degrades | Risk T, observation gate fallback audit-only | `warn`/`degrade`; final ceiling follows optional policy. |
| `PFV4-HOOK-019` | User prompt missing blocks bypass enforcement | Runtime lacks `user_prompt`, prompt requests bypass on M | Prompt cannot be accepted as governed; route blocks or requires reroute. |
| `PFV4-HOOK-020` | Post-tool violation invalidates evidence | Post hook detects secret or forbidden output | Evidence invalidated; `DONE_VERIFIED` blocked. |

## Required Next Files

Schemas:

```text
registry/schemas/runtime-capability-set.schema.json
registry/schemas/binding-set.schema.json
registry/schemas/hook-event.schema.json
registry/schemas/hook-decision.schema.json
registry/schemas/platform-install-manifest.schema.json
```

Registries:

```text
registry/runtime-bindings.yaml
registry/gates.yaml
registry/runtime-degradation-policy.yaml
```

Fixture directory:

```text
tests/fixtures/runtime-hooks/
```

Future implementation files, after specs and fixtures are accepted:

```text
packages/core/src/runtime/capability-detector.ts
packages/core/src/runtime/binding-evaluator.ts
packages/core/src/runtime/degradation-policy.ts
packages/core/src/hooks/canonical-hook-runner.ts
packages/core/src/hooks/platform-payload-parser.ts
packages/core/src/hooks/platform-response-formatter.ts
packages/adapter-claude/src/installer.ts
packages/adapter-claude/src/hooks.ts
packages/adapter-codex/src/installer.ts
packages/adapter-codex/src/hooks.ts
packages/adapter-hermes/src/installer.ts
packages/adapter-hermes/src/hooks.ts
```
