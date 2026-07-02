/**
 * init.test.ts — integration tests for `runInit` (SPEC-016/SPEC-017).
 *
 * Runs the real runInit() function (not a spawned subprocess) against a real tmp root,
 * with answers supplied via an injected AnswerProvider (or opts.yes for the non-interactive
 * default path). This exercises the real fs writes (safeAtomicWriteFile) end-to-end.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { decodeHimaConfigEither } from "@hima/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type AnswerProvider, type InitAnswers, runInit } from "../src/init.js";

// ---------------------------------------------------------------------------
// Tmp root lifecycle
// ---------------------------------------------------------------------------

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "hima-init-test-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helper: build a canned AnswerProvider from an ordered list of raw answers
// ---------------------------------------------------------------------------

function cannedAnswers(order: string[]): AnswerProvider {
  let i = 0;
  return async (): Promise<string> => {
    const v = order[i] ?? "";
    i += 1;
    return v;
  };
}

function readConfig(r: string): unknown {
  return JSON.parse(readFileSync(path.join(r, ".hima", "config.json"), "utf8"));
}

function readRisk(r: string): unknown {
  return JSON.parse(readFileSync(path.join(r, ".hima", "current-risk.json"), "utf8"));
}

// ---------------------------------------------------------------------------
// --yes path (A-018) — all defaults, no answer provider invoked
// ---------------------------------------------------------------------------

describe("runInit --yes path", () => {
  it("writes a valid HimaConfig using every default answer", async () => {
    const result = await runInit({ root, yes: true });

    const raw = readConfig(root);
    const decoded = decodeHimaConfigEither(raw);
    expect(decoded._tag).toBe("Right");

    expect(result.answers.useDevCyclePack).toBe(true);
    expect(result.answers.enableCorpus).toBe(false);
    expect(result.answers.floor).toBe("M");
    expect(result.answers.wireHooksNow).toBe(true);
    expect(result.answers.runtimes.length).toBeGreaterThan(0);
  });

  it("omits useDevCyclePack entirely when the default pack is used (A-004/INV-3)", async () => {
    await runInit({ root, yes: true });
    const raw = readConfig(root) as Record<string, unknown>;
    expect("useDevCyclePack" in raw).toBe(false);
  });

  it("writes enabledSources without 'corpus' by default (Q-003 default = No)", async () => {
    await runInit({ root, yes: true });
    const raw = readConfig(root) as { enabledSources?: string[] };
    expect(raw.enabledSources).toEqual(["base", "user", "project"]);
  });

  it("writes current-risk.json with the default floor 'M'", async () => {
    await runInit({ root, yes: true });
    expect(readRisk(root)).toEqual({ risk_class: "M" });
  });

  it("writes a .hima/config.example.jsonc starter reference (A-017)", async () => {
    await runInit({ root, yes: true });
    const examplePath = path.join(root, ".hima", "config.example.jsonc");
    expect(existsSync(examplePath)).toBe(true);
    const content = readFileSync(examplePath, "utf8");
    expect(content).toContain("stageSkills");
    expect(content).toContain("enabledSources");
  });

  it("auto-detects runtime 'claude' when .claude/ is present", async () => {
    mkdirSync(path.join(root, ".claude"), { recursive: true });
    const result = await runInit({ root, yes: true });
    expect(result.answers.runtimes).toEqual(["claude"]);
  });

  it("auto-detects runtime 'codex' when AGENTS.md is present (no .claude dir)", async () => {
    writeFileSync(path.join(root, "AGENTS.md"), "# agents\n");
    const result = await runInit({ root, yes: true });
    expect(result.answers.runtimes).toEqual(["codex"]);
  });

  it("wires hooks for the detected runtime when wireHooksNow defaults to true", async () => {
    mkdirSync(path.join(root, ".claude"), { recursive: true });
    const result = await runInit({ root, yes: true });
    expect(result.wired.length).toBeGreaterThan(0);
    expect(existsSync(path.join(root, ".claude", "settings.json"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Interactive path via an injected AnswerProvider
// ---------------------------------------------------------------------------

describe("runInit with an injected AnswerProvider", () => {
  it("parses explicit answers for all 5 questions in order (Q1..Q5)", async () => {
    const provider = cannedAnswers([
      "codex", // Q1 runtimes
      "no", // Q2 useDevCyclePack -> false
      "yes", // Q3 enableCorpus -> true
      "H", // Q4 floor
      "no", // Q5 wireHooksNow -> false
    ]);

    const result = await runInit({ root, answerProvider: provider });

    expect(result.answers.runtimes).toEqual(["codex"]);
    expect(result.answers.useDevCyclePack).toBe(false);
    expect(result.answers.enableCorpus).toBe(true);
    expect(result.answers.floor).toBe("H");
    expect(result.answers.wireHooksNow).toBe(false);
    expect(result.wired).toEqual([]);
  });

  it("writes useDevCyclePack: false when Q2 answer opts out", async () => {
    const provider = cannedAnswers(["claude", "no", "no", "M", "no"]);
    await runInit({ root, answerProvider: provider });
    const raw = readConfig(root) as { useDevCyclePack?: boolean };
    expect(raw.useDevCyclePack).toBe(false);
  });

  it("writes enabledSources with 'corpus' when Q3 answer is yes", async () => {
    const provider = cannedAnswers(["claude", "yes", "yes", "M", "no"]);
    await runInit({ root, answerProvider: provider });
    const raw = readConfig(root) as { enabledSources?: string[] };
    expect(raw.enabledSources).toEqual(["base", "corpus", "user", "project"]);
  });

  it("accepts multiple comma-separated runtimes at Q1", async () => {
    const provider = cannedAnswers(["claude,codex", "yes", "no", "M", "no"]);
    const result = await runInit({ root, answerProvider: provider });
    expect(result.answers.runtimes).toEqual(["claude", "codex"]);
  });

  it("blank answers fall back to the safe default for every question (R-002)", async () => {
    const provider = cannedAnswers(["", "", "", "", ""]);
    const result = await runInit({ root, answerProvider: provider });
    const decoded = decodeHimaConfigEither(readConfig(root));
    expect(decoded._tag).toBe("Right");
    expect(result.answers.floor).toBe("M");
    expect(result.answers.useDevCyclePack).toBe(true);
    expect(result.answers.wireHooksNow).toBe(true);
  });

  it("garbage input at Q1 falls back to the detected default runtime", async () => {
    mkdirSync(path.join(root, ".claude"), { recursive: true });
    const provider = cannedAnswers(["not-a-runtime", "yes", "no", "M", "no"]);
    const result = await runInit({ root, answerProvider: provider });
    expect(result.answers.runtimes).toEqual(["claude"]);
  });

  it("skips hook-wiring and emits a manual note for an 'opencode' runtime selection", async () => {
    const provider = cannedAnswers(["opencode", "yes", "no", "M", "yes"]);
    const result = await runInit({ root, answerProvider: provider });
    expect(result.wired).toEqual([]);
    expect(result.messages.some((m) => m.includes("opencode"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Re-run / merge behavior (A-015, A-016, INV-4)
// ---------------------------------------------------------------------------

describe("runInit re-run merge behavior", () => {
  it("re-running with --yes preserves hand-edited stageSkills/roles/cycle untouched", async () => {
    // First run: scaffold the project.
    await runInit({ root, yes: true });

    // Hand-edit the config: add stageSkills + roles that hima init never writes.
    const configPath = path.join(root, ".hima", "config.json");
    const handEdited = {
      ...(readConfig(root) as Record<string, unknown>),
      stageSkills: {
        discovery: { force: [{ source: "project", id: "my-custom-skill" }] },
      },
      roles: {
        executor: { model: "haiku" },
      },
    };
    writeFileSync(configPath, JSON.stringify(handEdited, null, 2) + "\n");

    // Re-run with different answers.
    const result = await runInit({
      root,
      answerProvider: cannedAnswers(["claude", "yes", "yes", "H", "no"]),
    });

    const raw = readConfig(root) as Record<string, unknown>;
    expect(raw["stageSkills"]).toEqual(handEdited.stageSkills);
    expect(raw["roles"]).toEqual(handEdited.roles);
    // The 3 owned keys reflect the NEW run's answers, not the first run's.
    expect(raw["enabledSources"]).toEqual(["base", "corpus", "user", "project"]);
    expect(result.answers.floor).toBe("H");

    const decoded = decodeHimaConfigEither(raw);
    expect(decoded._tag).toBe("Right");
  });

  it("re-running with 'use default pack' removes a prior useDevCyclePack:false", async () => {
    await runInit({ root, answerProvider: cannedAnswers(["claude", "no", "no", "M", "no"]) });
    expect((readConfig(root) as { useDevCyclePack?: boolean }).useDevCyclePack).toBe(false);

    await runInit({ root, answerProvider: cannedAnswers(["claude", "yes", "no", "M", "no"]) });
    const raw = readConfig(root) as Record<string, unknown>;
    expect("useDevCyclePack" in raw).toBe(false);
  });

  it("re-running pre-fills defaults from the existing config (upgrade path)", async () => {
    await runInit({ root, answerProvider: cannedAnswers(["codex", "no", "yes", "H", "no"]) });

    // Second run: blank answers everywhere should preserve the prior run's values.
    const result = await runInit({ root, answerProvider: cannedAnswers(["", "", "", "", ""]) });

    expect(result.answers.runtimes).toEqual(["codex"]);
    expect(result.answers.useDevCyclePack).toBe(false);
    expect(result.answers.enableCorpus).toBe(true);
    expect(result.answers.floor).toBe("H");
  });

  it("re-running does not overwrite an unrelated existing config.json field of stageSkills type twice", async () => {
    await runInit({ root, yes: true });
    await runInit({ root, yes: true });
    const decoded = decodeHimaConfigEither(readConfig(root));
    expect(decoded._tag).toBe("Right");
  });

  it("errors out (does not overwrite) when the existing config.json fails to decode", async () => {
    mkdirSync(path.join(root, ".hima"), { recursive: true });
    writeFileSync(
      path.join(root, ".hima", "config.json"),
      JSON.stringify({ enabledSources: ["not-a-valid-source"] }) + "\n",
    );

    await expect(runInit({ root, yes: true })).rejects.toThrow(/does not decode/);

    // The invalid file must survive untouched.
    const raw = readFileSync(path.join(root, ".hima", "config.json"), "utf8");
    expect(JSON.parse(raw)).toEqual({ enabledSources: ["not-a-valid-source"] });
  });

  it("errors out when the existing config.json is not valid JSON", async () => {
    mkdirSync(path.join(root, ".hima"), { recursive: true });
    writeFileSync(path.join(root, ".hima", "config.json"), "{ not json");

    await expect(runInit({ root, yes: true })).rejects.toThrow(/not valid JSON/);
  });
});

// ---------------------------------------------------------------------------
// Cross-check: InitAnswers type shape is exactly the 5 SPEC-016 questions
// ---------------------------------------------------------------------------

describe("InitAnswers shape", () => {
  it("has exactly the 5 fields mapping to Q-001..Q-005", () => {
    const answers: InitAnswers = {
      runtimes: ["claude"],
      useDevCyclePack: true,
      enableCorpus: false,
      floor: "M",
      wireHooksNow: true,
    };
    expect(Object.keys(answers).sort()).toEqual(
      ["runtimes", "useDevCyclePack", "enableCorpus", "floor", "wireHooksNow"].sort(),
    );
  });
});
