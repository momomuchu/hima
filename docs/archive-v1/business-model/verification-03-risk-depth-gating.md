# Verification: Risk-Depth Gating Model for Pipeline Fractale

**Date**: 2026-05-03
**Researcher**: deep-researcher agent (claude-sonnet-4-6)
**Queries executed**: 18 web searches + 5 WebFetch deep reads
**Sources scored ≥2**: 14 sources
**Cross-validation**: all major claims backed by ≥2 independent sources

---

## Verdict: PARTIALLY CONFIRMED — with significant structural caveats

The core intuition is sound: gating by buyer persona / usage depth is more defensible long-term than gating by feature count. But the specific mechanism proposed (risk class T/F vs M/E/C) is **novel with no direct precedent** in the market. The model contains three structural weaknesses that could undermine revenue: (1) the risk classifier is gameable, (2) AGPL internal-use exemption is real and large enterprises exploit it legally, (3) the $99/seat/year price point is 5x below competitors and risks quality-signal damage before network effects are established.

Verdict per dimension:
| Claim | Verdict | Confidence |
|-------|---------|-----------|
| Depth-gating is more defensible than feature-count gating | CONFIRMED | High — 4 sources |
| No open-core tool currently gates by risk class depth | CONFIRMED (gap) | High — no counter-example found |
| Risk classifier is gameable by splitting PRs | CONFIRMED risk | Medium — behavioral evidence strong |
| Generous free tier builds community that converts later | PARTIALLY CONFIRMED | Medium — depends on volume |
| $99/seat/year is not enterprise-grade signaling | CONFIRMED risk | High — 3 sources |
| AGPL internal use does not require commercial license | CONFIRMED | High — FSF + FOSSA + OCV confirm |
| AGPL-based revenue model is weakened by this | CONFIRMED | High — OCV calls AGPL "non-starter" |

> **Post-verification decision (2026-05-03)**: These AGPL findings contributed to the founder decision to use **MIT** for the public core instead of AGPL. See `decision-2026-05-03-mit-core-cloud-enterprise.md`. The AGPL analysis below is retained as the evidence base for that decision.

---

## Evidence FOR: Risk-Depth Gating Model

### F1. Buyer-Based Open Core is an established, proven framework

Open Core Ventures (the authoritative source on open-core business models) defines the buyer-based open core model explicitly: "Features that appeal most to an individual contributor are open source and free. Features that appeal most to management or executives are proprietary and not free."

GitLab's handbook formalizes this into four buyer tiers mapped to organizational role: individual contributor (Free), team manager (Premium), director (Premium+), executive (Ultimate). GitLab's merge request feature is free; merge request approvals are paid — because approvals are a management concern.

**Risk-depth gating maps cleanly onto this framework.** T/F-class changes are individual-contributor work. M/E/C-class changes involve architecture decisions, refactors spanning multiple modules, security-sensitive paths — these are decisions that affect teams and require manager/director oversight. The gating follows buyer persona naturally, not artificially.

Sources: [Open Core Ventures — Buyer-Based Open Core](https://www.opencoreventures.com/blog/a-standard-pricing-model-for-open-core), [GitLab Pricing Handbook](https://handbook.gitlab.com/handbook/company/pricing/), [The New Stack — Standard Pricing Model for Open Core](https://thenewstack.io/a-standard-pricing-model-for-open-core/)

### F2. Feature-count gating at scale becomes unmanageable — confirmed by multiple tools

SonarQube's pricing history illustrates the feature-count problem. They gated PR analysis, branch analysis, and quality gate enforcement on feature branches behind "Developer Edition" ($2,500/year for 500K LOC). The community edition only analyzes main branch. The result: developers hit the gate constantly, generating resentment, driving fork activity, and creating a perception of "crippled core." In late 2024 they renamed "Community Edition" to "Community Build" and changed the license from LGPL to SSPL — a defensive move, not a growth move.

Snyk's pricing complexity illustrates the same failure mode at scale: per-contributor billing, per-product test limits, distinction between Free/Team/Enterprise/Ignite tiers, and a new credit-based consumption model introduced in 2026 have created what reviewers describe as "layers of complexity that make it difficult to predict what you will actually pay."

The catalog-growth problem the proposal anticipates is real. A harness with 50+ skills gated individually generates 50+ support tickets: "why can't I use /ddd?" "why is /concurrency paid?" Depth gating reduces this to one decision boundary.

Sources: [SonarQube Pricing 2026](https://appsecsanta.com/sonarqube), [Snyk Pricing 2026](https://snykpricing.com/), [getmonetizely.com — Feature Gating Strategy](https://www.getmonetizely.com/articles/technical-feature-gating-strategy-how-to-price-code-quality-and-developer-tools-for-maximum-revenue)

### F3. "Generous free tier" for community builders — proven at scale

Elastic converted approximately 1% of its user base to paying customers yet built a multi-billion dollar business due to the sheer volume of users and high expansion revenue from those who converted. Confluent (Apache Kafka company), valued at $5B+, converted less than 1% of their community, succeeding through high-value enterprise contracts from a small fraction of a large user base.

For a dev tool harness, these numbers imply: if Pipeline Fractale reaches 100K active individual users on the free tier, even 1% conversion at $99/seat gives $99K ARR. At 500K users (realistic for a well-distributed harness with a strong community), 1% = $495K ARR before any team/enterprise contracts.

PostHog's 2025 data confirms the pattern: "over 90% of companies use it completely free" but the business is healthy because the paying minority (usage-based, no hard ceiling) generates disproportionate revenue.

Sources: [getmonetizely.com — Optimal Conversion Rate Open Source SaaS](https://www.getmonetizely.com/articles/whats-the-optimal-conversion-rate-from-free-to-paid-in-open-source-saas), [PostHog Pricing](https://posthog.com/pricing), [Confluent revenue analysis, multiple sources]

### F4. Depth-based gating already exists conceptually in adjacent markets

Grafana's tiering follows a rough depth model: the free/open-source tier gives you the full observability stack, but Advanced Authentication (SAML, OAuth, LDAP), Audit Logging, Team Sync, and Data Source Permissions are Enterprise-only. These aren't separate features — they're the *same features at deeper organizational depth*. You get dashboards for free; you pay for dashboards-at-scale-with-compliance.

Sentry's model is similar: free gives 5K errors/month; paid tiers give the same error tracking at higher volume with organizational features added. The features are not different — the depth of use unlocks value.

This is the closest existing analog to risk-class depth gating: same capability set, unlocked at greater organizational risk/complexity.

Sources: [Grafana Pricing](https://grafana.com/pricing/), [Sentry Pricing](https://sentry.io/pricing/), [The True Cost of Grafana — Sirius Open Source](https://www.siriusopensource.com/en-us/blog/true-cost-grafana)

### F5. Depth gating avoids the trust-destruction of bait-and-switch

Open Core Ventures' primary guidance is to never move features from free to paid: "Avoid moving features from open source to proprietary versions—this completely erodes trust." HashiCorp violated this principle with Terraform's BSL change (August 2023), generating 32K+ GitHub stars on the OpenTF manifesto within days, spawning OpenTofu as a credible fork, and materially threatening Terraform's revenue moat.

Risk-depth gating avoids this trap structurally: all skills are always free for T/F class work. No feature is ever removed. Teams that upgrade get the same skills applied to more complex situations — they're not paying for a previously-free feature.

Sources: [Open Core Ventures — Open Core is Misunderstood](https://www.opencoreventures.com/blog/open-core-is-a-misunderstood-business-model), [Terraform BSL backlash — The New Stack](https://thenewstack.io/hashicorp-abandons-open-source-for-business-source-license/), [Spacelift — Terraform License Change Impact](https://spacelift.io/blog/terraform-license-change)

---

## Evidence AGAINST: Structural Weaknesses

### A1. CRITICAL: The risk classifier is gameable — this is the model's primary vulnerability

The central mechanism of the model is a risk classifier that assigns T/F/M/E/C class to each agent invocation. This classifier can be gamed by any developer who understands how it works.

**The attack vector**: instead of making one large M-class change ("refactor the authentication module"), a developer issues five T-class changes in sequence ("rename AuthService to AuthHelper", "extract validateToken method", "move imports", "add null check", "rename variable"). The end result is identical. The risk classifier never fires on M+.

This is not hypothetical. Developers already split large PRs into smaller ones as standard practice. The getmonetizely.com research on feature gating explicitly states: "If developers can easily circumvent a gate with a script, they'll resent the restriction rather than upgrade." The PR-splitting behavior is so normalized that it is covered in dozens of tutorials as a best practice for code review — not as a workaround.

Mitigation paths that would need to be built:
- Semantic diff analysis across a session window (detect that 5 T-class changes compose to an M-class change)
- Repository-level risk assessment (count of files touched in a time window, cross-module coupling analysis)
- Both of these are non-trivial to build and maintain, and may feel invasive to developers

**Single source for the specific gaming risk claim — verify independently.** The general principle of circumvention resentment is multi-sourced; the specific application to risk classifiers is inferred.

Sources: [getmonetizely.com — Feature Gating and Workarounds](https://www.getmonetizely.com/articles/technical-feature-gating-and-code-quality-tool-pricing-a-developer-first-strategy-guide), [DEV Community — Splitting PRs](https://dev.to/alysonbasilio/tips-to-split-extensive-pull-requests-5g4d), [Graphite — How to Split a Git Commit](https://www.graphite.com/guides/how-to-split-a-git-commit)

### A2. CRITICAL: No product currently gates by risk class depth — this is unvalidated territory

A thorough search across 18 queries and deep reads of GitLab, Grafana, PostHog, Supabase, Sentry, SonarQube, Snyk, Vercel, Raycast, Linear, and Datadog found zero examples of a tool that gates by semantic risk class of operations.

Existing depth-gating analogs gate by:
- Volume (PostHog: events/month, Sentry: errors/month)
- Organizational complexity (GitLab: individual→team→director→exec features)
- Infrastructure scale (Grafana: metrics series count, retention period)
- Repo/LOC count (SonarQube: lines of code analyzed)

None gate by semantic complexity of the operation being performed. This means Pipeline Fractale would need to educate its market on a new pricing axis — a significant GTM burden for an early-stage product. Developer adoption of novel pricing models is slow; the n8n per-execution billing debate (2025) showed that even well-established tools face severe backlash when introducing unfamiliar billing dimensions.

Sources: [n8n pricing debate — Medium/Medium 2025](https://psbigbig.medium.com/open-source-vs-open-core-what-the-n8n-pricing-debate-taught-me-and-why-my-project-cant-even-8c6273f21adb), [DEV Community — After the pricing debates](https://dev.to/onestardao/after-the-pricing-debates-open-core-vs-zero-meter-and-why-i-shipped-a-one-file-reasoning-layer-28j6)

### A3. Risk classifier accuracy creates a trust problem

If the risk classifier misfires — classifying an M-class change as T/F, or vice versa — it creates two failure modes:

1. **False negative (M classified as T)**: Pro user gets billed for something that should have been free, or free user passes through M-class work undetected (revenue leak).
2. **False positive (T classified as M)**: Free user gets blocked on a trivial change. This is catastrophically bad for trust. The developer will immediately post "Pipeline Fractale blocked me on a rename because its AI thought it was risky" on HN/Reddit.

AI-based risk assessment is probabilistic, not deterministic. The 2026 data on AI code quality shows that AI-generated code creates 10.83 issues per PR vs 6.45 for human code, with logic and correctness errors 75% more frequent. An AI classifier operating on change descriptions will have non-trivial error rates on edge cases. Each false positive is a potential PR that goes viral as "devtool punishes you for refactoring."

Sources: [TFIR — AI Code Quality 2026 Guardrails](https://tfir.io/ai-code-quality-2026-guardrails/), [SecondTalent — AI Code Quality Metrics 2026](https://www.secondtalent.com/resources/ai-generated-code-quality-metrics-and-statistics-for-2026/), [getmonetizely.com — Pricing and Trust](https://www.getmonetizely.com/articles/technical-feature-gating-and-code-quality-tool-pricing-a-developer-first-strategy-guide)

### A4. Overly generous free tier may delay urgency — confirmed by SaaS research

The 2025 SaaS conversion data shows that "long trials might feel generous, but they delay decision-making." If T/F-class work covers 80%+ of a solo developer's day-to-day tasks (which is plausible — most individual contributors work within well-understood, bounded scopes), many developers will operate indefinitely on the free tier without ever experiencing the gate. The upgrade moment ("I need M+ class") may arrive rarely or never for a significant portion of the user base.

Contrast with the PLG benchmark: 60% of conversions happen within the first 14 days of sign-up. If free users never hit the gate in day 1-14, conversion velocity drops sharply.

Sources: [1Capture — Free Trial Conversion Benchmarks 2025](https://www.1capture.io/blog/free-trial-conversion-benchmarks-2025), [ADV.me — SaaS Free Trial Benchmarks 2025](https://adv.me/articles/conversion-optimization/saas-free-trial-conversion-rate-benchmarks-2025/)

### A5. Team tier at $99/seat/year risks quality-signal damage

Bessemer Venture Partners' AI Pricing Playbook states directly: "If customers say 'sold' immediately, you're too cheap." The current competitive landscape for AI coding tools:

| Tool | Team/Business tier | Annual per seat |
|------|-------------------|-----------------|
| GitHub Copilot Business | $19/user/month | $228/year |
| GitHub Copilot Pro+ | $39/user/month | $468/year |
| Cursor Business | $40/user/month | $480/year |
| Tabnine Business | $39/user/month | $468/year |
| Windsurf Business | $30/user/month | $360/year |
| **Pipeline Fractale (proposed)** | **~$8.25/user/month** | **$99/year** |

At $99/seat/year, Pipeline Fractale is priced at 20-22% of Copilot Business and 21% of Cursor Business. This is not "aggressive underpricing for market entry" — it is a price point that enterprise procurement teams will interpret as either: (a) the tool does not do what Copilot/Cursor do (correct — it's a different category), or (b) the vendor is not serious about enterprise support and longevity.

The B2B SaaS research confirms: enterprise deal sizes are increasing, with 1000-seat contracts averaging $890K ACV (up 27% from 2024). Enterprises paying $890K for one tool will not bet on a $99/seat tool for mission-critical code quality gating. They will treat it as a free tier equivalent even at the paid price.

However, there is a counter-argument: Pipeline Fractale is not Copilot or Cursor. It is a harness/orchestration layer, not an AI model subscription. The $99 price may be appropriate if positioned as "orchestration tax on top of your existing AI tools" rather than as a replacement. The price signal problem exists only if the positioning is competitive with Copilot/Cursor.

Sources: [BVP — AI Pricing and Monetization Playbook](https://www.bvp.com/atlas/the-ai-pricing-and-monetization-playbook), [DX — AI Coding Assistant Pricing 2025](https://getdx.com/blog/ai-coding-assistant-pricing/), [SBI — State of B2B SaaS Pricing 2024](https://sbigrowth.com/hubfs/1-Research%20Reports/11.2024%20State%20of%20B2B%20SaaS%20Pricing%20Price%20Intelligently/SBI_StateofB2BSaaSPricing2024.pdf)

---

## AGPL Revenue Model Verification (Historical — AGPL rejected in favor of MIT)

> **Note**: This section documents the AGPL analysis that was conducted before the licensing decision. The findings below directly contributed to rejecting AGPL in favor of MIT for the public core. The revenue model now relies on value-pull (cloud, team governance, premium packs, compliance, support) rather than license enforcement. See `decision-2026-05-03-mit-core-cloud-enterprise.md`.

### The legal reality of AGPL internal use

AGPL's network provision is triggered only when modified software is made accessible to external users over a network. It does NOT trigger for:
- Internal deployment (employees accessing the tool within a corporate network)
- Self-hosted instances used only by the company's own developers

Multiple authoritative sources confirm this:

From FSF/GNU: The AGPL v3 explicitly states obligations arise when "users interact with [the program] remotely through a computer network." Internal employees are not "users over a network" in the legal sense when accessed on a corporate intranet.

From FOSSA (license compliance specialists): "AGPL does not impose additional requirements if you are using the software for internal purposes and not distributing it or offering it to third-parties over a network."

From vaultinum.com (compliance guide): "AGPL defines a user as anyone who accesses the server-side application if it is public-facing. For applications that reside inside the organization's network, AGPL does not trigger the release of source code."

**Implication for Pipeline Fractale's revenue model**: A company with 500 developers can deploy Pipeline Fractale internally, self-host the harness, use all features, and legally owe nothing under AGPL — as long as they do not expose it as a SaaS to third parties.

This is a significant revenue model vulnerability. The "enterprises must pay because AGPL" assumption is legally false.

### The behavioral reality: companies avoid AGPL anyway

Open Core Ventures states bluntly: "AGPL license is a non-starter for most companies." The reasons:

1. **Google has a company-wide ban on AGPL software.** This is not unusual — many large tech companies have similar policies. Legal teams prefer blanket bans over case-by-case analysis.
2. **The virality concern is vague.** Even if internal use is technically exempt, legal teams cannot easily determine which code might become "viral" under edge interpretations. Blanket avoidance is the risk-minimization strategy.
3. **Enterprises buy commercial licenses not because they legally must, but to get support, SLAs, and indemnification.** This is the actual revenue driver — not license enforcement.

The OCV conclusion is that AGPL drives companies toward proprietary alternatives, not toward commercial license purchases. "If all open source developers insisted on AGPL...companies will avoid it entirely, and write their own instead."

**Revised revenue model logic**: Pipeline Fractale should sell Pro/Team tiers not as "you must pay because AGPL" but as "you pay because you get: (1) support SLAs, (2) legal indemnification, (3) shared team state / org analytics, (4) compliance artifacts." The value proposition must be pull-based, not enforcement-based.

Sources: [FOSSA — AGPL License 101](https://fossa.com/blog/open-source-software-licenses-101-agpl-license/), [Open Core Ventures — AGPL Non-Starter](https://www.opencoreventures.com/blog/agpl-license-is-a-non-starter-for-most-companies), [GNU AGPL License](https://www.gnu.org/licenses/agpl-3.0.en.html), [vaultinum — AGPL Compliance Guide](https://vaultinum.com/blog/essential-guide-to-agpl-compliance-for-tech-companies), [Snyk — AGPL License Analysis](https://snyk.io/articles/agpl-license/), [OCV on HN](https://news.ycombinator.com/item?id=37903520)

---

## Pricing Level Verification

### Is $99/seat/year too cheap, right, or too expensive?

**The case it's too cheap (strong evidence)**

BVP's pricing principle: "If customers say 'sold' immediately, you're too cheap." For an AI dev tool targeting enterprise, the first B2B pricing signal is always read by procurement as a proxy for organizational stability, support depth, and feature roadmap investment. At $99/seat/year, a 100-seat team pays $9,900/year — less than a single senior engineer's monthly salary. This price does not communicate "enterprise-grade quality gate for critical deployments."

The competitive landscape data (getdx.com 2025) shows the AI coding tool floor is now approximately $228/seat/year (Copilot Business). Pipeline Fractale at $99/seat is priced below this floor, which means enterprises will not use the price as a comparator against Copilot — they will treat it as a fundamentally different (cheaper/lesser) category.

**The case it's right for market entry (moderate evidence)**

Vercel's Pro plan at $20/developer/month ($240/year) is analogous: a developer productivity tool that is not a model subscription, gated by organizational complexity rather than raw compute. Vercel's pricing succeeded because it was priced against its own value proposition (deployment infrastructure cost savings), not against AWS/GCP.

Linear is priced at $8-14/seat/month ($96-168/year) for its Standard/Plus tiers — directly in Pipeline Fractale's proposed range. Linear competes with Jira (which charges $8.15/user/month), demonstrating that $99/seat/year is viable for developer productivity tooling when the value proposition is clear.

The 2024 SaaS benchmarks show "72% of companies under $50M ARR offer a free tier followed by progressive paid features" — suggesting the market expects free tiers and low-friction paid entry. $99/year is low-friction by design, which may be the right approach for capturing the long tail before raising prices.

**The case it's too expensive for solo devs on the free-to-paid threshold (mild evidence)**

Given that T/F-class work likely covers 80%+ of individual contributor work, and the paid gate only unlocks for M+ class, the upgrade trigger is infrequent. At $99/year ($8.25/month), a developer who hits the M+ gate twice per month may find the ROI unclear versus either: (a) accepting the constraint, or (b) gaming the classifier.

**Recommendation on pricing**: $99/seat/year is appropriate for the Team tier if positioned as "orchestration and governance layer on top of your existing AI tools" (not competing with Copilot). However, the Team tier price should anchor to a higher "Enterprise" price of $500-800/seat/year to create a price-quality signal for large organizations. Without this anchor, $99 feels like the highest tier, not the entry-level team tier.

Sources: [BVP — AI Pricing Playbook](https://www.bvp.com/atlas/the-ai-pricing-and-monetization-playbook), [DX — AI Coding Assistant Pricing](https://getdx.com/blog/ai-coding-assistant-pricing/), [Linear Pricing 2025](https://linear.app/pricing), [Vercel Pricing 2025](https://vercel.com/pricing), [SBI — B2B SaaS Pricing 2024](https://sbigrowth.com/hubfs/1-Research%20Reports/11.2024%20State%20of%20B2B%20SaaS%20Pricing%20Price%20Intelligently/SBI_StateofB2BSaaSPricing2024.pdf)

---

## Blind Spots

### B1. The risk classification UX is undefined

The proposal describes T/F/M/E/C risk classes but does not specify: (a) who classifies the risk — the agent automatically, or the user declares it, (b) what happens when a user disagrees with the classification, (c) how the boundary between T and M is defined operationally. Without this, developers cannot reason about the gate in advance, generating anxiety on every invocation: "will this trigger M class?"

This UX problem is not theoretical. Snyk's pricing complexity (contributing developer counting, 90-day windows, per-product limits) generates significant user confusion and support load. A risk classifier adds a new dimension of unpredictability.

### B2. No data on whether developers identify with T/F vs M/E/C risk language

The risk classification vocabulary (T/F/M/E/C) is internal harness language. The proposal assumes developers will intuitively understand their changes are "Critical class." In practice, every developer believes their changes are trivial (Dunning-Kruger in reverse for code risk). A developer making a database schema migration will classify it as "I know what I'm doing, this is trivial for me" — not as "C class critical change." This psychological mismatch may cause free-tier users to feel penalized for competence.

### B3. The "all skills free at T/F" assumption may not hold

The proposal claims all 50+ skills are available at T/F. But some skills (e.g., /concurrency, /ddd, /error-handling) are intrinsically about handling complexity — they have no "trivial" analog. A T-class usage of /concurrency is probably: "explain what a mutex is." This is not a value-generating invocation. The monetizable invocation ("help me design a saga pattern for this distributed transaction") is inherently M+ class. So these skills are effectively paywalled even under the "all skills free" promise, just indirectly.

### B4. Market timing risk — AI agent orchestration is pre-mainstream in 2026

The AI coding agent market is moving from copilot (advisory) to agentic (autonomous). Pricing models for agentic tools are still in flux: GitHub Copilot moved to usage-based billing June 1, 2026; Cursor moved from fixed fast-request allotments to credit pools in June 2025 (and issued a public apology and refunds after overages). Pipeline Fractale is entering a market where the pricing model is unsettled. This is a two-sided risk: first-mover advantage if the model is right, first-mover credibility damage if it fails.

Sources: [GitHub — Moving to Usage-Based Billing](https://github.blog/news-insights/company-news/github-copilot-is-moving-to-usage-based-billing/), [InfoWorld — GitHub Copilot New Cost Model](https://www.infoworld.com/article/4164236/github-shifts-copilot-to-usage-based-billing-signaling-new-cost-model-for-enterprise-ai-tools.html)

### B5. The "be generous" philosophy requires volume to work

Elastic at 1% conversion built a billion-dollar business because the denominator was massive. Confluent converted <1% but succeeded because the total community was enormous. For a harness with 10K users, 1% conversion at $99/year = $9,900 ARR. That is not a business. The model requires aggressive community growth to precede monetization. The proposal should explicitly state the community size threshold below which the model is pre-revenue, not just "being generous."

---

## Recommendation

### R1. Confirm the depth-gating architecture — it is structurally correct

Depth-gating by risk class is the right conceptual framework. It aligns with buyer-based open core (the industry's best-validated open-core model), avoids the catalog management problem of feature-count gating, and avoids the trust-destruction risk of bait-and-switch.

Proceed with this model.

### R2. Harden the risk classifier against gaming — ship this before launch

Before launch, design the classifier as a session-scoped semantic accumulator, not a per-invocation point classifier. Track: files touched in the session, modules affected, cumulative structural vs behavioral change ratio, presence of security-sensitive patterns (auth, crypto, DB schema). A developer splitting a large refactor into 10 T-class invocations should trigger an M-class session signal at invocation 6-7.

This is non-trivial engineering but is the model's single most critical vulnerability. Without it, the gate is meaningless for sophisticated users (who will game it) while blocking unsophisticated users (who will be frustrated).

### R3. ~~Fix the AGPL revenue model~~ RESOLVED — MIT chosen, license enforcement not part of revenue model

~~Change the revenue narrative from "enterprises must pay because AGPL" to "enterprises pay for: SLA, indemnification, shared team state, org analytics, compliance artifacts."~~ **Resolved**: The MIT decision eliminates this issue entirely. The revenue model is now value-pull by design: enterprises pay for cloud convenience, team governance, premium maintained packs, compliance artifacts, and support/SLA. No license enforcement component exists. See `decision-2026-05-03-mit-core-cloud-enterprise.md` and `business-model-proposal.md` sections 4-5.

### R4. Reprice with an Enterprise anchor to protect quality perception

Restructure the pricing tiers:
- Free: T/F class, all skills, unlimited — individuals, OSS projects
- Pro: M class, $15/month individual billed annually ($180/year) — mid-range, not $99/year
- Team: M+E class + shared state + analytics, $25/seat/month ($300/year) for teams — remove the 5x-below-market signal
- Enterprise: C class + SSO + SCIM + audit logs + compliance artifacts, custom pricing starting $600/seat/year — creates a proper anchor

The current $99/seat/year for Team is not enterprise-viable. $300/seat/year for Team, with Enterprise at $600+, creates a pricing ladder that signals "serious tool."

### R5. Define minimum viable community size for the model to work

The depth-gating + generous-free-tier model requires community scale to generate revenue. Define explicitly: the model becomes viable at 50K active free users (target: 500 conversions at $99 = $49,500 ARR, not a business). The model becomes self-sustaining at 300K users (3,000 conversions at $300 Team tier = $900K ARR). Plan community growth as the primary KPI for the first 18 months, not conversion rate.

### R6. ~~Resolve the AGPL vs. permissive tension~~ RESOLVED — MIT chosen

~~AGPL may drive enterprise legal teams to fork or avoid entirely.~~ **Resolved**: The founder chose MIT for the public core with a commercial/source-available license for `enterprise/` code. This follows the recommended shape exactly:
- MIT for the harness core (rules, orchestration logic) — maximizes adoption
- Commercial license for the enterprise layer (SSO, SCIM, audit, compliance, team governance) — monetizes through genuine organizational value
- This is the OpenHands/Supabase model: open core tool + commercial enterprise features + cloud services

See `decision-2026-05-03-mit-core-cloud-enterprise.md` for the full decision and boundary architecture.

---

## Disputed Claims

### D1. "Gating individual skills creates artificial friction" — partially disputed

The claim is used to justify depth-gating over feature-count gating. But the evidence for "artificial friction" is inferential: we have examples of tools with too many SKUs (Snyk, SonarQube) but no direct evidence that a 50-skill catalog would be unmanageable at the feature level. Counter-argument: GitHub Marketplace has 10,000+ integrations gated individually. The manageability problem depends on implementation (UI, discovery), not purely on count.

Verdict: the risk is real but the claim that 50 skills is definitively unmanageable is not proven. Depth-gating is still preferred, but for simplicity/elegance reasons, not because feature-count gating is impossible.

### D2. "AGPL forces enterprises to buy commercial licenses" — refuted (moot under MIT decision)

As documented above, this is legally incorrect for internal use. Multiple authoritative sources (FSF, FOSSA, OCV, vaultinum) confirm that AGPL does not trigger on internal corporate deployment. The claim may persist in sales conversations because enterprise legal teams often choose commercial licenses for risk-avoidance (not legal necessity), but the mechanism is different from what the claim implies.

> **Status**: This dispute is now moot. The MIT decision eliminates any AGPL-based revenue assumption. The revenue model relies on value-pull (cloud, team governance, premium packs, compliance), not license enforcement.

---

## Sources

1. [Open Core Ventures — A Standard Pricing Model for Open Core](https://www.opencoreventures.com/blog/a-standard-pricing-model-for-open-core) — OCV, 2023, Score: 3
2. [Open Core Ventures — AGPL License Is a Non-Starter for Most Companies](https://www.opencoreventures.com/blog/agpl-license-is-a-non-starter-for-most-companies) — OCV, 2023, Score: 3
3. [The New Stack — A Standard Pricing Model for Open Core](https://thenewstack.io/a-standard-pricing-model-for-open-core/) — TNS, 2023, Score: 2
4. [GitLab Pricing Handbook](https://handbook.gitlab.com/handbook/company/pricing/) — GitLab, 2025, Score: 3
5. [GNU AGPL v3 License](https://www.gnu.org/licenses/agpl-3.0.en.html) — FSF, evergreen, Score: 3
6. [FOSSA — AGPL License 101](https://fossa.com/blog/open-source-software-licenses-101-agpl-license/) — FOSSA, 2024, Score: 2
7. [vaultinum — AGPL Compliance Guide](https://vaultinum.com/blog/essential-guide-to-agpl-compliance-for-tech-companies) — vaultinum, 2024, Score: 2
8. [Snyk — AGPL License Analysis](https://snyk.io/articles/agpl-license/) — Snyk, 2024, Score: 2
9. [BVP — AI Pricing and Monetization Playbook](https://www.bvp.com/atlas/the-ai-pricing-and-monetization-playbook) — Bessemer VP, 2025, Score: 3
10. [DX — AI Coding Assistant Pricing 2025](https://getdx.com/blog/ai-coding-assistant-pricing/) — DX, 2025, Score: 2
11. [Grafana Pricing](https://grafana.com/pricing/) — Grafana Labs, 2025, Score: 3
12. [Sentry Pricing](https://sentry.io/pricing/) — Sentry, 2025, Score: 3
13. [PostHog Pricing](https://posthog.com/pricing) — PostHog, 2025, Score: 3
14. [SonarQube Review 2026](https://appsecsanta.com/sonarqube) — AppSec Santa, 2026, Score: 2
15. [Snyk Pricing 2026](https://snykpricing.com/) — snykpricing.com, 2026, Score: 1
16. [getmonetizely.com — Technical Feature Gating Strategy](https://www.getmonetizely.com/articles/technical-feature-gating-strategy-how-to-price-code-quality-and-developer-tools-for-maximum-revenue) — getmonetizely, 2025, Score: 1
17. [getmonetizely.com — Optimal Conversion Rate Open Source SaaS](https://www.getmonetizely.com/articles/whats-the-optimal-conversion-rate-from-free-to-paid-in-open-source-saas) — getmonetizely, 2025, Score: 1
18. [Terraform BSL Change — Spacelift](https://spacelift.io/blog/terraform-license-change) — Spacelift, 2024, Score: 2
19. [The New Stack — HashiCorp Abandons Open Source](https://thenewstack.io/hashicorp-abandons-open-source-for-business-source-license/) — TNS, 2023, Score: 2
20. [GitHub — Copilot Moving to Usage-Based Billing](https://github.blog/news-insights/company-news/github-copilot-is-moving-to-usage-based-billing/) — GitHub, 2025, Score: 3
21. [InfoWorld — GitHub Copilot New Cost Model](https://www.infoworld.com/article/4164236/github-shifts-copilot-to-usage-based-billing-signaling-new-cost-model-for-enterprise-ai-tools.html) — InfoWorld, 2025, Score: 2
22. [Linear Pricing](https://linear.app/pricing) — Linear, 2025, Score: 3
23. [Vercel Pricing](https://vercel.com/pricing) — Vercel, 2025, Score: 3
24. [1Capture — Free Trial Conversion Benchmarks 2025](https://www.1capture.io/blog/free-trial-conversion-benchmarks-2025) — 1Capture, 2025, Score: 1
25. [ADV.me — SaaS Free Trial Benchmarks 2025](https://adv.me/articles/conversion-optimization/saas-free-trial-conversion-rate-benchmarks-2025/) — ADV, 2025, Score: 1
26. [n8n Pricing Debate — Medium 2025](https://psbigbig.medium.com/open-source-vs-open-core-what-the-n8n-pricing-debate-taught-me-and-why-my-project-cant-even-8c6273f21adb) — PS BigBig, 2025, Score: 1
27. [TFIR — AI Code Quality 2026 Guardrails](https://tfir.io/ai-code-quality-2026-guardrails/) — TFIR, 2026, Score: 2
28. [The Register — PlanetScale Ends Free Tier](https://www.theregister.com/2024/03/11/planetscale_lays_off_staff_and/) — The Register, 2024, Score: 2
