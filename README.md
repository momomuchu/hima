# hima

Portable coding-agent harness implementation and architecture notes.

## Scope

HIMA implements the PFV4 runtime kernel for governed coding-agent workflows
across Claude Code, Codex, Hermes, and later runtimes.

The current implementation includes:

- a TypeScript monorepo with core, CLI, MCP server, and runtime adapter packages;
- strict `.planning/` state storage and gate evaluation;
- runtime hook binding and platform hook lifecycle management;
- catalog-driven skills, hooks, and subagents for runtime-facing workflow surfaces.

Runtime-facing docs should use the hooks vocabulary consistently:
`session-start`, `user-prompt-submit`, `pre-tool-use`, `post-tool-use`, `stop`,
`subagent-start`, and `subagent-stop`.

This repository is private-first. It can be prepared for public release later
after docs, licensing, secrets review, repository metadata, and naming are
stable.

## Layout

```
hima/
  docs/                # research notes, specifications, implementation docs
  docs/implementation  # implementation architecture, sprint log, release policy
  packages/            # core, CLI, MCP server, and runtime adapters
  scripts/             # package readiness and smoke checks
  .planning/           # local runtime state for harness validation
```

## Status

Executable implementation in progress. The implementation log is the current
evidence anchor for what has been built and verified.

Current anchor documents:

- `docs/implementation/01-sprint-implementation-log.md`
- `docs/implementation/02-release-readiness-policy.md`
- `docs/propositions/provider-portability-mapping-convergence-v2.md`
- `docs/propositions/pipeline-fractal-v4-final-proposal/08-architecture-generale.md`
- `docs/propositions/pipeline-fractal-v4-specs/README.md`
