import { mutationOptions } from "@tanstack/react-query";
import type { GameDomain } from "@vortex/shared";

import type { IExtensionApi } from "@/types/IExtensionContext";

import { createVortexNexusV3Client } from "../../nexusV3Client";

/** The file version to download, and where the download started. */
export interface IModFileDownloadLink {
  /** The game the file is for. */
  gameDomain: GameDomain;
  /** The file version's game-scoped id, the `file_id` in the site's URLs. */
  fileVersionId: string;
  /** The collection the download was started from, if any. */
  collectionId?: number;
}

/**
 * Signed download links for a mod file version, best CDN location first, for a user who's
 * eligible without a website key, as Premium users are. A mutation rather than a query, as
 * each ask records a download against the file: it runs only when called, is never cached, and
 * is never retried.
 */
export const modFileDownloadLinkMutation = (api: IExtensionApi) =>
  mutationOptions({
    mutationKey: ["nexus", "mod-file-versions", "download-link"] as const,
    mutationFn: ({ gameDomain, fileVersionId, collectionId }: IModFileDownloadLink) =>
      createVortexNexusV3Client(api).getModFileVersionDownloadLink(gameDomain, fileVersionId, {
        collectionId,
        applicationName: "Vortex",
      }),
  });
