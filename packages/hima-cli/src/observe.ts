/**
 * observe — pure, testable trace renderer for @norm/cli.
 *
 * Reads an array of TraceEvent records (loaded by the caller from
 * `.hima/state/trace/<sessionId>.jsonl`) and produces human-readable strings
 * for the `norm trace` / `hima observe` command.
 *
 * All functions are pure (no I/O, no side-effects) so they can be unit-tested
 * without touching the filesystem.
 *
 * Exports:
 *   TraceFilter        — filter shape for filterTrace / renderObserve
 *   filterTrace        — select events matching a filter
 *   renderTimeline     — one human line per event (chronological)
 *   renderSummary      — aggregate counts across a set of events
 *   renderObserve      — summary of ALL events + timeline of FILTERED events
 */

import type { TraceEvent } from "@norm/schemas";

// ---------------------------------------------------------------------------
// TraceFilter
// ---------------------------------------------------------------------------

/**
 * TraceFilter — predicates applied by filterTrace / renderObserve.
 *
 * All fields are optional and combined with AND semantics:
 *   gate       — keep only events whose gateType equals this value
 *   decision   — keep only events whose decision equals this value
 *   onlyBlocks — when true, keep only events where decision === "block"
 *                (applied after `decision` if both are present)
 */
export type TraceFilter = {
  gate?: string;
  decision?: string;
  onlyBlocks?: boolean;
};

// ---------------------------------------------------------------------------
// filterTrace
// ---------------------------------------------------------------------------

/**
 * filterTrace — return the subset of events that match every predicate in f.
 *
 * Predicates are evaluated in order; the first false short-circuits.
 * An empty filter object returns all events unchanged.
 */
export function filterTrace(events: TraceEvent[], f: TraceFilter): TraceEvent[] {
  return events.filter((e) => {
    if (f.gate !== undefined && e.gateType !== f.gate) return false;
    if (f.decision !== undefined && e.decision !== f.decision) return false;
    if (f.onlyBlocks === true && e.decision !== "block") return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Formatting helpers (pure, unexported)
// ---------------------------------------------------------------------------

/**
 * Extract HH:MM:SS from an ISO8601 timestamp.
 * Falls back to the first 8 characters on unexpected formats.
 * Reads from the v3 field `e.ts`.
 */
function formatTimestamp(iso: string): string {
  // ISO8601: "2026-06-27T10:23:45.123Z"  →  group 1: "10:23:45"
  const match = /T(\d{2}:\d{2}:\d{2})/.exec(iso);
  if (match === null) {
    return iso.slice(0, 8);
  }
  return match[1] ?? iso.slice(0, 8);
}

/**
 * Build the optional [force:kind skill:id] annotation for one event.
 * Uses the v3 fields `forceActionKind` and the first entry in `skillsForced`.
 * Returns an empty string when no force is relevant.
 */
function forceAnnotation(e: TraceEvent): string {
  if (e.forceActionKind === undefined || e.forceActionKind === "noop") {
    return "";
  }
  const kind = e.forceActionKind;
  // First skill in skillsForced provides the skill id for the annotation.
  const firstSkill: string | undefined = e.skillsForced[0];

  if (firstSkill !== undefined) {
    return ` [force:${kind} skill:${firstSkill}]`;
  }
  return ` [force:${kind}]`;
}

/**
 * Build the optional [sigil:x ward:y] context annotation for one event.
 * Returns an empty string when neither field is present.
 */
function contextAnnotation(e: TraceEvent): string {
  const parts: string[] = [];
  if (e.sigil !== undefined) parts.push(`sigil:${e.sigil}`);
  if (e.wardStage !== undefined) parts.push(`ward:${e.wardStage}`);
  if (parts.length === 0) return "";
  return ` [${parts.join(" ")}]`;
}

// ---------------------------------------------------------------------------
// renderTimeline
// ---------------------------------------------------------------------------

/**
 * renderTimeline — one human-readable line per event.
 *
 * Format:
 *   HH:MM:SS <gateType> [<toolName>] -> <decision> [force:<kind> skill:<id>] [sigil:<s> ward:<stage>] exit<code>
 *
 * Square-bracketed segments are omitted when the relevant fields are absent.
 * Returns "no trace events" when the input array is empty.
 */
export function renderTimeline(events: TraceEvent[]): string {
  if (events.length === 0) {
    return "no trace events";
  }

  return events
    .map((e) => {
      const ts = formatTimestamp(e.ts);
      const tool = e.toolName !== undefined ? ` ${e.toolName}` : "";
      const force = forceAnnotation(e);
      const ctx = contextAnnotation(e);
      return `${ts} ${e.gateType}${tool} -> ${e.decision}${force}${ctx} exit${e.exitCode}`;
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// renderSummary
// ---------------------------------------------------------------------------

/**
 * renderSummary — aggregate counts across a set of events.
 *
 * Emitted fields:
 *   total          — number of events
 *   allow          — events with decision === "allow"
 *   warn           — events with decision === "warn"
 *   block          — events with decision === "block"
 *   skill-forces   — events where forceActionKind === "skill-force"
 *   errors         — events where exitCode !== 0 AND decision !== "block"
 *                    (unexpected non-block exits; indicates a logic anomaly)
 *   distinct-skills — unique skill IDs collected from skillsForced arrays
 *
 * Returns "no trace events" when the input array is empty.
 */
export function renderSummary(events: TraceEvent[]): string {
  if (events.length === 0) {
    return "no trace events";
  }

  let allowCount = 0;
  let warnCount = 0;
  let blockCount = 0;
  let skillForces = 0;
  let errors = 0;
  const distinctSkills = new Set<string>();

  for (const e of events) {
    // decision counts
    if (e.decision === "allow") allowCount++;
    else if (e.decision === "warn") warnCount++;
    else if (e.decision === "block") blockCount++;
    // "noop" is not counted in allow/warn/block

    // skill-force count — check the v3 forceActionKind field
    if (e.forceActionKind === "skill-force") {
      skillForces++;
    }

    // collect distinct skills from skillsForced (always present in v3 schema)
    for (const skill of e.skillsForced) {
      distinctSkills.add(skill);
    }

    // error: exitCode != 0 and not a block (block → exit2 is expected)
    if (e.exitCode !== 0 && e.decision !== "block") {
      errors++;
    }
  }

  const total = events.length;
  const skillsLine =
    distinctSkills.size > 0 ? [...distinctSkills].join(", ") : "none";

  return [
    `total:${total}  allow:${allowCount}  warn:${warnCount}  block:${blockCount}`,
    `skill-forces:${skillForces}  errors:${errors}  distinct-skills: ${skillsLine}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// renderObserve
// ---------------------------------------------------------------------------

/**
 * renderObserve — canonical combined output for `norm trace` / `hima observe`.
 *
 * = renderSummary(ALL events) + blank line + renderTimeline(FILTERED events)
 *
 * The summary is always over the full event log so counts are not distorted by
 * the active filter. The timeline shows only the filtered subset.
 */
export function renderObserve(events: TraceEvent[], f: TraceFilter): string {
  const summary = renderSummary(events);
  const filtered = filterTrace(events, f);
  const timeline = renderTimeline(filtered);
  return `${summary}\n\n${timeline}`;
}
