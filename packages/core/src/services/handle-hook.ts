import {
  appendLoopDetectorEntry,
  buildLoopDetectorEntry,
} from "../behaviors/beh-022-loop-detector.js";
import { hashContent } from "../gates/action-signal.js";
import { normalizePath } from "../gates/canonical-path.js";
import { evaluateGate, type GateResult } from "../gates/evaluate-gate.js";
import { computeSliSnapshots } from "../gates/gate-decision-record.js";
import { compactPayload, normalizeGatePayload, preview } from "../hooks/hook-payload.js";
import { redactSubagentRecord, upsertSubagentRecord } from "../hooks/subagent-launch-record.js";
import type { RunSetFile } from "../schemas/run-set.schema.js";
import { redactSecrets, redactUnknown } from "../security/redaction.js";
import {
  appendRunEvent,
  type PlanningProject,
  readPlanningProject,
} from "../storage/planning-store.js";
import type { GateType } from "../types/canonical.js";
import { HarnessError } from "../types/errors.js";

// ── Signal helpers ─────────────────────────────────────────────────────────────

/**
 * Normalises a file path the same way BEH-010 does so that paths stored in
 * run-set events and paths extracted from toolInput compare equal.
 * Delegates to canonical-path.ts — single source of truth (C2/M2 fix).
 */
function normalizeReadPath(value: string): string {
  return normalizePath(value);
}

/**
 * Extracts the canonical file path from a Read-class toolInput object.
 * Returns an empty string when no path is found.
 */
function extractReadPath(toolInput: unknown): string {
  if (!toolInput || typeof toolInput !== "object") return "";
  const input = toolInput as Record<string, unknown>;
  for (const key of ["file_path", "filePath", "path"]) {
    const val = input[key];
    if (typeof val === "string" && val.length > 0) {
      return normalizeReadPath(val);
    }
  }
  return "";
}

/** Returns true when the tool name indicates a pure read operation. */
function isReadTool(toolName: string | undefined): boolean {
  if (!toolName) return false;
  const n = toolName.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
  return n === "read" || n === "readfile";
}

/**
 * BEH-010 — Rebuilds the sessionReadSet and sessionReadHashMap from persisted
 * run-set events. Scans for post_tool events with decision=allow where the tool
 * is a read-class tool and a readPath was recorded in the event payload.
 *
 * H1 fix: also captures the readContentHash stored at read time so BEH-010 can
 * verify the on-disk content has not changed since the session read.
 */
function buildSessionReadData(runSet: RunSetFile): {
  readSet: ReadonlySet<string>;
  readHashMap: ReadonlyMap<string, string>;
} {
  const paths = new Set<string>();
  const hashMap = new Map<string, string>();
  for (const ev of runSet.events) {
    if (
      ev.gateType === "post_tool" &&
      ev.decision === "allow" &&
      ev.payload &&
      typeof ev.payload.readPath === "string" &&
      ev.payload.readPath.length > 0
    ) {
      const rp = ev.payload.readPath as string;
      paths.add(rp);
      // Store the content hash if present (written by the H1 fix in this file)
      if (typeof ev.payload.readContentHash === "string" && ev.payload.readContentHash.length > 0) {
        hashMap.set(rp, ev.payload.readContentHash as string);
      }
    }
  }
  return { readSet: paths, readHashMap: hashMap };
}
// ──────────────────────────────────────────────────────────────────────────────

export interface HandleHookOptions {
  dryRun?: boolean;
}

export interface HookResponse extends GateResult {
  failOpen: boolean;
}

export async function handleHook(
  projectRoot: string,
  gateType: GateType,
  payload: unknown,
  options: HandleHookOptions = {},
): Promise<HookResponse> {
  let project: PlanningProject;

  try {
    project = await readPlanningProject(projectRoot);
  } catch (error) {
    const reason = redactSecrets(
      `planning state unavailable: ${
        error instanceof HarnessError ? error.message : "failed to read planning state"
      }`,
    );

    return {
      decision: "block",
      gateType,
      reason: reason ?? "planning state unavailable",
      violationType: "RUNTIME_BINDING_UNAVAILABLE",
      finalState: "BLOCKED_RUNTIME_MISSING",
      failOpen: false,
    };
  }

  const event = normalizeGatePayload(gateType, payload);

  // BEH-010 — Populate sessionReadSet and sessionReadHashMap from persisted
  // run-set events so the read-before-write behavior has data to enforce against.
  // H1 fix: also pass the content-hash map so BEH-010 can detect changed content.
  const { readSet: sessionReadSet, readHashMap: sessionReadHashMap } = buildSessionReadData(
    project.runSet,
  );

  const result = evaluateGate(
    {
      projectRoot,
      state: project.state,
      currentRisk: project.currentRisk,
      runSet: project.runSet,
      sessionReadSet,
      sessionReadHashMap,
    },
    event,
  );
  const redactedReason = redactSecrets(result.reason) ?? result.reason;

  // BEH-010 — Determine the read path to persist for this event (Read-class post_tool only).
  // Only stored when the gate decision is "allow" so that blocked Read calls do not
  // pollute the set (a blocked read did not succeed, so the file was not actually read).
  const readPath =
    gateType === "post_tool" && result.decision === "allow" && isReadTool(event.toolName)
      ? extractReadPath(event.toolInput)
      : "";

  // BEH-010 H1 fix — Also store the content hash of the file at read time.
  // toolOutput carries the file content for a Read call. We hash it so BEH-010
  // can later verify the on-disk content matches what was read, preventing writes
  // to files whose content has changed since the session read.
  const readContentHash = readPath.length > 0 ? hashContent(event.toolOutput) : "";

  if (!options.dryRun) {
    const subagentRecord =
      result.decision === "allow" && result.subagentRecord
        ? redactSubagentRecord(result.subagentRecord)
        : undefined;

    // BEH-022 — Build the updateRunSet callback that appends a loop-detector entry
    // on every post_tool event, regardless of decision (loops can happen even on
    // allowed tool calls). Composed with the subagent-record upsert when needed.
    const loopDetectorUpdate =
      gateType === "post_tool"
        ? (runSet: RunSetFile): RunSetFile => ({
            ...runSet,
            loopDetector: appendLoopDetectorEntry(
              runSet.loopDetector,
              buildLoopDetectorEntry(event),
            ),
          })
        : undefined;

    // BEH-W4 — At stop gate, compute SLI snapshot from accumulated GATE_DECISION events
    // and write to policy.sliSnapshot before finalizing.
    const sliUpdate =
      gateType === "stop"
        ? (runSet: RunSetFile): RunSetFile => {
            const snapshot = computeSliSnapshots(runSet.events);
            if (snapshot.length === 0) return runSet;
            return {
              ...runSet,
              policy: {
                ...runSet.policy,
                sliSnapshot: snapshot,
              },
            };
          }
        : undefined;

    // BEH-032 m4 — When the kill-switch fires, carry the abort report to the
    // run-set so run-set.json#/abortReports[] is actually populated (the spec
    // Falsifies-If half requires an abort-report entry, not just CANCELLED state).
    const abortReportUpdate = result.abortReport
      ? (runSet: RunSetFile): RunSetFile => ({
          ...runSet,
          // biome-ignore lint/style/noNonNullAssertion: guarded by result.abortReport truthy check above
          abortReports: [...(runSet.abortReports ?? []), result.abortReport!],
        })
      : undefined;

    const updateRunSet = (() => {
      const steps: Array<(rs: RunSetFile) => RunSetFile> = [];
      if (loopDetectorUpdate) steps.push(loopDetectorUpdate);
      if (sliUpdate) steps.push(sliUpdate);
      if (subagentRecord) steps.push((rs) => upsertSubagentRecord(rs, subagentRecord));
      if (abortReportUpdate) steps.push(abortReportUpdate);

      if (steps.length === 0) return undefined;
      if (steps.length === 1) return steps[0];
      return (rs: RunSetFile) => steps.reduce((acc, fn) => fn(acc), rs);
    })();

    // BEH-W4 — Append the GATE_EVALUATED event, embedding gateDecisionRecords
    // in the payload so the single event remains the stable "last event" for
    // existing consumers, while also carrying the structured decision audit trail.
    await appendRunEvent(
      projectRoot,
      {
        id: `evt_${Date.now()}`,
        ts: new Date().toISOString(),
        type: "GATE_EVALUATED",
        gateType,
        decision: result.decision,
        reason: redactedReason,
        payload: compactPayload({
          violationType: result.violationType,
          finalState: result.finalState,
          missingEvidenceItems: result.missingEvidenceItems,
          evidenceAnchors: redactUnknown(result.evidenceAnchors),
          policyEvent: redactUnknown(result.policyEvent),
          subagentRecord: redactUnknown(result.subagentRecord),
          toolName: event.toolName,
          metadata: redactUnknown(event.metadata),
          promptContentPreview: preview(redactSecrets(event.promptContent) ?? event.promptContent),
          toolInputPreview: preview(redactUnknown(event.toolInput)),
          toolOutputPreview: preview(redactUnknown(event.toolOutput)),
          // BEH-010 — path read by a successful Read-class tool call this event
          ...(readPath.length > 0 ? { readPath } : {}),
          // BEH-010 H1 — content hash of the file at read time (hash of toolOutput)
          ...(readContentHash.length > 0 ? { readContentHash } : {}),
          // BEH-W4 — Structured gate-decision records embedded in the event payload.
          // Queryable via: events.filter(e => e.type === "GATE_EVALUATED" && e.payload?.gateDecisions)
          ...(result.gateDecisionRecords && result.gateDecisionRecords.length > 0
            ? { gateDecisions: result.gateDecisionRecords }
            : {}),
        }),
      },
      updateRunSet,
    );
  }

  return {
    ...result,
    reason: redactedReason,
    failOpen: false,
  };
}
