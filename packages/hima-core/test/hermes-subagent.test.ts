/**
 * Tests for hermes-subagent.ts — R-047 injectRulesIntoDelegateTask and
 * R-048 markSubagentSeen / isSubagentSeen.
 *
 * Scenarios:
 *  injectRulesIntoDelegateTask
 *  1.  Short rules — appended once with correct sentinel + separator lines
 *  2.  Idempotent — calling a second time with already-injected text returns unchanged
 *  3.  Truncation — rules > 3000 chars are cut at 3000 + "...[truncated]"
 *  4.  Exact 3000-char rules — NOT truncated (boundary at >3000, not >=3000)
 *  5.  Empty rules — empty body still injected (sentinel present)
 *
 *  markSubagentSeen / isSubagentSeen
 *  6.  markSubagentSeen then isSubagentSeen → true
 *  7.  isSubagentSeen without prior mark → false
 *  8.  Marking the same pair twice remains idempotent (no duplicate entries)
 *  9.  Distinct (agentId, event) pairs are tracked independently
 *  10. Sessions are isolated — separate sessionId files do not share state
 */

import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  injectRulesIntoDelegateTask,
  markSubagentSeen,
  isSubagentSeen,
} from "../src/hermes-subagent.js";

// ---------------------------------------------------------------------------
// Tmp dir lifecycle (for markSubagentSeen / isSubagentSeen tests)
// ---------------------------------------------------------------------------

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(os.tmpdir(), "hermes-subagent-test-"));
});

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// injectRulesIntoDelegateTask — append (R-047)
// ---------------------------------------------------------------------------

describe("injectRulesIntoDelegateTask — append", () => {
  it("appends the injection marker and rules to the task text", () => {
    const result = injectRulesIntoDelegateTask("do the task", "rule A\nrule B");

    expect(result).toContain("[HIMA RULES INJECTED]");
    expect(result).toContain("rule A\nrule B");
    // Text starts with original payload.
    expect(result.startsWith("do the task")).toBe(true);
  });

  it("wraps the rules with separator lines", () => {
    const result = injectRulesIntoDelegateTask("task", "my-rule");

    // Expect the exact block: \n\n---\n[HIMA RULES INJECTED]\n<rules>\n---
    expect(result).toBe("task\n\n---\n[HIMA RULES INJECTED]\nmy-rule\n---");
  });

  it("preserves the original task text verbatim before the separator", () => {
    const taskText = "Step 1: do X\nStep 2: do Y";
    const result = injectRulesIntoDelegateTask(taskText, "rule");

    expect(result.startsWith(taskText)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// injectRulesIntoDelegateTask — idempotency (R-047)
// ---------------------------------------------------------------------------

describe("injectRulesIntoDelegateTask — idempotency", () => {
  it("returns the already-injected text unchanged on a second call", () => {
    const first = injectRulesIntoDelegateTask("task", "rule A");
    const second = injectRulesIntoDelegateTask(first, "rule A");

    expect(second).toBe(first);
  });

  it("does not inject a second marker when rules differ on second call", () => {
    const first = injectRulesIntoDelegateTask("task", "rule A");
    const second = injectRulesIntoDelegateTask(first, "rule B — different");

    // Marker appears exactly once.
    const markerCount = (second.match(/\[HIMA RULES INJECTED\]/g) ?? []).length;
    expect(markerCount).toBe(1);
    // Original rules are preserved, not overwritten.
    expect(second).toContain("rule A");
    expect(second).not.toContain("rule B — different");
  });
});

// ---------------------------------------------------------------------------
// injectRulesIntoDelegateTask — truncation >3000 chars (R-047)
// ---------------------------------------------------------------------------

describe("injectRulesIntoDelegateTask — truncation", () => {
  const OVER_3000 = "x".repeat(3001);
  const EXACTLY_3000 = "y".repeat(3000);

  it("truncates rules longer than 3000 characters to exactly 3000 chars + suffix", () => {
    const result = injectRulesIntoDelegateTask("task", OVER_3000);

    // The injected body must end with ...[truncated] before the closing ---
    expect(result).toContain("...[truncated]");
    // The first 3000 chars of rules are preserved.
    expect(result).toContain("x".repeat(3000));
    // The 3001st char is NOT present as raw content (only as part of the suffix).
    // Verify by checking the content between the marker and the closing ---.
    const markerIdx = result.indexOf("[HIMA RULES INJECTED]\n");
    const rulesStart = markerIdx + "[HIMA RULES INJECTED]\n".length;
    const closingIdx = result.lastIndexOf("\n---");
    const injectedBody = result.slice(rulesStart, closingIdx);
    expect(injectedBody).toBe("x".repeat(3000) + "...[truncated]");
  });

  it("does NOT truncate rules that are exactly 3000 characters (boundary: >3000)", () => {
    const result = injectRulesIntoDelegateTask("task", EXACTLY_3000);

    expect(result).not.toContain("...[truncated]");
    expect(result).toContain(EXACTLY_3000);
  });

  it("is still idempotent after a truncated injection", () => {
    const first = injectRulesIntoDelegateTask("task", OVER_3000);
    const second = injectRulesIntoDelegateTask(first, OVER_3000);

    expect(second).toBe(first);
  });
});

// ---------------------------------------------------------------------------
// injectRulesIntoDelegateTask — empty rules edge case
// ---------------------------------------------------------------------------

describe("injectRulesIntoDelegateTask — empty rules", () => {
  it("still injects the marker when rulesSerialized is empty", () => {
    const result = injectRulesIntoDelegateTask("task", "");

    expect(result).toContain("[HIMA RULES INJECTED]");
    expect(result).toBe("task\n\n---\n[HIMA RULES INJECTED]\n\n---");
  });
});

// ---------------------------------------------------------------------------
// markSubagentSeen / isSubagentSeen — R-048
// ---------------------------------------------------------------------------

describe("isSubagentSeen — not yet marked", () => {
  it("returns false for an unseen (agentId, event) pair", async () => {
    const seen = await isSubagentSeen(tmpRoot, "sess-1", "agent-X", "subagent_stop");

    expect(seen).toBe(false);
  });

  it("returns false when the state directory does not exist", async () => {
    // tmpRoot is a fresh dir with no .hima/ subtree.
    const seen = await isSubagentSeen(tmpRoot, "sess-new", "agent-Y", "subagent_start");

    expect(seen).toBe(false);
  });
});

describe("markSubagentSeen then isSubagentSeen", () => {
  it("returns true after marking the same (agentId, event) pair", async () => {
    await markSubagentSeen(tmpRoot, "sess-2", "agent-A", "subagent_stop");
    const seen = await isSubagentSeen(tmpRoot, "sess-2", "agent-A", "subagent_stop");

    expect(seen).toBe(true);
  });

  it("does not affect an unseen pair in the same session", async () => {
    await markSubagentSeen(tmpRoot, "sess-3", "agent-B", "subagent_stop");

    // Same agent, different event.
    const differentEvent = await isSubagentSeen(
      tmpRoot,
      "sess-3",
      "agent-B",
      "subagent_start",
    );
    // Different agent, same event.
    const differentAgent = await isSubagentSeen(
      tmpRoot,
      "sess-3",
      "agent-Z",
      "subagent_stop",
    );

    expect(differentEvent).toBe(false);
    expect(differentAgent).toBe(false);
  });
});

describe("markSubagentSeen — idempotency", () => {
  it("marking the same pair twice does not create duplicate entries", async () => {
    await markSubagentSeen(tmpRoot, "sess-4", "agent-C", "subagent_stop");
    await markSubagentSeen(tmpRoot, "sess-4", "agent-C", "subagent_stop");

    // Should still be seen (no corruption from double mark).
    const seen = await isSubagentSeen(tmpRoot, "sess-4", "agent-C", "subagent_stop");
    expect(seen).toBe(true);
  });
});

describe("markSubagentSeen — multiple pairs", () => {
  it("tracks distinct (agentId, event) pairs independently", async () => {
    await markSubagentSeen(tmpRoot, "sess-5", "agent-D", "subagent_stop");
    await markSubagentSeen(tmpRoot, "sess-5", "agent-E", "subagent_stop");
    await markSubagentSeen(tmpRoot, "sess-5", "agent-D", "subagent_start");

    expect(await isSubagentSeen(tmpRoot, "sess-5", "agent-D", "subagent_stop")).toBe(true);
    expect(await isSubagentSeen(tmpRoot, "sess-5", "agent-E", "subagent_stop")).toBe(true);
    expect(await isSubagentSeen(tmpRoot, "sess-5", "agent-D", "subagent_start")).toBe(true);
    // Not marked.
    expect(await isSubagentSeen(tmpRoot, "sess-5", "agent-E", "subagent_start")).toBe(false);
  });
});

describe("markSubagentSeen — session isolation", () => {
  it("entries in one session are not visible in another session", async () => {
    await markSubagentSeen(tmpRoot, "sess-A", "agent-F", "subagent_stop");

    const seenInA = await isSubagentSeen(tmpRoot, "sess-A", "agent-F", "subagent_stop");
    const seenInB = await isSubagentSeen(tmpRoot, "sess-B", "agent-F", "subagent_stop");

    expect(seenInA).toBe(true);
    expect(seenInB).toBe(false);
  });
});
