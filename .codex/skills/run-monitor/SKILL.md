---
name: "run-monitor"
description: "Track runtime health signals and trigger convergence or finalization follow-up."
---

<!-- HIMA:CATALOG-ARTIFACT kind=skill id=run-monitor source=operational-catalog -->

# Run Monitor

Track runtime health signals and trigger convergence or finalization follow-up.

## Activation

- Macro cycles: run
- Gate types: session_start, post_tool, stop
- Risk classes: T, L, M, H, C
- Operating modes: bypass, auto, pairing
- Keywords: run, monitor, slo, alert
- Automatic: false

## Ownership

- Owns: operational health summary, SLO gap detection, run-cycle recommendation
- Out of scope: infrastructure provisioning, incident implementation, deployment

## References

- Evidence produced: command_output, risk_remaining, known_gap
- Hooks: convergence, evidence-management
- Subagents: perf-profiler, evidence-collector
