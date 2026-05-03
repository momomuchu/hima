# Hima Documentation — Master Index

> **Generated**: 2026-05-03
> **Scope**: All documentation across `hima/docs/`, `harness-architecture/docs/`, `.planning/external-harness-research/`, and `hima/.planning/loop/audit/`
> **Total files indexed**: 99 documents + 13 audit trails
> **Total lines**: ~63,000 (docs) + ~3,000 (audits)

---

## Reading Order for Newcomers

1. **Start here** -- `hima/docs/decisions/0001-project-identity.md` (35 lines) -- project name and repo identity
2. **Vision** -- `hima/docs/research-reports/rapport-discovery-cadrage.md` (579 lines) -- Discovery/Cadrage consolidated report
3. **Checkpoint** -- `hima/docs/research-reports/checkpoint-implementation.md` (710 lines) -- end of Discovery, beginning of Conception
4. **Cycle overview** -- `hima/docs/cycles/01-discovery/concepts-criteria.md` through `08-apprentissage` -- the 8-cycle model
5. **Transversal pillars** -- `hima/docs/transversal/` -- risk, quality, state machine, cross-cutting activities
6. **Sub-cycle fractal** -- `hima/docs/sub-cycle-fractal/seven-steps.md` -- the 7-step universal sub-cycle
7. **Architecture** -- `harness-architecture/docs/architecture/ARCHITECTURE.md` (1458 lines) -- single source of truth
8. **Conception specs** -- `hima/docs/conception/01-*.md` through `10-*.md` -- implementation-ready specifications
9. **Business model** -- `hima/docs/business-model/business-model-proposal.md` then the decision file
10. **Open questions** -- `hima/docs/conception/open-questions/` -- unresolved design decisions

---

## 1. Architecture

| # | Path (relative to Pipeline/) | Lines | Status | Description |
|---|------------------------------|-------|--------|-------------|
| 1 | `harness-architecture/docs/architecture/ARCHITECTURE.md` | 1458 | COMPLETE | Single source of truth for system architecture: RMS kernel, 8 canonical sets, state machine, runtime bindings, gates, CLI, API |
| 2 | `harness-architecture/docs/propositions/pipeline-fractal-v4-final-proposal/architecture-audit.md` | 259 | COMPLETE | Coverage audit of ARCHITECTURE.md vs 10 conception specs, score 41/100 with identified gaps |
| 3 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/08-architecture-generale.md` | 881 | HISTORICAL | Architecture synthesis doc (superseded by ARCHITECTURE.md) |
| 4 | `hima/docs/transversal/harness-state-machine.md` | 1022 | COMPLETE | Transversal state machine governing the entire Pipeline Fractale v4 |
| 5 | `hima/docs/propositions/pipeline-fractal-v4-state-machine-v1-draft.md` | 286 | HISTORICAL | Monolithic V1 draft of state machine spec (superseded by V2 folder) |

---

## 2. Conception Specs (01-10)

| # | Path (relative to Pipeline/) | Lines | Status | Description |
|---|------------------------------|-------|--------|-------------|
| 6 | `hima/docs/conception/01-state-machine-spec.md` | 1041 | COMPLETE | State machine formal spec, implementation-ready, resolves Q2+Q7 from Discovery |
| 7 | `hima/docs/conception/02-risk-classifier-spec.md` | 777 | COMPLETE | Risk classifier pivot component: changeset metadata -> T/F/M/E/C class + mandatory path |
| 8 | `hima/docs/conception/03-rms-sets-schema.md` | 2066 | COMPLETE | TypeScript interfaces + JSON Schema for all 8 canonical RMS sets |
| 9 | `hima/docs/conception/04-runtime-bindings-spec.md` | 758 | COMPLETE | Runtime binding layer for Claude Code, Codex, Hermes Agent |
| 10 | `hima/docs/conception/05-gates-policy-spec.md` | 1089 | COMPLETE | Gates and policy specification across all platforms and risk classes |
| 11 | `hima/docs/conception/06-skills-catalog-spec.md` | 811 | DRAFT | Skills inventory and catalog for Pipeline Fractale v4 |
| 12 | `hima/docs/conception/07-subagents-catalog-spec.md` | 857 | COMPLETE | Exhaustive subagent definitions, interfaces, platform formats, evidence integration |
| 13 | `hima/docs/conception/08-planning-state-schema.md` | 610 | COMPLETE | `.planning/state/` file schema and YAML/JSONL layout |
| 14 | `hima/docs/conception/09-cli-commands-spec.md` | 798 | COMPLETE | CLI commands spec for `@harness/cli`, single binary entry point |
| 15 | `hima/docs/conception/10-core-api-spec.md` | 1004 | COMPLETE | `@harness/core` API contract: 5 modules, stable before implementation |

---

## 3. Cycle Docs

| # | Path (relative to Pipeline/) | Lines | Status | Description |
|---|------------------------------|-------|--------|-------------|
| 16 | `hima/docs/cycles/01-discovery/concepts-criteria.md` | 986 | COMPLETE | Discovery cycle: problem space exploration, stakeholder identification |
| 17 | `hima/docs/cycles/02-cadrage/concepts-criteria.md` | 734 | COMPLETE | Cadrage cycle: scope definition, constraints, feasibility |
| 18 | `hima/docs/cycles/03-conception/concepts-criteria.md` | 1261 | COMPLETE | Conception cycle: design decisions, architecture selection |
| 19 | `hima/docs/cycles/04-build/concepts-criteria.md` | 939 | COMPLETE | Build cycle: implementation, TDD, integration |
| 20 | `hima/docs/cycles/05-validation/concepts-criteria.md` | 1144 | COMPLETE | Validation cycle: testing, verification, acceptance |
| 21 | `hima/docs/cycles/06-release/concepts-criteria.md` | 1027 | COMPLETE | Release cycle: deployment, rollout, feature flags |
| 22 | `hima/docs/cycles/07-run/concepts-criteria.md` | 838 | COMPLETE | Run cycle: monitoring, incident response, observability |
| 23 | `hima/docs/cycles/08-apprentissage/concepts-criteria.md` | 851 | COMPLETE | Apprentissage cycle: retrospective, knowledge capture, improvement |
| 24 | `harness-architecture/docs/cycles/04-build/concepts-criteria.md` | 844 | COMPLETE | Build cycle (harness-architecture copy, may differ from hima version) |

---

## 4. Transversal

| # | Path (relative to Pipeline/) | Lines | Status | Description |
|---|------------------------------|-------|--------|-------------|
| 25 | `hima/docs/transversal/risk-classification.md` | 1096 | COMPLETE | Risk classification pivot (T/F/M/E/C), v2 with audit GAP-1 to GAP-5 fixes |
| 26 | `hima/docs/transversal/quality-model.md` | 1200 | COMPLETE | Universal quality model reference for all 8 cycles |
| 27 | `hima/docs/transversal/cross-cutting-activities.md` | 1149 | COMPLETE | Cross-cutting activities architecture spanning all 8 cycles |
| 28 | `hima/docs/transversal/harness-state-machine.md` | 1022 | COMPLETE | State machine governing the Pipeline Fractale v4 (also listed in Architecture) |
| 29 | `hima/docs/sub-cycle-fractal/seven-steps.md` | 1171 | COMPLETE | 7-step universal sub-cycle: Observer-Definir-Concevoir-Executer-Verifier-Capitaliser-Transmettre |
| 30 | `harness-architecture/docs/transversal/cross-cutting-activities.md` | 785 | COMPLETE | Cross-cutting activities (harness-architecture copy) |

---

## 5. Business Model

### 5a. Research Reports (R01-R10)

| # | Path (relative to Pipeline/) | Lines | Status | Description |
|---|------------------------------|-------|--------|-------------|
| 31 | `hima/docs/business-model/research-01-open-core-models.md` | 616 | COMPLETE | Open-core business model patterns and case studies |
| 32 | `hima/docs/business-model/research-02-ai-tools-pricing.md` | 745 | COMPLETE | AI developer tools pricing landscape |
| 33 | `hima/docs/business-model/research-03-plg-gtm.md` | 595 | COMPLETE | Product-Led Growth and Go-To-Market strategies |
| 34 | `hima/docs/business-model/research-04-marketplace-economics.md` | 503 | COMPLETE | Marketplace economics for plugin/skill ecosystems |
| 35 | `hima/docs/business-model/research-05-competitive-landscape.md` | 747 | COMPLETE | Competitive landscape analysis |
| 36 | `hima/docs/business-model/research-06-enterprise-features.md` | 459 | COMPLETE | Enterprise feature requirements and expectations |
| 37 | `hima/docs/business-model/research-07-licensing.md` | 520 | COMPLETE | Licensing models comparison (AGPL, MIT, BSL, etc.) |
| 38 | `hima/docs/business-model/research-08-pricing-psychology.md` | 682 | COMPLETE | Pricing psychology and behavioral economics |
| 39 | `hima/docs/business-model/research-09-ai-governance-market.md` | 343 | COMPLETE | AI governance market trends |
| 40 | `hima/docs/business-model/research-10-community-ecosystem.md` | 454 | COMPLETE | Community and ecosystem building strategies |

### 5b. Verifications

| # | Path (relative to Pipeline/) | Lines | Status | Description |
|---|------------------------------|-------|--------|-------------|
| 41 | `hima/docs/business-model/verification-01-lifetime-pricing.md` | 325 | COMPLETE | Lifetime pricing model verification and analysis |
| 42 | `hima/docs/business-model/verification-02-competitive-matrix.md` | 426 | COMPLETE | Competitive matrix verification against market data |
| 43 | `hima/docs/business-model/verification-03-risk-depth-gating.md` | 339 | COMPLETE | Risk-depth gating model verification (18 web searches, 14 sources) |

### 5c. Decisions

| # | Path (relative to Pipeline/) | Lines | Status | Description |
|---|------------------------------|-------|--------|-------------|
| 44 | `hima/docs/business-model/business-model-proposal.md` | 799 | COMPLETE | Full business model proposal synthesizing R01-R10 + specs 06/07/09 |
| 45 | `hima/docs/business-model/decision-2026-05-03-mit-core-cloud-enterprise.md` | 59 | COMPLETE | Accepted decision: MIT core + cloud/enterprise monetization |
| 46 | `hima/docs/business-model/license-propagation-log.md` | 82 | COMPLETE | Log of AGPL-to-MIT license propagation across docs |

---

## 6. Propositions

### 6a. Pipeline Fractale V4 — State Machine V2

| # | Path (relative to Pipeline/) | Lines | Status | Description |
|---|------------------------------|-------|--------|-------------|
| 47 | `hima/docs/propositions/pipeline-fractal-v4-state-machine/README.md` | 85 | COMPLETE | V2 index: replaces monolithic V1, P0 decisions pending |
| 48 | `hima/docs/propositions/pipeline-fractal-v4-state-machine/00-work-breakdown.md` | 53 | COMPLETE | Work breakdown structure for V2 state machine |
| 49 | `hima/docs/propositions/pipeline-fractal-v4-state-machine/01-state-model.md` | 318 | COMPLETE | Core state model definition |
| 50 | `hima/docs/propositions/pipeline-fractal-v4-state-machine/02-cycle-specific-substates.md` | 201 | COMPLETE | Per-cycle substates (replacing flat V1 model) |
| 51 | `hima/docs/propositions/pipeline-fractal-v4-state-machine/03-meta-states-and-modes.md` | 252 | COMPLETE | Meta-states and 3 supervision modes |
| 52 | `hima/docs/propositions/pipeline-fractal-v4-state-machine/04-guard-matrix.md` | 256 | COMPLETE | Guard conditions matrix for state transitions |
| 53 | `hima/docs/propositions/pipeline-fractal-v4-state-machine/05-convergence-model.md` | 511 | COMPLETE | Convergence model (beyond simple max iterations) |
| 54 | `hima/docs/propositions/pipeline-fractal-v4-state-machine/06-open-decisions.md` | 312 | COMPLETE | P0 open decisions to resolve before implementation |
| 55 | `hima/docs/propositions/pipeline-fractal-v4-state-machine/07-architecture-critique.md` | 74 | COMPLETE | Architecture self-critique |
| 56 | `hima/docs/propositions/pipeline-fractal-v4-state-machine/08-transition-catalog.md` | 238 | COMPLETE | Full catalog of allowed state transitions |
| 57 | `hima/docs/propositions/pipeline-fractal-v4-state-machine/09-validation-checklist.md` | 208 | COMPLETE | Validation checklist for the state machine design |
| 58 | `hima/docs/propositions/pipeline-fractal-v4-state-machine/10-critical-review.md` | 344 | COMPLETE | Critical review and remaining risks |

### 6b. Pipeline Fractale V4 — Final Proposal (Cycles 01-04)

| # | Path (relative to Pipeline/) | Lines | Status | Description |
|---|------------------------------|-------|--------|-------------|
| 59 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/README.md` | 111 | COMPLETE | Final proposal workbench index: 5 runtime surfaces |
| 60 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/00-cycle-protocol.md` | 85 | COMPLETE | Autonomous design cycle protocol |
| 61 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/01-three-convergent-architectures.md` | 203 | COMPLETE | Three convergent architecture candidates |
| 62 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/02-edge-case-red-team.md` | 26 | COMPLETE | Edge case and red team analysis |
| 63 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/03-skills-subagents-books-taxonomy.md` | 243 | COMPLETE | Taxonomy of skills, subagents, and knowledge books |
| 64 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/04-single-mcp-state-kernel.md` | 309 | COMPLETE | Single MCP state kernel proposal |
| 65 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/05-convergence-validation-cycle.md` | 330 | COMPLETE | Convergence and validation cycle design |
| 66 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/06-integrated-final-proposal.md` | 251 | COMPLETE | Integrated final proposal synthesis |
| 67 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/07-decision-matrix.md` | 133 | COMPLETE | Decision matrix for architecture selection |

### 6b-ii. Cycle 02

| # | Path (relative to Pipeline/) | Lines | Status | Description |
|---|------------------------------|-------|--------|-------------|
| 68 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/cycle-02/00-cycle-02-brief.md` | 65 | COMPLETE | Cycle 02 brief and objectives |
| 69 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/cycle-02/01-discovery-gap-audit.md` | 197 | COMPLETE | Gap audit from Cycle 01 |
| 70 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/cycle-02/02-planning-implementation-roadmap.md` | 530 | COMPLETE | Planning and implementation roadmap |
| 71 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/cycle-02/03-mcp-tool-contracts.md` | 1231 | COMPLETE | MCP tool contract definitions |
| 72 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/cycle-02/04-registry-storage-layout.md` | 645 | COMPLETE | Registry and storage layout design |
| 73 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/cycle-02/05-verification-fixtures.md` | 996 | COMPLETE | Verification fixtures and test data |
| 74 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/cycle-02/06-audit-red-team.md` | 299 | COMPLETE | Red team audit for Cycle 02 |
| 75 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/cycle-02/07-cycle-02-integration.md` | 187 | COMPLETE | Integration summary for Cycle 02 |

### 6b-iii. Cycle 03

| # | Path (relative to Pipeline/) | Lines | Status | Description |
|---|------------------------------|-------|--------|-------------|
| 76 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/cycle-03/00-cycle-03-brief.md` | 56 | COMPLETE | Cycle 03 brief |
| 77 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/cycle-03/01-supersession-and-decision-delta.md` | 235 | COMPLETE | Supersession tracking and decision delta from prior cycles |
| 78 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/cycle-03/02-guard-merge-lattice.md` | 648 | COMPLETE | Guard merge lattice formal model |
| 79 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/cycle-03/03-evidence-requirements-freshness.md` | 905 | COMPLETE | Evidence requirements and freshness constraints |
| 80 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/cycle-03/04-risk-runtime-degradation.md` | 763 | COMPLETE | Risk and runtime degradation analysis |
| 81 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/cycle-03/05-artifact-human-candidate-evidence.md` | 862 | COMPLETE | Artifact, human, and candidate evidence collection |
| 82 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/cycle-03/06-cycle-03-audit.md` | 255 | COMPLETE | Cycle 03 self-audit |
| 83 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/cycle-03/07-cycle-03-integration.md` | 118 | COMPLETE | Integration summary for Cycle 03 |

### 6b-iv. Cycle 04

| # | Path (relative to Pipeline/) | Lines | Status | Description |
|---|------------------------------|-------|--------|-------------|
| 84 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/cycle-04/00-cycle-04-brief.md` | 63 | COMPLETE | Cycle 04 brief |
| 85 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/cycle-04/01-convergence-policy-thresholds.md` | 1018 | COMPLETE | Convergence policy and threshold definitions |
| 86 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/cycle-04/02-territory-enforcement-contract.md` | 803 | COMPLETE | Territory enforcement contract between agents |
| 87 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/cycle-04/03-storage-recovery-contract.md` | 660 | COMPLETE | Storage recovery contract and crash resilience |
| 88 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/cycle-04/04-closing-transaction-reopen.md` | 1118 | COMPLETE | Close-run transaction and reopen protocol |
| 89 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/cycle-04/05-cycle-04-audit.md` | 362 | COMPLETE | Cycle 04 self-audit |
| 90 | `hima/docs/propositions/pipeline-fractal-v4-final-proposal/cycle-04/06-cycle-04-integration.md` | 189 | COMPLETE | Integration summary for Cycle 04 |

### 6c. Pipeline Fractale V4 — Specs (Hooks-First)

| # | Path (relative to Pipeline/) | Lines | Status | Description |
|---|------------------------------|-------|--------|-------------|
| 91 | `hima/docs/propositions/pipeline-fractal-v4-specs/README.md` | 87 | COMPLETE | Specs workbench index: hooks-first specification phase |
| 92 | `hima/docs/propositions/pipeline-fractal-v4-specs/0001-hooks-first-runtime-binding-layer.spec.md` | 359 | COMPLETE | Hooks-first runtime binding layer specification |
| 93 | `hima/docs/propositions/pipeline-fractal-v4-specs/0002-runtime-probe-and-freshness.spec.md` | 185 | COMPLETE | Runtime probe and freshness detection spec |
| 94 | `hima/docs/propositions/pipeline-fractal-v4-specs/0003-pre-action-target-expansion.spec.md` | 110 | COMPLETE | Pre-action target expansion spec |
| 95 | `hima/docs/propositions/pipeline-fractal-v4-specs/0004-hook-adapter-matrix.spec.md` | 159 | COMPLETE | Hook adapter matrix per platform |

### 6d. Standalone Propositions

| # | Path (relative to Pipeline/) | Lines | Status | Description |
|---|------------------------------|-------|--------|-------------|
| 96 | `hima/docs/propositions/rms-runtime-sets-v1-draft.md` | 503 | HISTORICAL | RMS v1 draft: Runtime Management System and control sets |
| 97 | `hima/docs/propositions/provider-portability-mapping-convergence.md` | 568 | COMPLETE | Portable RMS mapping across Claude Code, Codex, Hermes (v1) |
| 98 | `hima/docs/propositions/provider-portability-mapping-convergence-v2.md` | 695 | COMPLETE | Provider portability mapping v2 with convergence research |

---

## 7. Research

### 7a. Source Research Reports

| # | Path (relative to Pipeline/) | Lines | Status | Description |
|---|------------------------------|-------|--------|-------------|
| 99 | `hima/docs/research-reports/rapport-discovery-cadrage.md` | 579 | COMPLETE | Consolidated Discovery+Cadrage report, current truth of early phases |
| 100 | `hima/docs/research-reports/checkpoint-implementation.md` | 710 | COMPLETE | Checkpoint: exit Discovery/Cadrage, enter Conception. Key transmission doc |
| 101 | `hima/docs/research-reports/compass_artifact_wf-*.md` | 997 | COMPLETE | Quality-driven dev cycle v3: universal reference (solo+team, with or without AI) |
| 102 | `hima/docs/research-reports/r1.md` | 884 | COMPLETE | Phase 0 exhaustive clarification before development |
| 103 | `hima/docs/research-reports/folder.md` | 916 | COMPLETE | Planning architecture: registers + sprint snapshots + quality evidence |
| 104 | `hima/docs/research-reports/report-hermes-cdx-cld.md` | 328 | COMPLETE | Platform comparison report: Claude Code vs Codex vs Hermes Agent (May 2026) |
| 105 | `hima/docs/research-reports/openquestion.md` | 603 | COMPLETE | Open questions catalog for Conception/Implementation phase |

### 7b. External Harness Research

| # | Path (relative to Pipeline/) | Lines | Status | Description |
|---|------------------------------|-------|--------|-------------|
| 106 | `.planning/external-harness-research/SYNTHESIS.md` | 186 | COMPLETE | Cross-repo audit of 11 agentic codebases for harness patterns |
| 107 | `.planning/external-harness-research/clones/oh-my-openagent/` | -- | RAW CLONE | Full git clone of oh-my-openagent (multi-agent orchestration framework) |

---

## 8. Open Questions

| # | Path (relative to Pipeline/) | Lines | Status | Description |
|---|------------------------------|-------|--------|-------------|
| 108 | `hima/docs/conception/open-questions/oq-01-state-machine.md` | 130 | DRAFT | State machine open questions |
| 109 | `hima/docs/conception/open-questions/oq-02-risk.md` | 161 | DRAFT | Risk classification open questions |
| 110 | `hima/docs/conception/open-questions/oq-03-04-modes-hooks.md` | 293 | DRAFT | Modes and hooks open questions |
| 111 | `hima/docs/conception/open-questions/oq-05-06-skills-mcp.md` | 246 | DRAFT | Skills and MCP open questions |
| 112 | `hima/docs/conception/open-questions/oq-07-architecture.md` | 193 | DRAFT | Architecture open questions |
| 113 | `hima/docs/conception/open-questions/oq-08-09-distrib-planning.md` | 298 | DRAFT | Distribution and planning open questions |
| 114 | `hima/docs/conception/open-questions/oq-10-11-logging-security.md` | 407 | DRAFT | Logging and security open questions |
| 115 | `hima/docs/conception/open-questions/oq-12-15-multiplatform-edge.md` | 256 | DRAFT | Multiplatform and edge case open questions |
| 116 | `hima/docs/conception/open-questions/oq-13-14-16-lifecycle-perf.md` | 319 | DRAFT | Lifecycle and performance open questions |
| 117 | `hima/docs/conception/open-questions/oq-17-18-19-20-dx-tests-future.md` | 480 | DRAFT | DX, testing, and future direction open questions |

---

## 9. Audit Trail

Located in `hima/.planning/loop/audit/`. These are auto-generated audit reports from the conception loop.

| # | Path (relative to Pipeline/) | Lines | Status | Description |
|---|------------------------------|-------|--------|-------------|
| 118 | `hima/.planning/loop/audit/01-discovery.audit.md` | 254 | COMPLETE | Audit of Discovery cycle concepts-criteria |
| 119 | `hima/.planning/loop/audit/02-cadrage.audit.md` | 236 | COMPLETE | Audit of Cadrage cycle concepts-criteria |
| 120 | `hima/.planning/loop/audit/03-conception.audit.md` | 236 | COMPLETE | Audit of Conception cycle concepts-criteria |
| 121 | `hima/.planning/loop/audit/04-build.audit.md` | 301 | COMPLETE | Audit of Build cycle concepts-criteria |
| 122 | `hima/.planning/loop/audit/05-validation.audit.md` | 216 | COMPLETE | Audit of Validation cycle concepts-criteria |
| 123 | `hima/.planning/loop/audit/06-release.audit.md` | 214 | COMPLETE | Audit of Release cycle concepts-criteria |
| 124 | `hima/.planning/loop/audit/07-run.audit.md` | 226 | COMPLETE | Audit of Run cycle concepts-criteria |
| 125 | `hima/.planning/loop/audit/08-apprentissage.audit.md` | 283 | COMPLETE | Audit of Apprentissage cycle concepts-criteria |
| 126 | `hima/.planning/loop/audit/risk-classification.audit.md` | 255 | COMPLETE | Audit of risk classification transversal doc |
| 127 | `hima/.planning/loop/audit/quality-model.audit.md` | 191 | COMPLETE | Audit of quality model transversal doc |
| 128 | `hima/.planning/loop/audit/seven-steps.audit.md` | 171 | COMPLETE | Audit of seven-steps sub-cycle fractal doc |
| 129 | `hima/.planning/loop/audit/cross-cutting-activities.audit.md` | 195 | COMPLETE | Audit of cross-cutting activities transversal doc |
| 130 | `hima/.planning/loop/audit/harness-state-machine.audit.md` | 180 | COMPLETE | Audit of harness state machine transversal doc |

---

## 10. Decisions

| # | Path (relative to Pipeline/) | Lines | Status | Description |
|---|------------------------------|-------|--------|-------------|
| 131 | `hima/docs/decisions/0001-project-identity.md` | 35 | COMPLETE | ADR: project name is `hima`, repo is private-first |

---

## 11. Other Indexes

| # | Path (relative to Pipeline/) | Lines | Status | Description |
|---|------------------------------|-------|--------|-------------|
| 132 | `harness-architecture/docs/INDEX.md` | 155 | HISTORICAL | Previous master index (harness-architecture scope only, now superseded by this file) |

---

## Gaps: Referenced but Missing Files

| Referenced As | Referenced From | Status |
|---------------|-----------------|--------|
| `hima/docs/cycles/04-build/concepts-criteria.md` vs `harness-architecture/docs/cycles/04-build/concepts-criteria.md` | Multiple specs | Two versions exist (939 vs 844 lines) -- need reconciliation |
| `hima/docs/transversal/cross-cutting-activities.md` vs `harness-architecture/docs/transversal/cross-cutting-activities.md` | Multiple specs | Two versions exist (1149 vs 785 lines) -- need reconciliation |
| `hima/docs/diagrams/` | Directory exists | Empty placeholder (.gitkeep only) -- no diagrams produced yet |
| `hima/docs/drafts/` | Directory exists | Empty placeholder (.gitkeep only) -- no drafts stored yet |
| `hima/docs/synthesis/` | Directory exists | Empty directory -- no synthesis documents produced yet |
| Conception specs 01-10 reference `checkpoint-implementation.md` in different relative paths | Specs 01-10 | Relative path references may break depending on working directory |
| ARCHITECTURE.md scores 41/100 in audit | `architecture-audit.md` | 6 contradictions (C1-C6) and 7 missing sections (M1-M7) remain unresolved |
| Open questions reference answers that may have been decided in propositions | oq-* files | No formal cross-link between OQ resolutions and proposition decisions |

---

## Statistics

| Category | Files | Total Lines |
|----------|-------|-------------|
| Architecture | 5 | 3,906 |
| Conception Specs | 10 | 9,811 |
| Cycle Docs | 9 | 8,624 |
| Transversal | 6 | 6,423 |
| Business Model | 16 | 7,694 |
| Propositions | 37 | 16,098 |
| Research Reports | 9 | 6,193 |
| Open Questions | 10 | 2,783 |
| Audit Trail | 13 | 2,958 |
| Decisions | 1 | 35 |
| Other Indexes | 1 | 155 |
| **Total** | **117** | **~64,680** |
