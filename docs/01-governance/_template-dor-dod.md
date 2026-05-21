---
kind: dor | dod
cycle: discovery | cadrage | conception | build | validation | release | run | learning
title: <cycle> <DoR or DoD>
version: 1
criteria:
  - id: <KIND>-<CYCLE>-1
    text: <observable criterion>
  - id: <KIND>-<CYCLE>-2
    text: <observable criterion>
  - id: <KIND>-<CYCLE>-3
    text: <observable criterion>
Falsifies-If:
  kill-condition: A transition can pass while this gate has fewer than three concrete criteria or no falsifier.
  checkpoint-date: 2026-06-04
  evidence-anchor: docs/01-governance/_template-dor-dod.md
  on-fail: Block cycle transition and repair the governance file before retrying.
---

# DoR/DoD Governance Template

Each gate file is a claim-bearing runtime artifact. The frontmatter is the locked schema consumed by `packages/core/src/governance/load-dor-dod.ts`.

Body sections should explain how a human or runtime can inspect the criteria. The frontmatter stays short and machine-readable.
