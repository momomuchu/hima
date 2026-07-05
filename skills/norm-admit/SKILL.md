---
name: norm-admit
description: Bootstrap a new project or catch up an agent on an existing one in minutes by reading vision/goals/state and scaffolding the minimum brain files.
stage: meta
source: base
mode: advisory
---

## Purpose

Let any agent resume work without re-discovering context. Either scaffolds the minimum brain
files for a new project, or reads them to catch an agent up on an existing one — in minutes,
not a full codebase re-read.

## When to use

- Session start on an unfamiliar or long-idle project.
- A new project has no vision/goals/state files yet.
- Any agent needs a fast orientation before touching code.

## Steps

- Check for existing brain files (vision, long/short-term goals, state) at the project's
  documented locations.
- If missing: scaffold the minimum set (vision, goals cadence, a state summary) from what the
  founder has said and what the repo already reveals — never invent unverified history.
- If present: read them in cadence order (vision → long-term goal → short-term goal → state)
  before doing anything else.
- Surface the current short-term goal's status (`ACTIVE`/`DONE`/`BLOCKED`) explicitly.
- Never treat this as a blocking gate — it's a fast-path convenience, skip if the agent is
  already oriented in the current session.

## Done when

- The agent can state the project's vision, current goal, and status in one paragraph.
- Any newly scaffolded brain file is minimal, sourced from real project signal, not invented.
