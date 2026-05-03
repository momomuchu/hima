export type HarnessErrorCode =
  | "PLANNING_NOT_FOUND"
  | "PLANNING_SCHEMA_INVALID"
  | "PLANNING_WRITE_FAILED"
  | "GATE_BLOCKED"
  | "TRANSITION_BLOCKED";

export class HarnessError extends Error {
  readonly code: HarnessErrorCode;
  readonly context: Record<string, unknown>;

  constructor(code: HarnessErrorCode, message: string, context: Record<string, unknown> = {}) {
    super(message);
    this.name = "HarnessError";
    this.code = code;
    this.context = context;
  }
}
