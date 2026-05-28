/**
 * CLI entry point for the Publish Release to Nexus workflow.
 *
 * Accepts `--dry-run`, `--mod-slug`, and `--file-group-id` flags, delegates
 * to {@link preparePublish}, and prints a dry-run summary or upload
 * confirmation. Guarded by an `isMain` check so importing this module for
 * testing does not execute the CLI.
 */

import * as child_process from "node:child_process";
import { pathToFileURL } from "node:url";

import { preparePublish, type PreparePublishOptions } from "./prepare";

/**
 * Parses `--dry-run`, `--mod-slug`, and `--file-group-id` flags from
 * the argument list. Throws on missing required flags.
 *
 * @param argv - Argument strings (typically `process.argv.slice(2)`).
 * @returns Parsed flag values.
 *
 * # Errors
 *
 * Throws if `--mod-slug` is missing.
 * Throws if `--file-group-id` is missing.
 */
function parseArgs(argv: string[]): { dryRun: boolean; modSlug: string; fileGroupId: string } {
  let dryRun = false;
  let modSlug: string | undefined;
  let fileGroupId: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      // Check if next arg is a boolean value or just presence of the flag
      const next = argv[i + 1];
      if (next === "true") {
        dryRun = true;
        i++;
      } else if (next === "false") {
        dryRun = false;
        i++;
      } else {
        // Flag without value means true
        dryRun = true;
      }
    } else if (arg === "--mod-slug") {
      modSlug = argv[++i];
      if (!modSlug) {
        throw new Error("Missing value for --mod-slug");
      }
    } else if (arg === "--file-group-id") {
      fileGroupId = argv[++i];
      if (!fileGroupId) {
        throw new Error("Missing value for --file-group-id");
      }
    }
  }

  if (!modSlug) {
    throw new Error("Missing required flag: --mod-slug");
  }
  if (!fileGroupId) {
    throw new Error("Missing required flag: --file-group-id");
  }

  return { dryRun, modSlug, fileGroupId };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const options: PreparePublishOptions = {
    dryRun: args.dryRun,
    modSlug: args.modSlug,
    fileGroupId: args.fileGroupId,
    // Wrap the real `gh` CLI so preparePublish can be swapped with a
    // fake in tests via the ghRun option.
    ghRun: (args) => child_process.execSync(`gh ${args.join(" ")}`, { encoding: "utf8" }),
    downloadDir: "./release-assets",
    githubOutput: process.env.GITHUB_OUTPUT,
  };
  const plan = await preparePublish(options);
  if (plan.dryRun) {
    console.log("===== DRY RUN - no upload will be performed =====");
    console.log(`Tag:         ${plan.tagName}`);
    console.log(`Version:     ${plan.version}`);
    console.log(`Installer:   ${plan.installerName}`);
    console.log(`Mod slug:    ${plan.modSlug}`);
    console.log(`File group:   ${plan.fileGroupId}`);
    console.log("=================================================");
  } else {
    console.log(`Publishing ${plan.version} - upload will proceed via Nexus action`);
  }
}

const isMain =
  typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    // `::error::` is a GitHub Actions workflow annotation format
    console.error(`::error::${message}`);
    console.error(err);
    process.exit(1);
  });
}
