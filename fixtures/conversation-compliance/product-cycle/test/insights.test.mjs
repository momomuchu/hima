import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { insightScore } from "../src/insights.mjs";

describe("insightScore", () => {
  it("combines views, likes, and comments into a stable normalized score", () => {
    assert.equal(insightScore(1000, 100, 20), 1600);
    assert.equal(insightScore(5000, 50, 5), 1125);
  });

  it("rejects negative metrics", () => {
    assert.throws(() => insightScore(-1, 0, 0), RangeError);
    assert.throws(() => insightScore(0, -1, 0), RangeError);
    assert.throws(() => insightScore(0, 0, -1), RangeError);
  });

  it("requires finite numeric metrics", () => {
    assert.throws(() => insightScore(Number.NaN, 0, 0), TypeError);
    assert.throws(() => insightScore(0, Number.POSITIVE_INFINITY, 0), TypeError);
    assert.throws(() => insightScore(0, 0, "1"), TypeError);
  });
});
