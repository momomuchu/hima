---
claim-bearing: false
status: ACCEPTED
date: 2026-05-14
purpose: snapshot of hima's actual implementation surface as of 2026-05-14 — anchor for the SYNTHESIS.md so pattern recommendations bind to real file paths, not abstract ideas
agent: main-thread (during swarm dispatch)
---

# hima/packages/ layout snapshot — 2026-05-14

This is a one-off snapshot captured while the cycle-02 swarm was running. The synthesis stage cites this file when it recommends "adopt pattern X in hima/packages/Y/Z.ts" so the recommendation is concrete, not vague.

## Workspace

`pnpm-workspace.yaml` + `turbo.json` (Turborepo). 6 packages:

```
packages/
├── core/              # the runtime kernel (substantial implementation)
├── cli/               # harness CLI entry point
├── mcp-server/        # MCP server exposing hima primitives
├── adapter-claude/    # Claude Code runtime adapter
├── adapter-codex/     # Codex CLI runtime adapter
└── adapter-hermes/    # Hermes runtime adapter
```

## `packages/core/` — implementation surface

Real code (not just specs). 60+ TS files + tests + dist build output. Maps the 10 conception specs to actual modules:

### State machine — `src/state-machine/`
- `machine.ts` — the FSM (matches `docs/conception/01-state-machine-spec.md`)
- `transition.ts` — transition logic
- `subphases.ts` — Observer/Define/Design/Execute/Verify/Capitalize/Transmit
- Tests: `transition.test.ts`, `state-machine-sequence.test.ts`

### Risk classifier — `src/risk-classifier/`
- `risk-rank.ts` — T/L/M/H/C ranking
- `types.ts` — type definitions
- `index.ts` — public API (matches `docs/conception/02-risk-classifier-spec.md`)
- Tests: `risk-classifier.test.ts`

### Gates — `src/gates/`
- `evaluate-gate.ts` — gate evaluation (matches `docs/conception/05-gates-policy-spec.md`)
- `policy-event-blockers.ts` — hard-block / warn matrix
- Tests: `gates.test.ts`

### Policy — `src/policy/`
- `baseline-policy.ts` — class-based policy resolution
- `write-zones.ts` — phase-based write permission matrix (matches §2.1 of gates spec)
- Tests: `baseline-policy.test.ts`, `write-zones.test.ts`

### Evidence — `src/evidence/`
- `evaluate-evidence.ts` — Evidence Set sufficiency check
- Tests: `evidence.test.ts`

### Storage — `src/storage/`
- `json.ts` / `yaml.ts` — serializers
- `atomic-write.ts` / `safe-write.ts` / `file-lock.ts` — concurrent-safe writes
- `planning-paths.ts` / `planning-store.ts` — the `.planning/` contract (matches `docs/conception/08-planning-state-schema.md`)
- Tests: `planning-store.test.ts`

### Install — `src/install/`
- `artifact-install.ts` / `artifact-rollback.ts` — installer ↔ uninstaller
- `artifact-paths.ts` — path resolution
- `platform-install.ts` — per-platform install logic
- `runtime-lifecycle.ts` — lifecycle hooks
- Tests: `install.test.ts`, `artifact-install.test.ts`, `artifact-rollback.test.ts`, `artifact-generation.test.ts`

### Runtime — `src/runtime/`
- `runtime-bindings.ts` — adapter binding (matches `docs/conception/04-runtime-bindings-spec.md`)
- `runtime-profiles.ts` — per-platform profile (Claude/Codex/Hermes)
- `runtime-probe.ts` — runtime detection
- `runtime-proofs.ts` — evidence collection from runtime
- Tests: `runtime-bindings.test.ts`, `runtime-profiles.test.ts`, `runtime-probe.test.ts`

### Services — `src/services/`
Public API endpoints used by CLI + MCP server:
- `init-project.ts` — `harness init`
- `get-status.ts` — `harness status`
- `request-transition.ts` — `harness transition`
- `close-run.ts` — `harness stop`
- `add-evidence.ts` — `harness evidence add`
- `enter-development.ts` — `harness enter dev`
- `handle-hook.ts` — `harness hook <gate>`
- Tests: each has companion `.test.ts`

### Schemas — `src/schemas/`
Zod schemas (matches `docs/conception/03-rms-sets-schema.md` + `08-planning-state-schema.md`):
- `gate-event.schema.ts`
- `state.schema.ts`
- `current-risk.schema.ts`
- `run-set.schema.ts`
- `common.ts`
- Test: `run-set-schema.property.test.ts` (property-based via fast-check)

### Catalogs — `src/catalogs/`
- `index.ts` — public catalog API
- `operational-catalog.ts` — skill/subagent/runtime catalog (matches `docs/conception/06-skills-catalog-spec.md` + `07-subagents-catalog-spec.md`)
- `artifact-generation.ts` — catalog-driven artifact generation

### Security — `src/security/`
- `redaction.ts` — PII redaction

### Convergence — `src/convergence/`
- `evaluate-convergence.ts` — meta-loop convergence check (the loop's exit criterion, see `.planning/loop/LOOP-TRACE.md`)
- Tests: `convergence.test.ts`

### Misc
- `src/index.ts` — public exports
- `src/types/canonical.ts` — canonical types
- `src/types/errors.ts` — error hierarchy
- `dist/index.d.ts` — published type declarations

## What's NOT YET in packages/core/

Inferred from spec ↔ code alignment (specs that don't have a matching `src/*/` module):
- `docs/conception/09-cli-commands-spec.md` — CLI commands (lives in `packages/cli/`, not core)
- `docs/conception/10-core-api-spec.md` — partially implemented; some service endpoints scaffolded, full API surface not yet exposed
- The Falsifies-If §8.4 rule landed in the spec 2026-05-14 but is NOT yet enforced in `gates/evaluate-gate.ts` or `policy/baseline-policy.ts` — that's W0.5 in the cycle-02 backlog.

## Why this snapshot matters for synthesis

When the swarm returns and the synthesis recommends "adopt pattern X," the recommendation must specify:
- WHERE in hima it would land (file path)
- WHICH existing test would need to extend
- WHETHER an adapter, the core, or the CLI is the right home

Without this snapshot, recommendations like "add a hook composer" or "add a skill conditional activation mechanism" are too abstract to act on. With this snapshot, the synthesis can say "add `src/skills/conditional-activation.ts` to packages/core/, paired with a `skills/conditional-activation.test.ts` extending the existing `catalogs.test.ts` pattern."

## Adapter packages (skeleton state per package.json — substantive code presence unknown without further read)

- `packages/adapter-claude/` — Claude Code adapter
- `packages/adapter-codex/` — Codex CLI adapter
- `packages/adapter-hermes/` — Hermes adapter
- `packages/cli/` — `harness` CLI binary
- `packages/mcp-server/` — MCP server exposing core primitives

Each has its own `package.json` confirmed. Source files NOT scanned in this snapshot pass — defer to the synthesis stage or a future cycle.

---

*Snapshot captured during cycle-02 swarm dispatch. Use as concrete-anchoring reference, not as exhaustive code review.*
