# Pipeline Fractale V4 - Specs Workbench

Status: hooks-first specification phase, no runtime implementation yet.

## Purpose

This folder starts the specification phase after the Cycle 04 architecture
proposal. It corrects one important framing issue: Cycle 04 is strong enough
for schema-first kernel planning, but it did not prove hook enforcement.

Hooks are the primary runtime enforcement surface. The RMS kernel remains the
state authority, and MCP remains the portable control interface, but governed
execution cannot claim `DONE_VERIFIED` unless the required runtime hooks are
freshly inspected, bound, and proven enforceable for the active risk class.

## Read First

| File | Why |
|---|---|
| `0001-hooks-first-runtime-binding-layer.spec.md` | Main spec. Defines gates, runtime bindings, failure rules, acceptance criteria and fixture matrix. |
| `0002-runtime-probe-and-freshness.spec.md` | Defines how `rms.inspect_runtime` proves hook capability instead of trusting runtime names. |
| `0003-pre-action-target-expansion.spec.md` | Defines how hooks identify write targets before side effects. |
| `0004-hook-adapter-matrix.spec.md` | Concrete Claude, Codex and Hermes adapter binding matrix. |

If you read only one file, read `0001-hooks-first-runtime-binding-layer.spec.md`.

## Corrected Verdict

```text
Cycle 04 kernel architecture: PASS
Hook enforcement verification: NOT YET
Schema-first specs: START
Runtime implementation: BLOCKED until hook specs and fixtures are accepted
```

## Authority Model

The final authority order remains:

```text
RMS event log and pinned registries
> local transaction and recovery library
> MCP adapter/tools/resources
> runtime adapters/hooks
> skills
> subagents
> books
```

But enforcement readiness is hook-gated:

```text
No fresh hook capability proof
= no governed M/E/C mutation
= no DONE_VERIFIED
```

Hooks do not become independent truth. They prove whether the runtime can
synchronously enforce a gate. The kernel decides what that proof means.

## Spec Scope

In scope:

- canonical hook gates;
- Binding Set and Capability Set fields;
- runtime-specific hook mappings;
- hook installer obligations;
- fail-open platform errors versus fail-closed RMS policy;
- target expansion before tool side effects;
- hook fixtures required before runtime code.

Out of scope:

- implementing the MCP server;
- implementing adapter code;
- installing real hooks into local runtime homes;
- changing user or global runtime configuration.

## Implementation Gate

Runtime implementation may start only after:

1. hook specs are accepted;
2. JSON Schemas and YAML registry stubs are planned;
3. fixture IDs in `0001` are converted into executable tests;
4. per-runtime adapter specs for Claude, Codex and Hermes are closed.
