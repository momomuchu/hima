#!/usr/bin/env node
/**
 * install.mjs — idempotently register norm-hermes-hook.mjs into Hermes's
 * shell-hook config.
 *
 * Ground truth (see norm-hermes-hook.mjs header for full source list):
 * Hermes shell hooks are declared in the `hooks:` block of
 * `~/.hermes/config.yaml` (or `$HERMES_HOME/config.yaml` when a profile is
 * active) — NOT via a `hermes hooks add` command (no such subcommand exists;
 * `hermes hooks` only offers list/test/revoke/doctor). There is also a
 * first-use consent allowlist (`~/.hermes/shell-hooks-allowlist.json`); a
 * non-interactive/CI session needs `hooks_auto_accept: true` in config.yaml
 * (or `HERMES_ACCEPT_HOOKS=1`) or the hook will sit unapproved and never fire.
 *
 * Config schema (agent/shell_hooks.py "Configuration schema"):
 *   hooks:
 *     <event_name>:
 *       - matcher: "<regex>"          # optional
 *         command: "<shell command>"  # required
 *         timeout: <seconds>          # optional, default 60, capped at 300
 *   hooks_auto_accept: false
 *
 * This installer does NOT use a YAML library (avoids adding a runtime
 * dependency to a script meant to run standalone against an arbitrary
 * Hermes profile). Instead it performs a narrow, well-tested text
 * transformation scoped exactly to this structure:
 *   - if no `hooks:` top-level key exists, append a fresh block;
 *   - if `hooks:` exists but the target event key is absent, insert it as a
 *     new child;
 *   - if the target event key exists, append our command as a new list item
 *     ONLY if it is not already present (idempotent — checked by searching
 *     for the bridge's absolute path, not the whole line).
 *   - `hooks_auto_accept: true` is added ONLY when the key is entirely
 *     absent; an existing explicit `true` or `false` is never overwritten
 *     (never silently weaken/strengthen a user's consent policy) — a
 *     `false` value produces a warning instead.
 *
 * Every transformation is exposed as `computeUpdatedConfigText` (pure,
 * string in / string out) so behaviour can be unit-tested without touching
 * the filesystem or the real `~/.hermes/config.yaml`.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { homedir } from "node:os";

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_EVENTS = Object.freeze(["pre_tool_call", "subagent_start"]);
export const DEFAULT_TIMEOUT_SEC = 15;

const THIS_FILE = fileURLToPath(import.meta.url);
export const DEFAULT_BRIDGE_PATH = resolve(dirname(THIS_FILE), "norm-hermes-hook.mjs");

// ---------------------------------------------------------------------------
// Pure text-transform helpers (exported for unit tests)
// ---------------------------------------------------------------------------

/** Build the shell-hook `command:` string for a given bridge script path. */
export function buildHookCommand(bridgePath, nodeBin = "node") {
  return `${nodeBin} "${bridgePath}"`;
}

function quoteYamlDouble(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function normalizeTrailingNewline(text) {
  return text.endsWith("\n") ? text : `${text}\n`;
}

function renderHookItemLines(command, timeoutSec) {
  return [`    - command: "${quoteYamlDouble(command)}"`, `      timeout: ${timeoutSec}`];
}

/**
 * computeUpdatedConfigText — the core idempotent transform.
 *
 * @param {string} originalText - current contents of config.yaml, or "" if absent.
 * @param {object} opts
 * @param {string} opts.bridgePath - absolute path to norm-hermes-hook.mjs.
 * @param {string[]} [opts.events] - Hermes hook event names to register.
 * @param {number} [opts.timeoutSec]
 * @param {string} [opts.nodeBin]
 * @returns {{ text: string, changed: boolean, warnings: string[] }}
 */
export function computeUpdatedConfigText(
  originalText,
  { bridgePath, events = DEFAULT_EVENTS, timeoutSec = DEFAULT_TIMEOUT_SEC, nodeBin = "node" },
) {
  const command = buildHookCommand(bridgePath, nodeBin);
  const warnings = [];
  const original = originalText ?? "";
  // Normalize the empty-flow-mapping spelling `hooks: {}` (observed in a real
  // ~/.hermes/config.yaml written by `hermes doctor`/defaults) to the
  // block-mapping spelling `hooks:` this transform understands. Without this,
  // `^hooks:\s*$` would not match `hooks: {}` and a SECOND top-level `hooks:`
  // key would be appended — technically YAML-parseable (last key wins in
  // PyYAML's default loader) but confusing and easy to get wrong; normalizing
  // in place is unambiguous and idempotent.
  const normalizedOriginal = original.replace(/^hooks:\s*\{\}\s*$/m, "hooks:");
  const lines = normalizedOriginal.length > 0 ? normalizedOriginal.split("\n") : [];

  const autoAcceptLineIdx = lines.findIndex((l) => /^hooks_auto_accept:\s*/.test(l));
  const hasAutoAccept = autoAcceptLineIdx !== -1;
  if (hasAutoAccept && /^hooks_auto_accept:\s*false\s*$/.test(lines[autoAcceptLineIdx])) {
    warnings.push(
      "hooks_auto_accept is false — Hermes will prompt for consent on first use of the " +
        "hima hook(s); set hooks_auto_accept: true or export HERMES_ACCEPT_HOOKS=1 to run " +
        "non-interactively.",
    );
  }

  const hooksLineIdx = lines.findIndex((l) => /^hooks:\s*$/.test(l));

  let newLines;
  let changed = false;

  if (hooksLineIdx === -1) {
    // No `hooks:` block at all — append a fresh one for every requested event.
    const block = ["hooks:"];
    for (const event of events) {
      block.push(`  ${event}:`, ...renderHookItemLines(command, timeoutSec));
    }
    newLines = [...lines];
    if (newLines.length > 0 && newLines[newLines.length - 1].trim() !== "") {
      newLines.push("");
    }
    newLines.push(...block);
    changed = true;
  } else {
    newLines = [...lines];
    // Span of the `hooks:` mapping: contiguous blank lines or indented lines
    // immediately following the `hooks:` line.
    let end = hooksLineIdx + 1;
    while (end < newLines.length && (newLines[end].trim() === "" || /^[ \t]/.test(newLines[end]))) {
      end++;
    }

    let insertOffset = 0;
    for (const event of events) {
      const eventKeyRe = new RegExp(`^  ${event}:\\s*$`);
      const spanStart = hooksLineIdx + 1 + insertOffset;
      const spanEnd = end + insertOffset;
      const span = newLines.slice(spanStart, spanEnd);
      const eventIdxInSpan = span.findIndex((l) => eventKeyRe.test(l));

      if (eventIdxInSpan === -1) {
        // Event key absent under `hooks:` — append it as a new LAST child of
        // the `hooks:` mapping, at spanEnd (never at spanStart: inserting at
        // the top would land inside an already-existing sibling's own list
        // items whenever one precedes it, re-parenting them under the new
        // key on a real YAML parse).
        const block = [`  ${event}:`, ...renderHookItemLines(command, timeoutSec)];
        newLines.splice(spanEnd, 0, ...block);
        insertOffset += block.length;
        changed = true;
        continue;
      }

      const absoluteEventIdx = spanStart + eventIdxInSpan;
      // Scan the event's own list-item span (indented >= 4 spaces, or blank).
      let itemEnd = absoluteEventIdx + 1;
      while (
        itemEnd < newLines.length &&
        (newLines[itemEnd].trim() === "" || /^ {4,}/.test(newLines[itemEnd]))
      ) {
        itemEnd++;
      }
      const alreadyPresent = newLines.slice(absoluteEventIdx + 1, itemEnd).some((l) => l.includes(bridgePath));

      if (!alreadyPresent) {
        const item = renderHookItemLines(command, timeoutSec);
        newLines.splice(absoluteEventIdx + 1, 0, ...item);
        insertOffset += item.length;
        changed = true;
      }
    }
  }

  let result = newLines.join("\n");
  if (!hasAutoAccept) {
    result = `${normalizeTrailingNewline(result)}hooks_auto_accept: true\n`;
    changed = true;
  }

  return { text: normalizeTrailingNewline(result), changed, warnings };
}

// ---------------------------------------------------------------------------
// Filesystem wrapper
// ---------------------------------------------------------------------------

/** Resolve the Hermes config.yaml path: HERMES_CONFIG_PATH > $HERMES_HOME/config.yaml > ~/.hermes/config.yaml. */
export function resolveConfigPath(env = process.env) {
  if (typeof env.HERMES_CONFIG_PATH === "string" && env.HERMES_CONFIG_PATH !== "") {
    return env.HERMES_CONFIG_PATH;
  }
  const home =
    typeof env.HERMES_HOME === "string" && env.HERMES_HOME !== "" ? env.HERMES_HOME : join(homedir(), ".hermes");
  return join(home, "config.yaml");
}

/**
 * installHooks — read (or default-empty) the config file, compute the
 * updated text, and write it back only if it actually changed.
 *
 * @param {object} opts
 * @param {string} [opts.configPath]
 * @param {string} [opts.bridgePath]
 * @param {string[]} [opts.events]
 * @param {number} [opts.timeoutSec]
 * @returns {{ configPath: string, changed: boolean, warnings: string[] }}
 */
export function installHooks({
  configPath = resolveConfigPath(),
  bridgePath = DEFAULT_BRIDGE_PATH,
  events = DEFAULT_EVENTS,
  timeoutSec = DEFAULT_TIMEOUT_SEC,
} = {}) {
  const originalText = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
  const { text, changed, warnings } = computeUpdatedConfigText(originalText, {
    bridgePath,
    events,
    timeoutSec,
  });

  if (changed) {
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, text, "utf8");
  }

  return { configPath, changed, warnings };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

function main() {
  const result = installHooks();
  process.stdout.write(
    `[install-hermes-bridge] ${result.changed ? "updated" : "already up to date"}: ${result.configPath}\n`,
  );
  for (const w of result.warnings) {
    process.stderr.write(`[install-hermes-bridge] warning: ${w}\n`);
  }
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main();
}
