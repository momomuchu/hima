#!/usr/bin/env node
// hima-cli — minimal CLI entry point
// Routes argv to command handlers in src/commands/.

import { runHookCommand } from "./commands/hook.js";
import { runStatusCommand } from "./commands/status.js";
import path from "node:path";

const [, , command, ...rest] = process.argv;

const root = (() => {
  const idx = rest.indexOf("--root");
  if (idx !== -1 && rest[idx + 1] !== undefined) return rest[idx + 1]!;
  return process.cwd();
})();

async function main(): Promise<void> {
  if (command === "hook") {
    await runHookCommand(rest.filter((a) => a !== "--root" && a !== root));
    return;
  }

  if (command === "status") {
    await runStatusCommand(path.resolve(root));
    return;
  }

  if (command === "--help" || command === "-h" || command === undefined) {
    process.stdout.write(
      "Usage: hima <command>\n\n" +
        "Commands:\n" +
        "  hook <event> [--format claude|hermes|native]  Evaluate a hook event from JSON stdin\n" +
        "  status [--root <dir>]                         Show .hima/ state\n",
    );
    return;
  }

  process.stderr.write(`Unknown command: ${command}\n`);
  process.exitCode = 1;
}

main().catch((err: unknown) => {
  process.stderr.write(`hima: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
