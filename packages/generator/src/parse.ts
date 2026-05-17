/**
 * Stage 0 — PARSE. Reads the otherskill consommable + ACTIVATION-RULES.md.
 * Grammar is the one extracted in GOAL-3 goal3/extract/activation-rules-topology.md
 * (the 7 regexes) and skill-catalog-map.md (SKILL.md element locations).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export interface RawSkill {
  readonly dir: string; // directory name (e.g. api-design-excellence-book)
  readonly frontmatter: Record<string, string>;
  readonly body: string;
}

export interface RawRule {
  readonly id: string;
  readonly stage: string;
  readonly signalA: string[];
  readonly signalB: string[];
  readonly forceInvokeSkill: string;
  readonly hardness: "HARD" | "SOFT";
  readonly handoffTarget: string;
  readonly isEnd: boolean;
  readonly precedence: number | null;
}

export interface ParseResult {
  readonly rawSkills: RawSkill[];
  readonly rawRules: RawRule[];
}

const SPINE = [
  "idea-pmf",
  "strategy-positioning",
  "analysis-discovery",
  "specification",
  "design-ux",
  "architecture",
  "ai-ml",
  "build",
  "quality-release",
  "growth",
  "sales-cs",
  "measurement",
  "finance",
] as const;

function parseFrontmatter(text: string): { fm: Record<string, string>; body: string } {
  const fm: Record<string, string> = {};
  if (text.startsWith("---")) {
    const end = text.indexOf("\n---", 3);
    if (end !== -1) {
      const block = text.slice(3, end);
      for (const line of block.split("\n")) {
        const m = /^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/.exec(line.trim());
        if (m && m[1] !== undefined && m[2] !== undefined) {
          fm[m[1]] = m[2].replace(/^["']|["']$/g, "");
        }
      }
      return { fm, body: text.slice(end + 4) };
    }
  }
  return { fm, body: text };
}

export function parseCorpus(corpusRoot: string): RawSkill[] {
  const out: RawSkill[] = [];
  for (const dir of readdirSync(corpusRoot).sort()) {
    const skillPath = join(corpusRoot, dir, "SKILL.md");
    try {
      if (!statSync(skillPath).isFile()) continue;
    } catch {
      continue;
    }
    const text = readFileSync(skillPath, "utf8");
    const { fm, body } = parseFrontmatter(text);
    out.push({ dir, frontmatter: fm, body });
  }
  return out;
}

function idToStage(ruleId: string): string {
  const normed = ruleId.toLowerCase().replace(/_/g, "-");
  for (const s of SPINE) {
    if (normed.startsWith(s)) return s;
  }
  const parts = normed.split("-");
  for (const len of [3, 2, 1]) {
    const cand = parts.slice(0, len).join("-");
    if ((SPINE as readonly string[]).includes(cand)) return cand;
  }
  return "UNKNOWN";
}

const RULE_START = /^### RULE\s+(\S+)/;
const SIGNAL_PARTS = /("[^"]+")|(\*\*\/[^\s|]+)|(phase:\s*\S+)/g;

function parseSignal(raw: string): { a: string[]; b: string[] } {
  const a: string[] = [];
  const b: string[] = [];
  SIGNAL_PARTS.lastIndex = 0;
  for (const m of raw.matchAll(SIGNAL_PARTS)) {
    if (m[1]) a.push(m[1].replace(/^"|"$/g, "").trim());
    else if (m[2]) b.push(m[2]);
  }
  const stripped = raw.replace(SIGNAL_PARTS, "");
  for (const tokRaw of stripped.split(/[|\n]/)) {
    const tok = tokRaw.trim();
    if (tok.length > 2 && !tok.startsWith("#")) a.push(tok);
  }
  return { a, b };
}

function field(block: string, key: string): string | null {
  const re = new RegExp(`^${key}\\s*:\\s*(.+)$`, "m");
  const m = re.exec(block);
  return m && m[1] !== undefined ? m[1].trim() : null;
}

export function parseRules(activationRulesPath: string): RawRule[] {
  const text = readFileSync(activationRulesPath, "utf8");
  const lines = text.split("\n");
  const blocks: { id: string; body: string }[] = [];
  let cur: { id: string; lines: string[] } | null = null;
  for (const line of lines) {
    const m = RULE_START.exec(line);
    if (m && m[1] !== undefined) {
      if (cur) blocks.push({ id: cur.id, body: cur.lines.join("\n") });
      cur = { id: m[1], lines: [] };
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  if (cur) blocks.push({ id: cur.id, body: cur.lines.join("\n") });

  const rules: RawRule[] = [];
  for (const { id, body } of blocks) {
    const sigRaw = field(body, "SIGNAL") ?? "";
    const { a, b } = parseSignal(sigRaw);
    const fiRaw = field(body, "FORCE-INVOKE") ?? "";
    const fiM = /^(.+?)\s*\[(HARD|SOFT)\]\s*$/.exec(fiRaw.trim());
    const forceInvokeSkill = fiM?.[1] ? fiM[1].trim() : fiRaw.trim();
    const hardness: "HARD" | "SOFT" =
      fiM && fiM[2] === "HARD" ? "HARD" : fiM && fiM[2] === "SOFT" ? "SOFT" : "SOFT";
    const hoRaw = field(body, "HANDOFF") ?? "";
    const nsM = /^NEXT-STAGE\s+(\S+)/.exec(hoRaw.trim());
    const isEnd = !nsM && /END/.test(hoRaw);
    const handoffTarget = nsM?.[1] ? nsM[1].trim() : isEnd ? "END" : hoRaw.trim();
    const precRaw = field(body, "PRECEDENCE");
    const precedence = precRaw && /^\d+$/.test(precRaw) ? Number(precRaw) : null;
    rules.push({
      id,
      stage: idToStage(id),
      signalA: a,
      signalB: b,
      forceInvokeSkill,
      hardness,
      handoffTarget,
      isEnd,
      precedence,
    });
  }
  return rules;
}

export function parse(corpusRoot: string, activationRulesPath: string): ParseResult {
  return {
    rawSkills: parseCorpus(corpusRoot),
    rawRules: parseRules(activationRulesPath),
  };
}

export { SPINE };
