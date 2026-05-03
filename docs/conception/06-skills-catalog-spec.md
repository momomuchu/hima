# Skills Catalog — Pipeline Fractale v4

**Spec version**: 1.0  
**Date**: 2026-05-03  
**Status**: DRAFT — Conception cycle  
**Sources**: `research-reports/checkpoint-implementation.md`, `docs/propositions/rms-runtime-sets-v1-draft.md`, cycle `concepts-criteria.md` ×8

---

## 1. Skills Inventory

Skills are the primary portable primitive of the harness. Each skill is a `SKILL.md` file
describing a reusable workflow invocable by the runtime agent or user. Skills map to RMS
"procedures" — documented, semi-stable operations that cross platform boundaries unchanged.

| # | Skill name | Cycle(s) | Trigger keyword(s) | Risk classes | Portable |
|---|-----------|----------|--------------------|--------------|---------|
| 1 | `classify-risk` | All | `classify`, `risk`, any new intent | T F M É C | Yes |
| 2 | `propose-change` | All | `propose`, `change`, `feature`, `fix` | T F M É C | Yes |
| 3 | `transition-phase` | All | `advance`, `next cycle`, `promote` | T F M É C | Yes |
| 4 | `status` | All | `status`, `where are we`, `état` | T F M É C | Yes |
| 5 | `discovery-validate` | 01-Discovery | `discovery`, `problem`, `validate idea` | M É C | Yes |
| 6 | `cadrage-dor` | 02-Cadrage | `cadrage`, `dor`, `scope`, `definition of ready` | M É C | Yes |
| 7 | `conception-adr` | 03-Conception | `conception`, `adr`, `architecture`, `design` | M É C | Yes |
| 8 | `build-inner-loop` | 04-Build | `build`, `tdd`, `implement`, `code` | F M É C | Yes |
| 9 | `validation-report` | 05-Validation | `validation`, `test report`, `go/no-go` | M É C | Yes |
| 10 | `release-plan` | 06-Release | `release`, `deploy`, `rollout` | M É C | Yes |
| 11 | `run-monitor` | 07-Run | `run`, `monitor`, `slo`, `alert` | T F M É C | Yes |
| 12 | `apprentissage-retro` | 08-Apprentissage | `retro`, `retrospective`, `learning` | T F M É C | Yes |

**Portability tier**: All skills are Tier 1 — same SKILL.md format across all runtimes.
Install paths differ per platform adapter (see §5).

---

## 2. Core Skills (MVP Mandatory)

These four skills are always active regardless of cycle or risk class. They form the minimum
harness operating surface.

---

### 2.1 `classify-risk`

**Purpose**: Assign a T/F/M/É/C risk class to any incoming intent. This is the harness pivot —
every other workflow branches from the risk class assigned here.

**Input**
```yaml
intent_raw: string          # Raw user request
context:
  files_touched: number
  domains: string[]         # auth | payments | pii | infra | ui | data
  reversible: boolean
  has_tests: boolean
```

**Output**
```yaml
risk_class: T | F | M | É | C
justification: string        # One sentence referencing criteria
autonomy_mode: pairing | auto | bypass
evidence: string             # File path or inline snippet proving classification
```

**Risk classification criteria**

| Class | Criteria |
|-------|----------|
| T — Trivial | 1 file, no logic change, fully reversible, no domain risk |
| F — Faible | ≤3 files, no security/PII, covered by tests |
| M — Moyen | 4–10 files OR new dependency OR public API change |
| É — Élevé | auth/payments/PII touched OR architecture change OR >10 files |
| C — Critique | prod data migration OR security boundary change OR incident response |

**SKILL.md draft**

```markdown
# classify-risk

## Description
Classify any intent as T/F/M/É/C to calibrate harness depth.
AUTO-INVOKE: every session_start, every new intent before any action.

OWNS: risk class assignment, autonomy mode selection, justification trace
NE GÈRE PAS: cycle transitions, artifact generation, implementation

## Trigger
Keywords: classify, risk, any intent received
Auto: yes — fires before propose-change on every new task

## Steps
1. Extract signals from intent: files count, domains, reversibility, test coverage
2. Match against risk criteria table
3. Assign class + justification
4. Set autonomy_mode: T/F → bypass, M → auto, É/C → pairing
5. Write to .planning/state/risk-class.yaml

## Input
- intent_raw: string
- context: files_touched, domains[], reversible, has_tests

## Output
- risk_class: T|F|M|É|C
- justification: string
- autonomy_mode: pairing|auto|bypass
- Evidence: .planning/state/risk-class.yaml written

## Evidence produced
- .planning/state/risk-class.yaml
```

---

### 2.2 `propose-change`

**Purpose**: Transform a classified intent into a formal Intent Set — the harness contract
before any action is taken. Depth scales with risk class.

**Input**
```yaml
intent_raw: string
risk_class: T | F | M | É | C
autonomy_mode: pairing | auto | bypass
```

**Output**
```yaml
intent_set:
  objective: string
  scope_in: string[]
  scope_out: string[]
  risk_class: T | F | M | É | C
  autonomy_mode: pairing | auto | bypass
  dod: string[]               # Definition of Done criteria
  cycle_entry: string         # Which cycle to enter
```

**Depth modulation**

| Risk | Produced artifacts |
|------|--------------------|
| T/F | Intent Set only (inline, no file) |
| M | Intent Set → `.planning/INTENT.md` |
| É | Intent Set + SPEC.md skeleton + ADR stub |
| C | Intent Set + SPEC.md + threat model stub + stakeholder sign-off line |

**SKILL.md draft**

```markdown
# propose-change

## Description
Formalize a user intent into an Intent Set. Scale depth to risk class.
AUTO-INVOKE: after classify-risk, before any cycle entry.

OWNS: Intent Set production, scope IN/OUT, DoD criteria, cycle routing
NE GÈRE PAS: implementation, test authoring, deployment

## Trigger
Keywords: propose, change, feature, fix, task
Auto: yes — fires after classify-risk

## Steps
1. Read risk_class from .planning/state/risk-class.yaml
2. Produce Intent Set (objective, scope IN/OUT, DoD, cycle_entry)
3. T/F: return inline. M/É/C: write .planning/INTENT.md
4. É/C: scaffold SPEC.md skeleton + ADR stub
5. C: add threat model stub + stakeholder sign-off line

## Input
- intent_raw: string
- risk_class, autonomy_mode

## Output
- intent_set (inline for T/F, file for M+)
- Evidence: .planning/INTENT.md (M/É/C)

## Evidence produced
- .planning/INTENT.md (M/É/C only)
- .planning/SPEC.md skeleton (É/C only)
```

---

### 2.3 `transition-phase`

**Purpose**: Validate exit conditions (DoD) for the current cycle and advance the harness
state machine to the next cycle. Guards against premature advancement.

**Input**
```yaml
current_cycle: string        # 01-discovery | 02-cadrage | … | 08-apprentissage
evidence_set: string[]       # Paths to required artifacts
risk_class: T | F | M | É | C
```

**Output**
```yaml
transition:
  from: string
  to: string
  dod_passed: boolean
  missing_evidence: string[]
  new_state: WAITING | IN_PROGRESS | DONE_VERIFIED
```

**DoD check per risk**

| Risk | DoD check depth |
|------|----------------|
| T/F | Auto-advance, no check |
| M | Required artifacts exist (file presence) |
| É | Artifacts exist + content validation (non-empty, headers present) |
| C | Artifacts + explicit approval token in state YAML |

**SKILL.md draft**

```markdown
# transition-phase

## Description
Validate DoD and advance state machine to next cycle.
AUTO-INVOKE: when user says "advance", "next cycle", "promote", or on post_tool_use after final artifact written.

OWNS: DoD gate, state machine transition, missing evidence report
NE GÈRE PAS: artifact content generation, implementation work

## Trigger
Keywords: advance, next cycle, promote, transition
Auto: post_tool_use hook after last cycle artifact written

## Steps
1. Read current cycle from .planning/state/pipeline.yaml
2. Load DoD checklist for current cycle
3. Verify each required artifact exists (and content-valid for É/C)
4. If missing_evidence → BLOCKING: list gaps, do NOT advance
5. If DoD passed → update .planning/state/pipeline.yaml (state → DONE_VERIFIED, next_cycle set)
6. Emit transition event to harness hook

## Input
- current_cycle, evidence_set[], risk_class

## Output
- transition result (from/to/dod_passed/missing_evidence)
- Evidence: .planning/state/pipeline.yaml updated

## Evidence produced
- .planning/state/pipeline.yaml (updated)
- .planning/timeline/<cycle>-done.md (timestamp + evidence list)
```

---

### 2.4 `status`

**Purpose**: Snapshot the harness state — current cycle, risk class, open tasks, last
evidence written, next required action.

**Input**
```yaml
# No required input — reads from .planning/state/
```

**Output**
```yaml
status_snapshot:
  current_cycle: string
  risk_class: T | F | M | É | C
  autonomy_mode: pairing | auto | bypass
  state: WAITING | IN_PROGRESS | DONE_VERIFIED | BLOCKED
  open_tasks: string[]
  last_evidence: string
  next_action: string
```

**SKILL.md draft**

```markdown
# status

## Description
Read and display harness state snapshot.
AUTO-INVOKE: on "status", "where are we", "état" — also on session_start.

OWNS: state reading, snapshot display, next action recommendation
NE GÈRE PAS: state mutation, transitions, artifact generation

## Trigger
Keywords: status, where are we, état, what's next
Auto: session_start hook

## Steps
1. Read .planning/state/pipeline.yaml
2. Read .planning/state/risk-class.yaml
3. Read .planning/registry/open-tasks.yaml
4. Compose snapshot (cycle, risk, state, open tasks, last evidence, next action)
5. Display inline — never write a file for status

## Input
- None (reads from .planning/state/)

## Output
- status_snapshot (inline display only)

## Evidence produced
- None (read-only skill)
```

---

## 3. Cycle-Specific Skills

These skills activate only within their designated cycle. All are skipped for T risk class;
F applies only where noted.

---

### 3.1 `discovery-validate` — Cycle 01

**Purpose**: Validate a problem hypothesis using one of three modes before the harness
commits resources to Cadrage.

**Modes**
- **Produit**: user validation (interviews, usage data, NPS)
- **Self-feedback**: solo dev autodiagnosis (pain points, workarounds)
- **Technique**: spike/PoC to validate feasibility

**Output artifacts**: `discovery-note.md` (problem, evidence, recommendation: build/pivot/kill)

**SKILL.md draft**

```markdown
# discovery-validate

## Description
Validate problem hypothesis. Produce discovery note with build/pivot/kill recommendation.
AUTO-INVOKE: entry into cycle 01-Discovery for M/É/C.

OWNS: problem validation (3 modes), discovery note, recommendation
NE GÈRE PAS: solution design, implementation, release

## Trigger
Keywords: discovery, validate idea, problem exists, hypothesis
Cycle: 01-Discovery

## Steps
1. Identify validation mode: Produit | Self-feedback | Technique
2. Gather evidence for selected mode
3. Score: evidence strength (weak/moderate/strong)
4. Write discovery-note.md: problem statement, evidence, mode used, recommendation
5. Risk É/C: pairing — present recommendation to user before advancing

## Input
- intent_set, validation_mode

## Output
- discovery-note.md (problem, evidence, strength, recommendation)
- Risk É/C: user acknowledgment token

## Evidence produced
- .planning/discovery/discovery-note.md
```

---

### 3.2 `cadrage-dor` — Cycle 02

**Purpose**: Produce a complete DoR (Definition of Ready) for the Conception cycle.
The DoR is the Conception entry gate — Conception cannot start without it.

**Output artifacts**: `dor.md` (scope IN/OUT, EF with AC, ENF with thresholds, MoSCoW,
RICE scores, preliminary ADRs, risk register, performance budget)

**SKILL.md draft**

```markdown
# cadrage-dor

## Description
Produce Definition of Ready for Conception. Scope, requirements, risks, budget.
AUTO-INVOKE: cycle 02-Cadrage entry for M/É/C.

OWNS: DoR production, scope IN/OUT, EF+ENF, MoSCoW+RICE, risk register
NE GÈRE PAS: architecture design, ADR full content, implementation

## Trigger
Keywords: cadrage, dor, scope, definition of ready
Cycle: 02-Cadrage

## Steps
1. Extract scope IN / scope OUT from Intent Set
2. List Exigences Fonctionnelles (EF) with Acceptance Criteria
3. List Exigences Non-Fonctionnelles (ENF) with measurable thresholds
4. Apply MoSCoW: Must/Should/Could/Won't
5. Score EF with RICE (Reach, Impact, Confidence, Effort)
6. Open risk register (risk, probability, impact, mitigation)
7. Draft performance budget (latency p95, bundle size, memory)
8. Write dor.md — Conception gate blocks until file exists

## Input
- intent_set, discovery-note.md (if M/É/C)

## Output
- dor.md (complete DoR)

## Evidence produced
- .planning/cadrage/dor.md
```

---

### 3.3 `conception-adr` — Cycle 03

**Purpose**: Produce architectural decision records (MADR 4.0), C4 diagrams, threat model
(STRIDE), and API contracts. Evidence set for Build entry gate.

**SKILL.md draft**

```markdown
# conception-adr

## Description
Produce ADRs (MADR 4.0), C4 diagrams, STRIDE threat model, API contracts.
AUTO-INVOKE: cycle 03-Conception entry for M/É/C.

OWNS: ADR authoring (MADR 4.0), C4 context+container, STRIDE table, API contract
NE GÈRE PAS: implementation, test authoring, deployment config

## Trigger
Keywords: conception, adr, architecture, design, c4, threat model
Cycle: 03-Conception

## Steps
1. Read dor.md — identify architectural decisions needed
2. For each decision: write ADR using MADR 4.0 template
   (title, status, context, decision, consequences, alternatives considered)
3. Produce C4 context diagram (Mermaid) + container diagram if É/C
4. STRIDE threat model table for É/C (Spoofing/Tampering/…/Denial/EoP)
5. API contracts (OpenAPI 3.1 stubs or tRPC router types)
6. É/C: pairing — present to user before Build entry

## Input
- dor.md, intent_set, risk_class

## Output
- ADR files, C4 Mermaid, STRIDE table (É/C), API contracts

## Evidence produced
- .planning/conception/adr-<slug>.md (one per decision)
- .planning/conception/c4-context.md
- .planning/conception/api-contracts.ts | .yaml
```

---

### 3.4 `build-inner-loop` — Cycle 04

**Purpose**: Manage the TDD RED→GREEN→REFACTOR inner loop with Tidy First S/B commit
discipline, CI quality gates, and conventional commits.

**SKILL.md draft**

```markdown
# build-inner-loop

## Description
TDD loop (RED/GREEN/REFACTOR) + Tidy First S/B + CI gates + conventional commits.
AUTO-INVOKE: cycle 04-Build. Applies to F/M/É/C (T = bypass, inline edit only).

OWNS: TDD loop management, S/B commit discipline, CI gate enforcement
NE GÈRE PAS: test strategy selection, architecture, deployment

## Trigger
Keywords: build, tdd, implement, code, red/green
Cycle: 04-Build

## Steps
1. RED: write failing test first (test-engineer agent for É/C)
2. Verify test fails for the right reason (not syntax error)
3. GREEN: write minimum code to pass
4. REFACTOR: clean without behavior change (Tidy First S)
5. Commit: S commits (refactor:) and B commits (feat:/fix:) never mixed
6. CI gates: lint → SAST → SCA → tests → coverage (never skip without waiver)
7. Repeat per EF from dor.md until all ACs green

## Input
- dor.md (EF + AC list), ADR files, risk_class

## Output
- Passing tests, clean commits
- CI gate evidence (green run URL or local output)

## Evidence produced
- .planning/build/ci-gate-evidence.md
- Conventional commit log
```

---

### 3.5 `validation-report` — Cycle 05

**Purpose**: Produce a Go/No-Go/Go-with-reservations validation report based on
risk-based testing matrix and ENF thresholds from the DoR.

**SKILL.md draft**

```markdown
# validation-report

## Description
Risk-based validation: produce Go/No-Go/Go-with-reservations report.
AUTO-INVOKE: cycle 05-Validation for M/É/C.

OWNS: validation report, risk-based testing matrix, Go/No-Go verdict
NE GÈRE PAS: bug fixing, release planning, deployment

## Trigger
Keywords: validation, test report, go/no-go, qa
Cycle: 05-Validation

## Steps
1. Load ENF thresholds from dor.md
2. Build risk-based testing matrix (EF × risk → test type: unit/integ/e2e/perf/security)
3. Run or reference CI evidence for each matrix cell
4. Check ENF thresholds: latency p95, coverage %, bundle size
5. Verdict: Go (all thresholds met) | No-Go (blocker found) | Go-with-reservations (minor gaps + mitigation)
6. Write validation-report.md
7. É/C: pairing — present report to user before Release entry

## Input
- dor.md (ENF), CI evidence, build-inner-loop output

## Output
- validation-report.md (verdict + matrix + evidence)

## Evidence produced
- .planning/validation/validation-report.md
```

---

### 3.6 `release-plan` — Cycle 06

**Purpose**: Produce a release plan: SemVer bump, deployment strategy, rollback plan,
smoke tests, feature flags, post-deploy monitoring window.

**SKILL.md draft**

```markdown
# release-plan

## Description
Produce release plan: SemVer, strategy (canary/rolling/blue-green), rollback, smoke tests.
AUTO-INVOKE: cycle 06-Release for M/É/C.

OWNS: SemVer bump, deployment strategy, rollback plan, smoke test list, feature flags
NE GÈRE PAS: CI pipeline config, infra provisioning, monitoring dashboards

## Trigger
Keywords: release, deploy, rollout, semver, canary
Cycle: 06-Release

## Steps
1. Determine SemVer bump from commit log (breaking → major, feat → minor, fix → patch)
2. Select deployment strategy: T/F → direct, M → rolling, É/C → canary or blue-green
3. Define rollback trigger (error rate threshold, latency spike)
4. List smoke tests (3–5 critical paths to verify post-deploy)
5. Identify feature flags needed for É/C
6. Set monitoring window: T/F = 1h, M = 4h, É = 24h, C = 72h
7. Write release-plan.md
8. É/C: stakeholder sign-off line before deploy

## Input
- validation-report.md, risk_class, commit log

## Output
- release-plan.md (SemVer, strategy, rollback, smoke tests)

## Evidence produced
- .planning/release/release-plan.md
```

---

### 3.7 `run-monitor` — Cycle 07

**Purpose**: Check SLO/SLI health using Four Golden Signals, error budget burn rate,
and multi-burn-rate alerting. Trigger OODA loop on anomaly.

**SKILL.md draft**

```markdown
# run-monitor

## Description
SLO/SLI health check. Four Golden Signals + error budget + OODA loop trigger.
AUTO-INVOKE: cycle 07-Run. Also fires on "alert", "slo breach", "error budget".

OWNS: SLO/SLI report, burn rate analysis, OODA loop trigger, anomaly escalation
NE GÈRE PAS: infra config, incident resolution implementation, deployment

## Trigger
Keywords: run, monitor, slo, alert, error budget, golden signals
Cycle: 07-Run, also cross-cycle on alert keywords

## Steps
1. Read SLO targets from .planning/run/slo-targets.yaml
2. Collect Four Golden Signals: latency, traffic, errors, saturation
3. Compute error budget remaining and burn rate
4. Multi-burn-rate alert check (fast burn = p1, slow burn = p2)
5. If anomaly: OODA loop — Observe (data) → Orient (context) → Decide (action) → Act
6. Write run-monitor-snapshot.md (signals, budget, verdict, action)

## Input
- SLO targets, observability data (or proxy metrics)

## Output
- run-monitor-snapshot.md

## Evidence produced
- .planning/run/run-monitor-snapshot.md
```

---

### 3.8 `apprentissage-retro` — Cycle 08

**Purpose**: Run a structured retrospective using PDCA/Kaizen + Kolb cycle, produce
harness delta (rule changes to propagate), and archive DORA metrics.

**SKILL.md draft**

```markdown
# apprentissage-retro

## Description
Retrospective: PDCA/Kaizen + Kolb cycle. Harness delta + DORA archive.
AUTO-INVOKE: cycle 08-Apprentissage — end of every M/É/C intent.

OWNS: retrospective facilitation, harness delta, DORA metrics archive
NE GÈRE PAS: next intent planning, backlog grooming, release

## Trigger
Keywords: retro, retrospective, learning, kaizen, pdca, dora
Cycle: 08-Apprentissage

## Steps
1. Kolb cycle: Concrete Experience → Reflective Observation → Abstract Conceptualization → Active Experimentation
2. PDCA: Plan (what we intended) → Do (what happened) → Check (delta) → Act (harness change)
3. Identify harness delta: new rules, updated skills, new patterns
4. Archive DORA metrics: deployment frequency, lead time, MTTR, change failure rate
5. Apply double-loop learning: question assumptions, not just outcomes
6. Write retro.md + harness-delta.md
7. Propagate harness delta to rules/ or skills/ (main thread only — never sub-agent)

## Input
- Full cycle evidence set, pipeline.yaml timeline

## Output
- retro.md, harness-delta.md, DORA archive row

## Evidence produced
- .planning/apprentissage/retro.md
- .planning/apprentissage/harness-delta.md
- .planning/apprentissage/dora-archive.csv (append row)
```

---

## 4. SKILL.md Standard Template

Every skill file must conform to this structure. Deviation blocks harness registration.

```markdown
# <skill-name>

## Description
One-paragraph description of what the skill does and when it fires.
AUTO-INVOKE: <trigger condition>

OWNS: <comma-separated list of responsibilities>
NE GÈRE PAS: <explicit out-of-scope list>

## Trigger
Keywords: <comma-separated keyword list>
Auto: yes|no — <when auto fires>
Cycle: <cycle name(s) or "All">

## Steps
1. <imperative step>
2. <imperative step>
…

## Input
- <field>: <type and description>

## Output
- <field>: <type and description>
- Evidence: <artifact path or "none">

## Evidence produced
- <path> (<description>)
- <path> (<description — optional>)
```

**Validation rules**

- `OWNS` and `NE GÈRE PAS` are mandatory — harness routing uses them for boundary checks
- `Evidence produced` must be non-empty for all skills except `status` (read-only)
- Step count: minimum 3, maximum 12 — split skill if >12 steps
- Trigger keywords must be unique across skills (no two skills claim the same keyword)
- File naming: `<skill-name>/SKILL.md` under `artifacts/skills/` in the monorepo

---

## 5. Skill Portability Notes

All 12 skills are Tier 1 portable: same SKILL.md content, different install paths.
Platform adapters handle path resolution — the skill author writes once.

### 5.1 Claude Code (`adapter-claude/`)

```
~/.claude/skills/<skill-name>/SKILL.md
```

- Skills loaded by `session_start` hook via `harness skill register`
- `CLAUDE.md` at project root references `@skills/<skill-name>` for inline loading
- Trigger detection via `rules/skills.md` AUTO-INVOKE routing table
- Hook events: `pre_tool_use`, `post_tool_use`, `session_start`, `stop`

### 5.2 Codex (`adapter-codex/`)

```
~/.codex/skills/<skill-name>/SKILL.md
```

- Skills registered in `~/.codex/agents/` as agent stubs that delegate to SKILL.md
- Trigger detection via Codex instruction routing
- Same hook surface via Codex lifecycle events

### 5.3 Hermes (`adapter-hermes/`)

```
~/.hermes/skills/<skill-name>/SKILL.md
```

- Hermes skill registry loaded at session init
- Same SKILL.md format, Hermes-specific front matter may be appended as YAML block
- Trigger keywords mapped to Hermes intent router

### 5.4 Monorepo source of truth

```
packages/artifacts/skills/
├── classify-risk/SKILL.md
├── propose-change/SKILL.md
├── transition-phase/SKILL.md
├── status/SKILL.md
├── discovery-validate/SKILL.md
├── cadrage-dor/SKILL.md
├── conception-adr/SKILL.md
├── build-inner-loop/SKILL.md
├── validation-report/SKILL.md
├── release-plan/SKILL.md
├── run-monitor/SKILL.md
└── apprentissage-retro/SKILL.md
```

Install scripts per adapter symlink or copy from this source. Never edit adapter copies
directly — always edit the monorepo source and re-run `harness skill sync`.

---

## 6. Skill × Risk Class Matrix

Legend: **M** = Mandatory (required, blocks cycle exit if absent) | **O** = Optional (adds value, not blocking) | **–** = Skipped (risk too low, not invoked)

| Skill | T | F | M | É | C |
|-------|---|---|---|---|---|
| `classify-risk` | M | M | M | M | M |
| `propose-change` | M | M | M | M | M |
| `transition-phase` | – | – | M | M | M |
| `status` | M | M | M | M | M |
| `discovery-validate` | – | – | M | M | M |
| `cadrage-dor` | – | – | M | M | M |
| `conception-adr` | – | – | M | M | M |
| `build-inner-loop` | – | M | M | M | M |
| `validation-report` | – | – | M | M | M |
| `release-plan` | – | – | O | M | M |
| `run-monitor` | O | O | M | M | M |
| `apprentissage-retro` | – | O | M | M | M |

**Notes**:
- `transition-phase` is skipped for T/F: auto-advance with no gate check
- `build-inner-loop` is M for F: lightweight TDD still applies (no test-engineer agent, self-sufficient)
- `release-plan` is O for M: recommended but not blocking if deploy is trivial (single-file, zero infra)
- `run-monitor` is O for T/F: anomaly monitoring is valuable but not cycle-blocking
- `apprentissage-retro` is O for F: encouraged, not required (full retro reserved for M+)
- `discovery-validate`, `cadrage-dor`, `conception-adr`, `validation-report` are all hard-skipped for T/F — overhead exceeds value

**Full pipeline path by risk**

| Risk | Active skills |
|------|--------------|
| T | classify-risk → propose-change → status (+ run-monitor optional) |
| F | classify-risk → propose-change → build-inner-loop → status (+ run-monitor, retro optional) |
| M | Full 12-skill pipeline. release-plan optional. |
| É | Full 12-skill pipeline. Pairing mode on classify-risk, propose-change, discovery-validate, conception-adr, validation-report, release-plan. |
| C | Full 12-skill pipeline. Pairing mode everywhere. Stakeholder sign-off tokens required at conception-adr and release-plan. |
