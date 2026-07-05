---
name: norm-warden
description: Prove a change works end-to-end by driving the real flow — the dynamic counterpart to norm-verdict's static review.
stage: meta
source: base
mode: force
---

## Purpose

Exercise the actual runtime surface a change touches instead of trusting tests, a diff read,
or a code review alone. norm-warden is the dynamic proof step: it drives the affected
flow (UI, API, CLI) and observes real behavior before a completion claim is trusted.

## When to use

- **Force at M+** for any change with a runtime surface (UI flow, API endpoint, CLI command).
- Skip explicitly for docs-only or test-only diffs — there is nothing to drive.
- Pairs with norm-verdict: verdict reviews statically, warden proves dynamically; neither
  substitutes for the other.

## Steps

- Identify the runtime surface the change actually touches (endpoint, screen, command).
- Drive it for real — not a mock, not a dry-run: real request, real render, real invocation.
- Walk the happy path first, then edge cases (empty/error states, boundary inputs).
- Compare observed behavior against the charter's acceptance criteria, not against the
  implementer's own description of what it should do.
- Record the evidence (command output, screenshot, transcript) that proves the flow ran.

## Done when

The affected flow has been driven for real with recorded evidence, and the observed behavior
matches (or explicitly deviates from, with a named gap) the charter's acceptance criteria.
