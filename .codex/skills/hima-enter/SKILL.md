---
name: "hima-enter"
description: "Start a governed HIMA development session from an idea, select the operating mode, and bind the route before implementation."
---

<!-- HIMA:CATALOG-ARTIFACT kind=skill id=hima-enter source=operational-catalog -->

# HIMA Enter

Start a governed HIMA development session from an idea, select the operating mode, and bind the route before implementation.

## Activation

- Macro cycles: discovery, cadrage, conception, build, validation, release, run, learning
- Gate types: session_start, user_prompt
- Risk classes: T, L, M, H, C
- Operating modes: bypass, auto, pairing
- Keywords: hima, enter, start development, development mode, mode developpement, governed development
- Automatic: true

## Procedure

Use this skill as the first explicit step before governed implementation work. Do not depend on OMX, external workflow skills, or manual edits to `.planning/`.

1. Decide whether the user is asking for development. If the request is only chat, research, explanation, or status, do not enter `build/Execute`; report status instead.
2. Choose one operating mode: `bypass` for T/L low-friction work only, `auto` as the default autonomous development mode, or `pairing` when the user wants checkpoints or the risk is H/C.
3. Classify risk with the kernel command. Prefer higher risk when uncertain. Example: `harness risk classify --files "src/foo.ts" --linesChanged 120 --confidence medium --json`.
4. Enter the route through the kernel, not by editing files: `harness enter --root . --phase build --subPhase Execute --mode auto --riskClass M --objective "short objective" --json`.
5. If `harness` is not on PATH inside this repository, use `node packages/cli/dist/index.js` with the same arguments.
6. Verify before writing: `harness status --root . --json` and `harness runtime assess-route --root . --json`.
7. Start implementation only after the route, risk class, operating mode, and runtime bindings are visible. Keep writes inside allowed zones from hook context.

## Ownership

- Owns: development session entry, operating mode selection, risk-to-route binding, initial verification commands
- Out of scope: manual .planning edits, OMX workflow dependency, implementation before route activation, silent risk downgrades

## References

- Evidence produced: hook_decision, confidence_level, risk_remaining
- Hooks: state-machine, risk-classification, runtime-bindings, gate-policy
- Subagents: none
