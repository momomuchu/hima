// gates-core dispatch router — one entry point per gate type.
//
// All gates except "stop" delegate directly to evaluateGate from @harness/core.
// The "stop" gate uses the local fixed implementation that respects
// RISK_POLICY[riskClass].requiresEvidenceBeforeStop (bug fix, see evaluate-stop.ts).

import {
  evaluateGate as coreEvaluateGate,
  type GateEvaluationContext,
  type GateResult,
} from "@harness/core";
import type { GateEvent } from "@harness/core";
import { evaluateStop } from "./evaluate-stop.js";

export function evaluateGate(context: GateEvaluationContext, event: GateEvent): GateResult {
  if (event.gateType === "stop") {
    return evaluateStop(context, event);
  }
  return coreEvaluateGate(context, event);
}
