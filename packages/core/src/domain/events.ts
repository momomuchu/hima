import type { RunEvent } from "../schemas/run-set.schema.js";
import type { EventLogEntry } from "../storage/events-log.js";
import type { GateType } from "../types/canonical.js";

export const DOMAIN_EVENT_TYPES = Object.freeze([
  "TransitionRequested",
  "TransitionExecuted",
  "GateEvaluated",
  "EvidenceAdded",
  "RunClosed",
  "RiskClassPromoted",
  "SubagentLaunched",
  "SubagentReturned",
]) as readonly [
  "TransitionRequested",
  "TransitionExecuted",
  "GateEvaluated",
  "EvidenceAdded",
  "RunClosed",
  "RiskClassPromoted",
  "SubagentLaunched",
  "SubagentReturned",
];

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number];

export type DomainEventOwner = "Run" | "Cycle" | "Gate" | "Evidence" | "Subagent";

export interface DomainEventEnvelope {
  readonly type: DomainEventType;
  readonly owner: DomainEventOwner;
  readonly legacyType?: string;
}

const GATE_DOMAIN_EVENTS: Partial<Record<GateType, DomainEventEnvelope>> = {
  subagent_start: { type: "SubagentLaunched", owner: "Subagent", legacyType: "GATE_EVALUATED" },
  subagent_stop: { type: "SubagentReturned", owner: "Subagent", legacyType: "GATE_EVALUATED" },
};

export function isDomainEventType(value: unknown): value is DomainEventType {
  return typeof value === "string" && DOMAIN_EVENT_TYPES.includes(value as DomainEventType);
}

export function domainEventForRunEvent(event: RunEvent): DomainEventEnvelope {
  if (event.gateType) {
    return (
      GATE_DOMAIN_EVENTS[event.gateType] ?? {
        type: "GateEvaluated",
        owner: "Gate",
        legacyType: event.type,
      }
    );
  }

  switch (event.type) {
    case "STATE_TRANSITIONED":
      return { type: "TransitionExecuted", owner: "Cycle", legacyType: event.type };
    case "RUN_CLOSED":
      return { type: "RunClosed", owner: "Run", legacyType: event.type };
    case "EVIDENCE_ADDED":
      return { type: "EvidenceAdded", owner: "Evidence", legacyType: event.type };
    default:
      if (isDomainEventType(event.type)) {
        return { type: event.type, owner: inferOwner(event.type) };
      }

      return { type: "GateEvaluated", owner: "Gate", legacyType: event.type };
  }
}

export function toDomainEventLogEntry(
  runId: string,
  event: RunEvent,
  envelope = domainEventForRunEvent(event),
): EventLogEntry {
  return {
    id: event.id,
    ts: event.ts,
    type: envelope.type,
    runId,
    payload: {
      owner: envelope.owner,
      ...(envelope.legacyType ? { legacyType: envelope.legacyType } : {}),
      event,
    },
  };
}

function inferOwner(type: DomainEventType): DomainEventOwner {
  switch (type) {
    case "TransitionRequested":
    case "TransitionExecuted":
      return "Cycle";
    case "GateEvaluated":
    case "RiskClassPromoted":
      return "Gate";
    case "EvidenceAdded":
      return "Evidence";
    case "RunClosed":
      return "Run";
    case "SubagentLaunched":
    case "SubagentReturned":
      return "Subagent";
  }
}
