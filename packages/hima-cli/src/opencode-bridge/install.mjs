#!/usr/bin/env node
/**
 * install.mjs — idempotently install the Norm OpenCode bridge plugin
 * (norm-opencode-plugin.mjs + its core.mjs, this same directory) into an
 * OpenCode project or the global OpenCode config.
 *
 * Ground truth (see norm-opencode-plugin.mjs / core.mjs headers for the full
 * live-probe log): opencode.ai/docs/plugins states that files under
 * `.opencode/plugins/` (project) or `~/.config/opencode/plugins/` (global)
 * are auto-loaded at startup. This was empirically tested against the
 * installed opencode 1.16.2 binary on 2026-07-06 and NOT OBSERVED: a
 * diagnostic plugin file placed directly in `.opencode/plugins/` (with no
 * other config change) never ran — opencode's own startup log
 * (~/.local/share/opencode/log/*.log, `service=plugin ... loading plugin`)
 * only ever showed plugins that were ALSO listed in the sibling
 * `opencode.json`'s `"plugin"` array. Once the same file was added to that
 * array (as `"./plugins/<file>.mjs"`, relative to the `opencode.json` that
 * contains it), it loaded and its hooks fired correctly (confirmed via
 * `tool.execute.before` / `event` log lines).
 *
 * This installer therefore performs the following, unconditionally:
 *   1. Copy norm-opencode-plugin.mjs AND core.mjs into the target plugins/
 *      directory (both — the plugin file `import`s core.mjs via a relative
 *      specifier, so they must land side by side; see core.mjs's header for
 *      why the logic is split into two files instead of one).
 *   2. Register a relative path to norm-opencode-plugin.mjs in the sibling
 *      opencode.json's "plugin" array (creating the file if absent,
 *      preserving every other key and every other existing plugin entry,
 *      deduplicated by exact string OR by filename match so re-running never
 *      doubles the entry).
 *
 * Usage:
 *   node install.mjs [--root <projectDir>] [--global]
 *
 *   --root <dir>   Install project-level: <dir>/.opencode/plugins/ +
 *                  <dir>/.opencode/opencode.json. Defaults to process.cwd().
 *   --global       Install into the global OpenCode config dir instead
 *                  (~/.config/opencode/plugins/ + .../opencode.json, or
 *                  NORM_OPENCODE_CONFIG_DIR when set — mirrors OpenCode's own
 *                  OPENCODE_CONFIG_DIR override convention).
 *
 * Env overrides (primarily for tests — never required for normal use):
 *   NORM_OPENCODE_PLUGINS_DIR  — force the exact plugins directory, bypassing
 *                                --root/--global entirely. The sibling config
 *                                dir is taken as this directory's parent.
 *   NORM_OPENCODE_CONFIG_DIR   — override the global OpenCode config dir
 *                                (only consulted when --global is set and
 *                                NORM_OPENCODE_PLUGINS_DIR is unset).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { homedir } from "node:os";

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const THIS_FILE = fileURLToPath(import.meta.url);
export const PLUGIN_FILENAME = "norm-opencode-plugin.mjs";
export const CORE_FILENAME = "core.mjs";
export const DEFAULT_PLUGIN_SOURCE = resolve(dirname(THIS_FILE), PLUGIN_FILENAME);
export const DEFAULT_CORE_SOURCE = resolve(dirname(THIS_FILE), CORE_FILENAME);

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit tests — no filesystem access below this line)
// ---------------------------------------------------------------------------

/**
 * resolveTargetDir — compute {pluginsDir, configDir} from the install options.
 * Priority: NORM_OPENCODE_PLUGINS_DIR env override > --global > --root/cwd.
 */
export function resolveTargetDir({ root, global = false, env = process.env } = {}) {
  if (typeof env.NORM_OPENCODE_PLUGINS_DIR === "string" && env.NORM_OPENCODE_PLUGINS_DIR !== "") {
    const pluginsDir = env.NORM_OPENCODE_PLUGINS_DIR;
    return { pluginsDir, configDir: dirname(pluginsDir) };
  }
  if (global) {
    const base =
      typeof env.NORM_OPENCODE_CONFIG_DIR === "string" && env.NORM_OPENCODE_CONFIG_DIR !== ""
        ? env.NORM_OPENCODE_CONFIG_DIR
        : join(homedir(), ".config", "opencode");
    return { pluginsDir: join(base, "plugins"), configDir: base };
  }
  const projectRoot = root ?? process.cwd();
  const configDir = join(projectRoot, ".opencode");
  return { pluginsDir: join(configDir, "plugins"), configDir };
}

/**
 * buildPluginEntry — the relative path opencode.json's "plugin" array should
 * hold for the installed plugin file, expressed relative to the directory
 * that contains opencode.json (the exact form verified live: "./plugins/<file>").
 */
export function buildPluginEntry(pluginsDir, configDir) {
  const rel = relative(configDir, join(pluginsDir, PLUGIN_FILENAME)).split(pathSepRe).join("/");
  return rel.startsWith(".") ? rel : `./${rel}`;
}
const pathSepRe = /\\/g;

/**
 * mergePluginEntry — pure: merge `entry` into `existingConfig.plugin`,
 * preserving every other key and every other existing plugin entry.
 * Dedup: an entry is considered already-present when it matches exactly OR
 * when an existing string entry ends with the same plugin filename (so a
 * stale absolute-path or differently-relative entry from a prior install
 * doesn't produce a duplicate).
 */
export function mergePluginEntry(existingConfig, entry) {
  const base =
    existingConfig && typeof existingConfig === "object" && !Array.isArray(existingConfig)
      ? { ...existingConfig }
      : {};
  const existingPlugins = Array.isArray(base.plugin) ? base.plugin : [];
  const filename = entry.split("/").pop();
  const alreadyPresent = existingPlugins.some(
    (p) => p === entry || (typeof p === "string" && filename !== undefined && p.endsWith(`/${filename}`)) || p === filename,
  );
  return {
    config: { ...base, plugin: alreadyPresent ? existingPlugins : [...existingPlugins, entry] },
    changed: !alreadyPresent,
  };
}

// ---------------------------------------------------------------------------
// installOpenCodeBridge — real filesystem, but every path is derived from
// explicit options (never touches anything outside the resolved target dirs).
// ---------------------------------------------------------------------------

/**
 * copyIfChanged — write `sourceContent` to `targetPath` only when it differs
 * from what's already there. Returns true when a write actually happened.
 */
function copyIfChanged(targetPath, sourceContent) {
  const existingContent = existsSync(targetPath) ? readFileSync(targetPath, "utf8") : null;
  const changed = existingContent !== sourceContent;
  if (changed) {
    writeFileSync(targetPath, sourceContent, "utf8");
  }
  return changed;
}

/**
 * @param {object} [opts]
 * @param {string} [opts.root] - project root (ignored when --global/opts.global).
 * @param {boolean} [opts.global] - install into the global OpenCode config dir.
 * @param {Record<string,string|undefined>} [opts.env]
 * @param {string} [opts.pluginSource] - path to read the plugin source from (test hook).
 * @param {string} [opts.coreSource] - path to read core.mjs from (test hook).
 * @returns {{ pluginPath: string, corePath: string, configPath: string, entry: string, changed: boolean, registered: boolean, warnings: string[] }}
 */
export function installOpenCodeBridge({
  root,
  global = false,
  env = process.env,
  pluginSource = DEFAULT_PLUGIN_SOURCE,
  coreSource = DEFAULT_CORE_SOURCE,
} = {}) {
  const { pluginsDir, configDir } = resolveTargetDir({ root, global, env });
  mkdirSync(pluginsDir, { recursive: true });

  // Both files must land side by side: norm-opencode-plugin.mjs `import`s
  // core.mjs via a relative specifier (see core.mjs's header for why the
  // logic is split across two files instead of being one plugin file).
  const pluginTargetPath = join(pluginsDir, PLUGIN_FILENAME);
  const coreTargetPath = join(pluginsDir, CORE_FILENAME);
  const pluginFileChanged = copyIfChanged(pluginTargetPath, readFileSync(pluginSource, "utf8"));
  const coreFileChanged = copyIfChanged(coreTargetPath, readFileSync(coreSource, "utf8"));

  const entry = buildPluginEntry(pluginsDir, configDir);
  const configPath = join(configDir, "opencode.json");

  let existingConfig = {};
  if (existsSync(configPath)) {
    try {
      existingConfig = JSON.parse(readFileSync(configPath, "utf8"));
    } catch (err) {
      return {
        pluginPath: pluginTargetPath,
        corePath: coreTargetPath,
        configPath,
        entry,
        changed: pluginFileChanged || coreFileChanged,
        registered: false,
        warnings: [
          `${configPath} exists but is not valid JSON — the plugin file was written, but ` +
            `registration was skipped to avoid clobbering hand-edited config. Add "${entry}" ` +
            `to its "plugin" array manually.`,
          `parse error: ${err?.message ?? String(err)}`,
        ],
      };
    }
  }

  const { config, changed: configChanged } = mergePluginEntry(existingConfig, entry);
  const configFileMissing = !existsSync(configPath);
  if (configChanged || configFileMissing) {
    mkdirSync(configDir, { recursive: true });
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  }

  return {
    pluginPath: pluginTargetPath,
    corePath: coreTargetPath,
    configPath,
    entry,
    changed: pluginFileChanged || coreFileChanged || configChanged || configFileMissing,
    registered: true,
    warnings: [],
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

function parseCliArgs(argv) {
  const args = argv.slice(2);
  const global = args.includes("--global");
  const rootIdx = args.indexOf("--root");
  const root = rootIdx !== -1 ? args[rootIdx + 1] : undefined;
  return { root, global };
}

function main() {
  const { root, global } = parseCliArgs(process.argv);
  const result = installOpenCodeBridge({ root, global });
  process.stdout.write(
    `[install-opencode-bridge] plugin: ${result.pluginPath} (${result.changed ? "written" : "already up to date"})\n` +
      `[install-opencode-bridge] config: ${result.configPath} (registered: ${result.registered}, entry: "${result.entry}")\n`,
  );
  for (const w of result.warnings) {
    process.stderr.write(`[install-opencode-bridge] warning: ${w}\n`);
  }
  if (!result.registered) {
    process.exitCode = 1;
  }
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main();
}
