import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
} from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { HarnessError } from "../types/errors.js";

export const GENESIS_HASH = "0".repeat(64);

export const LedgerEntrySchema = z.object({
  id: z.string().min(1),
  ts: z.string().min(1),
  runId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  prevHash: z.string().regex(/^[a-f0-9]{64}$/),
  eventHash: z.string().regex(/^[a-f0-9]{64}$/),
  payload: z.unknown(),
  signature: z.string().min(1),
  publicKey: z.string().min(1),
});

export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

export interface LedgerSigner {
  privateKeyPem: string;
  publicKeyPem: string;
}

export function createLedgerSigner(): LedgerSigner {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
}

export function getLedgerPath(projectRoot: string, runId: string): string {
  return path.join(projectRoot, ".hima", "state", "ledger", `${runId}.jsonl`);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

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

function signingPayload(entry: Omit<LedgerEntry, "signature" | "publicKey">): Buffer {
  return Buffer.from(stableJson(entry), "utf8");
}

export async function readLedger(projectRoot: string, runId: string): Promise<LedgerEntry[]> {
  const filePath = getLedgerPath(projectRoot, runId);
  const raw = await readFile(filePath, "utf8").catch((error) => {
    throw new HarnessError("PLANNING_SCHEMA_INVALID", `Invalid ledger file: ${filePath}`, {
      filePath,
      cause: error instanceof Error ? error.message : String(error),
    });
  });

  if (raw.trim() === "") {
    return [];
  }

  return raw
    .trimEnd()
    .split(/\r?\n/)
    .map((line, index) => {
      try {
        return LedgerEntrySchema.parse(JSON.parse(line));
      } catch (error) {
        throw new HarnessError(
          "PLANNING_SCHEMA_INVALID",
          `Invalid ledger line ${index + 1}: ${filePath}`,
          {
            filePath,
            line: index + 1,
            cause: error instanceof Error ? error.message : String(error),
          },
        );
      }
    });
}

export async function appendLedgerEntry(
  projectRoot: string,
  runId: string,
  payload: unknown,
  signer: LedgerSigner = createLedgerSigner(),
): Promise<LedgerEntry> {
  const filePath = getLedgerPath(projectRoot, runId);
  const existing = await readLedger(projectRoot, runId).catch((error) => {
    if (error instanceof HarnessError && String(error.context.cause).includes("ENOENT")) {
      return [];
    }
    throw error;
  });
  const previous = existing.at(-1);
  const unsigned = {
    id: `${runId}-${existing.length + 1}`,
    ts: new Date().toISOString(),
    runId,
    sequence: existing.length,
    prevHash: previous?.eventHash ?? GENESIS_HASH,
    eventHash: sha256Hex(stableJson(payload)),
    payload,
  };
  const privateKey = createPrivateKey(signer.privateKeyPem);
  const signature = sign(null, signingPayload(unsigned), privateKey).toString("base64");
  const entry = LedgerEntrySchema.parse({
    ...unsigned,
    signature,
    publicKey: signer.publicKeyPem,
  });

  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(entry)}\n`, "utf8");
  return entry;
}

export function verifyLedgerEntries(entries: LedgerEntry[]): boolean {
  let previousHash = GENESIS_HASH;

  for (const entry of entries) {
    if (entry.prevHash !== previousHash) {
      return false;
    }

    if (entry.eventHash !== sha256Hex(stableJson(entry.payload))) {
      return false;
    }

    const publicKey = createPublicKey(entry.publicKey);
    const unsigned = {
      id: entry.id,
      ts: entry.ts,
      runId: entry.runId,
      sequence: entry.sequence,
      prevHash: entry.prevHash,
      eventHash: entry.eventHash,
      payload: entry.payload,
    };

    if (
      !verify(null, signingPayload(unsigned), publicKey, Buffer.from(entry.signature, "base64"))
    ) {
      return false;
    }

    previousHash = entry.eventHash;
  }

  return true;
}
