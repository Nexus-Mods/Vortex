import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const isCI = process.env.CI !== undefined;
const cwd = process.cwd();

const [config] = process.argv.slice(2);
const args = ["exec", "oxlint", "--quiet"];
if (config !== undefined) {
  args.push("-c", config);
}
if (isCI) {
  args.push("--format", "json");
}

const child = spawn("pnpm", args, {
  cwd,
  shell: process.platform === "win32",
  stdio: isCI ? ["ignore", "pipe", "inherit"] : "inherit",
});

let stdout = "";
if (isCI) {
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
}

child.on("close", (code, signal) => {
  if (isCI) {
    writeFileSync(join(cwd, ".lint-results.json"), stdout);
  }
  process.exit(signal !== null ? 1 : (code ?? 1));
});

child.on("error", (err) => {
  console.error(err.message);
  process.exit(1);
});
