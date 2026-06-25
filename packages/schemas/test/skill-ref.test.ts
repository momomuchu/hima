import { Either } from "effect";
import { describe, expect, it } from "vitest";
import { decodeSkillRef, decodeSkillRefEither } from "../src/index.js";

describe("SkillRef schema", () => {
  it("decodes a valid corpus skill ref", () => {
    const value = {
      source: "corpus",
      id: "corpus-spec-driven-development",
    };
    expect(decodeSkillRef(value)).toEqual(value);
  });

  it("decodes a valid base skill ref", () => {
    const value = { source: "base", id: "ralph" };
    expect(decodeSkillRef(value)).toEqual(value);
  });

  it("decodes a valid user skill ref", () => {
    const value = { source: "user", id: "my-custom-skill" };
    expect(decodeSkillRef(value)).toEqual(value);
  });

  it("decodes a valid project skill ref", () => {
    const value = { source: "project", id: "hima-local-skill" };
    expect(decodeSkillRef(value)).toEqual(value);
  });

  it("rejects a bad source value", () => {
    const result = decodeSkillRefEither({ source: "external", id: "some-skill" });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects missing source field", () => {
    const result = decodeSkillRefEither({ id: "corpus-spec-driven-development" });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects missing id field", () => {
    const result = decodeSkillRefEither({ source: "corpus" });
    expect(Either.isLeft(result)).toBe(true);
  });
});
