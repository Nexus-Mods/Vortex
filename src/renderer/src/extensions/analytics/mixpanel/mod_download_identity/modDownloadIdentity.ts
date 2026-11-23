import type { IDownload } from "../../../download_management/types/IDownload";
import { downloadSourceOf } from "../download_source/downloadSource";
import type { ModDownloadIdentity } from "../MixpanelEvents";
import { makeModAnalyticsIdentity, type ModNexusIds } from "../modAnalyticsIdentity";

/** A mod's download, as its analytics identity is made from. */
interface IModDownload {
  /** The mod and file the download is of. */
  nexusIds: ModNexusIds;
  /** The download's record, when Vortex has one. */
  download: Pick<IDownload, "modInfo"> | undefined;
}

/**
 * The analytics identity of a mod's download, and of the install from it, from what its download
 * record saved: the collection it was part of, and where it started. With no record, it has
 * neither.
 */
export function makeModDownloadIdentity({ nexusIds, download }: IModDownload): ModDownloadIdentity {
  const parent = download?.modInfo?.nexus;

  return {
    ...makeModAnalyticsIdentity(
      nexusIds,
      parent?.parentCollectionId ?? null,
      parent?.parentRevisionId ?? null,
    ),
    download_source: downloadSourceOf(download?.modInfo),
  };
}
