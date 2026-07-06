/**
 * hermes-bridge-install.test.ts — unit tests for
 * packages/hima-cli/src/hermes-bridge/install.mjs.
 *
 * Covers computeUpdatedConfigText (pure, no filesystem) across the realistic
 * shapes of ~/.hermes/config.yaml, plus installHooks (real filesystem, but
 * scoped to a temp directory — never touches the real ~/.hermes).
 */

import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  computeUpdatedConfigText,
  buildHookCommand,
  resolveConfigPath,
  installHooks,
  DEFAULT_EVENTS,
} from "../src/hermes-bridge/install.mjs";

const BRIDGE_PATH = "/abs/path/to/norm-hermes-hook.mjs";

// ---------------------------------------------------------------------------
// buildHookCommand
// ---------------------------------------------------------------------------

describe("buildHookCommand", () => {
  it("wraps the bridge path in double quotes with a node prefix", () => {
    expect(buildHookCommand(BRIDGE_PATH)).toBe(`node "${BRIDGE_PATH}"`);
  });

  it("honors a custom node binary", () => {
    expect(buildHookCommand(BRIDGE_PATH, "/usr/local/bin/node")).toBe(
      `/usr/local/bin/node "${BRIDGE_PATH}"`,
    );
  });
});

// ---------------------------------------------------------------------------
// computeUpdatedConfigText — no existing file
// ---------------------------------------------------------------------------

describe("computeUpdatedConfigText — no existing config", () => {
  it("creates a fresh hooks: block for both default events + hooks_auto_accept", () => {
    const { text, changed, warnings } = computeUpdatedConfigText("", { bridgePath: BRIDGE_PATH });
    expect(changed).toBe(true);
    expect(warnings).toEqual([]);
    expect(text).toContain("hooks:");
    expect(text).toContain("  pre_tool_call:");
    expect(text).toContain("  subagent_start:");
    expect(text).toContain(`command: "node \\"${BRIDGE_PATH}\\""`);
    expect(text).toContain("hooks_auto_accept: true");
  });

  it("is valid enough to re-parse idempotently (running twice yields identical text)", () => {
    const first = computeUpdatedConfigText("", { bridgePath: BRIDGE_PATH });
    const second = computeUpdatedConfigText(first.text, { bridgePath: BRIDGE_PATH });
    expect(second.changed).toBe(false);
    expect(second.text).toBe(first.text);
  });
});

// ---------------------------------------------------------------------------
// computeUpdatedConfigText — existing config, unrelated content preserved
// ---------------------------------------------------------------------------

describe("computeUpdatedConfigText — existing config without a hooks: block", () => {
  const original = `model: some-model\ntemperature: 0.7\n`;

  it("preserves the original content and appends a fresh hooks: block", () => {
    const { text, changed } = computeUpdatedConfigText(original, { bridgePath: BRIDGE_PATH });
    expect(changed).toBe(true);
    expect(text).toContain("model: some-model");
    expect(text).toContain("temperature: 0.7");
    expect(text).toContain("hooks:");
    expect(text).toContain("hooks_auto_accept: true");
  });
});

// ---------------------------------------------------------------------------
// computeUpdatedConfigText — hooks: exists with unrelated events
// ---------------------------------------------------------------------------

describe("computeUpdatedConfigText — hooks: exists with an unrelated event", () => {
  const original = `hooks:\n  post_tool_call:\n    - command: "some-other-hook.sh"\n      timeout: 5\nhooks_auto_accept: true\n`;

  it("adds pre_tool_call and subagent_start as siblings, leaves post_tool_call untouched", () => {
    const { text, changed } = computeUpdatedConfigText(original, { bridgePath: BRIDGE_PATH });
    expect(changed).toBe(true);
    expect(text).toContain('post_tool_call:\n    - command: "some-other-hook.sh"');
    expect(text).toContain("  pre_tool_call:");
    expect(text).toContain("  subagent_start:");
    expect(text).toContain(BRIDGE_PATH);
  });

  it("does not duplicate hooks_auto_accept (already present)", () => {
    const { text } = computeUpdatedConfigText(original, { bridgePath: BRIDGE_PATH });
    const matches = text.match(/hooks_auto_accept:/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("is idempotent across two consecutive runs", () => {
    const first = computeUpdatedConfigText(original, { bridgePath: BRIDGE_PATH });
    const second = computeUpdatedConfigText(first.text, { bridgePath: BRIDGE_PATH });
    expect(second.changed).toBe(false);
    expect(second.text).toBe(first.text);
  });
});

// ---------------------------------------------------------------------------
// computeUpdatedConfigText — real-world edge case: `hooks: {}` empty mapping
// ---------------------------------------------------------------------------

describe("computeUpdatedConfigText — existing config with `hooks: {}` (empty flow mapping)", () => {
  // Observed in a real ~/.hermes/config.yaml (hermes default/doctor-written
  // config uses the empty-flow-mapping spelling, not a bare `hooks:` key).
  const original = `security:\n  redact_secrets: true\nhooks: {}\nhooks_auto_accept: false\npersonalities: {}\n`;

  it("normalizes hooks: {} in place instead of appending a duplicate hooks: key", () => {
    const { text, changed } = computeUpdatedConfigText(original, { bridgePath: BRIDGE_PATH });
    expect(changed).toBe(true);
    const hooksKeyOccurrences = (text.match(/^hooks:/gm) ?? []).length;
    expect(hooksKeyOccurrences).toBe(1);
    expect(text).not.toMatch(/^hooks:\s*\{\}\s*$/m);
    expect(text).toContain("  pre_tool_call:");
    expect(text).toContain("  subagent_start:");
  });

  it("preserves surrounding unrelated keys (security, personalities)", () => {
    const { text } = computeUpdatedConfigText(original, { bridgePath: BRIDGE_PATH });
    expect(text).toContain("security:");
    expect(text).toContain("redact_secrets: true");
    expect(text).toContain("personalities: {}");
  });

  it("preserves an existing hooks_auto_accept: false and warns instead of overriding it", () => {
    const { text, warnings } = computeUpdatedConfigText(original, { bridgePath: BRIDGE_PATH });
    expect(text).toMatch(/^hooks_auto_accept: false\s*$/m);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("is idempotent across two consecutive runs", () => {
    const first = computeUpdatedConfigText(original, { bridgePath: BRIDGE_PATH });
    const second = computeUpdatedConfigText(first.text, { bridgePath: BRIDGE_PATH });
    expect(second.changed).toBe(false);
    expect(second.text).toBe(first.text);
  });
});

// ---------------------------------------------------------------------------
// computeUpdatedConfigText — event key exists with a different command
// ---------------------------------------------------------------------------

describe("computeUpdatedConfigText — pre_tool_call already has an unrelated hook", () => {
  const original =
    `hooks:\n  pre_tool_call:\n    - matcher: "terminal"\n      command: "~/.hermes/agent-hooks/block-rm-rf.sh"\n      timeout: 5\n`;

  it("appends our command as an additional list item, keeps the existing one", () => {
    const { text, changed } = computeUpdatedConfigText(original, {
      bridgePath: BRIDGE_PATH,
      events: ["pre_tool_call"],
    });
    expect(changed).toBe(true);
    expect(text).toContain("block-rm-rf.sh");
    expect(text).toContain(BRIDGE_PATH);
  });

  it("running install twice does not duplicate our entry", () => {
    // Scoped to a single event here so BRIDGE_PATH's expected occurrence
    // count is unambiguous (each registered event legitimately gets its own
    // command line — see the separate multi-event idempotency test above).
    const opts = { bridgePath: BRIDGE_PATH, events: ["pre_tool_call"] };
    const first = computeUpdatedConfigText(original, opts);
    const second = computeUpdatedConfigText(first.text, opts);
    expect(second.changed).toBe(false);
    expect(second.text).toBe(first.text);
    const occurrences = (second.text.match(new RegExp(BRIDGE_PATH.replace(/\//g, "\\/"), "g")) ?? []).length;
    expect(occurrences).toBe(1);
  });

  it("registers both default events without corrupting the pre-existing sibling's list", () => {
    // Regression test: inserting a missing event key must never land inside
    // an already-existing sibling's list-item span (that would re-parent the
    // sibling's items under the new key on a real YAML parse).
    const { text } = computeUpdatedConfigText(original, { bridgePath: BRIDGE_PATH });
    expect(text).toContain(
      '  pre_tool_call:\n    - command: "node \\"' +
        BRIDGE_PATH +
        '\\""\n      timeout: 15\n    - matcher: "terminal"\n      command: "~/.hermes/agent-hooks/block-rm-rf.sh"\n      timeout: 5',
    );
    expect(text).toMatch(/\n {2}subagent_start:\n {4}- command:/);
  });
});

// ---------------------------------------------------------------------------
// hooks_auto_accept: false is never silently overridden
// ---------------------------------------------------------------------------

describe("computeUpdatedConfigText — hooks_auto_accept: false is preserved with a warning", () => {
  const original = `hooks_auto_accept: false\n`;

  it("keeps hooks_auto_accept: false unchanged", () => {
    const { text } = computeUpdatedConfigText(original, { bridgePath: BRIDGE_PATH });
    expect(text).toContain("hooks_auto_accept: false");
    expect(text).not.toContain("hooks_auto_accept: true");
  });

  it("emits a warning about interactive consent", () => {
    const { warnings } = computeUpdatedConfigText(original, { bridgePath: BRIDGE_PATH });
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toMatch(/hooks_auto_accept/);
  });
});

// ---------------------------------------------------------------------------
// custom events / timeout
// ---------------------------------------------------------------------------

describe("computeUpdatedConfigText — custom events and timeout", () => {
  it("only registers the requested events", () => {
    const { text } = computeUpdatedConfigText("", {
      bridgePath: BRIDGE_PATH,
      events: ["pre_tool_call"],
      timeoutSec: 30,
    });
    expect(text).toContain("  pre_tool_call:");
    expect(text).not.toContain("  subagent_start:");
    expect(text).toContain("timeout: 30");
  });

  it("DEFAULT_EVENTS is exactly pre_tool_call + subagent_start", () => {
    expect(DEFAULT_EVENTS).toEqual(["pre_tool_call", "subagent_start"]);
  });
});

// ---------------------------------------------------------------------------
// resolveConfigPath
// ---------------------------------------------------------------------------

describe("resolveConfigPath", () => {
  it("prefers HERMES_CONFIG_PATH", () => {
    expect(resolveConfigPath({ HERMES_CONFIG_PATH: "/x/config.yaml", HERMES_HOME: "/y" })).toBe(
      "/x/config.yaml",
    );
  });

  it("falls back to $HERMES_HOME/config.yaml", () => {
    expect(resolveConfigPath({ HERMES_HOME: "/y" })).toBe(path.join("/y", "config.yaml"));
  });

  it("falls back to ~/.hermes/config.yaml when nothing is set", () => {
    const result = resolveConfigPath({});
    expect(result.endsWith(path.join(".hermes", "config.yaml"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// installHooks — real filesystem, scoped to a temp dir
// ---------------------------------------------------------------------------

describe("installHooks — filesystem integration (temp dir only)", () => {
  let dir: string;
  let configPath: string;

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "hermes-bridge-install-"));
    configPath = path.join(dir, "config.yaml");
  });

  afterEach(() => {
    // Reset between tests that mutate configPath directly.
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates config.yaml (and parent dir) when absent", () => {
    const nestedConfigPath = path.join(dir, "nested", "config.yaml");
    const result = installHooks({ configPath: nestedConfigPath, bridgePath: BRIDGE_PATH });
    expect(result.changed).toBe(true);
    const written = readFileSync(nestedConfigPath, "utf8");
    expect(written).toContain(BRIDGE_PATH);
    expect(written).toContain("hooks_auto_accept: true");
  });

  it("is idempotent: second call reports changed:false and does not rewrite content", () => {
    const first = installHooks({ configPath, bridgePath: BRIDGE_PATH });
    expect(first.changed).toBe(true);
    const textAfterFirst = readFileSync(configPath, "utf8");

    const second = installHooks({ configPath, bridgePath: BRIDGE_PATH });
    expect(second.changed).toBe(false);
    const textAfterSecond = readFileSync(configPath, "utf8");
    expect(textAfterSecond).toBe(textAfterFirst);
  });

  it("preserves unrelated existing config content", () => {
    const preservePath = path.join(dir, "preserve-config.yaml");
    mkdirSync(path.dirname(preservePath), { recursive: true });
    writeFileSync(preservePath, "model: my-model\n", "utf8");

    installHooks({ configPath: preservePath, bridgePath: BRIDGE_PATH });
    const written = readFileSync(preservePath, "utf8");
    expect(written).toContain("model: my-model");
    expect(written).toContain(BRIDGE_PATH);
  });
});
