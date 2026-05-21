#!/usr/bin/env node

/**
 * GOAL-3 — Install activate-Pn structural-activation skills
 *
 * Reads activate-skills.json (generator output), renders each entry as a
 * SKILL.md (YAML frontmatter + managed header + body) and writes it to BOTH
 * adapter destinations under --target:
 *
 *   <target>/.claude/skills/<name>/SKILL.md
 *   <target>/.codex/skills/<name>/SKILL.md
 *
 * Paths match D6 resolved paths:
 *   adapter-claude → <projectRoot>/.claude/skills/<name>/SKILL.md
 *   adapter-codex  → <projectRoot>/.codex/skills/<name>/SKILL.md
 *   (artifact-paths.ts:17 + platform-install.ts:94-95,108)
 *
 * Managed header (exact literal):
 *   <!-- HIMA:SKILL-ARTIFACT name=<name> source=consommable-generator -->
 *
 * Flags:
 *   --target <dir>   Root dir for install (default: C:\hima-runtime-workspaces\g3-activate-proof)
 *   --dry-run        Plan only — print 32 planned writes, touch nothing
 *   --source <path>  Override path to activate-skills.json
 *
 * Idempotent: if the destination file exists, is managed, and content is
 * identical, the write is skipped (reported as SKIP).
 *
 * Exit: 0 on success or dry-run, non-zero on error.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, "..");

// ── Managed header sentinel ──────────────────────────────────────────────────
const MANAGED_HEADER_PREFIX = "<!-- HIMA:SKILL-ARTIFACT";

// ── Default paths ────────────────────────────────────────────────────────────
const DEFAULT_TARGET =
  process.platform === "win32"
    ? "C:\\hima-runtime-workspaces\\g3-activate-proof"
    : "/tmp/g3-activate-proof";

const DEFAULT_SOURCE = join(
  REPO_ROOT,
  "packages",
  "generator",
  "src",
  "generated",
  "activate-skills.json",
);

// ── CLI parsing ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);

function flag(name) {
  const i = argv.indexOf(name);
  return i !== -1 ? (argv[i + 1] ?? null) : null;
}

const isDryRun = argv.includes("--dry-run");
const targetRoot = resolve(flag("--target") ?? DEFAULT_TARGET);
const sourcePath = resolve(flag("--source") ?? DEFAULT_SOURCE);

// ── Adapters (D6 resolved paths) ─────────────────────────────────────────────
const ADAPTERS = [".claude", ".codex"];

// ── YAML frontmatter renderer ─────────────────────────────────────────────────
/**
 * Renders a frontmatter object to a YAML block.
 * Handles scalar strings, booleans, arrays of scalars.
 * Does NOT handle nested objects (not needed for activate skills).
 */
function renderFrontmatter(fm) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(fm)) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          // Scalar items — quote if they contain special chars
          const safe =
            String(item).includes(":") || String(item).includes("#")
              ? `"${String(item).replace(/"/g, '\\"')}"`
              : String(item);
          lines.push(`  - ${safe}`);
        }
      }
    } else if (typeof value === "boolean") {
      lines.push(`${key}: ${value}`);
    } else if (value === null || value === undefined) {
      lines.push(`${key}: ~`);
    } else {
      const str = String(value);
      // Quote if the value contains special YAML chars
      const needsQuote = /[:{}[\],#|>&*!,]/.test(str) || str.includes("\n");
      const safe = needsQuote ? `"${str.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : str;
      lines.push(`${key}: ${safe}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

// ── SKILL.md content renderer ─────────────────────────────────────────────────
/**
 * Renders the full SKILL.md content for one activate skill entry.
 *
 * The body field from activate-skills.json already contains the managed header
 * as its first line. We still render the YAML frontmatter block above it.
 *
 * Final structure:
 *   ---
 *   <YAML frontmatter>
 *   ---
 *   <!-- HIMA:SKILL-ARTIFACT name=<name> source=consommable-generator -->
 *   <rest of body>
 */
function renderSkillMd(entry) {
  const frontmatterBlock = renderFrontmatter(entry.frontmatter);
  // body already starts with the managed header line
  return `${frontmatterBlock}\n${entry.body}\n`;
}

// ── Idempotency check ─────────────────────────────────────────────────────────
/**
 * Returns 'SKIP' if the file exists, is managed, and content is identical.
 * Returns 'WRITE' if new or content differs.
 * Returns 'OVERWRITE_UNMANAGED' if file exists but lacks managed header
 * (we still write it — install always wins over unmanaged content).
 */
function classifyWrite(destPath, content) {
  if (!existsSync(destPath)) return "WRITE";
  const existing = readFileSync(destPath, "utf8");
  if (!existing.includes(MANAGED_HEADER_PREFIX)) return "OVERWRITE_UNMANAGED";
  if (existing === content) return "SKIP";
  return "WRITE";
}

// ── Main ──────────────────────────────────────────────────────────────────────
function main() {
  // 1. Load source JSON
  if (!existsSync(sourcePath)) {
    console.error(`[G3-INSTALL] ERROR: activate-skills.json not found at:\n  ${sourcePath}`);
    console.error("Run the generator first: corepack pnpm --filter @hima/generator build");
    process.exit(1);
  }

  let skills;
  try {
    skills = JSON.parse(readFileSync(sourcePath, "utf8"));
  } catch (err) {
    console.error(`[G3-INSTALL] ERROR: Failed to parse activate-skills.json: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(skills) || skills.length === 0) {
    console.error("[G3-INSTALL] ERROR: activate-skills.json is empty or not an array.");
    process.exit(1);
  }

  // 2. Build plan: 16 skills × 2 adapters = 32 planned writes
  const plan = [];
  for (const entry of skills) {
    const name = entry.frontmatter?.name;
    if (!name) {
      console.warn("[G3-INSTALL] WARN: entry missing frontmatter.name — skipped");
      continue;
    }
    const content = renderSkillMd(entry);
    for (const adapter of ADAPTERS) {
      // D6 resolved path: <target>/<adapter>/skills/<name>/SKILL.md
      const destPath = join(targetRoot, adapter, "skills", name, "SKILL.md");
      plan.push({ name, adapter, destPath, content });
    }
  }

  // 3. Print plan header
  console.log(`[G3-INSTALL] ${isDryRun ? "DRY-RUN — " : ""}activate-skills install`);
  console.log(`  source : ${sourcePath}`);
  console.log(`  target : ${targetRoot}`);
  console.log(`  skills : ${skills.length}`);
  console.log(`  adapters: ${ADAPTERS.join(", ")}`);
  console.log(`  planned writes: ${plan.length}`);
  console.log("");

  // 4. Execute (or dry-run)
  const results = { WRITE: 0, SKIP: 0, OVERWRITE_UNMANAGED: 0 };

  for (const { name, adapter, destPath, content } of plan) {
    const action = classifyWrite(destPath, content);

    if (isDryRun) {
      console.log(`  [DRY-RUN] ${action.padEnd(22)} ${adapter}/skills/${name}/SKILL.md`);
      console.log(`             → ${destPath}`);
    } else {
      if (action === "SKIP") {
        console.log(`  [SKIP]    ${adapter}/skills/${name}/SKILL.md  (identical + managed)`);
      } else {
        const dir = dirname(destPath);
        mkdirSync(dir, { recursive: true });
        writeFileSync(destPath, content, "utf8");
        console.log(
          `  [${action}]${" ".repeat(Math.max(0, 20 - action.length))} ${adapter}/skills/${name}/SKILL.md`,
        );
      }
    }

    results[action] = (results[action] ?? 0) + 1;
  }

  // 5. Summary
  console.log("");
  if (isDryRun) {
    console.log(
      `[G3-INSTALL] DRY-RUN COMPLETE — ${plan.length} planned writes across ${ADAPTERS.length} adapters`,
    );
    console.log(
      `  Adapters : ${ADAPTERS.map((a) => `${targetRoot}/${a}/skills/<name>/SKILL.md`).join("\n             ")}`,
    );
  } else {
    const wrote = results.WRITE + results.OVERWRITE_UNMANAGED;
    const skipped = results.SKIP;
    console.log(`[G3-INSTALL] DONE — wrote: ${wrote}, skipped: ${skipped} (identical+managed)`);
  }
}

main();
