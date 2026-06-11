import { describe, it } from "vitest";

describe("behavior-core smoke", () => {
  it("package loads", async () => {
    await import("../src/index.js");
  });
});
