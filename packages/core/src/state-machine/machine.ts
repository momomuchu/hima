import { setup } from "xstate";
import type { PlanningStateFile } from "../schemas/state.schema.js";

export type HarnessMachineEvent =
  | { type: "SESSION_START" }
  | { type: "CYCLE_START" }
  | { type: "SUBSTEP_COMPLETE" }
  | { type: "CYCLE_SUSPEND" }
  | { type: "ERROR_DETECTED" }
  | { type: "ERROR_RECOVERED" };

export interface HarnessMachineContext {
  state: PlanningStateFile;
}

export const harnessMachine = setup({
  types: {
    context: {} as HarnessMachineContext,
    events: {} as HarnessMachineEvent,
    input: {} as { state: PlanningStateFile },
  },
}).createMachine({
  id: "harness",
  context: ({ input }) => ({ state: input.state }),
  initial: "running",
  states: {
    running: {
      on: {
        CYCLE_SUSPEND: "suspended",
        ERROR_DETECTED: "recoverableError",
      },
    },
    suspended: {
      on: {
        SESSION_START: "running",
      },
    },
    recoverableError: {
      on: {
        ERROR_RECOVERED: "running",
      },
    },
  },
});
