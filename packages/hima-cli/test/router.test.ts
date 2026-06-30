/**
 * router.test.ts — unit tests for the @hima/cli event router.
 *
 * Tests the pure `route(event, payload, root)` function exported from
 * src/index.ts (in addition to readStdinPayload which is already in src/).
 *
 * Strategy:
 *   1. For the router function: import and call directly — no subprocess, no I/O.
 *   2. For non-blocking events: assert exitCode===0 and no blocking stdout.
 *   3. For event normalisation: verify the CLI's event-string→gateType mapping.
 *
 * NOTE: The src lane exposes `route(event, payload, root)` returning
 * `Promise<{stdout: string; exitCode: number}>`. If the build has not yet
 * produced a dist, these tests import from "../src/index.js" (NodeNext ESM).
 * The spawn-based e2e file uses the built dist and is the primary gate-proof.
 *
 * All tests use a real tmp .hima directory — no mocks of @hima/core or fs.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Dynamic import so the test file compiles even before src/index.ts exists.
// The src lane MUST export `route` for these tests to pass.
type RouteResult = { stdout: string; exitCode: number };
type RouteFn = (
  event: string,
  payload: { toolName?: string; toolInput?: unknown; promptContent?: string },
  root: string,
) => Promise<RouteResult>;

let route: RouteFn;

// ---------------------------------------------------------------------------
// Setup — tmp root + lazy import of src/index.js
// ---------------------------------------------------------------------------

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "hima-cli-router-"));

  // Lazy-import each time so module caching does not interfere.
  // The src lane exports `route` from src/index.ts.
  const mod = await import("../src/index.js");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic import returns `unknown`; we validate the shape immediately below via typeof check
  route = (mod as any).route as RouteFn;

  if (typeof route !== "function") {
    throw new Error(
      "src/index.ts does not export a `route` function. " +
        "The src lane must export: export async function route(event, payload, root): Promise<{stdout,exitCode}>",
    );
  }
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// §1 — Non-forcing events exit 0 (graceful no-op)
// ---------------------------------------------------------------------------

describe("router — graceful no-op events (exit 0)", () => {
  // subagent-start is no longer a no-op: it evaluates BEH_WORKER_MODEL and blocks
  // on claude when no model is specified. See e2e-subagents.test.ts for coverage.
  const noOpEvents = [
    "session-start",
    "post-tool-use",
    "pre-compact",
    "post-compact",
  ] as const;

  for (const event of noOpEvents) {
    it(`${event} → exitCode 0, no block in stdout`, async () => {
      const result = await route(event, {}, root);

      expect(result.exitCode, `${event} exitCode`).toBe(0);
      expect(result.stdout, `${event} stdout must not contain "block"`).not.toMatch(
        /"decision"\s*:\s*"block"/,
      );
    });
  }

  it("unknown / future event string → exitCode 0 (safety net)", async () => {
    const result = await route("future-unknown-event", {}, root);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toMatch(/"decision"\s*:\s*"block"/);
  });
});

// ---------------------------------------------------------------------------
// §2 — Event normalisation: CLI strings → gateType mapping
// ---------------------------------------------------------------------------

describe("router — event normalisation", () => {
  /**
   * pre-tool-use without a ward and without a write tool must exit 0 (no ward →
   * no-op per contract: "If none → exit 0 allow").
   */
  it("pre-tool-use with no ward.json → exit 0 (allow)", async () => {
    // No ward created → no .hima/state/ward.json exists
    const result = await route(
      "pre-tool-use",
      { toolName: "Read", toolInput: {} },
      root,
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toMatch(/"decision"\s*:\s*"block"/);
  });

  /**
   * user-prompt-submit with no sigil → exit 0, no ward created.
   */
  it("user-prompt-submit with no terminal sigil → exit 0, silent", async () => {
    const result = await route(
      "user-prompt-submit",
      { promptContent: "just a normal message with no sigil" },
      root,
    );
    expect(result.exitCode).toBe(0);
    // No canary / no block stdout expected
    expect(result.stdout).not.toMatch(/"decision"\s*:\s*"block"/);
  });

  /**
   * user-prompt-submit with terminal "ulw" sigil → exit 0 with additionalContext canary.
   * A ward.json must be created so subsequent pre-tool-use gates can resume it.
   */
  it("user-prompt-submit with 'ulw' sigil → exit 0 + additionalContext + ward created", async () => {
    const result = await route(
      "user-prompt-submit",
      { promptContent: "build it ulw" },
      root,
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toMatch(/"decision"\s*:\s*"block"/);
    // Should contain additionalContext with a canary
    expect(result.stdout).toMatch(/additionalContext|hookSpecificOutput/);
    expect(result.stdout).toMatch(/\[HIMA\]/);

    // Ward must have been written so subsequent gates can resume it.
    const { resumeWard } = await import("@hima/core");
    const ward = await resumeWard(root);
    expect(ward).not.toBeNull();
    expect(ward?.entryPoint).toBe("full");
    expect(ward?.openStage).toBe("discovery");
  });

  /**
   * user-prompt-submit with terminal "spec" sigil → openStage = "spec".
   */
  it("user-prompt-submit with 'spec' sigil → ward.openStage = 'spec'", async () => {
    await route(
      "user-prompt-submit",
      { promptContent: "formalise requirements spec" },
      root,
    );

    const { resumeWard } = await import("@hima/core");
    const ward = await resumeWard(root);
    expect(ward?.openStage).toBe("spec");
    expect(ward?.entryPoint).toBe("spec");
  });
});

// ---------------------------------------------------------------------------
// §3 — pre-tool-use with write tool + ward at discovery stage
//        (full happy-path assertion; also covered in e2e-cli-spawn.test.ts)
// ---------------------------------------------------------------------------

describe("router — pre-tool-use skill-force block", () => {
  it(
    "GIVEN ward at discovery, empty register, toolName=Write → exitCode 2 + block stdout",
    async () => {
      // Bootstrap a ward at openStage "discovery"
      const { createWard } = await import("@hima/core");
      await createWard(root, { id: "test-run-001", entryPoint: "full", floor: "H" });

      const result = await route(
        "pre-tool-use",
        { toolName: "Write", toolInput: {} },
        root,
      );

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toMatch(/"decision"\s*:\s*"block"/);
      // Must include the discovery-stage skill id
      expect(result.stdout).toContain("corpus-technical-analysis-discovery");
    },
    10_000,
  );

  it(
    "GIVEN ward at discovery (floor M), skill already markLoaded → exitCode 0 (allow)",
    async () => {
      const { createWard, markLoaded } = await import("@hima/core");
      // Use floor M: at M, only the base DEV_CYCLE discovery skill is required (no R-017 extras).
      // At floor H, resolveStageForceSkillsForFloor adds extra skills that would also need loading.
      await createWard(root, { id: "test-run-002", entryPoint: "full", floor: "M" });
      // Mark the discovery skill as already loaded
      await markLoaded(root, {
        source: "corpus",
        id: "corpus-technical-analysis-discovery",
      });

      const result = await route(
        "pre-tool-use",
        { toolName: "Write", toolInput: {} },
        root,
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).not.toMatch(/"decision"\s*:\s*"block"/);
    },
    10_000,
  );

  it(
    "GIVEN ward at discovery, non-write tool (Bash) → exitCode 0 regardless of register",
    async () => {
      const { createWard } = await import("@hima/core");
      await createWard(root, { id: "test-run-003", entryPoint: "full", floor: "H" });

      const result = await route(
        "pre-tool-use",
        { toolName: "Bash", toolInput: {} },
        root,
      );

      // Non-write tools must not be blocked
      expect(result.exitCode).toBe(0);
      expect(result.stdout).not.toMatch(/"decision"\s*:\s*"block"/);
    },
    10_000,
  );
});

// ---------------------------------------------------------------------------
// §4 — Safety: malformed / missing payload never crashes
// ---------------------------------------------------------------------------

describe("router — safety: malformed payload never blocks or throws", () => {
  it("empty payload object → exit 0", async () => {
    const result = await route("user-prompt-submit", {}, root);
    expect(result.exitCode).toBe(0);
  });

  it("promptContent is undefined → exit 0", async () => {
    const result = await route("user-prompt-submit", { promptContent: undefined }, root);
    expect(result.exitCode).toBe(0);
  });

  it("unknown toolName → pre-tool-use exits 0 (non-write tool path)", async () => {
    const { createWard } = await import("@hima/core");
    await createWard(root, { id: "test-run-safe", entryPoint: "full", floor: "H" });

    const result = await route(
      "pre-tool-use",
      { toolName: "SomeUnknownTool", toolInput: {} },
      root,
    );
    // Unknown tool names must not trigger a block
    expect(result.exitCode).toBe(0);
  });
});
