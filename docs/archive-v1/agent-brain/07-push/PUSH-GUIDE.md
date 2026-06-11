# Push Guide

Status: DRAFT
Created: 2026-05-23

This guide exists so another PC can pull the portable brain and continue transcript mapping.

## Current Location

Repo:

```bash
git clone https://github.com/momomuchu/hima.git
```

Brain entry point:

```bash
docs/agent-brain/README.md
```

## On This PC - Push Discipline

Before committing:

```bash
git status --short --branch
git diff -- docs/agent-brain docs/INDEX.md
```

Stage only intended files:

```bash
git add docs/agent-brain docs/INDEX.md
```

Do not stage unrelated local config such as `.codex/config.toml` unless the user explicitly asks.

Commit:

```bash
git commit -m "add portable agent brain"
```

Push:

```bash
git push -u origin <branch>
```

## On Another PC - Pull And Continue

If repo already exists:

```bash
cd /path/to/hima
git fetch origin
git switch <branch>
git pull --ff-only
```

If cloning fresh:

```bash
git clone https://github.com/momomuchu/hima.git
cd hima
git switch <branch>
```

Then read:

```bash
sed -n '1,220p' docs/agent-brain/README.md
sed -n '1,220p' docs/agent-brain/04-goals/SHORT-TERM-GOAL.md
```

## Import Transcript Batch

1. Locate local transcripts.
2. Keep raw transcripts outside git unless reviewed.
3. Create or update `docs/agent-brain/00-sources/transcript-index.md`.
4. Add redacted extracts if safe.
5. Update `docs/agent-brain/06-trace/TRACEABILITY.md`.
6. Update `docs/agent-brain/02-principles/PRINCIPLES.md`.
7. Update `docs/agent-brain/05-tests/TEST.md`.
8. Commit and push a new branch or the active branch.

## Safety Checks

Before any push, verify:

- no secrets in diff;
- no raw private transcripts unless explicitly approved;
- no unrelated machine-specific config;
- tests or replay notes updated when behavior changed;
- active goal still reflects the work.

## Minimal Pull Checklist

```text
[ ] I can find docs/agent-brain/README.md.
[ ] I can find the active brain goal.
[ ] I know where transcripts live on this PC.
[ ] I know whether raw transcripts can be committed.
[ ] I have updated trace rows before promoting principles.
[ ] I have updated TEST.md for taste/behavior examples.
```

```yaml
Falsifies-If:
  kill-condition: >
    Another PC cannot pull the brain, identify the active goal, and start
    transcript import without relying on this chat.
  checkpoint-date: 2026-05-30
  evidence-anchor: docs/agent-brain/README.md + docs/agent-brain/07-push/PUSH-GUIDE.md
  on-fail: add a one-command bootstrap section and a smaller quickstart.
```
