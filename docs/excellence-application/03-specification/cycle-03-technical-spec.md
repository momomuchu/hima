---
claim-bearing: true
status: SPEC_READY
date: 2026-05-14
cycle: cycle-03-specification-excellence-application
deliverable: C3-3
target-master-item: "docs/goals/COMPLETE-CONSTRUCTION-GOAL.md §11.3 C1"
adr: ".hima/state/conception/cycle-03-adr.md"
sdd-level: spec-anchored
risk-class: M
---

# Technical Spec — Stream C1 `packages/core` Bounded Contexts

## 1. Decision

Target the next implementation slice at **Stream C1**:

> Identify 6 bounded contexts in `packages/core/`: Run, Cycle, Gate, Skill, Subagent, Evidence.

This spec does not perform the DDD refactor. It defines the acceptance contract for the C1
context map that must exist before C2-C7 can safely change code structure.

ADR linkage: `.hima/state/conception/cycle-03-adr.md` (`ADR-CYCLE-03-C1`) records the
decision to target Stream C1 before further runtime hook or MCP work.

## 2. Why C1

Phase 0 runtime unblock work is already represented in the master plan as completed for the
DoR/DoD files, transition integration, hash ledger, events log, keyword registry, cascade
router, and SubagentStop deliverables gate. The next unchecked sequence in §11 is Stream C.
C1 is the first item in that stream and is a prerequisite for:

- C2: making `Run` the aggregate root for transitions.
- C3: extracting value objects.
- C4: emitting domain events in the right aggregate boundary.
- C5-C7: repository boundaries, always-valid invariant, and aggregate-style tests.

## 3. In Scope

- Produce a bounded-context map for `packages/core/src`.
- Name exactly six contexts: Run, Cycle, Gate, Skill, Subagent, Evidence.
- Map each current module to one owning context or an explicit shared-kernel/support role.
- Identify context boundaries, owned data, incoming commands, outgoing events, and forbidden ownership leaks.
- Produce migration notes for C2-C7 without editing implementation code.

## 4. Out of Scope

- No TypeScript refactor in C1.
- No new runtime hook behavior.
- No adapter work.
- No MCP tools.
- No schema/codegen redesign beyond mapping current schema ownership.
- No claim that the bounded-context map is final after implementation; later drift must update the map.

## 5. Current Module Inventory

| Current module | Proposed owner |
|---|---|
| `state-machine/`, `storage/planning-store.ts`, `storage/planning-paths.ts`, `services/request-transition.ts`, `services/enter-development.ts`, `services/close-run.ts`, `services/get-status.ts` | Run / Cycle split; C1 must decide exact ownership. |
| `gates/`, `policy/`, `governance/`, `services/handle-hook.ts` | Gate, with governance as a policy support module unless C1 proves it belongs to Cycle. |
| `evidence/`, `storage/events-log.ts`, `storage/hash-chained-ledger.ts`, `services/add-evidence.ts` | Evidence. |
| `catalogs/`, future skill install/resolution modules | Skill. |
| `schemas/run-set.schema.ts` subagent records and SubagentStart/SubagentStop gate behavior | Subagent, with Gate owning enforcement. |
| `runtime/`, `install/`, `security/`, `types/`, `schemas/common.ts` | Shared/support modules to classify explicitly; they must not become hidden contexts. |

## 6. Acceptance Rows

| ID | Acceptance condition | Evidence required |
|---|---|---|
| C1-AC-01 | The context map names the six required contexts and gives each a one-sentence responsibility. | `docs/excellence-application/05-architecture/core-bounded-context-map.md` or equivalent committed map. |
| C1-AC-02 | Every file under `packages/core/src` is assigned to exactly one owner context or to a named shared/support category with rationale. | Generated or manually audited file-to-context table. |
| C1-AC-03 | Run vs Cycle ownership is resolved: state snapshot, transition history, route, phase/subphase, and finalization each have a single owner. | Decision table in the context map. |
| C1-AC-04 | Gate vs Evidence ownership is resolved: gate decisions, missing evidence items, policy violations, accepted evidence records, event log, and ledger each have a single owner. | Decision table in the context map. |
| C1-AC-05 | Skill and Subagent contexts are not collapsed into Gate: discovery/routing/install concerns and delegated-work lifecycle concerns have explicit boundaries. | Boundary section with at least two forbidden-dependency examples. |
| C1-AC-06 | The map lists C2-C7 migration implications and identifies the first safe refactor step. | C2-C7 impact table. |
| C1-AC-07 | A critic review finds no material missing context, hidden seventh context, or ambiguous ownership that would block C2. | Saturation review artifact or status log entry. |

### Counterexamples

- A diagram that names six contexts but leaves files unmapped fails C1-AC-02.
- A map that assigns `run-set.schema.ts` wholesale to one context without splitting owned concepts fails C1-AC-03 through C1-AC-05.
- Passing the current test suite without a context map does not satisfy any acceptance row.

## 7. Evidence Plan

| Proof | Command or inspection |
|---|---|
| File inventory stays current | `rg --files packages/core/src` compared against the map. |
| Existing behavior remains stable while C1 is documentation-only | `corepack pnpm --filter @harness/core test -- --runInBand`. |
| Repository-wide policy remains clean | `corepack pnpm lint`. |
| Cadrage -> Conception governance can load DoD/DoR | `harness transition conception Observer` on a planning fixture whose current phase is `cadrage`. |
| Falsifies-If anchors resolve | `harness hook post_tool --dry-run` or focused gate test against the changed claim-bearing files. |

## 8. Cycle-03 Transition Proof

Cycle-03 ran a temporary planning fixture with current repo governance files copied into the
fixture. The proof command sequence was:

```powershell
node packages/cli/dist/index.js init --root <temp-root>
node packages/cli/dist/index.js transition cadrage Observer --root <temp-root>
node packages/cli/dist/index.js transition conception Observer --root <temp-root>
```

Observed result:

```text
LAST_EVENT_TYPE=STATE_TRANSITIONED
LAST_EVENT_FROM=cadrage
LAST_EVENT_TO=conception
GOVERNANCE_ALLOWED=True
GOVERNANCE_CHECKED=dod:cadrage:3,dor:conception:3
```

This proves the Cadrage -> Conception transition can load `docs/01-governance/dod-02-cadrage.md`
and `docs/01-governance/dor-03-conception.md` and persist a transition event. The durable proof
artifact is `docs/excellence-application/03-specification/transition-proof.md`. Evidence-anchor
resolution for the new claim-bearing artifacts was separately checked through `harness hook
post_tool --dry-run`; all cycle-03 claim-bearing artifacts returned `decision: allow`.

## 9. Implementation Handoff

Future C1 implementation must create the map first, then run the checklist in
`docs/excellence-application/03-specification/spec-discipline-checklist.md`.

Stop conditions:

- Any `packages/core/src` file cannot be assigned without inventing a seventh context.
- Run/Cycle/Gate/Evidence ownership cannot be separated without changing the master plan.
- C1 implementation discovers that a C2-C7 item should precede C1.
- A critic finds ambiguous ownership that would cause code movement before architecture is stable.

## 10. Threat-Model Trigger

No STRIDE artifact is required for C1 because this cycle is M-risk, documentation-only, and
does not alter auth, secrets, external runtime permissions, or data flows. If future C1
implementation edits gate enforcement, hook payloads, ledger integrity, or runtime adapter
behavior, the STRIDE trigger must be re-evaluated before build.

## Falsifies-If

```yaml
Falsifies-If:
  kill-condition: C2 implementation begins before C1-AC-01 through C1-AC-07 have accepted evidence.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/goals/COMPLETE-CONSTRUCTION-GOAL.md §11.3
  on-fail: Stop Stream C refactor work and reopen C1 as BLOCKED_CONTEXT_MAP.
```
