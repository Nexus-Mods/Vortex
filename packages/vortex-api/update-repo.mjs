import { execSync } from "node:child_process";
import { existsSync, cpSync, rmSync } from "node:fs";
import * as path from "node:path";

const API_REPO = process.env.API_REPO;
const MAIN_REPO = process.env.MAIN_REPO;
const PUSH_BRANCH = process.env.PUSH_BRANCH;

const DEST_DIR = path.resolve(import.meta.dirname, "api-repo");

const LIB_SRC = path.resolve(import.meta.dirname, "lib");
const LIB_DEST = path.join(DEST_DIR, "lib");

const API_EXTRACTOR_SRC = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "etc",
  "vortex.api.md",
);
const API_EXTRACTOR_DEST = path.join(DEST_DIR, "etc", "api.md");

const run = (cmd, cwd) => execSync(cmd, { stdio: "inherit", cwd });

if (!API_REPO) {
  console.error("Error: API_REPO environment variable is not set.");
  process.exit(1);
}

if (!MAIN_REPO) {
  console.error("Error: MAIN_REPO environment variable is not set.");
  process.exit(1);
}

if (existsSync(DEST_DIR)) {
  console.log(`Removing existing directory: ${DEST_DIR}`);
  rmSync(DEST_DIR, { recursive: true, force: true });
}

console.log(`Cloning ${API_REPO} into ${DEST_DIR}...`);
run(`git clone --depth 1 ${API_REPO} ${DEST_DIR}`);
console.log("Clone complete.");

if (!existsSync(API_EXTRACTOR_SRC)) {
  console.error(`Error: Source not found: ${API_EXTRACTOR_SRC}`);
  process.exit(1);
}

console.log(`Copying ${API_EXTRACTOR_SRC} to ${API_EXTRACTOR_DEST}...`);
cpSync(API_EXTRACTOR_SRC, API_EXTRACTOR_DEST);
console.log("Copy complete.");

if (!existsSync(LIB_SRC)) {
  console.error(`Error: Source not found: ${LIB_SRC}`);
  process.exit(1);
}

if (existsSync(LIB_DEST)) {
  console.log(`Removing existing directory: ${LIB_DEST}`);
  rmSync(LIB_DEST, { recursive: true, force: true });
}

console.log(`Copying ${LIB_SRC} to ${LIB_DEST}...`);
cpSync(LIB_SRC, LIB_DEST, { recursive: true });
console.log("Copy complete.");

console.log("Staging changes...");
run("git add -A", DEST_DIR);

const status = execSync("git status --porcelain", { cwd: DEST_DIR })
  .toString()
  .trim();
if (!status) {
  console.log("No changes to commit.");
  process.exit(0);
}

const sha = execSync("git rev-parse HEAD").toString().trim();
const shortSha = execSync("git rev-parse --short HEAD").toString().trim();
const commitUrl = `https://github.com/${MAIN_REPO}/commit/${sha}`;
console.log("Committing changes...");
run(
  `git commit -m "chore: update API to ${shortSha}" -m "${commitUrl}"`,
  DEST_DIR,
);

if (!PUSH_BRANCH) {
  console.log("PUSH_BRANCH not set — skipping push.");
  process.exit(0);
}

console.log(`Pushing changes to branch "${PUSH_BRANCH}"...`);
run(`git push --force origin HEAD:${PUSH_BRANCH}`, DEST_DIR);
console.log("Push complete.");
