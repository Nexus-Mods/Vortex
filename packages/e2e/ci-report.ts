import { spawn } from "node:child_process";
import { existsSync, mkdirSync, createWriteStream } from "node:fs";
import { rm, readdir, rename, stat } from "node:fs/promises";
import * as path from "node:path";
import { pipeline } from "node:stream/promises";

import enquirer from "enquirer";
import { Octokit } from "octokit";

const envFilePath = path.resolve(import.meta.dirname, ".env");

if (existsSync(envFilePath)) {
  process.loadEnvFile(envFilePath);
}

const owner = "Nexus-Mods";
const repo = "Vortex";

// https://api.github.com/repos/Nexus-Mods/Vortex/actions/workflows/250222419
const workflow_id = 250222419;

const outputDirectory = path.join(import.meta.dirname, "reports");
mkdirSync(outputDirectory, { recursive: true });

function extract7z(filePath: string, outputDir: string, password?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = ["x", filePath, `-o${outputDir}`, "-y"];
    if (password) {
      args.push(`-p${password}`);
    }

    const proc = spawn("7z", args);
    let stderr = "";

    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`7z extraction failed with exit code ${code}: ${stderr}`));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn 7z process: ${err.message}`));
    });
  });
}

async function flattenSingleDirectory(dir: string): Promise<void> {
  const files = await readdir(dir);
  if (files.length === 1) {
    const itemPath = path.join(dir, files[0]!);
    const itemStat = await stat(itemPath);
    if (itemStat.isDirectory()) {
      // Move all contents from the single subdirectory up one level
      const nestedContents = await readdir(itemPath);
      for (const content of nestedContents) {
        const source = path.join(itemPath, content);
        const dest = path.join(dir, content);
        await rename(source, dest);
      }
      // Remove the empty nested directory
      await rm(itemPath, { recursive: true });
      console.log(`Flattened: moved contents up one level`);
    }
  }
}

async function extractNestedArchives(dir: string): Promise<void> {
  const files = await readdir(dir);

  for (const file of files) {
    if (file.endsWith(".7z")) {
      const filePath = path.join(dir, file);
      console.log(`Extracting encrypted 7z file: ${file}`);
      await extract7z(filePath, dir, process.env.ARTIFACT_PASSWORD!);
      console.log(`Finished extracting ${file}`);

      // Delete the 7z file after successful extraction
      await rm(filePath, { force: true });
      console.log(`Cleaned up ${file}`);

      // Flatten if the 7z extraction created a single subdirectory
      await flattenSingleDirectory(dir);
    }
  }
}

if (!process.env.GITHUB_TOKEN)
  throw new Error(
    `Missing GITHUB_TOKEN environment variable in .env file. Generate a new fine-grained PAT at https://github.com/settings/personal-access-tokens/new`,
  );

if (!process.env.ARTIFACT_PASSWORD)
  throw new Error(
    "Missing ARTIFACT_PASSWORD environment variable in .env file. This is required to extract encrypted 7z files.",
  );

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

console.log("Fetching workflow runs...");
const workflowRes = await octokit.rest.actions.listWorkflowRuns({ owner, repo, workflow_id });

const { run_id: selectedId } = await enquirer.prompt<{ run_id: string }>({
  type: "select",
  name: "run_id",
  message: "Select a workflow run to download reports from:",
  choices: workflowRes.data.workflow_runs.map((run) => ({
    message: `${run.display_title} (${run.event}) - ${run.status} - ${run.run_started_at}`,
    name: run.id.toString(),
  })),
});

const artifactsRes = await octokit.rest.actions.listWorkflowRunArtifacts({
  owner,
  repo,
  run_id: Number(selectedId),
});
console.log(`Downloading ${artifactsRes.data.artifacts.length} artifacts`);

const promises = artifactsRes.data.artifacts.map(async (artifact) => {
  console.log(`Downloading artifact ${artifact.id} (${artifact.size_in_bytes} bytes)`);
  const res = await octokit.rest.actions.downloadArtifact({
    owner,
    repo,
    artifact_id: artifact.id,
    archive_format: "zip",
  });

  const filePath = path.join(outputDirectory, artifact.name + ".zip");
  if (existsSync(filePath)) await rm(filePath, { force: true });

  const downloadURL = res.url;

  // Download the artifact from the presigned URL
  const response = await fetch(downloadURL);
  if (!response.ok) {
    throw new Error(`Failed to download artifact: ${response.statusText}`);
  }

  await pipeline(response.body!, createWriteStream(filePath));
  console.log(`Finished downloading ${artifact.id} to ${filePath}`);

  // Extract the ZIP file
  const extractDir = path.join(outputDirectory, `${artifact.name}-${selectedId}`);
  mkdirSync(extractDir, { recursive: true });
  console.log(`Extracting ${filePath} to ${extractDir}`);
  await extract7z(filePath, extractDir);
  console.log(`Finished extracting ${artifact.name}`);

  // Delete the ZIP file after extraction
  await rm(filePath, { force: true });
  console.log(`Cleaned up ZIP file ${artifact.name}.zip`);

  // Extract nested encrypted 7z files
  console.log(`Looking for encrypted 7z files in ${extractDir}`);
  await extractNestedArchives(extractDir);
});

await Promise.all(promises);
