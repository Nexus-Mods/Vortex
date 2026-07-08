import type { nexusIdsFromDownloadId } from "../../nexus_integration/selectors";
import { makeModAndFileUIDs } from "../../nexus_integration/util/UIDs";
import type { ModAnalyticsIdentity } from "./MixpanelEvents";

/**
 * The resolved nexus identity of a download record. A collection is itself a mod, so
 * this same shape describes both a mod and a collection - we take the mod fields here.
 */
type ResolvedNexusIds = NonNullable<ReturnType<typeof nexusIdsFromDownloadId>>;

/**
 * Builds the shared per-mod analytics identity (mod/file ids + UIDs + collection_id)
 * from resolved nexus ids, so the download and install emit sites produce an identical
 * identity. `collectionId` is the parent collection when installed as part of one, else null.
 */
export function makeModAnalyticsIdentity(
  nexusIds: ResolvedNexusIds,
  collectionId: string | null,
): ModAnalyticsIdentity {
  const { modUID, fileUID } = makeModAndFileUIDs(
    nexusIds.numericGameId.toString(),
    nexusIds.modId,
    nexusIds.fileId,
  );
  return {
    mod_id: nexusIds.modId,
    file_id: nexusIds.fileId,
    game_id: nexusIds.numericGameId,
    mod_uid: modUID,
    file_uid: fileUID,
    collection_id: collectionId,
  };
}
