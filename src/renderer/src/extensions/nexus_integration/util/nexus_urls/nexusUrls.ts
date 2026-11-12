import type { GameDomain } from "@vortex/shared";

import { NEXUS_BASE_URL } from "../../constants";

/** A mod's page on Nexus Mods. */
export const nexusModPageUrl = (domain: GameDomain, modId: number | string) =>
  [NEXUS_BASE_URL, domain, "mods", modId].join("/");

/** A mod's page, asking the site to open its report dialog for a logged-in user. */
export const nexusModReportUrl = (domain: GameDomain, modId: number | string) =>
  `${nexusModPageUrl(domain, modId)}?report=1`;

/** A mod in Nexus Mods' site section, which isn't for a game, such as a Vortex extension. */
export const nexusSiteModPageUrl = (modId: number | string) =>
  [NEXUS_BASE_URL, "site", "mods", modId].join("/");

/**
 * A file on its mod's Files tab, where a free user downloads it. `file_id` reaches hidden mods and
 * archived files too; `nmm=1` offers it to Vortex.
 */
export const nexusFilePageUrl = (
  domain: GameDomain,
  modId: number | string,
  fileId: number | string,
) => `${nexusModPageUrl(domain, modId)}?tab=files&file_id=${fileId}&nmm=1`;

/** A mod's Files tab, where a free user picks a file to download. */
export const nexusModFilesUrl = (domain: GameDomain, modId: number | string) =>
  `${nexusModPageUrl(domain, modId)}?tab=files`;
