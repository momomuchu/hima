import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  writeDeferredVerdict,
  readAndConsumeDeferredVerdict,
  verdictFilePath,
  type DeferredVerdict,
} from "../src/deferred-verdict.js";

// ---------------------------------------------------------------------------
// Fixture factory
// ---------------------------------------------------------------------------

function makeVerdict(overrides: Partial<DeferredVerdict> = {}): DeferredVerdict {
  return {
    decision: "block",
    reason: "test-reason",
    source: "test-source",
    resolveOn: ["stop"],
    ts: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tmp dir lifecycle
// ---------------------------------------------------------------------------

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "hima-deferred-verdict-test-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// verdictFilePath
// ---------------------------------------------------------------------------

describe("verdictFilePath", () => {
  it("returns the canonical per-session JSON path", () => {
    const result = verdictFilePath("/project", "sess-42");
    expect(result).toBe(
      path.join("/project", ".hima", "state", "pending-stop-verdict-sess-42.json"),
    );
  });

  it("distinct sessionIds map to distinct files", () => {
    const a = verdictFilePath("/project", "sess-a");
    const b = verdictFilePath("/project", "sess-b");
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Round-trip: write → consume
// ---------------------------------------------------------------------------

describe("writeDeferredVerdict + readAndConsumeDeferredVerdict round-trip", () => {
  it("consume returns the written verdict with all fields intact", async () => {
    const verdict = makeVerdict({ reason: "block-on-stop", source: "gate-42", resolveOn: ["stop", "subagent_stop"] });
    await writeDeferredVerdict(root, "sess-rt", verdict);

    const result = await readAndConsumeDeferredVerdict(root, "sess-rt");

    expect(result).not.toBeNull();
    expect(result!.decision).toBe("block");
    expect(result!.reason).toBe("block-on-stop");
    expect(result!.source).toBe("gate-42");
    expect(result!.resolveOn).toEqual(["stop", "subagent_stop"]);
    expect(result!.ts).toBe(verdict.ts);
  });

  it("file is deleted after consume (single-use)", async () => {
    await writeDeferredVerdict(root, "sess-del", makeVerdict());

    await readAndConsumeDeferredVerdict(root, "sess-del");

    const filePath = verdictFilePath(root, "sess-del");
    await expect(readFile(filePath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("second consume returns null (file gone after first)", async () => {
    await writeDeferredVerdict(root, "sess-once", makeVerdict());

    const first = await readAndConsumeDeferredVerdict(root, "sess-once");
    expect(first).not.toBeNull();

    const second = await readAndConsumeDeferredVerdict(root, "sess-once");
    expect(second).toBeNull();
  });

  it("distinct sessionIds are isolated from each other", async () => {
    await writeDeferredVerdict(root, "sess-a", makeVerdict({ reason: "reason-a" }));
    await writeDeferredVerdict(root, "sess-b", makeVerdict({ reason: "reason-b" }));

    const rA = await readAndConsumeDeferredVerdict(root, "sess-a");
    const rB = await readAndConsumeDeferredVerdict(root, "sess-b");

    expect(rA!.reason).toBe("reason-a");
    expect(rB!.reason).toBe("reason-b");
  });
});

// ---------------------------------------------------------------------------
// Missing file → null
// ---------------------------------------------------------------------------

describe("readAndConsumeDeferredVerdict — missing file", () => {
  it("returns null when no verdict file exists for the session", async () => {
    const result = await readAndConsumeDeferredVerdict(root, "no-such-session");
    expect(result).toBeNull();
  });

  it("returns null when the .hima directory does not exist", async () => {
    // root is a fresh empty tmpdir with no .hima subdirectory.
    const result = await readAndConsumeDeferredVerdict(root, "ghost-session");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Corrupt file → fail-closed block
// ---------------------------------------------------------------------------

describe("readAndConsumeDeferredVerdict — corrupt file", () => {
  /** Write raw content directly to the verdict path (bypassing safeAtomicWriteFile). */
  async function writeCorruptFile(sessionId: string, content: string): Promise<void> {
    const stateDir = path.join(root, ".hima", "state");
    await mkdir(stateDir, { recursive: true });
    await writeFile(verdictFilePath(root, sessionId), content, "utf8");
  }

  it("returns a synthetic fail-closed block for non-JSON content", async () => {
    await writeCorruptFile("sess-c1", "this is not json at all !!!");

    const result = await readAndConsumeDeferredVerdict(root, "sess-c1");

    expect(result).not.toBeNull();
    expect(result!.decision).toBe("block");
    expect(result!.reason).toBe("corrupt deferred verdict");
    expect(result!.source).toBe("fail-closed");
    expect(result!.resolveOn).toEqual([]);
  });

  it("returns a synthetic fail-closed block for valid JSON with wrong shape", async () => {
    await writeCorruptFile("sess-c2", JSON.stringify({ completely: "wrong", shape: true }));

    const result = await readAndConsumeDeferredVerdict(root, "sess-c2");

    expect(result!.decision).toBe("block");
    expect(result!.reason).toBe("corrupt deferred verdict");
    expect(result!.source).toBe("fail-closed");
  });

  it("returns a synthetic fail-closed block for an empty file", async () => {
    await writeCorruptFile("sess-c3", "");

    const result = await readAndConsumeDeferredVerdict(root, "sess-c3");

    expect(result!.decision).toBe("block");
    expect(result!.reason).toBe("corrupt deferred verdict");
  });

  it("returns a synthetic fail-closed block for truncated JSON", async () => {
    await writeCorruptFile("sess-c4", '{"decision":"block","reason":"half-written');

    const result = await readAndConsumeDeferredVerdict(root, "sess-c4");

    expect(result!.decision).toBe("block");
    expect(result!.reason).toBe("corrupt deferred verdict");
  });

  it("returns a synthetic fail-closed block when decision field is missing", async () => {
    await writeCorruptFile(
      "sess-c5",
      JSON.stringify({ reason: "r", source: "s", resolveOn: [], ts: new Date().toISOString() }),
    );

    const result = await readAndConsumeDeferredVerdict(root, "sess-c5");

    expect(result!.decision).toBe("block");
    expect(result!.reason).toBe("corrupt deferred verdict");
  });

  it("returns a synthetic fail-closed block when decision is 'continue' (not block)", async () => {
    await writeCorruptFile(
      "sess-c6",
      JSON.stringify({
        decision: "continue",
        reason: "r",
        source: "s",
        resolveOn: [],
        ts: new Date().toISOString(),
      }),
    );

    const result = await readAndConsumeDeferredVerdict(root, "sess-c6");

    expect(result!.decision).toBe("block");
    expect(result!.reason).toBe("corrupt deferred verdict");
  });
});
