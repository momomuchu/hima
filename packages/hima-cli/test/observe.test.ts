/**
 * observe.test.ts — unit tests for the trace renderer in @hima/cli.
 *
 * All functions under test are pure (no I/O), so tests run with no filesystem
 * setup. Each describe block covers one exported function.
 *
 * Uses the v3 TraceEvent schema (ts, sessionId, hookEvent, forceActionKind,
 * skillsForced, skillsLoaded) instead of the legacy trace-event.ts shape.
 *
 * Coverage:
 *   filterTrace  — gate / decision / onlyBlocks predicates and AND combination
 *   renderTimeline — format correctness, block line with skill+exit2, empty
 *   renderSummary  — count accuracy for allow/warn/block/skill-forces/errors
 *   renderObserve  — summary over all + timeline over filtered
 */

import { describe, expect, it } from "vitest";
import {
  filterTrace,
  renderTimeline,
  renderSummary,
  renderObserve,
  type TraceFilter,
} from "../src/observe.js";
import type { TraceEvent } from "@hima/schemas";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * makeEvent — convenience factory for TraceEvent test fixtures.
 * Uses v3 schema defaults: ts, sessionId, hookEvent, skillsForced, skillsLoaded.
 * All optional fields except gateType and decision default to absent.
 */
function makeEvent(overrides: Partial<TraceEvent> & Pick<TraceEvent, "gateType" | "decision">): TraceEvent {
  return {
    ts: "2026-06-27T10:00:00.000Z",
    sessionId: "test-session",
    hookEvent: "PreToolUse",
    skillsForced: [],
    skillsLoaded: [],
    exitCode: 0,
    ...overrides,
  };
}

/** A block event caused by a skill-force gate on a write tool. */
const blockSkillForce: TraceEvent = makeEvent({
  ts: "2026-06-27T10:23:45.000Z",
  gateType: "pre_tool",
  toolName: "Write",
  decision: "block",
  forceActionKind: "skill-force",
  skillsForced: ["corpus-technical-analysis-discovery"],
  exitCode: 2,
  wardStage: "discovery",
});

/** An allow event on user_prompt with sigil detected. */
const allowSigil: TraceEvent = makeEvent({
  ts: "2026-06-27T10:20:00.000Z",
  gateType: "user_prompt",
  decision: "allow",
  sigil: "ulw",
  wardStage: "discovery",
  exitCode: 0,
});

/** A plain allow on a non-write tool (no ward, no forceActionKind). */
const allowRead: TraceEvent = makeEvent({
  ts: "2026-06-27T10:25:00.000Z",
  gateType: "pre_tool",
  toolName: "Read",
  decision: "allow",
  exitCode: 0,
});

/** A warn event (skill injected but not blocking). */
const warnInject: TraceEvent = makeEvent({
  ts: "2026-06-27T10:26:00.000Z",
  gateType: "pre_tool",
  toolName: "Edit",
  decision: "warn",
  forceActionKind: "observe-only",
  exitCode: 0,
  wardStage: "spec",
});

/** An allow with a second distinct skill (to test distinctSkills aggregation). */
const allowSkill2: TraceEvent = makeEvent({
  ts: "2026-06-27T10:30:00.000Z",
  gateType: "pre_tool",
  toolName: "Write",
  decision: "allow",
  forceActionKind: "skill-force",
  skillsForced: ["corpus-spec-driven-development"],
  exitCode: 0,
  wardStage: "spec",
});

/** An error event — exitCode 2 but decision is "allow" (logic anomaly). */
const anomalyEvent: TraceEvent = makeEvent({
  ts: "2026-06-27T10:40:00.000Z",
  gateType: "post_tool",
  decision: "allow",
  exitCode: 2,
});

// ---------------------------------------------------------------------------
// §1 — filterTrace
// ---------------------------------------------------------------------------

describe("filterTrace", () => {
  const allEvents: TraceEvent[] = [
    allowSigil,
    blockSkillForce,
    allowRead,
    warnInject,
    allowSkill2,
  ];

  it("empty filter returns all events", () => {
    expect(filterTrace(allEvents, {})).toHaveLength(allEvents.length);
  });

  it("filter by gate: pre_tool returns only pre_tool events", () => {
    const result = filterTrace(allEvents, { gate: "pre_tool" });
    expect(result).toHaveLength(4); // blockSkillForce, allowRead, warnInject, allowSkill2
    expect(result.every((e) => e.gateType === "pre_tool")).toBe(true);
  });

  it("filter by gate: user_prompt returns only the sigil event", () => {
    const result = filterTrace(allEvents, { gate: "user_prompt" });
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(allowSigil);
  });

  it("filter by gate: unknown gate type returns empty array", () => {
    expect(filterTrace(allEvents, { gate: "session_start" })).toHaveLength(0);
  });

  it("filter by decision: block", () => {
    const result = filterTrace(allEvents, { decision: "block" });
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(blockSkillForce);
  });

  it("filter by decision: warn", () => {
    const result = filterTrace(allEvents, { decision: "warn" });
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(warnInject);
  });

  it("filter by decision: allow returns three allow events", () => {
    const result = filterTrace(allEvents, { decision: "allow" });
    expect(result).toHaveLength(3);
  });

  it("onlyBlocks: true returns only block events", () => {
    const result = filterTrace(allEvents, { onlyBlocks: true });
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(blockSkillForce);
  });

  it("onlyBlocks: false does NOT filter anything (falsy shortcut)", () => {
    const result = filterTrace(allEvents, { onlyBlocks: false });
    expect(result).toHaveLength(allEvents.length);
  });

  it("combines gate + decision (AND): pre_tool + allow = 2 events", () => {
    // allowRead + allowSkill2 are pre_tool + allow; blockSkillForce is block, warnInject is warn
    const result = filterTrace(allEvents, { gate: "pre_tool", decision: "allow" });
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.gateType === "pre_tool" && e.decision === "allow")).toBe(true);
  });

  it("combines gate + onlyBlocks: pre_tool + onlyBlocks = 1 event", () => {
    const result = filterTrace(allEvents, { gate: "pre_tool", onlyBlocks: true });
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(blockSkillForce);
  });

  it("filter on empty event array returns empty array", () => {
    expect(filterTrace([], { gate: "pre_tool" })).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// §2 — renderTimeline
// ---------------------------------------------------------------------------

describe("renderTimeline", () => {
  it("empty events → 'no trace events'", () => {
    expect(renderTimeline([])).toBe("no trace events");
  });

  it("block event contains gateType, toolName, decision, skill, exit2", () => {
    const line = renderTimeline([blockSkillForce]);
    expect(line).toContain("pre_tool");
    expect(line).toContain("Write");
    expect(line).toContain("-> block");
    expect(line).toContain("skill-force");
    expect(line).toContain("corpus-technical-analysis-discovery");
    expect(line).toContain("exit2");
  });

  it("block event timestamp formats as HH:MM:SS", () => {
    const line = renderTimeline([blockSkillForce]);
    // 10:23:45 from "2026-06-27T10:23:45.000Z"
    expect(line).toMatch(/^10:23:45/);
  });

  it("block event includes wardStage in context annotation", () => {
    const line = renderTimeline([blockSkillForce]);
    expect(line).toContain("ward:discovery");
  });

  it("sigil event includes sigil and wardStage annotations", () => {
    const line = renderTimeline([allowSigil]);
    expect(line).toContain("sigil:ulw");
    expect(line).toContain("ward:discovery");
  });

  it("allow event with no forceActionKind has no [force:...] segment", () => {
    const line = renderTimeline([allowRead]);
    expect(line).not.toContain("[force:");
  });

  it("warn event with observe-only forceActionKind includes force annotation", () => {
    const line = renderTimeline([warnInject]);
    expect(line).toContain("[force:observe-only]");
  });

  it("noop forceActionKind does NOT emit a [force:...] segment", () => {
    const noopEvent: TraceEvent = makeEvent({
      gateType: "post_tool",
      decision: "noop",
      forceActionKind: "noop",
      exitCode: 0,
    });
    const line = renderTimeline([noopEvent]);
    expect(line).not.toContain("[force:");
  });

  it("multiple events produce multiple lines", () => {
    const lines = renderTimeline([allowSigil, blockSkillForce, allowRead]).split("\n");
    expect(lines).toHaveLength(3);
  });

  it("events appear in input order (no re-sorting)", () => {
    const lines = renderTimeline([blockSkillForce, allowSigil]).split("\n");
    // blockSkillForce is first → its line starts with 10:23:45
    expect(lines[0]).toMatch(/10:23:45/);
    // allowSigil is second → its line starts with 10:20:00
    expect(lines[1]).toMatch(/10:20:00/);
  });

  it("forceActionKind skill-force: uses first skillsForced entry as the skill id", () => {
    const evt: TraceEvent = makeEvent({
      gateType: "pre_tool",
      toolName: "Write",
      decision: "block",
      forceActionKind: "skill-force",
      skillsForced: ["corpus-architecture-system-design"],
      exitCode: 2,
    });
    const line = renderTimeline([evt]);
    expect(line).toContain("skill:corpus-architecture-system-design");
  });

  it("forceActionKind present but skillsForced empty → [force:kind] without skill segment", () => {
    const evt: TraceEvent = makeEvent({
      gateType: "pre_tool",
      toolName: "Write",
      decision: "block",
      forceActionKind: "hard-block",
      skillsForced: [],
      exitCode: 2,
    });
    const line = renderTimeline([evt]);
    expect(line).toContain("[force:hard-block]");
    expect(line).not.toContain("skill:");
  });
});

// ---------------------------------------------------------------------------
// §3 — renderSummary
// ---------------------------------------------------------------------------

describe("renderSummary", () => {
  it("empty events → 'no trace events'", () => {
    expect(renderSummary([])).toBe("no trace events");
  });

  it("counts total events correctly", () => {
    const summary = renderSummary([allowSigil, blockSkillForce, allowRead]);
    expect(summary).toContain("total:3");
  });

  it("counts block events correctly", () => {
    const summary = renderSummary([allowSigil, blockSkillForce, allowRead]);
    expect(summary).toContain("block:1");
  });

  it("counts allow events correctly", () => {
    const summary = renderSummary([allowSigil, blockSkillForce, allowRead]);
    expect(summary).toContain("allow:2");
  });

  it("counts warn events correctly", () => {
    const summary = renderSummary([allowSigil, warnInject, blockSkillForce]);
    expect(summary).toContain("warn:1");
  });

  it("counts skill-forces: only forceActionKind==='skill-force' events", () => {
    // blockSkillForce has skill-force; allowSigil and allowRead do not
    const summary = renderSummary([allowSigil, blockSkillForce, allowRead]);
    expect(summary).toContain("skill-forces:1");
  });

  it("counts skill-forces from multiple events", () => {
    // blockSkillForce + allowSkill2 both have skill-force
    const summary = renderSummary([allowSigil, blockSkillForce, allowSkill2]);
    expect(summary).toContain("skill-forces:2");
  });

  it("reports distinct-skills from skillsForced arrays", () => {
    // blockSkillForce has corpus-technical-analysis-discovery
    // allowSkill2 has corpus-spec-driven-development
    const summary = renderSummary([blockSkillForce, allowSkill2]);
    expect(summary).toContain("corpus-technical-analysis-discovery");
    expect(summary).toContain("corpus-spec-driven-development");
  });

  it("deduplicates repeated skill IDs across events", () => {
    const dup: TraceEvent = makeEvent({
      gateType: "pre_tool",
      toolName: "Write",
      decision: "block",
      forceActionKind: "skill-force",
      skillsForced: ["corpus-technical-analysis-discovery"],
      exitCode: 2,
    });
    const summary = renderSummary([blockSkillForce, dup]);
    // skill-forces = 2 (two events), but distinct-skills = 1
    expect(summary).toContain("skill-forces:2");
    // The skill should appear exactly once in the distinct-skills list
    const skillList = summary.match(/distinct-skills: (.+)/)?.[1] ?? "";
    const occurrences = (skillList.match(/corpus-technical-analysis-discovery/g) ?? []).length;
    expect(occurrences).toBe(1);
  });

  it("counts errors: exitCode!==0 and decision!=='block'", () => {
    const summary = renderSummary([anomalyEvent, blockSkillForce, allowRead]);
    // anomalyEvent: exitCode=2, decision="allow" → error
    // blockSkillForce: exitCode=2, decision="block" → NOT an error
    expect(summary).toContain("errors:1");
  });

  it("block events with exitCode=2 are NOT counted as errors", () => {
    const summary = renderSummary([blockSkillForce]);
    expect(summary).toContain("errors:0");
    expect(summary).toContain("block:1");
  });

  it("no skillsForced events → distinct-skills: none", () => {
    const summary = renderSummary([allowSigil, allowRead]);
    expect(summary).toContain("distinct-skills: none");
  });
});

// ---------------------------------------------------------------------------
// §4 — renderObserve
// ---------------------------------------------------------------------------

describe("renderObserve", () => {
  const allEvents: TraceEvent[] = [allowSigil, blockSkillForce, allowRead, warnInject];

  it("empty events → both halves say 'no trace events'", () => {
    const out = renderObserve([], {});
    expect(out).toContain("no trace events");
  });

  it("summary is over ALL events even when filter reduces timeline", () => {
    // filter to only blocks; summary should still reflect total=4
    const out = renderObserve(allEvents, { onlyBlocks: true });
    expect(out).toContain("total:4");
    // timeline should show only the block line
    const lines = out.split("\n").filter((l) => l.includes("-> "));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("-> block");
  });

  it("output structure is summary + blank line + timeline", () => {
    const out = renderObserve([blockSkillForce], {});
    const parts = out.split("\n\n");
    // There should be a summary block and a timeline block
    expect(parts.length).toBeGreaterThanOrEqual(2);
    // First block contains the summary totals
    expect(parts[0]).toContain("total:");
    // Second block contains the timeline line
    expect(parts[1]).toContain("-> block");
  });

  it("filter by gate reduces timeline but not summary", () => {
    const out = renderObserve(allEvents, { gate: "user_prompt" });
    // Summary covers all 4 events
    expect(out).toContain("total:4");
    // Timeline shows only the user_prompt event
    const timelineLines = out.split("\n\n")[1]?.split("\n") ?? [];
    expect(timelineLines).toHaveLength(1);
    expect(timelineLines[0]).toContain("user_prompt");
  });

  it("filter matching no events → timeline says 'no trace events'", () => {
    const out = renderObserve(allEvents, { gate: "session_start" });
    // Summary still shows real total
    expect(out).toContain("total:4");
    // Timeline section says no trace events
    expect(out).toContain("no trace events");
  });
});
