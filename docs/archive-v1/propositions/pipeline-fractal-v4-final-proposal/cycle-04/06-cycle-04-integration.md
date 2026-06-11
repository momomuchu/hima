# 06 - Cycle 04 Integration

Status: Cycle 04 integrated verdict, amended by hooks-first spec phase

## Verdict

Cycle 04 closes the remaining P0 contract blockers from Cycle 03.

```text
Kernel contract verdict: PASS
Schema-first implementation planning: START
Runtime implementation: not yet
Hook enforcement verification: not yet
Cycle 05 required for kernel blockers: no
```

This does not mean the RMS kernel or runtime adapters should be coded
immediately from prose. It means the kernel contracts can move from design to
schemas, registry stubs and executable fixtures without inventing missing
semantics.

The hook layer still needs a dedicated specification package before runtime
implementation. That package now lives at:

```text
docs/propositions/pipeline-fractal-v4-specs/
```

## Closed Blockers

| Blocker | Cycle 03 status | Cycle 04 result | Evidence |
|---|---|---|---|
| PFV4-OD-007 convergence thresholds | `still_blocking` | `closed_by_contract` + `closed_by_fixture` | `01-convergence-policy-thresholds.md`, `CONV-001..014`. |
| PFV4-OD-012 territory enforcement | `still_blocking` | `closed_by_contract` + `closed_by_fixture` | `02-territory-enforcement-contract.md`, `VF-TERR-001..010`. |
| PFV4-OD-013 closing protocol | `still_blocking` | `closed_by_contract` + `closed_by_fixture` | `04-closing-transaction-reopen.md`, `VF-CLOSE-001..015`. |
| Storage recovery | P0 blocker without OD row | `closed_by_contract` + `closed_by_fixture` | `03-storage-recovery-contract.md`, `SR-001..015`. |

## Why The Handoff Cap Is Removed

Cycle 02 selected the architecture but rejected implementation handoff. Cycle
03 closed most design contracts but still found four blockers. Cycle 04 closed
those four blockers with explicit policy objects, transaction rules, failure
states and fixtures.

The remaining work is no longer:

```text
What should the system mean?
```

It is now:

```text
Encode these contracts as schemas, registry files and tests.
```

That is the right boundary for schema-first implementation planning.

## Current Authority Stack

The final Cycle 04 authority order is:

```text
RMS event log and pinned registries
> local transaction and recovery library
> MCP adapter/tools/resources
> runtime adapters/hooks
> skills
> subagents
> reference docs
```

Operational implications:

- snapshots are projections;
- MCP is the default transport, not independent truth;
- local transaction fallback is the only allowed fallback mutation path;
- runtime hooks prove only enforceability facts;
- skills request kernel actions;
- subagents produce evidence packets;
- reference docs explain contracts and never override registries.

Hook-specific amendment:

- hooks are not state authority;
- hooks are the primary runtime enforcement proof surface;
- no M/H/C governed route can claim verified execution from runtime name alone;
- missing, stale, unknown, noop, or audit-only hard gates block or cap final
  state according to the hooks-first specs.

## Implementation Planning Entry Point

The next folder should be a schema-first planning package, preceded by the
hooks-first specs:

```text
docs/propositions/pipeline-fractal-v4-specs/
  README.md
  0001-hooks-first-runtime-binding-layer.spec.md
  0002-runtime-probe-and-freshness.spec.md
  0003-pre-action-target-expansion.spec.md
  0004-hook-adapter-matrix.spec.md
```

The implementation planning package should then be:

```text
docs/propositions/pipeline-fractal-v4-implementation-plan/
  00-schema-first-brief.md
  01-registry-and-schema-inventory.md
  02-fixture-matrix.md
  03-kernel-module-boundaries.md
  04-mcp-tool-slice-plan.md
  05-runtime-adapter-slice-plan.md
  06-skill-hook-subagent-bootstrap.md
  07-implementation-risk-register.md
```

The first implementation milestones should be:

1. schema inventory and naming lock;
2. fixture matrix from Cycle 02, Cycle 03 and Cycle 04;
3. storage/event schemas and recovery fixtures;
4. guard merge plus territory fixtures;
5. hooks-first runtime binding fixtures;
6. evidence/convergence fixtures;
7. risk/runtime/artifact/human/candidate fixtures;
8. `rms.close_run` fixtures;
9. MCP tool envelopes after kernel and hook tests exist.

## Non-Blocking Obligations

These are required for implementation planning but no longer block the design
proposal:

| Obligation | Why it matters |
|---|---|
| Concrete JSON Schemas | The contracts are conceptual until schemas enforce them. |
| YAML registry stubs | Guard, evidence, convergence, risk, territory and closing policies need committed registry sources. |
| Fixture conversion | PASS/BLOCK tables must become executable tests before runtime behavior. |
| Numeric convergence normalization | Cycle 04 defines weights and caps; implementation must pin exact component math. |
| Runtime adapter capability schemas | Territory and degradation depend on target expansion and `can_block` facts. |
| Storage recovery test separation | Automatic recovery and operator/admin repair must not be conflated. |
| Close-run first-class tests | Final-state authority is dense and must be tested before alternative write surfaces exist. |
| Hook adapter specs | `user_prompt`, `pre_tool`, `stop` and `subagent_stop` must be proven or explicitly degraded per runtime. |

## Readiness Score

| Dimension | Cycle 03 | Cycle 04 |
|---|---:|---:|
| Architecture authority | 0.94 | 0.94 |
| Convergence policy | 0.55 | 0.84 |
| Territory enforcement | 0.54 | 0.84 |
| Storage recovery | 0.52 | 0.86 |
| Closing transaction | 0.58 | 0.82 |
| Fixture coverage | 0.74 | 0.88 |
| Cross-contract composition | 0.70 | 0.84 |

```text
effective readiness: 0.86
implementation handoff cap: removed
```

## Final Integration Position

Candidate C remains the architecture:

```text
Hybrid Event-Sourced RMS Kernel
+ one MCP state/control server
+ runtime adapters/hooks
+ portable skills
+ bounded subagents
+ durable reference docs
```

Cycle 04 changes the project status:

```text
Before Cycle 04:
  architecture accepted, implementation handoff blocked

After Cycle 04:
  architecture accepted, schema-first implementation planning authorized,
  runtime implementation blocked until hooks-first specs and fixtures close
```

The next work should therefore be hooks-first specs, then schema and fixture
planning, not runtime implementation.
