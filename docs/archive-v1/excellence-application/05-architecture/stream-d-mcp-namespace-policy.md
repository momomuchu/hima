# Stream D MCP Namespace Policy

> Status: ACCEPTED
> Cycle: 26
> Scope: D-M5 namespace-as-policy-unit only
> Code: `packages/mcp-server/src/policy/namespace-policy.ts`
> Tests: `packages/mcp-server/test/index.test.ts`

## Decision

The MCP server now treats tool namespace membership as an executable policy boundary.

The policy lives in `packages/mcp-server/src/policy/namespace-policy.ts` and names three allowed policy units:

| Policy unit | Status | Membership |
|-------------|--------|------------|
| `rms` | owned | Canonical `rms.*` MCP tools |
| `hima_governance` | compatibility | `hima_evaluate_completion`, `hima_classify_risk`, `hima_record_evidence`, `hima_query_compliance` |
| `harness_compatibility` | compatibility | Legacy `harness:*` aliases |

The MCP `tools/list` surface and `tools/call` dispatch must both remain inside this policy. Module initialization rejects any listed tool that is not policy-owned, and each call checks the tool name before the dispatch switch runs.

## Boundary

D-M5 is a namespace boundary, not a new governance engine.

It does not reimplement risk, evidence, convergence, gate, root-confinement, or ledger behavior. HIMA governance wrappers continue to call existing core-backed MCP functions. Compatibility names are allowlisted aliases, not wildcard prefixes.

Fail-closed examples covered by test:

- `evil.evaluate`
- `rms.hima_query_compliance`
- `hima_unknown`
- `harness:hima_query_compliance`

## Compatibility

The canonical namespace remains `rms.*`.

The four `hima_*` tools are compatibility HIMA governance wrappers for external coding agents that need HIMA-facing names. The `harness:*` names remain legacy compatibility aliases. New generated artifacts and docs should prefer `rms.*` unless they are intentionally testing a compatibility path.

This cycle does not claim broad five-client MCP compatibility. It only makes the exposed HIMA MCP surface explicitly owned and fail-closed.

## Verification

Current Cycle 26 evidence:

- `corepack pnpm --filter @harness/mcp-server typecheck` passed.
- `corepack pnpm --filter @harness/mcp-server test` passed with 60 tests.
- `corepack pnpm --filter @harness/core test` passed with 367 tests.
- `corepack pnpm docs:index` passed.
- `corepack pnpm lint` passed.
- `corepack pnpm build` passed.
- PostToolUse dry-run passed with an allow decision for `post_tool`.
- Local saturation critic found stale D-M5 wording in older Stream D notes; those notes now point to
  this Cycle 26 artifact as the current state.

## Remaining Risks

- Cycle 27 later closed Stream E adapter system prompts and hook-binding modules for foundation
  scope; install command wiring and real-runtime E2E sessions remain Stream E/F work.
- Five-client compatibility remains a later compatibility-matrix claim, not a D-M5 result.
- Adding any future MCP namespace must update `namespace-policy.ts`, the MCP spec, and tests in the same change.
