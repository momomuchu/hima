import { describe, it } from "vitest";

describe("storage-core smoke", () => {
  it("package loads", async () => {
    await import("../src/index.js");
  });
});
