---
name: "goal-sprint-alignment"
version: "1.0.0"
type: task
triggers:
  - "goal"
  - "sprint"
  - "alignment"
expected_outputs:
  - "goal_alignment: sprint work mapped to strategy"
  - "stop_list: work that should not be pulled"
requires_tools: []
fallback_for_toolsets: []
description: "Align sprint work to product goals and keep unrelated work out."
---

<!-- HIMA:SKILL-ARTIFACT name=goal-sprint-alignment source=book/01-strategy-positioning -->

# Goal Sprint Alignment

Map sprint work to the active strategy and identify work to stop.

## Guardrails

- Each work item must map to a named product goal.
- Stop-list work is explicit, not hidden in backlog noise.
- The sprint should not optimize local activity over strategic progress.
