<!-- HIMA:CATALOG-ARTIFACT kind=hook id=evidence-management source=operational-catalog -->

# Evidence Management

Accepted evidence keys, subagent output capture, gap reporting, and sufficiency checks.

## Applicability

- Macro cycles: discovery, cadrage, conception, build, validation, release, run, learning
- Gate types: post_tool, stop, subagent_stop
- Risk classes: T, L, M, H, C
- Operating modes: bypass, auto, pairing

## References

- Evidence keys: ci_green, sast_clean, secrets_clean, integration_tests, subagent_output, command_output, files_modified, known_gap
- Skills: build-inner-loop, validate-evidence, run-monitor, close-run
- Subagents: reviewer, threat-modeler, test-writer, evidence-collector, security-auditor, accessibility-checker, perf-profiler, doc-generator, retro-facilitator
