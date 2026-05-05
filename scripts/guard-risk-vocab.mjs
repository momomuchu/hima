import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const thisFile = path.resolve(fileURLToPath(import.meta.url));

const scopedRoots = [
  "docs/propositions/pipeline-fractal-v4-final-proposal",
  "docs/propositions/pipeline-fractal-v4-specs",
  "docs/implementation",
  "docs/INDEX.md",
  "packages",
  "package.json",
];

const ignoredDirectories = new Set([
  ".git",
  ".turbo",
  ".pnpm-store",
  "coverage",
  "dist",
  "node_modules",
]);

const scannedExtensions = new Set([
  ".cjs",
  ".cts",
  ".json",
  ".js",
  ".md",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

const checks = [
  {
    label: "old five-class risk sequence",
    pattern: /\bT\s*\/\s*F\s*\/\s*M\s*\/\s*(?:E|É)\s*\/\s*C\b/giu,
    replacement: "T/L/M/H/C",
  },
  {
    label: "old low-risk pair",
    pattern: /\bT\s*\/\s*F\b/giu,
    replacement: "T/L",
  },
  {
    label: "old governed-risk triplet",
    pattern: /\bM\s*\/\s*(?:E|É)\s*\/\s*C\b/giu,
    replacement: "M/H/C",
  },
  {
    label: "old high/critical pair",
    pattern: /\b(?:E|É)\s*\/\s*C\b/giu,
    replacement: "H/C",
  },
  {
    label: "old F risk class assignment",
    pattern: /["']?\b[a-z_]*risk_class["']?\s*[:=]\s*["']?F["']?/giu,
    replacement: "risk_class: L",
  },
  {
    label: "old E risk class assignment",
    pattern: /["']?\b[a-z_]*risk_class["']?\s*[:=]\s*["']?(?:E|É)["']?/giu,
    replacement: "risk_class: H",
  },
  {
    label: "old F minimum class assignment",
    pattern: /["']?\bminimum_class["']?\s*[:=]\s*["']?F["']?/giu,
    replacement: "minimum_class: L",
  },
  {
    label: "old E minimum class assignment",
    pattern: /["']?\bminimum_class["']?\s*[:=]\s*["']?(?:E|É)["']?/giu,
    replacement: "minimum_class: H",
  },
  {
    label: "old standalone F class token",
    pattern: /`F`/gu,
    replacement: "`L`",
  },
  {
    label: "old standalone E class token",
    pattern: /`(?:E|É)`/gu,
    replacement: "`H`",
  },
  {
    label: "old F risk map key",
    pattern: /^[ \t]*F\s*:\s*(?:"[^"]+"|'[^']+'|true|false|[A-Z_]+)\b/gmu,
    replacement: "L: <same boolean>",
  },
  {
    label: "old E risk map key",
    pattern: /^[ \t]*(?:E|É)\s*:\s*(?:"[^"]+"|'[^']+'|true|false|[A-Z_]+)\b/gmu,
    replacement: "H: <same boolean>",
  },
  {
    label: "old boolean risk_allowed field",
    pattern: /["']?\brisk_allowed["']?\s*:\s*(?:true|false)\b/giu,
    replacement: "gap_allowed_by_risk_policy or risk_allowed: { T/L/M/H/C }",
  },
  {
    label: "old F from/to transition value",
    pattern: /\b(?:from|to)\s*:\s*["']F["']/giu,
    replacement: "from/to: L",
  },
  {
    label: "old E from/to transition value",
    pattern: /\b(?:from|to)\s*:\s*["'](?:E|É)["']/giu,
    replacement: "from/to: H",
  },
  {
    label: "old F risk-order list item",
    pattern: /^[ \t]*-\s*["']F["']\s*$/gmu,
    replacement: '- "L"',
  },
  {
    label: "old E risk-order list item",
    pattern: /^[ \t]*-\s*["'](?:E|É)["']\s*$/gmu,
    replacement: '- "H"',
  },
  {
    label: "old prose F risk token",
    pattern:
      /\bF[-\s]+(?:proofs|risk|work|gap|gaps|route|class|signal|forcing|supervision|enforcement|minimum|rollback|only)\b/giu,
    replacement: "L <same noun>",
  },
  {
    label: "old prose E risk token",
    pattern:
      /\b(?:E|É)[-\s]+(?:proofs|risk|work|gap|gaps|route|class|signal|forcing|supervision|enforcement|minimum|rollback|only)\b/giu,
    replacement: "H <same noun>",
  },
  {
    label: "old conditional F risk phrase",
    pattern: /\bconditional\s+for\s+F\b/giu,
    replacement: "conditional for L",
  },
  {
    label: "non-canonical English low/high risk phrase",
    pattern:
      /\b(?:low|high)[-\s]+(?:risk|proofs?|gaps?|routes?|classes?|signals?|warnings?|enforcement|policy|supervision|minimum|rollback|continuation|run|actions?|increments?|controls?|checkpoints?)\b/giu,
    replacement: "L-risk or H-risk wording",
  },
  {
    label: "non-canonical low/high before risk phrase",
    pattern: /\b(?:low|high)\s+[a-z][\p{L}\p{N}_-]{0,40}\s+risk\b/giu,
    replacement: "L-risk or H-risk wording",
  },
  {
    label: "non-canonical risk low/high phrase",
    pattern: /\brisk\s+(?:low|high)\b/giu,
    replacement: "risk L or risk H",
  },
  {
    label: "non-canonical risk remains low/high phrase",
    pattern: /\brisk\s+remains\s+(?:low|high)\b/giu,
    replacement: "risk remains L or H",
  },
  {
    label: "old Risk F label",
    pattern: /\bRisk\s+F\b/giu,
    replacement: "Risk L",
  },
  {
    label: "old Risk E label",
    pattern: /\bRisk\s+(?:E|É)\b/giu,
    replacement: "Risk H",
  },
  {
    label: "old risk policy namespace",
    pattern: /\brisk_policy\.(?:F|E|É)\b/giu,
    replacement: "risk_policy.L or risk_policy.H",
  },
  {
    label: "old closing policy namespace",
    pattern: /\bclosing\.[A-Z_]+\.(?:F|E|É)\./giu,
    replacement: "closing.<state>.L or closing.<state>.H",
  },
  {
    label: "old compact risk-class array",
    pattern:
      /\[\s*["']T["']\s*,\s*["']F["']\s*\]|\[\s*["']M["']\s*,\s*["'](?:E|É)["']\s*,\s*["']C["']\s*\]/giu,
    replacement: '["T", "L"] or ["M", "H", "C"]',
  },
  {
    label: "old risk rank ordering",
    pattern: /\bUNCLASSIFIED\s*<\s*T\s*<\s*F\s*<\s*M\s*<\s*(?:E|É)\s*<\s*C\b/giu,
    replacement: "UNCLASSIFIED < T < L < M < H < C",
  },
  {
    label: "old French low/high class name",
    pattern: /\b(?:faible|Faible|[ÉEée]lev[ée]?|eleve|Eleve)\b/gu,
    replacement: "Low/High using L/H identifiers",
  },
];

const issues = [];

for (const scopedRoot of scopedRoots) {
  const absolute = path.join(root, scopedRoot);

  for await (const filePath of walkScoped(absolute)) {
    if (!shouldScan(filePath)) {
      continue;
    }

    const relativePath = path.relative(root, filePath).replaceAll(path.sep, "/");
    const content = await readOptionalTextFile(filePath);

    if (content === undefined) {
      continue;
    }

    for (const check of checks) {
      for (const match of content.matchAll(check.pattern)) {
        issues.push({
          file: relativePath,
          line: lineNumberForIndex(content, match.index ?? 0),
          check: check.label,
          text: match[0],
          replacement: check.replacement,
        });
      }
    }
  }
}

if (issues.length > 0) {
  console.error("Risk vocabulary guard failed.");
  console.error("Canonical risk classes are: T/L/M/H/C.");
  console.error("Legacy F/E/É risk identifiers are not allowed in active specs or packages.");
  console.error("");

  for (const issue of issues) {
    console.error(
      `${issue.file}:${issue.line} [${issue.check}] ${JSON.stringify(issue.text)} -> ${issue.replacement}`,
    );
  }

  process.exitCode = 1;
}

async function* walkScoped(entryPath) {
  let entries;

  try {
    entries = await readdir(entryPath, { withFileTypes: true });
  } catch {
    yield entryPath;
    return;
  }

  for (const entry of entries) {
    const childPath = path.join(entryPath, entry.name);

    if (entry.isDirectory()) {
      if (!shouldIgnoreDirectory(entry.name)) {
        yield* walkScoped(childPath);
      }
      continue;
    }

    if (entry.isFile()) {
      yield childPath;
    }
  }
}

function shouldScan(filePath) {
  if (path.resolve(filePath) === thisFile) {
    return false;
  }

  return scannedExtensions.has(path.extname(filePath));
}

function shouldIgnoreDirectory(directoryName) {
  return ignoredDirectories.has(directoryName) || directoryName.startsWith(".tmp-");
}

function lineNumberForIndex(content, index) {
  let line = 1;

  for (let offset = 0; offset < index; offset += 1) {
    if (content.charCodeAt(offset) === 10) {
      line += 1;
    }
  }

  return line;
}

async function readOptionalTextFile(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return undefined;
    }

    throw error;
  }
}

function isNodeErrorWithCode(error, code) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
