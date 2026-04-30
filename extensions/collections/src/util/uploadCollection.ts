import { selectors, types, util } from "vortex-api";

import { doExportToAPI } from "../collectionExport";
import { TOS_URL } from "../constants";

export async function uploadCollection(
  api: types.IExtensionApi,
  profileId: string,
  collectionId: string,
) {
  if (!profileId || !collectionId) {
    return;
  }
  const state = api.getState();
  const profile = selectors.profileById(state, profileId);
  const userInfo = util.getSafe(
    state,
    ["persistent", "nexus", "userInfo"],
    undefined,
  );
  if (userInfo === undefined) {
    api.showErrorNotification(
      "Not logged in",
      "You have to be logged into nexusmods.com to upload collections.",
    );
    return;
  }
  const mods: { [modId: string]: types.IMod } = util.getSafe(
    state,
    ["persistent", "mods", profile.gameId],
    {},
  );
  if (mods[collectionId] === undefined) {
    return;
  }

  // Make sure the mod conflicts are up to date and block upload if there are any outstanding.
  await api.emitAndAwait("update-conflicts-and-rules", false);
  const conflictsDetected = util.getSafe(
    api.store.getState(),
    ["session", "dependencies", "hasUnsolvedConflicts"],
    false,
  );
  if (conflictsDetected) {
    await api.showDialog(
      "error",
      "Resolve conflicts before uploading",
      {
        text:
          "You have unresolved mod conflicts in your current mods setup. Please resolve them before " +
          "uploading a collection.",
      },
      [{ label: "Close" }],
    );
    return;
  }

  api.events.emit(
    "analytics-track-click-event",
    "Collections",
    "Upload collection",
  );

  const missing = (mods[collectionId]?.rules ?? []).filter(
    (rule) =>
      ["requires", "recommends"].includes(rule.type) &&
      util.findModByRef(rule.reference, mods) === undefined,
  );
  if (missing.length > 0) {
    await api.showDialog(
      "error",
      "Collection isn't fully installed",
      {
        text:
          "You can only upload collections that are fully installed on this system.\n" +
          "If you have removed mods that were part of this collection you may want to remove " +
          "them from the collection as well. If this collection is connected to a " +
          "profile you can simply update from that.",
        message: missing
          .map((rule) => util.renderModReference(rule.reference))
          .join("\n"),
      },
      [{ label: "Close" }],
    );
    return;
  }

  const choice = await api.showDialog(
    "question",
    "Share on Nexus Mods",
    {
      bbcode:
        'You are about to upload "{{collectionName}}" to Nexus Mods in a draft state. ' +
        "You will be able to add additional metadata and media before sharing it with " +
        "the community." +
        "\n\n" +
        "Please ensure that your collection complies with our " +
        `[url=${TOS_URL}]Collections Guidelines[/url] before publishing.`,
      parameters: {
        collectionName: util.renderModName(mods[collectionId]),
      },
    },
    [{ label: "Cancel" }, { label: "Upload" }],
  );

  if (choice.action === "Upload") {
    try {
      const { slug, revisionNumber } = await doExportToAPI(
        api,
        profile.gameId,
        collectionId,
        userInfo.name,
      );
      if (slug !== undefined && revisionNumber !== undefined) {
        api.sendNotification({
          type: "success",
          message: "Collection submitted",
          actions: [
            {
              title: "Open in Browser",
              action: () => {
                const game = selectors.gameById(api.getState(), profile.gameId);
                const domainName = util.nexusGameId(game);
                const url = util.nexusModsURL(
                  [
                    domainName,
                    "collections",
                    slug,
                    "revisions",
                    revisionNumber.toString(),
                  ],
                  {
                    campaign: util.Campaign.GeneralNavigation,
                    section: util.Section.Collections,
                  },
                );
                util.opn(url).catch(() => null);
              },
            },
          ],
        });
      }
    } catch (err) {
      if (
        !(err instanceof util.UserCanceled) &&
        !(err instanceof util.ProcessCanceled)
      ) {
        api.showErrorNotification("Failed to upload to API", err, {
          allowReport: false,
        });
      }
    }
  }
}
