# hima — Project Brief

`hima` is the Pipeline Fractale v4 (PFV4) runtime kernel for governed AI coding-agent workflows. See `README.md` for scope, `docs/business-model/strategy-diagnosis.md` for the strategy diagnosis.

## Goal cadence (read at session-start, in this order)

This project follows a three-file goal cadence:

1. **Vision** — `docs/vision.md` — what hima is, why now, how it wins, when it gets falsified. Forward-looking + emotive. Short, durable, revised only when the vision itself shifts.
2. **Long-term goal** — `docs/goals/LONG-TERM-GOAL.md` — end state + acceptance criteria. Stable across sessions; only revised on explicit user direction.
3. **Short-term goal** — `docs/goals/SHORT-TERM-GOAL.md` — the current cycle's deliverable + kill criteria + DONE definition. Refreshed when the previous short-term goal reaches `status: DONE`.

**Protocol on session-start:**
- Read both files.
- If `SHORT-TERM-GOAL.md` is `status: ACTIVE`, execute against it.
- If `status: DONE`, archive to `docs/goals/archive/cycle-NN-DONE-YYYY-MM-DD.md` and surface to the user that a new short-term goal is needed (or pull the next one from the queue listed in the current file).
- If `status: BLOCKED`, surface the blocker before doing anything else.

Full protocol: `docs/goals/README.md`.

## Hard rules inherited from the user's global `~/.claude/CLAUDE.md`

- Sub-agents use **sonnet** (or haiku for trivial lookups), **never opus**. Main thread = opus.
- Always `run_in_background: true` for parallel agents. Use `isolation: "worktree"` if file conflicts possible.
- Claim-bearing artifacts (anything in `docs/business-model/` outside `research-*`/`verification-*`, anything in `docs/decisions/`, anything with frontmatter `claim-bearing: true`) MUST carry `Falsifies-If:` blocks per `docs/conception/05-gates-policy-spec.md` §8.4.
- Tidy First (Beck): every commit is **S** (structural — refactor, rename) OR **B** (behavioral — feat/fix/perf). NEVER mixed.

## Reference docs (most useful at session-start)

| What | Where |
|---|---|
| Vision (forward-looking, durable) | `docs/vision.md` |
| End-state acceptance criteria | `docs/goals/LONG-TERM-GOAL.md` |
| Current cycle's deliverable | `docs/goals/SHORT-TERM-GOAL.md` |
| Strategy diagnosis (Rumelt kernel, governed) | `docs/business-model/strategy-diagnosis.md` |
| Gates spec (Falsifies-If rule lives at §8.4) | `docs/conception/05-gates-policy-spec.md` |
| Excellence-audit synthesis (W0–W5 backlog) | `.planning/excellence-audit/EXCELLENCE-AUDIT-REMEDIATION.md` |
| Architecture | `docs/propositions/pipeline-fractal-v4-final-proposal/` |
| Cycle docs | `docs/cycles/01-discovery/`, `docs/cycles/02-cadrage/`, ... `docs/cycles/08-apprentissage/` |

## Out-of-scope reminders

- `.planning/`, `.omc/`, `.omx/`, `.claude/` are local-only state per `docs/decisions/0001-project-identity.md`.
- Repository is private-first; public release is a separate decision.
- Books `06-ai-ml` and `08-security` from the otherskill excellence-book portfolio are **deferred to v2** per the long-term goal acceptance §5.
