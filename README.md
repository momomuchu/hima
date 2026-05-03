# hima

Herms architecture work for the portable coding-agent harness project.

## Scope

Pure architecture: planning → analysis → planning. No implementation.

The goal is to define the portable RMS/kernel layer, runtime bindings,
state-machine contracts, skills, subagents, books, and provider mappings needed
to run coding-agent workflows across Claude Code, Codex, Hermes, and later
runtimes.

This repository is private-first. It can be prepared for public release later
after docs, licensing, secrets review, and naming are stable.

## Layout

```
hima/
  docs/          # research notes, references, external sources
  docs/decisions # ADRs and project decisions
  docs/diagrams  # Mermaid/C4/sequence/dependency diagrams
  docs/drafts    # work-in-progress proposals
```

## Status

Architecture convergence in progress.

Current anchor documents:

- `docs/propositions/provider-portability-mapping-convergence-v2.md`
- `docs/propositions/pipeline-fractal-v4-final-proposal/08-architecture-generale.md`
- `docs/propositions/pipeline-fractal-v4-specs/README.md`
