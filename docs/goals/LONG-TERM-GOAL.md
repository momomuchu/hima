---
cycle-id: long-term
claim-bearing: true
status: ACTIVE
opened: 2026-05-14
closed:
supersedes: (none)
---

# Long-Term Goal — hima

## 1. Vision

hima is the **open-core integrated quality discipline kernel for AI coding agents.** It governs what AI coding agents do during a development session — pre-commit, at task-decomposition time, before irreversible file edits — across multiple coding-agent runtimes (Claude Code, Codex, Hermes, and additional adapters the market validates).

The product wins by being:

1. **The most generous local core** — full MIT, full skills/subagents/CLI, no risk-class paywall.
2. **The widest runtime coverage in the open-core segment** — ≥3 first-party adapters at v1.0, with a public adapter SDK that lets the community contribute more.
3. **The most disciplined evidence kernel** — every assertion (strategy, claim, design decision) carries a Falsifies-If; every cycle has a hard `stop` gate evaluating evidence sufficiency.
4. **The compliance bridge for AI-Act-era enterprise** — T/L/M/H/C risk classes map to EU AI Act tiers, evidence packs ship by default.

## 2. Acceptance Criteria

This long-term goal is reached when ALL of the following hold:

1. **Public release shipped** — v1.0 tagged on GitHub, installable via `npm install -g @hima/cli`, MIT license active, full public core (per `docs/business-model/strategy-diagnosis.md` Bet B1).
2. **Adapter coverage ≥3 in production** — Claude Code, Codex, and at least one third adapter (Hermes OR Cursor OR Aider OR Goose OR another adapter validated by the discovery-cycle research) functional in production, not just in spec.
3. **Founding cohort closed or capped** — 1000 perpetual v1.x licenses sold OR 12 months elapsed since v0.1.0 (per Bet B3).
4. **PLG revenue ≥ $100K ARR** — sustained ≥90 days (per Bet B5 trigger).
5. **Excellence-book coverage ≥80% across 7 books** — books `00-idea-pmf`, `01-strategy-positioning`, `02-analysis-discovery`, `03-specification`, `04-design-ux-ui`, `05-architecture`, `07-build`, `09-quality-release-run` each applied to hima with average ≥80% IMPLEMENTED rating per `coverage-auditor` measurement. Books `06-ai-ml` and `08-security` explicitly **deferred to v2**.
6. **Marketplace seeded** — ≥20 community-contributed skills in `marketplace.json` (free registry phase, per Bet B7).

```yaml
Falsifies-If:
  kill-condition: 2028-05-14 passes with ≤3 of the 6 acceptance criteria above met
  checkpoint-date: 2027-08-01 (interim half-way review — at this date, ≥3 of 6 criteria should already be met or under demonstrable progress)
  evidence-anchor: this file's closing section + Stripe dashboard + GitHub release page + sweep of docs/excellence-application/ + marketplace.json contributor count
  on-fail: pivot to "best-in-class single-runtime quality kernel for Claude Code" — drop multi-runtime claim, drop founding cohort, simplify to annual-only Pro tier; revise this file's §1 Vision within 30 days
```

## 3. Out-of-scope (explicit)

- **Books `06-ai-ml` and `08-security`** — deferred to v2 per user direction. These books are NOT considered for v1 excellence-coverage acceptance.
- **IDE replacement** — per refusal rule R4 in the strategy diagnosis, hima will not compete on cursor placement, file-tree UX, or autocomplete latency. Adapters integrate with editors; they do not replace them.
- **Model recommendations** — per R3, hima does not opine on which model is best. The harness disciplines whichever model the user brings.
- **Enterprise sales motion pre-$100K ARR** — per R6, no SSO build, no SOC 2 audit, no SCIM until conditions met.

## 4. Kill conditions (refusal-rule level)

See `docs/business-model/strategy-diagnosis.md` §2 for the 7 refusal rules (R1–R7) and their Falsifies-If clauses. Any refusal rule firing triggers a **long-term goal revision**, not a short-term tactical pivot — the cadence in `docs/goals/SHORT-TERM-GOAL.md` pauses while the revision happens.

```yaml
Falsifies-If:
  kill-condition: Any of the 7 refusal rules R1-R7 in strategy-diagnosis.md §2 fires its kill-condition before 2027-08-01
  checkpoint-date: rolling (per-event)
  evidence-anchor: docs/business-model/strategy-diagnosis.md §2 + the specific evidence-anchor named in the firing rule
  on-fail: pause the short-term goal cadence; revise this file's §1 and §2 within 14 days; resume the cadence with the next short-term goal aligned to the revised long-term goal
```

## 5. Cross-references

- Strategy diagnosis (the Rumelt kernel this goal is built from): `docs/business-model/strategy-diagnosis.md`
- Business model proposal (narrative source): `docs/business-model/business-model-proposal.md`
- Excellence-audit synthesis (per-book gap matrix + remediation backlog): `.planning/excellence-audit/EXCELLENCE-AUDIT-REMEDIATION.md`
- Per-book application artifacts (built across the short-term-goal cadence): `docs/excellence-application/<book-id>/`
- Goal-cadence protocol: `docs/goals/README.md`

---

*This file is `claim-bearing: true` and governed by `docs/conception/05-gates-policy-spec.md` §8.4. Every numbered criterion above is an assertion. The file-level Falsifies-If in §2 covers the acceptance set as a whole; criteria-level falsifiers are inherited from the diagnosis bets they reference.*
