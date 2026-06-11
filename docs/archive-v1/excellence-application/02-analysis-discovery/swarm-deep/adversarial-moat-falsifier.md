---
claim-bearing: true
status: ACCEPTED
date: 2026-05-14
agent: swarm-deep-adversarial
verdict: REINFORCED
total-searches: 34
closest-to-falsifying: Augment Code Intent (2.5/4) — same as cycle-02 baseline
---

# Adversarial Moat Falsifier — Cycle-02 DS3

## 1. Executive Summary

34 targeted falsification attempts were executed across 16 named competitors, 6 enterprise-tier step-down candidates, and 4 niche/HN-sourced products. No single product at developer-terminal tier was found with ≥3/4 of the four sharpened gap traits in current GA as of 2026-05-14.

The closest product remains **Augment Code Intent at 2.5/4** — unchanged from the cycle-02 swarm baseline. Intent has partial evidence-based completion gates (verifier-agent stage + CI hard gates) and structural audit logging (JSONL per-task traces), but explicitly lacks session-scoped risk classification mapped to regulatory tiers and pre-packaged developer-session-level EU AI Act evidence packs. Augment's own comparative page confirms: "No tool scores high across all four dimensions. The gap is structural: audit-trail portability and session-level evidence packaging remain deployer responsibilities under Article 26."

Two new products emerged as watch-list candidates: **Mistral Vibe 2.0** (terminal-tier, GA January 2026) and **IBM Bob** (SaaS SDLC platform, GA April 2026). Neither reaches 2/4. Three vapor/pre-GA products are flagged for Q3-Q4 2026 monitoring (see §5).

**Verdict: REINFORCED.** The claim holds as of 2026-05-14.

---

## 2. Per-Product Attack Table

| Product | Tier | Trait 1: Session-scoped risk class → regulatory tiers | Trait 2: Evidence-based completion gates | Trait 3: Governance portable across runtimes (policy/artifact layer) | Trait 4: Dev-session EU AI Act evidence packs | Total | Key Citations |
|---------|------|------------------------------------------------------|------------------------------------------|----------------------------------------------------------------------|-----------------------------------------------|-------|---------------|
| **Augment Code Intent** | Developer terminal / workspace | NO — no session-level risk scoring; binary "Tier 1 deployable" classification only | PARTIAL — verifier-agent stage + CI hard gates before PR; no threshold-based risk escalation | PARTIAL — BYOA multi-model; SOC 2 + ISO 42001 certified; audit log per-task (JSONL) but not portable evidence pack | NO — no pre-packaged EU AI Act session evidence pack; "compliance program still has to run risk assessments" | **2.5/4** | augmentcode.com/guides/eu-ai-act-2026 (2026); augmentcode.com/tools/ai-coding-tools-eu-ai-act-compliance (2026) |
| **OpenAI Codex** | Developer terminal (CLI + cloud) | NO — sandbox + approval policy; no regulatory-tier risk classification per session | PARTIAL — configurable approval policies; immutable JSONL compliance logs via Compliance Platform | PARTIAL — OTel export; Compliance Platform for Enterprise; not native cross-runtime policy layer | PARTIAL — closest to Article 12 readiness per Augment eval; but not a self-contained EU AI Act evidence pack | **2/4** | developers.openai.com/codex/agent-approvals-security (2026); augmentcode.com/tools/ai-coding-tools-eu-ai-act-compliance (2026) |
| **Cursor 3** | IDE + terminal (Cloud Agents) | NO — no risk classification; no regulatory-tier mapping documented | NO — no documented escalation thresholds; no completion gate mechanism in GA | PARTIAL — AWS-hosted; enterprise-managed hooks can run policy checks; no portable policy layer | NO — no SIEM export, no interaction log API, no EU AI Act evidence documentation | **0.5/4** | augmentcode.com/tools/ai-coding-tools-eu-ai-act-compliance (2026); codeslick.dev/blog/eu-ai-act-audit-trail-2026 (2026) |
| **Windsurf** | IDE + terminal | NO — no session risk classification | NO — no completion gate in GA | NO — SOC 2/HIPAA/FedRAMP/ITAR certs but no runtime policy portability | NO — GDPR compliance documentation not publicly available; no EU AI Act evidence pack | **0/4** | weavai.app/blog/sourcegraph-cody-review-2026 (2026); witness.ai/blog/windsurf-security (2026) |
| **Devin** | Cloud execution / terminal | NO — enterprise commit-email lock and audit trail for commit attribution only | NO — no risk-based completion gates; SWE-agent model | NO — vendor-controlled cloud environment; session governance limited to secure mode toggle | NO — no EU AI Act evidence pack; documented security incidents (token exposure) | **0/4** | docs.devin.ai/release-notes/2026 (2026); pillar.security/blog/hidden-security-risks-swe-agents (2026) |
| **OpenHands V1** | Terminal / Agent Control Plane | NO — sandbox isolation + least-privilege; no regulatory-tier session risk classification | PARTIAL — every action logged and traceable; sandboxed execution; but no formal evidence-gated completion | NO — Agent Control Plane is orchestration layer; no portable policy/artifact layer across external runtimes | NO — no EU AI Act evidence pack; compliance documentation manual | **1/4** | businesswire.com/news/home/20260506314667 (2026); openhands.dev (2026) |
| **Junie CLI (JetBrains)** | Terminal / IDE / CI | NO — Action Allowlist + bash-command approval; no regulatory-tier risk classification | NO — no evidence-based completion gates documented | PARTIAL — LLM-agnostic (BYOK); portable across environments (IDE/terminal/CI/CD) | NO — no EU AI Act evidence pack in any announcement | **0.5/4** | blog.jetbrains.com/junie/2026/03/junie-cli (2026); devops.com/jetbrains-launches-air-and-junie-cli (2026) |
| **Sourcegraph Amp** | Terminal + CLI | NO — no session risk classification | NO — no completion gates documented | NO — SOC 2 + ISO 27001; no runtime policy portability | NO — no EU AI Act evidence pack | **0/4** | weavai.app/blog/sourcegraph-cody-review-2026 (2026); sourcegraph.com/amp (2026) |
| **Google Antigravity** | IDE (public preview, not terminal) | NO — unified permissions system (v1.22.2, Apr 2026); no regulatory-tier risk classification | NO — Agent Manager supervisory UI; no mandatory approval gates per Article 14 | NO — Google Cloud hosted; no portable governance layer | NO — no compliance-grade immutable logs; no EU AI Act evidence pack | **0/4** | authorityaitools.com/blog/google-antigravity (2026); augmentcode.com/tools/intent-vs-antigravity (2026) |
| **Goose (Block)** | Terminal / local | NO — guardrails + CORS model (Jan 2026 blog); no regulatory-tier risk classification | NO — no evidence-based completion gates | NO — local architecture; GDPR BYOM; no portable policy layer across runtimes | NO — no EU AI Act evidence pack; red-team hacked via prompt injection (Operation Pale Fire, Jan 2026) | **0/4** | block.github.io/goose/blog/2026/01/05/agentic-guardrails (2026); paperclipped.de/en/blog/goose-block (2026) |
| **Aider** | Terminal | NO — no compliance features documented 2026 | NO — no completion gates | NO — no governance portability | NO — no EU AI Act features | **0/4** | No 2026 EU Act compliance source found |
| **Continue** | IDE extension / terminal | NO — no compliance features documented 2026 | NO — no completion gates | NO — open-source; no governance portability layer | NO — no EU AI Act evidence pack | **0/4** | aiagentslist.com/agents/continue (2026) |
| **Cline** | IDE/terminal extension | NO — no compliance features documented 2026 | NO | NO | NO | **0/4** | No 2026 EU Act compliance source found |
| **Manus AI** | General agent (not dev-terminal tier) | DISQUALIFIED — not developer-terminal tier; acquired/blocked by Chinese NDRC Apr 2026 | — | — | — | N/A | morganlewis.com/pubs/2026/05/the-manus-decision (2026) |
| **Mistral Vibe 2.0** | Terminal (GA Jan 2026) | NO — EU hosting + DPA options; explicitly classified as NOT high-risk; no session-level risk classification | NO — clarification prompts before ambiguous action; not evidence-gated | NO — on-premise option for regulated industries; no portable policy/artifact layer | NO — no EU AI Act session evidence pack; obligations "come into force August 2, 2026" implying not yet implemented | **0/4** | legal.mistral.ai/ai-governance/ai-systems/mistral-code (2026); datacamp.com/blog/mistral-vibe-2-0 (2026) |
| **IBM Bob** | SaaS SDLC platform (GA Apr 28 2026) | NO — real-time policy enforcement + sensitive data scanning; no session-level regulatory-tier risk classification | PARTIAL — configurable approval checkpoints (manual/auto per task type); BobShell self-documenting traces | PARTIAL — multi-model routing (Claude/Mistral/Granite); real-time policy enforcement; but primary SaaS delivery model, not portable policy/artifact layer | NO — no EU AI Act evidence pack mentioned; bob.ibm.com SaaS, not terminal companion | **1/4** | newsroom.ibm.com/2026-04-28-introducing-ibm-bob (2026); devclass.com/development/2026/04/29/ibms-ai-coding-partner-bob (2026) |
| **Keycard** | Governance MIDDLEWARE — DISQUALIFIED | Not a coding companion; it is identity/access infrastructure that sits atop coding agents | Provides session-scoped access controls + credential rotation but is not itself a coding companion | YES — portable policy vocabulary across agents (one-policy-across-runtimes design) | NO — session trace logging with risk-tier-based retention (90d vs 5yr) but not an EU AI Act evidence pack product | N/A — wrong tier | globenewswire.com/news-release/2026/03/19/3259248 (2026) |
| **Microsoft Agent Governance Toolkit** | Open-source MIDDLEWARE — DISQUALIFIED | Not a coding companion; SDK wrapping LangChain/CrewAI/etc. | Regulatory framework mapping (EU AI Act + HIPAA + SOC2) + OWASP evidence collection | YES — cross-framework hooks (Python/TS/Rust/Go/.NET) | YES — OWASP Agentic Top 10 evidence collection, EU AI Act compliance grading | N/A — wrong tier | opensource.microsoft.com/blog/2026/04/02 (2026); github.com/microsoft/agent-governance-toolkit (2026) |
| **GitHub Copilot** | IDE extension (not terminal companion tier) | NO — minimal/limited risk classification under EU AI Act; no session risk classification | NO — no completion gates | NO — no portable governance layer | NO — no EU AI Act evidence pack; Business/Enterprise: no training on code | **0/4** | upnorth.ai/en/insights/ai-act-github-copilot (2026) |

---

## 3. Niche-Search Dump

### Queries run and outcomes

| # | Query | Result | Discard reason |
|---|-------|--------|----------------|
| 1 | Cursor 3.0 2026 compliance governance risk classification | No Cursor-specific EU AI Act features found | No falsifying evidence |
| 2 | Windsurf coding agent 2026 EU AI Act compliance governance | SOC 2/HIPAA/FedRAMP certs only; no 4 traits | No falsifying evidence |
| 3 | Augment Code Intent 2026 risk classification completion gates | Partial gates + JSONL logs; confirmed 2.5/4 | Confirms cycle-02 baseline |
| 4 | Augment Code Intent EU AI Act evidence pack session risk | "Compliance program still has to run risk assessments" — Augment's own page | Confirms gap |
| 5 | Devin coding agent governance compliance risk classification 2026 | Commit-email lock + secure mode only; security incidents documented | No falsifying evidence |
| 6 | OpenHands v1 2026 compliance governance audit trail | Sandbox logging + least-privilege; no regulatory-tier classification | No falsifying evidence |
| 7 | JetBrains Junie AI 2026 compliance governance risk terminal | Action Allowlist + BYOK; no regulatory compliance features | No falsifying evidence |
| 8 | Sourcegraph Cody Amp 2026 EU AI Act evidence compliance | SOC 2 + ISO 27001 only; no EU AI Act features | No falsifying evidence |
| 9 | Goose coding agent Block 2026 governance compliance | CORS model guardrails; hacked via prompt injection Jan 2026 | No falsifying evidence |
| 10 | Aider coding agent 2026 compliance governance EU AI Act | No 2026 compliance features found for Aider specifically | No falsifying evidence |
| 11 | Continue dev coding agent 2026 governance compliance | Microsoft Agent Governance Toolkit surfaced (middleware, not companion) | Wrong tier |
| 12 | Cline coding agent 2026 EU AI Act compliance risk | No specific Cline compliance features found | No falsifying evidence |
| 13 | Microsoft Agent Governance Toolkit developer terminal | Middleware SDK confirmed; not a coding companion | Wrong tier — disqualified |
| 14 | Factory AI coding agent 2026 developer terminal compliance | No "Factory AI" product found at developer-terminal tier in 2026 | Not found |
| 15 | "session-scoped risk" OR "session risk classification" coding agent | Keycard session-scoped access controls found — governance middleware not companion | Wrong tier |
| 16 | GitHub Copilot 2026 EU AI Act evidence session risk classification | Minimal/limited risk; no session risk features | No falsifying evidence |
| 17 | IBM watsonx Code Assistant 2026 EU AI Act regulatory compliance | Model-level governance; repository/code-level oversight gap acknowledged | No falsifying evidence |
| 18 | "governance portable" OR "policy portable" coding agent runtime 2026 | Keycard (middleware) + ServiceNow Build Agent (not terminal companion) | Wrong tier |
| 19 | Keycard runtime governance coding agent 2026 session risk regulatory tiers | Confirmed: governance middleware product, not a coding companion | Wrong tier — disqualified |
| 20 | OpenAI Codex CLI 2026 EU AI Act compliance evidence session | Compliance Platform for Enterprise: closest to Article 12; but no session risk classification or evidence pack | Confirmed 2/4 |
| 21 | Cursor 2026 enterprise compliance audit trail EU AI Act | No log export API; no session evidence documented; compliance gaps confirmed | No falsifying evidence |
| 22 | Accenture IBM developer terminal coding agent EU AI Act 2026 | IBM Bob announced Apr 28 2026 — new lead | Investigated separately |
| 23 | IBM Bob BobShell 2026 EU AI Act compliance session risk | No regulatory-tier session classification; no EU AI Act evidence pack | Confirmed 1/4 |
| 24 | OpenHands agent control plane 2026 session risk EU AI Act | Least-privilege + sandbox logging only; no regulatory compliance features | No falsifying evidence |
| 25 | Coding agent EU AI Act evidence pack compliance Q3 Q4 roadmap | No product roadmap announcing all 4 traits | No falsifying evidence |
| 26 | HN: Open-source EU AI Act compliance layer for AI agents | AIR Blackbox confirmed as middleware layer (LangChain/CrewAI hooks); not a coding companion | Wrong tier |
| 27 | Cursor Windsurf 2026 Q3 Q4 roadmap EU AI Act session governance | No Q3/Q4 compliance roadmap announced by either | No falsifying evidence |
| 28 | r/AICoding r/devops coding agent compliance EU AI Act 2026 | General EU AI Act discussion; no product with 4 traits surfaced | No falsifying evidence |
| 29 | Antigravity Google coding agent 2026 EU AI Act compliance evidence | Unified permissions (v1.22.2) only; public preview; no EU AI Act features | No falsifying evidence |
| 30 | Junie CLI JetBrains EU AI Act session risk evidence completion gate | No EU AI Act features documented for Junie CLI | No falsifying evidence |
| 31 | Mistral Vibe 2.0 terminal coding agent EU AI Act evidence session risk | Self-classified NOT high-risk; EU hosting + DPA options only; no session evidence pack | Confirmed 0/4 |
| 32 | "completion gate" "evidence-based gate" coding terminal agent 2026 regulatory | Stop-hook quality gates pattern (Anthropic/Claude Code ecosystem); no competing product ships all 4 traits | No falsifying evidence |
| 33 | Coding agent governance EU AI Act session risk classification evidence 2026 GA | No product shipping all 4 traits found | No falsifying evidence |
| 34 | Augment Code Intent 2026 session-scoped regulatory tier GA features | "session-scoped" term absent from all Augment documentation; confirmed gap | Confirms 2.5/4 ceiling |

### Notable discards

- **Keycard** (Mar 2026): governance middleware only; not a developer-terminal coding companion. Disqualified on tier filter.
- **Microsoft Agent Governance Toolkit** (Apr 2026): open-source middleware SDK; integrates into LangChain/CrewAI/etc.; not a coding companion. Would score 3-4/4 if it were — makes it the most instructive near-miss.
- **AIR Blackbox** (HN, Feb 2026): compliance middleware for agent frameworks; not a coding companion.
- **Manus AI**: general-purpose agent; acquired/blocked by China NDRC Apr 2026; not developer-terminal tier.
- **ServiceNow Build Agent**: plugs into Cursor/Windsurf/Claude Code as a governed task layer; not a standalone coding companion.

---

## 4. Watch List — Vapor / Pre-GA Products That Could Falsify in Q3-Q4 2026

These products do NOT currently falsify the claim but represent the highest-probability threat vectors before the 2026-12-31 deadline.

| Product | Current State | Traits Already Present | Missing Traits | Falsification Risk | Checkpoint Date |
|---------|--------------|----------------------|----------------|-------------------|-----------------|
| **OpenAI Codex (Enterprise tier upgrade)** | GA with Compliance Platform for Enterprise; 2/4 | Evidence logs (JSONL, OTel) + partial completion gates | Session-scoped risk classification → regulatory tiers; self-contained EU AI Act evidence pack | HIGH — OpenAI has the compliance infrastructure (Compliance Platform) and is expanding enterprise features; one product release could add risk-tier classification and pre-packaged evidence packs | 2026-09-01 |
| **Augment Code Intent (v2+ or compliance SKU)** | Public beta Feb 2026; 2.5/4 | Partial completion gates + structural audit logs + ISO 42001 | Session-scoped regulatory-tier risk classification; pre-packaged EU AI Act evidence packs | HIGH — Augment has published the most EU AI Act-aware content of any competitor; a "compliance tier" SKU targeting Aug 2026 enforcement deadline is plausible | 2026-09-01 |
| **Microsoft AGT + GitHub Copilot bundle** | AGT: open-source middleware (Apr 2026); Copilot: 0/4 | AGT has portable policy + EU AI Act evidence collection | Neither individually is a terminal coding companion; no integrated product announced | MEDIUM — Microsoft could bundle AGT governance into Copilot CLI/Copilot Workspace; would instantly reach 3-4/4 if shipped as integrated terminal companion | 2026-09-01 |
| **Kiro (AWS, spec-check GA)** | Beta/preview; 1.5/4 | Spec-driven audit trail (requirements→design→tasks); Bedrock-native (governance-portable within AWS) | Session risk classification → regulatory tiers; EU AI Act evidence pack | MEDIUM — AWS published "5 ways to use Kiro and Amazon Q to strengthen your security posture" (May 2026); EU AI Act compliance features for Kiro are plausible given AWS's compliance infrastructure | 2026-09-01 |

---

## 5. Verdict Recommendation to strategy-diagnosis.md

**Verdict: REINFORCED** — The claim holds as of 2026-05-14.

No product at developer-terminal tier ships ≥3/4 of the four sharpened gap traits in current GA. The highest confirmed score is 2.5/4 (Augment Code Intent), identical to the cycle-02 swarm baseline. The claim is not falsified.

However, the watch list contains three HIGH-probability threats (OpenAI Codex enterprise upgrade, Augment Intent compliance SKU, Microsoft AGT+Copilot bundle) that could falsify the claim before 2026-12-31 without further product investment from hima. The moat is time-bounded, not structural.

**Recommended edit to strategy-diagnosis.md §1 second Falsifies-If — NO EDIT REQUIRED.** The falsification condition was not triggered.

**Recommended addition to strategy-diagnosis.md §1 — Monitoring note:**

> Monitoring checkpoint 2026-09-01: re-run adversarial scan against OpenAI Codex enterprise tier, Augment Intent compliance SKU, Microsoft AGT+Copilot CLI integration, and AWS Kiro GA release. Any of these reaching 3/4 traits in GA would trigger claim falsification and require immediate positioning pivot.

---

## 6. Sources

| URL | Author / Publisher | Date | Used For |
|-----|--------------------|------|----------|
| https://www.augmentcode.com/tools/ai-coding-tools-eu-ai-act-compliance | Augment Code | 2026 | Per-product scoring across 7 tools including Intent, Codex, Cursor, Kiro, Devin, Antigravity |
| https://www.augmentcode.com/guides/eu-ai-act-2026 | Augment Code | 2026 | EU AI Act obligations for coding agents; Intent compliance architecture |
| https://developers.openai.com/codex/agent-approvals-security | OpenAI | 2026 | Codex approval policies, sandbox, compliance logs |
| https://newsroom.ibm.com/2026-04-28-introducing-ibm-bob-ai-development-partner-that-takes-enterprises-from-ai-assisted-coding-to-production-ready-software | IBM | 2026-04-28 | IBM Bob features: BobShell, policy enforcement, approval checkpoints |
| https://opensource.microsoft.com/blog/2026/04/02/introducing-the-agent-governance-toolkit-open-source-runtime-security-for-ai-agents | Microsoft | 2026-04-02 | Agent Governance Toolkit: EU AI Act mapping, OWASP evidence, cross-runtime portability |
| https://github.com/microsoft/agent-governance-toolkit | Microsoft | 2026 | AGT architecture, compliance grading, regulatory framework mapping |
| https://www.globenewswire.com/news-release/2026/03/19/3259248/0/en/Keycard-Releases-Runtime-Governance-for-Autonomous-Coding-Agents.html | Keycard / GlobeNewswire | 2026-03-19 | Keycard: governance middleware tier, session-scoped credential controls |
| https://blog.jetbrains.com/junie/2026/03/junie-cli-the-llm-agnostic-coding-agent-is-now-in-beta/ | JetBrains | 2026-03 | Junie CLI: terminal tier, Action Allowlist, no compliance features |
| https://legal.mistral.ai/ai-governance/ai-systems/mistral-code | Mistral AI | 2026 | Mistral Code: NOT high-risk classification; obligations from Aug 2, 2026 |
| https://www.datacamp.com/blog/mistral-vibe-2-0 | DataCamp | 2026 | Mistral Vibe 2.0: terminal-tier, GA January 2026, governance features |
| https://www.businesswire.com/news/home/20260506314667/en/OpenHands-Launches-an-Agent-Control-Plane-to-Manage-Software-Agents | OpenHands / BusinessWire | 2026-05-06 | OpenHands Agent Control Plane: sandbox logging, least-privilege, no regulatory features |
| https://docs.devin.ai/release-notes/2026 | Cognition / Devin | 2026 | Devin 2026 features: commit email lock, secure mode, Fast Mode |
| https://www.pillar.security/blog/the-hidden-security-risks-of-swe-agents-like-openai-codex-and-devin-ai | Pillar Security | 2026 | Devin: documented security incidents (token exposure, malware) |
| https://block.github.io/goose/blog/2026/01/05/agentic-guardrails-and-controls/ | Block / Goose | 2026-01-05 | Goose CORS guardrails model; Operation Pale Fire red-team compromise |
| https://www.geekwire.com/2026/aws-targets-ai-slop-with-new-spec-check-in-kiro-coding-tool-amid-scrutiny-of-agent-reliability/ | GeekWire | 2026 | Kiro spec-check feature; 13-hour production outage incident |
| https://news.ycombinator.com/item?id=47141347 | HN / AIR Blackbox | 2026-02 | AIR Blackbox: compliance middleware (LangChain/CrewAI); not a coding companion |
| https://codeslick.dev/blog/eu-ai-act-audit-trail-2026 | CodeSlick | 2026 | Cursor audit trail gaps: no log export API, no session evidence |
| https://devops.com/jetbrains-launches-air-and-junie-cli-to-blend-traditional-ide-with-ai-agents/ | DevOps.com | 2026 | Junie CLI launch: terminal tier, governance features scope |
| https://awesomeagents.ai/reviews/review-augment-code-intent/ | Awesome Agents | 2026 | Intent review: orchestration, SOC 2 + ISO 42001, compliance architecture |
| https://www.devclass.com/development/2026/04/29/ibms-ai-coding-partner-bob-hits-general-availability/5219012 | DevClass | 2026-04-29 | IBM Bob GA: BobShell, SDLC governance, approval checkpoints |
| https://artificialintelligenceact.eu/high-level-summary/ | EU AI Act (official) | 2024-2026 | EU AI Act risk classification framework, Article 12 logging, August 2026 deadline |

Falsifies-If:
  kill-condition: A later adversarial scan finds a competitor or source that invalidates the moat-falsifier verdicts or unsupported-claim boundaries.
  checkpoint-date: 2026-06-14
  evidence-anchor: docs/excellence-application/02-analysis-discovery/swarm-deep/adversarial-moat-falsifier.md
  on-fail: Reopen the deep discovery synthesis and remove or amend the affected moat claim before reuse.
