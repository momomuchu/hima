---
name: hima-lookout
description: Cited, multi-source research pass for H/C decisions or true blockers — converts findings into requirements, risks, and rejected alternatives.
stage: meta
source: base
mode: force
---

## Purpose

Run a pro-grade research pass when correctness depends on current, official, versioned, or
niche external information — or when any agent has been genuinely stuck (a true blocker) for
more than ~10 minutes. hima-lookout never substitutes for implementation or verification; it
feeds decisions, it doesn't replace them.

## When to use

- **Force at H/C decisions**: architecture, framework/library choice, or any recommendation
  that would be expensive to reverse after implementation starts.
- Force whenever an agent is genuinely blocked (not merely uncertain) for a real stretch of time.
- Advisory otherwise — skip when local evidence (the codebase itself) is already sufficient,
  and say so explicitly.

## Steps

- Frame 2–5 research questions from the goal contract; each must be answerable externally and
  change a downstream decision if the answer differs.
- Execute a real pass: official docs/versioned specs, and/or cited web sources (minimum 3
  independent sources for H, 5 for C) — a single doc lookup does not qualify as pro-grade.
- Convert findings into requirements added, decisions made (with rationale), risks identified,
  and alternatives considered and rejected with evidence.
- Cite the research in the final answer: `Research evidence: [source / date]`.
- If skipping, state the skip reason explicitly — "I already know this" is not valid at H/C.

## Done when

Findings are converted into requirements/decisions/risks/rejected-alternatives with citations,
or a skip is explicitly justified as local-evidence-sufficient.
