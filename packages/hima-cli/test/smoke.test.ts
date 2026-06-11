import { describe, it } from "vitest";

describe("hima-cli smoke", () => {
  it("package loads", async () => {
    await import("../src/index.js");
  });
});
