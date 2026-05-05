import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  essentialPackedFiles,
  isCanonicalPackageName,
  isHarnessScopePackageName,
  nodeEngineRange,
  packageFilesAllowlist,
  packageNames,
  readPackage,
  readRootPackage,
} from "./package-policy.mjs";

export function dependencyEntries(manifest) {
  return Object.entries({
    ...manifest.dependencies,
    ...manifest.peerDependencies,
    ...manifest.optionalDependencies,
  });
}

export function hasDependencyProtocolLeak(manifest) {
  return dependencyEntries(manifest).filter(([, value]) =>
    /^(workspace:|link:|file:)/.test(String(value)),
  );
}

export function createIssue(packageName, severity, field, message) {
  return {
    package: packageName,
    severity,
    field,
    message,
  };
}

export function validatePackageManifest(packageName, manifest) {
  const issues = [];

  if (manifest.private === true) {
    issues.push(
      createIssue(
        packageName,
        "blocker",
        "private",
        "Package is intentionally private; npm publish is blocked until the public-release decision changes.",
      ),
    );
  }

  for (const field of ["description", "license", "repository", "keywords", "engines"]) {
    if (manifest[field] === undefined) {
      issues.push(
        createIssue(packageName, "warning", field, `Missing package metadata: ${field}.`),
      );
    }
  }

  if (manifest.engines?.node !== nodeEngineRange) {
    issues.push(
      createIssue(
        packageName,
        "warning",
        "engines.node",
        `Expected engines.node to be ${nodeEngineRange} for the documented runtime floor.`,
      ),
    );
  }

  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    issues.push(
      createIssue(
        packageName,
        "warning",
        "files",
        "Missing explicit files allowlist; packed surface is implicit.",
      ),
    );
  } else if (JSON.stringify(manifest.files) !== JSON.stringify(packageFilesAllowlist)) {
    issues.push(
      createIssue(
        packageName,
        "warning",
        "files",
        `Expected files allowlist ${JSON.stringify(packageFilesAllowlist)}.`,
      ),
    );
  }

  if (manifest.main !== "./dist/index.js") {
    issues.push(
      createIssue(packageName, "warning", "main", "Expected main to point to dist/index.js."),
    );
  }

  if (manifest.types !== "./dist/index.d.ts") {
    issues.push(
      createIssue(packageName, "warning", "types", "Expected types to point to dist/index.d.ts."),
    );
  }

  const exportsEntry = manifest.exports?.["."];
  if (exportsEntry?.import !== "./dist/index.js" || exportsEntry?.types !== "./dist/index.d.ts") {
    issues.push(
      createIssue(
        packageName,
        "warning",
        "exports",
        'Expected exports["."] to expose dist index import and types.',
      ),
    );
  }

  for (const file of essentialPackedFiles) {
    if (file === "package.json") {
      continue;
    }

    if (!packageFilesAllowlist.some((allowed) => file.startsWith(`${allowed}/`))) {
      issues.push(
        createIssue(
          packageName,
          "warning",
          "files",
          `Essential packed file is not allowlisted: ${file}.`,
        ),
      );
    }
  }

  for (const [dependencyName, specifier] of hasDependencyProtocolLeak(manifest)) {
    issues.push(
      createIssue(
        packageName,
        "warning",
        `dependencies.${dependencyName}`,
        `Source manifest uses local dependency protocol ${specifier}; tarball smoke must prove packed manifest rewrite.`,
      ),
    );
  }

  for (const [dependencyName] of dependencyEntries(manifest)) {
    if (isHarnessScopePackageName(dependencyName) && !isCanonicalPackageName(dependencyName)) {
      issues.push(
        createIssue(
          packageName,
          "blocker",
          `dependencies.${dependencyName}`,
          "Internal dependency is not part of the canonical package set.",
        ),
      );
    }
  }

  return issues;
}

export function summarizePackageReadiness(rootManifest, packageManifests, options = {}) {
  const issues = [];

  if (rootManifest.private !== true) {
    issues.push(
      createIssue(
        rootManifest.name ?? "root",
        "blocker",
        "private",
        "Workspace root must stay private; only packages are publish candidates.",
      ),
    );
  }

  for (const packageName of packageNames) {
    issues.push(...validatePackageManifest(packageName, packageManifests[packageName]));
  }

  const blockers = issues.filter((issue) => issue.severity === "blocker");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const releaseReady = blockers.length === 0 && warnings.length === 0;
  const advisoryOnly = blockers.every(
    (issue) => issue.field === "private" && issue.message.includes("intentionally private"),
  );
  const strict = options.strict === true;

  return {
    ok: strict ? releaseReady : advisoryOnly,
    mode: strict ? "release-gate-strict" : advisoryOnly ? "private-first-advisory" : "release-gate",
    releaseReady,
    packagesChecked: packageNames.length,
    blockers: blockers.length,
    warnings: warnings.length,
    issues,
  };
}

export async function runPackageReadiness(options = {}) {
  const packageManifests = Object.fromEntries(
    await Promise.all(
      packageNames.map(async (packageName) => [packageName, await readPackage(packageName)]),
    ),
  );

  return summarizePackageReadiness(await readRootPackage(), packageManifests, options);
}

if (isMainModule()) {
  const cliOptions = readCliOptions(process.argv.slice(2), process.env);
  if (cliOptions.help) {
    console.log(packageReadinessUsage());
  } else if (cliOptions.unknownArgs.length > 0) {
    console.error(`Unknown package readiness option(s): ${cliOptions.unknownArgs.join(", ")}`);
    console.error("");
    console.error(packageReadinessUsage());
    process.exitCode = 2;
  } else {
    const result = await runPackageReadiness(cliOptions);
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) {
      process.exitCode = 1;
    }
  }
}

export function readCliOptions(argv, env = process.env) {
  const knownArgs = new Set(["--strict", "--help", "-h"]);
  const help = argv.includes("--help") || argv.includes("-h");
  const unknownArgs = argv.filter((arg) => !knownArgs.has(arg));
  const strict =
    argv.includes("--strict") ||
    env.HIMA_PACKAGE_READINESS_STRICT === "1" ||
    env.HIMA_PACKAGE_READINESS_MODE === "strict";

  return { strict, help, unknownArgs };
}

export function packageReadinessUsage() {
  return [
    "Usage: node scripts/package-readiness.mjs [--strict] [--help]",
    "",
    "Workspace scripts:",
    "  pnpm package:readiness         Run advisory private-first readiness.",
    "  pnpm package:readiness:strict  Run strict release-candidate readiness.",
    "",
    "Modes:",
    "  default   Advisory private-first readiness. Exits 0 while only expected private package blockers remain.",
    "  --strict  Release-candidate gate. Exits non-zero unless releaseReady is true.",
    "",
    "Environment:",
    "  HIMA_PACKAGE_READINESS_STRICT=1     Enable strict mode.",
    "  HIMA_PACKAGE_READINESS_MODE=strict  Enable strict mode.",
  ].join("\n");
}

function isMainModule() {
  return path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] ?? "");
}
