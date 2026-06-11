# 0002 - Runtime Probe And Freshness Spec

Status: draft v1

## Purpose

`rms.probe_runtime` is the trusted acquisition path for hook capability proof.
`rms.inspect_runtime` can store caller-submitted runtime facts, but those facts
remain candidate evidence and cannot by themselves make a blocking hook native.
The harness cannot trust runtime name, documentation claims, or adapter
self-attestation alone.

This spec defines the minimum probe sequence and freshness rules required
before PFV4 can use a Binding Set entry for governed execution.

## Probe Inputs

```yaml
probe_runtime_request:
  runtime_hint: "claude|codex|hermes|unknown"
  runtime_version: "canonical runtime profile version"
  cwd: "absolute path"
  session_id: "runtime session id or UNKNOWN"
  requested_route_id: "route id or UNSET"
  required_gates:
    - "user_prompt"
    - "pre_tool"
    - "post_tool"
    - "stop"
  registry_digest: "sha256:..."
  policy_digest: "sha256:..."
```

## Probe Order

1. Read environment facts.
2. Read hook payload shape when invoked inside a hook.
3. Read runtime config files.
4. Validate required feature flags.
5. Validate hook command registrations.
6. Validate install manifest digests.
7. Run safe dry-run probes when available.
8. Produce Capability Set and Binding Set evidence.

## Runtime-Specific Probes

### Claude Code

Probe:

- presence of Claude settings;
- `hooks` entries for `SessionStart`, `UserPromptSubmit`, `PreToolUse`,
  `PostToolUse`, `Stop`, and `SubagentStop`;
- command paths and manifest digests;
- whether project/local settings scope is expected;
- whether hook type is `command`, `http`, `mcp_tool`, `prompt`, or `agent`.

Required MVP shape:

```yaml
claude_required_hooks:
  SessionStart: "session_start"
  UserPromptSubmit: "user_prompt"
  PreToolUse: "pre_tool"
  PostToolUse: "post_tool"
  Stop: "stop"
  SubagentStop: "subagent_stop"
```

### Codex

Probe:

- active Codex config layers;
- `[features] codex_hooks = true`;
- loaded hook sources: `config.toml` `[[hooks]]` tables;
- entries for `SessionStart`, `UserPromptSubmit`, `PreToolUse`,
  `PostToolUse`, and `Stop`;
- no claim that `subagent_stop` is native;
- known limitation that `PreToolUse` is incomplete for some tool paths.

Required MVP shape:

```yaml
codex_required_hooks:
  SessionStart: "session_start"
  UserPromptSubmit: "user_prompt"
  PreToolUse: "pre_tool"
  PostToolUse: "post_tool"
  Stop: "stop"
  SubagentStop: "missing"
```

If `codex_hooks` is absent or false, all Codex hook Binding Set entries become
`capability_unknown` or `missing` and M/H/C hard enforcement blocks.

### Hermes

Probe:

- whether current surface is CLI, gateway, or unknown;
- plugin hook registration for `pre_llm_call`, `pre_tool_call`,
  `post_tool_call`, `on_session_start`, `on_session_end`,
  `on_session_finalize`, and `subagent_stop`;
- shell hook config only if used as a deployment fallback;
- gateway hook config only if the route uses gateway dispatch behavior;
- whether `subagent_stop` is observer-only or can enforce a parent gate.

Required MVP shape:

```yaml
hermes_required_hooks:
  on_session_start: "session_start"
  pre_llm_call: "user_prompt"
  pre_tool_call: "pre_tool"
  post_tool_call: "post_tool"
  on_session_end: "stop_observation"
  on_session_finalize: "stop_observation"
  subagent_stop: "subagent_stop_observation"
```

Hermes stop and subagent hooks are not assumed hard-blocking unless a probe or
documented binding proves otherwise.

## Freshness Invalidation

Capability and Binding Set evidence is stale when any of these change:

| Trigger | Required action |
|---|---|
| Runtime config file digest changes. | Re-run `rms.probe_runtime`. |
| Hook install manifest digest changes. | Re-run hook command validation. |
| Registry or policy digest changes. | Re-evaluate Binding Set legality. |
| Runtime version changes. | Re-probe capability. |
| Session resumes after compaction or restart. | Verify capability event still applies. |
| Route adds a required gate. | Report a `missing`, `stale`, or `capability_unknown` assessment gap; re-inspect runtime only when capability evidence may have changed. |
| Hook command path disappears or changes digest. | Mark binding stale or failed. |

## Trust Model

Adapters may report candidate facts, but only probe evidence can make a binding
usable for governed execution.

Trusted evidence types:

| Evidence type | Use |
|---|---|
| `config_read` | Proves configuration claims, not runtime firing. |
| `manifest_digest` | Proves installed file identity. |
| `dry_run` | Proves canonical command handles fixture payload. |
| `negative_fixture` | Proves deny/block response shape is produced. |
| `event_fire` | Proves runtime invoked the hook in a real session. |
| `manual_attestation` | Allowed only as checkpoint evidence; not native-equivalent enforcement. |

`can_block=true` for M/H/C hard enforcement requires either accepted
`event_fire` or accepted `negative_fixture` minted by `core-runtime-probe`,
with `observedAt`, `verifier`, `target`, `runtimeVersion`, `gateType`,
`configDigest`, `result`, and `proofDigest`, tied to the runtime's documented
blocking response.
Caller-submitted inspection proofs are stored as candidate evidence only.

For trusted probe acquisition, `configDigest` is the observed runtime config
content digest: target identity, canonical `runtimeVersion`, static runtime
profile digest, runtime config file digest, and install manifest digest when
present. It is not only the static runtime profile digest.

Runtime config registration is never sufficient to mint `negative_fixture`.
The core may store config and manifest proofs from static inspection, but an
accepted `negative_fixture` requires explicit managed fixture verification.
Accepted `event_fire` remains reserved for proof that the runtime invoked the
hook in a real session.

The trusted blocking proof freshness window is strict:

1. `observedAt` MUST be no earlier than the stored capability inspection time.
2. `observedAt` MUST be no later than the binding inspection time.
3. `observedAt` MUST be no older than 15 minutes at binding time.

Any proof outside this window is treated as stale even when its digest,
verifier, target, runtime version, gate, config digest and result match.

## Outputs

`rms.inspect_runtime` emits:

```yaml
event_type: "RUNTIME_BINDING_CHECKED"
capability_set_ref: "capability.codex.2026-05-03T000000Z"
binding_set_ref: "binding-set.codex.run-123"
fresh: true
blocking_summary:
  user_prompt: "native_blocking"
  pre_tool: "native_blocking_with_limitations"
  stop: "native_blocking"
  subagent_stop: "missing"
route_effect:
  max_final_state: "DONE_WITH_GAPS"
  required_actions:
    - "avoid subagent_stop-dependent final verification on Codex"
```

## Acceptance Criteria

1. MUST treat absent config, absent feature flag, absent hook command, stale
   digest, and failed probe as non-enforceable.
2. MUST assess every route-required gate against the complete canonical
   `GateType -> RuntimeBinding` table and report missing, stale, or
   capability-unknown bindings without creating a second stored binding table.
3. MUST record the evidence type that justifies `can_block=true`.
4. MUST invalidate capability evidence after config, install, registry, policy,
   runtime or route changes.
5. MUST not allow manual attestation to become native-equivalent technical
   proof for H/C hard gates.
6. MUST not allow caller-submitted proof payloads to become native-equivalent
   technical proof; trusted proof must be minted by the core runtime probe.
7. MUST reject trusted blocking proofs that predate capability inspection, are
   future-dated against binding inspection, or exceed the 15-minute freshness
   window.
8. MUST NOT mint `negative_fixture` from static config registration alone.
9. MUST NOT accept caller-controlled timestamps on public trusted acquisition
   surfaces such as MCP `rms.probe_runtime`.
10. SHOULD expose a dry-run report showing which gates are enforceable, degraded
   or missing.
