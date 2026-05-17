import type { SubPhase } from "../types/canonical.js";

export const WRITE_ZONES_BY_SUB_PHASE: Readonly<Record<SubPhase, readonly string[]>> = {
  Observer: [".planning/01-discovery/", ".planning/09-logs/"],
  Define: [".planning/02-backlog/", ".planning/09-logs/"],
  Design: ["docs/13-decisions/", ".planning/04-conception/", ".planning/09-logs/"],
  Execute: [
    "src/",
    "test/",
    "tests/",
    "packages/*/src/",
    "app.js",
    "build.js",
    "index.html",
    "package.json",
    "benchmark_report.md",
    "readme.md",
    "scripts/",
    "styles.css",
    ".planning/09-logs/",
  ],
  Verify: ["test/", "tests/", "packages/*/test/", ".planning/05-validation/", ".planning/09-logs/"],
  Capitalize: [".planning/06-release/", "releases/", ".planning/09-logs/"],
  Transmit: ["docs/", ".planning/08-learning/", ".planning/09-logs/"],
};

export const DEFAULT_WRITE_ZONES: readonly string[] = [".planning/09-logs/"];

export function getAllowedWriteZones(subPhase: SubPhase | null): readonly string[] {
  return subPhase === null ? DEFAULT_WRITE_ZONES : WRITE_ZONES_BY_SUB_PHASE[subPhase];
}

export function isAllowedWriteTarget(
  target: string,
  allowedZones: readonly string[] = DEFAULT_WRITE_ZONES,
): boolean {
  const normalizedTarget = normalizeWriteTarget(target);

  return allowedZones.some((zone) => matchesWriteZone(normalizedTarget, zone));
}

function matchesWriteZone(target: string, zone: string): boolean {
  const zoneWithoutSlash = zone.endsWith("/") ? zone.slice(0, -1) : zone;

  if (!zone.includes("*")) {
    return target === zoneWithoutSlash || target.startsWith(zone);
  }

  const pattern =
    "^" +
    escapeRegExp(zoneWithoutSlash).replaceAll("*", "[^/]+").replaceAll("/", "\\/") +
    "(?:\\/|$)";

  return new RegExp(pattern).test(target);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeWriteTarget(value: string): string {
  const slashNormalized = value
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "")
    .toLowerCase();

  return pathSafeNormalize(slashNormalized).replace(/^\.\/+/, "");
}

function pathSafeNormalize(value: string): string {
  if (value.length === 0) {
    return value;
  }

  const segments: string[] = [];

  for (const segment of value.split("/")) {
    if (segment.length === 0 || segment === ".") {
      continue;
    }

    if (segment === "..") {
      if (segments.length > 0 && segments.at(-1) !== "..") {
        segments.pop();
        continue;
      }

      segments.push(segment);
      continue;
    }

    segments.push(segment);
  }

  return segments.join("/");
}
