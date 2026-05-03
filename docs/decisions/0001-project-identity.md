# 0001 - Project Identity

Status: accepted

Date: 2026-05-03

## Decision

The project and GitHub repository name is `hima`.

The repository is private-first. Public release is a later decision and should
not happen until the repository has passed at least:

- documentation structure review;
- license decision;
- secrets and local-state audit;
- public naming/domain review;
- initial implementation/readiness boundary review.

## Context

The previous bootstrap name was `harness-architecture`. That name described the
working folder, but it is no longer the project identity. The selected
Git/repository name is `hima`, and the user indicated that the domain has
already been secured.

## Consequences

- README and GitHub metadata should use `hima`.
- Existing architecture documents may keep historical references to harness,
  RMS, Pipeline Fractale V4, Claude Code, Codex and Hermes because those are
  domain concepts, not repository names.
- Local runtime state such as `.omc/`, `.omx/`, `.planning/` and `.claude/`
  should stay ignored.
- Public release requires a separate visibility decision.
