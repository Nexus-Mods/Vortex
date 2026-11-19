import type { NexusGameDomain } from "@vortex/shared";

import { gameById } from "@/extensions/gamemode_management/selectors";
import type { IMod } from "@/extensions/mod_management/types/IMod";
import type { IState } from "@/types/IState";

import { NEXUS_BASE_URL } from "../../constants";
import { nexusGameId } from "../convertGameId";

/** A mod's page on Nexus Mods. */
export const nexusModPageUrl = (domain: NexusGameDomain, modId: number | string) =>
  [NEXUS_BASE_URL, domain, "mods", modId].join("/");

/**
 * One of the user's mods' page: in the section it was downloaded for, else the active game's;
 * a collection's by its slug.
 */
export const nexusModPageUrlOf = (state: IState, mod: IMod, gameMode: string) => {
  const vortexGameId = mod.attributes?.downloadGame || gameMode;
  const domain = nexusGameId(gameById(state, vortexGameId), vortexGameId);
  if (mod.attributes?.collectionSlug !== undefined) {
    return `${NEXUS_BASE_URL}/${domain}/mods/${mod.attributes.collectionSlug}`;
  }
  return nexusModPageUrl(domain, parseInt(String(mod.attributes?.modId), 10));
};

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
