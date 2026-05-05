# 00 - Cycle 02 Brief

Status: active cycle brief

## Why Cycle 02 Exists

Cycle 01 converged on the architecture direction:

```text
Hybrid Event-Sourced RMS Kernel
+ one MCP state/control server
+ runtime adapters/hooks
+ skills as procedures
+ subagents as evidence/review lanes
+ reference docs as durable knowledge
```

That was not enough. It did not complete a full development-style loop. Cycle 02
therefore runs the loop inside the loop:

```text
Discovery -> Planning -> Contract Design -> Verification -> Audit -> Integration
```

## Cycle 02 Goal

Turn the architecture direction into implementation-shaped contracts without
writing implementation code yet.

The cycle should answer:

- what gaps remain after Cycle 01;
- what exact MVP phases are needed;
- what MCP tools must accept/return/fail with;
- what `.rms/` storage and registry layout should exist;
- what fixtures prove the design is implementable;
- what audit blockers still prevent implementation.

## Lanes

| Lane | Output |
|---|---|
| Discovery gap audit | `01-discovery-gap-audit.md` |
| Planning roadmap | `02-planning-implementation-roadmap.md` |
| MCP tool contracts | `03-mcp-tool-contracts.md` |
| Registry/storage layout | `04-registry-storage-layout.md` |
| Verification fixtures | `05-verification-fixtures.md` |
| Audit/red-team | `06-audit-red-team.md` |
| Integration | `07-cycle-02-integration.md` |

## Completion Criteria

Cycle 02 is complete only if:

- every lane exists or has been integrated from read-only output;
- integration lists closed, clarified and still-open P0 decisions;
- verification fixtures are concrete enough to become tests;
- audit findings have owner docs or blocker status;
- Cycle 03 backlog is smaller and more implementation-shaped than Cycle 02.

## Non-Goals

Cycle 02 does not implement the MCP server, skills, subagents or reference docs. It
should make their contracts hard enough that implementation is no longer
ambiguous.
