---
name: hima-charter
description: Formalize intent into a spec artifact (Gherkin scenarios, acceptance criteria, criticality tags) before any non-md file may change.
stage: spec
source: base
mode: force
---

## Purpose

Cover the cycle's **spec** stage: turn the survey's problem framing into a sealed charter — the
single source of truth the rest of the cycle builds against. This is the hardest gate in the
cycle: no `hima-forge` entry is allowed without a sealed charter behind it.

## When to use

- A survey exists (or the change is trivial enough to skip it) and it is time to commit to what
  "done" means before touching implementation files.
- Any request to write or edit a non-markdown implementation file, with no charter on record yet.
- Requirements are still expressed as prose, not as testable scenarios.

## Steps

- Convert the survey's requirements into Gherkin scenarios (Given/When/Then).
- Derive acceptance criteria directly from those scenarios — no criterion without a scenario.
- Tag each requirement/criterion with a criticality level (`CRITICAL`/`HIGH`/`MEDIUM`/`LOW`) and a
  blocking level, per the project's spec-criticality convention.
- Name explicit non-goals — what this charter deliberately does not cover.
- Seal the charter (mark it ready) only once scenarios, criteria, and criticality tags are all
  present; an unsealed charter blocks `hima-blueprint`/`hima-forge` entry.

## Done when

- Every acceptance criterion traces to a Gherkin scenario and carries a criticality tag.
- The charter is sealed and readable by `hima-blueprint` and `hima-forge` without reinterpretation.
- No implementation file has been touched before the charter reached sealed status.
