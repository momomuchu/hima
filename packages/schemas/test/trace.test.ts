import { Either } from "effect";
import { describe, expect, it } from "vitest";
import { decodeTraceEvent, decodeTraceEventEither } from "../src/trace.js";

describe("TraceEvent schema", () => {
  it("decodes a full block event with all fields", () => {
    const value = {
      ts: "2026-06-29T12:00:00.000Z",
      sessionId: "sess-abc123",
      runId: "run-xyz-001",
      hookEvent: "PreToolUse",
      gateType: "skill-force",
      toolName: "Write",
      sigil: "S",
      wardStage: "stage-1",
      decision: "block",
      forceActionKind: "hard-block",
      skillsForced: ["corpus-spec-driven-development"],
      skillsLoaded: [
        "corpus-spec-driven-development",
        "corpus-architecture-system-design",
      ],
      exitCode: 2,
      reason: "Spec gate not cleared before first Write on an implementation file",
      canary: "hima-v3-gate:hard-block",
    };
    expect(decodeTraceEvent(value)).toEqual(value);
  });

  it("decodes a minimal noop event (all optional fields absent)", () => {
    const value = {
      ts: "2026-06-29T12:01:00.000Z",
      sessionId: "sess-abc123",
      hookEvent: "UserPromptSubmit",
      gateType: "noop",
      decision: "noop",
      skillsForced: [],
      skillsLoaded: [],
      exitCode: 0,
    };
    // Result should equal the input exactly — no phantom keys injected.
    expect(decodeTraceEvent(value)).toEqual(value);
  });

  it("decodes a warn event (allow path with skill injection)", () => {
    const value = {
      ts: "2026-06-29T12:02:00.000Z",
      sessionId: "sess-def456",
      runId: "run-abc-002",
      hookEvent: "PreToolUse",
      gateType: "skill-force",
      toolName: "Edit",
      decision: "warn",
      forceActionKind: "constrained-inject",
      skillsForced: ["corpus-code-quality-maintainability"],
      skillsLoaded: ["corpus-code-quality-maintainability"],
      exitCode: 0,
      reason: "quality skill injected; edit allowed",
    };
    expect(decodeTraceEvent(value)).toEqual(value);
  });

  it("decodes a UserPromptSubmit sigil->ward event", () => {
    const value = {
      ts: "2026-06-29T12:03:00.000Z",
      sessionId: "sess-ghi789",
      hookEvent: "UserPromptSubmit",
      gateType: "ward",
      sigil: "S",
      wardStage: "architecture",
      decision: "allow",
      skillsForced: ["corpus-architecture-system-design"],
      skillsLoaded: ["corpus-architecture-system-design"],
      exitCode: 0,
    };
    expect(decodeTraceEvent(value)).toEqual(value);
  });

  it("rejects an unknown decision value", () => {
    const result = decodeTraceEventEither({
      ts: "2026-06-29T12:00:00.000Z",
      sessionId: "sess-abc123",
      hookEvent: "PreToolUse",
      gateType: "skill-force",
      decision: "unknown-decision",
      skillsForced: [],
      skillsLoaded: [],
      exitCode: 0,
    });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects a missing required sessionId", () => {
    const result = decodeTraceEventEither({
      ts: "2026-06-29T12:00:00.000Z",
      hookEvent: "PreToolUse",
      gateType: "noop",
      decision: "noop",
      skillsForced: [],
      skillsLoaded: [],
      exitCode: 0,
    });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects a non-number exitCode", () => {
    const result = decodeTraceEventEither({
      ts: "2026-06-29T12:00:00.000Z",
      sessionId: "sess-abc123",
      hookEvent: "PreToolUse",
      gateType: "noop",
      decision: "noop",
      skillsForced: [],
      skillsLoaded: [],
      exitCode: "2",
    });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects skillsForced containing a non-string item", () => {
    const result = decodeTraceEventEither({
      ts: "2026-06-29T12:00:00.000Z",
      sessionId: "sess-abc123",
      hookEvent: "PreToolUse",
      gateType: "noop",
      decision: "noop",
      skillsForced: [42],
      skillsLoaded: [],
      exitCode: 0,
    });
    expect(Either.isLeft(result)).toBe(true);
  });
});
