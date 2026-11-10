import type { ICollection } from "@nexusmods/nexus-api";
import { VortexError } from "@vortex/shared";
import { useSelector } from "react-redux";

import { CollectionsDownloadClickedEvent } from "@/extensions/analytics/mixpanel/MixpanelEvents";
import { buildNXMCollectionUrl } from "@/extensions/nexus_integration/NXMUrl";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { activeGameId } from "@/util/selectors";

async function adultContentDialog(
  api: IExtensionApi,
  collection: ICollection,
  adultContent: boolean,
): Promise<boolean> {
  try {
    const result = await api.showDialog(
      "question",
      "Adult content warning",
      {
        bbcode: api.translate(
          `The collection "[b]{{collectionName}}[/b]" has been classified as adult content because it contains: nudity, sexualisation, extreme violence and gore, or excessive profanity.<br/><br/>` +
            `Your site preferences are set to hide adult content, you can update your preferences on the Nexus Mods website.`,
          { replace: { collectionName: collection.name } },
        ),
      },
      [{ label: api.translate("Cancel") }, { label: api.translate("Open site preferences") }],
    );
    return result.action !== "Cancel";
  } catch {
    return adultContent;
  }
}

/**
 * Adding a listed collection to the active game: downloads its latest revision, or, for adult
 * content the user's site preferences hide, offers to change them.
 */
export const useAddCollection = (api: IExtensionApi) => {
  const gameId = useSelector((state: IState) => activeGameId(state));
  const adultContentFilter = useSelector(
    (state: IState) => state.persistent["nexus"]?.userInfo?.adult,
  );

  return (collection: ICollection) => {
    const revisionNumber = collection.latestPublishedRevision?.revisionNumber || "latest";
    // Use the game domain name from the collection data (already converted)
    const nxmUrl = buildNXMCollectionUrl(
      collection.game.domainName,
      collection.slug,
      revisionNumber,
    );

    api.events.emit(
      "analytics-track-mixpanel-event",
      new CollectionsDownloadClickedEvent(collection.slug, collection.game.id),
    );

    if (adultContentFilter === false && collection.latestPublishedRevision?.adultContent) {
      void adultContentDialog(api, collection, false).then((proceed) => {
        if (proceed) {
          window.api.shell.openUrl("https://next.nexusmods.com/settings/content-blocking");
        }
      });
    } else {
      // Populate modInfo.nexus.ids so the persisted download is recognised as
      // a collection by `nexusIdsFromDownloadId` — without these fields the
      // download-completed analytics in DownloadObserver can't tell it apart
      // from a non-Nexus download and silently skips the event.
      api.events.emit(
        "start-download",
        [nxmUrl],
        {
          game: gameId,
          source: "nexus",
          name: collection.name,
          nexus: {
            ids: {
              gameId: collection.game.domainName,
              collectionId: collection.id,
              revisionId: collection.latestPublishedRevision?.id,
              collectionSlug: collection.slug,
              revisionNumber: collection.latestPublishedRevision?.revisionNumber,
            },
          },
        },
        undefined,
        (err: Error) => {
          if (err && !(err instanceof VortexError && err.data.kind === "user-canceled")) {
            api.showErrorNotification("Failed to add collection", err);
          }
        },
        undefined,
        { allowInstall: "force" },
      );
    }
  };
};
