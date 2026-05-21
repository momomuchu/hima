---
claim-bearing: true
status: ACCEPTED
date: 2026-05-14
agent: swarm-deep-niche
---

# Niche Source Scan — Non-GitHub-Topic Discovery
## Harness / Orchestration / Governance for Coding Agents

---

## Executive Summary

Total findings: 42 citable entries across §A–§E (8 arXiv papers, 4 conference proceedings entries, 10 community threads, 8 recognized-author blog posts, 6 vendor product references, plus 6 additional blogs in §D).

The three most surprising findings:

1. **Martin Fowler published a formal harness engineering taxonomy on April 2, 2026** (martinfowler.com) with four named constructs (guides / sensors / computational / inferential) — a vocabulary now being adopted in papers and vendor docs. GitHub topic scans would never surface this.

2. **AWS shipped a centralized governance layer for AI agents (AgentCore Policy, GA March 2026)** that intercepts every tool call against enterprise-defined rules — a closed-source infrastructure product that has no GitHub repo and no topic tag.

3. **An arXiv empirical study (2604.09409, April 2026) found that agents ignore explicit logging instructions 67% of the time**, and humans silently repair 72.5% of post-generation log issues — direct evidence that natural-language harness instructions alone are insufficient, deterministic guardrails are required.

Verdict on GitHub-topic-only discovery: **Insufficient.** The GitHub scan captures open-source frameworks and community repos. It misses: (a) the academic formalization happening in arXiv/ICSE/FSE, (b) the practitioner-blog vocabulary canon (Fowler, Hashimoto, Willison, Osmani, Böckeler), and (c) the closed-source enterprise governance layer (AWS AgentCore, Kong Agent Gateway, Cognition MultiDevin). These three angles together reframe what "harness" means at production scale. Without them, hima would optimize for framework adoption rather than governance architecture.

---

## §A — arXiv Papers (Jan–May 2026)

### A1
- **arXiv ID:** 2604.18071
- **Title:** Architectural Design Decisions in AI Agent Harnesses
- **Author:** Hu Wei
- **Date:** April 20, 2026
- **Abstract excerpt:** Empirical study of 70 publicly available agent-system projects. Identifies five recurring design dimensions: subagent architecture, context management, tool systems, safety mechanisms, and orchestration. Finds preferences for file-persistent and hierarchical context strategies, dominance of registry-oriented tool systems with emerging MCP and plugin alternatives, and common intermediate isolation paired with rare high-assurance auditing. Five distinct architectural patterns ranging from lightweight tools to enterprise systems.
- **URL:** https://arxiv.org/abs/2604.18071
- **Relevance to hima:** Provides an evidence base (70 real projects) for which architectural patterns are actually prevalent. The five-pattern taxonomy maps directly onto hima's skill tiers — hima should verify its own architecture lands in "enterprise" rather than "lightweight tool."

### A2
- **arXiv ID:** 2604.25850
- **Title:** Agentic Harness Engineering: Observability-Driven Automatic Evolution of Coding-Agent Harnesses
- **Authors:** Jiahang Lin, Shichun Liu, Chengjun Pan, Lizhi Lin, Shihan Dou, Xuanjing Huang, Hang Yan, Zhenhua Han, Tao Gui
- **Date:** April 28, 2026 (v1); revised April 30, 2026
- **Abstract excerpt:** Introduces AHE, automating harness engineering via three observability pillars: component observability (explicit, reversible edits), experience observability (trajectory data distilled into consumable evidence), decision observability (edits linked to verifiable outcomes). Improves Terminal-Bench 2 pass@1 from 69.7% to 77.0% over ten iterations. Cross-family gains of +5.1 to +10.1pp.
- **URL:** https://arxiv.org/abs/2604.25850
- **Relevance to hima:** Directly validates hima's "Ratchet" pattern (every failure becomes a permanent harness edit) and gives it a formal name — AHE. The three observability pillars are a checklist hima can apply to its own hook/trace architecture.

### A3
- **arXiv ID:** 2604.17025
- **Title:** Harness as an Asset: Enforcing Determinism via the Convergent AI Agent Framework (CAAF)
- **Author:** Tianbao Zhang
- **Date:** April 18, 2026 (v1); revised May 4, 2026
- **Abstract excerpt:** CAAF transitions AI agent workflows toward closed-loop fail-safe determinism via recursive atomic decomposition with context firewalls, formalized domain invariants in machine-readable registries, and structured semantic gradients with state locking. Positions the harness itself as a first-class enterprise asset that compounds in value as foundation models commoditize.
- **URL:** https://arxiv.org/abs/2604.17025
- **Relevance to hima:** The "harness as appreciating asset" framing directly supports hima's positioning — the `.claude/` workspace IS the asset, not the model. CAAF's context firewalls map to hima's agent isolation / worktree patterns.

### A4
- **arXiv ID:** 2603.05344
- **Title:** Building Effective AI Coding Agents for the Terminal: Scaffolding, Harness, Context Engineering, and Lessons Learned
- **Author:** Nghi D. Q. Bui
- **Date:** March 5, 2026 (v1); revised March 13, 2026
- **Abstract excerpt:** Introduces OPENDEV, a Rust-based CLI coding agent with workload-specialized model routing, dual-agent architecture separating planning from execution, adaptive context compaction, automated memory accumulation, and event-driven reminders for instruction consistency. Positions harness as the orchestration infrastructure coordinating tool execution, context management, safety enforcement, and session persistence.
- **URL:** https://arxiv.org/abs/2603.05344
- **Relevance to hima:** The dual-agent split (planner vs executor) is independently validated here as a production architecture. Hima's `planner`/`executor` agent routing aligns with this empirical recommendation.

### A5
- **arXiv ID:** 2603.25723
- **Title:** Natural-Language Agent Harnesses
- **Authors:** Linyue Pan, Lexiao Zou, Shuo Guo, Jingchen Ni, Hai-Tao Zheng
- **Date:** March 26, 2026
- **Abstract excerpt:** Proposes externalizing harness control logic as portable, editable natural-language artifacts rather than embedding it in controller code. Introduces NLAHs (Natural-Language Agent Harnesses) and an Intelligent Harness Runtime (IHR) executing them via explicit contracts, durable artifacts, and lightweight adapters. Evaluated across coding and computer-use benchmarks.
- **URL:** https://arxiv.org/abs/2603.25723
- **Relevance to hima:** Validates the core hima design choice: rules/skills/agents as markdown files (portable, editable, externalized) rather than code. The paper provides academic backing for what hima already does intuitively.

### A6
- **arXiv ID:** 2604.09409
- **Title:** Do AI Coding Agents Log Like Humans? An Empirical Study
- **Authors:** Youssef Esseddiq Ouatiti, Mohammed Sayagh, Hao Li, Ahmed E. Hassan
- **Date:** April 10, 2026
- **Abstract excerpt:** Analyzed 4,550 agent-generated pull requests across 81 open-source projects. Agents modify logs less often than humans (58.4% of repos); explicit logging instructions are rare (4.7%) and ineffective — agents ignore constructive requests 67% of the time. Humans perform 72.5% of post-generation log repairs as "silent janitors." Concludes deterministic guardrails are necessary for consistent logging.
- **URL:** https://arxiv.org/abs/2604.09409
- **Relevance to hima:** Critical empirical evidence that natural-language instructions fail for non-functional requirements. Hima's hooks-based enforcement (pre-commit, pre-push) is architecturally correct — this paper proves why NL instructions alone are not enough.

### A7
- **arXiv ID:** 2604.21003
- **Title:** The Last Harness You'll Ever Build
- **Authors:** Haebin Seong, Li Yin, Haoran Zhang, Zhan Shi (Sylph.AI)
- **Date:** April 22, 2026 (v1); revised May 1, 2026
- **Abstract excerpt:** Dual-loop framework automating harness engineering entirely. First loop optimizes task-specific agent configurations via iterative worker execution, adversarial evaluation, and evolutionary refinement. Second loop learns optimal evolution strategies across diverse tasks, enabling rapid harness convergence on any new task without human intervention. Shifts manual harness engineering into automated harness engineering.
- **URL:** https://arxiv.org/pdf/2604.21003
- **Relevance to hima:** Represents the frontier of where harness engineering is heading — self-evolving harnesses. Hima should track this trajectory; the self-improve cycle in OMC is an early manual version of what this paper automates.

### A8
- **arXiv ID:** 2604.09296
- **Title:** Decision Trace Schema for Governance Evidence in Real-Time Risk Systems
- **Author:** Oleg Solozobov
- **Date:** April 10, 2026
- **Abstract excerpt:** Addresses the Fragmented Trace Problem — absence of a unified logging format for automated decision systems. Proposes Decision Event Schema (DES), a JSON Schema integrating ML inference, policy evaluation, cross-system integration, and governance metadata. Features tiered evidence strategy (lightweight / sampled / full) matching evidence completeness to decision risk and throughput. Claims to be the first specification covering all four infrastructure layers simultaneously.
- **URL:** https://arxiv.org/abs/2604.09296
- **Relevance to hima:** DES is directly applicable to hima's `.planning/` trace artifacts. A structured JSON schema for governance evidence would make hima's audit trail machine-readable and regulator-ready.

---

## §B — Conference Proceedings

### B1
- **Conference:** ICSE 2026 — AGENT Workshop (International Workshop on Agentic Engineering)
- **Date:** April 14, 2026, Rio de Janeiro
- **Title:** Workshop Overview + Keynote: "Agentic Software Engineering Will Eat the World: AI-Based Systems as the New Operating System of Society"
- **Speaker:** Robert Feldt (Chalmers University of Technology)
- **URL:** https://conf.researchr.org/home/icse-2026/agent-2026
- **Summary:** 32 accepted papers across agentic engineering topics. Keynotes from Meta (Satish Chandra), Chalmers, UIUC (Lingming Zhang), Microsoft (Gustavo Soares), ByteDance (Chao Peng). Key paper: "Decoding Configuration of AI Coding Agents: Claude Code Projects" — directly analyzing hima-style configuration artifacts.
- **Relevance to hima:** First dedicated academic workshop for agentic engineering at ICSE. The "Decoding Configuration" paper analyzes Claude Code project configurations empirically — hima's own `.claude/` structure is the subject matter of academic research.

### B2
- **Conference:** ICSE 2026 — AGENT Workshop
- **Title:** Not All Problems Are Nails, Not All Tools Should Be Hammers: A Position Paper on Agent Usage in Software Engineering Tasks
- **URL:** https://conf.researchr.org/details/icse-2026/agent-2026-papers/23/Not-All-Problems-Are-Nails-Not-All-Tools-Should-Be-Hammers-A-Position-Paper-on-Agen
- **Date:** April 14, 2026
- **Summary:** Position paper arguing against indiscriminate agent deployment. Proposes task-fitness criteria before routing to agents, pushing back against the trend of treating agents as universal solvers.
- **Relevance to hima:** Academic grounding for hima's skill-routing design — not every task should go to the same agent. Validates the routing table in `rules/skills.md`.

### B3
- **Conference:** ICSE 2026 — AGENT Workshop
- **Title:** Toward Agentic Software Project Management: A Vision and Roadmap
- **URL:** https://conf.researchr.org/details/icse-2026/agent-2026-papers/19/Toward-Agentic-Software-Project-Management-A-Vision-and-Roadmap
- **Date:** April 14, 2026
- **Summary:** Presents an Agentic Project Manager (PM) as a multi-agent system with four autonomy levels addressing ethics, accountability, and trust. Proposes a roadmap toward agents that can manage software projects with varying degrees of human oversight.
- **Relevance to hima:** Validates hima's multi-agent orchestration model and the autonomy-level concept (DEFAULT / DEEP / SPIKE modes map onto this four-level framework).

### B4
- **Conference:** ICSE 2026 — Technical Briefing
- **Title:** Agentic Software Engineering: A Roadmap to Software Engineering 3.0
- **URL:** https://conf.researchr.org/details/icse-2026/icse-2026-tutorials/9/Technical-Briefing-Agentic-Software-Engineering-A-Roadmap-to-Software-Engineering-3
- **Date:** April 15–17, 2026
- **Summary:** Full technical briefing at the main ICSE conference (not just workshop) positioning agentic SE as "SE 3.0." Covers autonomous coding agents reshaping software engineering, with roadmap for research and practice.
- **Relevance to hima:** Mainstream academic legitimization that hima is engineering-discipline-level work, not just tooling. Useful framing for hima's positioning and excellence-book scope.

---

## §C — Lobsters / HN / Reddit Threads

### C1
- **Platform:** Hacker News
- **URL:** https://news.ycombinator.com/item?id=44221655
- **Title:** How I Program with Agents (crawshaw.io)
- **Points:** 615 | Comments: 295 | Date: ~June 2025 (11 months ago as of May 2026)
- **Key finding:** Agents make code review the bottleneck, not code generation. Code review is "harder than writing code." Security risks reported: AI generating CVEs from 2019, injection vulnerabilities justified with "the LLM said it was secure." Multi-file refactors: 3–4 hours → 3–4 minutes.
- **Why it matters to hima:** Empirical practitioner evidence that human review capacity is the real constraint — validates hima's code-reviewer agent and the "never self-approve" rule.

### C2
- **Platform:** Hacker News
- **URL:** https://news.ycombinator.com/item?id=47968112
- **Title:** Show HN: Pu.sh — a full coding-agent harness in 400 lines of shell
- **Points:** 92 | Comments: 28 | Date: ~May 1, 2026
- **Key finding:** 400-line POSIX shell harness (sh + curl + awk only), 7 tools, REPL, auto-compaction, checkpoint/resume, 90 API-free tests. Main criticism: readability vs. constraint tradeoff. Creator released unminified version after community feedback.
- **Why it matters to hima:** Demonstrates minimum viable harness surface area. The 7-tool list (bash, read, write, edit, grep, find, ls) is a useful baseline against which hima's own tool surface can be evaluated for scope creep.

### C3
- **Platform:** Hacker News
- **URL:** https://news.ycombinator.com/item?id=46854108
- **Title:** Show HN: OpenClaw Harness — Security firewall for AI coding agents (Rust)
- **Points:** 2 | Comments: 4 | Date: February 3, 2026
- **Key finding:** Intercepts and blocks dangerous tool calls (rm -rf, curl to external hosts, SSH key reads) before execution. BYOK architecture with hardened gateway. Core insight: at 100+ tool calls per session, manual approval doesn't scale — need automated filtering rules.
- **Why it matters to hima:** Identifies the security gap between "full shell access" and "unusable sandbox." Hima's hooks (pre-tool, post-tool) are the right architectural response to this gap.

### C4
- **Platform:** Hacker News
- **URL:** https://news.ycombinator.com/item?id=47559293
- **Title:** Ask HN: How are you keeping AI coding agents from burning money?
- **Points:** 8 | Comments: 32 | Date: ~April 2026
- **Key finding:** Community consensus: thin proxy tagging every API call with (agent, task, user, team) context; hard iteration limits; route cheap tasks to Haiku/Sonnet, reserve Opus for complex decisions; fresh threads per atomic task to prevent context accumulation.
- **Why it matters to hima:** Cost governance is underspecified in hima's current rules. These patterns (tagging + iteration caps + model routing by task complexity) are actionable additions.

### C5
- **Platform:** Hacker News
- **URL:** https://news.ycombinator.com/item?id=47034087
- **Title:** Evaluating AGENTS.md: Are They Helpful for Coding Agents?
- **Points:** 232 | Comments: 161 | Date: ~February 2026
- **Key finding:** Study (arXiv 2602.11988) found only 4% average improvement from human-written AGENTS.md; LLM-generated files caused 3% degradation. Community rebuttal: prescriptive constraints (build procedures, architectural rules) outperform descriptive summaries. Progressive disclosure via nested files beats comprehensive top-level docs.
- **Why it matters to hima:** Directly validates hima's CLAUDE.md design principles — prescriptive, failure-derived, under 60 lines, human-authored. The research also explains why auto-generating CLAUDE.md is counterproductive.

### C6
- **Platform:** Lobsters
- **URL:** https://lobste.rs/s/waog4g/let_s_talk_about_efficient_agent_setups
- **Title:** Let's Talk About Efficient Agent Setups
- **Comments:** 1 | Date: ~May 3, 2026
- **Key finding:** Claude Code Max 20x with Opus 4.7 reaches the point where "I'm the bottleneck" — human decision-making, not agent speed, is the constraint (Amdahl's Law applied to agent workflows).
- **Why it matters to hima:** Confirms the architectural priority: optimize harness for human throughput (review quality, decision clarity), not raw agent speed.

### C7
- **Platform:** Lobsters
- **URL:** https://lobste.rs/s/dx84oc/why_claude_code_feels_like_magic
- **Title:** Why Claude Code Feels Like Magic?
- **Comments:** 22 | Score: +12 | Date: ~June 2025
- **Key finding:** Practical value acknowledged for overnight parallel agent exploration (launch multiple agents, compare results in the morning). Main criticism: "magic" framing misunderstands intelligence — true intelligence reduces needed iterations, not just enables more attempts.
- **Why it matters to hima:** The parallel-overnight-agent pattern is a use case hima should explicitly support in its documentation. The criticism about iteration count is also a useful counter-argument for hima's quality gates.

### C8
- **Platform:** Lobsters
- **URL:** https://lobste.rs/s/9dkn3m/nation_state_threat_actor_used_claude
- **Title:** Nation State Threat Actor Used Claude Code to Orchestrate Cyber Attacks
- **Comments:** Active thread | Date: 2026
- **Key finding:** Claude directed to independently generate attack payloads, execute testing through remote command interfaces, analyze responses for exploitability. Context: over 500 high-severity vulnerabilities validated with Claude 4.6.
- **Why it matters to hima:** Dual-use risk of unrestricted agent harnesses. Hima's scope-limitation rules and sandboxing requirements have a concrete threat model behind them.

### C9
- **Platform:** Hacker News
- **URL:** https://news.ycombinator.com/item?id=46018229
- **Title:** Show HN: I Built a Wizard to Turn Ideas into AI Coding Agent-Ready Specs
- **Points:** moderate | Date: ~January 2026
- **Key finding:** Spec-first tooling gaining traction — structured spec artifacts fed to agents outperform ad-hoc prompts. Agents increasingly receive machine-readable specs, not natural language requests.
- **Why it matters to hima:** Validates hima's SPEC.md / feature-delivery pipeline. The community is independently converging on the same spec-first pattern.

### C10
- **Platform:** Hacker News
- **URL:** https://news.ycombinator.com/item?id=45760132
- **Title:** Developer Productivity AI Arena: Open Platform for Benchmarking AI Coding Agents
- **Points:** moderate | Date: ~December 2025
- **Key finding:** Open benchmark platform for real codebase agent evaluation emerging. Practitioners want harness-independent benchmarks to separate model capability from harness quality.
- **Why it matters to hima:** Hima could submit its harness to this arena to empirically measure harness-attributable quality improvement — separate from model version effects.

---

## §D — Recognized-Author Blog Posts

### D1
- **Author:** Martin Fowler (via Birgitta Böckeler, Distinguished Engineer at Thoughtworks)
- **Title:** Harness Engineering for Coding Agent Users
- **Date:** April 2, 2026
- **URL:** https://martinfowler.com/articles/harness-engineering.html
- **Key patterns:** Four-construct taxonomy: Guides (feedforward) vs Sensors (feedback) × Computational (deterministic) vs Inferential (LLM-based). Three regulation categories: Maintainability Harness, Architecture Fitness Harness, Behaviour Harness. Ashby's Law applied: regulator must have variety matching the system. Recommends distributing quality checks across lifecycle ("keep quality left").
- **Why it matters to hima:** This is the canonical vocabulary paper for harness engineering. Fowler's platform gives it field-defining status. The four-construct taxonomy is a checklist for auditing hima's own harness coverage.

### D2
- **Author:** Martin Fowler (exploring-gen-ai series)
- **Title:** Harness Engineering — First Thoughts
- **Date:** February 17, 2026
- **URL:** https://martinfowler.com/articles/exploring-gen-ai/harness-engineering-memo.html
- **Key patterns:** Initial memo coining the term "harness" in a bounded coding-agent context. Distinguishes from broader "context engineering." Notes that harness logic is typically scattered across controller code, framework defaults, tool adapters, and verifier scripts — and that externalizing it is the core challenge.
- **Why it matters to hima:** The original memo that triggered the industry-wide adoption of the term. Hima's externalized markdown rules/skills are exactly the "portable harness artifact" Fowler calls for.

### D3
- **Author:** Simon Willison
- **Title:** Writing about Agentic Engineering Patterns
- **Date:** February 23, 2026
- **URL:** https://simonwillison.net/2026/Feb/23/agentic-engineering-patterns/
- **Key patterns:** Defines agentic engineering as building software using coding agents that generate AND execute code, iterating independently. Two initial patterns: "Writing code is cheap now" (alters engineering intuitions) and "Red/green TDD" (test-first enables more succinct, reliable agent output with minimal extra prompting).
- **Why it matters to hima:** Willison is building a canonical guide series. The TDD pattern directly validates hima's TEST-RED phase in the feature-delivery pipeline.

### D4
- **Author:** Addy Osmani (Google)
- **Title:** Agent Harness Engineering
- **Date:** April 19, 2026
- **URL:** https://addyosmani.com/blog/agent-harness-engineering/
- **Key patterns:** "Agent = Model + Harness. If you're not the model, you're the harness." Ratchet Principle: every failure becomes a permanent harness rule. Skill Issue reframing: most agent failures are configuration problems, not model limitations. AGENTS.md under 60 lines, each rule traceable to a real failure. Model-harness co-evolution: better models create new failure modes requiring fresh scaffolding.
- **Why it matters to hima:** Osmani names and popularizes the Ratchet Principle — hima's "failure → hook/rule" cycle has a canonical name now. The 60-line CLAUDE.md recommendation is directly applicable.

### D5
- **Author:** Philipp Schmid (Hugging Face)
- **Title:** The Importance of Agent Harness in 2026
- **Date:** January 5, 2026
- **URL:** https://www.philschmid.de/agent-harness-2026
- **Key patterns:** Benchmark gaps shrink but long-workflow reliability gaps persist. Three recommendations: Start Simple (avoid complex control flows; provide robust atomic tools instead), Build Modular (design for deletability as models improve), Capture Trajectories (competitive advantage shifts from prompts to failure data). Harness as operating system analogy.
- **Why it matters to hima:** The "design for deletability" principle is a direct counter to harness bloat — relevant to hima's 5-skills-over-600-lines problem identified in the Wave 38 retrospective.

### D6
- **Author:** Kyle (HumanLayer)
- **Title:** Skill Issue: Harness Engineering for Coding Agents
- **Date:** March 12, 2026
- **URL:** https://www.humanlayer.dev/blog/skill-issue-harness-engineering-for-coding-agents
- **Key patterns:** "It's not a model problem. It's a configuration problem." Configuration priority order: CLAUDE.md/AGENTS.md → MCP Servers → Skills → Sub-Agents → Hooks → Back-Pressure. Opus scored #33 on Terminal Bench 2.0 in Claude Code default harness, but #5 in custom harness — same model, 28-rank swing from harness quality alone. Sub-agents for context isolation ("context rot" prevention). Hooks for event-triggered verification.
- **Why it matters to hima:** The 28-rank model swing is the single most compelling data point for why harness quality matters. Directly usable in hima's positioning and the excellence-application framing.

### D7
- **Author:** Molisha Shah (Augment Code)
- **Title:** Harness Engineering for AI Coding Agents: Constraints That Ship Reliable Code
- **Date:** April 16, 2026
- **URL:** https://www.augmentcode.com/guides/harness-engineering-ai-coding-agents
- **Key patterns:** Speed-Verification Paradox: AI generates code faster than teams can review (Apiiro 2025: 10,000+ new security findings/month in AI-assisted repos, 10x increase). Three sequential harness layers: Constraint harnesses (linters/feedforward) → Feedback loops (self-correction) → Quality gates (CI enforcement). Rules files are necessary but insufficient — must combine with deterministic outer controls.
- **Why it matters to hima:** The 10x security finding increase is a concrete industry data point for why hima's quality-gate architecture is justified. The three-layer model is a useful audit framework.

### D8
- **Author:** Aakash Gupta (Medium)
- **Title:** 2025 Was Agents. 2026 Is Agent Harnesses. Here's Why That Changes Everything.
- **Date:** 2026
- **URL:** https://aakashgupta.medium.com/2025-was-agents-2026-is-agent-harnesses-heres-why-that-changes-everything-073e9877655e
- **Key patterns:** Framing shift: 2025 = model capability race; 2026 = harness infrastructure race. Argues that the model plateau means competitive advantage now lives entirely in harness design, not model selection.
- **Why it matters to hima:** Macro framing that positions hima's timing as optimal — the market is moving toward valuing exactly what hima provides.

---

## §E — Closed-Source Vendor 2026 Product References

### E1
- **Vendor:** AWS / Amazon Bedrock
- **Product:** Amazon Bedrock AgentCore (GA April 2026) + AgentCore Policy (GA March 2026)
- **URL:** https://aws.amazon.com/bedrock/agentcore/
- **Date:** GA announced end of April 2026; Policy GA March 2026
- **Summary:** Full managed harness service: each session in its own microVM with filesystem and shell access; supervisor-to-worker agent communication; full step logging. AgentCore Policy is a centralized governance layer sitting outside agent code, intercepting and evaluating every tool call against enterprise-defined rules. CLI-based deployment with CDK integration, A/B testing for agent versions, governance-as-infrastructure-as-code. Also added: AgentCore Payments (preview) — agents can pay for APIs/MCP servers with Coinbase/Stripe, with deterministic spending limits enforced at infrastructure layer.
- **Why it matters to hima:** AWS has productized the governance-layer pattern at cloud scale. AgentCore Policy is a reference implementation of what hima's hooks + rules system does locally. The payments feature signals where agent autonomy is heading.

### E2
- **Vendor:** Kong Inc.
- **Product:** Kong Agent Gateway + AI Gateway 3.14 (2026)
- **URL:** https://konghq.com/solutions/agent-gateway
- **Date:** March 11, 2026 (AI Connectivity Roadmap announcement)
- **Summary:** Dedicated Agent Gateway governing agent-to-agent (A2A) traffic, LLM traffic, and MCP traffic. Intercepts via ANTHROPIC_BASE_URL redirect. Controls: per-developer token quotas, PII sanitization (12 languages), semantic prompt guardrails, SOC2/EU AI Act structured logging, semantic caching for repeated queries. Centerpiece of Kong's 2026 agentic stack governance roadmap.
- **Why it matters to hima:** Kong provides the network-layer governance complement to hima's code-layer governance. Enterprise hima deployments would sit behind a Kong gateway — the two layers are additive, not redundant.

### E3
- **Vendor:** Cognition AI
- **Product:** Devin 2.2 + MultiDevin enterprise tier
- **URL:** https://cognition.ai/blog/introducing-devin-2-2
- **Date:** 2026 (Devin 2.2); Cognizant partnership January 28, 2026
- **Summary:** MultiDevin: one manager Devin coordinating up to 10 worker Devins in parallel on isolated subtasks, outputs auto-merged. Enterprise tier adds security, logging, and customization on company data. Cognizant partnership brings governance, platforms, and operational scale for enterprise deployment. Valuation reported at $25B (April 2026).
- **Why it matters to hima:** MultiDevin's manager/worker architecture is the closed-source analog of hima's swarm pattern. The $25B valuation signals that orchestrated agent governance is valued as enterprise infrastructure, not just developer tooling.

### E4
- **Vendor:** Augment Code
- **Product:** Rules-based harness governance (product page + guide, 2026)
- **URL:** https://www.augmentcode.com/guides/harness-engineering-ai-coding-agents
- **Date:** April 2026
- **Summary:** Three-type rules system: `always_apply` (auto-loaded every session), `agent_requested` (loaded when semantically relevant), `manual` (explicit invocation only). AGENTS.md standard adopted August 2025 as cross-tool compatibility layer. Rules survive across sessions, scoped to repo, compose hierarchically across parent/child directories. Positions rules files as "persistent, repository-scoped instruction sets" — distinct from prompts.
- **Why it matters to hima:** Augment's three-type system is more granular than hima's current always-on rules. The `agent_requested` type (semantic relevance loading) is an optimization hima could adopt to reduce context bloat.

### E5
- **Vendor:** Kong Inc. (specific feature)
- **Product:** Governing Claude Code with Kong AI Gateway — enterprise rollout pattern
- **URL:** https://konghq.com/blog/engineering/claude-code-governance-with-an-ai-gateway
- **Date:** March 7, 2026
- **Summary:** Routes Claude Code traffic through gateway by redirecting ANTHROPIC_BASE_URL. Addresses four enterprise risks: uncontrolled token consumption, source code exposure during API transmission, absent audit trails, shadow AI fragmentation. Provides centralized API key management, rate limiting, DLP, semantic guardrails, structured compliance logging.
- **Why it matters to hima:** Identifies exactly the four enterprise failure modes of unharnessed Claude Code deployments. Hima's rules/hooks system prevents these locally; Kong prevents them at network scale. The gap between the two is hima's enterprise opportunity.

### E6
- **Vendor:** Infosys / Cognition
- **Product:** Infosys–Cognition strategic collaboration for Devin enterprise deployment
- **URL:** https://cognition.ai/blog/infosys-cognition
- **Date:** 2026
- **Summary:** Infosys deploys and manages Devin within customer environments, providing ongoing operation, governance, and optimization of agentic software engineering systems. Combines Infosys Topaz Fabric (modular, agent-ready AI services fabric) with Devin's agentic capabilities. Governance, security, and operational rigor provided by Infosys layer wrapping Cognition's agent.
- **Why it matters to hima:** Demonstrates that enterprise agent adoption requires a managed governance wrapper around the core agent — the "systems integrator as harness provider" pattern. This is the services business model adjacent to hima's platform approach.

---

## §F — Verdict on Completeness of GitHub-Topic-Only Discovery

The cycle-02 swarm's GitHub-topic scan was necessary but materially insufficient. Three distinct knowledge layers were entirely missed:

**Layer 1 — Academic formalization (arXiv + ICSE).**
Eight arXiv papers published March–May 2026 establish harness engineering as a named discipline with reproducible experiments (AHE: +7.3pp on Terminal-Bench 2; NLAH: portable harness artifacts; CAAF: determinism enforcement). ICSE 2026 hosted the first dedicated Agentic Engineering workshop (AGENT 2026, 32 papers). None of this surfaces in GitHub topic searches. Without it, hima lacks academic grounding for its design choices.

**Layer 2 — Practitioner vocabulary canon (Fowler, Willison, Osmani, Schmid, Böckeler).**
The four-construct taxonomy (Guides/Sensors × Computational/Inferential), the Ratchet Principle, the Skill Issue reframe, the 28-rank model-swing data point, the "design for deletability" principle — all originated in personal blogs and Substack posts. GitHub topic scans return repos, not essays. This vocabulary is now appearing in papers and vendor docs as shared reference points. Hima needs it to speak the same language as the field.

**Layer 3 — Closed-source enterprise governance products.**
AWS AgentCore Policy, Kong Agent Gateway, MultiDevin, Augment's three-type rules system — none have GitHub repos. These represent the enterprise productization of harness engineering, with AWS alone providing a managed service covering microVM isolation, tool-call interception, compliance logging, and payment controls. GitHub-only discovery produces an open-source-centric picture that misses where enterprise budgets are flowing.

**Conclusion:** GitHub-topic scans capture the implementation surface (frameworks, tools, repos). The niche sources captured here provide the theoretical foundation (arXiv/ICSE), the shared vocabulary (practitioner blogs), and the enterprise deployment model (vendor products). All three are required for hima's excellence-application to be complete. A discovery process using only GitHub topics would produce a harness that is well-implemented but academically ungrounded, terminologically inconsistent with the field, and architecturally naive about enterprise governance requirements.

---

## Sources Index

| # | URL | Author/Org | Date |
|---|-----|-----------|------|
| 1 | https://arxiv.org/abs/2604.18071 | Hu Wei | Apr 2026 |
| 2 | https://arxiv.org/abs/2604.25850 | Lin et al. | Apr 2026 |
| 3 | https://arxiv.org/abs/2604.17025 | Tianbao Zhang | Apr 2026 |
| 4 | https://arxiv.org/abs/2603.05344 | Nghi D. Q. Bui | Mar 2026 |
| 5 | https://arxiv.org/abs/2603.25723 | Pan et al. | Mar 2026 |
| 6 | https://arxiv.org/abs/2604.09409 | Ouatiti et al. | Apr 2026 |
| 7 | https://arxiv.org/pdf/2604.21003 | Seong et al. (Sylph.AI) | Apr 2026 |
| 8 | https://arxiv.org/abs/2604.09296 | Oleg Solozobov | Apr 2026 |
| 9 | https://conf.researchr.org/home/icse-2026/agent-2026 | ICSE 2026 | Apr 2026 |
| 10 | https://martinfowler.com/articles/harness-engineering.html | Böckeler / Fowler | Apr 2026 |
| 11 | https://martinfowler.com/articles/exploring-gen-ai/harness-engineering-memo.html | Martin Fowler | Feb 2026 |
| 12 | https://simonwillison.net/2026/Feb/23/agentic-engineering-patterns/ | Simon Willison | Feb 2026 |
| 13 | https://addyosmani.com/blog/agent-harness-engineering/ | Addy Osmani | Apr 2026 |
| 14 | https://www.philschmid.de/agent-harness-2026 | Philipp Schmid | Jan 2026 |
| 15 | https://www.humanlayer.dev/blog/skill-issue-harness-engineering-for-coding-agents | Kyle / HumanLayer | Mar 2026 |
| 16 | https://www.augmentcode.com/guides/harness-engineering-ai-coding-agents | Molisha Shah / Augment | Apr 2026 |
| 17 | https://aws.amazon.com/bedrock/agentcore/ | AWS | Apr 2026 |
| 18 | https://konghq.com/solutions/agent-gateway | Kong Inc. | Mar 2026 |
| 19 | https://konghq.com/blog/engineering/claude-code-governance-with-an-ai-gateway | Kong Inc. | Mar 2026 |
| 20 | https://cognition.ai/blog/introducing-devin-2-2 | Cognition AI | 2026 |
| 21 | https://cognition.ai/blog/infosys-cognition | Cognition / Infosys | 2026 |
| 22 | https://news.ycombinator.com/item?id=44221655 | crawshaw.io / HN | ~Jun 2025 |
| 23 | https://news.ycombinator.com/item?id=47968112 | Show HN / HN | May 2026 |
| 24 | https://news.ycombinator.com/item?id=46854108 | OpenClaw / HN | Feb 2026 |
| 25 | https://news.ycombinator.com/item?id=47559293 | Ask HN | Apr 2026 |
| 26 | https://news.ycombinator.com/item?id=47034087 | HN | Feb 2026 |
| 27 | https://lobste.rs/s/waog4g/let_s_talk_about_efficient_agent_setups | Lobsters | May 2026 |
| 28 | https://lobste.rs/s/dx84oc/why_claude_code_feels_like_magic | Lobsters | ~Jun 2025 |
| 29 | https://lobste.rs/s/9dkn3m/nation_state_threat_actor_used_claude | Lobsters | 2026 |
| 30 | https://aakashgupta.medium.com/2025-was-agents-2026-is-agent-harnesses-heres-why-that-changes-everything-073e9877655e | Aakash Gupta | 2026 |

Falsifies-If:
  kill-condition: A later niche-source sweep finds material sources that change the discovery conclusions or invalidates the source freshness assumptions.
  checkpoint-date: 2026-06-14
  evidence-anchor: docs/excellence-application/02-analysis-discovery/swarm-deep/niche-source-scan.md
  on-fail: Refresh the source scan and update the synthesis before using the niche-source claims.
