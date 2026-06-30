/**
 * rules-engine/frontmatter.ts — lightweight frontmatter parser for rule files.
 *
 * Parses the leading YAML-ish frontmatter block (between `---` delimiters) of a
 * `.md` or `.mdc` rule file and extracts:
 *   - globs       : string[] — picomatch patterns (aliases: paths, applyTo)
 *   - alwaysApply : boolean  — inject regardless of file path (default false)
 *   - description : string   — human-readable label (ignored by matching)
 *   - body        : string   — the rule content after the closing `---`
 *
 * Design constraints (SPEC-006 §MEDIUM):
 *   - No external YAML library — pure in-house parser.
 *   - Supports scalar strings, inline arrays `["a","b"]`, multiline arrays
 *     (`- item` per line), quoted values, and `#` comments.
 *   - Tolerates missing frontmatter (returns empty globs, alwaysApply=false,
 *     body = full content).
 *
 * See: SPEC-006-rules-engine-injection.md [HIGH][BLOCKS:high] format section.
 */

// ---------------------------------------------------------------------------
// ParsedRule — the parsed shape returned by parseRuleFrontmatter
// ---------------------------------------------------------------------------

export type ParsedRule = {
  /** picomatch glob patterns extracted from the frontmatter. */
  globs: string[];
  /** When true the rule is injected regardless of the target file path. */
  alwaysApply: boolean;
  /** Human-readable description from frontmatter (optional). */
  description?: string;
  /** The rule body — everything after the closing `---` delimiter. */
  body: string;
};

// ---------------------------------------------------------------------------
// parseRuleFrontmatter
// ---------------------------------------------------------------------------

/**
 * Parse the frontmatter of a rule file and return the extracted fields plus
 * the rule body.
 *
 * @param content  Full file content as a UTF-8 string.
 * @returns        ParsedRule with globs, alwaysApply, description, and body.
 */
export function parseRuleFrontmatter(content: string): ParsedRule {
  // Detect leading `---` delimiter (allow optional whitespace on the line)
  const OPEN_RE = /^---[ \t]*\r?\n/;
  const match = OPEN_RE.exec(content);

  if (!match) {
    // No frontmatter — entire content is the body
    return { globs: [], alwaysApply: false, body: content };
  }

  const afterOpen = content.slice(match[0].length);

  // Find the closing `---` delimiter
  const CLOSE_RE = /^---[ \t]*(\r?\n|$)/m;
  const closeMatch = CLOSE_RE.exec(afterOpen);

  if (!closeMatch) {
    // Malformed frontmatter (no closing ---) — treat whole content as body
    return { globs: [], alwaysApply: false, body: content };
  }

  const yamlBlock = afterOpen.slice(0, closeMatch.index);
  const body = afterOpen.slice(closeMatch.index + closeMatch[0].length);

  const parsed = parseYamlBlock(yamlBlock);

  return {
    globs: parsed.globs,
    alwaysApply: parsed.alwaysApply,
    ...(parsed.description !== undefined
      ? { description: parsed.description }
      : {}),
    body,
  };
}

// ---------------------------------------------------------------------------
// Internal: parseYamlBlock
// ---------------------------------------------------------------------------

type YamlFields = {
  globs: string[];
  alwaysApply: boolean;
  description?: string;
};

/**
 * Minimal YAML-ish parser that handles the subset used by rule frontmatters.
 * Mutates an accumulator as it walks lines.
 */
function parseYamlBlock(block: string): YamlFields {
  const result: YamlFields = { globs: [], alwaysApply: false };

  const lines = block.split(/\r?\n/);

  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i] ?? "";
    // Strip inline comments
    const line = stripComment(rawLine).trim();

    // Skip empty lines
    if (!line) {
      i++;
      continue;
    }

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) {
      // Could be a continuation or bare item — skip
      i++;
      continue;
    }

    const key = line.slice(0, colonIdx).trim();
    const valuePart = line.slice(colonIdx + 1).trim();

    switch (key) {
      case "alwaysApply": {
        result.alwaysApply = parseBool(valuePart);
        i++;
        break;
      }

      case "description": {
        result.description = unquote(valuePart);
        i++;
        break;
      }

      // globs + aliases from SPEC-006 (paths, applyTo)
      case "globs":
      case "paths":
      case "applyTo": {
        if (valuePart.startsWith("[")) {
          // Inline array: ["a", "b"] or [a, b]
          result.globs.push(...parseInlineArray(valuePart));
          i++;
        } else if (valuePart === "" || valuePart === null) {
          // Multiline array — consume subsequent `- item` lines
          i++;
          while (i < lines.length) {
            const itemLine = stripComment(lines[i] ?? "").trim();
            if (itemLine.startsWith("- ")) {
              result.globs.push(unquote(itemLine.slice(2).trim()));
              i++;
            } else if (itemLine === "") {
              i++;
            } else {
              break; // Next key reached
            }
          }
        } else {
          // Single inline value or CSV: "src/**/*.ts, lib/**/*.ts"
          const candidates = valuePart.split(",").map((s) => unquote(s.trim()));
          result.globs.push(...candidates.filter((s) => s.length > 0));
          i++;
        }
        break;
      }

      default:
        i++;
        break;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Strip a trailing `# comment` from a YAML line. */
function stripComment(line: string): string {
  // Only strip # that is not inside a quoted string
  let inSingle = false;
  let inDouble = false;
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === "#" && !inSingle && !inDouble) {
      return line.slice(0, j);
    }
  }
  return line;
}

/** Parse a YAML boolean value. */
function parseBool(value: string): boolean {
  return value === "true" || value === "yes" || value === "on" || value === "1";
}

/** Remove surrounding single or double quotes from a string value. */
function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Parse an inline YAML array: `["a", "b"]` or `[a, b]`.
 * Returns the items as strings with surrounding quotes removed.
 */
function parseInlineArray(value: string): string[] {
  // Strip outer brackets
  const inner = value.replace(/^\[/, "").replace(/\]$/, "").trim();
  if (!inner) return [];

  // Split on commas, handle quoted items
  const items: string[] = [];
  let current = "";
  let inQ = false;
  let qChar = "";

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i] ?? "";
    if (!inQ && (ch === '"' || ch === "'")) {
      inQ = true;
      qChar = ch;
    } else if (inQ && ch === qChar) {
      inQ = false;
    } else if (!inQ && ch === ",") {
      const trimmed = unquote(current.trim());
      if (trimmed) items.push(trimmed);
      current = "";
    } else {
      current += ch;
    }
  }
  const last = unquote(current.trim());
  if (last) items.push(last);

  return items;
}
