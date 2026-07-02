/**
 * e2e-init.test.ts — SPAWN e2e test for `hima init --yes`.
 *
 * Spawns the built dist/index.js in a real tmp root to validate the CLI wiring itself
 * (parseArgs -> main() -> runInit()), independent of init.test.ts's in-process coverage.
 *
 * Pre-condition: `pnpm --filter @hima/cli build` must have run before this suite executes
 * (dist/index.js must exist).
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DIST_INDEX = path.resolve(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "../dist/index.js",
);

let root: string;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "hima-e2e-init-"));
  mkdirSync(path.join(root, ".claude"), { recursive: true });
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function spawnInit(extraArgs: string[] = []) {
  const result = spawnSync("node", [DIST_INDEX, "init", "--yes", "--root", root, ...extraArgs], {
    encoding: "utf8",
    timeout: 20_000,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

describe("hima init --yes (spawned CLI)", () => {
  let initResult: { status: number | null; stdout: string; stderr: string };

  beforeAll(() => {
    initResult = spawnInit();
  });

  it("exits 0", () => {
    expect(initResult.status).toBe(0);
  });

  it("stdout contains a done message", () => {
    expect(initResult.stdout).toContain("[hima init]");
    expect(initResult.stdout).toContain("Done");
  });

  it("writes <root>/.hima/config.json as valid JSON", () => {
    const configPath = path.join(root, ".hima", "config.json");
    expect(existsSync(configPath)).toBe(true);
    expect(() => JSON.parse(readFileSync(configPath, "utf8"))).not.toThrow();
  });

  it("config.json has the expected default onboarding fields", () => {
    const parsed = JSON.parse(
      readFileSync(path.join(root, ".hima", "config.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(parsed["runtimes"]).toEqual(["claude"]);
    expect(parsed["enabledSources"]).toEqual(["base", "user", "project"]);
    expect("useDevCyclePack" in parsed).toBe(false);
  });

  it("writes <root>/.hima/current-risk.json with the default 'M' floor", () => {
    const riskPath = path.join(root, ".hima", "current-risk.json");
    expect(existsSync(riskPath)).toBe(true);
    expect(JSON.parse(readFileSync(riskPath, "utf8"))).toEqual({ risk_class: "M" });
  });

  it("writes <root>/.hima/config.example.jsonc", () => {
    expect(existsSync(path.join(root, ".hima", "config.example.jsonc"))).toBe(true);
  });

  it("wires <root>/.claude/settings.json (Q-005 default = yes)", () => {
    expect(existsSync(path.join(root, ".claude", "settings.json"))).toBe(true);
  });

  it("re-running init --yes is idempotent (exit 0, config still decodes)", () => {
    const second = spawnInit();
    expect(second.status).toBe(0);
    const parsed = JSON.parse(
      readFileSync(path.join(root, ".hima", "config.json"), "utf8"),
    ) as unknown;
    expect(parsed).toBeTruthy();
  });
});
