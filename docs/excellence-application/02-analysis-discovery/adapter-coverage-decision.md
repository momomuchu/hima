---
claim-bearing: true
status: ACCEPTED
date: 2026-05-14
supersedes: business-model-proposal.md §3.2 adapter claims (partial)
evidence-source: competitive-harness-scan.md (D1), docs/conception/04-runtime-bindings-spec.md, docs/business-model/business-model-proposal.md §3, docs/business-model/strategy-diagnosis.md Bet B1, docs/goals/LONG-TERM-GOAL.md §2
---

# D2 — Adapter Coverage Decision

## Executive Summary

18 runtimes/tools evaluated from D1. First-party adapter set confirmed at **Claude Code + Codex + Hermes** (3 adapters). Community-adapter SDK opened for **Goose, Aider, Cline/Roo, Mastra, Windsurf**. **Not-supported** (explicit) for **Cursor 3, GitHub Copilot Workspace, Kiro, JetBrains Air, Devin, Sourcegraph Amp, AWS Bedrock AgentCore, Microsoft AGT, OpenHands V1, AGENTS.md spec**. The framing throughout is "governance-portable across runtimes" — the risk policy and compliance artifacts travel with the developer. Multi-runtime portability alone is not a moat claim (D1 §5, Trait 3: five competitors already ship it).

---

## Decision Table

| Runtime | License | 2026 Daily-Driver Pool | hima Decision | Why | Effort to Ship | Falsifies-If Reference |
|---|---|---|---|---|---|---|
| **Claude Code** | Proprietary (MIT hooks layer) | Dominant terminal-native dev; ~2M regular users (D1:§4 row 1) | **first-party** | Primary ICP; 7-hook profile complete (`claude-profile-v2`); `PreToolUse`/`Stop`/`SubagentStart`/`SubagentStop` all blocking; OTel native; installer spec already authored | Shipped in spec — `adapter-claude` exists | LONG-TERM-GOAL.md §2 criterion 2; B1 |
| **Codex CLI** | Proprietary | Second-most-cited terminal agent on HN Q1 2026; AGENTS.md canonical origin (D1:§4 row 2) | **first-party** | HIGH gap per D1; `codex-profile-v1` complete (5/7 gates); `approval reviewer` API at developers.openai.com; AGENTS.md coaltion adoption | `adapter-codex` spec complete; `codex_hooks = true` flag documented | LONG-TERM-GOAL.md §2 criterion 2; B1 |
| **Hermes Agent** | (internal/private) | Confirmed third-party runtime with full plugin+gateway hook surface (D1:§4 row 3 — no star count, ICP direct) | **first-party** | Third confirmed runtime in `04-runtime-bindings-spec.md`; `hermes-profile-v1` complete; `subagent_stop` partial (plugin hook, no hard-block on `stop`); `on_session_end` = `DONE_WITH_GAPS` degradation path | `adapter-hermes` spec complete | LONG-TERM-GOAL.md §2 criterion 2; B1 |
| **Goose** | Apache 2.0 | 29K GitHub stars; Linux Foundation (AAIF); widest open-source provider coverage (D1:§4 row 8 / §3.8) | **community-adapter slot** | AAIF governance aligns with MIT core; extension API + `goose serve` REST are hookable; no first-party effort justified pre-$100K ARR; HIGH gap per D1:§4 | Extension API + REST hook; medium complexity | D1:§4 row 8 |
| **Aider** | Apache 2.0 | 28K GitHub stars; LiteLLM = 100+ providers (D1:§2 row 7) | **community-adapter slot** | Apache 2.0 aligns with MIT core; `.aider.conf.yml` + user-run script = thin adapter surface; no blocking pre_tool hook documented — adapter is informational only; community can fill | `.aider.conf.yml` hook scripts; low complexity | D1:§2 row 7 |
| **Cline / Roo Code** | Apache 2.0 (Cline) / MIT (Roo) | Active fork; VS Code extensions; Claude Code-style PreToolUse hooks via config (D1:§2 row 11) | **community-adapter slot** | License compatible; PreToolUse hooks mirror Claude Code shape — adapter cost near zero for community; VS Code-bound but hook surface is reachable | Claude-style hook config; low complexity | D1:§2 row 11 |
| **Mastra** | MIT | 22K stars; 300K+ weekly npm downloads; TypeScript-native (D1:§3.4) | **community-adapter slot** | MIT license; TypeScript stack matches hima core; OpenBox AI integration already demonstrates adapter pattern; server-side agents not terminal-session ICP — community fills if demand appears | Mastra npm hooks + OpenBox reference pattern; medium complexity | D1:§3.4 |
| **Windsurf** | Proprietary | Significant IDE market share; enterprise RBAC; Cascade Hooks are a real governance surface (D1:§2 row 6) | **community-adapter slot** | Cascade Hooks (`post_cascade_response`, `post_write_code`) are hookable; IDE-bound, not terminal-first ICP; proprietary license limits first-party investment; LOW-MEDIUM gap per D1:§4 | `post_cascade_response` / `post_write_code` hooks; medium complexity | D1:§4 row 6 — [docs.windsurf.com/windsurf/cascade/hooks](https://docs.windsurf.com/windsurf/cascade/hooks) |
| **Cursor 3** | Proprietary | 30K+ paying teams; Background Agents; private plugin marketplace (D1:§2 row 5) | **not-supported** | Proprietary plugin marketplace — no public plugin spec; "different buyer" claim weakening (D1:§3.2 buyer note) but first-party effort requires private SDK access; MEDIUM gap per D1 but closed by community if plugin spec opens | — | D1:§4 row 5 |
| **Kiro (AWS)** | Proprietary | AWS-native IDE; Bedrock-bound; spec-driven (D1:§3.5) | **not-supported** | Bedrock-bound — violates multi-runtime intent; IDE-native, not terminal; no public hook spec beyond EventBridge; different buyer (AWS enterprise ops) | — | D1:§3.5 |
| **GitHub Copilot Workspace** | Proprietary (enterprise) | 30K+ enterprise teams; GA Feb 2026 (D1:§2 row 10) | **not-supported** | Enterprise lock-in; MCP allowlist in preview only; no pre-dispatch policy hook; different buyer (VP/CISO, not individual dev) | — | D1:§2 row 10 |
| **JetBrains Air + Central** | Proprietary | EAP Q2 2026 only; Central not GA (D1:§2 row 13) | **not-supported** | Central EAP — not GA, no stable hook API; revisit when GA and public plugin spec available | — | D1:§2 row 13 |
| **Devin** | Proprietary (SaaS) | Enterprise GA; Slash Commands for skills (D1:§2 row 8) | **not-supported** | Cloud SaaS with no typed hook system; Slash Commands are skill invocation only, not pre-dispatch policy gates; different buyer | — | D1:§2 row 8 |
| **Sourcegraph Amp** | Proprietary | $59/mo enterprise; AGENTS.md support; open API for codebase context (D1:§2 row 14) | **not-supported** | No governance hook surface beyond AGENTS.md context; different buyer (enterprise codebase search, not terminal session governance) | — | D1:§2 row 14 |
| **AWS Bedrock AgentCore** | Proprietary (AWS) | AgentCore SDK 2M+ downloads; cloud-hosted pipelines (D1:§3.3) | **not-supported** | Cloud-only; no terminal session concept; different buyer (cloud ops); relevant post-$100K ARR if enterprise pipeline demands it — reassess at Bet B5 trigger | — | D1:§3.3; strategy-diagnosis.md B5 |
| **Microsoft AGT** | MIT | 1.5K stars; GA April 2026; SDK/middleware layer (D1:§3.1) | **not-supported** | Middleware SDK injected into agent frameworks — not a terminal companion; no session-scoped workflow; governance is action-level security guard, not developer-session quality kernel; monitor for terminal adapter by 2026-09-01 | — | D1 §1 executive summary; strategy-diagnosis.md §1 Falsifies-If checkpoint |
| **OpenHands V1** | MIT | V1 GA 2026; AgentSkills-compliant; SDK (D1:§3.6) | **not-supported** | Replacement agent, not governance layer — per `business-model-proposal.md §3.4` objection map; different ICP | — | D1:§3.6; proposal.md §3.4 |
| **AGENTS.md spec** | Open standard (AAIF) | Read natively by Claude Code, Codex, Cursor, Aider, Devin, Copilot, Windsurf, Gemini CLI, Amazon Q (D1:§2 row 18) | **not-supported** | Static configuration spec, not a runtime — no hook system, no policy engine; hima consumes and emits AGENTS.md-compatible artifacts; it does not adapt *to* the spec as a runtime | — | D1:§2 row 18; proposal.md §3.4 |

---

## Per-Decision Detail — First-Party Adapters

### Claude Code (`adapter-claude`, `claude-profile-v2`)

Gate primitive mapping per `04-runtime-bindings-spec.md §2.8`:

- `pre_tool` → `PreToolUse` (blocking, `exit 2`). Enforces phase write-protection and T/L/M/H/C risk blocks before any tool call. Hook registered via `~/.claude/settings.json`.
- `stop` → `Stop` (blocking, `exit 2` with `continue: true`). Evidence sufficiency check before `DONE_VERIFIED`. Loop if evidence set incomplete.
- `subagent_start` → `SubagentStart` (blocking). Authorizes spawned-agent scope, write zones, and evidence contract. Native hook — no capability gap.
- `subagent_stop` → `SubagentStop` (blocking). Verifies subagent evidence before merge. Full native support.
- Skills → `~/.claude/skills/<name>/SKILL.md`. Auto-invocation by description match. `$ARGUMENTS` + shell injection supported.
- Docs: [Claude Code hooks — Anthropic docs](https://docs.anthropic.com/en/docs/claude-code/hooks); Skills 2.0 frontmatter per D1:§2 row 1.

### Codex CLI (`adapter-codex`, `codex-profile-v1`)

Gate primitive mapping per `04-runtime-bindings-spec.md §2.8`:

- `pre_tool` → `PreToolUse` (blocking, `deny` JSON stdout). Requires `[features] codex_hooks = true` in `~/.codex/config.toml` — installer enforces this flag; without it all hooks are silently inactive (spec §4.2 note).
- `stop` → `Stop` (blocking). Evidence gate before `DONE_VERIFIED`.
- `subagent_start` / `subagent_stop` → **no-op** for unmanaged launches; capability flags `subagent_start_hook: false` / `subagent_stop_hook: false` written to run-set.json. Degradation path: `DONE_WITH_GAPS` if spawned-agent scope was unverified.
- Skills → `~/.agents/skills/<name>/SKILL.md`. TOML subagent conversion via `adapter-codex` transformer.
- Approval hook entry: [developers.openai.com/codex/agent-approvals-security](https://developers.openai.com/codex/agent-approvals-security) (D1:§4 row 2).

### Hermes Agent (`adapter-hermes`, `hermes-profile-v1`)

Gate primitive mapping per `04-runtime-bindings-spec.md §2.8`:

- `pre_tool` → `pre_tool_call` (blocking, `{"action":"block"}` Python dict or JSON stdout). Plugin hook or YAML shell hook in `~/.hermes/config.yaml`.
- `stop` → `on_session_end` (**no hard-block** — not documented as blocking). Fallback: `on_session_finalize` writes final state; incomplete evidence = `DONE_WITH_GAPS`, not `DONE_VERIFIED`. `STOP_UNBLOCKABLE` recorded in run-set.json (spec §9.1).
- `subagent_stop` → `subagent_stop` plugin hook (partial support — not explicitly documented as blocking).
- Skills → `~/.hermes/skills/<name>/SKILL.md`. Gateway hooks (session:start, agent:start, agent:end) available as opt-in advanced mode via `adapter-hermes` extension interface (spec §10.2).
- Docs: Hermes config hooks block per `04-runtime-bindings-spec.md §4.3`.

---

## File-Level Falsifies-If

```yaml
Falsifies-If:
  kill-condition: >
    A competitor hima decided "not-supported" ships a first-party adapter targeting
    the developer-terminal-session tier (not SDK/cloud/IDE layer) within 6 months
    of 2026-05-14 AND that competitor's runtime crosses 50K GitHub stars OR
    100K weekly installs OR is confirmed adopted by ≥3 of hima's current ICP accounts.
    Applies specifically to: Cursor 3 (if plugin spec goes public), JetBrains Air
    (when Central exits EAP), AWS Bedrock AgentCore (if a terminal CLI mode ships),
    Microsoft AGT (if a Claude Code or Codex CLI adapter ships by 2026-09-01 checkpoint).
  checkpoint-date: 2026-11-14 (6 months) + 2026-09-01 (Microsoft AGT specific)
  evidence-anchor: docs/excellence-application/02-analysis-discovery/competitive-harness-scan.md + GitHub release pages of named runtimes
  on-fail: >
    Promote the triggering runtime from not-supported to community-adapter slot within
    30 days. If the runtime simultaneously crosses ≥3 of hima's 4 moat traits at the
    terminal tier, escalate to strategy-diagnosis.md §1 Falsifies-If checkpoint and
    revise positioning within 30 days per the on-fail clause there.
```

---

## Cross-References

- **D1** — `docs/excellence-application/02-analysis-discovery/competitive-harness-scan.md` (inventory source for all decisions above; all D1:§ citations are to that file)
- **Strategy Diagnosis Bet B1** — `docs/business-model/strategy-diagnosis.md §3 B1` (v0.1.0 release gate; adapter coverage ≥3 is a release acceptance criterion)
- **LONG-TERM-GOAL.md §2 criterion 2** — `docs/goals/LONG-TERM-GOAL.md §2` ("adapter coverage ≥3 in production" = acceptance criterion #2; this decision confirms Claude Code + Codex + Hermes as the v1.0 set)
- **Runtime Bindings Spec** — `docs/conception/04-runtime-bindings-spec.md` (adapter interface contract, hook profiles, degradation strategy matrix)
- **Business Model Proposal §3.2** — `docs/business-model/business-model-proposal.md §3.2` (partially superseded: adapter claims revised to reflect community-slot set and not-supported set)
