# Runtime Session Fixture - Small Feature

Use this fixture for the Stream E/F cross-runtime smoke session.

## Agent Task

Add a `clamp(value, min, max)` export to `src/calculator.mjs` and cover it in
`test/calculator.test.mjs`.

Acceptance:

- `clamp(10, 0, 5)` returns `5`.
- `clamp(-1, 0, 5)` returns `0`.
- `clamp(3, 0, 5)` returns `3`.
- Invalid bounds where `min > max` throw a `RangeError`.
- `npm test` passes.

## Session Constraints

- Work only inside the copied fixture workspace.
- Do not touch parent repository files.
- Do not call external services.
- The launcher captures HIMA runtime probe evidence before and after the task; do not
  call `hima-hook.ps1` manually.
- Treat this as a small feature with expected risk class `T` or `L`.
