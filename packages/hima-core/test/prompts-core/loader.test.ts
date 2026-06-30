/**
 * Tests for prompts-core/loader.ts (loadPrompt) and the three role prompt tables.
 *
 * Covers:
 *   - loadPrompt("bundled") → returns content synchronously (no I/O).
 *   - loadPrompt("filesystem") → reads <baseDir>/<variantName>.md.
 *   - loadPrompt("filesystem") → throws on path-traversal attempt.
 *   - loadPrompt("filesystem") → throws when variantName is missing.
 *   - PLANNER_PROMPTS, EXECUTOR_PROMPTS, CRITIC_PROMPTS each have "default" + "claude".
 *   - All bundled variants are non-empty strings.
 */

import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadPrompt } from "../../src/prompts-core/loader.js";
import { PLANNER_PROMPTS } from "../../src/prompts-core/planner-prompts.js";
import { EXECUTOR_PROMPTS } from "../../src/prompts-core/executor-prompts.js";
import { CRITIC_PROMPTS } from "../../src/prompts-core/critic-prompts.js";
import type { PromptSource } from "../../src/prompts-core/types.js";

// ---------------------------------------------------------------------------
// Tmp dir lifecycle for filesystem tests
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "loader-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// loadPrompt — bundled
// ---------------------------------------------------------------------------

describe("loadPrompt — bundled source", () => {
  it("returns the bundled content string", async () => {
    const source: PromptSource = { kind: "bundled", content: "hello world" };
    await expect(loadPrompt(source)).resolves.toBe("hello world");
  });

  it("returns empty string when bundled content is empty", async () => {
    const source: PromptSource = { kind: "bundled", content: "" };
    await expect(loadPrompt(source)).resolves.toBe("");
  });

  it("ignores variantName for bundled sources", async () => {
    const source: PromptSource = { kind: "bundled", content: "fixed" };
    await expect(loadPrompt(source, "ignored-variant")).resolves.toBe("fixed");
  });

  it("bundled content with newlines is preserved verbatim", async () => {
    const content = "line1\nline2\nline3";
    const source: PromptSource = { kind: "bundled", content };
    await expect(loadPrompt(source)).resolves.toBe(content);
  });
});

// ---------------------------------------------------------------------------
// loadPrompt — filesystem
// ---------------------------------------------------------------------------

describe("loadPrompt — filesystem source", () => {
  it("reads <baseDir>/<variantName>.md and returns its content", async () => {
    await writeFile(path.join(tmpDir, "default.md"), "fs prompt content", "utf-8");
    const source: PromptSource = { kind: "filesystem", baseDir: tmpDir };
    await expect(loadPrompt(source, "default")).resolves.toBe("fs prompt content");
  });

  it("reads a 'claude' variant file when present", async () => {
    await writeFile(path.join(tmpDir, "claude.md"), "claude variant text", "utf-8");
    const source: PromptSource = { kind: "filesystem", baseDir: tmpDir };
    await expect(loadPrompt(source, "claude")).resolves.toBe("claude variant text");
  });

  it("throws when variantName is missing for filesystem source", async () => {
    const source: PromptSource = { kind: "filesystem", baseDir: tmpDir };
    await expect(loadPrompt(source)).rejects.toThrow(/variantName is required/);
  });

  it("throws when variantName is empty string for filesystem source", async () => {
    const source: PromptSource = { kind: "filesystem", baseDir: tmpDir };
    await expect(loadPrompt(source, "")).rejects.toThrow(/variantName is required/);
  });

  it("throws on file not found", async () => {
    const source: PromptSource = { kind: "filesystem", baseDir: tmpDir };
    await expect(loadPrompt(source, "nonexistent")).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// loadPrompt — path-traversal guard
// ---------------------------------------------------------------------------

describe("loadPrompt — path-traversal guard", () => {
  it("rejects variantName containing '..'", async () => {
    const source: PromptSource = { kind: "filesystem", baseDir: tmpDir };
    await expect(loadPrompt(source, "../escape")).rejects.toThrow(
      /invalid variantName|path traversal/i,
    );
  });

  it("rejects variantName containing '/'", async () => {
    const source: PromptSource = { kind: "filesystem", baseDir: tmpDir };
    await expect(loadPrompt(source, "sub/dir")).rejects.toThrow(
      /invalid variantName|path traversal/i,
    );
  });

  it("rejects variantName containing '\\'", async () => {
    const source: PromptSource = { kind: "filesystem", baseDir: tmpDir };
    await expect(loadPrompt(source, "sub\\dir")).rejects.toThrow(
      /invalid variantName|path traversal/i,
    );
  });
});

// ---------------------------------------------------------------------------
// PLANNER_PROMPTS — VariantTable shape
// ---------------------------------------------------------------------------

describe("PLANNER_PROMPTS", () => {
  it("has a 'default' variant", () => {
    expect(PLANNER_PROMPTS["default"]).toBeDefined();
  });

  it("has a 'claude' variant", () => {
    expect(PLANNER_PROMPTS["claude"]).toBeDefined();
  });

  it("'default' is bundled and non-empty", () => {
    const v = PLANNER_PROMPTS["default"];
    expect(v?.kind).toBe("bundled");
    if (v?.kind === "bundled") expect(v.content.length).toBeGreaterThan(0);
  });

  it("'claude' is bundled and non-empty", () => {
    const v = PLANNER_PROMPTS["claude"];
    expect(v?.kind).toBe("bundled");
    if (v?.kind === "bundled") expect(v.content.length).toBeGreaterThan(0);
  });

  it("both variants carry the [HIMA role:planner] marker", () => {
    for (const key of ["default", "claude"] as const) {
      const v = PLANNER_PROMPTS[key];
      if (v?.kind === "bundled") {
        expect(v.content).toContain("[HIMA role:planner]");
      }
    }
  });

  it("loadPrompt resolves bundled default variant", async () => {
    const v = PLANNER_PROMPTS["default"]!;
    const result = await loadPrompt(v);
    expect(result).toContain("[HIMA role:planner]");
  });
});

// ---------------------------------------------------------------------------
// EXECUTOR_PROMPTS — VariantTable shape
// ---------------------------------------------------------------------------

describe("EXECUTOR_PROMPTS", () => {
  it("has a 'default' variant", () => {
    expect(EXECUTOR_PROMPTS["default"]).toBeDefined();
  });

  it("has a 'claude' variant", () => {
    expect(EXECUTOR_PROMPTS["claude"]).toBeDefined();
  });

  it("'default' is bundled and non-empty", () => {
    const v = EXECUTOR_PROMPTS["default"];
    expect(v?.kind).toBe("bundled");
    if (v?.kind === "bundled") expect(v.content.length).toBeGreaterThan(0);
  });

  it("'claude' is bundled and non-empty", () => {
    const v = EXECUTOR_PROMPTS["claude"];
    expect(v?.kind).toBe("bundled");
    if (v?.kind === "bundled") expect(v.content.length).toBeGreaterThan(0);
  });

  it("both variants carry the [HIMA role:executor] marker", () => {
    for (const key of ["default", "claude"] as const) {
      const v = EXECUTOR_PROMPTS[key];
      if (v?.kind === "bundled") {
        expect(v.content).toContain("[HIMA role:executor]");
      }
    }
  });

  it("loadPrompt resolves bundled default variant", async () => {
    const v = EXECUTOR_PROMPTS["default"]!;
    const result = await loadPrompt(v);
    expect(result).toContain("[HIMA role:executor]");
  });
});

// ---------------------------------------------------------------------------
// CRITIC_PROMPTS — VariantTable shape
// ---------------------------------------------------------------------------

describe("CRITIC_PROMPTS", () => {
  it("has a 'default' variant", () => {
    expect(CRITIC_PROMPTS["default"]).toBeDefined();
  });

  it("has a 'claude' variant", () => {
    expect(CRITIC_PROMPTS["claude"]).toBeDefined();
  });

  it("'default' is bundled and non-empty", () => {
    const v = CRITIC_PROMPTS["default"];
    expect(v?.kind).toBe("bundled");
    if (v?.kind === "bundled") expect(v.content.length).toBeGreaterThan(0);
  });

  it("'claude' is bundled and non-empty", () => {
    const v = CRITIC_PROMPTS["claude"];
    expect(v?.kind).toBe("bundled");
    if (v?.kind === "bundled") expect(v.content.length).toBeGreaterThan(0);
  });

  it("both variants carry the [HIMA role:reviewer] marker", () => {
    for (const key of ["default", "claude"] as const) {
      const v = CRITIC_PROMPTS[key];
      if (v?.kind === "bundled") {
        expect(v.content).toContain("[HIMA role:reviewer]");
      }
    }
  });

  it("loadPrompt resolves bundled default variant", async () => {
    const v = CRITIC_PROMPTS["default"]!;
    const result = await loadPrompt(v);
    expect(result).toContain("[HIMA role:reviewer]");
  });
});
