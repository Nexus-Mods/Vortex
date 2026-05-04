import { readFileSync, appendFileSync } from "fs";

const workspace = readFileSync("pnpm-workspace.yaml", "utf8");
const match = workspace.match(/^catalog:.*?^\s+electron:\s+(\S+)/ms);
if (!match)
  throw new Error("Could not find electron version in pnpm-workspace.yaml");

const vars = {
  npm_config_disturl: "https://electronjs.org/headers",
  npm_config_runtime: "electron",
  npm_config_target: match[1],
  npm_config_arch: "x64",
  npm_config_target_arch: "x64",
};

if (process.env.GITHUB_ENV) {
  for (const [k, v] of Object.entries(vars))
    appendFileSync(process.env.GITHUB_ENV, `${k}=${v}\n`);
} else {
  for (const [k, v] of Object.entries(vars))
    process.stdout.write(`${k}=${v}\n`);
}
