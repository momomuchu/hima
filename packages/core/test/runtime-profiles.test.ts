import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  getRuntimeProfile,
  getRuntimeProfileSurface,
  RUNTIME_PROOF_TYPES,
  RUNTIME_TARGETS,
  type RuntimeTarget,
  toHookCommand,
} from "../src/index.js";
import { GATE_TYPES, type GateType } from "../src/types/canonical.js";

function markdownSection(markdown: string, heading: string): string {
  const start = markdown.indexOf(heading);
  expect(start).toBeGreaterThanOrEqual(0);

  const remainder = markdown.slice(start);
  const nextHeadingMatch = /\n##\s/.exec(remainder.slice(heading.length));

  return nextHeadingMatch === null
    ? remainder
    : remainder.slice(0, heading.length + nextHeadingMatch.index);
}

function runtimeProfileRows(markdownTableSection: string) {
  return [
    ...markdownTableSection.matchAll(
      /^\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*(`[^`]+`|null)\s*\|\s*(true|false)\s*\|\s*(true|false)\s*\|\s*`([^`]+)`\s*\|/gm,
    ),
  ].map((match) => ({
    target: match[1],
    gateType: match[2],
    nativeEvent: match[3] === "null" ? null : match[3].slice(1, -1),
    canBlock: match[4] === "true",
    supported: match[5] === "true",
    command: match[6],
  }));
}

function backtickedFirstColumnValues(markdownTableSection: string): string[] {
  return [...markdownTableSection.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map((match) => match[1]);
}

describe("runtime profiles", () => {
  it("covers every canonical gate for every runtime target", () => {
    for (const target of RUNTIME_TARGETS) {
      const profile = getRuntimeProfile(target);

      expect(Object.keys(profile.hooks).sort()).toEqual([...GATE_TYPES].sort());
      for (const gateType of GATE_TYPES) {
        expect(profile.hooks[gateType]).toMatchObject({
          gateType,
          command: toHookCommand(gateType, target),
        });
      }
    }
  });

  it("keeps Codex subagent_stop missing", () => {
    const codex = getRuntimeProfile("codex");

    expect(codex.hooks.subagent_stop.supported).toBe(false);
    expect(codex.hooks.subagent_stop.nativeEvent).toBeNull();
    expect(codex.hooks.subagent_stop.canBlock).toBe(false);
  });

  it("uses hyphenated hook commands for all canonical gates", () => {
    const expectedCommands: Record<GateType, `harness hook ${string}`> = {
      session_start: "harness hook session-start",
      user_prompt: "harness hook user-prompt-submit",
      pre_tool: "harness hook pre-tool-use",
      post_tool: "harness hook post-tool-use",
      pre_compact: "harness hook pre-compact",
      post_compact: "harness hook post-compact",
      stop: "harness hook stop",
      subagent_start: "harness hook subagent-start",
      subagent_stop: "harness hook subagent-stop",
    };

    for (const target of RUNTIME_TARGETS as readonly RuntimeTarget[]) {
      const profile = getRuntimeProfile(target);

      for (const gateType of GATE_TYPES) {
        expect(profile.hooks[gateType].command).toBe(toHookCommand(gateType, target));
        if (target === "claude") {
          expect(profile.hooks[gateType].command).toBe(
            `${expectedCommands[gateType]} --format claude`,
          );
        } else if (target === "codex") {
          expect(profile.hooks[gateType].command).toBe(
            `${expectedCommands[gateType]} --format codex`,
          );
        } else {
          expect(profile.hooks[gateType].command).toBe(expectedCommands[gateType]);
        }
      }
    }
  });

  it("keeps the runtime bindings spec synchronized with executable runtime profiles", async () => {
    const spec = await readFile(
      new URL("../../../docs/conception/04-runtime-bindings-spec.md", import.meta.url),
      "utf8",
    );
    const documentedRows = runtimeProfileRows(
      markdownSection(spec, "### 2.8 Executable Runtime Profile Contract"),
    );

    expect(documentedRows).toEqual(getRuntimeProfileSurface());
  });

  it("keeps runtime proof vocabulary synchronized with the probe freshness spec", async () => {
    const spec = await readFile(
      new URL(
        "../../../docs/propositions/pipeline-fractal-v4-specs/0002-runtime-probe-and-freshness.spec.md",
        import.meta.url,
      ),
      "utf8",
    );

    expect(backtickedFirstColumnValues(markdownSection(spec, "Trusted evidence types:"))).toEqual([
      ...RUNTIME_PROOF_TYPES,
    ]);
  });
});
