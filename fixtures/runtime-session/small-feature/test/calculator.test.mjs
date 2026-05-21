import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { add, clamp, subtract } from "../src/calculator.mjs";

describe("calculator", () => {
  it("adds numbers", () => {
    assert.equal(add(2, 3), 5);
  });

  it("subtracts numbers", () => {
    assert.equal(subtract(7, 4), 3);
  });
});

describe("clamp", () => {
  it("returns max when value is above max", () => {
    assert.equal(clamp(10, 0, 5), 5);
  });

  it("returns min when value is below min", () => {
    assert.equal(clamp(-1, 0, 5), 0);
  });

  it("returns value when in range", () => {
    assert.equal(clamp(3, 0, 5), 3);
  });

  it("throws RangeError when min > max", () => {
    assert.throws(() => clamp(3, 5, 0), RangeError);
  });
});
