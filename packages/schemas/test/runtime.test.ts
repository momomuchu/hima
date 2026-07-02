import { Either } from "effect";
import { describe, expect, it } from "vitest";
import {
  decodeRuntimeTarget,
  decodeRuntimeTargetEither,
} from "../src/index.js";

describe("RuntimeTarget schema", () => {
  it("decodes 'claude'", () => {
    expect(decodeRuntimeTarget("claude")).toBe("claude");
  });

  it("decodes 'codex'", () => {
    expect(decodeRuntimeTarget("codex")).toBe("codex");
  });

  it("decodes 'hermes'", () => {
    expect(decodeRuntimeTarget("hermes")).toBe("hermes");
  });

  it("decodes 'opencode'", () => {
    expect(decodeRuntimeTarget("opencode")).toBe("opencode");
  });

  it("rejects an unknown runtime literal", () => {
    const result = decodeRuntimeTargetEither("windsurf");
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects a non-string value", () => {
    const result = decodeRuntimeTargetEither(42);
    expect(Either.isLeft(result)).toBe(true);
  });
});
