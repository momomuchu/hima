---
adr-id: 0008
title: Reposition hima as "Norm" — the ISO/SWEBOK-v4 qualification layer for coding agents
claim-bearing: true
status: accepted
date: 2026-07-05
---

# ADR-0008 — Norm: the ISO/SWEBOK-v4 qualification plugin

## Context

`hima` was framed as "a governance runtime kernel." Founder direction (2026-07-05) sharpens the
identity: hima is **the plugin that converts a raw coding agent into an ISO-production-grade one** —
the *norme* (ISO standard) a coding agent must meet. Two things follow: a **rename** to an ISO/
SWEBOK-referencing name, and elevating the **delegation-first operating model** (imported from OMC)
from advice to a forced discipline. Grounding: SWEBOK v4.0 (IEEE Computer Society, 2024-10-15) has
18 knowledge areas incl. the new *Software Architecture, Software Engineering Operations, Software
Security* — the body of engineering knowledge Norm makes executable per stage.

## Decision

`[HIGH][BLOCKS:high]` **Product name = Norm.** A *norme* is literally an ISO standard; in French
(founder's language) "norme ISO" is the everyday term → the name *is* the thesis. Tagline: *"the
ISO/SWEBOK-v4 qualification layer for coding agents."*

`[MEDIUM][BLOCKS:low]` **Codename/binary stay `hima` for now.** The CLI binary, `@hima/*` packages,
and `.hima/` state directory keep the `hima` name; only identity-facing docs (vision, README) adopt
Norm immediately. The mechanical rename (~200 files, package scopes, binary) is a **separate S wave**,
non-urgent and reversible — decoupled so the repositioning is not blocked by a large refactor.

`[HIGH][BLOCKS:high]` **Norm ⊕ OMC compose, they do not compete.** Norm (per-project, runtime-
agnostic) owns *WHAT + WHEN*: the norm, the gates, and the directive to delegate with specified
roles. OMC (`~/.claude`, global, Claude-only) owns *HOW*: the Team/Sub-Agent/Task machinery that
fulfills the directive. On Codex, the directive maps to codex fan-out. Norm treats OMC as its
richest execution backend, never as a dependency.

`[HIGH][BLOCKS:high]` **Delegation-First becomes a forcing-function** (specified in
`SPEC-018-delegation-first-gate.md`): at work-bearing stages on H+ tasks, a main-thread solo
implementation is a norm violation; Norm forces parallel role-based lanes + an independent verifier.

## Rationale (traced to evidence)

- Founder verbatim 2026-07-05: "le plug-in qui convertit ton coding agent normal en coding agent au
  niveau du palier de vraiment ISO"; "Team-First et Sub-Agent-First… délégation First."
- ISO tie is real, not cosmetic: separation of duties (author ≠ reviewer) is make-no-mistakes §2 and
  the ISO 9001 §7.5 control principle; SWEBOK v4 codifies the KAs Norm gates. The name encodes the
  product's actual job.
- Decoupling the mechanical rename honors `[NO] big rewrite` / strangler-fig: identity shifts now,
  the codebase renames incrementally when it is cheap to do so.

## Alternatives considered

- **Keep "hima", no rename** — rejected: the name carries no meaning; the founder wants the identity
  to *state* the ISO thesis.
- **Rename everything now (binary + packages + state dir in one wave)** — rejected: ~200-file
  refactor gating a conceptual shift; high blast radius for zero identity benefit today. Staged.
- **Alternative names (Bok / Conforma / Gradus)** — Bok (SWEBOK) too obscure standalone; Conforma
  heavier; Gradus good but "Norm" wins on the French double-meaning + one syllable. Recorded, not chosen.

## Consequences

- SPEC-VISION amended: §3.1 names Norm, §3.3 adds V-012a (Delegation-First), §9 OD-4 resolves the name.
- New SPEC-018 specifies the Delegation-First gate (spec-first, before any code).
- Residual: the mechanical `hima`→`norm` rename is scheduled but unshipped; docs will read "Norm
  (codename hima)" during the transition — a known, intentional inconsistency.

Falsifies-If:
  kill-condition: >
    Norm ships as a fork/replacement of OMC rather than a composing layer above the coding agent
    (violating the "compose not compete" decision and SPEC-VISION V-016), OR the Delegation-First
    gate is never specified/implemented and delegation remains advice-only, OR the founder rejects
    the name "Norm" in a later turn (then reopen this ADR and pick from the recorded alternatives).
  checkpoint-date: 2026-08-01
  evidence-anchor: docs/specs/SPEC-VISION.md
  on-fail: set status: superseded, revert the SPEC-VISION identity edits (§3.1 name / OD-4), and
    re-decide the name before any mechanical rename wave begins.
