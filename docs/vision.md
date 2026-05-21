---
claim-bearing: true
status: ACCEPTED
date: 2026-05-14
supersedes: (none — vision was implicit across strategy-diagnosis.md + business-model-proposal.md + LONG-TERM-GOAL.md; this file pulls the vision out as its own artifact per user direction)
companion-files: docs/goals/LONG-TERM-GOAL.md (acceptance criteria), docs/business-model/strategy-diagnosis.md (Rumelt kernel)
---

# Vision — hima

## What hima is

hima is the **quality discipline kernel for AI coding agents.**

It governs what an AI coding agent does during a session — before irreversible file edits, before a sub-agent spawns, before a merge — so that the agent ships code worth keeping. Not faster code. Not more code. Better code, with evidence that it's better.

## Why now

Model quality plateaued in 2026 (six frontier models within 0.8% on SWE-bench Verified). The 17-issue gap between three agent frameworks running the same model proved the scaffolding *is* the moat. "Harness engineering" became a named discipline in February 2026, and the window between a named discipline and the category captured by an incumbent is historically 12–24 months.

Meanwhile, the developer doing real work with Claude Code, Codex, or any of the 30+ harnesses surfacing in 2026 has no governance layer. They have skills. They have hooks. They have agents that spawn agents. None of it carries falsifiable evidence that the work is correct, safe, compliant, or reversible.

hima is the layer that answers: **before this commit lands, what did we prove?**

## What hima is not

- **Not an IDE.** Cursor and Windsurf compete on cursor placement and file-tree UX. hima integrates with whatever editor a developer uses and stays terminal-native.
- **Not a model.** hima does not have an opinion on which model is best. It disciplines whichever model the user brings.
- **Not a replacement agent.** Devin and OpenHands replace the developer's interaction model. hima governs whatever agent the developer chooses.
- **Not a wrapper.** A wrapper sits in front and forwards. hima IS the orchestration layer — it sits *above* the runtime and binds adapters down to Claude Code, Codex, Hermes, and beyond.

## How hima wins

Three compounding asymmetries:

1. **Generosity at the core.** The MIT public local core ships full skills, full subagents, full T/L/M/H/C risk classes, full hooks, full CLI. No skill gating. No risk-depth paywall. The free product is a real product. Adoption is the moat; paywall friction kills it.

2. **Governance-portable across runtimes.** Raw multi-runtime execution is now table-stakes (Goose, OpenHands, Aider, Mastra, Microsoft AGT all have it). What hima ships that they don't: the **risk policy and the compliance artifacts travel WITH the developer**, not just the agent runtime. Switch from Claude Code to Codex on Monday and the same `T/L/M/H/C` classes, the same evidence gates, the same EU AI Act mapping follow.

3. **Falsifiability as discipline.** Every strategy claim, every public assertion, every analysis conclusion in hima's own docs carries a `Falsifies-If:` block — kill condition + checkpoint date + evidence anchor + on-fail action. The harness practices what it sells. A buyer who reads `docs/business-model/strategy-diagnosis.md` sees a product that already runs its own product.

## The 2026-08-01 first-fact moment

v0.1.0 ships to GitHub by **2026-08-01** under MIT. `npm install -g @hima/cli`. Full public core. Three first-party adapters: Claude Code, Codex, Hermes. Founding-member tier opens at $249–299 perpetual v1.x, capped at 1000 numbered licenses. Closed when 1000 sold or 12 months elapse (whichever first). That cohort funds 18+ months at projected burn.

After that:
- 90 days post-launch: at least 100 founding sold OR pivot to annual-only ($180/yr Pro)
- 6 months post-launch: ≥30% of new sign-ups via dark-social referral OR pivot acquisition
- 12 months post-launch: ≥1% paid conversion OR add explicit upgrade prompts
- 18 months post-launch: ≥3 inbound enterprise leads stalled on SSO/SOC 2 OR keep enterprise floor dormant

Each of these is in `docs/business-model/strategy-diagnosis.md` as a real falsifier with a real on-fail action — not a "we'll see."

## The 2028 horizon

In 2028 hima is either:
- **The integrated quality discipline standard** at the developer-terminal tier (≥3 first-party adapters in production, ≥80% excellence-coverage across 7 books, ≥20 community-contributed skills, $100K+ PLG ARR sustained), OR
- **Falsified and revised.** The diagnosis names exactly which kill conditions trigger a revision and what the revised positioning is. The vision is durable; the path to it is not.

```yaml
Falsifies-If:
  kill-condition: 2028-08-01 passes with hima neither (a) shipped + revenue-positive nor (b) cleanly killed with a documented kill reason and the founding cohort refunded or migrated to a chosen successor product
  checkpoint-date: 2027-08-01 (interim half-way check — at this date, ≥3 of the 6 acceptance criteria in LONG-TERM-GOAL.md §2 should already be met or under demonstrable progress)
  evidence-anchor: docs/goals/LONG-TERM-GOAL.md §2 + GitHub release page + Stripe dashboard + the founding-cohort communication record
  on-fail: revise this file's §How hima wins within 30 days; either (a) sharpen the asymmetries based on what actually worked, or (b) acknowledge the vision was wrong and document the new vision before any further bets land
```

## What to read after this

| Need | File |
|------|------|
| Detailed acceptance criteria | `docs/goals/LONG-TERM-GOAL.md` |
| Current cycle's deliverable | `docs/goals/SHORT-TERM-GOAL.md` |
| Strategy diagnosis (Rumelt kernel — constraint + guiding policy + 7 refusal rules + 7 bets) | `docs/business-model/strategy-diagnosis.md` |
| Architecture | `docs/propositions/pipeline-fractal-v4-final-proposal/` |
| Gates spec (Falsifies-If governance lives at §8.4) | `docs/conception/05-gates-policy-spec.md` |
| Cycle history + active cycle status | `docs/goals/` (archive subdir for closed cycles) |

---

*This file is the vision — what hima is, why now, how it wins, when it gets falsified. It is short on purpose. Anything not in the asymmetries, anything not in the time-anchored bets, is not the vision; it is implementation or marketing or hope.*
