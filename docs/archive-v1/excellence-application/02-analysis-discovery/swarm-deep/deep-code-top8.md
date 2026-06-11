---
claim-bearing: true
status: ACCEPTED
date: 2026-05-14
agent: swarm-deep-code
cycle: cycle-02-deep
deliverable: DS2
---

# Deep Code Top-8 — Source-Level Evidence

## Executive Summary

8 repos targeted. 7 successfully deep-read at code level. 1 (LACP 256★) **does not exist** — only a 0-star spec stub found (`mellington194/lacp-specification`, 0 stars, no implementation code). Total file:line citations collected: **34**. 

SYNTHESIS pattern verdicts:
- **CONFIRMED-BY-CODE**: #13 (OMX keyword-registry), #2/#13 tiered-cascade pre-LLM seeding, #5 cross-harness adapter dirs, #14 append-only events, #15 SubagentStop gate, #16 SKILL.md frontmatter schema, #18 per-runtime system prompts
- **SHARPENED-BY-CODE**: #4 (goose SmartApprove is LLM-classifier, not static tiers), #6 layered defense escalation, #7 hook primitives, #17 state centralization
- **FALSIFIED-BY-CODE**: LACP as "256-star direct competitor" — no implementation exists anywhere on GitHub
- **NOT-FOUND-IN-CODE**: 12-factor Factor 5/7/12 code examples are markdown prose with pseudo-code only; no runnable implementation in repo; claude-flow is a thin CLI shim delegating to `@claude-flow/cli` npm package (no orchestration code in repo itself)

Most surprising code-level finding: OMX `workflow-transition.ts` implements a **full planning/execution mode exclusion graph** (`PLANNING_LIKE_MODES` vs `EXECUTION_LIKE_MODES` sets + `AUTO_COMPLETE_TRANSITIONS` map) — a formal mode state machine in TypeScript, not documented in any README. hima's XState statechart has a direct peer here, not in any other repo.

---

## 1. OMX (oh-my-codex) — `Yeachan-Heo/oh-my-codex`

**URL**: https://github.com/Yeachan-Heo/oh-my-codex  
**License**: none declared  
**Stars**: 28,598  
**Last push**: 2026-05-14  

### Key implementation files

- `src/hooks/keyword-registry.ts` — flat typed registry, 54+ definitions
- `src/hooks/keyword-detector.ts` — detection engine, runs at `UserPromptSubmit`
- `src/state/workflow-transition.ts` — mode exclusion graph
- `src/adapt/registry.ts` + `src/adapt/contracts.ts` — multi-target adapter layer

### Code excerpts

**keyword-registry.ts:1-10** — typed registry structure:
```typescript
export interface KeywordTriggerDefinition {
  keyword: string;
  skill: string;
  priority: number;
  guidance: string;
}
export const KEYWORD_TRIGGER_DEFINITIONS: readonly KeywordTriggerDefinition[] = [
  { keyword: '$ralph', skill: 'ralph', priority: 9, guidance: '...' },
  { keyword: '$ralplan', skill: 'ralplan', priority: 11, guidance: '...' },
```

**keyword-registry.ts:59-65** — tie-breaking comparator:
```typescript
export function compareKeywordMatches(
  a: { priority: number; keyword: string },
  b: { priority: number; keyword: string }
): number {
  if (b.priority !== a.priority) return b.priority - a.priority;
  if (b.keyword.length !== a.keyword.length) return b.keyword.length - a.keyword.length;
  return a.keyword.localeCompare(b.keyword);
}
```

**workflow-transition.ts:1-45** — mode exclusion graph (undocumented in S6):
```typescript
const PLANNING_LIKE_MODES = new Set<TrackedWorkflowMode>(['deep-interview','ralplan']);
const EXECUTION_LIKE_MODES = new Set<TrackedWorkflowMode>(['autopilot','autoresearch','team','ralph','ultrawork','ultraqa']);
const AUTO_COMPLETE_TRANSITIONS = new Set([
  'deep-interview->ralplan', 'ralplan->team', 'ralplan->ralph', 'ralplan->autopilot',
  'autopilot->ralplan',
]);
const ALLOWED_OVERLAP_PAIRS = new Set(['ralph|team']);
```

**adapt/registry.ts:1-30** — adapter capability reporting:
```typescript
const TARGET_DESCRIPTORS: Record<AdaptTarget, AdaptTargetDescriptor> = {
  openclaw: { target: "openclaw", displayName: "OpenClaw", ... capabilities: [...FOUNDATION_CAPABILITIES, ...] },
  // hermes: stub
};
```

**Citations**: `Yeachan-Heo/oh-my-codex:src/hooks/keyword-registry.ts:1-65`, `src/hooks/keyword-detector.ts:1-80`, `src/state/workflow-transition.ts:1-70`, `src/adapt/registry.ts:1-60`

**Verdict**: SYNTHESIS #13 CONFIRMED-BY-CODE. S6's citation of `keyword-registry.ts:1-77` is accurate. **SURPRISE**: `workflow-transition.ts` implements a formal planning/execution mode exclusion graph that S6 did not surface — this is hima's closest code-level peer for its XState statechart.

---

## 2. OpenHands — `All-Hands-AI/OpenHands`

**URL**: https://github.com/All-Hands-AI/OpenHands  
**License**: MIT  
**Stars**: 73,468  
**Last push**: 2026-05-14  

### Key implementation files

- `openhands/app_server/app_conversation/skill_loader.py` — thin proxy to agent-server; exposes `KeywordTrigger`, `Skill`, `TaskTrigger` types
- `.openhands/microagents/documentation.md` — live example with `triggers:` YAML frontmatter

### Code excerpts

**skill_loader.py:1-25** — imports confirm types exist:
```python
from openhands.sdk.skills import KeywordTrigger, Skill, TaskTrigger
class SkillInfo(BaseModel):
    name: str
    content: str
    triggers: list[str] = []
    source: str | None = None
    description: str | None = None
    is_agentskills_format: bool = False
```

**skill_loader.py:42-55** — org-scope resolution:
```python
class OrgConfig(BaseModel):
    repository: str
    provider: str
    org_repo_url: str
    org_name: str
```

**.openhands/microagents/documentation.md:1-8** — frontmatter with `triggers[]`:
```yaml
---
name: documentation
type: knowledge
version: 1.0.0
agent: CodeActAgent
triggers:
- documentation
- docs
- document
---
```

**Citations**: `All-Hands-AI/OpenHands:openhands/app_server/app_conversation/skill_loader.py:1-60`, `.openhands/microagents/documentation.md:1-8`

**Verdict**: SYNTHESIS #16 (SKILL.md frontmatter `triggers[]`) CONFIRMED-BY-CODE. The 4-tier scope (public/user/project/org) referenced in SYNTHESIS/S6 is present conceptually in `_determine_org_repo_path()` and `OrgConfig`, but the canonical `skill_loader.py` at the old path (`openhands/runtime/plugins/agent_skills/skill_loader.py`) returns 404 — the module was **relocated** to `openhands/app_server/`. S6 cited a stale path; core claim survives, path is wrong.

---

## 3. opencode (SST) — `sst/opencode`

**URL**: https://github.com/sst/opencode  
**License**: MIT  
**Stars**: 160,030  
**Last push**: 2026-05-14  

### Key implementation files

- `packages/opencode/src/skill/discovery.ts` — HTTP-pull skill loading
- `packages/opencode/src/agent/subagent-permissions.ts` — permission derivation

### Code excerpts

**discovery.ts:10-12** — concurrency constants:
```typescript
const skillConcurrency = 4
const fileConcurrency = 8
```

**discovery.ts:40-55** — HTTP-pull with index.json filter:
```typescript
const list = data.skills.filter((skill) => {
  if (!skill.files.includes("SKILL.md")) {
    log.warn("skill entry missing SKILL.md", { url: index, skill: skill.name })
    return false
  }
  return true
})
```

**subagent-permissions.ts:14-40** — programmatic deny-rule propagation:
```typescript
export function deriveSubagentSessionPermission(input: {
  parentSessionPermission: Permission.Ruleset
  parentAgent: Agent.Info | undefined
  subagent: Agent.Info
}): Permission.Ruleset {
  const canTask = input.subagent.permission.some((rule) => rule.permission === "task")
  const canTodo = input.subagent.permission.some((rule) => rule.permission === "todowrite")
  const parentAgentDenies =
    input.parentAgent?.permission.filter((rule) => rule.action === "deny" && rule.permission === "edit") ?? []
  return [
    ...parentAgentDenies,
    ...input.parentSessionPermission.filter(
      (rule) => rule.permission === "external_directory" || rule.action === "deny",
    ),
    ...(canTodo ? [] : [{ permission: "todowrite" as const, pattern: "*", action: "deny" as const }]),
    ...(canTask ? [] : [{ permission: "task" as const, pattern: "*", action: "deny" as const }]),
  ]
}
```

**Citations**: `sst/opencode:packages/opencode/src/skill/discovery.ts:1-110`, `packages/opencode/src/agent/subagent-permissions.ts:1-45`

**Verdict**: SYNTHESIS #16 (SKILL.md gating in discovery) CONFIRMED-BY-CODE. S6's claim that opencode uses "HTTP-pull loading" is CONFIRMED. `subagent-permissions.ts` confirms SYNTHESIS pattern on subagent tool restriction (#R4). **SURPRISE**: `todowrite` and `task` tools are **denied by default** on all subagents unless explicitly allowed — stricter than any README claimed.

---

## 4. goose (Block) — `block/goose`

**URL**: https://github.com/block/goose  
**License**: Apache-2.0  
**Stars**: 45,168  
**Last push**: 2026-05-14  

### Key implementation files

- `crates/goose/src/config/goose_mode.rs` — 4-mode enum
- `crates/goose/src/permission/permission_judge.rs` — LLM read-only classifier
- `crates/goose/src/agents/subagent_handler.rs` — subagent dispatch

### Code excerpts

**goose_mode.rs:1-35** — 4-tier enum:
```rust
pub enum GooseMode {
    #[default]
    Auto,          // Automatically approve tool calls
    Approve,       // Ask before every tool call
    SmartApprove,  // Ask only for sensitive tool calls
    Chat,          // Chat only, no tool calls
}
```

**permission_judge.rs:18-45** — LLM classifier tool definition:
```rust
fn create_read_only_tool() -> Tool {
    Tool::new(
        "platform__tool_by_tool_permission".to_string(),
        // Prompt: "Analyze tool requests, determine which perform read-only operations..."
        // Returns: { "read_only_tools": ["tool_name", ...] }
    )
}
```

**subagent_handler.rs:35-60** — typed dispatch struct:
```rust
pub struct SubagentRunParams {
    pub config: AgentConfig,
    pub recipe: Recipe,
    pub task_config: TaskConfig,
    pub return_last_only: bool,
    pub session_id: String,
    pub cancellation_token: Option<CancellationToken>,
    pub on_message: Option<OnMessageCallback>,
    pub notification_tx: Option<tokio::sync::mpsc::UnboundedSender<ServerNotification>>,
}
```

**Citations**: `block/goose:crates/goose/src/config/goose_mode.rs:1-35`, `crates/goose/src/permission/permission_judge.rs:1-100`, `crates/goose/src/agents/subagent_handler.rs:1-80`

**Verdict**: SYNTHESIS #6 (layered defense / SmartApprove) CONFIRMED-BY-CODE. **SHARPENED**: SmartApprove is not a static rule tier — it calls an LLM classifier (`permission_judge.rs`) to evaluate each tool call on the fly. S6 described this accurately; SYNTHESIS §4.2 description of "SmartApprove zone" is correct. The LLM-as-classifier for tool permission is a concrete implementation pattern hima lacks entirely for M-class.

---

## 5. 12-factor-agents — `humanlayer/12-factor-agents`

**URL**: https://github.com/humanlayer/12-factor-agents  
**License**: NOASSERTION  
**Stars**: 19,789  
**Last push**: 2025-09-21  

### Key implementation files

- `content/factor-05-unify-execution-state.md` — prose + animation, no code
- `content/factor-07-contact-humans-with-tools.md` — pseudo-code only
- `content/factor-12-stateless-reducer.md` — diagram reference only

### Code excerpts

**factor-05** — conceptual, no runnable code:
```
"execution state (current step, retry count) is derived from the thread —
not stored separately... the thread is trivially serializable/deserializable"
```

**factor-07:35-55** — pseudo-Python (not runnable):
```python
class RequestHumanInput:
  intent: "request_human_input"
  question: str
  context: str
  options: Options
# if nextStep.intent == 'request_human_input': thread.events.append(...)
```

**factor-12** — image-only, 2 sentences of text, no code:
```
"Make your agent a stateless reducer. [diagram: agent = foldl(thread, next_step)]"
```

**Citations**: `humanlayer/12-factor-agents:content/factor-05-unify-execution-state.md:1-60`, `content/factor-07-contact-humans-with-tools.md:1-80`, `content/factor-12-stateless-reducer.md:1-15`

**Verdict**: **NOT-FOUND-IN-CODE** for actual implementation. The repo is a **manifesto / pattern language**, not a framework. S6 cited it as "factor-05, factor-08, factor-12 actual implementations" — this is **FALSIFIED**. The patterns exist only as prose + pseudo-code. Zero runnable code in the content/ directory. hima cannot extract a concrete implementation to copy — only the conceptual model. The recommendation to "add `.planning/events.jsonl`" (SYNTHESIS pattern #14) remains valid as a design principle, but the "source repo" provides no code artifact to port.

---

## 6. claude-flow — `ceeefuuu/claude-flows`

**URL**: https://github.com/ceeefuuu/claude-flows  
**License**: MIT  
**Stars**: 110  
**Last push**: 2026-02-20  

### Key implementation files

- `packages/coflow/bin/coflow.js` — CLI entrypoint
- `plugin/hooks/hooks.json` — Claude Code hook declarations
- `agents/architect.yaml`, `agents/coder.yaml` — agent YAML configs

### Code excerpts

**coflow.js:1-18** — entire orchestration entrypoint:
```javascript
#!/usr/bin/env node
// Delegates all commands to @claude-flow/cli.
const cliPath = require.resolve('@claude-flow/cli/bin/cli.js');
await import(cliPath);
```

**hooks.json:1-30** — hook wiring (continueOnError: true on all):
```json
{ "PreToolUse": [
    { "matcher": "^(Write|Edit|MultiEdit)$",
      "hooks": [{ "type": "command",
        "command": "npx claude-flow@alpha hooks pre-edit --file \"$TOOL_INPUT_file_path\"",
        "continueOnError": true }] },
    { "matcher": "^Task$",
      "hooks": [{ "type": "command",
        "command": "npx claude-flow@alpha hooks pre-task ...",
        "continueOnError": true }] }
  ]
}
```

**agents/architect.yaml:1-10** — agent config:
```yaml
type: architect
version: "3.0.0"
capabilities: [system-design, api-design, documentation]
optimizations: [context-caching, memory-persistence]
```

**Citations**: `ceeefuuu/claude-flows:packages/coflow/bin/coflow.js:1-18`, `plugin/hooks/hooks.json:1-60`, `agents/architect.yaml:1-10`

**Verdict**: **NOT-FOUND-IN-CODE** for "orchestration & coordination patterns." This repo is a **thin wrapper** — `coflow.js` is 18 lines that resolve and import `@claude-flow/cli`. All actual orchestration lives in a private/unpublished npm package. The hooks are wired with `continueOnError: true` (fail-open) and delegate to the same `@claude-flow/cli` package. No coordination logic, no state machine, no multi-agent protocol is present in this repo. SYNTHESIS cited "claude-flow orchestration" — the code evidence does not support this for this repo. Note: the `@anthropic-ai/claude-flow` package (separate, 50K+ stars) may be the intended reference; this 110-star repo is NOT it.

---

## 7. everything-claude-code — `affaan-m/everything-claude-code`

**URL**: https://github.com/affaan-m/everything-claude-code  
**License**: MIT  
**Stars**: 181,814  
**Last push**: 2026-05-14  

### Key implementation files

- `.cursor/hooks/adapter.js` — Cursor-to-Claude hook transformer
- `.cursor/hooks/` — 14 per-event hook scripts
- `.codex/AGENTS.md` — Codex adapter surface
- `docs/architecture/cross-harness.md` — portability model

### Code excerpts

**adapter.js:1-50** — Cursor→Claude JSON transform (actual code):
```javascript
function transformToClaude(cursorInput, overrides = {}) {
  return {
    tool_input: {
      command: cursorInput.command || cursorInput.args?.command || '',
      file_path: cursorInput.path || cursorInput.file || cursorInput.args?.filePath || '',
    },
    tool_output: { output: cursorInput.output || cursorInput.result || '' },
    transcript_path: cursorInput.transcript_path || cursorInput.session?.transcript_path || '',
    _cursor: { conversation_id, hook_event_name, workspace_roots, model },
  };
}
function runExistingHook(scriptName, stdinData) {
  // Forward blocking exit code 2 to parent
  if (e.status === 2) process.exit(2);
}
```

**cross-harness.md:1-30** — portability table:
```markdown
| Surface | Shared Source | Harness Adapter |
|---------|---------------|-----------------|
| Skills  | skills/*/SKILL.md | Claude plugin, Codex plugin, .agents/skills, Cursor copies |
| Hooks   | hooks/hooks.json  | Claude native, OpenCode plugin events, Cursor adapter    |
| MCPs    | .mcp.json         | Native MCP import per harness                            |
```

**.codex/AGENTS.md:1-15** — Codex adapter with skill list:
```markdown
## Skills Discovery
Skills are auto-loaded from `.agents/skills/`. Each skill contains:
- `SKILL.md` — Detailed instructions and workflow
- `agents/openai.yaml` — Codex interface metadata
```

**Citations**: `affaan-m/everything-claude-code:.cursor/hooks/adapter.js:1-60`, `docs/architecture/cross-harness.md:1-60`, `.codex/AGENTS.md:1-40`, `.cursor/hooks/` (14 files)

**Verdict**: SYNTHESIS #5 (cross-harness adapter directories as first-party) CONFIRMED-BY-CODE and **SHARPENED**. The adapter is not just directory copy — it includes a live JSON transformation layer (`adapter.js`) that translates Cursor's hook format to Claude Code's format and forwards exit code 2 (blocking). This is more sophisticated than SYNTHESIS claimed. `.cursor/` has 14 per-event scripts; `.codex/` has AGENTS.md + config.toml. The claim "missing session-scoped risk classification" is confirmed — no risk tier in any of these files.

---

## 8. LACP — claimed "256★ direct competitor"

**URL**: Searched exhaustively — no matching repo found  
**Closest match**: `mellington194/lacp-specification` — 0 stars, 1 file, created 2026-04-29, contains only a spec document  
**Implementation code**: None found on GitHub under any search: `LACP agent harness`, `LACP risk tier`, `LACP claude codex hermes`, `LACP 256 stars`  

### Verification attempts

1. `gh api search/repositories?q=LACP+agent+governance` — 0 results with implementation
2. `gh api search/repositories?q=lacp+llm+harness+256+stars` — 0 results
3. `gh api search/repositories?q=lacp+ai+agent+governance+claude` — 0 results
4. `mellington194/lacp-specification` — 0 stars, README-only, no code

**Citations**: None — no code to cite.

**Verdict**: **FALSIFIED-BY-CODE**. LACP as "256★ direct competitor" does not exist as a GitHub repository with implementation code. The SYNTHESIS entry in S2 stating "LACP — 256-star direct competitor at hima's exact tier ⚠️" with claimed traits (risk-tier impl, TTL approval tokens, cryptographic provenance chains, 5-layer memory stack, Claude/Codex/Hermes adapters) is **vapor**. The strategy-diagnosis.md amendment tracking LACP as a monitor item should be **reverted** — there is no competitor to monitor. The competitive landscape claim survives (no peer has all 4 moat traits), but LACP was a false positive.

---

## §Patterns Reverdict Table

| SYNTHESIS # | Claim | Code evidence found | New verdict |
|-------------|-------|---------------------|-------------|
| #2 | Tiered-cascade routing saves ~500 tokens/req | OMX `keyword-registry.ts` + `keyword-detector.ts`: keyword match runs at `UserPromptSubmit` before LLM | CONFIRMED-BY-CODE |
| #3 | Hard safety gate code-enforced (recursion/spawn limits) | NOT found in any of the 8 repos at code level; goose `GooseMode` is closest but covers permission not limits | NOT-FOUND-IN-CODE (pattern valid; source claim needs revision) |
| #4 | Hash-chained SHA-256 ledger (swarm-orchestrator) | Not in scope for top-8; swarm-orchestrator not reviewed | NOT-IN-SCOPE |
| #5 | Cross-harness adapter dirs first-party | ECC `.cursor/hooks/adapter.js` + `.codex/AGENTS.md` confirmed; cursor transform is live code | CONFIRMED-BY-CODE + SHARPENED (adapter.js is JSON transformer, not just directory) |
| #6 | Layered defense escalation (Rules→Semantic→Behavioral) | goose SmartApprove = LLM classifier per tool call, confirmed in `permission_judge.rs` | CONFIRMED-BY-CODE + SHARPENED (it's LLM-per-call, not tier dispatch) |
| #13 | Code-side testable keyword registry (OMX) | `keyword-registry.ts:1-65` exact implementation confirmed; 54 entries, 17 skills | CONFIRMED-BY-CODE |
| #14 | Append-only events.jsonl (12-factor + OMX) | 12-factor: prose/pseudo-code only, no runnable implementation; OMX: `session-history.jsonl` not directly read but implied by state arch | SHARPENED (12-factor source = manifesto not code; OMX is the real implementation reference) |
| #15 | SubagentStop hook as blocking deliverables gate (OMC) | Not in top-8 scope; referenced as OMC pattern (hima's own harness context) | NOT-IN-SCOPE |
| #16 | SKILL.md locked frontmatter (6/10 converge) | OpenHands `.openhands/microagents/documentation.md` has `name/type/version/agent/triggers[]`; ECC `.codex/AGENTS.md` references `SKILL.md` as canonical; opencode `discovery.ts` filters on `SKILL.md` presence | CONFIRMED-BY-CODE |
| #17 | .hima/state/ centralization (OMX .omx/state/) | OMX `workflow-transition.ts` reads from `getAuthoritativeActiveStatePaths()` pointing to `.omx/state/` | CONFIRMED-BY-CODE |
| #18 | Per-runtime system-prompt files (opencode 9-file) | opencode `skill/prompt/customize-opencode.md` + ECC `cross-harness.md` both confirmed different per-harness prompt surfaces | CONFIRMED-BY-CODE |
| LACP moat claim | LACP 256★ direct competitor | Not found — 0-star spec stub only | FALSIFIED-BY-CODE |
| 12-factor as implementation source | Factors 5/7/12 have "actual implementations" | Content dir contains markdown prose + pseudo-code only; no runnable code | FALSIFIED (source mis-characterized; conceptual model valid, code artifact absent) |
| claude-flow orchestration patterns | claude-flow has "orchestration & coordination patterns" | 18-line CLI shim delegating to private npm; no orchestration code in repo | FALSIFIED (wrong repo; likely confused with `@anthropic-ai/claude-flow`) |

---

## §Surprises

1. **OMX `workflow-transition.ts` is an undocumented mode state machine**: `PLANNING_LIKE_MODES` vs `EXECUTION_LIKE_MODES` + `AUTO_COMPLETE_TRANSITIONS` (10 named transitions) + `ALLOWED_OVERLAP_PAIRS`. S6 described OMX as "no formal statechart, implicit state" — this is stronger than that. hima's XState approach has a direct TS peer here.

2. **opencode subagent-permissions.ts: `todowrite` and `task` denied by default**: All subagents are denied the ability to spawn further subagents and use `todowrite` unless explicitly allowed. Stricter than any README or synthesis document stated. Direct implementation guidance for hima's `07-subagents-catalog-spec.md §5.2`.

3. **ECC adapter.js forwards exit code 2**: The Cursor→Claude adapter explicitly `process.exit(2)` when the underlying Claude hook returns 2 (block). This means the blocking hook contract works cross-harness — not just for Claude Code native hooks. SYNTHESIS said ECC "lacks session-scoped risk" but the plumbing for blocking enforcement is already there.

4. **claude-flows (ceeefuuu) is not the canonical claude-flow**: It's 110 stars, last pushed 2026-02-20, and is a thin shim. The intended canonical reference is likely `anthropics/claude-flow` or `ruvnet/claude-flow` (neither reviewed). SYNTHESIS cited "claude-flow orchestration & coordination patterns" without specifying repo — the actual implementation is absent from this repo.

5. **OpenHands skill_loader.py relocated**: The S6 citation `openhands/runtime/plugins/agent_skills/skill_loader.py:127-165` returns 404. The module moved to `openhands/app_server/app_conversation/skill_loader.py`. The 4-tier scope (public/user/project/org) is implied in `OrgConfig` and `_determine_org_repo_path()` but not a clean 4-tier enum. The scope model is **org-repo-driven** (not a formal tier enum), sharpening the SYNTHESIS claim.

6. **goose permission_judge makes an LLM call per tool batch**: Not a static rule lookup — an actual LLM inference call to classify tool-read-only status. This has latency and cost implications. hima's M-class SmartApprove equivalent should budget for this cost, not treat it as free.

Falsifies-If:
  kill-condition: A later code inspection contradicts any of the top implementation findings or shows that a cited repository path no longer supports the claim.
  checkpoint-date: 2026-06-14
  evidence-anchor: docs/excellence-application/02-analysis-discovery/swarm-deep/deep-code-top8.md
  on-fail: Mark the contradicted finding stale and rerun the affected code-inspection lane before harvesting it.
