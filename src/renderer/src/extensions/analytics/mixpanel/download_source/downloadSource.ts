const VORTEX_FEATURES = ["browse", "health_check"] as const;

/** The Vortex features that send free users to the website to download mods. */
export type VortexFeature = (typeof VORTEX_FEATURES)[number];

/**
 * The features whose 1-click downloads say where they started. Health Check's aren't among them:
 * its own health_check_install_* events already bracket them.
 */
export type OneClickSource = "browse";

/**
 * Where a mod download started: Browse's 1-click, or the website after a feature's link sent the
 * user there, which the site hands back on the nxm link.
 */
export type DownloadSource = OneClickSource | `${VortexFeature}_website`;

const DOWNLOAD_SOURCES: readonly string[] = [
  "browse",
  ...VORTEX_FEATURES.map((feature): DownloadSource => `${feature}_website`),
] satisfies DownloadSource[];

/**
 * The query parameters Vortex adds to the website links it opens, and the website hands back on
 * its nxm links: the feature that sent the user, and the mod's place in that feature's list.
 */
export const SOURCE_PARAM = "source";
export const SOURCE_POSITION_PARAM = "source_position";

/** The `source` a feature adds to the website links it opens. */
export const vortexLinkSource = (feature: VortexFeature) => `vortex_${feature}`;

/** The download source for an nxm link's `source`, when a Vortex link sent the user to the site. */
export const websiteDownloadSource = (
  linkSource: string | undefined,
): DownloadSource | undefined => {
  const feature = VORTEX_FEATURES.find((candidate) => vortexLinkSource(candidate) === linkSource);

  if (!feature) {
    return undefined;
  }

  return `${feature}_website`;
};

/** The source saved on a download's mod info, or null when it has none Vortex knows. */
export const downloadSourceOf = (
  modInfo: { downloadSource?: unknown } | undefined,
): DownloadSource | null => {
  const source = modInfo?.downloadSource;

  if (typeof source !== "string" || !DOWNLOAD_SOURCES.includes(source)) {
    return null;
  }

  return source as DownloadSource;
};
