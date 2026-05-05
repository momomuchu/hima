import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const thisFile = path.resolve(fileURLToPath(import.meta.url));
const ignoredFiles = new Set(["scripts/guard-runtime-artifact-vocab.test.mjs"]);

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
  ".jsonl",
  ".js",
  ".md",
  ".mjs",
  ".mts",
  ".toml",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

const checks = [
  {
    label: "stale runtime artifact axis",
    pattern: /\bskills\s*\/\s*subagents\s*\/\s*books\b/giu,
    replacement: "skills/hooks/subagents",
  },
  {
    label: "stale runtime artifact triplet",
    pattern: /\bskills,\s*subagents,?\s+and\s+books\b/giu,
    replacement: "skills, hooks, and subagents",
  },
  {
    label: "stale singular runtime artifact axis",
    pattern: /\bskill\s*\/\s*subagent\s*\/\s*book\b/giu,
    replacement: "skill/hook/subagent",
  },
  {
    label: "book artifact kind",
    pattern: /["']?artifact_kind["']?\s*:\s*["']?(?:book|books|reference docs?)["']?/giu,
    replacement: 'artifact_kind: "skill" | "hook" | "subagent"',
  },
  {
    label: "book manifest kind",
    pattern: /["']?kind["']?\s*:\s*["']?(?:book|books)["']?/giu,
    replacement: 'kind: "skill" | "hook" | "subagent"',
  },
  {
    label: "managed artifact header book kind",
    pattern: /<!--\s*HIMA:CATALOG-ARTIFACT\b[^>]*\bkind\s*=\s*["']?(?:book|books)["']?[^>]*-->/giu,
    replacement: "managed header kind=skill|hook|subagent",
  },
  {
    label: "book provenance field",
    pattern: /\bbook_provenance_ref\b/giu,
    replacement: "reference docs are tracked outside runtime artifact manifests",
  },
  {
    label: "book claim field",
    pattern: /\bbook_claim\b/giu,
    replacement: "reference_doc_claim",
  },
  {
    label: "book artifact id namespace",
    pattern: /\bartifact_id\s*:\s*["']?book\./giu,
    replacement: "artifact_id: skill.* | hook.* | subagent.*",
  },
];

const issues = [];

for await (const filePath of walk(root)) {
  if (!shouldScan(filePath)) {
    continue;
  }

  const relativePath = path.relative(root, filePath).replaceAll(path.sep, "/");
  const content = await readOptionalTextFile(filePath);

  if (content === undefined) {
    continue;
  }

  if (
    relativePath ===
    "docs/propositions/pipeline-fractal-v4-final-proposal/03-skills-subagents-books-taxonomy.md"
  ) {
    issues.push({
      file: relativePath,
      line: 1,
      check: "stale taxonomy filename",
      text: relativePath,
      replacement:
        "docs/propositions/pipeline-fractal-v4-final-proposal/03-skills-hooks-subagents-taxonomy.md",
    });
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

if (issues.length > 0) {
  console.error("Runtime artifact vocabulary guard failed.");
  console.error("Canonical runtime artifact families are: skill, hook, subagent.");
  console.error(
    "Reference docs, runbooks, and playbooks are documentation, not runtime artifacts.",
  );
  console.error("");

  for (const issue of issues) {
    console.error(
      `${issue.file}:${issue.line} [${issue.check}] ${JSON.stringify(issue.text)} -> ${issue.replacement}`,
    );
  }

  process.exitCode = 1;
}

async function* walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!shouldIgnoreDirectory(entry.name)) {
        yield* walk(entryPath);
      }
      continue;
    }

    if (entry.isFile()) {
      yield entryPath;
    }
  }
}

function shouldScan(filePath) {
  if (path.resolve(filePath) === thisFile) {
    return false;
  }

  const relativePath = path.relative(root, filePath).replaceAll(path.sep, "/");
  if (ignoredFiles.has(relativePath)) {
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
