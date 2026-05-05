import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  packageReadinessUsage,
  readCliOptions,
  summarizePackageReadiness,
  validatePackageManifest,
} from "../../../scripts/package-readiness.mjs";

const baseManifest = {
  name: "@harness/example",
  version: "0.0.0",
  private: true,
  description: "Example package",
  license: "UNLICENSED",
  repository: { type: "git", url: "https://example.invalid/hima.git" },
  keywords: ["hima"],
  engines: { node: ">=20" },
  files: ["dist"],
  main: "./dist/index.js",
  types: "./dist/index.d.ts",
  exports: {
    ".": {
      types: "./dist/index.d.ts",
      import: "./dist/index.js",
    },
  },
};

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const packageReadinessScript = fileURLToPath(
  new URL("../../../scripts/package-readiness.mjs", import.meta.url),
);

function runPackageReadinessProcess(args: string[] = [], env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [packageReadinessScript, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      HIMA_PACKAGE_READINESS_MODE: "",
      HIMA_PACKAGE_READINESS_STRICT: "",
      ...env,
    },
  });
}

describe("package readiness", () => {
  it("blocks harness-scope dependencies outside the canonical package set", () => {
    const issues = validatePackageManifest("@harness/core", {
      ...baseManifest,
      dependencies: {
        "@harness/not-canonical": "workspace:*",
      },
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "blocker",
          field: "dependencies.@harness/not-canonical",
        }),
      ]),
    );
  });

  it("keeps private packages in advisory mode when private is the only blocker class", () => {
    const packageManifests = Object.fromEntries(
      [
        "@harness/core",
        "@harness/adapter-codex",
        "@harness/adapter-claude",
        "@harness/adapter-hermes",
        "@harness/cli",
        "@harness/mcp-server",
      ].map((packageName) => [packageName, { ...baseManifest, name: packageName }]),
    );

    expect(
      summarizePackageReadiness({ name: "hima", private: true }, packageManifests),
    ).toMatchObject({
      mode: "private-first-advisory",
      releaseReady: false,
      blockers: 6,
    });
  });

  it("supports an opt-in strict release gate without changing advisory defaults", () => {
    const packageManifests = Object.fromEntries(
      [
        "@harness/core",
        "@harness/adapter-codex",
        "@harness/adapter-claude",
        "@harness/adapter-hermes",
        "@harness/cli",
        "@harness/mcp-server",
      ].map((packageName) => [packageName, { ...baseManifest, name: packageName }]),
    );

    expect(
      summarizePackageReadiness({ name: "hima", private: true }, packageManifests),
    ).toMatchObject({
      ok: true,
      mode: "private-first-advisory",
      releaseReady: false,
    });
    expect(
      summarizePackageReadiness({ name: "hima", private: true }, packageManifests, {
        strict: true,
      }),
    ).toMatchObject({
      ok: false,
      mode: "release-gate-strict",
      releaseReady: false,
    });
  });

  it("fails default readiness when a non-private blocker is present", () => {
    const packageManifests = Object.fromEntries(
      [
        "@harness/core",
        "@harness/adapter-codex",
        "@harness/adapter-claude",
        "@harness/adapter-hermes",
        "@harness/cli",
        "@harness/mcp-server",
      ].map((packageName) => [packageName, { ...baseManifest, name: packageName }]),
    );
    packageManifests["@harness/core"] = {
      ...packageManifests["@harness/core"],
      dependencies: {
        "@harness/not-canonical": "workspace:*",
      },
    };

    expect(
      summarizePackageReadiness({ name: "hima", private: true }, packageManifests),
    ).toMatchObject({
      ok: false,
      mode: "release-gate",
      releaseReady: false,
    });
  });

  it("parses strict readiness from CLI flags and environment", () => {
    expect(readCliOptions(["--strict"], {})).toEqual({
      strict: true,
      help: false,
      unknownArgs: [],
    });
    expect(readCliOptions(["--help"], {})).toEqual({
      strict: false,
      help: true,
      unknownArgs: [],
    });
    expect(readCliOptions(["-h"], {})).toEqual({
      strict: false,
      help: true,
      unknownArgs: [],
    });
    expect(readCliOptions(["--strcit"], {})).toEqual({
      strict: false,
      help: false,
      unknownArgs: ["--strcit"],
    });
    expect(readCliOptions([], { HIMA_PACKAGE_READINESS_STRICT: "1" })).toEqual({
      strict: true,
      help: false,
      unknownArgs: [],
    });
    expect(readCliOptions([], { HIMA_PACKAGE_READINESS_MODE: "strict" })).toEqual({
      strict: true,
      help: false,
      unknownArgs: [],
    });
    expect(readCliOptions([], {})).toEqual({ strict: false, help: false, unknownArgs: [] });
  });

  it("documents package readiness modes in CLI usage text", () => {
    expect(packageReadinessUsage()).toContain("Usage: node scripts/package-readiness.mjs");
    expect(packageReadinessUsage()).toContain("pnpm package:readiness");
    expect(packageReadinessUsage()).toContain("pnpm package:readiness:strict");
    expect(packageReadinessUsage()).toContain("--strict");
    expect(packageReadinessUsage()).toContain("private-first");
    expect(packageReadinessUsage()).toContain("releaseReady");
  });

  it("exposes advisory and strict package readiness as workspace scripts", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
    );

    expect(manifest.scripts).toMatchObject({
      "package:readiness": "node scripts/package-readiness.mjs",
      "package:readiness:strict": "node scripts/package-readiness.mjs --strict",
    });
  });

  it("runs package readiness as a real CLI process", () => {
    const help = runPackageReadinessProcess(["--help"]);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain("Usage: node scripts/package-readiness.mjs");
    expect(help.stdout).toContain("pnpm package:readiness:strict");
    expect(help.stdout).toContain("HIMA_PACKAGE_READINESS_MODE=strict");

    const advisory = runPackageReadinessProcess();
    expect(advisory.status).toBe(0);
    expect(JSON.parse(advisory.stdout)).toMatchObject({
      ok: true,
      mode: "private-first-advisory",
      releaseReady: false,
    });

    const strict = runPackageReadinessProcess(["--strict"]);
    expect(strict.status).toBe(1);
    expect(JSON.parse(strict.stdout)).toMatchObject({
      ok: false,
      mode: "release-gate-strict",
      releaseReady: false,
    });

    const envStrict = runPackageReadinessProcess([], {
      HIMA_PACKAGE_READINESS_MODE: "strict",
    });
    expect(envStrict.status).toBe(1);
    expect(JSON.parse(envStrict.stdout)).toMatchObject({
      ok: false,
      mode: "release-gate-strict",
    });

    const typo = runPackageReadinessProcess(["--strcit"]);
    expect(typo.status).toBe(2);
    expect(typo.stderr).toContain("Unknown package readiness option(s): --strcit");
    expect(typo.stdout).toBe("");
  });
});
