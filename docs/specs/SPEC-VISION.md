---
spec-id: SPEC-VISION
title: hima — Vision (formal, ISO/IEC/IEEE 29148 shaped)
claim-bearing: true
status: DRAFT
date: 2026-07-02
standard-basis: ISO/IEC/IEEE 29148:2018 (Vision + StRS + ConOps); companions IEEE 1362 (ConOps), ISO/IEC/IEEE 42010 (viewpoints), ISO/IEC 25010 (quality model)
supersedes: the prior COMMERCIAL vision (MIT open-core / founding cohort / ARR / EU-AI-Act) — NOT the current vision per founder direction 2026-07-02; now archived to private/vision-commercial-v1.md (see §9 OD-1)
source: founder dictation 2026-07-02 (remote-control), formalized — content is the founder's, structure is 29148
---

# SPEC-VISION — hima

## §0 About this document

This is the vision specified at ISO rigor. It is not marketing prose: **every numbered
statement carries a traceability ID (`V-00x`), a criticality tag, and — where claim-bearing —
inherits the file-level `Falsifies-If`**. The primitive (SPEC-PRIMITIVE) and the contracts
(`@hima/schemas`) trace UP to a `V-00x` here. If a contract cannot name the `V-00x` it serves,
it is out of scope.

**Rigor bar (29148 §5.2.5)** — each statement below is written to be *Necessary, Appropriate,
Unambiguous, Complete, Singular, Feasible, Verifiable, Correct, Conforming*; the set is
*Complete, Consistent, Feasible, Bounded*. §8 is the conformance checklist.

---

## §1 Business context

### 1.1 Background & problem statement
> *Per 29148, §1.1 is **descriptive problem-statement** prose, not testable acceptance
> requirements. The criticality tags here denote **problem severity**, not execution-blocking
> order; the testable requirements begin at §1.3 (V-005+).*

- **V-001** `[CRITICAL][BLOCKS:critical]` We are in the era of AI coding agents — a durable new
  role. The agents are getting genuinely capable, but there is **no trustworthy layer that shows
  a functionality was proposed → applied → then validated *and verified*, clearly, accurately,
  end-to-end, with the concepts behind it** (the V&V principle). "It runs" is not "it is done."
- **V-002** `[HIGH][BLOCKS:high]` The interaction model changed: it is no longer a chat where you
  talk. It is **orchestrated, heavily-parallelized sub-agents running continuously, with distinct
  roles** — implementers, executors, testers, validators. Speed is high; governance of that speed
  is absent.
- **V-003** `[CRITICAL][BLOCKS:critical]` There is **no discipline layer sitting above the coding
  agent** that controls the development stages *and* the development discipline (the context and
  prompting each stage needs) so that work reaches a **real Definition of Done**.

### 1.2 Business opportunity
- **V-004** `[HIGH][BLOCKS:high]` The opportunity is **engineering discipline + loop engineering as
  a portable layer**: raise the *yield* (rendement) and quality of agent-produced work by governing
  the loop, not by writing more instructions.

### 1.3 Objectives & success criteria
- **V-005** `[CRITICAL][BLOCKS:critical]` **Primary objective:** better-quality production at
  better yield through disciplined engineering — not faster code, not more code.
- **V-006** `[CRITICAL][BLOCKS:critical]` **Success criterion (the acceptance of hima itself):**
  you launch a task and it completes **end-to-end, validated against an already-declared
  specification, in a controlled and deterministic way**, reaching a real DoD — **without the
  operator having to manually spawn a sub-agent to verify or validate**. V&V is baked into the
  loop, applied *disciplinarily* from the methodologies already in the knowledge base.

### 1.4 Business risks
- **V-007** `[MEDIUM][BLOCKS:none]` **There is no commercial business risk because there is no
  commercial business** — no revenue model is in play. hima is, at this stage, a discipline
  runtime (private-first), not a product to sell. The commercial framing in the prior `vision.md`
  is explicitly **not** the current vision (see §9 OD-1).

---

## §2 Stakeholders

- **V-008** `[HIGH][BLOCKS:high]` **The governed environment is the coding agent itself.** hima is
  a runtime that sits **above** the coding agent and manages all its hooks. In that sense the
  agent runtime is hima's primary "client" — the thing hima disciplines.
- **V-009** `[HIGH][BLOCKS:low]` **The user is the developer** who orchestrates coding agents
  (Claude Code, Codex, Hermes, OpenCode, …) from the terminal and wants end-to-end validated
  output without hand-driving verification.

---

## §3 Vision of the solution

### 3.1 Vision statement (29148 / Moore template)
> **For** a developer working through AI coding agents
> **who** needs each functionality delivered end-to-end — validated *and* verified, deterministically,
> with a real Definition of Done —
> **hima is** an explicit abstraction/plugin layer *above* the coding agent (a governance runtime),
> **not a coding agent itself,**
> **that** drives development as governed **cycles** — forcing the right discipline (context, skills,
> roles) at each stage, orchestrating parallel role-based execution, and tracing everything —
> **so that** "the coding agent actually does what it is supposed to do."
> **Unlike** a raw coding agent (a chat) or a thin multi-runtime wrapper,
> **hima** brings to the coding agent **what ISO-grade regulation demands of software development**.

### 3.2 Primitive / irreducible capability
- **V-010** `[CRITICAL][BLOCKS:critical]` **The irreducible primitive of hima is the CYCLE.**
  Development proceeds by cycles; the cycle is the smallest complete unit hima governs. A cycle is
  an ordered set of stages; each stage is *governed* (the right context/skill/role is forced) and
  *gated* by V&V before it may advance. → detailed in `docs/specs/SPEC-PRIMITIVE.md` (traces to V-010).
- **V-011** `[HIGH][BLOCKS:high]` **Forcing the right skill/context/role is the *mechanism*, not the
  primitive** — it is how each stage of the cycle is governed. (This corrects the earlier framing that
  named forcing itself as the primitive.)

### 3.3 Major features
- **V-012** `[MEDIUM][BLOCKS:none]` Feature enumeration is intentionally deferred — the founder's
  call is that the cycle + V&V + traceability are the core; a full feature list is downstream of
  SPEC-PRIMITIVE. Placeholder, not a commitment.

### 3.4 Assumptions & dependencies
- **V-013** `[HIGH][BLOCKS:high]` **Assumption:** host coding agents expose a hook surface hima can
  bind to (UserPromptSubmit / PreToolUse / PostToolUse / Stop / SubagentStart-Stop, per runtime).
- **V-013a** `[HIGH][BLOCKS:high]` **Dependency:** thin per-runtime adapters
  (Claude / Codex / Hermes / OpenCode) that translate the universal gate model to each host.

---

## §4 Scope

### 4.1 Scope of v1 (in)
- **V-014** `[CRITICAL][BLOCKS:critical]` v1 scope = **the built V3 architecture**, whose components
  are enumerated (with code locations) in `docs/specs/SPEC-PRIMITIVE.md` §9 — the forcing primitive,
  gate/behavior engine, capability-map, adapters, ward, cycle engine, forced parallelization, and
  traces. (Point-in-time evidence: certified 54/54 gaps, 1591 tests green as of 2026-07-02 —
  see the Falsifies-If evidence-anchor; not an in-statement claim.)

### 4.2 Scope of later releases
- **V-015** `[MEDIUM][BLOCKS:none]` Later = **modes** — e.g. an **automatic / bypass mode**: hima
  self-decides and develops autonomously (autopilot). Not v1.

### 4.3 Limitations & exclusions
- **V-016** `[CRITICAL][BLOCKS:critical]` **hima is NOT a coding agent.** It is an **explicit plugin
  / abstraction layer above** the agent. It governs the layer above; it does not take over what the
  coding agent does inside its own execution. This exclusion is the identity boundary — read it as
  the primary constraint.

---

## §5 Concept of operations (ConOps)

- **V-017** `[HIGH][BLOCKS:high]` The **primitive operation emanates, at the end, into smaller
  behaviors** — the smallest being a trivial task. A cycle decomposes into stage behaviors;
  behaviors decompose into trivial acts, each governable and gated.
- **V-018** `[HIGH][BLOCKS:low]` **Operating scenarios are the architecture itself** — each stage of
  the cycle is a scenario, specified in the V3 architecture flow. This spec references, not
  duplicates, that stage-by-stage description.

---

## §6 Quality attributes & measures of effectiveness (GQM / ISO 25010)

- **V-019** `[CRITICAL][BLOCKS:high]` **The measure of effectiveness is the TRACE.** Because every
  step is traced, hima can state **exactly what happened** — e.g. whether a given stage of the cycle
  was passed. Effectiveness is *evidenced*, not asserted.
- **V-020** `[HIGH][BLOCKS:low]` **Quality attribute:** given a problem, hima selects a
  **deterministic attack strategy** via `pickAttack`'s ladder rule (the strongest available
  ForceAction for the runtime's capability). Observability from the transcript is the visible proof.

**GQM operationalization (measurable, not hope):**
| Goal | Question | Metric |
|---|---|---|
| End-to-end deterministic validation (V-006) | Did the task reach DoD with every stage-gate green and **zero manual verify-spawns**? | % of tasks reaching DoD with all stage verdicts sealed + full trace present; count of operator-initiated verify sub-agents (target 0) |
| Full traceability (V-019) | Can we retrace what/how/why for any run from the transcript alone? | % of runs whose stage transitions are reconstructable from `.hima/state/trace/<session>.jsonl` |

---

## §7 Traceability & governance

- **V-021** `[CRITICAL][BLOCKS:critical]` **Governance rule:** the cycle cannot advance past a stage
  whose V&V gate has not produced a sealed verdict, and every stage transition is traced — so from
  the transcript alone hima can retrace what happened, how, and why. (Verifiable against
  SPEC-PRIMITIVE P-007/P-009; supersedes the earlier unbounded "absolute control" phrasing.)
- **V-022** `[HIGH][BLOCKS:low]` hima practices its own discipline: this vision is claim-bearing and
  falsifiable (below); the primitive and contracts must trace to a `V-00x` or be cut.

---

## §8 Rigor conformance checklist (29148 §5.2.5)

Per-statement (spot-audited, full audit is the separate validator pass):
`Necessary` ☐ `Appropriate` ☐ `Unambiguous` ☐ `Complete` ☐ `Singular` ☐ `Feasible` ☐
`Verifiable` ☐ `Correct` ☐ `Conforming` ☐
Per-set: `Complete` ☐ `Consistent` ☐ `Feasible` ☐ `Bounded` ☐

> Checkboxes are unchecked on purpose: filling them is the **independent rigor-gate pass** (a
> separate reviewer, never the author) — see the offered next step. This is the ISO difference
> between "written" and "verified."

---

## §9 Open decisions (residual — tagged, non-blocking for the vision)

- **OD-1** `[HIGH][BLOCKS:high]` **Fate of the commercial layer — RESOLVED (parked).** The prior
  commercial vision + long-term goal (ARR, founding cohort, EU-AI-Act) are **archived to the
  `private/` submodule** (`private/vision-commercial-v1.md`, `private/LONG-TERM-GOAL-commercial-v1.md`)
  per founder direction 2026-07-02 — parked, not deleted. Remaining: derive a fresh (non-commercial)
  long-term goal from §1 of this spec.
- **OD-2** `[MEDIUM][BLOCKS:low]` **base tier: agnostic vs opinionated — RESOLVED.** `base` ships
  agnostic primitives + meta skills; the opinionated dev-cycle skills become a swappable default
  pack. See `docs/decisions/0006-base-tier-agnostic-primitives.md`.
- **OD-3** `[MEDIUM][BLOCKS:none]` **"discipline of development" (context/prompting per stage)** —
  founder said "not for now." Parked as later scope, noted so it is a decision, not an omission.

---

Falsifies-If:
  kill-condition: >
    A hima release claims a task is DONE without that task having passed every stage's V&V gate
    with a sealed verdict and a full trace (violating V-006/V-019/V-021), OR hima begins acting as
    a coding agent rather than the abstraction layer above one (violating V-016), OR the irreducible
    unit hima governs ceases to be the cycle (violating V-010).
  checkpoint-date: 2026-08-01
  evidence-anchor: docs/decisions/0004-v3-architecture-build.md
  on-fail: reopen SPEC-VISION as DRAFT; re-run §0 primitive→contract traceability; reconcile the
    diverging statement before any dependent contract or base-skill work proceeds.
