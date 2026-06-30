# hima Hermes Plugin

Node.js bridge that activates hima governance (gates, behaviors, criticality classification)
inside a [Hermes Agent](https://github.com/NousResearch/hermes-agent) session.

## Prerequisites

- Hermes Agent v0.12.x or later
- Node.js 20+
- `hima` CLI available in PATH (`npm i -g @hima/cli` or `pnpm add -g @hima/cli`)
- A hima-initialised project: `hima setup` creates `.hima/` at the project root

## Install into a Hermes profile

Hermes profiles live under `~/.hermes/profiles/<name>/`.
Each profile is a complete `HERMES_HOME` directory.

### 1. Locate (or create) your profile

```sh
# List existing profiles
hermes profile list

# Create a new profile if needed
hermes profile new myprofile
```

### 2. Copy the plugin directory into the profile

```sh
PROFILE=~/.hermes/profiles/myprofile

cp -r packages/adapter-hermes-plugin "$PROFILE/plugins/hima"
```

The profile's plugin directory should look like:

```
~/.hermes/profiles/myprofile/
  plugins/
    hima/
      plugin.toml   ← hook declarations
      main.mjs      ← Node bridge entry point
```

### 3. Enable `HERMES_ENABLE_PROJECT_PLUGINS` (optional, for per-project plugins)

If you want to load the plugin from the project directory instead of the user profile,
set `HERMES_ENABLE_PROJECT_PLUGINS=1` and place the plugin under `.hermes/plugins/hima/`.

### 4. Set HERMES_HOME explicitly when launching Hermes

Hermes profiles are sticky globally ([Hermes issue #18594](https://github.com/NousResearch/hermes-agent/issues/18594)).
Profile switching mid-session is not supported. Always pass `HERMES_HOME` explicitly:

```sh
HERMES_HOME=~/.hermes/profiles/myprofile HIMA_PROJECT_ROOT=/path/to/your/project hermes
```

If `HERMES_HOME` is not set, the plugin logs a warning at session start but does not block.

### 5. Set HIMA_PROJECT_ROOT

`HIMA_PROJECT_ROOT` tells the bridge where your project's `.hima/` directory lives.
If unset, the bridge falls back to `process.cwd()` (the directory from which Hermes
was launched) and logs a warning.

```sh
# Export once for the shell session:
export HIMA_PROJECT_ROOT=/path/to/your/project
export HERMES_HOME=~/.hermes/profiles/myprofile

hermes
```

## Hook mapping

| Hermes native hook | hima event         | Blocking? |
|--------------------|-------------------|-----------|
| `pre_tool_call`    | `pre-tool-use`    | yes       |
| `pre_llm_call`     | `user-prompt-submit` | yes    |
| `on_session_start` | `session-start`   | no        |
| `on_session_end`   | `stop`            | no (deferred via `pending-stop-verdict.json`) |
| `post_tool_call`   | `post-tool-use`   | no        |
| `pre_compact`      | `pre-compact`     | yes       |
| `post_compact`     | `post-compact`    | no        |
| `subagent_stop`    | `subagent-stop`   | no        |

`subagent_start` is absent on Hermes. It is compensated by intercepting
`delegate_task` calls in `pre_tool_call` (R-028 / R-038 / SPEC-007).

## Graceful degradation

The bridge degrades gracefully in all error cases — it never crashes the Hermes session:

| Condition | Behaviour |
|-----------|-----------|
| `hima` not in PATH | `{"action":"continue"}`, warning to stderr |
| `.hima/` missing at root | `{"action":"continue"}`, warning to stderr |
| `HERMES_HOME` not set | session continues, warning logged |
| `hima hook` exits 1 | `{"action":"continue"}`, error to stderr |
| Non-JSON stdout from hima | `{"action":"continue"}`, warning to stderr |
| Spawn timeout (15 s) | `{"action":"continue"}`, warning to stderr |

## Development

The plugin directory contains no `package.json` — it is a static plugin directory,
not a Node.js package. The bridge uses only Node.js built-ins (`node:child_process`,
`node:fs`, `node:path`) plus async iteration over `process.stdin` (Node 20+).

To test the bridge manually:

```sh
echo '{"toolName":"Bash","input":{"command":"ls"}}' | \
  HIMA_PROJECT_ROOT=/path/to/project \
  HERMES_HOME=~/.hermes/profiles/myprofile \
  node packages/adapter-hermes-plugin/main.mjs pre_tool_call
```

## References

- SPEC-007-adapter-hermes.md — full plugin contract, hook mapping, acceptance criteria
- Gap register R-034 (plugin scaffold), R-055 (HERMES_HOME warning)
- `packages/hima-core/src/hermes-home.ts` — `hermesHomeWarning()` helper
- `packages/hima-core/src/adapter-hermes.ts` — ACP response translator
