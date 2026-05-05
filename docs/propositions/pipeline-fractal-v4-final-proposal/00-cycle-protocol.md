# 00 - Cycle Protocol

Status: active protocol for autonomous design cycles

## Intent

The requested mode is continuous cycling: propose, challenge, integrate,
validate, then repeat until the architecture converges.

This cannot literally be infinite inside one run. The practical version is:

```text
run bounded cycles
+ keep evidence from each cycle
+ stop only when convergence criteria are met or a real blocker appears
+ leave the next cycle ready to launch
```

## Cycle Shape

Each cycle has seven stages:

| Stage | Output |
|---|---|
| 1. Load context | Source docs and previous cycle findings. |
| 2. Generate options | Three viable proposals, not one default answer. |
| 3. Red-team options | Edge cases, contradictions, runtime failure modes. |
| 4. Map runtime surfaces | MCP, skills, hooks, subagents, logs, evidence. |
| 5. Score convergence | Evidence, decision power, risk coverage, implementation clarity. |
| 6. Integrate | One recommendation plus two rejected alternatives with reasons. |
| 7. Emit next-cycle backlog | Remaining P0/P1 decisions, fixtures and docs to update. |

## Subagent Usage Rule

Use subagents when lanes are independent and materially improve throughput:

- architecture option generation;
- edge-case red team;
- skills/hooks/subagents taxonomy;
- MCP state-kernel design;
- verifier/convergence pass.

Do not use subagents as a substitute for integration. The leader owns the final
decision record.

## Convergence Criteria

A cycle is considered convergent when all conditions are true:

- fewer new P0 decisions are discovered than closed or clarified;
- the same architecture option wins under at least two different scoring views;
- edge cases have deterministic handling or explicit non-goals;
- the MVP surface gets smaller or more stable, not larger;
- every runtime dependency has a Binding Set strategy;
- the final proposal can name what lives in MCP, skills, hooks, and subagents
  without overlap.

## Stop Conditions

Stop the current cycle when:

- the integrated recommendation has enough evidence for user choice;
- a P0 decision requires human preference rather than more analysis;
- docs become internally consistent for the current scope;
- implementation would be the next useful activity.

## Cycle 01 Inputs

- `../pipeline-fractal-v4-state-machine/`
- `../rms-runtime-sets-v1-draft.md`
- `../../research-reports/report-hermes-cdx-cld.md`
- `../../transversal/harness-state-machine.md`
- `../../transversal/risk-classification.md`

## Cycle 01 Target Output

Three convergent proposals:

1. MCP-first RMS kernel.
2. Skill-first portable workflow layer.
3. Documentation-first governance and knowledge layer with MCP enforcement.

The expected likely winner is a hybrid: MCP owns state/control; skills expose
workflow; hooks enforce runtime policy; subagents execute bounded lanes;
reference docs hold durable operating knowledge.
