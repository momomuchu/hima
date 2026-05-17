import { spawn } from "node:child_process";

const rawTestArgs = process.argv.slice(2);
const forwardedArgs = rawTestArgs[0] === "--" ? rawTestArgs.slice(1) : rawTestArgs;
const hasTimeoutArg = forwardedArgs.some(
  (arg) => arg === "--testTimeout" || arg.startsWith("--testTimeout="),
);

const testArgs = [
  ...(hasTimeoutArg ? [] : ["--testTimeout=15000"]),
  ...forwardedArgs.map((arg, index, args) => {
    if (arg !== "--bail") {
      return arg;
    }

    const nextArg = args[index + 1];
    if (nextArg !== undefined && /^\d+$/.test(nextArg)) {
      return arg;
    }

    return "--bail=1";
  }),
];

const commands = [
  ["corepack", ["pnpm", "--filter", "@harness/core", "build"]],
  ["corepack", ["pnpm", "--filter", "@harness/adapter-codex", "build"]],
  ["corepack", ["pnpm", "--filter", "@harness/adapter-claude", "build"]],
  ["corepack", ["pnpm", "--filter", "@harness/adapter-hermes", "build"]],
  ["node", ["scripts/validate-claim-bearing-falsifies.test.mjs"]],
  ["node", ["scripts/audit-construction-completion.test.mjs"]],
  ["node", ["scripts/guard-construction-blocked-state.test.mjs"]],
  ["node", ["scripts/conversation-compliance-scan.test.mjs"]],
  ["corepack", ["pnpm", "exec", "vitest", "run", ...testArgs]],
];

for (const [command, args] of commands) {
  const result = spawn(command, args, {
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  const exitCode = await new Promise((resolve) => {
    result.on("exit", (code) => resolve(code ?? 1));
    result.on("error", () => resolve(1));
  });

  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
