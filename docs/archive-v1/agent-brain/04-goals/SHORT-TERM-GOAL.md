---
cycle-id: agent-brain-cycle-01-portable-skeleton
claim-bearing: true
status: ACTIVE
opened: 2026-05-23
closed:
supersedes: (none)
---

# Short-Term Goal - Cycle 01: Portable Skeleton And Push

## Objective

Write and push the first portable agent-brain skeleton so the user can pull it on another PC and begin transcript import.

## Desired End State

The repo contains a complete initial `docs/agent-brain/` pack with vision, roadmap, principles, protocols, goals, tests, traceability, and push instructions.

## Success Criteria

1. All major brain layers exist as Markdown files.
2. The pack defines how transcripts will be imported and mapped.
3. The pack defines how goals are written and archived.
4. The pack defines the first taste/replay tests.
5. The pack includes a push/pull guide for another PC.
6. The changes are committed and pushed without staging unrelated local files.

## Non-Goals

- Do not import all other-PC transcripts in this cycle; they are not locally available yet.
- Do not change the active runtime hooks or installer.
- Do not modify repo-level `docs/goals/SHORT-TERM-GOAL.md`.
- Do not stage `.codex/config.toml` unless explicitly requested.

## Evidence Path

- file list under `docs/agent-brain/`;
- `git diff --cached`;
- commit hash;
- push output.

## Stop Condition

Stop if git authentication fails, remote is unavailable, or unrelated files cannot be separated from the intended commit.

## Next Checkpoint

After pulling on the other PC, import or index the first transcript batch and update `00-sources/TRANSCRIPT-INGEST.md`, `06-trace/TRACEABILITY.md`, and `05-tests/TEST.md`.

```yaml
Falsifies-If:
  kill-condition: >
    The branch cannot be pulled on another PC or the committed files do not
    contain enough structure to start transcript import.
  checkpoint-date: 2026-05-30
  evidence-anchor: git branch + commit + docs/agent-brain/README.md + docs/agent-brain/07-push/PUSH-GUIDE.md
  on-fail: create a minimal portable archive with BRAIN, GOALS, TEST, and TRACE only, then push again.
```
