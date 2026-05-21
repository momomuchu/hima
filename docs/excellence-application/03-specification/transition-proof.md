---
claim-bearing: true
status: ACCEPTED
date: 2026-05-14
cycle: cycle-03-specification-excellence-application
deliverable: transition-proof
---

# Transition Proof — Cadrage to Conception

## Purpose

Cycle-03 requires proof that the Cadrage -> Conception transition path can evaluate the
current Cadrage DoD and Conception DoR. This artifact records the executed proof so the
result is not trapped in terminal output.

## Fixture

- Temporary project root under the local OS temp directory.
- `docs/01-governance/` copied from the repo into the fixture.
- No mutation to the repo's ignored `.planning/` state.
- Fixture deleted after collecting output.

## Commands

```powershell
node packages/cli/dist/index.js init --root <temp-root>
node packages/cli/dist/index.js transition cadrage Observer --root <temp-root>
node packages/cli/dist/index.js transition conception Observer --root <temp-root>
```

## Observed Output

```text
{
  "ok": true,
  "runId": "run_20260514114607"
}
{
  "ok": true,
  "from": "discovery",
  "to": "cadrage",
  "subPhase": "Observer"
}
{
  "ok": true,
  "from": "cadrage",
  "to": "conception",
  "subPhase": "Observer"
}
LAST_EVENT_TYPE=STATE_TRANSITIONED
LAST_EVENT_FROM=cadrage
LAST_EVENT_TO=conception
GOVERNANCE_ALLOWED=True
GOVERNANCE_CHECKED=dod:cadrage:3,dor:conception:3
```

## Interpretation

The transition path loaded both required governance files and persisted a transition event
for Cadrage -> Conception in the fixture. This proves the cycle-03 transition proof
criterion at the current implementation level: DoR/DoD presence and schema validation at
transition time. Evidence-anchor resolution is separately checked by `post_tool` gate
dry-runs for the claim-bearing artifacts.

## Falsifies-If

```yaml
Falsifies-If:
  kill-condition: The same command sequence no longer reaches conception or no longer checks dod:cadrage and dor:conception.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/excellence-application/03-specification/transition-proof.md § Observed Output
  on-fail: Reopen cycle-03 transition proof and repair request-transition governance before closing the spec cycle.
```
