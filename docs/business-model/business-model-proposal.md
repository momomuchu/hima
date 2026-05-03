# Pipeline Fractale v4 — Business Model Proposal

**Date**: 2026-05-03
**Status**: Internal strategy document — founder eyes only
**Synthesis of**: R01-R10 deep research reports + specs 06/07/09

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Market Opportunity](#2-market-opportunity)
3. [Competitive Positioning](#3-competitive-positioning)
4. [Licensing Strategy](#4-licensing-strategy)
5. [Tier Architecture](#5-tier-architecture)
6. [Pricing Justification](#6-pricing-justification)
7. [Go-to-Market Plan](#7-go-to-market-plan)
8. [Marketplace Strategy](#8-marketplace-strategy)
9. [Enterprise Readiness Roadmap](#9-enterprise-readiness-roadmap)
10. [Community & Ecosystem](#10-community--ecosystem)
11. [Financial Model](#11-financial-model)
12. [Risk Register](#12-risk-register)

---

## 1. Executive Summary

Pipeline Fractale v4 is a Runtime Management System (RMS) that governs AI coding agent behavior through quality-driven development cycles. It provides 8 canonical sets, 6 gates, T/F/M/E/C risk classification, a state machine, 12 skills, 9 subagents, and 9 CLI commands — portable across Claude Code, Codex, and Hermes.

**The thesis**: "Harness engineering" became a named discipline in February 2026 (Mitchell Hashimoto, endorsed by OpenAI, Augment Code, Red Hat) [R05 §7]. The formula "Agent = Model + Harness" is industry vocabulary. No commercial product yet owns this space as a coherent, configurable product [R05 §8]. Pipeline Fractale is the first open-core implementation targeting that gap.

**The market**: AI governance platforms grow from $309M (2025) to $4.8B (2034) at 35-36% CAGR [R09 §A]. AI coding assistants hit $12.8B in 2026 at 27% CAGR [R02 §16]. The intersection — governed AI development workflows — is unoccupied [R09 §G1].

**The model**: MIT public core for maximum community growth and career/brand impact, with paid value around premium packs, advanced workflows, hosted cloud convenience, team governance, and enterprise deployment. The local core stays generous and non-frustrating. Revenue is value-pull (cloud runtime, managed automation, integrations, team state, compliance artifacts, support/SLA), not license pressure.

**Why now**: EU AI Act full enforcement begins August 2, 2026 [R09 §B1]. 91% of AI tools in enterprise codebases are unmanaged [R09 §D1]. 32% of developers cite quality as their top barrier to AI adoption [R05 §7]. 51% of heavy AI tool users report more code quality problems since adoption [R05 §7]. The harness's T/F/M/E/C risk classification maps directly to EU AI Act risk tiers [R09 §F]. IBM Bob (April 2026) validates the category at the enterprise level [R09 §E]; Pipeline Fractale is the configurable, open-core alternative for startups and mid-market.

---

## 2. Market Opportunity

### 2.1 TAM / SAM / SOM

**TAM** — AI coding assistant market + AI orchestration developer segment:
- AI coding assistants: $12.8B (2026), growing to $30.1B (2032) at 27% CAGR [R02 §16]
- AI orchestration (developer segment): ~30% of $13.99B = $4.2B [R05 §2]
- Combined TAM: **$15-17B in 2026** [R05 §9]

**SAM** — Developers using terminal-first AI agents who care about quality discipline:
- 85% of 28M professional devs use AI tools = 23.8M active users [R05 §9]
- ~10% use terminal-first agents (Claude Code, Codex CLI, Aider) = 2.38M users [R05 §9]
- ~20% of those want structured quality discipline = ~476K users [R05 §9]
- At $20-50/month: **SAM = $115M-$285M ARR** [R05 §9]

**SOM** — First 18-24 months:
- 1-2% penetration of SAM core = 4,760-9,520 users [R05 §9]
- At $20/month average: **SOM = $1.1M-$2.3M ARR in Y1** [R05 §9]

**Bottom-up check**: If 0.5% of Claude Code's ~2M regular users adopt at $15/month: 10,000 users x $15/month x 12 = $1.8M ARR Y1 — consistent with SOM [R05 §9].

### 2.2 Market Drivers

1. **Quality crisis**: AI-assisted code generates 1.7x more logical/correctness bugs (CodeRabbit research) [R09 §E]. 30% of developers report low trust in AI-generated code (DORA 2025) [R05 §7].

2. **Regulatory pressure**: EU AI Act fines up to 35M EUR or 7% of global turnover [R09 §B1]. Full enforcement August 2, 2026. Articles 9, 12, 14, 15 require risk management, logging, human oversight, and accuracy maintenance — exactly what the harness provides [R09 §B1].

3. **Category validation**: IBM Bob (April 2026) is "an AI Development Partner that Takes Enterprises from AI-Assisted Coding to Production-Ready Software" [R09 §E]. Accenture's 30,000-person Anthropic practice needs compliance artifacts [R09 §C4]. These confirm enterprise budget exists.

4. **Model convergence**: Six models within 0.8% on SWE-bench Verified [R05 §10]. Model quality is no longer a differentiator. Harness quality is. "Scaffolding matters as much as the model — three different agent frameworks running the same model scored 17 issues apart on 731 problems" (SWE-agent, NeurIPS 2024) [R05 §4.2].

### 2.3 AI Governance Sub-Market

The harness occupies a gap no current product fills [R09 §G1]:

| Layer | Existing Players | What They Miss |
|-------|-----------------|----------------|
| Left of code generation | Credo AI, Holistic AI | Governance of models as org assets, not during dev session |
| At model layer | Lakera, Robust Intelligence | Runtime LLM protection, not coding workflow governance |
| Right of code generation | Codacy, SonarQube | Post-commit scanning, not pre-commit agent behavior |
| CI/CD layer | Harness.io | Pipeline governance after code written, not during |

**Gap**: Governance of the AI agent's behavior DURING the development session — pre-commit, at task-decomposition time, before irreversible file edits [R09 §G1]. This is where Pipeline Fractale operates.

---

## 3. Competitive Positioning

### 3.1 Positioning Statement

Pipeline Fractale is the **configurable, open-core quality harness for AI coding agents**. It is not an IDE, not an orchestration framework, not an observability tool. It is the missing governance layer that makes AI-generated code shippable.

### 3.2 Differentiation Matrix

The real competitors are the coding agents themselves — the question is "why use a harness vs the raw agent?"

| Capability | Pipeline Fractale | Claude Code | Codex CLI | OpenHands V1 | Aider | Cursor 3 | Windsurf | Augment Intent |
|------------|-------------------|-------------|-----------|--------------|-------|----------|----------|----------------|
| Typed agent routing | Yes — extensible, OWNS/NE GERE PAS boundaries | User-defined subagents (May 2026) | No | RouterLLM extensible | 2-tier Architect/Editor | No | No | Typed roles |
| Skill-driven development | Extensible catalog, auto-detected | Skills 2.0 (YAML frontmatter, eval A/B) [V02] | No | AgentSkills-compliant [V02] | No | Plugin marketplace | No | No |
| Risk classification | T/F/M/E/C — maps to EU AI Act, session-scoped | No platform-level risk scoring | 4-tier action-level (low/med/high/critical) [V02] | LLMSecurityAnalyzer (L/M/H per-action) [V02] | No | No | No | No |
| Quality discipline as rules | Tidy First S/B, complexity limits, policy-driven gates | No | No | ConfirmRisky policy [V02] | Auto-lint thin gates | No | Cascade Hooks [V02] | Verifier gate |
| Session-persistent planning | `.planning/` artifacts, ADR, STATE.md | No | Persistent `/goal` workflows [V02] | Partial (workspace) | No | No | No | Living Specs |
| Evidence-based completion | Evidence Set required before DONE_VERIFIED | No | No | Immutable event-sourced audit trail [V02] | No | No | No | No |
| Multi-runtime portable | Claude Code, Codex, Hermes, extensible | Claude only | Codex only | Model-agnostic | Model-agnostic | Multi-model | Multi-model | macOS desktop only |
| Open source | MIT core + commercial enterprise layer | Proprietary | Proprietary | MIT core + source-available enterprise | Apache 2.0 | Proprietary | Proprietary | Proprietary |
| Compliance artifact generation | EU AI Act mapping from risk tiers | No | No | No | No | No | No | No |
| Analytics / telemetry | Open-source, auditable | No | No | No | No | Proprietary | Proprietary | No |

**Verified gap** [V02]: No product combines (1) session-scoped risk classification mapped to regulatory tiers, (2) evidence-based completion gates, (3) multi-runtime portability, and (4) compliance artifact generation. The gap is real but **narrower** than initially claimed — competitors have adopted individual harness primitives (skills, action-level risk, hooks). Pipeline Fractale's moat is the integrated quality discipline system, not any single feature.

**Buyer overlap note**: Cursor 3 (April 2026) added background agents and cross-platform triggers — the "different buyer" argument is weakening. Windsurf's Cascade Hooks are a meaningful governance layer. Compete on depth of quality governance, not on "they don't have hooks" [V02].

Sources: [R05 §8], competitive deep-dives [R05 §4].

### 3.3 Competitive Moats

1. **Behavioral rules at orchestration layer** — governance cannot be bypassed because it IS the orchestration layer, not a wrapper [R09 §G2]. High defensibility.

2. **Risk classification before agent spawn** — T/F/M/E/C assessment before sub-agent launch maps directly to EU AI Act tiers [R09 §F]. Pattern can be copied, but operational data and regulatory mapping create lead time.

3. **Wave-based parallel agent governance** — each wave has traceable artifacts; cross-wave audit trail is native [R09 §G2]. No competitor has agent-wave-level traceability.

4. **Harness recipe library** — stack-specific skill packs, eval dataset curation, community-contributed patterns as defensible asset base [R05 §10].

### 3.4 "Why Not Just Use X" Objection Map

| Objection | Response |
|-----------|----------|
| "Claude Code is enough" | Claude Code ships no rules, no skills, no typed agents, no quality enforcement by default [R05 §8]. Same model, 17-issue gap depending on harness [R05 §4.2]. Pipeline Fractale makes Claude Code better, not replaces it. |
| "Codex CLI is enough" | Codex has sandboxing but no risk classification, no quality gates, no evidence-based completion. Same model, different discipline [R05 §4]. |
| "OpenHands does this" | OpenHands is an autonomous coding agent — it replaces the developer's interaction model. Pipeline Fractale governs ANY agent's behavior without replacing the workflow. Different layer entirely [R05 §8]. |
| "Cursor/Windsurf is enough" | IDE-native tools. They compete on UX within an editor. Pipeline Fractale is terminal-native and runtime-portable. Different buyer, different value prop [R05 §8]. |
| "AGENTS.md does this" | AGENTS.md is a static spec. No dynamic skill routing, no multi-agent wave coordination, no eval framework, no risk classification [R05 §8]. |
| "We'll build our own" | Harness engineering patterns are documented (Augment Code guide, Anthropic blog) but productizing them is 6-12 months of work. Pipeline Fractale ships it today. |

---

## 4. Licensing Strategy

### 4.1 Final Decision: MIT Core + Commercial Enterprise Layer

**License**: MIT for the public local core.
**Commercial layer**: Existing commercial/source-available license for `enterprise/` or a private enterprise repo.
**Trademark**: Protect the project name, logo, domains, and official distribution separately through trademark policy.
**No bait-and-switch**: Do not start MIT and later restrict already-public core code. Future premium/enterprise code is scoped separately from day one.

The founder decision is explicit: maximum community growth, public credibility, and developer-career upside matter more than preventing every possible fork. If someone forks or copies the public core, that is still proof that the system created meaningful value. The business should monetize the hosted, managed, team, compliance, and integration layers rather than fear of copying.

### 4.2 Why MIT for This Product

| Criterion | MIT Core | AGPL Core | BSL/FSL/SSPL |
|-----------|----------|-----------|--------------|
| Community growth | Maximum | Medium-high, but legal friction | Lower |
| Enterprise legal friction | Minimal | Medium-high | High |
| Fork/copy allowed | Yes | Yes, but copyleft applies | Restricted |
| Cloud-provider protection | None | Stronger via network copyleft | Stronger but non-OSI or more controversial |
| Career/brand impact | Maximum diffusion | Strong OSS signal, narrower adoption | Weaker OSS signal |
| Fit for developer tool/harness | Strong | Strong only if managed-service protection dominates | Poor for community-first launch |

The closest practical comparable is OpenHands: public core under MIT, with `enterprise/` under a separate commercial/source-available license and paid cloud/self-host enterprise offerings [R02 §9, R05 §4.2, R07 §F]. Pipeline Fractale should follow that shape unless the strategic objective changes from community growth to license-based protection.

### 4.3 License Boundary Architecture

| Layer | License / Terms | Rationale |
|-------|-----------------|-----------|
| Local CLI and installer | MIT | Zero-friction adoption |
| Core RMS/state machine/gates/hooks | MIT | The heart of the public standard; must not feel crippled |
| Core agents and skills | MIT | Community growth depends on a generous core |
| Platform adapters (Claude, Codex, Hermes) | MIT or Apache 2.0 | Encourage ecosystem integration |
| Public plugin/skill SDK | MIT or Apache 2.0 | Let third parties build freely |
| Public docs, examples, starter packs | MIT / docs license | Distribution and education |
| Premium first-party packs | Commercial license | Paid convenience and maintained advanced workflows |
| Hosted cloud runtime | SaaS terms | Monetizes convenience, automation, remote execution, integrations |
| Team governance | Commercial license / SaaS terms | Shared state, org policies, team analytics |
| Enterprise self-host/VPC | Commercial license | SSO, SCIM, audit API, compliance, SLA, support |
| Marketplace infrastructure | Proprietary/SaaS terms | Revenue capture and quality/security review |

### 4.4 Anti-Patterns Avoided

- **Bait-and-switch**: Do not relicense the public MIT core restrictively after adoption.
- **Crippled core**: Do not make the local core frustrating. The free product must be real enough to become a habit and a standard.
- **Feature migration from free to paid**: Decide paid boundaries at feature-design time. Do not move trusted public-core capabilities behind payment later.
- **Enterprise leakage**: Keep premium/enterprise code in clearly marked paths such as `enterprise/` or a private repo with its own license.
- **Trademark confusion**: Forks can exist, but they cannot impersonate the official project, brand, cloud, or marketplace.

---

## 5. Tier Architecture

### 5.1 Design Principles

1. **BBOC (Buyer-Based Open Core)**: Gate by buyer persona, not feature cost [R01 §1.1]. Individual contributor features stay free. Team lead features at Team. VP/exec/legal/compliance features at Enterprise.

2. **Do not frustrate the core**: The local public core must be useful for real work. Do not use risk-depth paywalls or artificial limits that make the product feel like a demo.

3. **Gate by maintained convenience and organization value**: Paid value comes from premium packs, advanced maintained workflows, hosted cloud runtime, integrations, team governance, compliance, and support. Do not gate individual productivity primitives.

4. **Qualitatively different capabilities per tier**: Free = local standard and community growth. Pro = maintained premium workflow library. Cloud = no local runtime burden and remote automation. Team = shared governance. Enterprise = compliance, security, deployment control, and support.

### 5.2 Tier Definition

#### FREE (Community)

**Buyer persona**: Individual contributor, solo developer, OSS contributor [R01 §1.1].
**Purpose**: Viral acquisition, bottom-up PLG, community goodwill. Be generous — show we're good people.

| Component | Included | Details |
|-----------|----------|---------|
| **All current skills** | Every skill in the catalog | No artificial skill gating. The catalog will grow — all skills stay free for individuals. |
| **All current subagents** | Every subagent in the catalog | Same principle. Subagent catalog grows freely. |
| **CLI** (all commands) | Every CLI command | Full CLI access, no crippled experience |
| **Risk classes** | T, F, M, E, C | Full classifier locally; no risk-depth paywall |
| **State machine** | Full 8-cycle state machine | All transitions and gates needed for local quality |
| **Platforms** | Claude Code, Codex, Hermes | Full portability |
| **Hooks** | All hook types | Full hook system |
| **Analytics** | `harness analytics summary` (local-only) | Open-source analytics commands |
| **Community** | GitHub Discussions, Discord | Support via community |

**Conversion pressure**: Users upgrade because the paid layers save time, keep advanced packs maintained, run work remotely, synchronize teams, or satisfy enterprise governance. The local core does not punish serious individual use.

#### PRO / PREMIUM PACKS (Founding perpetual or Annual)

**Buyer persona**: Professional developer, freelancer, startup engineer [R01 §1.1].
**Purpose**: Paid convenience for people who want maintained advanced workflows without rebuilding them.

| Component | Included | Details |
|-----------|----------|---------|
| **Premium first-party packs** | Maintained packs beyond the public core | Framework/domain packs, advanced review bundles, workflow templates |
| **Advanced workflows** | Maintained orchestration recipes | Multi-repo campaigns, release/refactor/compliance flows, richer eval loops |
| **Evidence export** | JSON + Markdown + PDF | `harness evidence` with structured compliance output |
| **Eval packs** | Curated suites | Baseline scoring, regression detection, custom eval suites |
| **Analytics** | `harness analytics summary` + `harness analytics export` | Local + exportable structured JSON |
| **Opt-in telemetry** | Community data flywheel | Contribute anonymized patterns, get better defaults |
| **Priority support** | Email | 48h response SLA |
| **Early access** | Beta packs | New maintained packs before general release |

**The gate is maintained workflow value, not basic capability.** If a feature is necessary for the public local core to feel legitimate, it stays in Free. If it is an advanced maintained pack, integration recipe, or high-touch support surface, it can be paid.

**Upgrade trigger to Cloud**: When the user no longer wants to keep a local runtime open, wants mobile/WhatsApp/Slack control, or wants scheduled remote agents.

#### CLOUD INDIVIDUAL (Free BYOK + paid usage/subscription)

**Buyer persona**: Developer who likes the local core but wants the hosted experience.
**Purpose**: Monetize convenience, remote execution, and automation.

| Component | Included | Details |
|-----------|----------|---------|
| **Hosted agent runtime** | Cloud sandboxes | Run agents without local machine setup |
| **Mobile/messaging control** | WhatsApp/Slack/Discord-style entry points | Send tasks and receive status without a local terminal |
| **Git integrations** | GitHub/GitLab/Bitbucket | PR automation, issue-to-run, scheduled maintenance |
| **BYOK** | User-owned model keys | Lower trust friction and cost transparency |
| **Provider models** | Pay-as-you-go | Use hosted model access with clear usage pricing |
| **API access** | Automation endpoints | Scripts, webhooks, scheduled jobs |

#### TEAM (Annual per-seat or cloud team plan)

**Buyer persona**: Team lead, engineering manager [R01 §1.1].
**Purpose**: Shared state, collaboration, and governance for small teams.

| Component | Included | Details |
|-----------|----------|---------|
| **Everything in Pro/Cloud as contracted** | Premium packs and/or hosted execution | Plan composition can vary |
| **Shared state** | Team-wide `.planning/` sync | Shared planning artifacts across team members |
| **Team analytics** | Dashboard | Per-developer quality metrics, risk distribution, cycle velocity |
| **Wave coordination** | Multi-developer waves | Parallel agent governance across team members |
| **Custom rules** | Org-wide rule sets | Team-level coding standards, custom quality gates |
| **Team policies** | Shared Policy Set | Enforce consistent risk thresholds, gate requirements across team |
| **Support** | Priority email | 24h response SLA |

**Upgrade trigger to Enterprise**: When SSO/SAML is required, when audit logs need SIEM export, when compliance certifications are required.

#### ENTERPRISE (Custom annual contracts, starting ~$499/seat/year)

**Buyer persona**: VP, exec, legal, CISO, compliance [R01 §1.1].
**Purpose**: Compliance, security, SLA capture. Annual contracts only (enterprises can't do lifetime on their books).

| Component | Included | Details |
|-----------|----------|---------|
| **Everything in Team** | Shared state, governance, cloud/self-host options | Same as Team |
| **SSO/SAML** | SAML 2.0 + OIDC | IdP-initiated + SP-initiated, JIT provisioning [R06 §C1] |
| **SCIM** | Full lifecycle management | Auto-create/deprovision on IdP changes [R06 §C1] |
| **Audit logs** | Immutable + API + SIEM | Append-only, actor+target+action+timestamp, REST/GraphQL API, Splunk/Datadog/Sentinel push [R06 §C2] |
| **Custom RBAC** | Level 3-4 | Custom roles with permission sets, ABAC from IdP attributes [R06 §C3] |
| **Data residency** | Region choice | EU/US/AUS minimum [R06 §A] |
| **Compliance artifacts** | EU AI Act, ISO 42001, NIST AI RMF | Pre-built compliance documentation mapping T/F/M/E/C to regulatory tiers [R09 §F] |
| **SLA** | 99.9% uptime | Contractual with credits, P1 response <=1h [R06 §C5] |
| **IP indemnification** | Yes | For AI-generated code via harness [R06 §H] |
| **On-premises option** | Self-hosted | For regulated industries (finance, healthcare, defense) [R06 §C6] |
| **Support** | Named TAM | Dedicated technical account manager |

### 5.3 What's Gated: Convenience, Maintenance, and Organization Value

All local core skills, subagents, CLI commands, risk classes, and baseline quality gates are available in the public core. Paid tiers gate what costs ongoing work or creates buyer-specific value:

- maintained premium packs and advanced workflow recipes;
- hosted cloud runtime and remote sandboxes;
- messaging and project-management integrations;
- team shared state, analytics, and policy management;
- enterprise identity, audit, compliance, VPC/self-host, support, and SLA.

### 5.4 What's Gated: Capability Category

| Capability | Free | Pro | Team | Enterprise |
|------------|------|-----|------|------------|
| Public core skills | Yes | Yes | Yes | Yes |
| Public core subagents | Yes | Yes | Yes | Yes |
| All CLI commands | Yes | Yes | Yes | Yes |
| Full risk classes (T/F/M/E/C) | Yes | Yes | Yes | Yes |
| Baseline evidence export | Yes | Yes | Yes | Yes |
| Premium packs | - | Yes | Yes | Yes |
| Advanced maintained workflows | - | Yes | Yes | Yes |
| Hosted cloud runtime | - | Optional | Optional | Optional/self-host |
| Advanced eval packs | - | Yes | Yes | Yes |
| Analytics export | Basic | Yes | Yes | Yes |
| Shared team state | - | - | Yes | Yes |
| Team analytics dashboard | - | - | Yes | Yes |
| Org-wide policies/rules | - | - | Yes | Yes |
| SSO/SAML/SCIM | - | - | - | Yes |
| Audit logs + SIEM | - | - | - | Yes |
| Compliance artifacts | - | - | - | Yes |
| SLA + named TAM | - | - | - | Yes |

Source: 06-skills-catalog-spec, 07-subagents-catalog-spec, 09-cli-commands-spec.

---

## 6. Pricing Strategy

### 6.1 Core Insight: Local Core Is Free; Cloud Convenience Is Paid

The local harness is a control plane — it orchestrates coding agents but does NOT need to make AI inference calls itself. Users can bring their own Claude Code / Codex / Hermes subscriptions and API keys. The local core's marginal cost per user is effectively zero, so it should be MIT and free.

The hosted cloud product is different: remote sandboxes, messaging integrations, scheduling, API access, storage, support, and optional model-provider billing create real ongoing costs and convenience value. That layer can be monthly, annual, usage-based, or enterprise-contract based without violating the free-core promise.

### 6.2 Pricing Model: Free Core + Premium Packs + Cloud + Enterprise

**Public local core — Free**

- MIT licensed.
- Full local CLI/RMS baseline, public agents/skills, risk classes, hooks, and core workflow.
- Goal: adoption, trust, community growth, developer-career impact, and brand gravity.

**Founding Member Premium Pack — $249-299 one-time (first 1000 users)**

- **NOT called "lifetime deal"** — branding is toxic post-AppSumo collapse (50% revenue crash 2024-2025) [V01]. Use "Founding Member" or "Perpetual v1.x License."
- **Legally scoped to premium packs / v1.x paid workflows** — not open-ended. v2 premium packs are separate. This is the JetBrains/Sublime Text model, not the AppSumo model [V01].
- Rewards early believers, generates launch capital, creates evangelists [R03 §B]
- Scarcity-driven: numbered licenses (e.g., "License #347 of 1000"), public counter on site
- Price at $249-299 (1.67-2x annual), not $149 — industry rule is 5-12x annual for perpetual; $249 is the pragmatic floor that keeps 3-year cohort math positive [V01]
- **Support: community-only** for founding members. Email/priority support requires annual subscription. This caps the support cost that kills most lifetime deals [V01].
- Risk: front-loaded revenue. Mitigated by cap (1000 units), v1.x scope, and transition to annual.

**Premium annual — $180/year (after founding closes)**

- The default local paid model for premium packs and advanced workflows. Monthly is not needed for local packs.
- Equivalent to $15/month — below the $20 consensus but positioned as "annual commitment, not subscription tax"
- Framing: "one purchase per year" not "12 payments" [R08 §10.1]
- Annual billing reduces churn 20-30% and payment processing costs 83% vs monthly [R08 §10.1]
- $180 signals professional grade without crossing the $20/month mental barrier [R08 §3.4]

**Cloud individual — free BYOK tier + paid usage**

- Free hosted entry tier for evaluation and community acquisition.
- BYOK supported to reduce trust friction and model lock-in.
- Optional hosted model access priced transparently with usage/credit visibility.
- Paid cloud value is convenience: remote agents, WhatsApp/Slack-style control, API access, scheduled runs, hosted sandboxes.

**Team Annual — $300/seat/year ($25/seat/month effective)**

- Positioned below Copilot Enterprise ($468/year) and Cursor Teams ($480/year) but NOT dramatically cheaper [V03]
- $99/seat/year was too cheap — signals "not enterprise-grade" and creates pricing floor problems when trying to upsell enterprise [V03]. $300 is competitive without being dismissive.
- Annual-only. No monthly. Enterprise procurement prefers annual anyway [R06 §G].
- Volume: 10+ seats 10% off, 50+ seats 20% off, 100+ seats custom

**Enterprise — Custom annual contracts (starting ~$600/seat/year)**

- Non-negotiable: enterprises CANNOT do perpetual on their books (capitalization rules) [R06 §G]
- Includes SSO/SAML, SCIM, audit API, compliance artifacts, SLA, named TAM
- Volume discounts: 100+ seats 15%, 500+ seats 25%, 1000+ seats 35%, multi-year additional 10% [R06 §F]
- At $600 list, negotiated to $300-400 effective — standard 40-60% enterprise discount [R06 §B]. Still above $300 Team tier, preserving tier integrity.

### 6.3 Why No Monthly for Local Premium Packs

| Argument for monthly | Counter |
|---------------------|---------|
| "Lower barrier to entry" | Free tier IS the low barrier. Paid = committed users only. |
| "Industry standard" | Being standard is the problem — 31/88 tools at $20/month [R08 §3.1]. Differentiate. |
| "Predictable MRR" | Annual is also predictable MRR, with lower churn and processing costs [R08 §10.1]. |
| "Easier to cancel = less friction" | Less friction to leave = higher churn = worse unit economics. Annual filters for serious users. |
| "Enterprise needs monthly" | Enterprise needs annual contracts, not monthly [R06 §G]. |

Cloud is exempt from this rule because it has ongoing infrastructure, support, and optional inference costs. The rule is: no monthly rent for static/local packs; monthly or usage-based pricing is acceptable when the product is hosted and continuously operated.

### 6.4 Productivity ROI Calculation

- Average time saved with AI tools: 3.6 hours/week per developer [R02 §16]
- At $100K loaded developer cost: 3.6h/week = ~$9,000/year productivity value [R02 §16]
- Pipeline Fractale at $149/year is 1.7% of productivity gain — clear positive ROI
- Quality improvement: AI-assisted code generates 1.7x more bugs [R09 §E]. Harness reduces rework. Conservative 10% rework reduction on AI-generated code saves 36h/year at $50/h = $1,800/year — 12x ROI on annual plan

### 6.5 Analytics as Value Exchange

The harness traces everything in `events.jsonl` — this data is a product, not a side-effect.

**Open-source analytics commands** (trust through transparency):
- `harness analytics summary` — local-only stats: risk distribution, cycle velocity, skill usage frequency
- `harness analytics export` — structured JSON for team dashboards
- Core analytics code is MIT — users can read, audit, and modify every query

**Opt-in anonymized telemetry** (data flywheel):
- Aggregate patterns improve default risk thresholds, skill routing, policy recommendations
- Users who opt in get better defaults — community improves the product for everyone
- Telemetry spec is open-source and auditable — no hidden collection
- GDPR-compliant: no PII, no code content, only structural patterns (risk class distribution, cycle duration, gate pass/fail rates)

**Why this matters**: Cursor and Windsurf collect telemetry behind proprietary walls [R05 §8]. Pipeline Fractale makes analytics a transparent, open-source feature. This builds trust AND creates a data moat that improves the product faster than closed competitors can.

---

## 7. Go-to-Market Plan

### 7.1 GTM Model: PLG-First, Enterprise-Second

PLG is the default GTM for developer tools in 2026 [R03 §Executive Summary]. PLG companies grow 30-40% faster than sales-led with 50-70% lower CAC [R03 §Executive Summary]. Cursor reached $200M sales before hiring a single enterprise sales rep [R03 §K].

**Phase 1: Founder distribution (0-100 users, months 1-2)**
- Show HN: problem-first framing — "AI coding tools ship 1.7x more bugs. Here's a harness that fixes it." [R03 §B]
- r/devops, r/webdev, Claude Code Discord, relevant AI coding communities [R03 §B]
- Personal outreach to developers using Claude Code who face quality problems [R03 §B]

**Phase 2: Launch amplification (100-500 users, months 2-4)**
- Product Hunt launch (Tuesday-Thursday, 12:01 AM PST) [R03 §B]
- Separate Show HN for technical depth [R03 §B]
- Dev.to + Hashnode: "How we cut AI-generated bugs by 40% with a quality harness" [R03 §B]
- GitHub repo with working examples — README is the first funnel [R03 §B]
- Developer directories: DevHunt, awesome-lists [R03 §B]

**Phase 3: Content compounding (500-1000 users, months 4-8)**
- Technical blog: problem-framing posts about AI code quality, harness engineering [R03 §B]
- "Comparison with X" pages: Pipeline Fractale vs raw Claude Code, vs AGENTS.md, vs LangChain [R10 §C, R03 §C]
- YouTube demos: live coding with harness enabled vs disabled, showing quality difference [R03 §F]

**Phase 4: Enterprise layer (1000+ users, months 8-18)**
- Enterprise features added when >=3 deals stall on compliance/security requirements [R03 §L]
- First sales hire: product evangelist with quota, not enterprise rep [R03 §E]
- Only when $100K+ ARR from enterprise segment [R03 §D]

### 7.2 Conversion Funnel Targets

| Stage | Target | Source |
|-------|--------|--------|
| Free signup to activation (TTFV <15 min) | 30-40% | [R03 §A] |
| Free to paid conversion | 3-5% (freemium) | [R03 §A] |
| Trial to paid (if trial model) | 15-25% | [R03 §A] |
| PQL to paid | 25%+ | [R03 §A] |
| NRR (annual) | 115-130% | [R01 §6] |

### 7.3 Time-to-First-Value

Target: under 5 minutes from `npm install -g @harness/cli` to first quality-gated commit.

```
harness install --target claude    # 30 seconds
harness init                       # 15 seconds — scaffolds .harness/ and state.yaml
# Developer makes a change...
harness hook pre-commit            # < 100ms — classify-risk fires, evidence-collector runs
```

CLI-first, dashboard-second. Matches the terminal-native audience of Claude Code users [R03 §G]. The Vercel model (CLI + dashboard parity) is the long-term target [R03 §G].

### 7.4 Marketing Channels (Ranked by ROI)

1. **Documentation + SEO**: Docs-as-distribution. Every tutorial ranks on search AND feeds AI assistant recommendations [R03 §C, R10 §C6].
2. **GitHub presence**: Stars, contributors, working examples as social proof [R03 §F].
3. **Community participation**: Reddit, HN, Discord — answer questions about AI code quality, never promote [R03 §F].
4. **Technical blog**: Problem-framing posts about harness engineering [R03 §F].
5. **DevRel**: Conference talks that teach harness engineering, not pitch the product [R03 §F].

**Attribution warning**: 52% of developer discovery happens in dark social — developer-to-developer recommendations in private channels [R03 §F]. Self-reported attribution at signup captures more signal than UTM chains [R03 §F].

---

## 8. Marketplace Strategy

### 8.1 Opportunity

MCP ecosystem: 10,000+ servers, 97M monthly SDK downloads, less than 5% monetized — massive white space [R04 §B MCP]. claudemarketplaces.com reports 110K+ monthly developer visits [R04 §B Claude Skills]. Agent37 is the first infrastructure-complete monetization platform for Claude skills (80/20 split) [R04 §B Claude Skills].

### 8.2 Three-Phase Marketplace Build

**Phase 1: Free registry ($0 infrastructure cost, months 3-6)**
- Public GitHub repo: `marketplace.json` catalog [R04 §G]
- Automated CI: SKILL.md schema validation, `allowed-tools` audit, security checks [R04 §G]
- Discovery: static site or integration with existing claudemarketplaces.com [R04 §G]
- Quality scoring: automated 0-100 score (documentation, code quality, security, maintenance, UX) [R04 §E]
- Timeline: 1-2 weeks to build [R04 §F]

**Phase 2: Monetization (~$15K build cost, months 6-12)**
- Hosted runtime: each skill deployed as serverless function (Cloudflare Workers or Vercel Edge) [R04 §G]
- Stripe Connect marketplace mode: 80/20 split (developer 80%, platform 20%) [R04 §G]
- Auth0 for entitlement + JWT license validation [R04 §G]
- Usage metering: per-skill-invocation events -> Stripe Billing meters [R04 §G]
- Developer portal: revenue dashboard, payout history [R04 §G]
- Minimum payout: $50 (lower than JetBrains $200 to attract early developers) [R04 §G]

**Phase 3: Enterprise (~$50K additional, months 12-24)**
- Private org registries with SSO/SAML [R04 §G]
- Audit logging for every skill invocation [R04 §G]
- On-premises skill runner option [R04 §G]
- SLA + compliance package [R04 §G]

### 8.3 Take Rate: 20%

- JetBrains: 15% [R04 §A]. Atlassian Forge: 0-16% [R04 §A]. Shopify: 0-15% [R04 §A]. MCPize: 15% [R04 §A]. Agent37: 20% [R04 §A].
- 15-20% is the competitive floor in 2026 [R04 §A]. Going above 20% requires significant platform distribution value.
- 20% is justified by quality gate (curated, scored catalog), harness-native testing, verified security (`allowed-tools` audited, prompt injection checked), and enterprise distribution channel [R04 §G].

### 8.4 Pricing Guidance for Third-Party Skills

| Category | Recommended Range | Source |
|----------|------------------|--------|
| Productivity / one-time output | $5-20/run | [R04 §B MCP] |
| API integration skills | $10-30/month | [R04 §B MCP] |
| DB connector skills | $20-50/month | [R04 §B MCP] |
| AI/ML wrapper skills | $0.01-0.10/call | [R04 §B MCP] |
| Enterprise compliance skills | $100-500/month | [R04 §B MCP] |

Token cost floor: always model (worst-case tokens x model price) x 3x buffer = minimum per-run price [R04 §D AP-5].

### 8.5 Anti-Patterns Avoided

- **Selling files instead of outcomes**: hosted runtime model, not SKILL.md zip downloads [R04 §D AP-4].
- **One-time pricing for maintained software**: subscription or per-run, never one-time [R04 §D AP-1].
- **High commission without distribution value**: 20% backed by quality gate, security review, enterprise channel [R04 §D AP-3].
- **Ignoring token cost economics**: worst-case token floor enforced in pricing guidance [R04 §D AP-5].

---

## 9. Enterprise Readiness Roadmap

### 9.1 Enterprise Feature Sequencing

Based on enterprise procurement requirements [R06 §I] and sales cycle anatomy [R06 §G]:

**Month 0-6: Foundation (no enterprise features)**
- Focus on PLG, developer adoption, community
- Ship Free + Pro tiers only
- No sales calls, no enterprise pricing

**Month 6-12: Enterprise Floor**
- SSO/SAML (SAML 2.0, IdP-initiated + SP-initiated, JIT provisioning) [R06 §C1] — hard sales blocker without it
- SCIM provisioning [R06 §C1] — automates onboarding/offboarding
- Basic audit logs (UI + API) [R06 §C2]
- SOC 2 Type II process started (6-month audit window) [R06 §C4]

**Month 12-18: Enterprise Growth**
- Custom RBAC (Level 3 — custom roles with permission sets) [R06 §C3]
- Audit Log API (REST/GraphQL) + SIEM integration (Splunk, Datadog) [R06 §C2]
- Data residency options (EU, US) [R06 §A]
- SLA guarantee (99.9%) [R06 §C5]
- SOC 2 Type II report available [R06 §C4]
- DPA template ready for signature [R06 §G]
- Trust Center with pre-filled SIG Lite [R06 §G]

**Month 18-24: Enterprise Scale**
- ISO 27001 certification [R06 §C4]
- ISO 42001 (AI Management System) [R09 §B3] — unique differentiator
- HIPAA BAA availability [R06 §E1]
- On-premises deployment option [R06 §C6]
- IP indemnification for AI-generated code [R06 §H]
- Named TAM for enterprise accounts [R06 §C5]
- EU AI Act compliance artifact generation (Articles 9, 12, 14, 15 mapping) [R09 §F]

### 9.2 AI Governance Stack (Unique to Pipeline Fractale)

Enterprise AI tool governance requirements [R06 §H]:

| Requirement | Pipeline Fractale Implementation | Status |
|-------------|--------------------------------|--------|
| Zero-retention inference | API key mode, no code storage | Day 0 |
| Model transparency | T/F/M/E/C classification logs which model, which skill | Day 0 |
| AI usage audit trail | `events.jsonl` with actor, model, input/output hashes, timestamps | Day 0 |
| Cost controls | Per-developer token spending limits | Pro tier |
| HITL gates | E/C risk classes require human checkpoint before irreversible actions | Team tier |
| DLP integration | PII auto-redaction at input/output boundaries | Enterprise |
| Compliance documentation | EU AI Act Article 9/12/14/15 mapping from T/F/M/E/C tiers | Enterprise |

### 9.3 Enterprise Sales Cycle Expectations

Cycle: 3-6 months for $50K+ ACV, 6-12 months for $500K+ [R06 §G].

Accelerators already planned [R06 §G]:
- Published SOC 2 Type II (downloadable via Trust Center) — by month 18
- Pre-filled SIG Lite questionnaire — by month 12
- Standard DPA on file — by month 12
- SSO integration guides for Okta, Azure AD, Ping Identity — by month 9
- Structured POC framework with defined success metrics — by month 9

---

## 10. Community & Ecosystem

### 10.1 Platform Selection

| Stage | Primary | Secondary |
|-------|---------|-----------|
| 0-500 users | GitHub Discussions | Twitter/X |
| 500-5K users | Discord (real-time) + GitHub Discussions (async, SEO-indexed) | Reddit |
| 5K+ users | Discord + Discourse (SEO) | GitHub Discussions |

Source: [R10 §A]. Never Discord-only — content not indexed by search engines or AI crawlers [R10 §D AP-1].

### 10.2 Contributor Funnel

Targets from cross-validated benchmarks [R10 §B]:

- Tag 25% of issues as `good first issue` with full context -> +13% new contributor rate
- CONTRIBUTING.md before first external contributor arrives
- Code review response within 48h -> significantly higher repeat contribution rate
- Time to first maintainer response: <48h (Year 1), <24h (Year 2) [R10 §H]
- New contributor count: +3-5/month (Year 1), +10-20/month (Year 2) [R10 §H]

### 10.3 Governance Transition

Following the Astro model [R10 §I]:

- **Months 0-24**: BDFL (founder decides). Document expectations.
- **Month 24+**: TSC capped at 5 members if 5+ active contributors. Founder excluded from TSC (Astro pattern prevents founder dependency) [R10 §I].
- **Year 3+**: Foundation pathway evaluation (OpenJS or Linux Foundation) if multi-company contributors emerge.

### 10.4 Ecosystem Building Sequence

Following the validated pattern [R10 §G]:

1. **Core stability first** (months 0-12): No plugin API before core API is stable [R10 §G].
2. **Internal plugins** (months 6-12): Build 2-3 first-party skills using own API [R10 §G].
3. **Partner integrations** (months 12-18): 3-5 adjacent tool integrations [R10 §G].
4. **Community registry** (months 18-24): `awesome-pipeline-fractale` list [R10 §G].
5. **Marketplace** (year 3+): Only if community plugins reach 50+ [R10 §G].

### 10.5 Documentation Strategy

Documentation is distribution, not support [R03 §C]:

- Getting started: <5 minutes to "it works" [R10 §C6]
- Architecture guides for senior engineers [R03 §C]
- Comparison pages vs alternatives [R10 §C6]
- Machine-readable API reference for AI assistant ingestion [R03 §C]

**2026 warning**: Tailwind Labs lost 80% revenue and laid off 75% of engineering when docs traffic dropped 40% from AI intermediation [R10 §D AP-2]. Revenue must come from hosted services and enterprise features, not documentation page views.

---

## 11. Financial Model

### 11.1 Revenue Streams (Ordered by Expected Contribution)

| Stream | Year 1 | Year 2 | Year 3 | Source |
|--------|--------|--------|--------|--------|
| Founding member perpetual sales | 40% | 3% | 0% | First 1000 users, one-time, v1.x scoped |
| Pro annual | 30% | 45% | 30% | Individual developers |
| Team annual | 10% | 27% | 30% | Small-medium teams |
| Enterprise contracts | 5% | 15% | 25% | Compliance-driven |
| Marketplace take (20%) | 0% | 5% | 10% | Third-party skills |
| Support contracts | 15% | 5% | 5% | Enterprise add-on |

### 11.2 Y1-Y3 Revenue Projections

**Conservative scenario** (1% SAM penetration):

| Metric | Y1 | Y2 | Y3 |
|--------|-----|-----|-----|
| Free users | 10,000 | 30,000 | 75,000 |
| Founding members (capped 1000) | 500 | 500 (closed) | 0 (closed) |
| Pro annual (3% of free, post founding) | 100 | 900 | 2,250 |
| Team seats (annual) | 50 | 375 | 1,125 |
| Enterprise seats (annual) | 10 | 150 | 750 |
| Founding member revenue | $137,500 | $0 | $0 |
| Pro annual revenue | $18,000 | $162,000 | $405,000 |
| Team annual revenue | $15,000 | $112,500 | $337,500 |
| Enterprise annual revenue | $6,000 | $90,000 | $450,000 |
| **Total revenue** | **$176,500** | **$364,500** | **$1,192,500** |

*Founding at avg $275. Pro at $180/yr. Team at $300/seat/yr. Enterprise at $600/seat/yr.*

**Moderate scenario** (2% SAM penetration):

| Metric | Y1 | Y2 | Y3 |
|--------|-----|-----|-----|
| Free users | 20,000 | 60,000 | 150,000 |
| Founding members | 1,000 (sold out) | 0 | 0 |
| Total revenue | $353,000 | $729,000 | $2,385,000 |

**Note on founding member economics**: 1000 perpetual v1.x licenses at $275 avg = $275K upfront cash. This funds 90+ months of operations at $3K/month burn. After founding closes, annual recurring kicks in. The founding cohort becomes zero-CAC ambassadors with skin in the game. Support is community-only for this tier — caps the cost spiral that kills most perpetual deals [V01].

### 11.3 Unit Economics

| Metric | Target | Benchmark |
|--------|--------|-----------|
| Gross margin | 90-95% | Near-zero marginal cost (no AI inference, no servers for CLI) |
| CAC (PLG, no sales team) | <$50 | Linear spent $35K total marketing to $400M valuation [R03 §B] |
| LTV (Pro annual, 3-year avg tenure) | $447 | $149 x 3 years |
| LTV (Lifetime) | $175 | One-time, but $0 ongoing cost = pure margin |
| LTV:CAC ratio | >8:1 | Healthy PLG target: >3:1 |
| Payback period | Instant (annual/lifetime) | No monthly = no multi-month payback calculation |
| Annual churn (dev tools) | <20% | Industry annual: 15-25%. Annual billing inherently reduces churn vs monthly [R08 §10.1] |

### 11.4 Cost Structure (Y1)

| Category | Monthly | Notes |
|----------|---------|-------|
| Infrastructure (Cloudflare, Stripe) | $200-500 | Minimal — CLI product, no hosted service in Y1 |
| Domain, DNS, static site hosting | $50 | Docs + marketing site |
| SOC 2 Type II audit | Deferred to Y2 | Only when enterprise pipeline justifies it [R06 §C4] |
| DevRel / content | $1,000 | Blog posts, community management |
| Total fixed burn | $2,000-3,000/month | Lean — no AI inference costs, no hosted compute |

### 11.5 Path to Break-Even

At $2,500/month fixed burn:
- Break-even at ~$2,500/month equivalent revenue
- 15 lifetime sales per month covers burn ($175 x 15 = $2,625)
- Or: 17 Pro annual sales ($149 x 17 / 12 = $211/month each = $3,587 amortized MRR)
- Timeline: month 2-4 in conservative scenario (lifetime sales alone cover burn)
- **The lifetime early-bird IS the break-even strategy** — 1000 sales at $175 = $175K covers 70 months of operations

---

## 12. Risk Register

### 12.1 Market Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Model providers ship their own harness** (Anthropic builds quality gates into Claude Code natively) | HIGH | CRITICAL | Open-core + multi-platform portability. If Claude Code ships built-in quality, the harness still runs on Codex and Hermes. Community + recipes are the moat, not the engine. |
| **Enterprise incumbents enter** (IBM Bob, Factory AI move downstream) | MEDIUM | HIGH | IBM targets $50K+ ACV enterprises [R09 §E]. Pipeline Fractale targets $228-$4,680/year individual/team segment. Different buyer, different motion. |
| **"Good enough" AGENTS.md standard evolves into full harness** | LOW | MEDIUM | AGENTS.md is a static spec by committee (OpenAI, Google, Cursor). Pipeline Fractale is a runtime with eval loops. Spec and product serve different functions. |
| **AI code quality improves, reducing need for harness** | MEDIUM | HIGH | Pivot to governance/compliance positioning. EU AI Act requires process documentation regardless of code quality [R09 §B1]. The harness becomes the compliance artifact generator. |

### 12.2 Execution Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **MIT enables copycat forks** | MEDIUM | MEDIUM | Accept this as a brand/career upside and ecosystem signal. Protect trademarks, official cloud, marketplace, premium packs, and enterprise support rather than restricting the public core. |
| **Free core too generous — users never convert** | MEDIUM | MEDIUM | Monetize convenience and organization value: hosted cloud, messaging control, scheduled agents, premium maintained packs, shared team state, compliance, and support. Monitor PQL signals around cloud/API/team usage. |
| **Free core too restrictive — no adoption flywheel** | LOW | HIGH | Keep local core genuinely useful: full CLI/RMS baseline, risk classes, hooks, public agents/skills, and docs. Do not use artificial risk-depth paywalls. |
| **Premium packs blur into crippled core** | MEDIUM | HIGH | If a capability is necessary for the public core to feel legitimate, keep it MIT. Paid packs must be advanced, maintained, convenience-oriented, or org-specific. |
| **Marketplace fails to attract third-party skill authors** | MEDIUM | MEDIUM | Phase 1 is free registry — zero barrier. Build 10+ first-party skills to seed the catalog. Only launch Phase 2 (monetization) when 50+ community skills exist [R10 §G]. |

### 12.3 Financial Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **AI inference costs spike** | MEDIUM | MEDIUM | Hybrid pricing with credits isolates margin. Pass-through billing on overages. Monitor Anthropic API pricing changes. Prompt caching reduces costs by up to 90% [R04 §B Claude Skills]. |
| **Pricing war in AI dev tools** | HIGH | LOW-MEDIUM | $19/month is already near the modal floor [R08 §3.1]. Compete on quality and compliance value, not price. Race to bottom only hurts capability-identical products. |
| **Enterprise sales cycle longer than projected** | HIGH | MEDIUM | Do not hire enterprise sales reps until >=3 deals requiring >10h hand-holding each [R03 §E]. PLG revenue funds operations while enterprise pipeline matures. |

### 12.4 Regulatory Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **EU AI Act enforcement delayed or weakened** | LOW | MEDIUM | Position 2 ("Quality Harness") does not depend on regulation. Quality value stands independent of compliance mandate. |
| **US federal AI regulation creates conflicting requirements** | LOW | LOW | US approach is deliberately fragmented and innovation-first [R09 §B2]. No mandatory federal framework for AI-assisted software development. Sectoral compliance (SEC, FDA) is additive, not conflicting. |
| **Open-source AI licensing landscape shifts** | MEDIUM | LOW | MIT is simple, OSI-approved, and familiar. The AI-specific licensing confusion (model weights, training data) does not affect a harness that orchestrates models — it does not contain one [R07 §F4]. |

---

## Appendix A — Research Report Index

| ID | Title | Lines | Key Data Points Used |
|----|-------|-------|---------------------|
| R01 | Open-Core Business Models | 617 | BBOC framework, 10 company profiles, 1-3% conversion, anti-patterns |
| R02 | AI Tools Pricing | 746 | 14 tools analyzed, $20/month consensus, credit-based trend, market size |
| R03 | PLG & GTM | 596 | Conversion benchmarks, first-1000 playbook, Linear case, channel ROI |
| R04 | Marketplace Economics | 504 | Take rate matrix, MCP ecosystem, harness marketplace feasibility |
| R05 | Competitive Landscape | 748 | TAM/SAM/SOM, gap analysis, harness engineering discipline |
| R06 | Enterprise Features | 460 | Feature decision matrix, pricing benchmarks, procurement process |
| R07 | Licensing | 520 | License decision tree, MIT/Apache vs AGPL trade-offs, CLA best practices |
| R08 | Pricing Psychology | 683 | $20 consensus, tier architecture, charm pricing, annual discount |
| R09 | AI Governance Market | 344 | $309M->$4.8B market, EU AI Act, T/F/M/E/C regulatory mapping |
| R10 | Community & Ecosystem | 455 | Contributor funnel, platform selection, governance transition |

## Appendix B — Named Components Reference

**12 Skills**: `classify-risk`, `propose-change`, `transition-phase`, `status` (core 4); `discovery-validate`, `cadrage-dor`, `conception-adr`, `build-inner-loop`, `validation-report`, `release-plan`, `run-monitor`, `apprentissage-retro` (cycle 8).

**9 Subagents**: `reviewer`, `threat-modeler`, `test-writer`, `evidence-collector` (MVP 4); `security-auditor`, `accessibility-checker`, `perf-profiler`, `doc-generator`, `retro-facilitator` (post-MVP 5).

**9 CLI Commands**: `install`, `uninstall`, `init`, `status`, `hook`, `transition`, `classify`, `doctor`, `evidence`.

**5 Risk Classes**: T (Trivial), F (Faible), M (Moyen), E (Eleve), C (Critique).

**8 Cycles**: 01-Discovery, 02-Cadrage, 03-Conception, 04-Build, 05-Validation, 06-Release, 07-Run, 08-Apprentissage.

---

*Document compiled 2026-05-03. All claims cite research reports [R01]-[R10]. All price points justified by market data. All tier features mapped to named skills, subagents, and CLI commands from specs 06/07/09.*
