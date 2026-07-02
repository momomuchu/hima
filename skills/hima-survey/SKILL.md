---
name: hima-survey
description: Map the problem before any charter exists — topology, dependencies, unknowns, requirement framing.
stage: discovery
source: base
mode: force
---

## Purpose

Cover the cycle's **discovery + analysis** stages: build a shared map of the problem before a
single line of charter or code exists. hima-survey exists so that "what are we actually solving"
is answered on the record, not assumed. At M+ criticality it is a non-negotiable gate — no
charter may open without a recorded survey.

## When to use

- A new feature, bug, or initiative enters the cycle and no survey artifact exists yet for it.
- The problem topology is unclear: unknown dependencies, ambiguous scope, or competing framings
  of "what this is."
- At T/L criticality this skill is advisory — a lightweight note is enough; do not over-invest.

## Steps

- Restate the problem in the requester's own language before reframing it technically.
- Map topology: what files/systems/data this touches, what already exists, what does not.
- Enumerate dependencies and unknowns explicitly — do not silently assume an answer.
- Frame candidate requirements as testable statements (inputs → outputs → constraints).
- Flag anything that looks like a true blocker for `hima-lookout` or `hima-parley`, not for
  silent assumption.
- Record the survey as a durable artifact the next stage (`hima-charter`) can read.

## Done when

- The problem topology, dependencies, and unknowns are written down, not just discussed.
- Candidate requirements exist in a form `hima-charter` can turn directly into Gherkin scenarios.
- No unresolved true blocker remains unflagged.
