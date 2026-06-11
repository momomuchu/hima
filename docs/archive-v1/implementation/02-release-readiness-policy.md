# HIMA Release Readiness Policy

Status: implementation gate, private-first

Date: 2026-05-03

## Decision

The HIMA package set stays private until a separate public-release decision is
made. Local release readiness checks therefore run in advisory mode: they expose
publish blockers and package hygiene gaps without attempting to publish.

## Package Set

The canonical package set is defined in `scripts/package-policy.mjs`:

- `@harness/core`
- `@harness/adapter-codex`
- `@harness/adapter-claude`
- `@harness/adapter-hermes`
- `@harness/cli`
- `@harness/mcp-server`

Package manifests are allowed to use `workspace:*` in source because this is a
pnpm monorepo. Packed tarballs must not contain `workspace:`, `file:`, or `link:`
dependency protocols.

## Gates

- `pnpm package:readiness` checks source package metadata and reports advisory
  blockers/warnings. `private:true` is a blocker for public npm publish and is
  currently expected.
- `pnpm package:readiness:strict` converts the same readiness result into an
  opt-in release gate. Strict mode exits non-zero unless
  `releaseReady:true`.
- `pnpm smoke:tarball` packs every package, inspects each packed manifest, fails
  if local dependency protocols leak into tarballs, and verifies installability
  in an external temporary consumer project.
- `pnpm smoke:package` verifies built CLI install/rollback behavior against a
  temporary runtime target.

Strict readiness can also be enabled with either environment variable:

- `HIMA_PACKAGE_READINESS_STRICT=1`
- `HIMA_PACKAGE_READINESS_MODE=strict`

Run `node scripts/package-readiness.mjs --help` for the executable mode summary.

Default readiness remains private-first advisory only for the expected private
package blockers. The advisory command returns `mode:"private-first-advisory"`
and `ok:true` while the only blockers are the intentionally private packages. If
any non-private blocker appears, the default command returns `mode:"release-gate"`
and `ok:false`. Strict mode returns `mode:"release-gate-strict"` and `ok:false`
until package privacy, license, repository metadata, and warnings are resolved.

## Public Release Blockers

The known blockers before any public npm release are:

- remove package-level `private:true` only after a visibility decision;
- replace `UNLICENSED` with the chosen public license, if public distribution is
  approved;
- add real repository metadata once the public repository URL is canonical;
- keep `smoke:tarball` green so packed manifests prove dependency rewrites.

## CI Contract

CI must run, in order:

1. install dependencies;
2. typecheck;
3. test;
4. lint;
5. audit;
6. build;
7. package readiness, advisory by default;
8. package smoke;
9. tarball smoke.

The readiness gate is intentionally non-publishing. Publishing remains out of
scope for the current private-first implementation cycle. Strict readiness is
available for explicit release-candidate checks, but it must not replace the
default private-first CI command until a public-release decision exists.
