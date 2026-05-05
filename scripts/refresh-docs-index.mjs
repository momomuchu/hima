import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexFile = path.join(root, "docs", "INDEX.md");
const checkOnly = process.argv.includes("--check");
const writeIndex = process.argv.includes("--write") || !checkOnly;

const categoryByHeading = new Map([
  ["## 1. Architecture", "Architecture"],
  ["## 2. Conception Specs", "Conception Specs"],
  ["## 3. Cycle Docs", "Cycle Docs"],
  ["## 4. Transversal", "Transversal"],
  ["## 5. Business Model", "Business Model"],
  ["## 6. Propositions", "Propositions"],
  ["## 7. Research", "Research Reports"],
  ["## 8. Open Questions", "Open Questions"],
  ["## 9. Audit Trail", "Audit Trail"],
  ["## 10. Decisions", "Decisions"],
  ["## 11. Other Indexes", "Other Indexes"],
]);

const original = await readFile(indexFile, "utf8");
const indexLines = original.split(/\r?\n/);
const rows = [];
let rowNumber = 0;
let currentCategory = null;

for (const line of indexLines) {
  for (const [heading, category] of categoryByHeading) {
    if (line.startsWith(heading)) {
      currentCategory = category;
      break;
    }
  }

  const row = parseIndexRow(line);
  if (!row) {
    continue;
  }

  rowNumber += 1;
  const resolved = await resolveIndexedPath(row.path);
  rows.push({
    ...row,
    category: currentCategory,
    number: rowNumber,
    lines: resolved.lines ?? row.lines,
  });
}

const stats = buildStats(rows);
let nextRow = 0;
let inStatisticsTable = false;

const refreshedLines = [];
for (const line of indexLines) {
  if (line.startsWith("> **Total files indexed**:")) {
    refreshedLines.push(
      `> **Total files indexed**: ${stats.documentFiles} documents + ${stats.auditFiles} audit trails`,
    );
    continue;
  }

  if (line.startsWith("> **Total lines**:")) {
    refreshedLines.push(
      `> **Total lines**: ~${formatNumber(roundToHundreds(stats.documentLines))} (docs) + ~${formatNumber(roundToHundreds(stats.auditLines))} (audits)`,
    );
    continue;
  }

  if (line === "## Statistics") {
    inStatisticsTable = true;
    refreshedLines.push(line);
    continue;
  }

  const row = parseIndexRow(line);
  if (row) {
    const refreshed = rows[nextRow];
    nextRow += 1;
    refreshedLines.push(
      `| ${refreshed.number} | \`${refreshed.path}\` | ${refreshed.lines} | ${refreshed.status} | ${refreshed.description} |`,
    );
    continue;
  }

  if (inStatisticsTable) {
    const categoryLine = refreshCategoryLine(line, stats);
    if (categoryLine !== null) {
      refreshedLines.push(categoryLine);
      continue;
    }
  }

  refreshedLines.push(line);
}

const refreshed = refreshedLines.join("\n");

if (checkOnly && refreshed !== original) {
  console.error("docs/INDEX.md is stale. Run: corepack pnpm docs:index");
  process.exitCode = 1;
} else if (writeIndex && refreshed !== original) {
  await writeFile(indexFile, refreshed, "utf8");
}

function parseIndexRow(line) {
  const match =
    /^\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(.*?)\s*\|$/.exec(line);

  if (!match) {
    return null;
  }

  return {
    originalNumber: Number.parseInt(match[1], 10),
    path: match[2],
    lines: match[3].trim(),
    status: match[4].trim(),
    description: match[5].trim(),
  };
}

async function resolveIndexedPath(indexPath) {
  const absolute = resolveAbsoluteIndexPath(indexPath);

  if (indexPath.includes("*")) {
    return resolveWildcardPath(absolute);
  }

  try {
    const entryStat = await stat(absolute);
    if (!entryStat.isFile()) {
      return { lines: "--" };
    }

    return { lines: String(await countFileLines(absolute)) };
  } catch {
    return {};
  }
}

function resolveAbsoluteIndexPath(indexPath) {
  if (indexPath.startsWith("hima/")) {
    return path.join(root, indexPath.slice("hima/".length));
  }

  if (indexPath.startsWith("harness-architecture/") || indexPath.startsWith(".planning/")) {
    return path.join(root, "..", indexPath);
  }

  return path.join(root, indexPath);
}

async function resolveWildcardPath(absolutePattern) {
  const directory = path.dirname(absolutePattern);
  const basenamePattern = path.basename(absolutePattern);
  const matcher = wildcardMatcher(basenamePattern);

  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && matcher.test(entry.name))
      .map((entry) => path.join(directory, entry.name));

    if (files.length === 0) {
      return {};
    }

    const counts = await Promise.all(files.map(countFileLines));
    return { lines: String(counts.reduce((sum, count) => sum + count, 0)) };
  } catch {
    return {};
  }
}

function wildcardMatcher(pattern) {
  const escaped = pattern
    .split("*")
    .map((part) => part.replace(/[|\\{}()[\]^$+?.]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}$`);
}

async function countFileLines(filePath) {
  const content = await readFile(filePath, "utf8");
  if (content.length === 0) {
    return 0;
  }

  const lines = content.split(/\r?\n/);
  return lines.at(-1) === "" ? lines.length - 1 : lines.length;
}

function buildStats(indexRows) {
  const categoryStats = new Map();
  let documentFiles = 0;
  let auditFiles = 0;
  let documentLines = 0;
  let auditLines = 0;

  for (const row of indexRows) {
    const lineCount = Number.parseInt(row.lines, 10);
    const numericLines = Number.isNaN(lineCount) ? 0 : lineCount;
    const category = row.category ?? "Uncategorized";
    const current = categoryStats.get(category) ?? { files: 0, lines: 0 };

    categoryStats.set(category, {
      files: current.files + 1,
      lines: current.lines + numericLines,
    });

    if (category === "Audit Trail") {
      auditFiles += 1;
      auditLines += numericLines;
    } else {
      documentFiles += 1;
      documentLines += numericLines;
    }
  }

  return { categoryStats, documentFiles, auditFiles, documentLines, auditLines };
}

function refreshCategoryLine(line, stats) {
  const categoryMatch = /^\|\s*([^|*][^|]+?)\s*\|\s*[\d,]+\s*\|\s*[\d,]+\s*\|$/.exec(line);
  if (categoryMatch) {
    const category = categoryMatch[1].trim();
    const categoryStats = stats.categoryStats.get(category);
    if (!categoryStats) {
      return null;
    }

    return `| ${category} | ${formatNumber(categoryStats.files)} | ${formatNumber(categoryStats.lines)} |`;
  }

  const totalMatch = /^\|\s*\*\*Total\*\*\s*\|\s*\*\*[\d,]+\*\*\s*\|\s*\*\*~?[\d,]+\*\*\s*\|$/.exec(
    line,
  );
  if (totalMatch) {
    const totalFiles = stats.documentFiles + stats.auditFiles;
    const totalLines = stats.documentLines + stats.auditLines;
    return `| **Total** | **${formatNumber(totalFiles)}** | **~${formatNumber(totalLines)}** |`;
  }

  return null;
}

function roundToHundreds(value) {
  return Math.round(value / 100) * 100;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}
