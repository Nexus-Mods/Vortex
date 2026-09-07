/**
 * Deterministic release resolution for the auto-updater.
 *
 * electron-updater's GitHub provider walks the releases atom feed in
 * publish-date order, so a stable hotfix published after a beta gets offered
 * to beta users as "the latest version". This module resolves the target
 * release ourselves (GitHub REST API, filter, max semver per channel) and
 * the updater is then pointed at that release's assets via a generic feed.
 *
 * Must stay loadable in plain node (vitest): no electron imports.
 */

import * as semver from "semver";

import { log } from "../../logging";

export type ResolveChannel = "stable" | "beta";

export interface GithubReleaseLite {
  tag_name: string;
  name?: string;
  draft: boolean;
  prerelease: boolean;
  published_at?: string;
  body_html?: string;
  assets: Array<{ name: string }>;
}

export interface ResolvedRelease {
  tag: string;
  version: string;
  prerelease: boolean;
  downloadBaseUrl: string;
  notesHtml?: string;
}

export class RateLimitError extends Error {
  constructor(public readonly resetAt: Date) {
    super(`GitHub API rate limit exceeded, resets at ${resetAt.toISOString()}`);
    this.name = "RateLimitError";
  }
}

const OWNER = "Nexus-Mods";
const MAX_PAGES = 3;
const INSTALLER_ASSET = /^vortex-setup-.*\.exe$/i;

// Overridable so tests and the mock update feed can stand in for GitHub.
function apiBase(): string {
  return process.env.VORTEX_UPDATER_API_BASE || "https://api.github.com";
}

function downloadBase(): string {
  return process.env.VORTEX_UPDATER_DOWNLOAD_BASE || "https://github.com";
}

export function repoForChannel(): string {
  // Test override ("owner/repo"): lets the staging rehearsal run against a
  // scratch repo with real GitHub semantics instead of the live repos (see
  // docs/updater-testing.md and scripts/updater-e2e-staging.mjs).
  const override = process.env.VORTEX_UPDATER_REPO;
  if (override != null && override !== "") {
    return override.includes("/") ? override.split("/")[1]! : override;
  }
  return "Vortex";
}

export function repoOwner(): string {
  const override = process.env.VORTEX_UPDATER_REPO;
  if (override != null && override.includes("/")) {
    return override.split("/")[0]!;
  }
  return OWNER;
}

// Build metadata compares equal under semver (2.5.0+build == 2.5.0); ties in
// pickRelease keep the first-seen release. Vortex doesn't tag with metadata.
function versionFromTag(tag: string): string | null {
  return semver.valid(tag.replace(/^v/, ""));
}

// The prerelease flag and the version suffix are two signals for the same
// fact; when they disagree the release was mispublished, don't trust it.
// (The whole 1.x era trips this: odd-minor betas were flagged prerelease with
// no version suffix, so this is summarized once per fetch, not warned per tag.)
function hasMismatchedPrereleaseFlag(release: GithubReleaseLite): boolean {
  const version = versionFromTag(release.tag_name);
  return version != null && release.prerelease !== (semver.prerelease(version) != null);
}

function isEligible(release: GithubReleaseLite): boolean {
  if (release.draft) {
    return false;
  }
  if (versionFromTag(release.tag_name) == null) {
    return false;
  }
  const hasUpdateAssets = release.assets.some(
    (asset) => asset.name === "latest.yml" || INSTALLER_ASSET.test(asset.name),
  );
  if (!hasUpdateAssets) {
    return false;
  }
  return !hasMismatchedPrereleaseFlag(release);
}

function candidatesForChannel(
  releases: GithubReleaseLite[],
  channel: ResolveChannel,
): GithubReleaseLite[] {
  const eligible = releases.filter(isEligible);
  // beta/next take everything: a newer stable beats an older beta.
  return channel === "stable" ? eligible.filter((release) => !release.prerelease) : eligible;
}

/**
 * Pick the target release for a channel: max semver among eligible
 * candidates. Never depends on array order or publish dates.
 */
export function pickRelease(
  releases: GithubReleaseLite[],
  channel: ResolveChannel,
): GithubReleaseLite | null {
  let best: GithubReleaseLite | null = null;
  let bestVersion: string | null = null;
  for (const release of candidatesForChannel(releases, channel)) {
    const version = versionFromTag(release.tag_name)!;
    if (bestVersion == null || semver.gt(version, bestVersion)) {
      best = release;
      bestVersion = version;
    }
  }
  return best;
}

/**
 * Classify what the resolved version means relative to the running version.
 * A lower version is only ever surfaced as a "downgrade-offer" when the user
 * explicitly switched to the stable channel; background checks ignore it;
 * offering it unasked is the old field bug.
 */
export function classifyUpdate(
  currentVersion: string,
  resolvedVersion: string | null,
  opts: { switchToStable: boolean },
): "upgrade" | "downgrade-offer" | "none" {
  const current = semver.valid(currentVersion);
  if (current == null) {
    log("warn", "Current version is not valid semver", { currentVersion });
    return "none";
  }
  if (resolvedVersion == null || semver.eq(resolvedVersion, current)) {
    return "none";
  }
  if (semver.gt(resolvedVersion, current)) {
    return "upgrade";
  }
  return opts.switchToStable ? "downgrade-offer" : "none";
}

/**
 * Patch-level updates auto-download for regular installs; minor/major wait
 * for the user. Same gate the updater has always applied.
 */
export function shouldAutoDownload(
  currentVersion: string,
  targetVersion: string,
  installType: string,
): boolean {
  return (
    installType === "regular" &&
    semver.gt(targetVersion, currentVersion) &&
    semver.satisfies(targetVersion, `~${currentVersion}`, { includePrerelease: true })
  );
}

interface CacheEntry {
  etag: string;
  body: string;
  linkHeader: string | null;
}

const etagCache = new Map<string, CacheEntry>();
let rateLimitedUntil: Date | null = null;

export function _resetCacheForTests(): void {
  etagCache.clear();
  rateLimitedUntil = null;
}

async function fetchPage(url: string): Promise<{ body: string; linkHeader: string | null }> {
  if (rateLimitedUntil != null) {
    if (Date.now() < rateLimitedUntil.getTime()) {
      throw new RateLimitError(rateLimitedUntil);
    }
    rateLimitedUntil = null;
  }

  const cached = etagCache.get(url);
  const headers: Record<string, string> = {
    accept: "application/vnd.github.html+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "Vortex",
  };
  if (cached != null) {
    headers["if-none-match"] = cached.etag;
  }

  const response = await fetch(url, { headers });

  if (response.status === 304 && cached != null) {
    return { body: cached.body, linkHeader: response.headers.get("link") ?? cached.linkHeader };
  }

  if (
    (response.status === 403 || response.status === 429) &&
    response.headers.get("x-ratelimit-remaining") === "0"
  ) {
    // A proxy or mock feed can send a garbage reset header; NaN or 0 would
    // produce an Invalid Date (whose toISOString throws) or a 1970 reset that
    // never short-circuits. Fall back to a minute in either case.
    const parsed = Number(response.headers.get("x-ratelimit-reset"));
    const resetAt =
      Number.isFinite(parsed) && parsed > 0
        ? new Date(parsed * 1000)
        : new Date(Date.now() + 60_000);
    rateLimitedUntil = resetAt;
    throw new RateLimitError(resetAt);
  }

  if (!response.ok) {
    const snippet = (await response.text()).slice(0, 200);
    throw new Error(`Release feed request failed with status ${response.status}: ${snippet}`);
  }

  const body = await response.text();
  const etag = response.headers.get("etag");
  const linkHeader = response.headers.get("link");
  if (etag != null) {
    etagCache.set(url, { etag, body, linkHeader });
  }
  return { body, linkHeader };
}

function nextPageUrl(linkHeader: string | null): string | null {
  if (linkHeader == null) {
    return null;
  }
  for (const part of linkHeader.split(",")) {
    const match = /<([^>]+)>\s*;\s*rel="next"/.exec(part);
    if (match?.[1] != null) {
      return match[1];
    }
  }
  return null;
}

async function fetchReleases(repo: string): Promise<GithubReleaseLite[]> {
  const releases: GithubReleaseLite[] = [];
  let url: string | null = `${apiBase()}/repos/${repoOwner()}/${repo}/releases?per_page=100`;
  let pages = 0;

  while (url != null && pages < MAX_PAGES) {
    const { body, linkHeader } = await fetchPage(url);
    let page: unknown;
    try {
      page = JSON.parse(body);
    } catch {
      throw new Error("Release feed returned malformed JSON");
    }
    if (!Array.isArray(page)) {
      throw new Error("Release feed returned an unexpected shape");
    }
    releases.push(...(page as GithubReleaseLite[]));
    pages += 1;
    url = nextPageUrl(linkHeader);
  }

  if (url != null) {
    // expected on the main repo (300+ historical releases); newest releases
    // are always on page 1, so this never affects the max-semver pick
    log("debug", "Release listing truncated at page cap", { repo, pages });
  }

  const mismatched = releases.filter(hasMismatchedPrereleaseFlag);
  if (mismatched.length > 0) {
    log("info", "Skipping releases whose prerelease flag disagrees with the version suffix", {
      repo,
      count: mismatched.length,
      sample: mismatched.slice(0, 3).map((release) => release.tag_name),
    });
  }

  return releases;
}

// The What's New dialog shows the notes of every release the update spans, so
// each body needs a version heading of its own; without one the bodies run
// together and the reader can't tell which change came in which release. The
// version is validated semver and the date is ours, so neither can inject
// markup into the dialog's innerHTML.
function releaseSection(version: string, body: string, publishedAt?: string): string {
  const published =
    publishedAt != null && !Number.isNaN(Date.parse(publishedAt))
      ? `<span class="changelog-release-date">${formatReleaseDate(publishedAt)}</span>`
      : "";
  return [
    `<section class="changelog-release">`,
    `<h4 class="changelog-release-version">${version}${published}</h4>`,
    `<div class="changelog-release-body">${body}</div>`,
    `</section>`,
  ].join("");
}

function formatReleaseDate(publishedAt: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(publishedAt));
}

/**
 * Resolve the update target for a channel. Returns null when no eligible
 * release exists. Network and rate-limit errors propagate, the caller logs
 * and skips the check, same as being offline.
 */
export async function resolveUpdate(
  channel: ResolveChannel,
  currentVersion: string,
): Promise<ResolvedRelease | null> {
  const repo = repoForChannel();
  const releases = await fetchReleases(repo);
  const picked = pickRelease(releases, channel);
  if (picked == null) {
    return null;
  }
  const pickedVersion = versionFromTag(picked.tag_name)!;

  const current = semver.valid(currentVersion);
  const notes = candidatesForChannel(releases, channel)
    .map((release) => ({ release, version: versionFromTag(release.tag_name)! }))
    .filter(
      ({ version }) =>
        current != null && semver.gt(version, current) && semver.lte(version, pickedVersion),
    )
    .sort((lhs, rhs) => semver.rcompare(lhs.version, rhs.version))
    .flatMap(({ release, version }) =>
      release.body_html != null && release.body_html.trim().length > 0
        ? [releaseSection(version, release.body_html, release.published_at)]
        : [],
    );

  return {
    tag: picked.tag_name,
    version: pickedVersion,
    prerelease: picked.prerelease,
    downloadBaseUrl: `${downloadBase()}/${repoOwner()}/${repo}/releases/download/${picked.tag_name}`,
    notesHtml: notes.length > 0 ? notes.join("\n\n") : undefined,
  };
}
