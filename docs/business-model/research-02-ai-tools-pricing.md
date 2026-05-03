# AI Coding Tools & Agent Platforms — Pricing Research 2025-2026

**Research date:** 2026-05-03
**Sources consulted:** 35+ (official pricing pages, official blog announcements, market surveys, developer community data)
**Cross-validation:** All major claims backed by ≥2 independent sources

---

## Executive Summary

The AI coding assistant market hit approximately **$7.4B in revenue in 2025**, projected to reach **$12.8B by 2026** (CAGR ~27%). The market is undergoing a fundamental pricing model shift: flat-rate per-seat subscriptions (2022-2024) are being replaced by **hybrid credit/token-based usage models** (2025-2026). This shift is primarily driven by the escalating cost of frontier model inference, especially for agentic (multi-step) workloads.

Key structural finding: **no two tools price the same way**, making direct comparison deceptive. The relevant unit is total cost of ownership per developer-month under realistic usage patterns, not the headline subscription price.

**Market leaders by metric (May 2026):**
- Market share: GitHub Copilot ~42%, Cursor ~18%
- Revenue growth: Cursor ($2B ARR, fastest-growing SaaS ever to $1B then $2B)
- Paid subscribers: GitHub Copilot ~4.7M paid, Cursor ~1M+ paying users

---

## 1. GitHub Copilot

**Owner:** Microsoft/GitHub
**Model:** Per-seat subscription + usage-based credits (transitioning June 1, 2026)

### Pricing Tiers (Current → Post-June 2026)

| Plan | Price | Monthly AI Credits | Code Completions | Agent Mode |
|------|-------|-------------------|-----------------|-----------|
| Free | $0/month | Not included | 2,000/month | 50/month |
| Pro | $10/month | $10 (~1,000 credits) | Unlimited | Unlimited |
| Pro+ | $39/month | $39 (~3,900 credits) | Unlimited | Unlimited |
| Business | $19/user/month | $19/user (~1,900 credits) | Unlimited | Unlimited |
| Enterprise | $39/user/month | $39/user (~3,900 credits) | Unlimited | Unlimited |

**Note:** During transition (through August 2026), Business gets $30/month promotional credits, Enterprise gets $70/month.

### Free vs. Paid Differentiation

- Free: 50 premium requests/month, 2,000 code completions, no code review, no cloud agent
- Pro+: adds GitHub Spark access (preview), expanded premium model access (Claude Opus 4.7+)
- Business: adds admin dashboard, policy controls, IP indemnity, SSO
- Enterprise: adds SCIM, audit logs, organization-wide context, custom model fine-tuning

### Usage-Based Billing Transition (June 1, 2026)

The June 2026 shift is the most significant pricing change in Copilot's history. GitHub is replacing "premium requests" with "GitHub AI Credits" based on **token consumption** (input + output + cached tokens), at API rates per model.

Key credit facts:
- Code completions and Next Edit suggestions do **not** consume AI Credits (remain unlimited)
- Chat, agentic sessions, code review, and PR summaries **do** consume credits
- Additional credits purchasable at $0.04/request equivalent
- Unused credits **do not roll over** — reset monthly
- Annual plan holders keep current pricing until expiration, then transition

**Stated reason:** Copilot "evolved into an agentic platform capable of running long, multi-step coding sessions," creating unsustainable costs under the flat model.

### Controversy

Developer community pushback was immediate and significant (April 2026, Hacker News, GitHub Discussions #192963, Visual Studio Magazine):

- Core complaint: "You will get less, but pay the same price" — under the old model Pro included ~300 premium requests; under credits the same $10 buys fewer agentic operations
- Concerns about unpredictability: no real-time credit consumption visibility at time of announcement
- Heavy agentic users (the target audience for Pro+) face the highest cost escalation
- Developers compared it unfavorably to direct API access (Anthropic API at $3/$15 per MTok offers more transparency)
- Token-heavy workflows — chat sessions, agentic coding, code review — become cost-sensitive for the first time

Source: [GitHub Blog announcement](https://github.blog/news-insights/company-news/github-copilot-is-moving-to-usage-based-billing/), [GitHub Community Discussion #192948](https://github.com/orgs/community/discussions/192948)

### Enterprise Features

- SSO (SAML/OIDC), SCIM provisioning
- Audit logs and compliance controls
- Organization-wide context and custom instructions
- IP indemnification
- Deployed within GitHub.com (no self-hosted option for Copilot itself)
- 90% of Fortune 100 companies use GitHub Copilot (GitHub-reported)

---

## 2. Cursor

**Owner:** Anysphere Inc.
**Model:** Credit-based hybrid (flat subscription + credit pool consumed by model usage)
**ARR:** $2B+ (as of early 2026, doubled from $1B in Nov 2025)

### Pricing Tiers

| Plan | Price | Credits/Month | Key Differentiators |
|------|-------|--------------|---------------------|
| Hobby (Free) | $0 | Limited | Limited agent requests, limited Tab completions |
| Pro | $20/month | $20 pool | Unlimited Tab, extended Agent limits, all frontier models, Cloud Agents, MCPs |
| Pro+ | $60/month | $60 pool (3×) | Everything in Pro, 3× model usage |
| Ultra | $200/month | $200 pool (10×) | 20× usage vs Pro, priority new feature access |
| Teams | $40/user/month | Pro-equivalent per seat | Shared chats/commands/rules, centralized billing, usage analytics, RBAC, SAML/OIDC SSO |
| Enterprise | Custom | Pooled org-wide | Invoice/PO billing, SCIM, AI code tracking API, audit logs, granular model controls, priority support |

Annual billing saves ~20% on all paid tiers.

### Credit System (post-June 2025)

Before June 2025: request-based (Pro = 500 fast requests/month).
After June 2025: dollar-equivalent credits tied to model API costs.

- $20 in credits ≈ 200-300 premium requests depending on model and prompt length
- Heavier models (Claude Opus, GPT-4o) consume more credits per request
- Overages auto-billed at API rates

### Free vs. Paid Differentiation

- Free: limited agent requests (count unspecified), limited Tab completions, no MCPs, no Cloud Agents
- Pro: unlimited Tab, full agent access, all frontier models, $20 credit pool for premium interactions
- Teams adds org governance on top of Pro-equivalent per-seat access

### Enterprise Features

- SAML/OIDC SSO, SCIM seat management
- Org-wide privacy mode controls
- AI code tracking API and audit logs
- Granular admin and model controls
- Invoice/PO billing (vs credit card only on individual plans)
- Pooled usage across organization
- Custom contract terms

**Bugbot (separate product):** Code review tool at $40/user/month (Pro) or $40/user/month (Teams), with unlimited PR reviews on Teams. Enterprise is custom.

### Controversy — June/July 2025 Billing Incident

This is the most documented pricing controversy in AI coding tools to date:

- Cursor switched from request-based to credit-based billing in June 2025 with minimal advance notice
- Effective request counts dropped from ~500 to ~225 under the same $20/month
- Teams budgeted on $20/month predictability saw **$500+ in overage charges within days**
- A widely-cited Hacker News comment: "$350 on Cursor overage in like a week" (~$1,400/month equivalent, ~70× the mental model)
- Cursor posted a formal apology July 4, 2025 and offered refunds for June 16–July 4 overages
- Root cause: rising costs from OpenAI, Anthropic, and Google model providers as newer models became significantly more expensive

Source: [TechCrunch — Cursor apologizes](https://techcrunch.com/2025/07/07/cursor-apologizes-for-unclear-pricing-changes-that-upset-users/), [Medium — Silent 20× price raise analysis](https://medium.com/@jimeng_57761/when-cursor-silently-raised-their-price-by-over-20-and-more-what-is-the-message-the-users-are-6af93385f362), [Vantage — Cursor Pricing Explained](https://www.vantage.sh/blog/cursor-pricing-explained)

---

## 3. Windsurf (formerly Codeium)

**Owner:** Codeium Inc. (rebranded to Windsurf in 2025 to emphasize agentic editor positioning)
**Model:** Credit-based (flat subscription + credit pool)

### Pricing Tiers

| Plan | Price | Credits/Month | Key Features |
|------|-------|--------------|--------------|
| Free | $0 | 25 credits | Tab autocomplete (no credits), basic Cascade |
| Pro | $20/month | 500 credits (~$12/mo annual) | All premium models, Fast Context, SWE-1.5 model, full Cascade |
| Max | $200/month | At-API-price usage | Unlimited access, Devin Cloud sessions for background dev |
| Teams | $40/user/month | 500 credits/user | Everything in Pro + admin dashboard, SSO, usage analytics |
| Enterprise | Custom (~$60/user/month reported) | 1,000 credits/user | SSO, RBAC, compliance certifications, hybrid deployment |

Note: Earlier 2025 reports cited Windsurf Pro at $15/month with a 500-credit pool. The pricing page as of May 2026 shows $20/month for Pro, indicating a price increase. Annual billing reduces to ~$12/month.

**Tab autocomplete consumes no credits on any tier** — a key differentiator vs. Cursor where all model interactions draw from the credit pool.

### Free vs. Paid Differentiation

- Free: 25 credits ≈ ~3 days of normal coding; sufficient to evaluate but not for sustained work
- Pro: 500 credits + unlimited completions — the primary individual developer tier
- Max: effectively unlimited usage at API cost (no credit cap), plus background cloud dev sessions
- Teams/Enterprise: governance, SSO, RBAC on top of Pro/Max-equivalent access

### Enterprise Features

- Admin dashboard and usage analytics
- SSO (Teams tier)
- RBAC and volume discounts (Max/Enterprise)
- Hybrid deployment option (Enterprise)
- Compliance certifications (Enterprise)

### Notable

Windsurf has overhauled its pricing twice in 2025 per market analysts. The rebranding from Codeium to Windsurf signals a strategic pivot from "autocomplete tool" to "AI-native IDE" competing directly with Cursor.

Source: [Windsurf pricing page](https://windsurf.com/pricing), [DevTools Review](https://devtoolsreview.com/pricing/windsurf-pricing/)

---

## 4. Continue.dev

**Owner:** Continue (YC-backed, $5.6M total funding as of Feb 2025)
**Model:** Open-source core + Hub SaaS (token-based + seat-based hybrid)
**GitHub:** Apache 2.0 license

### Pricing Tiers (Continue Hub)

| Plan | Price | Key Features |
|------|-------|--------------|
| Free (Open Source) | $0 | Full IDE plugin, bring your own API keys, VS Code + JetBrains |
| Team | $20/seat/month ($10 in credits included) | Shared private agents, team management, usage controls, GitHub/Gmail SSO |
| Company | Custom | All Team features + custom SAML/OIDC SSO, BYOK (bring your own keys), commitment/invoicing/SLA |

**Models Add-On:** Flat monthly fee for access to frontier AI models through Continue's provider (pay-as-you-go token pricing at $3/MTok baseline).

### Business Model

Continue monetizes via Continue Hub — a collaborative layer on top of the open-source plugin:
- Free self-hosted usage (no revenue): users bring their own API keys
- Paid Hub tier: Continue acts as model broker + team collaboration layer
- Enterprise: custom contracts for organizations needing SSO, SLA, and compliance

The model is explicitly **BYOK-first** — Continue never locks users into their model provider. This is their key differentiator versus every other tool on this list.

**Funding context:** $3M raised Feb 2025 (Seed round), $5.6M total across 3 rounds. Pre-revenue scale; monetization is early-stage.

Source: [Continue.dev pricing](https://www.continue.dev/pricing), [docs.continue.dev](https://docs.continue.dev/hub/governance/pricing)

---

## 5. Sourcegraph — Cody Discontinued, Amp is the New Product

**Owner:** Sourcegraph
**Status as of July 2025:** Cody Free and Cody Pro **discontinued**. Cody Enterprise continues. Amp is the new individual/team product.

### Historical Cody Pricing (discontinued)

| Plan | Price | Status |
|------|-------|--------|
| Cody Free | $0 | Discontinued July 23, 2025 |
| Cody Pro | $9/user/month | Discontinued July 23, 2025 |
| Enterprise Starter | $19/user/month (up to 50 devs) | New workspaces no longer include Cody |
| Cody Enterprise | $59/user/month | Still active, unaffected |

### Amp (Successor Product)

**URL:** ampcode.com
**Model:** Pay-as-you-go, no markup for individuals

- **Amp Free:** Available, ad-free, limited usage
- **Individual:** Pay-as-you-go at API cost with no markup (pass-through pricing)
- **Enterprise:** Contact sales — Sourcegraph platform starts at **$16K/year** scaling with team size

Migration incentive: Cody Pro/Enterprise Starter users can receive $40 in free Amp credits; new users receive $10 in free credits.

### Sourcegraph Platform (Enterprise Code Intelligence)

The broader Sourcegraph platform (code search, code navigation, batch changes, AI Deep Search) starts at **$16K/year** and scales with team size. This is the enterprise product that integrates with Claude Code, Cursor, Codex, and Amp.

**Key strategic insight:** Sourcegraph is betting that the future is a **model-agnostic coding platform** rather than a locked-in assistant. They provide the context/search layer that any agent (Claude Code, Cursor, Codex) can call into.

Source: [Sourcegraph pricing page](https://sourcegraph.com/pricing), [Cody plan changes blog](https://sourcegraph.com/blog/changes-to-cody-free-pro-and-enterprise-starter-plans), [Amp site](https://ampcode.com/)

---

## 6. Amazon Q Developer

**Owner:** AWS/Amazon
**Model:** Freemium + per-seat Pro subscription with overage pricing

### Pricing Tiers

| Plan | Price | Agentic Requests | Java Transform LOC | Admin Dashboard |
|------|-------|-----------------|-------------------|----------------|
| Free | $0 | 50/month | 1,000 LOC/month | No |
| Pro | $19/user/month | Unlimited (within service limits) | 4,000 LOC/month (pooled) | Yes |

**Overage pricing (Pro):** $0.003 per line of code submitted for transformation beyond 4,000 LOC.

### Free vs. Paid Differentiation

- Free: 50 agentic requests/month is limiting for daily use; no admin, no IP indemnity, no identity center support
- Pro: unlimited IDE suggestions and agentic requests; admin dashboard; IP indemnity; Identity Center (SSO) support; auto opt-out from AWS data collection for model training

### Enterprise Features (Pro tier)

- Admin dashboard with user/policy management
- AWS Identity Center integration
- IP indemnification
- Automatic opt-out from AWS data collection
- Custom codebase context (private model fine-tuning via Amazon Bedrock)

### Strategic Note

Amazon Q Developer is **deeply embedded in the AWS ecosystem** — it understands AWS APIs, IAM policies, CloudFormation, CDK natively. For AWS-heavy shops, the $19/month Pro tier competes well against GitHub Copilot Business at the same price point. For non-AWS shops, the lock-in makes it less compelling.

Source: [AWS Q Developer pricing](https://aws.amazon.com/q/developer/pricing/), [AWS docs — Q tiers](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/q-tiers.html)

---

## 7. Tabnine

**Owner:** Tabnine Ltd.
**Model:** Per-seat subscription (enterprise-only, no self-serve free tier as of April 2025)
**Positioning:** Privacy-first, enterprise-grade, deployment-flexible

### Pricing Tiers (as of 2025-2026)

| Plan | Price | Key Differentiator |
|------|-------|-------------------|
| Code Assistant | $39/user/month (annual) | Completions, chat, IDE integrations, Jira Cloud |
| Agentic Platform | $59/user/month (annual) | Adds autonomous agents, CLI, full Context Engine, MCP tools |
| Enterprise Custom | Negotiated | Air-gapped deployment, custom model fine-tuning |

**Important:** Tabnine's Basic free plan was **sunset in April 2025**. There is no longer a free tier. The company moved to paid-only with trial access.

**LLM usage costs:** Apply separately. When using Tabnine-provided LLM access (vs. BYOK), a **5% handling fee** applies on top of provider pricing.

### Enterprise Features

- Flexible deployment: SaaS, VPC, on-premises, **fully air-gapped** (unique in this list)
- Zero code retention: no storage, no training on customer code
- GDPR, SOC 2, ISO 27001, and additional compliance certifications
- IP indemnification
- Governance controls and advanced analytics
- Private codebase context connections (unlimited in Agentic tier)
- Priority support and team training

**Scale cost example:** 500-developer team × $39 = **$234,000/year** at list price. Volume discounts available at enterprise contract.

### Key Differentiator vs. Competition

Tabnine is the only major tool in this list that offers fully **air-gapped on-premises deployment**. This makes it the default choice for defense, healthcare, and financial organizations with strict data residency requirements where SaaS tools are non-starters.

Source: [Tabnine pricing page](https://www.tabnine.com/pricing/), [Tabnine Enterprise vs GitHub Copilot Business](https://www.tabnine.com/blog/tabnine-enterprise-vs-github-copilot-business/)

---

## 8. Devin by Cognition

**Owner:** Cognition AI
**Model:** Usage-based (ACU — Agent Compute Units) with per-seat subscription floor
**Notable:** Originally launched at $500/month in 2024; Devin 2.0 dropped entry price to $20/month

### Pricing Tiers (Devin 2.0, 2025)

| Plan | Price | Quota | ACU Rate | Key Features |
|------|-------|-------|----------|--------------|
| Free | $0 | Limited | N/A | Basic Devin, Devin Review, DeepWiki (basic) |
| Pro | $20/month | Defined quota | Pay-as-you-go overage in $$ | Devin + Windsurf IDE quota, Slack/Linear/MCP integrations |
| Max | $200/month | Larger quota | Pay-as-you-go overage | Everything Pro + expanded quotas |
| Teams | $80/month min | Usage-based | Unlimited team members | Sharing, collaboration, admin dashboard, centralized billing |
| Enterprise | Custom | Custom | Custom | SAML/OIDC SSO, VPC deployment, dedicated account team, teamspace isolation |

**ACU Definition:** 1 ACU = approximately 15 minutes of Devin actively working on a task. Enterprise billing still uses ACUs at $2.25/ACU.

**Previous pricing for context:**
- Original 2024 launch: $500/month (Team plan, 250 ACUs included)
- Devin 2.0: Entry dropped to $20/month — a 25× price reduction signaling competitive pressure

### Free vs. Paid Differentiation

Devin is fundamentally different from IDE assistants — it is an **autonomous software engineer agent** that runs in its own sandboxed environment, not inside the developer's IDE. Free tier provides limited access to evaluate; paid tiers define quota; Teams/Enterprise add org controls.

**Key products:**
- Ask Devin: agent-based coding work (was free, now pay-per-use in new plans)
- Devin Review: PR review agent (2-week free trial, then paid)
- DeepWiki: codebase documentation (basic free, premium generation paid)

### Enterprise Features

- SAML/OIDC SSO
- Centralized enterprise admin controls
- VPC deployment (private cloud)
- Teamspace isolation
- Dedicated account team and custom terms

Source: [Devin pricing page](https://devin.ai/pricing/), [Cognition — New self-serve plans blog](https://cognition.ai/blog/new-self-serve-plans-for-devin), [VentureBeat — Devin 2.0 price cut](https://venturebeat.com/programming-development/devin-2-0-is-here-cognition-slashes-price-of-ai-software-engineer-to-20-per-month-from-500/), [TechCrunch — pay-as-you-go](https://techcrunch.com/2025/04/03/devin-the-viral-coding-ai-agent-gets-a-new-pay-as-you-go-plan/)

---

## 9. OpenHands (All Hands AI)

**Owner:** All Hands AI
**Model:** Open-source (MIT) core + SaaS cloud + Enterprise tier
**GitHub stars:** 60,000+ (as of late 2025), 7,000 forks, 4M+ downloads
**Funding:** $18.8M Series A (Nov 2025)

### Pricing Tiers

| Plan | Price | Conversations/Day | Deployment | Model |
|------|-------|------------------|------------|-------|
| Open Source (Local) | Free | Unlimited | Self-hosted | BYOK (any model) |
| Individual (SaaS) | Free | 10/day | Hosted cloud | BYOK or OpenHands LLM provider (at cost, no markup) |
| Enterprise | Custom | Unlimited | SaaS or self-hosted VPC | BYOK |

### Business Model

OpenHands monetizes through the Enterprise tier:
- Self-hosted OpenHands Cloud in customer VPC via Kubernetes
- OpenHands Enterprise license (source-available, not fully open-source) for orgs running > 1 month
- LLM pass-through: when using OpenHands' hosted LLM provider, they charge at cost with **no markup** (same model as Continue.dev and Amp for individuals)
- Enterprise services: named customer engineer, priority support via shared Slack channel, Large Codebase SDK

**MIT license (core) vs. source-available (enterprise/):** The enterprise directory has restricted licensing — a common "open-core" pattern.

### Key Differentiators

- Model-agnostic: no vendor lock-in, supports local/self-hosted models
- Sandboxed execution in Docker/Kubernetes — auditability and security by design
- $18.8M Series A specifically to "bring open-source cloud coding agents to enterprises" and solve "87% of bug tickets same day" (company claim)

Source: [OpenHands pricing](https://openhands.dev/pricing), [All Hands $18.8M Series A press release](https://www.businesswire.com/news/home/20251118768131/en/OpenHands-Raises-$18.8M-Series-A-to-Bring-Open-Source-Cloud-Coding-Agents-to-Enterprises)

---

## 10. Aider

**Owner:** Paul Gauthier (open-source maintainer)
**Model:** Zero monetization — Apache 2.0 license
**Cost to user:** API tokens only (no tool cost)

### Pricing Model

Aider itself costs **$0**. There are no tiers, no subscriptions, no enterprise plans, and no revenue model for the tool itself.

Cost structure for users:
- Claude Sonnet 4.6 via Aider: ~$5–$15/day for active coding
- Claude Opus 4.6 via Aider: ~$15–$40/day
- GPT-4o: comparable range
- Total practical monthly cost: $30–$60/month in API tokens for typical use

**The model is BYOK (bring your own key)** — users supply API keys to Anthropic, OpenAI, Gemini, Ollama, or any compatible provider.

### Why It Matters for Competitive Analysis

Aider represents the **floor benchmark** for what a developer can achieve without paying for any assistant tool overhead. Any tool charging $20+/month must justify that cost against "just use Aider + your own API key."

Aider's benchmark performance on SWE-bench is competitive with many commercial tools, making its $0 tool cost a genuine competitive pressure point on the low end of the market.

Source: [aider.chat](https://aider.chat/), [Aider vs Claude Code comparison](https://www.developersdigest.tech/blog/aider-vs-claude-code)

---

## 11. Augment Code

**Owner:** Augment Code Inc.
**Model:** Credit-based subscription (per-seat with pooled credit allocation)
**Pricing changed:** October 20, 2025 (moved from message-count to credit-based)

### Pricing Tiers (post-October 2025)

| Plan | Price | Credits/Month | Max Users | Key Features |
|------|-------|--------------|-----------|--------------|
| Indie | $20/month | 40,000 | 1 | Context Engine, coding agent, chat, MCP tools |
| Standard | $60/user/month | 130,000 (pooled) | 20 | Everything Indie + advanced analytics, GitHub multi-org |
| Max | $200/user/month | 450,000 (pooled) | 20 | Everything Standard + higher limits |
| Enterprise | Custom | Custom | Unlimited | Dedicated support, CMEK, ISO 42001, SIEM, data residency, audit trails, enterprise SSO |

### Credit System

- 1 credit = ~1 tool call unit
- Small task (10 tool calls) ≈ 300 credits
- Complex task (60 tool calls) ≈ 4,300 credits
- Additional credits via auto top-up: **$15 per 24,000 credits** (purchased credits expire 12 months after purchase)
- Credits are pooled at team level (flexible distribution across developers)

### Free vs. Paid

No free tier. The Indie plan at $20/month is the entry point. All paid plans include:
- SOC 2 Type II compliance
- No AI training on user code (per Commercial Terms)
- Context Engine (proprietary large-codebase understanding)
- Code review (PR summaries, inline comments)

**New in May 2026:** Augment Code announced on X an "Indie" tier at $20/month with 125 agent messages/month and access to GPT-5 and Claude Sonnet 4 — indicating they may be transitioning back toward message-count limits as a simpler UX.

Source: [Augment Code pricing](https://www.augmentcode.com/pricing), [Augment pricing change blog](https://www.augmentcode.com/blog/augment-codes-pricing-is-changing), [Credit-based pricing docs](https://docs.augmentcode.com/models/credit-based-pricing)

---

## 12. Poolside AI

**Owner:** Poolside AI Inc.
**Model:** Enterprise B2B only — custom contracts, no self-serve
**Funding:** $400M+ raised (2024), ~$2B valuation

### Pricing Structure

- **No public pricing.** All contracts are negotiated enterprise deals.
- Target customer: organizations with **5,000+ developers**
- Reported sectors: finance (major banks), defense (RTX Corporation and other defense contractors)
- AWS partnership: available via Amazon Bedrock (models: Malibu, Point)

### Business Model

Poolside does not sell API access or per-seat subscriptions. The model is:

1. Customer ingests their codebase + dev history into Poolside's system
2. Poolside spins up dedicated training environments within customer's infrastructure (on-premises, private VPC, or AWS)
3. Custom fine-tuned models delivered within customer boundaries — zero code leaves the enterprise perimeter
4. Ongoing subscription for model updates and support

This is the **highest-end, highest-privacy** play in the market. No pricing signal is public; estimates from Crunchbase/Sacra suggest deals in the $1M–$10M/year range for large enterprises.

Source: [Poolside enterprise page](https://poolside.ai/enterprise), [AWS Bedrock Poolside](https://aws.amazon.com/bedrock/poolside/), [TechCrunch $400M raise](https://techcrunch.com/2024/06/20/poolside-raising-400m-at-a-2b-valuation-for-supercharged-coding-copilot/)

---

## 13. Claude Code (Anthropic)

**Owner:** Anthropic
**Model:** Bundled with Claude subscription tiers OR API-based pay-per-token

### Subscription Tiers with Claude Code Access

| Plan | Price | Claude Code | Usage Level |
|------|-------|-------------|-------------|
| Free | $0/month | Included (limited) | Basic |
| Pro | $20/month (or $17/month annual) | Included | Standard |
| Max 5× | $100/month | Included | 5× Pro usage |
| Max 20× | $200/month | Included | 20× Pro usage |
| Team Standard | $20/seat/month (or $25 monthly) | Not included | Standard |
| Team Premium | $100/seat/month (or $125 monthly) | Included | 5× Standard |
| Enterprise | $20/seat + API usage at API rates | Included | Variable |

**Important controversy (April 2026):** Anthropic briefly removed Claude Code from the $20/month Pro plan for new users, then reversed the change. This caused significant confusion and coverage (Simon Willison blog, Ed Zitron newsletter). The current state: Pro includes Claude Code.

### API Pricing (for direct Claude Code / agent usage)

| Model | Input (per MTok) | Output (per MTok) | Cached Input |
|-------|-----------------|-------------------|--------------|
| Haiku 4.5 | $1.00 | $5.00 | $0.10 |
| Sonnet 4.6 | $3.00 | $15.00 | $0.30 |
| Opus 4.6 | $15.00 | $75.00 | $1.50 |

**Batch API discount:** 50% off input and output tokens for asynchronous batch processing.
**Long-context pricing:** No surcharge for 1M-token context windows on Sonnet 4.6 or Opus 4.6 (surcharge removed).

### Real-World Claude Code Cost Data (Enterprise)

From Anthropic's own cost management documentation and third-party analysis:
- Average cost: ~$13/developer/active day
- Typical monthly cost: $150–$250/developer/month on API billing
- 90th percentile: below $30/active day
- Heavy users (agentic workflows all day): can reach $100+/day on Opus 4.6

A widely-cited analysis ("No, it doesn't cost Anthropic $5k per Claude Code user") estimated that even high-usage Claude Code Pro subscribers cost Anthropic significantly less than the viral $5K/user claim, but costs are still higher than standard Claude Pro usage, explaining the Max plan introduction.

Source: [Claude pricing page](https://claude.com/pricing), [Claude Code cost docs](https://code.claude.com/docs/en/costs), [Anthropic API pricing](https://platform.claude.com/docs/en/about-claude/pricing), [Simon Willison — Claude Code confusion](https://simonwillison.net/2026/Apr/22/claude-code-confusion/)

---

## 14. OpenAI Codex

**Owner:** OpenAI
**Model:** Bundled with ChatGPT plans + API per-token pricing
**Note:** Codex here refers to the 2025 cloud-based software engineering agent (not the legacy 2021 code completion model)

### Pricing Tiers

| Access Method | Price | Codex Inclusion | Usage Limit |
|---------------|-------|----------------|-------------|
| ChatGPT Free | $0 | No | N/A |
| ChatGPT Plus | $20/month | Yes (standard) | Standard quota |
| ChatGPT Pro | $200/month | Yes (2× standard, through May 31 2026: 10× standard) | 2× base |
| ChatGPT Business | $30/user/month | Yes | Standard |
| ChatGPT Enterprise | $60/user/month | Yes | Enhanced |

**Pay-as-you-go API (Responses API):**
- Model: `codex-mini-latest`
- Input: $1.50 per 1M tokens
- Output: $6.00 per 1M tokens
- Prompt cache discount: **75%** off cached input tokens

**Codex agent (`codex-1`):** Available to Pro, Business, and Enterprise ChatGPT users. Can run multiple tasks in parallel in sandboxed cloud environments.

### Free vs. Paid

- Free: no Codex agent access
- Plus/Pro: Codex agent available, usage capped per plan
- Pro bonus (through May 2026): 2× usage = 10× standard (promotional)
- API: pay-as-you-go with no subscription required, billed at token rates

### Strategic Note

OpenAI moved Codex API pricing to token-based rates in April 2025, aligning with their standard API model. The `codex-mini-latest` model at $1.50/$6.00 per MTok is priced below GPT-4o ($5/$15), positioning it as a cost-efficient coding-specific model.

Source: [OpenAI Codex pricing](https://developers.openai.com/codex/pricing), [OpenAI — Codex flexible pricing for teams](https://openai.com/index/codex-flexible-pricing-for-teams/), [OpenAI — Introducing Codex](https://openai.com/index/introducing-codex/)

---

## 15. Comparative Analysis

### Pricing Model Taxonomy

| Tool | Model Type | Entry Price | Team Price | Enterprise |
|------|-----------|-------------|------------|------------|
| GitHub Copilot | Credit/seat hybrid (June 2026) | $10/mo | $19/user/mo | $39/user/mo |
| Cursor | Credit-based | $20/mo | $40/user/mo | Custom |
| Windsurf | Credit-based | $20/mo | $40/user/mo | Custom |
| Continue.dev | BYOK + Hub SaaS | $0 | $20/seat/mo | Custom |
| Sourcegraph/Amp | PAYG pass-through | $0 (limited) | Contact | $16K+/year |
| Amazon Q Developer | Freemium + per-seat | $0 | $19/user/mo | Custom |
| Tabnine | Per-seat (paid only) | $39/user/mo | $39/user/mo | Custom |
| Devin | ACU usage-based | $20/mo | $80/mo min | Custom |
| OpenHands | Open-source + PAYG | $0 | $0 (limited) | Custom |
| Aider | 100% free tool | $0 | $0 | N/A |
| Augment Code | Credit-based | $20/mo | $60/user/mo | Custom |
| Poolside AI | Custom enterprise | N/A | N/A | $1M+/year est. |
| Claude Code | Subscription + API | $0 (limited) | $100/seat/mo | API rates |
| OpenAI Codex | Subscription + API | $0 (no agent) | $30/user/mo | $60/user/mo |

### Annual Cost at 100-Developer Scale (List Price, No Discount)

| Tool | Annual Cost (100 devs) | Notes |
|------|----------------------|-------|
| Amazon Q Developer (Pro) | $22,800 | Cheapest at-scale per-seat |
| GitHub Copilot Business | $22,800 | Same price as Q |
| Continue.dev Team | $24,000 | BYOK model costs additional |
| Cursor Pro (individual) | $24,000 | Teams tier: $48,000 |
| Windsurf Pro (individual) | $24,000 | Teams tier: $48,000 |
| Augment Code Standard | $72,000 | High baseline vs completions-focused tools |
| Tabnine Code Assistant | $46,800 | No free tier |
| Tabnine Agentic | $70,800 | Full agentic features |
| GitHub Copilot Enterprise | $46,800 | Max Copilot tier |
| Claude Code (Team Premium) | $120,000 | $100/seat × 12 × 100 |

**Hidden cost multiplier:** Heavy agentic usage adds 2×–5× on top of subscription fees via credit overages. Budget conservatively at 1.5× the base subscription for active teams.

### Key Differentiators by Segment

**Best for AWS shops:** Amazon Q Developer — native AWS context, lowest price at $19/seat
**Best for privacy/air-gap:** Tabnine — only player with certified air-gapped deployment
**Best for open-source/BYOK:** Continue.dev + Aider — full control, no vendor lock-in
**Best for autonomous agent work:** Devin — purpose-built autonomous engineer, not IDE assistant
**Best for enterprise code intelligence platform:** Sourcegraph — code search + navigation layer that augments any agent
**Best developer UX/growth:** Cursor — $2B ARR validates product-market fit
**Lowest total cost (small team):** Aider (free) + own API keys
**Highest ceiling (regulated enterprise):** Poolside AI — air-gapped custom model per org

---

## 16. Market Context

### Market Size

| Year | Market Size | Source |
|------|-------------|--------|
| 2024 | $4.91B | Market research aggregates |
| 2025 | $7.37B–$7.4B | Multiple analyst estimates |
| 2026 | $12.8B | Projected |
| 2032 | $30.1B (projected) | CAGR 27.1% |

Gartner estimate for AI code-assistant specifically: $3.0–$3.5B in 2025 (narrower definition than full AI dev tools market).

### Developer Adoption (Stack Overflow 2025 Survey, n=65,000+)

- 84% using or planning to use AI development tools (up from 76% in 2024)
- 51% of professional developers use AI tools daily
- 62% rely on at least one AI coding assistant, agent, or IDE
- AI tool **trust has dropped**: accuracy trust fell from 40% (2024) to 29% (2025)
- Positive sentiment dropped: 70%+ (2023-2024) to 60% (2025)

### Willingness to Pay Signals

- $20/month appears to be the **psychological price ceiling** for individual developers (Pro tiers cluster at $20)
- $100–$200/month Max tiers exist but have narrow audiences (power users, AI-native development shops)
- Enterprise deals close at $19–$59/user/month for seat-based tools
- Volume negotiations yield 20–40% reductions from list price
- Annual billing discount standard: 15–20% across the board

### Revenue Leaders

| Company | ARR/Revenue | Paying Users | Notes |
|---------|-------------|--------------|-------|
| GitHub Copilot | Est. $400M–$1B | 4.7M paid subscribers | Microsoft does not disclose separately |
| Cursor (Anysphere) | $2B+ ARR | 1M+ paying | Fastest-growing SaaS to $1B then $2B |
| Other tools | Not disclosed | — | Windsurf, Tabnine, Amazon Q undisclosed |

### Productivity Data (to justify cost)

- Average time saved: ~3.6 hours/week per developer using AI tools
- Daily AI users merge 60% more PRs than light users
- 55.8% faster task completion with GitHub Copilot (Microsoft/GitHub research)
- 22% of merged code is AI-authored (DX telemetry, 135,000+ developer sample)
- Caveat: AI-coauthored PRs show ~1.7× more issues than human-only PRs (CodeRabbit analysis)

At a $100K loaded developer cost, 3.6 hours/week saved = ~$9,000/year in productivity value. Any tool under $500/year ($41.67/month) has positive ROI at this calculation — which covers every individual tier on this list.

---

## 17. Pricing Controversy Patterns

### Pattern 1: Opaque Usage-Based Transitions (Cursor June 2025)

Cursor switched billing models mid-cycle without adequate notice. Result: some customers saw 70× cost spikes. Cursor issued refunds and an apology. **Lesson:** Usage-based billing requires real-time cost dashboards before rollout, not after.

### Pattern 2: Agentic Cost Escalation (GitHub Copilot April 2026)

GitHub's stated reason for moving to credits: agentic sessions are "unsustainable" under flat pricing. This reveals a structural problem: per-seat flat pricing was priced for autocomplete workflows, but agentic multi-step sessions consume 10×–100× more compute per developer-hour.

### Pattern 3: Free Tier Elimination (Tabnine April 2025, Sourcegraph Cody July 2025)

Both Tabnine and Sourcegraph eliminated their free/freemium tiers in 2025. This signals that the "land with free, expand to enterprise" model is not sustainable when per-user model inference costs are significant. The future free tier is: open-source tool (Continue.dev, Aider, OpenHands) + BYOK, not SaaS-hosted free.

### Pattern 4: Devin Price Collapse (2024 → 2025)

Devin launched at $500/month in 2024, cited as "obviously too expensive." Devin 2.0 dropped to $20/month entry. This 25× reduction reflects competitive pressure from Claude Code, Cursor, and OpenAI Codex, all of which gained autonomous agent capabilities.

### Pattern 5: Credit Pooling Without Visibility

Multiple tools (Augment Code, Windsurf, Cursor) pool credits at team level but lack real-time dashboards at time of launch. Organizations routinely overspend by 2×–3× in the first billing cycle.

---

## Sources

1. [GitHub Copilot Plans & Pricing — GitHub Docs](https://docs.github.com/en/copilot/get-started/plans) (official, 2026)
2. [GitHub Copilot moving to usage-based billing — GitHub Blog](https://github.blog/news-insights/company-news/github-copilot-is-moving-to-usage-based-billing/) (official, April 2026)
3. [GitHub Copilot changes to individual plans — GitHub Blog](https://github.blog/news-insights/company-news/changes-to-github-copilot-individual-plans/) (official, 2026)
4. [GitHub Community Discussion #192948](https://github.com/orgs/community/discussions/192948) (developer community, 2026)
5. [Cursor Pricing Page](https://cursor.com/pricing) (official, May 2026)
6. [Cursor apologizes for unclear pricing changes — TechCrunch](https://techcrunch.com/2025/07/07/cursor-apologizes-for-unclear-pricing-changes-that-upset-users/) (July 2025)
7. [Cursor pricing controversy — Medium/Jimeng](https://medium.com/@jimeng_57761/when-cursor-silently-raised-their-price-by-over-20-and-more-what-is-the-message-the-users-are-6af93385f362) (2025)
8. [Cursor Pricing Explained — Vantage](https://www.vantage.sh/blog/cursor-pricing-explained) (2026)
9. [Windsurf Pricing Page](https://windsurf.com/pricing) (official, May 2026)
10. [Windsurf Pricing Review — DevTools Review](https://devtoolsreview.com/pricing/windsurf-pricing/) (2026)
11. [Continue.dev Pricing](https://www.continue.dev/pricing) (official, 2026)
12. [Continue Hub Governance Pricing — Docs](https://docs.continue.dev/hub/governance/pricing) (official, 2026)
13. [Sourcegraph Pricing](https://sourcegraph.com/pricing) (official, May 2026)
14. [Changes to Cody plans — Sourcegraph Blog](https://sourcegraph.com/blog/changes-to-cody-free-pro-and-enterprise-starter-plans) (official, 2025)
15. [Amp by Sourcegraph](https://ampcode.com/) (official, 2026)
16. [Amazon Q Developer Pricing — AWS](https://aws.amazon.com/q/developer/pricing/) (official, 2026)
17. [Amazon Q Developer tiers — AWS Docs](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/q-tiers.html) (official, 2026)
18. [Tabnine Pricing Page](https://www.tabnine.com/pricing/) (official, May 2026)
19. [Tabnine Enterprise vs GitHub Copilot Business — Tabnine Blog](https://www.tabnine.com/blog/tabnine-enterprise-vs-github-copilot-business/) (official, 2025)
20. [Devin Pricing Page](https://devin.ai/pricing/) (official, May 2026)
21. [Cognition — New self-serve plans for Devin](https://cognition.ai/blog/new-self-serve-plans-for-devin) (official, 2025)
22. [Devin 2.0 price cut — VentureBeat](https://venturebeat.com/programming-development/devin-2-0-is-here-cognition-slashes-price-of-ai-software-engineer-to-20-per-month-from-500/) (2025)
23. [Devin pay-as-you-go plans — TechCrunch](https://techcrunch.com/2025/04/03/devin-the-viral-coding-ai-agent-gets-a-new-pay-as-you-go-plan/) (April 2025)
24. [OpenHands Pricing](https://openhands.dev/pricing) (official, 2026)
25. [OpenHands $18.8M Series A — BusinessWire](https://www.businesswire.com/news/home/20251118768131/en/OpenHands-Raises-$18.8M-Series-A-to-Bring-Open-Source-Cloud-Coding-Agents-to-Enterprises) (Nov 2025)
26. [Aider — AI Pair Programming](https://aider.chat/) (official, 2026)
27. [Augment Code Pricing](https://www.augmentcode.com/pricing) (official, May 2026)
28. [Augment Code pricing change blog](https://www.augmentcode.com/blog/augment-codes-pricing-is-changing) (Oct 2025)
29. [Augment Code credit-based pricing docs](https://docs.augmentcode.com/models/credit-based-pricing) (official, 2026)
30. [Poolside AI enterprise](https://poolside.ai/enterprise) (official, 2026)
31. [AWS Bedrock Poolside](https://aws.amazon.com/bedrock/poolside/) (official, 2025)
32. [Claude Pricing — Anthropic](https://claude.com/pricing) (official, May 2026)
33. [Claude API Pricing Docs](https://platform.claude.com/docs/en/about-claude/pricing) (official, 2026)
34. [Claude Code cost management docs](https://code.claude.com/docs/en/costs) (official, 2026)
35. [Claude Code pricing confusion — Simon Willison](https://simonwillison.net/2026/Apr/22/claude-code-confusion/) (April 2026)
36. [OpenAI Codex Pricing](https://developers.openai.com/codex/pricing) (official, 2026)
37. [OpenAI Codex flexible pricing for teams](https://openai.com/index/codex-flexible-pricing-for-teams/) (official, 2025)
38. [AI Coding Assistant Pricing Comparison — DX/GetDX](https://getdx.com/blog/ai-coding-assistant-pricing/) (2025)
39. [AI Coding Assistant Statistics — GetPanto](https://www.getpanto.ai/blog/ai-coding-assistant-statistics) (2026)
40. [Stack Overflow Developer Survey 2025 — AI section](https://survey.stackoverflow.co/2025/ai) (2025)
41. [Cursor Revenue statistics — GetPanto](https://www.getpanto.ai/blog/cursor-ai-statistics) (2026)
42. [GitHub Copilot statistics — GetPanto](https://www.getpanto.ai/blog/github-copilot-statistics) (2026)
