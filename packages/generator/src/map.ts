/**
 * Stage 1 — MAP. RawSkill -> DraftSkillCatalogEntry (GAP defaults from
 * GOAL-3 goal3/extract/skill-catalog-map.md §3), RawRule -> keyword/HARD
 * registry drafts, and the 16 activate-Pn structural skills
 * (goal3/design/preset-catalog.md §2 windows).
 */
import {
  MACRO_CYCLES,
  OPERATING_MODES,
  RISK_CLASSES,
  type KeywordRegistryDraft,
} from "./schemas.js";
import type { RawRule, RawSkill } from "./parse.js";

export interface DraftEntry {
  id: string;
  title: string;
  purpose: string;
  activation: {
    macroCycles: string[];
    gateTypes: string[];
    riskClasses: string[];
    operatingModes: string[];
    keywords: string[];
    auto: boolean;
  };
  procedure?: string[];
  owns: string[];
  outOfScope: string[];
  evidenceProduced: string[];
  hookRefs: string[];
  subagentRefs: string[];
}

const DEFAULT_GATES = ["user_prompt", "session_start"]; // GAP-5

function deriveId(skill: RawSkill): string {
  const fmName = skill.frontmatter["name"];
  const base = (fmName && fmName.trim().length > 0 ? fmName : skill.dir)
    .replace(/-excellence-book$/u, "")
    .replace(/-excellence$/u, "")
    .toLowerCase();
  return base.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function firstH1(body: string): string | null {
  const m = /^#\s+(.+)$/m.exec(body);
  if (!m || m[1] === undefined) return null;
  return m[1]
    .replace(/\bExcellence Skill\b/i, "")
    .replace(/\bSkill\b\s*$/i, "")
    .replace(/\bExcellence\b\s*$/i, "")
    .trim();
}

function titleCase(id: string): string {
  return id
    .split("-")
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function extractInline(body: string, label: string): string | null {
  const re = new RegExp(`\\*\\*${label}\\*\\*\\s*:?\\s*(.+)`, "i");
  const m = re.exec(body);
  if (m && m[1] !== undefined) return m[1].trim();
  // heading + dash-list variant
  const hre = new RegExp(`^##\\s+${label}\\s*$`, "im");
  const hm = hre.exec(body);
  if (hm) {
    const after = body.slice(hm.index + hm[0].length);
    const items: string[] = [];
    for (const line of after.split("\n")) {
      const t = line.trim();
      if (t.startsWith("- ")) items.push(t.slice(2).trim());
      else if (t.startsWith("#") || (items.length > 0 && t === "")) break;
    }
    if (items.length > 0) return items.join("; ");
  }
  return null;
}

function splitPhrases(raw: string): string[] {
  return raw
    .replace(/\.$/, "")
    .split(/;|,(?![^(]*\))/)
    .map((s) =>
      s
        .replace(/→\s*`[^`]*`/g, "")
        .replace(/`[^`]*`/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((s) => s.length > 1);
}

function extractKeywords(skill: RawSkill): string[] {
  const sources: string[] = [];
  const desc = skill.frontmatter["description"];
  if (desc) sources.push(desc);
  sources.push(skill.body);
  const kws: string[] = [];
  for (const src of sources) {
    const m = /AUTO-INVOQUER\b[^:]*:?\s*(.+)/i.exec(src);
    if (m && m[1] !== undefined) {
      const seg = m[1].split(/\n\n/)[0] ?? m[1];
      for (const q of seg.matchAll(/["'“]([^"'”]+)["'”]/g)) {
        if (q[1]) kws.push(q[1].trim().toLowerCase());
      }
    }
    // multi-line dash variant
    for (const line of src.split("\n")) {
      const dm = /^\s*-\s*["'“]([^"'”]+)["'”]/.exec(line);
      if (dm && dm[1]) kws.push(dm[1].trim().toLowerCase());
    }
  }
  return [...new Set(kws.filter((k) => k.length > 1))];
}

function firstProse(body: string): string | null {
  const lines = body.split("\n");
  let seenH1 = false;
  for (const line of lines) {
    const t = line.trim();
    if (/^#\s/.test(t)) {
      seenH1 = true;
      continue;
    }
    if (!seenH1) continue;
    if (t.length === 0) continue;
    if (/^\*\*(OWNS|NE GERE PAS|AUTO-INVOQUER)/i.test(t)) continue;
    if (/^[#>\-|*]/.test(t)) continue;
    const sentence = t.split(/(?<=[.!?])\s/)[0];
    if (sentence && sentence.length > 12) return sentence.slice(0, 240).trim();
  }
  return null;
}

export function mapSkill(skill: RawSkill): DraftEntry {
  const id = deriveId(skill);
  const title = firstH1(skill.body) ?? titleCase(id);
  const purpose =
    (skill.frontmatter["description"]?.slice(0, 240) ?? null) ??
    firstProse(skill.body) ??
    `Excellence discipline: ${title}.`;
  const ownsRaw = extractInline(skill.body, "OWNS");
  const oosRaw = extractInline(skill.body, "NE GERE PAS");
  const owns = ownsRaw ? splitPhrases(ownsRaw) : [];
  const outOfScope = oosRaw ? splitPhrases(oosRaw) : [];
  const keywords = extractKeywords(skill);
  return {
    id,
    title,
    purpose: purpose.replace(/[\r\n]+/g, " ").trim(),
    activation: {
      macroCycles: [...MACRO_CYCLES], // GAP-4 default ALL
      gateTypes: [...DEFAULT_GATES], // GAP-5
      riskClasses: [...RISK_CLASSES], // GAP-6 default ALL
      operatingModes: [...OPERATING_MODES], // GAP-7 default ALL
      keywords,
      auto: keywords.length > 0,
    },
    owns: owns.length > 0 ? owns : [`${title} decisions`],
    outOfScope: outOfScope.length > 0 ? outOfScope : ["out-of-discipline decisions"],
    evidenceProduced: [], // GAP-9
    hookRefs: [], // GAP-10
    subagentRefs: [], // GAP-11
  };
}

export function mapKeywordRegistry(
  entries: DraftEntry[],
  rules: RawRule[],
): KeywordRegistryDraft[] {
  const hardBySkill = new Map<string, { hard: boolean; stage: string }>();
  for (const r of rules) {
    const prev = hardBySkill.get(r.forceInvokeSkill);
    if (!prev || (r.hardness === "HARD" && !prev.hard)) {
      hardBySkill.set(r.forceInvokeSkill, {
        hard: r.hardness === "HARD" || (prev?.hard ?? false),
        stage: r.stage,
      });
    }
  }
  return entries.map((e) => {
    const meta = hardBySkill.get(e.id);
    return {
      skillId: e.id,
      keywords: e.activation.keywords,
      forcedInvoke: meta?.hard ?? false,
      stage: meta?.stage ?? "UNKNOWN",
    };
  });
}

// ---- the 16 presets (preset-catalog.md §2) -----------------------------
export interface PresetDef {
  readonly pid: string;
  readonly name: string;
  readonly start: number;
  readonly stop: number;
  readonly intent: string;
  readonly output: string;
}

export const PRESETS: readonly PresetDef[] = [
  { pid: "P1", name: "full", start: 1, stop: 13, intent: "take this raw problem all the way to a measured, financed product", output: "shipped product + growth + CS + measurement + unit economics" },
  { pid: "P2", name: "product-discovery", start: 1, stop: 4, intent: "go from raw problem to a written spec ready for design and build", output: "validated SPEC.md" },
  { pid: "P3", name: "idea-to-design", start: 1, stop: 5, intent: "go from idea to a validated UX design ready for architecture", output: "spec + UX flows + designs + usability evidence" },
  { pid: "P4", name: "idea-to-arch", start: 1, stop: 6, intent: "go from idea to an architecture decision record ready for implementation", output: "spec + UX + ADR + data model" },
  { pid: "P5", name: "strategy", start: 2, stop: 3, intent: "sharpen positioning and run technical discovery on an existing problem", output: "positioning memo + discovery report" },
  { pid: "P6", name: "discovery", start: 3, stop: 4, intent: "technical discovery and a spec in one pass for a scoped problem", output: "analysis report + SPEC.md" },
  { pid: "P7", name: "discovery-to-design", start: 3, stop: 5, intent: "turn a scoped discovery into a spec and UX-complete design", output: "discovery + spec + UX flows" },
  { pid: "P8", name: "discovery-to-arch", start: 3, stop: 6, intent: "discovery through to a fully designed and architected solution", output: "discovery + spec + UX + ADR" },
  { pid: "P9", name: "spec-to-ship", start: 4, stop: 9, intent: "design, architect, build, and ship an existing spec", output: "deployed tested production build" },
  { pid: "P10", name: "design-only", start: 5, stop: 5, intent: "UX flows, component designs, and usability validation only", output: "validated UX flows + component specs" },
  { pid: "P11", name: "arch-to-ship", start: 6, stop: 9, intent: "architect, implement, and ship a design to production", output: "ADR + implemented + tested + deployed" },
  { pid: "P12", name: "build-to-ship", start: 8, stop: 9, intent: "implement, test, and release an existing architecture", output: "green tests + deploy pipeline" },
  { pid: "P13", name: "aiml-feature", start: 7, stop: 9, intent: "design an AI/ML feature, implement it, and ship it", output: "AI ADR + eval corpus + eval-gated release" },
  { pid: "P14", name: "gtm", start: 10, stop: 13, intent: "acquire users, retain them, measure, validate unit economics for a shipped product", output: "channel fit + CS playbook + dashboard + unit economics" },
  { pid: "P15", name: "have-idea-to-ship", start: 2, stop: 9, intent: "go straight from a formed idea with rough positioning to shipped product", output: "positioned spec + UX + architecture + shipped build" },
  { pid: "P16", name: "scope", start: 1, stop: 1, intent: "fire exactly one decision rule for a narrow, targeted ask", output: "single matched rule output, no traversal" },
] as const;

export function buildActivateSkill(p: PresetDef, hardSets: string[]) {
  const slug = p.name.replace(/[^a-z0-9]+/g, "-");
  const body = [
    `<!-- HIMA:SKILL-ARTIFACT name=activate-${slug} source=consommable-generator -->`,
    `# Activate: ${p.name} (${p.pid})`,
    "",
    "## Activation",
    `- Window: spine [${p.start} -> ${p.stop}]`,
    `- Invocation: \`/cycle:${p.name}[:mode]\` (default mode: auto)`,
    "",
    "## Ownership",
    `- Owns: deterministic structural activation of the ${p.name} chain-window.`,
    "- Out of scope: deciding the verdict (the windowed disciplines do that).",
    "",
    "## Forced disciplines (HARD — non-skippable, even in bypass)",
    ...hardSets.map((h) => `- ${h}`),
    "",
    `Intent seed: "I want to ${p.intent}". Output at stop: ${p.output}.`,
    "Traverse NEXT-STAGE transitively, bounded by the window stop; a skipped",
    "HARD discipline BLOCKs the run in every mode (GOAL-3 v3 §4c, authoritative).",
  ].join("\n");
  return {
    frontmatter: {
      name: `activate-${slug}`,
      version: "1.0.0",
      type: "task" as const,
      triggers: [`cycle:${p.name}`, p.intent],
      expected_outputs: [p.output],
      requires_tools: [],
      fallback_for_toolsets: [],
      description: `Structural activation of the ${p.name} dev-cycle window (spine ${p.start}-${p.stop}).`,
    },
    presetId: p.pid,
    window: { start: p.start, stop: p.stop },
    mode: "auto" as const,
    hardSets,
    body,
  };
}
