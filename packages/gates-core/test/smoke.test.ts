import { describe, it } from "vitest";

describe("gates-core smoke", () => {
  it("package loads", async () => {
    await import("../src/index.js");
  });
});
