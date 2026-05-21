import { access, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const root = path.resolve(readArg("--root") ?? defaultRoot);
const json = args.includes("--json");
const issues = [];

const markdownFiles = [];
for await (const filePath of walk(path.join(root, "docs"))) {
  if (filePath.endsWith(".md")) {
    markdownFiles.push(toRelativePath(filePath));
  }
}

const checks = [];
for (const relativePath of markdownFiles.sort()) {
  const content = await readRequiredText(relativePath);
  if (!isClaimBearingMarkdown(relativePath, content)) {
    continue;
  }

  const blocks = extractFalsifiesBlocks(content);
  checks.push({
    path: relativePath,
    requirement: "claim-bearing markdown must include Falsifies-If block",
    result: blocks.length > 0 ? "pass" : "fail",
  });

  for (const [index, block] of blocks.entries()) {
    const blockLabel =
      blocks.length === 1 ? "Falsifies-If block" : `Falsifies-If block ${index + 1}`;
    const anchor = extractFalsifiesField(block, "evidence-anchor");
    const anchorTarget = anchor ? normalizeEvidenceAnchor(anchor, relativePath) : null;

    checks.push({
      path: relativePath,
      requirement: `${blockLabel} must include kill-condition`,
      result: extractFalsifiesField(block, "kill-condition") ? "pass" : "fail",
    });
    checks.push({
      path: relativePath,
      requirement: `${blockLabel} must include checkpoint-date`,
      result: extractFalsifiesField(block, "checkpoint-date") ? "pass" : "fail",
    });
    checks.push({
      path: relativePath,
      requirement: `${blockLabel} must include evidence-anchor`,
      result: anchor ? "pass" : "fail",
    });
    checks.push({
      path: relativePath,
      requirement: `${blockLabel} evidence-anchor must resolve`,
      evidence: anchorTarget?.display ?? "missing evidence-anchor",
      result: anchorTarget && (await evidenceAnchorResolves(anchorTarget)) ? "pass" : "fail",
    });
    checks.push({
      path: relativePath,
      requirement: `${blockLabel} must include on-fail`,
      result: extractFalsifiesField(block, "on-fail") ? "pass" : "fail",
    });
  }
}

for (const check of checks) {
  if (check.result === "fail") {
    issues.push(`${check.path}: ${check.requirement}`);
  }
}

const report = {
  status: issues.length === 0 ? "pass" : "fail",
  claimBearingFiles: new Set(checks.map((check) => check.path)).size,
  checks: checks.length,
  issues,
};

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(
    `Claim-bearing Falsifies-If validation: ${report.status}; files ${report.claimBearingFiles}; checks ${report.checks}`,
  );
}

if (issues.length > 0) {
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exitCode = 1;
}

async function* walk(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      yield* walk(entryPath);
    } else if (entry.isFile()) {
      yield entryPath;
    }
  }
}

function readArg(name) {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

async function readRequiredText(relativePath) {
  return await readFile(path.join(root, relativePath), "utf8");
}

function toRelativePath(filePath) {
  return path.relative(root, filePath).replace(/\\/gu, "/");
}

function isClaimBearingMarkdown(relativePath, content) {
  const basename = relativePath.split("/").at(-1) ?? "";
  if (relativePath.startsWith("docs/business-model/")) {
    return !basename.startsWith("research-") && !basename.startsWith("verification-");
  }

  if (relativePath.startsWith("docs/decisions/")) {
    return true;
  }

  return /^---\s*\r?\n[\s\S]*?\bclaim-bearing:\s*true\b[\s\S]*?\r?\n---/u.test(content);
}

function extractFalsifiesBlocks(content) {
  const blocks = [];
  const blockPattern = /^Falsifies-If:\s*\r?\n(?<body>(?:[ \t]+.*(?:\r?\n|$))+)/gmu;

  for (const match of content.matchAll(blockPattern)) {
    blocks.push(match.groups?.body ?? "");
  }

  return blocks;
}

function extractFalsifiesField(block, field) {
  const match = block.match(new RegExp(`^\\s*${escapeRegExp(field)}:\\s*(?<value>\\S.*)$`, "mu"));
  return match?.groups?.value.trim() ?? "";
}

function normalizeEvidenceAnchor(anchor, sourceRelativePath) {
  if (/^https?:\/\//iu.test(anchor)) {
    return { kind: "url", display: anchor };
  }

  const cleaned = anchor.replace(/^["'`]|["'`]$/gu, "");
  if (/^this file(?:\b|$)/iu.test(cleaned)) {
    return {
      kind: "local",
      display: cleaned,
      file: sourceRelativePath,
      startLine: null,
      endLine: null,
      section: extractSection(cleaned),
    };
  }

  const localPathMatch = cleaned.match(
    /(?<file>(?:\.hima|docs|fixtures|packages|scripts)\/[^\s`),;]+?)(?=$|\s|\)|,|;)/u,
  );
  if (localPathMatch?.groups?.file) {
    const file = localPathMatch.groups.file.trim();
    const lineMatch = file.match(/^(?<file>.+?)(?::(?<start>\d+)(?:-(?<end>\d+))?)?$/u);
    return {
      kind: "local",
      display: cleaned,
      file: lineMatch?.groups?.file.trim() ?? file,
      startLine: lineMatch?.groups?.start ? Number.parseInt(lineMatch.groups.start, 10) : null,
      endLine: lineMatch?.groups?.end ? Number.parseInt(lineMatch.groups.end, 10) : null,
      section: extractSection(cleaned),
    };
  }

  const sectionSplit = cleaned.split(/\s+§\s*/u);
  const section = sectionSplit[1]?.trim() ?? null;
  const fileAndMaybeLines = sectionSplit[0]?.trim() ?? "";
  const lineMatch = fileAndMaybeLines.match(/^(?<file>.+?)(?::(?<start>\d+)(?:-(?<end>\d+))?)?$/u);
  const file = lineMatch?.groups?.file.trim() ?? "";

  return {
    kind: "local",
    display: cleaned,
    file,
    startLine: lineMatch?.groups?.start ? Number.parseInt(lineMatch.groups.start, 10) : null,
    endLine: lineMatch?.groups?.end ? Number.parseInt(lineMatch.groups.end, 10) : null,
    section,
  };
}

function extractSection(anchor) {
  const section =
    anchor
      .split(/\s+§\s*/u)[1]
      ?.split(/\s+\+\s+/u)[0]
      ?.trim() ?? null;
  return section;
}

async function evidenceAnchorResolves(anchor) {
  if (anchor.kind === "url") {
    return true;
  }

  if (!anchor.file) {
    return false;
  }

  const absolutePath = path.resolve(root, anchor.file);
  try {
    await access(absolutePath);
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return false;
    }
    throw error;
  }

  const anchorStats = await stat(absolutePath);
  if (anchorStats.isDirectory()) {
    return true;
  }

  if (!anchorStats.isFile()) {
    return false;
  }

  const content = await readFile(absolutePath, "utf8");
  const lines = content.split(/\r?\n/u);
  const startLine = anchor.startLine;
  const endLine = anchor.endLine ?? startLine;

  if (
    startLine !== null &&
    endLine !== null &&
    (!Number.isInteger(startLine) ||
      !Number.isInteger(endLine) ||
      startLine < 1 ||
      endLine < startLine ||
      endLine > lines.length)
  ) {
    return false;
  }

  if (anchor.section && !content.includes(anchor.section)) {
    return false;
  }

  return true;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isNodeErrorWithCode(error, code) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
