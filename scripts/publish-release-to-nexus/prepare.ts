/**
 * Pure publish-preparation functions for the Publish Release to Nexus workflow.
 *
 * Exported functions can be tested without GitHub I/O by passing a fake
 * `ghRun` command runner and a temp directory.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/** A single asset attached to a GitHub release. */
export interface ReleaseAsset {
  /** Asset file name (e.g. `Vortex-1-2-0.exe`). */
  name: string;
  /** Download URL for the asset. */
  url: string;
}

/** Shape of `gh release view --json` output used by this module. */
export interface GithubRelease {
  /** Git tag (e.g. `v1.2.3`). */
  tagName: string;
  /** Human-readable release title. */
  name: string;
  /** Markdown release body / changelog. */
  body: string;
  /** Assets attached to the release. */
  assets: ReleaseAsset[];
  /** Whether the release is still a draft. */
  isDraft: boolean;
  /** Whether the release is marked as a prerelease. */
  isPrerelease: boolean;
}

/** Options for {@link preparePublish}. */
export interface PreparePublishOptions {
  /** If true, skip download and only return a plan. */
  dryRun: boolean;
  /** Nexus Mods game domain slug (e.g. `site`). */
  modSlug: string;
  /** Nexus Mods file group ID. */
  fileGroupId: string;
  /** Command runner: executes `gh <args>` and returns stdout. */
  ghRun: (args: string[]) => string;
  /** Directory where the installer will be downloaded. */
  downloadDir: string;
  /** Path to the `GITHUB_OUTPUT` file; omitted when running outside CI. */
  githubOutput?: string;
}

/** Result of {@link preparePublish} describing the planned upload. */
export interface PublishPlan {
  /** Git tag of the release (e.g. `v1.2.3`). */
  tagName: string;
  /** Stripped version number without leading `v` (e.g. `1.2.3`). */
  version: string;
  /** File name of the installer asset. */
  installerName: string;
  /** Local path to the downloaded installer. */
  installerPath: string;
  /** Markdown release body. */
  body: string;
  isDraft: boolean;
  isPrerelease: boolean;
  dryRun: boolean;
  modSlug: string;
  fileGroupId: string;
}

/**
 * Validates that a GitHub release is stable (not draft, not prerelease).
 *
 * # Errors
 *
 * Throws if `release.isDraft` is `true` - draft releases cannot be published.
 * Throws if `release.isPrerelease` is `true` - indicates a stale or
 *   inconsistent state on GitHub (the release was already selected as stable).
 */
export function assertStableRelease(release: GithubRelease): void {
  if (release.isDraft) {
    throw new Error(
      `Latest release (${release.tagName}) is a draft. Only stable releases can be published.`,
    );
  }
  if (release.isPrerelease) {
    throw new Error(
      `Release ${release.tagName} is marked as prerelease but was returned as the latest stable release — this indicates a stale or inconsistent state on GitHub.`,
    );
  }
}

/**
 * Selects the first `.exe` installer asset from a GitHub release.
 *
 * @param release - The GitHub release to search.
 * @returns The first asset whose `name` ends with `.exe`.
 *
 * # Errors
 *
 * Throws if no asset with a `.exe` name exists in the release.
 */
export function findInstallerAsset(release: GithubRelease): ReleaseAsset {
  const installer = release.assets.find((asset) => asset.name.endsWith(".exe"));
  if (!installer) {
    throw new Error("No .exe installer asset found in the latest release");
  }
  return installer;
}

/**
 * Strips a leading `v` from a git tag to produce a plain version string.
 *
 * Mirrors the shell parameter expansion `${TAG#v}` from the original workflow.
 *
 * @param tagName - Git tag (e.g. `v1.2.3`).
 * @returns Version without leading `v` (e.g. `1.2.3`), or the tag unchanged
 *   if it has no leading `v`.
 */
export function versionFromTag(tagName: string): string {
  if (tagName.startsWith("v")) {
    return tagName.slice(1);
  }
  return tagName;
}

/**
 * Finds the tag name of the latest stable (non-draft, non-prerelease) GitHub
 * release by listing releases with exclusion flags.
 *
 * @param ghRun - Command runner: executes `gh <args>` and returns stdout.
 * @returns The tag name of the latest stable release (e.g. `v1.2.3`).
 *
 * # Errors
 *
 * Throws if no stable releases exist (empty list after exclusions).
 */
export function findLatestStableTag(ghRun: (args: string[]) => string): string {
  const json = ghRun([
    "release",
    "list",
    "--exclude-pre-releases",
    "--exclude-drafts",
    "--json",
    "tagName",
    "--limit",
    "1",
  ]);
  const releases: Array<{ tagName: string }> = JSON.parse(json);
  if (releases.length === 0) {
    throw new Error("No stable (non-draft, non-prerelease) releases found.");
  }
  return releases[0].tagName;
}

/**
 * Orchestrates release preparation: finds the latest stable release tag
 * via `ghRun`, fetches full release details, validates the release,
 * selects the installer, downloads it (unless dry-run), and writes
 * `GITHUB_OUTPUT` keys.
 *
 * @param options - Configuration including the `ghRun` command runner and
 *   output directory.
 * @returns A {@link PublishPlan} describing the release to be uploaded.
 *
 * # Errors
 *
 * Throws if no stable releases are found (via {@link findLatestStableTag}).
 * Throws if the release is a draft or prerelease (via {@link assertStableRelease}).
 * Throws if no `.exe` installer asset is found (via {@link findInstallerAsset}).
 * Throws if `gh release view` fails (e.g. `gh` not authenticated or release not found).
 * Throws if `gh release download` fails (e.g. `gh` not authenticated or network error).
 */
export async function preparePublish(options: PreparePublishOptions): Promise<PublishPlan> {
  // Find the latest stable release tag, then fetch full details
  const tag = findLatestStableTag(options.ghRun);
  const json = options.ghRun([
    "release",
    "view",
    tag,
    "--json",
    "tagName,name,body,assets,isDraft,isPrerelease",
  ]);
  const release: GithubRelease = JSON.parse(json);

  // Validate stability before any I/O
  assertStableRelease(release);

  // Select the .exe installer asset
  const installer = findInstallerAsset(release);

  // Strip the leading 'v' to get the plain version
  const version = versionFromTag(release.tagName);

  const installerPath = path.join(options.downloadDir, installer.name);

  // Download the installer unless this is a dry-run
  if (!options.dryRun) {
    options.ghRun([
      "release",
      "download",
      release.tagName,
      "--pattern",
      installer.name,
      "--dir",
      options.downloadDir,
    ]);
  }

  // Write GITHUB_OUTPUT keys so the workflow can wire them to the upload action
  if (options.githubOutput) {
    writeGithubOutput(options.githubOutput, "tag", release.tagName);
    writeGithubOutput(options.githubOutput, "version", version);
    writeGithubOutput(options.githubOutput, "installer-path", installerPath);
    writeGithubOutput(options.githubOutput, "installer-name", installer.name);
    // Body may contain newlines - use heredoc syntax to avoid truncation
    writeGithubOutputMultiline(options.githubOutput, "body", release.body);
  }

  return {
    tagName: release.tagName,
    version,
    installerName: installer.name,
    installerPath,
    body: release.body,
    isDraft: release.isDraft,
    isPrerelease: release.isPrerelease,
    dryRun: options.dryRun,
    modSlug: options.modSlug,
    fileGroupId: options.fileGroupId,
  };
}

/**
 * Writes a single-line output to the GITHUB_OUTPUT file consumed by
 * downstream workflow steps (e.g. `steps.prepare.outputs.installer-path`).
 *
 * Single-line values only. For values containing newlines, use
 * `writeGithubOutputMultiline` instead.
 */
function writeGithubOutput(filePath: string, key: string, value: string): void {
  fs.appendFileSync(filePath, `${key}=${value}\n`);
}

/**
 * Writes a multiline output to the GITHUB_OUTPUT file using heredoc syntax.
 *
 * Used for the release body (markdown changelog) which spans multiple lines.
 * GitHub Actions uses `key<<EOF\nvalue\nEOF` delimiters to capture the full value.
 */
function writeGithubOutputMultiline(filePath: string, key: string, value: string): void {
  fs.appendFileSync(filePath, `${key}<<EOF\n${value}\nEOF\n`);
}
