---
claim-bearing: true
status: HYPOTHESIS
cycle-id: cycle-71-message-hierarchy
last-updated: 2026-05-14
---

# Message Hierarchy

## Scope Boundary

This is a local public-copy planning artifact. It does not publish copy, prove demand, prove channel reach, prove revenue, prove legal compliance, prove beta completion, prove npm availability, or prove sale-page readiness.

The hierarchy may use the arXiv 2604.09409 logging-instruction finding as problem evidence because the source was directly checked during Cycle 71. It must not turn that study into proof that Hima solves the problem, that Hima has market demand, or that the result applies to every coding-agent task.

## Direct Source Check

| Source | Directly Checked | Supported Claim | Public-Copy Boundary |
|---|---|---|---|
| arXiv 2604.09409, "Do AI Coding Agents Log Like Humans? An Empirical Study" by Youssef Esseddiq Ouatiti, Mohammed Sayagh, Hao Li, and Ahmed E. Hassan, submitted 2026-04-10, <https://arxiv.org/abs/2604.09409> | YES, 2026-05-14 | The abstract reports that explicit logging instructions appeared in 4.7 percent of studied agentic pull requests and that agents failed to comply with constructive logging requests 67 percent of the time. | This supports problem framing for natural-language instruction limits in logging/observability, not broad proof that every instruction type fails or that Hima is already validated. |

## Primary Message

### Lead

AI coding agents do not reliably obey natural-language quality instructions. One 2026 empirical logging study found that when constructive logging instructions were present, agents failed to comply 67 percent of the time.

### Product Promise

Hima turns AI coding work into governed terminal sessions: risk classification, deterministic gates, evidence requirements, and reviewable completion records around the agent you already use.

### One-Line Positioning

Hima is a local governance harness for terminal-first AI coding workflows.

### Short Hero Copy

Your agent can write code. Hima makes the session prove it met the rules.

Run local gates around Claude Code, Codex, and other terminal agents so tests, scope, evidence, and review discipline are checked before a task is called done.

### Primary CTA Copy

Use the local core.

### Secondary CTA Copy

Read the evidence model.

## Supporting Proof Points

| Proof Point | Copy Direction | Claim Mapping | Required Boundary |
|---|---|---|---|
| Natural-language instructions are weak control surfaces for agent quality behavior. | Lead with the arXiv logging-instruction finding as a concrete example. | CLM-014 | Keep it scoped to logging/observability instructions and source it directly. |
| Hima is about deterministic governance, not better prompting. | Explain risk classes, gates, accepted evidence, and falsifiers. | CLM-002, CLM-013 | Do not claim legal certification or external audit acceptance. |
| Hima meets terminal-first developers where they already work. | Position for Claude Code/Codex/Aider-style users and local repo workflows. | CLM-007, ICP-1 | Do not claim production-ready adapter E2E until real sessions exist. |
| The local core must remain legitimate and open. | Emphasize MIT local core and additive paid layers. | CLM-001, CLM-002 | Do not move required local governance behind paywalls in copy. |
| Pre-release state must stay honest. | Say "local core", "planning artifact", or "private/pre-release" where applicable. | CLM-005, CLM-015 | Do not imply npm publication, sale-page launch, beta completion, revenue, or public release. |

## Message Pillars

### Pillar 1: Instructions Are Not Enough

Problem claim: agent behavior can drift even when instructions exist.

Use:

- "Natural-language instructions are not a governance layer."
- "A coding agent can appear cooperative while still missing the operational behavior you asked for."
- "Logging is the warning shot: in one empirical study, constructive logging requests were ignored 67 percent of the time."

Avoid:

- "All agents ignore instructions."
- "Prompting is useless."
- "Hima proves agents obey."

### Pillar 2: Governance Belongs In The Session

Problem claim: quality discipline should be enforced before DONE, not reconstructed during review.

Use:

- "Risk class, gates, evidence, and falsifiers live inside the task session."
- "A task is not done because the agent says it is done; it is done when the required evidence exists."
- "The developer keeps control, but the session has rails."

Avoid:

- "Autonomous replacement for developers."
- "Zero-review coding."
- "Guaranteed bug-free output."

### Pillar 3: Local First, Runtime Portable

Problem claim: terminal-first developers already use multiple agents and need portable discipline.

Use:

- "Bring the same governance discipline to the agent you already run in the terminal."
- "Start with local policy, local evidence, and local reviewable artifacts."
- "Adapters are the execution bridge; the governance contract is the product."

Avoid:

- "Three production adapters are proven end-to-end."
- "Works with every runtime today."
- "Hosted runtime is ready."

### Pillar 4: Evidence Packs, Not Certification

Problem claim: compliance-aware teams need evidence, but Hima is not a legal certification.

Use:

- "Generate developer-session evidence packs that help reviews and audits."
- "Make risk decisions, evidence, and policy outcomes inspectable."
- "Support compliance conversations with artifacts, not hand-wavy agent transcripts."

Avoid:

- "EU AI Act compliant."
- "SOC 2 ready."
- "Regulator-approved."

## Objection Handling

| Objection | Response | Claim Mapping | Boundary |
|---|---|---|---|
| "I can just write better prompts." | The arXiv logging study shows why instructions alone are a weak control surface; Hima makes checks executable and evidence-backed. | CLM-014, CLM-002 | Do not generalize the study beyond its logging scope. |
| "Codex/Claude Code already has instructions and sandboxing." | Hima is not another model instruction file; it adds risk classes, gates, accepted evidence, and completion rules around the session. | CLM-002, CLM-007 | Do not claim current real adapter sessions are already complete. |
| "Is this a compliance product?" | It can produce evidence-support artifacts, but it is not legal advice, certification, SOC 2, or regulatory approval. | CLM-013 | Keep certification claims blocked. |
| "Why pay if the core is open?" | The local core stays legitimate; paid value should be maintenance, hosted convenience, team state, support, and enterprise integrations. | CLM-001, CLM-002 | Do not threaten or degrade the public core. |
| "Has the market validated this?" | Not yet. ICP, beta, revenue, and channel performance remain future evidence gates. | CLM-011, CLM-015, ICP-1 | Do not imply demand proof. |

## Channel Variants

### GitHub README

Lead with the problem and the local run loop:

> AI coding agents do not reliably obey natural-language quality instructions. Hima wraps terminal-agent work in local risk classes, gates, evidence requirements, and DONE rules so a session has to prove it met the standard.

Guardrail: include pre-release/runtime boundary near install instructions until npm/public release evidence exists.

### Show HN

Lead with the arXiv finding, then show the local artifact trail:

> A recent empirical logging study found coding agents ignored constructive logging requests 67 percent of the time. I built Hima to test a stricter idea: quality rules should be executable gates around a coding session, not just prompt text.

Guardrail: do not claim adoption, revenue, beta completion, or public launch results.

### Dev.to / Technical Post

Lead with a walkthrough:

> The failure mode is not "the agent forgot the prompt"; it is that the workflow lets the task finish without proof. This post walks through a local Hima session: classify risk, bind gates, require evidence, and block DONE when the proof is missing.

Guardrail: use local demo or fixture evidence only as local evidence.

### Product Hunt

Lead with concrete category language:

> Local governance for terminal-first AI coding agents.

Guardrail: Product Hunt copy must wait until public release, npm install, sale-page, and support evidence exist.

### Sales Page

Lead with buyer-specific outcome only after release evidence exists:

> Make AI coding sessions reviewable before they reach code review.

Guardrail: no Stripe, sale-page, or founding-cohort claim until real transaction and page evidence exists.

## Excluded Claims

Do not use these in public copy until the corresponding evidence exists:

| Excluded Claim | Why Blocked | Evidence Required |
|---|---|---|
| "Validated by beta users" | No closed beta evidence exists. | Beta logs, completion rates, feedback, and linked evidence ledger. |
| "Revenue proven" | No payment or Stripe evidence exists. | Payment processor records and release evidence. |
| "Available on npm" | Public registry evidence is absent. | Registry lookup, release tag, install transcript. |
| "Works end-to-end across Claude, Codex, and Hermes" | Real runtime/model sessions are unauthorized/unrun. | Authorized transcripts for each runtime. |
| "EU AI Act compliant" | Hima artifacts are evidence-support outputs, not legal certification. | External legal/audit review before any certification wording. |
| "Market demand validated" | ICP and message hierarchy are hypotheses. | User interviews, beta usage, attribution, conversion, and willingness-to-pay evidence. |

## Claim-Source Map

| Message Claim | Register ID / Source | Status |
|---|---|---|
| Natural-language logging instructions failed 67 percent of the time in the arXiv study. | CLM-014; <https://arxiv.org/abs/2604.09409> | Directly sourced for problem framing only. |
| Local core must stay legitimate and MIT-aligned. | CLM-001, CLM-002 | Decision-anchored. |
| Public launch is not yet proven. | CLM-005 | Repo-state-anchored. |
| Real adapter E2E remains blocked without runtime/model authorization. | CLM-007 | Blocked by authorization. |
| Compliance artifacts are not legal certification. | CLM-013 | Policy boundary. |
| Beta, revenue, Stripe, Product Hunt, HN, Discord recruiting, and sale-page outcomes are not validated. | CLM-015 | Repo-state-anchored. |
| Primary ICP is terminal-agent quality power users. | `docs/business-model/icp-worksheet.md` ICP-1 | Hypothesis only. |

## Copy Review Checklist

Before any public copy ships:

1. Every claim maps to `claims-register.csv`, the arXiv source, or an explicit source gap.
2. The 67 percent claim remains scoped to the arXiv logging-instruction study.
3. No copy implies Hima has solved compliance, runtime parity, beta completion, revenue, or demand validation.
4. Install instructions match actual release evidence.
5. Pricing, Stripe, sale-page, founding-cohort, and Product Hunt copy are withheld until the relevant evidence exists.

```yaml
Falsifies-If:
  kill-condition: Message hierarchy uses the 67 percent NL-ignore claim without the arXiv source boundary, or implies validated demand, legal compliance, beta completion, revenue, npm publication, sale-page launch, or public release.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/business-model/message-hierarchy.md
  on-fail: Reopen cycle-71 as BLOCKED_MESSAGE_HIERARCHY_OVERCLAIM and remove unsupported public-copy claims.
```
