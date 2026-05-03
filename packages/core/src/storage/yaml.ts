import { readFile } from "node:fs/promises";
import YAML from "yaml";
import type { z } from "zod";
import { HarnessError } from "../types/errors.js";
import { atomicWriteFile } from "./atomic-write.js";

export async function readYamlFile<T>(filePath: string, schema: z.ZodType<T>): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return schema.parse(YAML.parse(raw));
  } catch (error) {
    throw new HarnessError("PLANNING_SCHEMA_INVALID", `Invalid YAML file: ${filePath}`, {
      filePath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function writeYamlFile<T>(
  filePath: string,
  value: T,
  schema: z.ZodType<T>,
): Promise<void> {
  const parsed = schema.parse(value);
  await atomicWriteFile(filePath, YAML.stringify(parsed));
}
