/**
 * Signal-wiring integration tests
 *
 * Proves that BEH-010 (sessionReadSet) and BEH-022 (loopDetector) receive
 * populated signals through the full handleHook → evaluateGate pipeline.
 *
 * These tests exercise the runtime path that was previously inert:
 *   - BEH-010: sessionReadSet is rebuilt from persisted run-set events so that
 *     Write calls against files that were Read earlier in the session are allowed,
 *     and Write calls against unread existing files are blocked/warned.
 *   - BEH-022: loopDetector ring buffer is appended on every post_tool event so
 *     that three consecutive identical tool calls produce LOOP_DETECTED.
 *
 * Uses a real temp-directory project (no mocks) to verify end-to-end persistence.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  enterDevelopment,
  handleHook,
  initPlanningProject,
  readPlanningProject,
} from "../src/index.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "harness-signal-wiring-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 });
});

// ── BEH-010 signal wiring ─────────────────────────────────────────────────────

describe("BEH-010 — sessionReadSet signal wiring (end-to-end)", () => {
  it("allows a Write to an existing file that was Read earlier this session", async () => {
    // Set up a real file on disk so existsSync returns true inside BEH-010.
    // Use risk class L: enforceBlockingRuntimeBinding only fires at M+, so at L
    // the gate reaches BEH-010 and write-zone checks without a runtime-binding block.
    await mkdir(path.join(root, "src"), { recursive: true });
    const filePath = path.join(root, "src", "foo.ts");
    await writeFile(filePath, "export const x = 1;\n", "utf8");

    await initPlanningProject(root);
    await enterDevelopment(root, {
      phase: "build",
      subPhase: "Execute",
      mode: "auto",
      riskClass: "L",
      objective: "test beh-010",
    });

    // Step 1: simulate a successful Read tool post_tool — this stores readPath in the event.
    // tool_output must match the actual file content exactly (including trailing newline)
    // so that the content hash stored in the event matches what readFileSync returns in BEH-010.
    await handleHook(root, "post_tool", {
      tool_name: "Read",
      tool_input: { file_path: filePath },
      tool_output: "export const x = 1;\n",
    });

    // Step 2: now a Write pre_tool for the same file — BEH-010 must allow it
    // because sessionReadSet has been rebuilt from the persisted Read event.
    const result = await handleHook(root, "pre_tool", {
      tool_name: "Write",
      tool_input: { file_path: filePath, content: "export const x = 2;\n" },
    });

    // With the file in sessionReadSet → BEH-010 must abstain → no BEH-010 violation
    // (write-zone check may still warn, but the reason must NOT be BEH-010)
    expect(result.reason).not.toContain("BEH-010");
    expect(result.reason).not.toContain("was not read in this session");
  });

  it("warns on a Write to an existing file that was NOT read this session (risk L)", async () => {
    // Risk class L: BEH-010 produces warn (not block) at L. Runtime-binding check
    // is skipped at L so BEH-010's verdict is the one that surfaces.
    await mkdir(path.join(root, "src"), { recursive: true });
    const filePath = path.join(root, "src", "unread.ts");
    await writeFile(filePath, "export const y = 1;\n", "utf8");

    await initPlanningProject(root);
    await enterDevelopment(root, {
      phase: "build",
      subPhase: "Execute",
      mode: "auto",
      riskClass: "L",
      objective: "test beh-010 violation",
    });

    // No Read event for this file — sessionReadSet will be empty
    const result = await handleHook(root, "pre_tool", {
      tool_name: "Write",
      tool_input: { file_path: filePath, content: "export const y = 2;\n" },
    });

    // At L risk class with empty sessionReadSet → BEH-010 must warn
    // (blocks at M+; warns at T/L per spec risk_floor M)
    expect(["warn", "block"]).toContain(result.decision);
    expect(result.reason).toContain("BEH-010");
  });

  it("stores readPath in the run-set event when a Read post_tool is processed", async () => {
    await mkdir(path.join(root, "src"), { recursive: true });
    const filePath = path.join(root, "src", "bar.ts");
    await writeFile(filePath, "// content\n", "utf8");

    await initPlanningProject(root);

    await handleHook(root, "post_tool", {
      tool_name: "Read",
      tool_input: { file_path: filePath },
      tool_output: "// content",
    });

    const project = await readPlanningProject(root);
    const readEvent = project.runSet.events.find(
      (e) => e.gateType === "post_tool" && e.payload?.toolName === "Read",
    );

    expect(readEvent).toBeDefined();
    // readPath must be stored in the event payload (normalized to lowercase forward-slash)
    expect(typeof readEvent?.payload?.readPath).toBe("string");
    expect(readEvent?.payload?.readPath).toBeTruthy();
  });
});

// ── BEH-022 signal wiring ─────────────────────────────────────────────────────

describe("BEH-022 — loopDetector signal wiring (end-to-end)", () => {
  it("appends a loopDetector entry to the run-set on each post_tool call", async () => {
    await initPlanningProject(root);

    await handleHook(root, "post_tool", {
      tool_name: "Bash",
      tool_input: { command: "echo hello" },
      tool_output: "hello",
    });

    const project = await readPlanningProject(root);
    expect(project.runSet.loopDetector).toBeDefined();
    expect(project.runSet.loopDetector?.entries.length).toBeGreaterThanOrEqual(1);
    const entry = project.runSet.loopDetector?.entries[0];
    expect(entry?.toolName).toBe("Bash");
    expect(entry?.argsHash).toMatch(/^[a-f0-9]{64}$/);
    expect(entry?.resultHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces a LOOP_DETECTED block after three identical post_tool events", async () => {
    await initPlanningProject(root);

    const loopPayload = {
      tool_name: "Bash",
      tool_input: { command: "git status" },
      tool_output: "nothing to commit",
    };

    // First call — abstain
    const r1 = await handleHook(root, "post_tool", loopPayload);
    expect(r1.decision).toBe("allow");

    // Second identical call — warn
    const r2 = await handleHook(root, "post_tool", loopPayload);
    expect(r2.decision).toBe("warn");
    expect(r2.reason).toContain("BEH-022");

    // Third identical call — block with LOOP_DETECTED
    const r3 = await handleHook(root, "post_tool", loopPayload);
    expect(r3.decision).toBe("block");
    expect(r3.reason).toContain("LOOP_DETECTED");
    expect(r3.finalState).toBe("LOOP_DETECTED");
  });

  it("breaks the loop count after a different tool call", async () => {
    await initPlanningProject(root);

    const loopPayload = {
      tool_name: "Bash",
      tool_input: { command: "ls" },
      tool_output: "file.ts",
    };

    await handleHook(root, "post_tool", loopPayload);
    await handleHook(root, "post_tool", loopPayload); // second — warn

    // Different call breaks the chain
    await handleHook(root, "post_tool", {
      tool_name: "Read",
      tool_input: { file_path: "src/other.ts" },
      tool_output: "content",
    });

    // Same as loop payload again — resets to count=1, should allow
    const result = await handleHook(root, "post_tool", loopPayload);
    expect(result.decision).toBe("allow");
  });
});
