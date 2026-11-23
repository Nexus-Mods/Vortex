import type { NexusGameDomain } from "@vortex/shared";

import {
  type VortexFeature,
  vortexLinkSource,
} from "@/extensions/analytics/mixpanel/download_source/downloadSource";

import { NEXUS_BASE_URL } from "../../constants";

/** A mod's page on Nexus Mods. */
export const nexusModPageUrl = (domain: NexusGameDomain, modId: number | string) =>
  [NEXUS_BASE_URL, domain, "mods", modId].join("/");

/** A mod's page, asking the site to open its report dialog for a logged-in user. */
export const nexusModReportUrl = (domain: NexusGameDomain, modId: number | string) =>
  `${nexusModPageUrl(domain, modId)}?report=1`;

/** A mod in Nexus Mods' site section, which isn't for a game, such as a Vortex extension. */
export const nexusSiteModPageUrl = (modId: number | string) =>
  [NEXUS_BASE_URL, "site", "mods", modId].join("/");

/**
 * A file on its mod's Files tab, where a free user downloads it. `file_id` reaches hidden mods and
 * archived files too; `nmm=1` offers it to Vortex.
 */
export const nexusFilePageUrl = (
  domain: NexusGameDomain,
  modId: number | string,
  fileId: number | string,
) => `${nexusModPageUrl(domain, modId)}?tab=files&file_id=${fileId}&nmm=1`;

/** A mod's Files tab, where a free user picks a file to download. */
export const nexusModFilesUrl = (domain: NexusGameDomain, modId: number | string) =>
  `${nexusModPageUrl(domain, modId)}?tab=files`;

/** A mod's Posts tab, where its comments are. */
export const nexusModCommentsUrl = (domain: NexusGameDomain, modId: number | string) =>
  `${nexusModPageUrl(domain, modId)}?tab=posts`;

/** A website link, and the Vortex feature sending the user to it. */
interface IVortexSourceLink {
  /** The website link. */
  url: string;
  /** The feature sending the user. */
  feature: VortexFeature;
  /** The mod's position in the feature's list, counting from 1, when it has one. */
  position?: number;
}

/**
 * A website link saying which Vortex feature sent the user, and the mod's position in its list,
 * for the site to attribute the download it leads to.
 */
export const withVortexSource = ({ url, feature, position }: IVortexSourceLink) => {
  const withSource = new URL(url);
  withSource.searchParams.set("source", vortexLinkSource(feature));

  if (position) {
    withSource.searchParams.set("source_position", String(position));
  }

  return withSource.toString();
};
