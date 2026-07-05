/**
 * Tests for behavior-core/delegation-lane.ts — the lane-marker mechanism that
 * signals "this session is operating inside a delegated lane" for SPEC-018.
 *
 * Marker file: <root>/.hima/state/lane-<sessionId>.json
 *   present  → delegated lane → Delegation-First allows the write
 *   absent   → main thread    → Delegation-First blocks at H+
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  laneMarkerPath,
  markLane,
  isLaneActive,
  clearLane,
  markStageDelegation,
  isStageDelegationActive,
  clearStageDelegation,
} from "../src/behavior-core/delegation-lane.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "lane-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("delegation-lane marker", () => {
  it("markLane then isLaneActive → true", () => {
    markLane(root, "sess-A");
    expect(isLaneActive(root, "sess-A")).toBe(true);
  });

  it("isLaneActive is false when never marked", () => {
    expect(isLaneActive(root, "sess-unknown")).toBe(false);
  });

  it("clearLane removes the marker → isLaneActive false", () => {
    markLane(root, "sess-B");
    expect(isLaneActive(root, "sess-B")).toBe(true);
    clearLane(root, "sess-B");
    expect(isLaneActive(root, "sess-B")).toBe(false);
  });

  it("markers are per-session (A marked, B not)", () => {
    markLane(root, "sess-A");
    expect(isLaneActive(root, "sess-A")).toBe(true);
    expect(isLaneActive(root, "sess-B")).toBe(false);
  });

  it("isLaneActive is false for an empty sessionId", () => {
    expect(isLaneActive(root, "")).toBe(false);
  });

  it("laneMarkerPath lives under .hima/state and encodes the session", () => {
    const p = laneMarkerPath(root, "sess-A");
    expect(p.startsWith(path.join(root, ".hima", "state"))).toBe(true);
    expect(p).toMatch(/lane-.*sess.A/);
  });

  it("markLane writes an actual file on disk", () => {
    markLane(root, "sess-C", { roles: ["implementer", "verifier"] });
    expect(existsSync(laneMarkerPath(root, "sess-C"))).toBe(true);
  });

  it("clearLane on a non-existent marker does not throw", () => {
    expect(() => clearLane(root, "never")).not.toThrow();
  });

  it("stage-delegation marker: mark → active, clear → inactive, per ward+stage", () => {
    expect(isStageDelegationActive(root, "ward-1", "impl")).toBe(false);
    markStageDelegation(root, "ward-1", "impl");
    expect(isStageDelegationActive(root, "ward-1", "impl")).toBe(true);
    // different stage / ward is independent
    expect(isStageDelegationActive(root, "ward-1", "design")).toBe(false);
    expect(isStageDelegationActive(root, "ward-2", "impl")).toBe(false);
    clearStageDelegation(root, "ward-1", "impl");
    expect(isStageDelegationActive(root, "ward-1", "impl")).toBe(false);
  });

  it("stage-delegation ignores empty ward/stage and never throws", () => {
    expect(isStageDelegationActive(root, "", "impl")).toBe(false);
    expect(isStageDelegationActive(root, "ward-1", "")).toBe(false);
    expect(() => clearStageDelegation(root, "nope", "impl")).not.toThrow();
  });

  it("markLane sanitizes a session id containing path separators", () => {
    markLane(root, "a/b/../c");
    // must stay inside .hima/state (no path traversal) and be detectable
    const p = laneMarkerPath(root, "a/b/../c");
    expect(p.startsWith(path.join(root, ".hima", "state"))).toBe(true);
    expect(isLaneActive(root, "a/b/../c")).toBe(true);
  });
});
