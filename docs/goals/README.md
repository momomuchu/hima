# Goal Cadence — hima

Two files govern the agent's work direction at every session-start:

| File | Lifecycle | Purpose |
|------|-----------|---------|
| `LONG-TERM-GOAL.md` | Stable (revised on explicit user direction only) | End-state vision, acceptance criteria, kill conditions. The North Star. |
| `SHORT-TERM-GOAL.md` | Rolling (refreshed at each cycle completion) | Current cycle's deliverable + DONE criteria + kill conditions. |

## Why this exists

A long-term goal is too coarse to drive a session — it describes the destination, not the next step.
A short-term goal is too fine to survive across sessions — it describes a step, not why it matters.
Both together form the cadence: each short-term goal is one bounded sub-goal of the long-term goal, with explicit DONE criteria. When DONE, it's archived and the next short-term goal takes its place.

This is the user's explicit governance mechanism — preferred over external task trackers, because the file system is the truth and survives across sessions, machines, and forks.

## Protocol

### On session-start

1. Read `LONG-TERM-GOAL.md` (context, never modified within a normal session).
2. Read `SHORT-TERM-GOAL.md`:
   - If `status: ACTIVE` → continue executing against it.
   - If `status: DONE` → archive to `archive/cycle-NN-DONE-YYYY-MM-DD.md`, then either (a) instantiate the next cycle from the "Books queued after this one" section of the archived file, or (b) surface to the user that the next short-term goal needs to be defined.
   - If `status: BLOCKED` → surface the blocker to the user before doing anything else.
   - If `status: CANCELLED` → same as DONE archival, but with the cancellation reason recorded.

### On cycle completion (short-term goal reaches DONE)

1. Set `status: DONE` and fill `closed: YYYY-MM-DD` in the frontmatter.
2. Append a closing section to the file:
   - Completion date
   - Evidence anchors (file paths + commits)
   - What shipped
   - What's deferred to the next cycle
3. Either copy this file to `archive/cycle-NN-DONE-YYYY-MM-DD.md` and overwrite `SHORT-TERM-GOAL.md` with the next cycle's content, OR leave it and let the next session do the archival step (depending on whether the next cycle is already drafted).

### On user override (change of direction mid-cycle)

The user may set `status: CANCELLED` and provide a new short-term goal. Archive the cancelled file to `archive/cycle-NN-CANCELLED-YYYY-MM-DD.md` with a 1-line reason note. Do NOT silently drop progress — at minimum, list what was done so far in the cancelled-file's closing section so the work isn't lost.

## File schema

Both files use this frontmatter:

```yaml
---
cycle-id: <e.g. cycle-02-analysis-discovery, or "long-term" for the long-term file>
claim-bearing: true  # both files contain assertions about state, scope, and DONE criteria — they qualify under §8.4
status: ACTIVE | DONE | BLOCKED | CANCELLED
opened: YYYY-MM-DD
closed: YYYY-MM-DD (or empty while ACTIVE)
supersedes: <previous cycle id, or "(none)">
---
```

Then sections specific to each file (see the files themselves).

## Cross-references

- Claim-bearing artifacts in `docs/goals/` MUST comply with `docs/conception/05-gates-policy-spec.md` §8.4 — Falsifies-If blocks required for every kill-condition / acceptance criterion / sequencing claim.
- The `archive/` directory holds historical cycles. Never delete archived cycles — they're the project's memory of what was tried and what was learned.
- The "Books queued after this one" section in any active SHORT-TERM-GOAL.md acts as a lightweight backlog. When promoted to ACTIVE, the queue entry becomes the new short-term goal.

## Wave protocol — cross-agent reconciliation

Every multi-agent research or review wave ends with a reconciliation pass before synthesis is accepted.

1. Each agent lists its top 3 entity claims: repository names, star counts, file paths, package versions, product names, or other concrete identifiers that later claims depend on.
2. Each agent verifies the top 3 entity claims from at least one other agent against primary evidence or local files.
3. The synthesis records any mismatch and the source of truth used to resolve it.
4. A material mismatch blocks cycle close until corrected in the source report and synthesis.

This rule exists because cycle-02 produced incompatible star counts and at least one fabricated file path. Agent output is a claim surface, not authority.

## Vocabulary diversification

Before launching topical scans, the cycle owner writes at least 3 competing vocabulary families for the same problem and assigns at least one scan to each family.

Example families for agent-governance research:

- Skills, hooks, subagents, and runtime adapters.
- DAGs, evidence gates, ledgers, and verifier loops.
- Orchestration frameworks, workflow engines, policy kernels, and compliance traces.

A cycle cannot close solely because one vocabulary family saturated. The saturation test must cover the families that could plausibly hide the same pattern under different terms.

## Saturation-based DONE — the harder bar (user direction 2026-05-14)

**Threshold-based DONE is forbidden.** A cycle does NOT reach `status: DONE` because it hit numeric thresholds (e.g. "≥50 repos surfaced", "≥4 deliverables shipped", "≥X tests passing"). Those numbers are LEADING indicators — necessary, never sufficient.

A cycle reaches `status: DONE` ONLY when **evidence saturation** is demonstrated:

1. **A fresh agent wave of the SAME type as the cycle's primary work returns nothing material.** "Nothing material" = no new patterns, no contradictions to prior findings, no NEW repos beyond duplicates of prior surface, no falsifying counter-examples to the cycle's working claims.
2. **A critic / adversarial agent has attempted to falsify the cycle's headline findings and failed.** If a critic finds a hole, the cycle re-opens to address it. Critic agents are part of the work, not part of the closing ceremony.
3. **Deep evidence has replaced surface evidence on the top N items.** "Top N" means: the cycle's headline claims must be backed by code-level / file:line / direct-inspection evidence on at least 5 of their cited sources. README-only citations are weak evidence; they're permitted for breadth, never for foundational claims.
4. **The findings have been used.** If the cycle produces recommendations and none of them has been applied to hima docs/code by cycle-close, the cycle did not finish — it just produced a report. The application IS part of the cycle.

When a cycle is tempted to DONE, the test is: **"if I dispatched 6 more agents of the same shape right now, would they surface materially new information?"** If yes → not DONE. If no → DONE.

This rule applies recursively to the saturation check itself. The wave that demonstrates saturation must itself be of the same depth as the cycle's primary work — not a token gesture.

### Anti-patterns this rule forbids

- "We hit the ≥50 repos threshold, so we're done." (numeric-threshold trap)
- "The agents returned, so let's synthesize." (deliverable-count trap)
- "The synthesis has 12 sections filled, so it's complete." (structural-completion trap)
- "We found a lot of evidence supporting the claim, so the claim holds." (confirmation-bias trap — must include falsification attempts)
- "The agent said X, so X is established." (source-trust trap — agent summaries are claims, not facts)
- "The cycle has been open for a while, ship it." (timeboxing trap — cycles close on saturation, not on the clock; budget exhaustion is a separate failure mode that gets flagged via Falsifies-If, not a reason to declare DONE)

### Operational consequence

Every cycle's `DONE criteria` section now ends with this clause:

```yaml
saturation-criterion:
  enforced-by: a final critic + deep-evidence agent wave that runs AFTER all primary deliverables have landed
  passes-when: the post-wave critic report finds zero material findings missed AND a fresh primary-work agent surfaces no new patterns / repos / contradictions
  ratchet: if any post-wave finding lands, the cycle re-opens; status reverts ACTIVE; new criteria are added
```

The numeric thresholds in `DONE criteria` are kept as floors (e.g. ≥50 NEW repos, ≥80% IMPL on excellence-book coverage) — they remain necessary. They are no longer sufficient.

```yaml
Falsifies-If:
  kill-condition: 3 consecutive cycles pass with status: DONE but no commit-time evidence anchor in their closing section (the cadence is being treated as paperwork, not governance)
  checkpoint-date: 2026-08-14 (= today + 3 months, ~3 cycles assuming ~30-day cadence)
  evidence-anchor: docs/goals/archive/ contents + git log on each archived cycle's referenced files
  on-fail: tighten the protocol — require git-commit-hash citation in the DONE closing section; require the deep-researcher or coverage-auditor sub-agent to verify the evidence anchor before archival
```
