// `hima status` — display .hima/ state summary.

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export async function runStatusCommand(root: string): Promise<void> {
  const himaDir = path.join(root, ".hima");

  if (!existsSync(himaDir)) {
    process.stdout.write(`No .hima/ directory found at ${root}\n`);
    process.exitCode = 1;
    return;
  }

  // Read state.json if present
  const stateFile = path.join(himaDir, "state.json");
  if (existsSync(stateFile)) {
    const raw = await readFile(stateFile, "utf8");
    try {
      const state = JSON.parse(raw) as Record<string, unknown>;
      process.stdout.write(JSON.stringify(state, null, 2) + "\n");
    } catch {
      process.stdout.write(raw + "\n");
    }
    return;
  }

  process.stdout.write(`{ "root": "${root}", "himaDir": "${himaDir}", "state": "empty" }\n`);
}
