import semver from "semver";

/** Oldest merger release Vortex installs. */
const RELEASE_CUTOFF = "0.6.5";

/** A release as the GitHub releases API lists it, trimmed to the fields used here. */
export interface IGithubRelease {
  tag_name: string;
  name: string;
  prerelease: boolean;
  assets: Array<{ name: string; size: number; browser_download_url: string }>;
}

export interface IMergerRelease {
  version: string;
  fileName: string;
  downloadLink: string;
  size: number;
}

/** Tags as ReleaseContract publishes them; anything else is not a merger release. */
const RELEASE_TAG = /^v(\d+\.\d+\.\d+)$/;

/** Archive name, as ReleaseContract in WitcherScriptMerger.ReleaseTools publishes it. */
function archiveName(version: string): string {
  return `WitcherScriptMerger-${version}.7z`;
}

/**
 * The newest installable merger release. The version comes from the tag:
 * release names are deliberately not versions, because older Vortex builds
 * read the name and cannot install anything newer than 0.6.5.
 */
export function latestMergerRelease(releases: IGithubRelease[]): IMergerRelease | undefined {
  let latest: IMergerRelease | undefined;
  for (const release of releases) {
    const version = semver.valid(RELEASE_TAG.exec(release.tag_name)?.[1] ?? null);
    if (release.prerelease || version === null || semver.lt(version, RELEASE_CUTOFF)) {
      continue;
    }
    const asset = release.assets.find((candidate) => candidate.name === archiveName(version));
    if (asset !== undefined && (latest === undefined || semver.gt(version, latest.version))) {
      latest = {
        version,
        fileName: asset.name,
        downloadLink: asset.browser_download_url,
        size: asset.size,
      };
    }
  }
  return latest;
}

/** Why a finished download can't be installed, or undefined when it can. */
export function mergerDownloadProblem(
  statusCode: number | undefined,
  receivedBytes: number,
  release: IMergerRelease,
): string | undefined {
  if (statusCode !== 200) {
    return `download failed with status ${statusCode}`;
  }
  if (receivedBytes !== release.size) {
    return `download size ${receivedBytes} does not match the published ${release.size}`;
  }
  return undefined;
}
