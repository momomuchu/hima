import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { MacroCycle } from "../types/canonical.js";
import { HarnessError } from "../types/errors.js";

export type GovernanceGateKind = "dor" | "dod";

export interface GovernanceCriterion {
  id: string;
  text: string;
}

export interface GovernanceDefinition {
  kind: GovernanceGateKind;
  cycle: MacroCycle;
  title: string;
  version: number;
  criteria: GovernanceCriterion[];
  filePath: string;
  falsifiesIf: {
    killCondition: string;
    checkpointDate: string;
    evidenceAnchor: string;
    onFail: string;
  };
}

export interface GovernanceEvaluation {
  allowed: boolean;
  checked: Array<{
    kind: GovernanceGateKind;
    cycle: MacroCycle;
    filePath: string;
    criteriaCount: number;
  }>;
  blockers: string[];
}

const CYCLE_FILE_SLUGS: Record<MacroCycle, string> = {
  discovery: "01-discovery",
  cadrage: "02-cadrage",
  conception: "03-conception",
  build: "04-build",
  validation: "05-validation",
  release: "06-release",
  run: "07-run",
  learning: "08-apprentissage",
};

function governanceFilePath(
  projectRoot: string,
  kind: GovernanceGateKind,
  cycle: MacroCycle,
): string {
  return path.join(projectRoot, "docs", "01-governance", `${kind}-${CYCLE_FILE_SLUGS[cycle]}.md`);
}

function extractFrontmatter(raw: string, filePath: string): Record<string, unknown> {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    throw new HarnessError(
      "PLANNING_SCHEMA_INVALID",
      `Governance file missing frontmatter: ${filePath}`,
      {
        filePath,
      },
    );
  }

  const parsed = parseYaml(match[1] ?? "");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new HarnessError(
      "PLANNING_SCHEMA_INVALID",
      `Governance frontmatter is not an object: ${filePath}`,
      {
        filePath,
      },
    );
  }

  return parsed as Record<string, unknown>;
}

function readString(value: unknown, field: string, filePath: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HarnessError(
      "PLANNING_SCHEMA_INVALID",
      `Governance field ${field} is required: ${filePath}`,
      {
        field,
        filePath,
      },
    );
  }

  return value;
}

function readNumber(value: unknown, field: string, filePath: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new HarnessError(
      "PLANNING_SCHEMA_INVALID",
      `Governance field ${field} must be a positive integer: ${filePath}`,
      {
        field,
        filePath,
      },
    );
  }

  return value;
}

function readCriteria(value: unknown, filePath: string): GovernanceCriterion[] {
  if (!Array.isArray(value) || value.length < 3) {
    throw new HarnessError(
      "PLANNING_SCHEMA_INVALID",
      `Governance file needs at least 3 criteria: ${filePath}`,
      {
        filePath,
      },
    );
  }

  return value.map((criterion, index) => {
    if (!criterion || typeof criterion !== "object" || Array.isArray(criterion)) {
      throw new HarnessError(
        "PLANNING_SCHEMA_INVALID",
        `Governance criterion must be an object: ${filePath}`,
        {
          filePath,
          index,
        },
      );
    }

    const record = criterion as Record<string, unknown>;
    return {
      id: readString(record.id, `criteria[${index}].id`, filePath),
      text: readString(record.text, `criteria[${index}].text`, filePath),
    };
  });
}

function readFalsifiesIf(value: unknown, filePath: string): GovernanceDefinition["falsifiesIf"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HarnessError(
      "PLANNING_SCHEMA_INVALID",
      `Governance file missing Falsifies-If block: ${filePath}`,
      {
        filePath,
      },
    );
  }

  const record = value as Record<string, unknown>;
  return {
    killCondition: readString(record["kill-condition"], "Falsifies-If.kill-condition", filePath),
    checkpointDate: readString(record["checkpoint-date"], "Falsifies-If.checkpoint-date", filePath),
    evidenceAnchor: readString(record["evidence-anchor"], "Falsifies-If.evidence-anchor", filePath),
    onFail: readString(record["on-fail"], "Falsifies-If.on-fail", filePath),
  };
}

async function loadGovernanceDefinition(
  projectRoot: string,
  kind: GovernanceGateKind,
  cycle: MacroCycle,
): Promise<GovernanceDefinition> {
  const filePath = governanceFilePath(projectRoot, kind, cycle);
  const raw = await readFile(filePath, "utf8").catch((error) => {
    throw new HarnessError(
      "TRANSITION_BLOCKED",
      `Missing ${kind.toUpperCase()} governance file for ${cycle}: ${filePath}`,
      {
        cycle,
        filePath,
        cause: error instanceof Error ? error.message : String(error),
      },
    );
  });
  const frontmatter = extractFrontmatter(raw, filePath);
  const parsedKind = readString(frontmatter.kind, "kind", filePath);
  const parsedCycle = readString(frontmatter.cycle, "cycle", filePath);

  if (parsedKind !== kind || parsedCycle !== cycle) {
    throw new HarnessError(
      "PLANNING_SCHEMA_INVALID",
      `Governance file identity mismatch: ${filePath}`,
      {
        expectedKind: kind,
        actualKind: parsedKind,
        expectedCycle: cycle,
        actualCycle: parsedCycle,
      },
    );
  }

  return {
    kind,
    cycle,
    filePath,
    title: readString(frontmatter.title, "title", filePath),
    version: readNumber(frontmatter.version, "version", filePath),
    criteria: readCriteria(frontmatter.criteria, filePath),
    falsifiesIf: readFalsifiesIf(frontmatter["Falsifies-If"], filePath),
  };
}

export async function loadDor(
  projectRoot: string,
  cycle: MacroCycle,
): Promise<GovernanceDefinition> {
  return loadGovernanceDefinition(projectRoot, "dor", cycle);
}

export async function loadDod(
  projectRoot: string,
  cycle: MacroCycle,
): Promise<GovernanceDefinition> {
  return loadGovernanceDefinition(projectRoot, "dod", cycle);
}

export async function evaluateDorDodTransition(
  projectRoot: string,
  fromCycle: MacroCycle,
  toCycle: MacroCycle,
): Promise<GovernanceEvaluation> {
  const checked: GovernanceEvaluation["checked"] = [];
  const blockers: string[] = [];

  for (const definition of [
    await loadDod(projectRoot, fromCycle),
    await loadDor(projectRoot, toCycle),
  ]) {
    checked.push({
      kind: definition.kind,
      cycle: definition.cycle,
      filePath: definition.filePath,
      criteriaCount: definition.criteria.length,
    });
  }

  return {
    allowed: blockers.length === 0,
    checked,
    blockers,
  };
}

export async function assertGovernanceTemplateExists(projectRoot: string): Promise<void> {
  const filePath = path.join(projectRoot, "docs", "01-governance", "_template-dor-dod.md");
  await access(filePath).catch((error) => {
    throw new HarnessError("TRANSITION_BLOCKED", `Missing governance template: ${filePath}`, {
      filePath,
      cause: error instanceof Error ? error.message : String(error),
    });
  });
}
