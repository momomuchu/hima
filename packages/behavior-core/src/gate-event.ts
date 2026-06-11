// Minimal GateEvent type for behavior-core — derived from packages/core/src/schemas/gate-event.schema.ts

import type { GateType } from "./types.js";

export interface GateEvent {
  gateType: GateType;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  promptContent?: string;
  metadata?: Record<string, unknown>;
}
