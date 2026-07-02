# hima — Project Brief

`hima` is the Pipeline Fractale v4 (PFV4) runtime kernel for governed AI coding-agent workflows. See `README.md` for scope and `docs/specs/SPEC-VISION.md` for the vision. Prior commercial/strategy/business docs and the full v1 archive live in the **`private/` submodule** (`momomuchu/hima-private`) — not for public/use consumption.

## Goal cadence (read at session-start, in this order)

This project follows a three-file goal cadence:

1. **Vision** — `docs/specs/SPEC-VISION.md` — the formal ISO/IEC/IEEE 29148 vision (what hima is, its irreducible primitive = the cycle, scope, ConOps, measures, falsifiers). Durable; revised only when the vision itself shifts. (The prior commercial `vision.md` is archived to `private/`.)
2. **Long-term goal** — `docs/goals/LONG-TERM-GOAL.md` — the re-centered, non-commercial end state + acceptance criteria (derived from SPEC-VISION §1). The prior commercial one is archived to `private/`.
3. **Short-term goal** — `docs/goals/SHORT-TERM-GOAL.md` — the current cycle's deliverable + kill criteria + DONE definition. Refreshed when the previous short-term goal reaches `status: DONE`.

**Protocol on session-start:**
- Read the vision + long-term + short-term goal.
- If `SHORT-TERM-GOAL.md` is `status: ACTIVE`, execute against it.
- If `status: DONE`, archive to `docs/goals/archive/cycle-NN-DONE-YYYY-MM-DD.md` and surface to the user that a new short-term goal is needed (or pull the next one from the queue listed in the current file).
- If `status: BLOCKED`, surface the blocker before doing anything else.

Full protocol: `docs/goals/README.md`.

## Hard rules inherited from the user's global `~/.claude/CLAUDE.md`

- Sub-agents use **sonnet** (or haiku for trivial lookups), **never opus**. Main thread = opus.
- Always `run_in_background: true` for parallel agents. Use `isolation: "worktree"` if file conflicts possible.
- Claim-bearing artifacts (anything in `docs/decisions/`, anything with frontmatter `claim-bearing: true`) MUST carry a resolving `Falsifies-If:` block — enforced by `scripts/validate-claim-bearing-falsifies.mjs` (the gates-policy spec itself is archived to `private/`).
- Tidy First (Beck): every commit is **S** (structural — refactor, rename) OR **B** (behavioral — feat/fix/perf). NEVER mixed.

## Reference docs (most useful at session-start)

| What | Where |
|---|---|
| Vision (formal, ISO 29148) | `docs/specs/SPEC-VISION.md` |
| Primitive (the cycle) | `docs/specs/SPEC-PRIMITIVE.md` |
| Formal contracts / specs | `docs/specs/` (SPEC-VISION, SPEC-PRIMITIVE, SPEC-008..014) |
| Architecture decisions (ADRs) | `docs/decisions/` |
| Non-commercial end state | `docs/goals/LONG-TERM-GOAL.md` |
| Current cycle's deliverable | `docs/goals/SHORT-TERM-GOAL.md` |
| Setup / config guides | `docs/hima-setup.md`, `docs/hima-config.md` |
| Private (strategy, business, full v1 archive) | `private/` submodule (`momomuchu/hima-private`) — access-gated |

## Out-of-scope reminders

- `.planning/`, `.omc/`, `.omx/`, `.claude/` are local-only state per `docs/decisions/0001-project-identity.md`.
- Repository is private-first; public release is a separate decision.
- Books `06-ai-ml` and `08-security` from the otherskill excellence-book portfolio are **deferred to v2** per founder direction (see `docs/specs/SPEC-VISION.md` §4.3 / §9).
