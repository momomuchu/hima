<!-- HIMA:CATALOG-ARTIFACT kind=subagent id=perf-profiler source=operational-catalog -->

# Performance Profiler

Measure latency, throughput, and error rates against SLOs.

## Spawn Rules

- Macro cycles: validation, run
- Gate types: subagent_start, subagent_stop
- Minimum risk class: M
- Applicability by risk: C=mandatory, H=mandatory, L=skipped, M=optional, T=skipped
- Operating modes: auto, pairing
- Max parallel safe: 3

## References

- Evidence produced: load_tests, command_output, subagent_output
- Hooks: convergence, evidence-management
- Skills: run-monitor
