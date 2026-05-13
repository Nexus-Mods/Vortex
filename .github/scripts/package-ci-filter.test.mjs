import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("./package-ci-filter.mjs", import.meta.url));

const baseFiles = {
  ".github/workflows/package.yml": "name: Package\n",
  ".github/scripts/package-ci-filter.mjs": "// package ci filter fixture\n",
  "package.json": JSON.stringify(
    {
      packageManager: "pnpm@11.1.1",
      engines: { node: "24.15.0" },
      devEngines: { runtime: { version: "24.15.0" } },
      scripts: {
        package: "pnpm run build && pnpm nx run @vortex/main:package",
        "package:nosign": "pnpm run build && pnpm nx run @vortex/main:package:nosign",
      },
      dependencies: { node: "catalog:" },
    },
    null,
    2,
  ),
  "pnpm-workspace.yaml": `packages:
  - ./src/main

catalog:
  react: ^16.12.0

minimumReleaseAge: 2880
minimumReleaseAgeExclude:
  - commander
`,
  "src/main/electron-builder.config.json": JSON.stringify(
    { appId: "com.nexusmods.vortex" },
    null,
    2,
  ),
  "src/main/package.json": JSON.stringify(
    {
      name: "@vortex/main",
      main: "build/main.cjs",
      files: ["./build"],
      scripts: {
        publish: "pnpm -F @vortex/main deploy ./dist",
        package: "pnpm electron-builder --config ./electron-builder.config.json",
        "package:nosign": "pnpm electron-builder --config ./electron-builder.config.json",
      },
      nx: {
        targets: {
          publish: { cache: false },
          package: { cache: false },
          "package:nosign": { cache: false },
        },
      },
      dependencies: { react: "catalog:" },
    },
    null,
    2,
  ),
};

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trimEnd();
}

async function write(cwd, path, content) {
  const fullPath = join(cwd, path);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content);
}

async function createRepo() {
  const cwd = await mkdtemp(join(tmpdir(), "package-ci-filter-"));

  git(cwd, ["init", "-b", "main"]);
  git(cwd, ["config", "user.email", "test@example.com"]);
  git(cwd, ["config", "user.name", "Test User"]);

  for (const [path, content] of Object.entries(baseFiles)) {
    await write(cwd, path, content);
  }

  git(cwd, ["add", "."]);
  git(cwd, ["commit", "-m", "base"]);

  return { base: git(cwd, ["rev-parse", "HEAD"]), cwd };
}

function commitChanges(cwd) {
  git(cwd, ["add", "."]);
  git(cwd, ["commit", "-m", "change"]);
}

async function runFilter(cwd, base, eventName = "pull_request") {
  const outputPath = join(cwd, "github-output.txt");
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      BASE_SHA: base,
      EVENT_NAME: eventName,
      GITHUB_OUTPUT: outputPath,
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  return {
    output: await readFile(outputPath, "utf8"),
    stdout: result.stdout,
  };
}

async function expectRunPackage(cwd, base, expected) {
  const { output, stdout } = await runFilter(cwd, base);
  assert.match(output, new RegExp(`run_package=${expected}`), stdout);
}

test("runs for non-PR events", async () => {
  const { base, cwd } = await createRepo();
  const { output } = await runFilter(cwd, base, "workflow_dispatch");

  assert.match(output, /run_package=true/);
});

test("ignores dependency-only changes", async () => {
  const { base, cwd } = await createRepo();

  const rootPackage = JSON.parse(baseFiles["package.json"]);
  rootPackage.dependencies.leftPad = "catalog:";
  await write(cwd, "package.json", `${JSON.stringify(rootPackage, null, 2)}\n`);

  const mainPackage = JSON.parse(baseFiles["src/main/package.json"]);
  mainPackage.dependencies.leftPad = "catalog:";
  await write(cwd, "src/main/package.json", `${JSON.stringify(mainPackage, null, 2)}\n`);

  await write(
    cwd,
    "pnpm-workspace.yaml",
    baseFiles["pnpm-workspace.yaml"].replace(
      "  react: ^16.12.0",
      "  react: ^16.12.0\n  left-pad: ^1.3.0",
    ),
  );

  commitChanges(cwd);

  await expectRunPackage(cwd, base, "false");
});

test("runs for pnpm deploy/security setting changes", async () => {
  const { base, cwd } = await createRepo();

  await write(
    cwd,
    "pnpm-workspace.yaml",
    `${baseFiles["pnpm-workspace.yaml"]}minimumReleaseAgeIgnoreMissingTime: true\n`,
  );

  commitChanges(cwd);

  await expectRunPackage(cwd, base, "true");
});

test("runs for root package runtime/script changes", async () => {
  const { base, cwd } = await createRepo();
  const rootPackage = JSON.parse(baseFiles["package.json"]);
  rootPackage.packageManager = "pnpm@11.2.0";

  await write(cwd, "package.json", `${JSON.stringify(rootPackage, null, 2)}\n`);

  commitChanges(cwd);

  await expectRunPackage(cwd, base, "true");
});

test("runs for main package target changes", async () => {
  const { base, cwd } = await createRepo();
  const mainPackage = JSON.parse(baseFiles["src/main/package.json"]);
  mainPackage.nx.targets.package.cache = true;

  await write(cwd, "src/main/package.json", `${JSON.stringify(mainPackage, null, 2)}\n`);

  commitChanges(cwd);

  await expectRunPackage(cwd, base, "true");
});

test("runs for electron-builder config changes", async () => {
  const { base, cwd } = await createRepo();

  await write(
    cwd,
    "src/main/electron-builder.config.json",
    `${JSON.stringify({ appId: "com.nexusmods.vortex.dev" }, null, 2)}\n`,
  );

  commitChanges(cwd);

  await expectRunPackage(cwd, base, "true");
});
