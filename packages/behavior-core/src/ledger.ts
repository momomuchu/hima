// Simplified ledger — ported from packages/core/src/storage/hash-chained-ledger.ts
//
// Simplification per lane-triage-hima.md §3:
//   KEPT:    sha256 hash-chain (prevHash → eventHash → audit integrity)
//   REMOVED: ed25519 per-entry signature (ephemeral key per entry = zero authenticty,
//            crypto overhead with no security benefit per triage verdict)
//
// Schema is backwards-compatible with existing .hima/state/ledger/*.jsonl files
// except for the removed `signature` and `publicKey` fields.

import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

export const GENESIS_HASH = "0".repeat(64);

export interface LedgerEntry {
  id: string;
  ts: string;
  runId: string;
  sequence: number;
  prevHash: string;
  eventHash: string;
  payload: unknown;
}

export function getLedgerPath(projectRoot: string, runId: string): string {
  return path.join(projectRoot, ".hima", "state", "ledger", `${runId}.jsonl`);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function parseLedgerLine(line: string, index: number, filePath: string): LedgerEntry {
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    // Minimal validation of required fields
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.ts !== "string" ||
      typeof parsed.runId !== "string" ||
      typeof parsed.sequence !== "number" ||
      typeof parsed.prevHash !== "string" ||
      typeof parsed.eventHash !== "string"
    ) {
      throw new Error("missing required fields");
    }
    return parsed as unknown as LedgerEntry;
  } catch (error) {
    throw new Error(
      `Invalid ledger line ${index + 1} in ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function readLedger(projectRoot: string, runId: string): Promise<LedgerEntry[]> {
  const filePath = getLedgerPath(projectRoot, runId);
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    throw new Error(`Cannot read ledger file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (raw.trim() === "") return [];

  return raw
    .trimEnd()
    .split(/\r?\n/)
    .map((line, index) => parseLedgerLine(line, index, filePath));
}

export async function appendLedgerEntry(
  projectRoot: string,
  runId: string,
  payload: unknown,
): Promise<LedgerEntry> {
  const filePath = getLedgerPath(projectRoot, runId);

  let existing: LedgerEntry[] = [];
  try {
    existing = await readLedger(projectRoot, runId);
  } catch (error) {
    // ENOENT on first write is expected — start with empty chain
    if (!String(error).includes("ENOENT")) throw error;
  }

  const previous = existing.at(-1);
  const entry: LedgerEntry = {
    id: `${runId}-${existing.length + 1}`,
    ts: new Date().toISOString(),
    runId,
    sequence: existing.length,
    prevHash: previous?.eventHash ?? GENESIS_HASH,
    eventHash: sha256Hex(stableJson(payload)),
    payload,
  };

  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(entry)}\n`, "utf8");
  return entry;
}

export function verifyLedgerChain(entries: LedgerEntry[]): boolean {
  let previousHash = GENESIS_HASH;
  for (const entry of entries) {
    if (entry.prevHash !== previousHash) return false;
    if (entry.eventHash !== sha256Hex(stableJson(entry.payload))) return false;
    previousHash = entry.eventHash;
  }
  return true;
}
