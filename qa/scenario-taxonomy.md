# hima QA — ISO-style Scenario Taxonomy

> This is the **taxonomy**, not the runner. It defines *what* must be tested and *why*, as a
> systematic space — the runner (`scripts/ultraqa.mjs`) executes the machine-readable projection
> in `qa/scenarios.mjs`. Design follows ISO/IEC/IEEE 29119-4 test-design techniques
> (equivalence partitioning + boundary values + decision-table + pairwise reduction) rather than an
> ad-hoc list. Each scenario carries a **SHALL** acceptance criterion (the gate that must fire).

## 1. Why a taxonomy (not a script)

hima exposes a small set of **user-facing variables**. Quality = for every meaningful combination of
those variables, hima governs a real session **as specified** (blocks what it must, allows what it
must, never crashes, always traces). A hand-picked scenario list cannot claim coverage; a taxonomy
over the variable axes, reduced by equivalence classes, can. This is the ISO-QA principle applied to
hima itself.

## 2. The axes (independent variables) and their equivalence classes

| Axis | Equivalence classes (representatives) | Why it partitions behavior |
|---|---|---|
| **A. Runtime** | `claude` · `codex` · `hermes` · `opencode` | governance-portability claim (SPEC-VISION V-013a); each has a different hook/adapter surface |
| **B. Entry × criticality (sigil, trailing)** | none→`M`/run · `run`→`M` · `spec`→`M` (mid-cycle) · `full`/`ulw`→`H` · high-risk keyword→`C` | sets the ward floor + entry stage + role → decides which gates arm |
| **C. Cycle** | default `DEV_CYCLE` · `--generic` (corpus-free pack) · custom/none (`useDevCyclePack:false`) | INV-2 pluggability; which forceSkills exist |
| **D. enabledSources** | default `[base,user,project]` (corpus off) · `[base]` only · `[base,corpus,user,project]` (corpus on) | provenance filter (F1 stranger trap); which forced skills survive |
| **E. Task type** | read-only trivial · feature write (impl) · spec/plan write (.md) · bug-report · refactor · **fake-DONE claim** · multi-file · subagent-spawn | exercises different gates (planner-write-guard, skill-force, stop-gate, research-first) |

## 3. Expected gate per scenario (the dependent variable / ISO acceptance criterion)

Every scenario states the gate that **SHALL** fire (the oracle). The gate vocabulary:

| Gate id | SHALL statement |
|---|---|
| `ALLOW` | governs silently; no block; session reaches a clean end |
| `PLANNER_WRITE_GUARD` | an implementation write in an early (planner) stage SHALL be blocked (exit 2) |
| `SKILL_FORCE` | a required-but-not-yet-invoked in-scope skill SHALL be forced (block until invoked) |
| `STOP_FAKE_DONE` | a completion claim at M+ with no sealed verdict SHALL be blocked at Stop |
| `RESEARCH_FIRST` | an H/C entry SHALL force a research skill before impl |
| `NO_DISABLED_SOURCE` | no gate SHALL force a skill whose `source` is not in `enabledSources` |
| `NO_HOOK_ERROR` | no hima hook SHALL throw (trace error count 0) — a universal invariant on every scenario |

## 4. Coverage strategy (ISO 29119 reduction)

The full cross-product (4·5·3·3·8 = 1440) is not run. Coverage is:

1. **Base-choice / each-choice** — every equivalence class of every axis appears in ≥1 scenario.
2. **Boundary values** — sigil floor boundaries (M↔H↔C), enabledSources `[base]`-only (minimal), corpus on/off.
3. **Risk-based full-combo** — the high-value gates (`STOP_FAKE_DONE`, `PLANNER_WRITE_GUARD`,
   `NO_DISABLED_SOURCE`) are run on **every runtime** (portability is the core claim).
4. **Universal invariant** — `NO_HOOK_ERROR` is asserted on *every* scenario regardless of its primary gate.

Reduction rationale is logged; anything dropped is named (no silent truncation).

## 5. The enumerated scenario set

The machine-readable projection lives in `qa/scenarios.mjs` (imported by the runner). Each entry:
`{ id, axes:{runtime,entry,cycle,sources,task}, prompt, sigil, config, gate, check }`. IDs encode the
cell, e.g. `claude/full/dev/default/feature → PLANNER_WRITE_GUARD`. The runner records, per scenario,
the observed gate vs the SHALL gate; a mismatch is a finding.

## 6. Cross-references

- Runner: `scripts/ultraqa.mjs` (executes; real authed sessions; real-exit oracle).
- Data: `qa/scenarios.mjs` (the taxonomy as executable data).
- Vision/primitive the gates trace to: `docs/specs/SPEC-VISION.md`, `docs/specs/SPEC-PRIMITIVE.md`.
- Live findings log: `[[hima-dogfood-findings]]` (memory) + commit history.
