import { describe, expect, it } from "vitest";
import {
  DEFAULT_WRITE_ZONES,
  getAllowedWriteZones,
  isAllowedWriteTarget,
  SUB_PHASES,
  WRITE_ZONES_BY_SUB_PHASE,
} from "../src/index.js";

describe("write-zone policy", () => {
  it("defines write zones for every canonical subphase", () => {
    expect(Object.keys(WRITE_ZONES_BY_SUB_PHASE)).toEqual([...SUB_PHASES]);
  });

  it("falls back to log-only writes without an active subphase", () => {
    expect(getAllowedWriteZones(null)).toEqual(DEFAULT_WRITE_ZONES);
    expect(isAllowedWriteTarget(".planning/09-logs/run.log", getAllowedWriteZones(null))).toBe(
      true,
    );
    expect(isAllowedWriteTarget("src/index.ts", getAllowedWriteZones(null))).toBe(false);
  });

  it("matches declared static zones and rejects sibling zones", () => {
    expect(
      isAllowedWriteTarget(".planning/01-discovery/notes.md", WRITE_ZONES_BY_SUB_PHASE.Observer),
    ).toBe(true);
    expect(
      isAllowedWriteTarget(".planning/02-backlog/item.md", WRITE_ZONES_BY_SUB_PHASE.Observer),
    ).toBe(false);
  });

  it("matches one-segment monorepo wildcards with path normalization", () => {
    expect(
      isAllowedWriteTarget("PACKAGES\\Core\\SRC\\index.ts", WRITE_ZONES_BY_SUB_PHASE.Execute),
    ).toBe(true);
    expect(
      isAllowedWriteTarget("packages/core/test/index.test.ts", WRITE_ZONES_BY_SUB_PHASE.Verify),
    ).toBe(true);
    expect(
      isAllowedWriteTarget("packages/core/nested/src/index.ts", WRITE_ZONES_BY_SUB_PHASE.Execute),
    ).toBe(false);
  });

  it("rejects dot-segment escapes from otherwise allowed prefixes", () => {
    expect(
      isAllowedWriteTarget(
        "packages/core/src/../../../../docs/escaped.md",
        WRITE_ZONES_BY_SUB_PHASE.Execute,
      ),
    ).toBe(false);
    expect(isAllowedWriteTarget("src/../docs/escaped.md", WRITE_ZONES_BY_SUB_PHASE.Execute)).toBe(
      false,
    );
  });
});
