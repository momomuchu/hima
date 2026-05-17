import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { DOMAIN_EVENT_TYPES } from "../domain/events.js";
import { HarnessError } from "../types/errors.js";

export const EventLogEntrySchema = z.object({
  id: z.string().min(1),
  ts: z.string().min(1),
  type: z.enum(DOMAIN_EVENT_TYPES),
  runId: z.string().min(1),
  payload: z.unknown().optional(),
});

export type EventLogEntry = z.infer<typeof EventLogEntrySchema>;

export function getEventsLogPath(projectRoot: string): string {
  return path.join(projectRoot, ".hima", "state", "events.jsonl");
}

export async function appendEventLogEntry(
  projectRoot: string,
  entry: EventLogEntry,
): Promise<string> {
  const parsed = EventLogEntrySchema.parse(entry);
  const filePath = getEventsLogPath(projectRoot);
  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(parsed)}\n`, "utf8");
  return filePath;
}

export async function readEventLog(projectRoot: string): Promise<EventLogEntry[]> {
  const filePath = getEventsLogPath(projectRoot);
  const raw = await readFile(filePath, "utf8").catch((error) => {
    throw new HarnessError("PLANNING_SCHEMA_INVALID", `Invalid events log: ${filePath}`, {
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
        return EventLogEntrySchema.parse(JSON.parse(line));
      } catch (error) {
        throw new HarnessError(
          "PLANNING_SCHEMA_INVALID",
          `Invalid events log line ${index + 1}: ${filePath}`,
          {
            filePath,
            line: index + 1,
            cause: error instanceof Error ? error.message : String(error),
          },
        );
      }
    });
}
