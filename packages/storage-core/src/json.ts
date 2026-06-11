import { readFile } from "node:fs/promises";
import type { z } from "zod";
import { atomicWriteFile } from "./atomic-write.js";

export class StorageError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly context: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "StorageError";
  }
}

export async function readJsonFile<T>(filePath: string, schema: z.ZodType<T>): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return schema.parse(JSON.parse(raw));
  } catch (error) {
    throw new StorageError("STORAGE_SCHEMA_INVALID", `Invalid JSON file: ${filePath}`, {
      filePath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function writeJsonFile<T>(
  filePath: string,
  value: T,
  schema: z.ZodType<T>,
): Promise<void> {
  const parsed = schema.parse(value);
  await atomicWriteFile(filePath, `${JSON.stringify(parsed, null, 2)}\n`);
}
