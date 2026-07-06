# Runtime capabilities — verified against official docs (2026-07-06)

Research pass (4 parallel lanes, delegation-first) reading the **actual official documentation**
of each target coding agent, to replace Norm's internal capability-map *assumptions* with
documented ground truth. Motive: founder directive "read their actual documentation bc it's
insane" + make-no-mistake. This is a `research-*` artifact (not claim-bearing).

## Bottom line

**The concept is universal:** all four target runtimes have (a) a native sub-agent / delegation
primitive, (b) a hook system that can **block a tool call**, (c) context injection, (d) rules
loading. So sub-agent-driven-first / Delegation-First is *buildable on all of them*. **BUT Norm's
current capability-map is factually wrong in several places** and would mis-govern Codex/Hermes today.

## Per-runtime truth (sourced)

| Runtime | Sub-agents (native) | Strongest BLOCK point | Spawn detection | Notable |
|---|---|---|---|---|
| **Claude Code** | `Agent` tool (renamed from `Task` v2.1.63; `.claude/agents/*.md`; nest depth 5 fixed; fork; worktree isolation; per-agent memory) | `PreToolUse` deny on Write\|Edit (harness-enforced) | `SubagentStart` (inject-only, **cannot block**); `SubagentStop` can block | 30 hook events; `PostToolBatch`, `TaskCreated/Completed` blockable; headless `claude -p --bare` |
| **Codex** | `~/.codex/agents/*.toml` (default/worker/explorer; parallel; `max_threads`=6, `max_depth`=1); cloud parallel mode | `PreToolUse` deny (+ **rewrite** via `updatedInput`); also UserPromptSubmit, PostToolUse, Stop, Pre/PostCompact, PermissionRequest | `SubagentStart` native event (inject-only) — **no poll-file needed** | 11 hooks; MDM-pinned hooks; granular approval policy |
| **OpenCode** | primary + subagents (`general`/`explore`/`scout`); `Task` tool; `permission.task` glob-deny; child sessions | plugin `tool.execute.before` **throws to block** (+ mutate args) | child `session.created` / `tool.execute.after` on `task` | custom tool **overrides a built-in** (shadow a dangerous tool); server REST/SSE; permission engine |
| **Hermes** (NousResearch/hermes-agent) | `delegate_task` (parallel batch, `max_concurrent_children`=3, `max_spawn_depth`=1; `skip_context_files=True`) | `pre_tool_call` → `{action:block}` | `subagent_start` **exists** (observational) | 17 hooks; no stop hook (open issue #27206); ACP is *editor-integration only* |

## Concrete errors in Norm's capability-map to fix

1. **🔴 "1800-byte injection limit" is a MYTH** (confirmed 2× independently: Codex + Hermes). It is a
   **1800-SECOND** timeout (`agents.job_max_runtime_seconds` / `HERMES_API_TIMEOUT`), misread as bytes.
   Real caps: Codex 32 KiB (AGENTS.md) + 8000 chars (skill listing); Hermes 20,000 chars/file.
   → `adapter-hermes.ts` `HERMES_MAX_INJECT_BYTES=1800` + capability-map `maxInjectionBytes 1800` are wrong.
2. **🔴 Claude `subagent_start canBlock:true` is FALSE.** Per docs, `SubagentStart` is injection-only
   ("Can block? No"); the blocking sibling is `SubagentStop`. → any Norm gate that *blocks* at Claude
   `subagent_start` (e.g. BEH_WORKER_MODEL) is **dark live**. Correct enforcement = `PostToolUse` on
   `Agent` marks delegation → `PreToolUse` deny on Write\|Edit. (This is exactly SPEC-018's
   mark-on-subagent-start + block-at-pre_tool design — the block is at pre_tool, which IS correct.)
3. **🔴 Hermes `subagent_start absent` is FALSE** — it exists (observational). The engineering
   conclusion (block at `pre_tool_call` on `delegate_task`) stays, but the premise was wrong.
4. **🔴 "Hermes uses ACP" is FALSE/conflated.** ACP = **Agent *Client* Protocol** (Zed, editor↔agent,
   LSP-like). Hermes uses ACP only in *editor-integration* mode; its delegation/hooks are native Python.
   Norm builds the Hermes adapter on the wrong protocol premise.
5. **🟠 Codex "poll-file compensation needed" is unnecessary** — native `SubagentStart` event exists.
6. **🟠 "Task subagents" wording** (spawn-manifest) — on Claude the tool is now `Agent` (Task is an
   unrelated shared task-list feature). Update the advisory wording.
7. **🟢 Blocking surface is far wider than "pre_tool + stop"** on every runtime → Delegation-First can
   be enforced **redundantly** (pre_tool + user_prompt + stop).

## The universal enforcement pattern (correct, per all 4 docs)

- **Block at `PreToolUse`/`tool.execute.before` on implementation writes** — universal; all 4 can deny there.
- **Detect delegation via each runtime's native subagent event** → write a marker (Claude/Codex
  `SubagentStart`, Hermes `subagent_start`, OpenCode child `session.created` / `task` after-hook).
- This is exactly SPEC-018's shape (mark on spawn, block at pre_tool). SPEC-018 is universal-ready;
  the fixes above are to the **older capability-map / adapters**, not the Delegation-First gate.

## Open items needing an EMPIRICAL (live) test, not doc-reading

- Whether Claude `bypassPermissions`/`acceptEdits` session modes silently override a `PreToolUse` deny.
- OpenCode: whether `task`/`edit` are distinguishable + interceptable in `tool.execute.before` (like `read`).
- OpenCode `permission.asked/replied` blockability (payload undocumented).

Sources (official docs): code.claude.com/docs/en/{hooks,sub-agents,headless,agent-teams,agents} ·
developers.openai.com/codex/{hooks,subagents,skills,config-reference,cloud} · opencode.ai/docs/{agents,
plugins,rules,permissions,custom-tools,server} · hermes-agent.nousresearch.com/docs + github.com/
NousResearch/hermes-agent · agentclientprotocol.com.
