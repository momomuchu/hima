---
adr-id: 0006
title: The base skill tier ships agnostic primitives; the dev-cycle skills are a swappable default pack
claim-bearing: true
status: accepted
date: 2026-07-02
resolves: SPEC-VISION §9 OD-2
---

# ADR-0006 — base tier = agnostic primitives, not a hardcoded methodology

## Decision

`[CRITICAL][BLOCKS:high]` The pluggable skill registry's **`base` tier ships only agnostic
primitives** — the cycle engine, the forcing mechanism (`pickAttack`), and the small set of
**meta/orchestration** skills every cycle needs (planning, research, review, verification, cleanup,
intake, batch-questioning, project-disciplines, triage). The **opinionated dev-cycle skills**
(the survey/charter/blueprint/forge/trial/verdict/stewardship set from
`.planning/research/HIMA-BASE-SKILLS.md`) ship as a **default, clearly-swappable "dev-cycle pack"**,
NOT as part of the agnostic core.

Tier model — matching the code SSOT `SkillRef.source` (`packages/schemas/src/skill-ref.ts`, the
literal `"base" | "corpus" | "user" | "project"`): **four provenance tiers, resolved
`base` < `corpus` < `user` < `project`.** `base` is the agnostic shipped set (this ADR's subject);
`corpus` is the founder's private excellence books; `user`/`project` are consumer overrides. `corpus`
is its own tier, NOT folded into `user`.

## Rationale

`[CRITICAL]` SPEC-VISION V-010/V-016 and SPEC-PRIMITIVE P-002/INV-2 require the cycle to be **data,
not hardcoded** — the dev-cycle is *one instance* (a sales-cycle is another). If `base` shipped an
opinionated dev methodology, hima would stop being the **agnostic governance layer above any agent**
(V-016) and become "one more methodology." Keeping `base` agnostic preserves pluggability while
still giving a stranger who clones hima a **working default cycle** (the dev-cycle pack) out of the box.

Evidence: `packages/schemas/src/cycle.ts` already models the cycle as a decodable `CycleDef`
(pluggable by construction); `.planning/research/HIMA-BASE-SKILLS.md` already separates 7 stage-bound
(dev-cycle) skills from 8 meta skills — this ADR makes that split a governing boundary.

## Alternatives considered

- **base = opinionated dev-cycle (rejected):** simplest to ship, but hardcodes a methodology into the
  kernel, contradicting V-016/INV-2 and killing the "cycle is pluggable" property. Rejected.
- **base = primitives only, no default pack (rejected):** purest, but a fresh clone would have no
  working cycle — poor first-run experience. Rejected in favor of shipping the dev-cycle as a
  *swappable pack* (best of both).

## Consequences

- `.planning/research/HIMA-BASE-SKILLS.md` is reconciled (see its header note): its 8 meta skills
  are `base`; its 7 stage-bound skills are the `default dev-cycle pack` (swappable).
- The registry contract (`SkillRef.source`) keeps `base` generic; a future `pack` concept (or a
  `project`-tier cycle override) carries the opinionated set.
- No code change required now — the cycle is already data; this is a scoping boundary for the
  not-yet-built registry/onboarding.

Falsifies-If:
  kill-condition: >
    The base tier is shipped containing opinionated dev-cycle stage skills (making the methodology
    non-swappable), OR the kernel begins to require the dev-cycle pack to function (violating the
    cycle-is-data property in SPEC-PRIMITIVE INV-2).
  checkpoint-date: 2026-08-01
  evidence-anchor: docs/specs/SPEC-PRIMITIVE.md
  on-fail: set this ADR status to superseded; re-open SPEC-VISION §9 OD-2; re-derive the base/pack
    boundary before the pluggable registry is implemented.
