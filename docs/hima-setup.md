# hima setup — onboarding command

`hima setup` wires the v3 CLI into a project and scaffolds the `.hima/` state directory.
Run it once after cloning or whenever you want to refresh the hook wiring.

## Usage

```
hima setup [--runtime claude|codex|hermes] [--fresh] [--root <dir>]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--runtime` | auto-detect | Target runtime. Auto-detect: `.claude/` → claude, `.codex/` or `AGENTS.md` → codex, otherwise → claude. |
| `--fresh` | false | Delete runtime state (trace, ward, events) before re-scaffolding. Config is preserved. |
| `--root` | cwd | Project root. Overrides `HIMA_PROJECT_ROOT` env and cwd. |

## What it does per runtime

### claude

1. Reads `<root>/.claude/settings.json` (creates if absent).
2. Merges the 7 Claude hook events into the `hooks` block. Existing non-hima entries are preserved. Old hima entries from previous runs are replaced (idempotent).
3. Commands use `node <dist/index.js> hook <event> --format claude` — the absolute path to the running CLI binary is embedded automatically.
4. Scaffolds `.hima/` (see below).

Wired events:

| Claude event | CLI arg |
|---|---|
| `SessionStart` | `session-start` |
| `UserPromptSubmit` | `user-prompt-submit` |
| `PreToolUse` | `pre-tool-use` |
| `PostToolUse` | `post-tool-use` |
| `PreCompact` | `pre-compact` |
| `PostCompact` | `post-compact` |
| `SubagentStart` | `subagent-start` |

### codex / hermes

Hook wiring for codex and hermes is best-effort/manual. `hima setup` scaffolds `.hima/` and emits guidance but does not write to a settings file. See the runtime's own config mechanism to add the hook commands listed above.

## Scaffold

`hima setup` ensures these paths exist after every run:

```
<root>/.hima/
  state/          — created; required for all state writes
  config.json     — created with {} when absent; never overwritten
  current-risk.json — created with {"risk_class":"T"} when absent; never overwritten
```

`config.json` is user data. It is preserved across `--fresh` resets and repeated `hima setup` runs.

## --fresh reset

`--fresh` deletes runtime state before re-scaffolding:

| Path | Action |
|------|--------|
| `.hima/state/trace/` | Deleted recursively |
| `.hima/state/ward.json` | Deleted |
| `.hima/state/events.jsonl` | Deleted |
| `.hima/config.json` | **Preserved** |

After deletion, scaffold re-runs to guarantee `.hima/state/` exists.

## Verify

After running `hima setup`, verify the hook wiring is active:

```bash
hima trace --root <project-root>
```

This shows the trace timeline for the most recent session. If hooks are wired correctly, each invocation from a live Claude Code session appends a trace line.

## Thin onboarding SKILL.md

A thin skill wrapper can run `hima setup` as part of a project onboarding flow:

```markdown
# hima onboarding

Run: `node packages/hima-cli/dist/index.js setup --root .`

This wires the 7 Claude hook events and scaffolds `.hima/`.
Verify with: `hima trace`
```

Place this in `.claude/commands/hima-onboard.md` or in a project SKILL.md for one-command onboarding.
