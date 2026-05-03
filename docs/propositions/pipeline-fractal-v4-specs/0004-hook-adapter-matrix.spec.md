# 0004 - Hook Adapter Matrix Spec

Status: draft v1

## Purpose

This file converts the cross-runtime research into adapter obligations for
Claude Code, Codex and Hermes. It is intentionally concrete so the future
implementation plan can create schemas, registries and fixtures without
reopening the architecture.

## Canonical Adapter Interface

```typescript
interface RuntimeHookAdapter {
  runtime: "claude" | "codex" | "hermes";
  detectCapabilities(): RuntimeCapabilitySet;
  parsePayload(raw: unknown): HookEvent;
  formatDecision(decision: HookDecision): PlatformHookResponse;
  installHooks(options: InstallOptions): InstallPlan | InstallResult;
  inspectInstall(scope: "global" | "project"): InstallInspection;
}
```

Platform-specific extensions are allowed, but they must not be required by the
portable RMS kernel.

## Claude Code Adapter

Required hook registrations:

```json
{
  "hooks": {
    "SessionStart": [{ "hooks": [{ "type": "command", "command": "harness hook session-start" }] }],
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "harness hook user-prompt-submit" }] }],
    "PreToolUse": [{ "hooks": [{ "type": "command", "command": "harness hook pre-tool-use" }] }],
    "PostToolUse": [{ "hooks": [{ "type": "command", "command": "harness hook post-tool-use" }] }],
    "Stop": [{ "hooks": [{ "type": "command", "command": "harness hook stop" }] }],
    "SubagentStop": [{ "hooks": [{ "type": "command", "command": "harness hook subagent-stop" }] }]
  }
}
```

Claude-specific facts:

- `UserPromptSubmit`, `PreToolUse`, `Stop` and `SubagentStop` can block when
  configured with supported response shapes.
- `PostToolUse` happens after side effects; it is evidence/audit, not
  pre-action enforcement.
- Agent, prompt, HTTP and MCP hook types are extensions, not MVP requirements.

Adapter obligations:

1. MUST install `UserPromptSubmit`; omitting it breaks mode/bypass enforcement.
2. MUST preserve existing non-harness hooks.
3. MUST represent advanced hook types separately from command-hook MVP.
4. MUST produce fixtures for allow, block, malformed output and timeout.

## Codex Adapter

Required config:

```toml
[features]
codex_hooks = true
```

Required hook registrations:

```json
{
  "hooks": {
    "SessionStart": [{ "hooks": [{ "type": "command", "command": "harness hook session-start" }] }],
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "harness hook user-prompt-submit" }] }],
    "PreToolUse": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "harness hook pre-tool-use" }] }],
    "PostToolUse": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "harness hook post-tool-use" }] }],
    "Stop": [{ "hooks": [{ "type": "command", "command": "harness hook stop" }] }]
  }
}
```

Codex-specific facts:

- Hooks are behind `codex_hooks`.
- Multiple matching command hooks can run concurrently.
- `PreToolUse` can deny supported Bash, `apply_patch` and MCP calls, but it is
  not a complete enforcement boundary for every possible tool path.
- `PostToolUse` can influence what the model sees next, but cannot undo side
  effects.
- `Stop` can create a continuation prompt.
- No native `subagent_stop` hook is assumed.

Adapter obligations:

1. MUST fail capability inspection when `codex_hooks` is false or absent.
2. MUST never mark Codex `subagent_stop` as native.
3. MUST encode known `PreToolUse` interception limitations in Capability Set.
4. MUST handle concurrent hook registration by making harness hooks idempotent.
5. MUST use supported deny/continue response shapes only; unsupported output
   fields are not enforcement proof.

## Hermes Adapter

Preferred MVP plugin hook mapping:

```yaml
plugin_hooks:
  on_session_start: "harness hook session-start"
  pre_llm_call: "harness hook user-prompt-submit"
  pre_tool_call: "harness hook pre-tool-use"
  post_tool_call: "harness hook post-tool-use"
  on_session_end: "harness hook stop"
  on_session_finalize: "harness hook stop"
  subagent_stop: "harness hook subagent-stop"
```

Hermes-specific facts:

- Plugin hooks run in CLI and gateway sessions.
- Gateway hooks run only in gateway surfaces.
- Shell hooks are convenient deployment wrappers but must map back to the same
  plugin semantics.
- `pre_tool_call` can veto tool execution.
- `pre_llm_call` can inject context.
- Most other hooks are observer-only.
- `subagent_stop` is observer-only unless proven otherwise.

Adapter obligations:

1. MUST distinguish CLI, gateway and plugin surfaces.
2. MUST treat `on_session_end`, `on_session_finalize` and `subagent_stop` as
   observation unless blocking proof exists.
3. MUST not claim hard stop enforcement from observer-only finalization hooks.
4. MUST record degraded final-state ceilings when only observation exists.
5. SHOULD support shell-hook generation only after the plugin mapping is
   specified.

## Shared Negative Fixtures

| Fixture | Claude | Codex | Hermes |
|---|---|---|---|
| Missing user-prompt binding | route blocks M bypass enforcement | route blocks M bypass enforcement | route blocks M bypass enforcement |
| Missing pre-tool binding | M/E/C governed write blocks | M/E/C governed write blocks | M/E/C governed write blocks |
| Post-only enforcement | no `DONE_VERIFIED` for M/E/C hard gate | no `DONE_VERIFIED` for M/E/C hard gate | no `DONE_VERIFIED` for M/E/C hard gate |
| Hook crash | event records error if possible; final capped | event records error if possible; final capped | event records error if possible; final capped |
| Stale install digest | capability stale | capability stale | capability stale |

## Adapter Handoff Rule

No adapter implementation may start from prose alone. The implementation plan
must first create:

- hook payload schemas;
- platform response schemas;
- installer merge fixtures;
- capability inspection fixtures;
- target expansion fixtures;
- negative enforcement fixtures.
