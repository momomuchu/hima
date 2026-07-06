/**
 * opencode-bridge-install.test.ts — unit tests for
 * packages/hima-cli/src/opencode-bridge/install.mjs.
 *
 * Covers resolveTargetDir / buildPluginEntry / mergePluginEntry (pure, no
 * filesystem), plus installOpenCodeBridge (real filesystem, but scoped to a
 * temp directory — never touches the real ~/.config/opencode or any project).
 */

import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  resolveTargetDir,
  buildPluginEntry,
  mergePluginEntry,
  installOpenCodeBridge,
  PLUGIN_FILENAME,
  CORE_FILENAME,
  DEFAULT_PLUGIN_SOURCE,
  DEFAULT_CORE_SOURCE,
} from "../src/opencode-bridge/install.mjs";

// ---------------------------------------------------------------------------
// resolveTargetDir
// ---------------------------------------------------------------------------

describe("resolveTargetDir", () => {
  it("project-level default: <root>/.opencode/plugins + <root>/.opencode", () => {
    const { pluginsDir, configDir } = resolveTargetDir({ root: "/proj", env: {} });
    expect(pluginsDir).toBe(path.join("/proj", ".opencode", "plugins"));
    expect(configDir).toBe(path.join("/proj", ".opencode"));
  });

  it("global: <configDir>/plugins + <configDir>, honoring NORM_OPENCODE_CONFIG_DIR", () => {
    const { pluginsDir, configDir } = resolveTargetDir({
      global: true,
      env: { NORM_OPENCODE_CONFIG_DIR: "/custom/opencode-config" },
    });
    expect(configDir).toBe("/custom/opencode-config");
    expect(pluginsDir).toBe(path.join("/custom/opencode-config", "plugins"));
  });

  it("global falls back to ~/.config/opencode when NORM_OPENCODE_CONFIG_DIR is unset", () => {
    const { configDir } = resolveTargetDir({ global: true, env: {} });
    expect(configDir.endsWith(path.join(".config", "opencode"))).toBe(true);
  });

  it("NORM_OPENCODE_PLUGINS_DIR overrides everything (project/global irrelevant)", () => {
    const { pluginsDir, configDir } = resolveTargetDir({
      root: "/proj",
      global: true,
      env: { NORM_OPENCODE_PLUGINS_DIR: "/tmp/forced/plugins" },
    });
    expect(pluginsDir).toBe("/tmp/forced/plugins");
    expect(configDir).toBe("/tmp/forced");
  });

  it("defaults root to process.cwd() when omitted", () => {
    const { pluginsDir } = resolveTargetDir({ env: {} });
    expect(pluginsDir).toBe(path.join(process.cwd(), ".opencode", "plugins"));
  });
});

// ---------------------------------------------------------------------------
// buildPluginEntry — must match the empirically-verified working form
// ---------------------------------------------------------------------------

describe("buildPluginEntry", () => {
  it("produces './plugins/norm-opencode-plugin.mjs' for the standard layout (live-verified form)", () => {
    const entry = buildPluginEntry(path.join("/proj", ".opencode", "plugins"), path.join("/proj", ".opencode"));
    expect(entry).toBe("./plugins/norm-opencode-plugin.mjs");
  });

  it("still yields a leading-dot relative path for a global config layout", () => {
    const entry = buildPluginEntry(path.join("/home/u/.config/opencode", "plugins"), "/home/u/.config/opencode");
    expect(entry).toBe("./plugins/norm-opencode-plugin.mjs");
  });

  it(`PLUGIN_FILENAME is "${PLUGIN_FILENAME}"`, () => {
    expect(PLUGIN_FILENAME).toBe("norm-opencode-plugin.mjs");
  });
});

// ---------------------------------------------------------------------------
// mergePluginEntry — pure
// ---------------------------------------------------------------------------

describe("mergePluginEntry", () => {
  it("creates a fresh plugin array when config is empty", () => {
    const { config, changed } = mergePluginEntry({}, "./plugins/norm-opencode-plugin.mjs");
    expect(changed).toBe(true);
    expect(config.plugin).toEqual(["./plugins/norm-opencode-plugin.mjs"]);
  });

  it("preserves existing plugin entries and appends the new one", () => {
    const { config, changed } = mergePluginEntry(
      { plugin: ["oh-my-openagent"] },
      "./plugins/norm-opencode-plugin.mjs",
    );
    expect(changed).toBe(true);
    expect(config.plugin).toEqual(["oh-my-openagent", "./plugins/norm-opencode-plugin.mjs"]);
  });

  it("preserves every other top-level config key untouched", () => {
    const { config } = mergePluginEntry(
      { $schema: "https://opencode.ai/config.json", tools: { websearch: true }, plugin: [] },
      "./plugins/norm-opencode-plugin.mjs",
    );
    expect(config.$schema).toBe("https://opencode.ai/config.json");
    expect(config.tools).toEqual({ websearch: true });
  });

  it("is idempotent: does not duplicate an exact-match entry", () => {
    const first = mergePluginEntry({}, "./plugins/norm-opencode-plugin.mjs");
    const second = mergePluginEntry(first.config, "./plugins/norm-opencode-plugin.mjs");
    expect(second.changed).toBe(false);
    expect(second.config.plugin).toEqual(["./plugins/norm-opencode-plugin.mjs"]);
  });

  it("dedups by filename even when the existing entry has a different relative form", () => {
    const { changed, config } = mergePluginEntry(
      { plugin: ["../shared/plugins/norm-opencode-plugin.mjs"] },
      "./plugins/norm-opencode-plugin.mjs",
    );
    expect(changed).toBe(false);
    expect(config.plugin).toEqual(["../shared/plugins/norm-opencode-plugin.mjs"]);
  });

  it("treats a non-array existing plugin field as absent", () => {
    const { config, changed } = mergePluginEntry({ plugin: "not-an-array" as unknown }, "./plugins/norm-opencode-plugin.mjs");
    expect(changed).toBe(true);
    expect(config.plugin).toEqual(["./plugins/norm-opencode-plugin.mjs"]);
  });
});

// ---------------------------------------------------------------------------
// installOpenCodeBridge — real filesystem, scoped to a temp dir
// ---------------------------------------------------------------------------

describe("installOpenCodeBridge — filesystem integration (temp dir only)", () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "opencode-bridge-install-"));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes the plugin file AND core.mjs (side by side) and registers the plugin in a fresh opencode.json", () => {
    const projectRoot = path.join(dir, "proj-a");
    mkdirSync(projectRoot, { recursive: true });

    const result = installOpenCodeBridge({ root: projectRoot });

    expect(result.registered).toBe(true);
    expect(result.changed).toBe(true);
    expect(result.entry).toBe("./plugins/norm-opencode-plugin.mjs");
    expect(existsSync(result.pluginPath)).toBe(true);
    expect(readFileSync(result.pluginPath, "utf8")).toBe(readFileSync(DEFAULT_PLUGIN_SOURCE, "utf8"));

    // core.mjs MUST land side by side with the plugin file — the plugin
    // `import`s it via a relative specifier (see core.mjs's header).
    expect(existsSync(result.corePath)).toBe(true);
    expect(path.dirname(result.corePath)).toBe(path.dirname(result.pluginPath));
    expect(path.basename(result.corePath)).toBe(CORE_FILENAME);
    expect(readFileSync(result.corePath, "utf8")).toBe(readFileSync(DEFAULT_CORE_SOURCE, "utf8"));

    const config = JSON.parse(readFileSync(result.configPath, "utf8"));
    expect(config.plugin).toContain("./plugins/norm-opencode-plugin.mjs");
  });

  it("is idempotent: a second run on the same project reports changed:false", () => {
    const projectRoot = path.join(dir, "proj-b");
    mkdirSync(projectRoot, { recursive: true });

    const first = installOpenCodeBridge({ root: projectRoot });
    expect(first.changed).toBe(true);
    const configAfterFirst = readFileSync(first.configPath, "utf8");
    const pluginAfterFirst = readFileSync(first.pluginPath, "utf8");

    const second = installOpenCodeBridge({ root: projectRoot });
    expect(second.changed).toBe(false);
    expect(readFileSync(second.configPath, "utf8")).toBe(configAfterFirst);
    expect(readFileSync(second.pluginPath, "utf8")).toBe(pluginAfterFirst);

    const config = JSON.parse(configAfterFirst);
    expect(config.plugin.filter((p: string) => p.includes(PLUGIN_FILENAME))).toHaveLength(1);
  });

  it("preserves an existing opencode.json's other keys and plugin entries", () => {
    const projectRoot = path.join(dir, "proj-c");
    const openCodeDir = path.join(projectRoot, ".opencode");
    mkdirSync(openCodeDir, { recursive: true });
    writeFileSync(
      path.join(openCodeDir, "opencode.json"),
      JSON.stringify({ $schema: "https://opencode.ai/config.json", plugin: ["oh-my-openagent"], tools: { websearch: true } }, null, 2),
      "utf8",
    );

    const result = installOpenCodeBridge({ root: projectRoot });
    const config = JSON.parse(readFileSync(result.configPath, "utf8"));
    expect(config.$schema).toBe("https://opencode.ai/config.json");
    expect(config.tools).toEqual({ websearch: true });
    expect(config.plugin).toEqual(["oh-my-openagent", "./plugins/norm-opencode-plugin.mjs"]);
  });

  it("does not clobber a malformed existing opencode.json — writes the plugin file, skips registration, warns", () => {
    const projectRoot = path.join(dir, "proj-d");
    const openCodeDir = path.join(projectRoot, ".opencode");
    mkdirSync(openCodeDir, { recursive: true });
    const configPath = path.join(openCodeDir, "opencode.json");
    writeFileSync(configPath, "{ not valid json", "utf8");

    const result = installOpenCodeBridge({ root: projectRoot });
    expect(result.registered).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(existsSync(result.pluginPath)).toBe(true);
    // The malformed file must be left exactly as it was.
    expect(readFileSync(configPath, "utf8")).toBe("{ not valid json");
  });

  it("--global-equivalent option installs under NORM_OPENCODE_CONFIG_DIR (env override)", () => {
    const globalDir = path.join(dir, "global-config");
    const result = installOpenCodeBridge({ global: true, env: { NORM_OPENCODE_CONFIG_DIR: globalDir } });
    expect(result.pluginPath).toBe(path.join(globalDir, "plugins", PLUGIN_FILENAME));
    expect(existsSync(result.pluginPath)).toBe(true);
    const config = JSON.parse(readFileSync(result.configPath, "utf8"));
    expect(config.plugin).toContain("./plugins/norm-opencode-plugin.mjs");
  });

  it("NORM_OPENCODE_PLUGINS_DIR env override forces the exact target dir (test hook)", () => {
    const forcedDir = path.join(dir, "forced", "plugins");
    const result = installOpenCodeBridge({ env: { NORM_OPENCODE_PLUGINS_DIR: forcedDir } });
    expect(result.pluginPath).toBe(path.join(forcedDir, PLUGIN_FILENAME));
    expect(existsSync(result.pluginPath)).toBe(true);
  });
});
