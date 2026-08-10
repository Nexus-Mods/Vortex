/**
 * Pure publish-preparation functions for the Publish Release to Nexus workflow.
 *
 * Exported functions can be tested without GitHub I/O by passing a fake
 * `ghRun` command runner and a temp directory.
 */

import * as path from "node:path";

import { readReleaseNotes } from "./changelog";

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
  /** Command runner: executes `gh <args>` and returns stdout. */
  ghRun: (args: string[]) => string;
  /** Directory where the installer will be downloaded. */
  downloadDir: string;
  /** Path to `CHANGELOG.md`, used to build the Nexus changelog text. */
  changelogPath: string;
  /** Release tag to publish (e.g. `v1.2.3`). */
  tag: string;
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
  /**
   * Plain-text changelog for the Nexus Mods file version, aggregated from
   * `CHANGELOG.md` across this release and the betas that preceded it.
   */
  changelog: string;
  isDraft: boolean;
  isPrerelease: boolean;
  dryRun: boolean;
}

/**
 * Validates that a GitHub release is stable (not draft, not prerelease).
 *
 * # Errors
 *
 * Throws if `release.isDraft` is `true` - draft releases cannot be published.
 * Throws if `release.isPrerelease` is `true` - betas are distributed through
 *   GitHub Releases and the auto-updater, never the Nexus Mods Upload API.
 */
export function assertStableRelease(release: GithubRelease): void {
  if (release.isDraft) {
    throw new Error(
      `Release ${release.tagName} is a draft. Undraft it first - only stable releases can be published.`,
    );
  }
  if (release.isPrerelease) {
    throw new Error(
      `Release ${release.tagName} is marked as a prerelease. Only stable releases are published to Nexus Mods.`,
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
 * Orchestrates release preparation: fetches the tagged release, validates it,
 * selects the installer, builds the Nexus changelog from `CHANGELOG.md`, and
 * downloads the installer (unless dry-run). Publishing the values as action
 * outputs is the caller's job.
 *
 * @param options - Configuration including the `ghRun` command runner and
 *   output directory.
 * @returns A {@link PublishPlan} describing the release to be uploaded.
 *
 * # Errors
 *
 * Throws if the release is a draft or prerelease (via {@link assertStableRelease}).
 * Throws if no `.exe` installer asset is found (via {@link findInstallerAsset}).
 * Throws if the version has no `CHANGELOG.md` entry (via {@link readReleaseNotes}).
 * Throws if `gh release view` fails (e.g. `gh` not authenticated or release not found).
 * Throws if `gh release download` fails (e.g. `gh` not authenticated or network error).
 */
export async function preparePublish(options: PreparePublishOptions): Promise<PublishPlan> {
  const json = options.ghRun([
    "release",
    "view",
    options.tag,
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

  // The Nexus changelog comes from CHANGELOG.md, not the GitHub release body:
  // a stable release's notes live in the beta entries below it.
  const changelog = readReleaseNotes(options.changelogPath, version);

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

  return {
    tagName: release.tagName,
    version,
    installerName: installer.name,
    installerPath,
    body: release.body,
    changelog,
    isDraft: release.isDraft,
    isPrerelease: release.isPrerelease,
    dryRun: options.dryRun,
  };
}
