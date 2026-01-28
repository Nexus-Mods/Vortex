/* eslint-disable */
import Bluebird from "bluebird";
import { createHash } from "crypto";
import {
  ICollectionPermission,
  CollectionPermission,
  ICollection,
} from "@nexusmods/nexus-api";
import { selectors, types, util } from "vortex-api";
import { doExportToAPI } from "../collectionExport";
import { ICollectionModRuleEx } from "../types/ICollection";
import { IEntryEx } from "../types/IEntryEx";
import { IModEx } from "../types/IModEx";
import { fileMD5 } from "vortexmt";
import turbowalk, { IEntry, IWalkOptions } from "turbowalk";
import { TOS_URL } from "../constants";

export function hasEditPermissions(
  permissions: ICollectionPermission[],
): boolean {
  if (!permissions) {
    return false;
  }
  const allPermissions: CollectionPermission[] = permissions.map(
    (perm) => perm.key as CollectionPermission,
  );
  return allPermissions.includes("collection:edit");
}

export function makeProgressFunction(api: types.IExtensionApi) {
  const notificationId = api.sendNotification({
    type: "activity",
    title: "Building Collection",
    message: "",
    progress: 0,
  });

  let notiPerc = 0;
  let notiText = "";

  const items: Set<string> = new Set();

  const progress = (percent?: number, text?: string) => {
    let change = false;
    if (percent !== undefined) {
      if (percent > notiPerc) {
        change = true;
        notiPerc = percent;
      }
      if (text !== undefined) {
        items.delete(text);
        if (items.size > 0) {
          const itemList = Array.from(items);
          const newText = itemList[itemList.length - 1];
          if (newText !== notiText) {
            change = true;
            notiText = newText;
          }
        }
      }
    }
    if (percent === undefined && text !== undefined && text !== notiText) {
      change = true;
      notiText = text;
      if (percent === undefined) {
        items.add(text);
      }
    }

    if (change) {
      api.sendNotification({
        id: notificationId,
        type: "activity",
        title: "Building Collection",
        progress: notiPerc,
        message: notiText,
      });
    }
  };

  const progressEnd = () => {
    api.dismissNotification(notificationId);
  };

  return { progress, progressEnd };
}

export function bbProm<T>(
  func: (...args: any[]) => Promise<T>,
): (...args: any[]) => Bluebird<T> {
  return (...args: any[]) => Bluebird.resolve(func(...args));
}

export function getUnfulfilledNotificationId(collectionId: string) {
  return `collection-incomplete-${collectionId}`;
}

export function md5sum(input: string): string {
  const hash = createHash("md5");
  hash.update(input);
  return hash.digest("hex");
}

export function renderReference(
  ref: types.IModReference,
  mods: { [modId: string]: types.IMod },
): string {
  const mod = util.findModByRef(ref, mods);
  return util.renderModReference(ref, mod);
}

export function ruleId(rule: ICollectionModRuleEx): string {
  // md5-hashing to prevent excessive id names and special characters as a key
  // in application state
  return md5sum(`${rule.sourceName}-${rule.type}-${rule.referenceName}`);
}

export function isRelevant(mod: IModEx) {
  if (!!mod.state) {
    // consider any mod that's already being downloaded/installed
    return true;
  }
  if (mod.collectionRule["ignored"]) {
    return false;
  }
  if (mod.collectionRule.type !== "requires") {
    return false;
  }

  return true;
}

export type IModWithRule = types.IMod & { collectionRule: types.IModRule };

export function calculateCollectionSize(mods: {
  [id: string]: IModWithRule;
}): number {
  return Object.values(mods).reduce((prev: number, mod: IModEx) => {
    if (!isRelevant(mod)) {
      return prev;
    }
    const size =
      mod.attributes?.fileSize ?? mod.collectionRule.reference.fileSize ?? 0;
    return prev + size;
  }, 0);
}

export async function fileMD5Async(fileName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fileMD5(
      fileName,
      (err: Error, result: string) =>
        err !== null ? reject(err) : resolve(result),
      () => null,
    );
  });
}

export async function walkPath(
  dirPath: string,
  walkOptions?: IWalkOptions,
): Promise<IEntryEx[]> {
  walkOptions = walkOptions || {
    skipLinks: true,
    skipHidden: true,
    skipInaccessible: true,
  };
  const walkResults: IEntryEx[] = [];
  return new Promise<IEntryEx[]>(async (resolve, reject) => {
    await turbowalk(
      dirPath,
      async (entries: IEntry[]) => {
        for (const entry of entries) {
          const md5 = await fileMD5Async(entry.filePath);
          const extendedEntry: IEntryEx = { ...entry, fileMD5: md5 };
          walkResults.push(extendedEntry);
        }
        return Promise.resolve();
      },
      walkOptions,
    ).catch((err) =>
      err.code === "ENOENT" ? Promise.resolve() : Promise.reject(err),
    );
    return resolve(walkResults);
  });
}

export function isEmpty(value: any) {
  return (
    !value ||
    (value.hasOwnProperty("length") && value.length === 0) ||
    (value.constructor === Object && Object.keys(value).length === 0)
  );
}

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
