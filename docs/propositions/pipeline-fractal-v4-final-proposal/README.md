# Pipeline Fractale V4 - Final Proposal Workbench

Status: autonomous design cycle, kernel architecture accepted, hook specs now
required before runtime implementation.

## Purpose

This folder is the convergence surface for the final Pipeline Fractale V4
proposal. It takes the state-machine V2 folder as input and now evaluates the
system architecture around five runtime surfaces:

- one RMS/MCP state kernel;
- runtime adapters and hooks;
- skills as reusable procedures;
- subagents as isolated work lanes;
- books as durable knowledge and operating manuals.

The goal is not to create one more monolithic document. The goal is to cycle
three competing proposals until the differences become decision-grade.

## Current Cycle

Cycle 01 asked:

```text
If the RMS owns state, guards, evidence, convergence and runtime bindings,
what should live in the single MCP server, what should live in skills, what
should live in subagents, and what should live in books?
```

Cycle 02 tested that architecture against implementation-shaped contracts:

```text
Architecture direction: accepted
Implementation handoff: blocked
Next useful cycle: P0 executable contracts
```

Cycle 03 narrowed the remaining blockers to convergence, territory, storage
recovery and closing. Cycle 04 closed those blockers and authorizes the next
phase:

```text
Kernel contract verdict: PASS
Schema-first implementation planning: START
Runtime implementation: not yet
Hook enforcement verification: not yet
```

The hook gap is now tracked in:

```text
docs/propositions/pipeline-fractal-v4-specs/
```

Cycle 04 remains valid for kernel semantics. It does not prove runtime hook
enforcement. Runtime implementation is blocked until the hooks-first specs,
schemas and fixtures are accepted.

## Documents

| File | Role |
|---|---|
| `00-cycle-protocol.md` | Repeatable autonomous design loop and stop criteria. |
| `01-three-convergent-architectures.md` | Three candidate architectures with arguments against each. |
| `02-edge-case-red-team.md` | Edge cases and failure modes that can break the proposal. |
| `03-skills-subagents-books-taxonomy.md` | Proposed skills, subagents and books. |
| `04-single-mcp-state-kernel.md` | One-MCP-server state kernel proposal. |
| `05-convergence-validation-cycle.md` | Validation and convergence model for repeated cycles. |
| `06-integrated-final-proposal.md` | Integrated recommendation after a cycle. |
| `07-decision-matrix.md` | Choice matrix between the three convergent proposals. |
| `08-architecture-generale.md` | Macro/micro architecture synthesis with Mermaid diagrams and source map. |
| `cycle-02/` | Discovery, planning, contract, fixture, audit and integration loop for implementation readiness. |
| `cycle-03/` | P0 executable contracts for supersession, guards, evidence, risk/runtime and artifacts; integration still blocked. |
| `cycle-04/` | Final blocker cycle for convergence, territory, storage recovery and closing; schema-first planning authorized. |
| `../pipeline-fractal-v4-specs/` | Hooks-first spec package required before runtime adapter implementation. |

## Working Thesis

The strongest default is likely:

```text
MCP server = canonical state/control kernel
hooks      = runtime enforcement and capability proof surface
skills     = portable procedures and workflow entrypoints
subagents  = bounded analysis/execution lanes
books      = durable manuals, contracts and operating knowledge
```

The alternatives remain useful because they expose different risks:

- MCP-first can become a central bottleneck.
- Skill-first can drift because procedures own too much implicit state.
- Book-first can become documentation-heavy and weak at runtime enforcement.

## Readiness Rule

This folder becomes ready for implementation planning only when:

- the three options are explicit enough to reject two of them;
- edge cases have expected handling, not just warnings;
- the single MCP server boundary is clear;
- hook enforcement boundaries are mapped and tested;
- the MVP list of skills, subagents and books is closed;
- the old P0 decisions from the state-machine V2 folder are mapped to concrete
  implementation objects.

After Cycle 04, the architecture choice is strong enough for schema-first
implementation planning. Runtime implementation should still wait until concrete
JSON Schemas, registry stubs and executable fixtures are planned from the Cycle
02-04 contracts and from the hooks-first specs.
