import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { JsonObjectSchema } from "../schemas/common.js";
import { withFileLock } from "../storage/file-lock.js";
import { getPlanningPaths } from "../storage/planning-paths.js";
import { appendRunEvent } from "../storage/planning-store.js";
import { safeAtomicWriteFile } from "../storage/safe-write.js";
import { HarnessError } from "../types/errors.js";

export const HumanInputUrgencySchema = z.enum(["low", "normal", "high", "critical"]);
export const HumanInputFormatSchema = z.enum([
  "free_text",
  "single_choice",
  "multi_choice",
  "approval",
]);

const RequestHumanInputInputBaseSchema = z.object({
  id: z.string().min(1).optional(),
  urgency: HumanInputUrgencySchema,
  format: HumanInputFormatSchema,
  question: z.string().min(1),
  choices: z.array(z.string().min(1)).optional(),
  threadId: z.string().min(1),
  requestedBy: z.string().min(1).optional(),
  metadata: JsonObjectSchema.optional(),
  createdAt: z.string().min(1).optional(),
});

export const RequestHumanInputInputSchema = RequestHumanInputInputBaseSchema.superRefine(
  (value, context) => {
    const choiceCount = value.choices?.length ?? 0;

    if ((value.format === "single_choice" || value.format === "multi_choice") && choiceCount < 2) {
      context.addIssue({
        code: "custom",
        path: ["choices"],
        message: `${value.format} handoff requests require at least two choices.`,
      });
    }

    if (value.format === "free_text" && choiceCount > 0) {
      context.addIssue({
        code: "custom",
        path: ["choices"],
        message: "free_text handoff requests must not include choices.",
      });
    }
  },
);

export const HumanInputRequestSchema = RequestHumanInputInputBaseSchema.omit({
  id: true,
  createdAt: true,
})
  .extend({
    schemaVersion: z.literal(1),
    id: z.string().min(1),
    createdAt: z.string().min(1),
    status: z.literal("pending"),
  })
  .strict();

export type RequestHumanInputInput = z.infer<typeof RequestHumanInputInputSchema>;
export type HumanInputRequest = z.infer<typeof HumanInputRequestSchema>;
export type HumanInputUrgency = z.infer<typeof HumanInputUrgencySchema>;
export type HumanInputFormat = z.infer<typeof HumanInputFormatSchema>;

export function getHumanInputHandoffsPath(projectRoot: string): string {
  return path.join(projectRoot, ".planning", "09-logs", "handoffs.jsonl");
}

export async function requestHumanInput(
  projectRoot: string,
  input: RequestHumanInputInput,
): Promise<HumanInputRequest> {
  const parsed = RequestHumanInputInputSchema.parse(input);
  const createdAt = parsed.createdAt ?? new Date().toISOString();
  const request = HumanInputRequestSchema.parse({
    ...parsed,
    schemaVersion: 1,
    id: parsed.id ?? `handoff_${Date.now()}`,
    createdAt,
    status: "pending",
  });

  const handoffsPath = await appendHumanInputRequest(projectRoot, request);

  await appendRunEvent(projectRoot, {
    id: `human-input-requested-${request.id}`,
    ts: request.createdAt,
    type: "HUMAN_INPUT_REQUESTED",
    payload: {
      requestId: request.id,
      urgency: request.urgency,
      format: request.format,
      threadId: request.threadId,
      choicesCount: request.choices?.length ?? 0,
      handoffsPath: path.relative(projectRoot, handoffsPath).replaceAll(path.sep, "/"),
    },
  });

  return request;
}

export async function readHumanInputRequests(projectRoot: string): Promise<HumanInputRequest[]> {
  const filePath = getHumanInputHandoffsPath(projectRoot);
  const raw = await readFile(filePath, "utf8").catch((error) => {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return "";
    }

    throw new HarnessError("PLANNING_SCHEMA_INVALID", `Invalid handoffs log: ${filePath}`, {
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
        return HumanInputRequestSchema.parse(JSON.parse(line));
      } catch (error) {
        throw new HarnessError(
          "PLANNING_SCHEMA_INVALID",
          `Invalid handoffs log line ${index + 1}: ${filePath}`,
          {
            filePath,
            line: index + 1,
            cause: error instanceof Error ? error.message : String(error),
          },
        );
      }
    });
}

async function appendHumanInputRequest(
  projectRoot: string,
  request: HumanInputRequest,
): Promise<string> {
  const paths = getPlanningPaths(projectRoot);
  const filePath = getHumanInputHandoffsPath(projectRoot);
  const lockDir = path.join(paths.planningDir, ".handoffs.lock");

  await withFileLock(lockDir, async () => {
    const existing = await readFile(filePath, "utf8").catch((error) => {
      if (isNodeErrorWithCode(error, "ENOENT")) {
        return "";
      }

      throw error;
    });
    const content = `${existing.trimEnd()}${existing.trim() === "" ? "" : "\n"}${JSON.stringify(
      request,
    )}\n`;

    await safeAtomicWriteFile(projectRoot, filePath, content);
  });

  return filePath;
}

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === code
  );
}
