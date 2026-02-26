/* eslint-disable */
import { clearPendingVote, updateSuccessRate } from "./actions/persistent";
import persistentReducer from "./reducers/persistent";
import sessionReducer from "./reducers/session";
import settingsReducer from "./reducers/settings";
import trackingReducer from "./reducers/installTracking";
import { ICollection } from "./types/ICollection";
import { IExtendedInterfaceProps } from "./types/IExtendedInterfaceProps";
import { genDefaultsAction } from "./util/defaults";
import { addExtension } from "./util/extension";
import InstallDriver from "./util/InstallDriver";
import {
  cloneCollection,
  createCollection,
  makeCollectionId,
} from "./util/transformCollection";
import { bbProm, getUnfulfilledNotificationId } from "./util/util";
import AddModsDialog from "./views/AddModsDialog";
import HealthDownvoteDialog from "./views/CollectionPageView/HealthDownvoteDialog";
import CollectionsMainPage from "./views/CollectionList";
import {
  InstallChangelogDialog,
  InstallFinishDialog,
  InstallStartDialog,
} from "./views/InstallDialog";

import { getActiveInstallSession } from "./util/selectors";

import { IPathTools } from "./views/CollectionPageEdit/FileOverrides";

import CollectionAttributeRenderer from "./views/CollectionModsPageAttributeRenderer";

import {
  addCollectionAction,
  addCollectionCondition,
  alreadyIncluded,
  initFromProfile,
  removeCollectionAction,
  removeCollectionCondition,
} from "./collectionCreate";
import {
  makeInstall,
  postprocessCollection,
  testSupported,
} from "./collectionInstall";
import {
  DELAY_FIRST_VOTE_REQUEST,
  INSTALLING_NOTIFICATION_ID,
  MOD_TYPE,
  TIME_BEFORE_VOTE,
} from "./constants";
import { onCollectionUpdate } from "./eventHandlers";
import initIniTweaks from "./initweaks";
import initTools from "./tools";

import * as nexusApi from "@nexusmods/nexus-api";
import Bluebird from "bluebird";
import * as _ from "lodash";
import memoize from "memoize-one";
import * as path from "path";
import * as React from "react";
import * as Redux from "redux";
import { generate as shortid } from "shortid";
import { pathToFileURL } from "url";
import {
  actions,
  log,
  OptionsFilter,
  selectors,
  types,
  util,
} from "vortex-api";
import { IRevision } from "@nexusmods/nexus-api";
import { readCollection } from "./util/importCollection";

// TODO: Import from vortex-api once the dependency is updated
/** Collection icon (single) - stacked triangles */
export const nxmCollection =
  "M11.7229 15.369L6.21146 11.084L5 12.0262L11.7304 17.261L18.4607 12.0262L17.2418 11.0765L11.7229 15.369ZM11.7229 19.1079L6.21146 14.823L5 15.7652L11.7304 20.9999L18.4607 15.7652L17.2418 14.8155L11.7229 19.1079ZM11.7304 13.4694L17.2343 9.18445L18.4607 8.23472L11.7304 3L5 8.23472L6.21894 9.18445L11.7304 13.4694Z";

function isEditableCollection(state: types.IState, modIds: string[]): boolean {
  const gameMode = selectors.activeGameId(state);
  const mod = state.persistent.mods[gameMode][modIds[0]];
  if (mod === undefined) {
    return false;
  }
  return util.getSafe(mod.attributes, ["editable"], false);
}

function profileCollectionExists(api: types.IExtensionApi, profileId: string) {
  const state = api.store.getState();
  const gameMode = selectors.activeGameId(state);
  const mods = state.persistent.mods[gameMode];
  return mods[makeCollectionId(profileId)] !== undefined;
}

function onlyLocalRules(rule: types.IModRule) {
  return (
    ["requires", "recommends"].includes(rule.type) &&
    rule.reference.fileExpression === undefined &&
    rule.reference.fileMD5 === undefined &&
    rule.reference.logicalFileName === undefined &&
    rule.reference.repo === undefined
  );
}

const modsBeingRemoved = new Set<string>();

function makeModKey(gameId: string, modId: string): string {
  return `${gameId}_${modId}`;
}

function makeWillRemoveMods(api: types.IExtensionApi) {
  return (gameId: string, modIds: string[]) => {
    const state = api.getState();
    const mods = state.persistent.mods[gameId];
    const collections = Object.values(mods).filter(
      (mod) => mod.type === MOD_TYPE,
    );
    collections.forEach((coll) =>
      api.dismissNotification(getUnfulfilledNotificationId(coll.id)),
    );
    modIds.forEach((modId) => modsBeingRemoved.add(makeModKey(gameId, modId)));
    return Promise.resolve();
  };
}

function makeDidRemoveMods() {
  return (gameId: string, modIds: string[]) => {
    modIds.forEach((modId) =>
      modsBeingRemoved.delete(makeModKey(gameId, modId)),
    );
    return Promise.resolve();
  };
}

function makeOnUnfulfilledRules(api: types.IExtensionApi) {
  const reported = new Set<string>();

  return (
    profileId: string,
    modId: string,
    rules: types.IModRule[],
  ): Bluebird<boolean> => {
    const state: types.IState = api.store.getState();

    const profile = selectors.profileById(state, profileId);
    const gameId = profile.gameId;
    if (gameId !== selectors.activeGameId(state)) {
      return Bluebird.resolve(false);
    }

    if (modsBeingRemoved.has(makeModKey(gameId, modId))) {
      return Bluebird.resolve(false);
    }

    const collection: types.IMod = util.getSafe(
      state.persistent.mods,
      [gameId, modId],
      undefined,
    );

    if (
      collection !== undefined &&
      !reported.has(modId) &&
      state.persistent.mods[gameId][modId].type === MOD_TYPE &&
      !collection.attributes?.editable
    ) {
      const collectionProfile = Object.keys(state.persistent.profiles).find(
        (iter) => makeCollectionId(iter) === modId,
      );

      const notiActions = [
        {
          title: "Disable",
          action: (dismiss) => {
            dismiss();
            if (profile !== undefined) {
              api.store.dispatch(
                actions.setModEnabled(profile.id, modId, false),
              );
            }
          },
        },
      ];

      if (collectionProfile !== undefined) {
        // with local collections that we sync with a profile, we wouldn't be able to
        // installing the missing dependencies because the dependencies are referenced via
        // their local id.
        notiActions.unshift({
          title: "Update",
          action: (dismiss) => {
            initFromProfile(api, collectionProfile)
              .then(dismiss)
              .catch((err) =>
                api.showErrorNotification("Failed to update collection", err),
              );
          },
        });
      } else if (profile !== undefined) {
        notiActions.unshift({
          title: "Resume",
          action: (dismiss) => {
            driver.start(profile, collection);
            dismiss();
          },
        });
      }

      reported.add(modId);

      api.sendNotification({
        id: getUnfulfilledNotificationId(collection.id),
        type: "info",
        title: "Collection incomplete",
        message: util.renderModName(collection),
        actions: notiActions,
      });
      return Bluebird.resolve(true);
    } else {
      return Bluebird.resolve(false);
    }
  };
}

let driver: InstallDriver;

async function cloneInstalledCollection(
  api: types.IExtensionApi,
  collectionId: string,
): Promise<string> {
  const state = api.getState();
  const gameMode = selectors.activeGameId(state);
  const mods = state.persistent.mods[gameMode];

  const result: types.IDialogResult = await api.showDialog(
    "question",
    'Clone collection "{{collectionName}}"?',
    {
      text:
        "Cloning a collection means you can make edits to the collection in the workshop " +
        "and share your changes with the community.\n" +
        "If this collection is your own, your uploads will be revisions of that existing " +
        "collection, otherwise you will create a new collection associated with your own " +
        "account.",
      parameters: {
        collectionName: util.renderModName(mods[collectionId]),
      },
    },
    [{ label: "Cancel" }, { label: "Clone" }],
  );

  if (result.action === "Clone") {
    await updateMeta(api, collectionId);
    const id = makeCollectionId(shortid());
    return cloneCollection(api, gameMode, id, collectionId);
  } else {
    return Promise.resolve(undefined);
  }
}

async function createNewCollection(
  api: types.IExtensionApi,
  profile: types.IProfile,
  name: string,
) {
  const id = makeCollectionId(shortid());
  await createCollection(api, profile.gameId, id, name, []);

  const state = api.store.getState();
  const game = selectors.gameById(state, profile.gameId);
  const userInfo = state.persistent["nexus"]?.userInfo;
  if (userInfo?.userId) {
    api.events.emit("analytics-track-mixpanel-event", {
      eventName: "collection_drafted",
      properties: {
        collection_name: name,
        game_name: game.name,
        creation_method: "empty",
      },
    });
  }

  api.sendNotification({
    type: "success",
    id: "collection-created",
    title: "Collection created",
    message: name,
    actions: [
      {
        title: "Edit",
        action: (dismiss) => {
          api.events.emit("edit-collection", id);
          dismiss();
        },
      },
    ],
  });
}

async function installCollection(
  api: types.IExtensionApi,
  revision: IRevision,
) {
  return api
    .showDialog(
      "question",
      "Collection not installed",
      {
        text:
          "You can only edit collections that are fully installed in this " +
          "setup. Please ensure you install the collection with all " +
          "optional items, then clone the collection into the Workshop.",
      },
      [{ label: "Cancel" }, { label: "Install" }],
    )
    .then((result) => {
      if (result.action === "Install") {
        const gameId = revision.collection.game.domainName;
        api.events.emit(
          "start-download",
          [
            `nxm://${gameId}/collections/${revision.collection.slug}/revisions/${revision.revisionNumber}`,
          ],
          {},
          undefined,
          (err) => {
            if (err !== null && !(err instanceof util.UserCanceled)) {
              api.showErrorNotification("Failed to download collection", err);
            }
          },
          undefined,
          { allowInstall: "force" },
        );
      }
    });
}

async function pauseCollection(
  api: types.IExtensionApi,
  gameId: string,
  modId: string,
  silent?: boolean,
) {
  const state = api.getState();
  const mods = state.persistent.mods[gameId];
  const downloads = state.persistent.downloads.files;

  const collection = mods[modId];
  if (collection === undefined) {
    return;
  }

  (collection?.rules ?? []).forEach((rule) => {
    // findDownloadByRef has been modified to omit these fields as well, BUT, the vortex-api
    //  types don't reflect that change currently. The API submodule needs a complete cleanup
    //  before we can update the dependency and given the massive changes we've been making
    //  to the codebase recently + the imminent 1.16 stable release - updating the API submodule
    //  is not worth the risk at this moment, so will just omit the fields here as well.
    // TODO: update the vortex-api types and remove the omit when we update the dependency.
    const cleanReference = _.omit(rule.reference, [
      "installerChoices",
      "fileList",
      "patches",
    ]);
    const dlId = util.findDownloadByRef(cleanReference, downloads);
    if (dlId !== undefined) {
      api.events.emit("pause-download", dlId);
    }
  });
  await api.emitAndAwait("cancel-dependency-install", modId);

  driver.cancel();

  api.dismissNotification(INSTALLING_NOTIFICATION_ID + modId);
  if (silent !== true) {
    api.sendNotification({
      id: "collection-pausing",
      type: "success",
      title: "Collection pausing",
      message: "Already queued mod installations will still finish",
      displayMS: 3000,
    });
  }
}

async function removeCollection(
  api: types.IExtensionApi,
  gameId: string,
  modId: string,
  cancel: boolean,
) {
  const state = api.getState();
  const mods = state.persistent.mods[gameId];

  const t = api.translate;

  const collection = mods[modId];
  if (collection === undefined) {
    return;
  }

  const filter = (rule) =>
    rule.type === "requires" &&
    rule["ignored"] !== true &&
    util.findModByRef(rule.reference, mods) === undefined;

  const incomplete = (collection.rules ?? []).find(filter);

  const message: string =
    cancel && incomplete
      ? "Are you sure you want to cancel the installation?"
      : "Are you sure you want to remove the collection?";

  const confirmButtonText: string =
    cancel && incomplete ? "Cancel installation" : "Remove collection";

  const result = await api.showDialog(
    "question",
    message,
    {
      text:
        "This collection will be removed from Vortex and unlinked from any associated mods. " +
        "You can also choose to uninstall mods related to this collection and delete the " +
        "downloaded archives.\n" +
        "\nPlease note, some mods may be required by multiple collections.\n" +
        '\nAre you sure you want to remove "{{collectionName}}" from your collections?',
      parameters: {
        collectionName: util.renderModName(collection),
      },
      checkboxes: [
        { id: "delete_mods", text: t("Remove mods"), value: false },
        { id: "delete_archives", text: t("Delete mod archives"), value: false },
      ],
    },
    [{ label: "Close" }, { label: confirmButtonText }],
  );

  // apparently one can't cancel out of the cancellation...
  if (result.action === "Close") {
    return;
  }

  const deleteArchives = result.input.delete_archives;
  const deleteMods = result.input.delete_mods;

  modsBeingRemoved.add(makeModKey(gameId, modId));

  await pauseCollection(api, gameId, modId, true);

  let progress = 0;
  const notiId = shortid();
  const modName = util.renderModName(collection);
  const doProgress = (step: string, value: number) => {
    if (value <= progress) {
      return;
    }
    progress = value;
    api.sendNotification({
      id: notiId,
      type: "activity",
      title: "Removing {{name}}",
      message: step,
      progress,
      replace: {
        name: modName,
      },
    });
  };

  try {
    doProgress("Removing downloads", 0);
    const downloads = state.persistent.downloads.files;

    // either way, all running downloads are canceled. If selected, so are finished downloads
    let completed = 0;
    await Promise.all(
      (collection.rules ?? []).map(async (rule) => {
        const dlId = util.findDownloadByRef(rule.reference, downloads);

        if (dlId !== undefined) {
          const download = state.persistent.downloads.files[dlId];
          if (
            download !== undefined &&
            (deleteArchives || download.state !== "finished")
          ) {
            await util.toPromise((cb) =>
              api.events.emit("remove-download", dlId, cb, {
                silent: true,
                confirmed: true,
              }),
            );
          }
        }
        doProgress(
          "Removing downloads",
          50 * (completed++ / collection.rules.length),
        );
      }),
    );

    doProgress("Removing mods", 50);
    completed = 0;
    // if selected, remove mods
    if (deleteMods) {
      const removeMods: string[] = (collection.rules ?? [])
        .map((rule) => util.findModByRef(rule.reference, mods))
        .filter((mod) => mod !== undefined)
        .map((mod) => mod.id);

      await util.toPromise((cb) =>
        api.events.emit("remove-mods", gameId, removeMods, cb, {
          silent: true,
          progressCB: (idx: number, length: number, name: string) => {
            // Progress will still be reported via activity notification
            doProgress(name, 50 + (50 * idx) / length);
          },
        }),
      );
    }

    {
      // finally remove the collection itself
      doProgress("Removing collection", 0.99);
      const download = state.persistent.downloads.files[collection.archiveId];
      if (download !== undefined) {
        await util.toPromise((cb) =>
          api.events.emit("remove-download", collection.archiveId, cb, {
            silent: true,
            confirmed: true,
          }),
        );
      }
      await util.toPromise((cb) =>
        api.events.emit("remove-mod", gameId, modId, cb, {
          silent: true,
          incomplete: true,
        }),
      );
    }
  } catch (err) {
    if (!(err instanceof util.UserCanceled)) {
      // possible reason for ProcessCanceled is that (un-)deployment may
      // not be possible atm, we definitively should report that
      api.showErrorNotification("Failed to remove mods", err, {
        message: modName,
        allowReport: !(err instanceof util.ProcessCanceled),
        warning: err instanceof util.ProcessCanceled,
      } as any);
    }
  } finally {
    modsBeingRemoved.delete(makeModKey(gameId, modId));
    api.dismissNotification(notiId);
  }
}

function genAttributeExtractor(api: types.IExtensionApi) {
  // tslint:disable-next-line:no-shadowed-variable
  return (modInfo: any, modPath: string): Bluebird<{ [key: string]: any }> => {
    const collectionId = modInfo.download?.modInfo?.nexus?.ids?.collectionId;
    const revisionId = modInfo.download?.modInfo?.nexus?.ids?.revisionId;
    const collectionSlug =
      modInfo.download?.modInfo?.nexus?.ids?.collectionSlug;
    const revisionNumber =
      modInfo.download?.modInfo?.nexus?.ids?.revisionNumber;
    const referenceTag = modInfo.download?.modInfo?.referenceTag;

    const result: { [key: string]: any } = {
      collectionId,
      revisionId,
      collectionSlug,
      revisionNumber,
      referenceTag,
    };

    return Bluebird.resolve(result);
  };
}

function generateCollectionMap(mods: { [modId: string]: types.IMod }): {
  [modId: string]: types.IMod[];
} {
  const collections = Object.values(mods).filter(
    (mod) => mod.type === MOD_TYPE,
  );

  const result: { [modId: string]: types.IMod[] } = {};

  collections.forEach((coll) =>
    (coll.rules ?? []).forEach((rule) => {
      if (rule.reference.id !== undefined) {
        util.setdefault(result, rule.reference.id, []).push(coll);
      } else {
        const installed = util.findModByRef(rule.reference, mods);
        if (installed !== undefined) {
          util.setdefault(result, installed.id, []).push(coll);
        }
      }
    }),
  );

  return result;
}

interface IModTable {
  [modId: string]: types.IMod;
}

function collectionListEqual(lArgs: IModTable[], rArgs: IModTable[]): boolean {
  const lhs = lArgs[0];
  const rhs = rArgs[0];

  if (lhs === rhs) {
    return true;
  }

  const keys = Object.keys(lhs);

  if (!_.isEqual(keys, Object.keys(rhs))) {
    return false;
  }

  const ruleDiff = keys.find(
    (modId) =>
      lhs[modId].state !== rhs[modId].state ||
      lhs[modId].rules !== rhs[modId].rules,
  );

  return ruleDiff === undefined;
}

function generateCollectionOptions(mods: {
  [modId: string]: types.IMod;
}): Array<{ label: string; value: string }> {
  return Object.values(mods)
    .filter((mod) => mod.type === MOD_TYPE)
    .map((mod) => ({ label: util.renderModName(mod), value: mod.id }));
}

async function updateMeta(api: types.IExtensionApi, collectionId?: string) {
  const state = api.getState();
  const gameMode = selectors.activeGameId(state);
  const mods = state.persistent.mods[gameMode] ?? {};
  const collections = Object.keys(mods).filter(
    (modId) =>
      mods[modId].type === MOD_TYPE &&
      (collectionId != null ? mods[modId].id === collectionId : true),
  );

  const notiId = shortid();

  const progress = (name: string, idx: number) => {
    api.sendNotification({
      id: notiId,
      type: "activity",
      title: "Updating Collection Information",
      message: name,
      progress: (idx * 100) / collections.length,
    });
  };

  // tslint:disable-next-line:prefer-for-of
  for (let i = 0; i < collections.length; ++i) {
    const modId = collections[i];
    const { revisionId, collectionSlug, revisionNumber } =
      mods[modId].attributes ?? {};
    try {
      if (revisionId !== undefined || collectionSlug !== undefined) {
        progress(util.renderModName(mods[modId]), i);

        const info: nexusApi.IRevision = await driver.infoCache.getRevisionInfo(
          revisionId,
          collectionSlug,
          revisionNumber,
          "force",
        );
        if (!!info) {
          const latestPublishedRev = info.collection.latestPublishedRevision;

          api.store.dispatch(
            actions.setModAttributes(gameMode, modId, {
              permissions: info.collection.permissions,
              collectionSlug: info.collection.slug,
              revisionNumber: info.revisionNumber,
              author: info.collection.user?.name,
              uploader: info.collection.user?.name,
              uploaderAvatar: info.collection.user?.avatar,
              uploaderId: info.collection.user?.memberId,
              pictureUrl: info.collection.tileImage?.url,
              description: info.collection.description,
              shortDescription: info.collection.summary,
              newestFileId: latestPublishedRev?.id,
              newestVersion: latestPublishedRev?.revisionNumber?.toString?.(),
              metadata: info.metadata,
              rating: info.rating,
            }),
          );
        }
      }
    } catch (err) {
      api.showErrorNotification("Failed to check collection for update", err);
    }
  }

  localState.ownCollections =
    (await api.emitAndAwait("get-my-collections", gameMode))[0] || [];

  api.dismissNotification(notiId);
}

interface ICallbackMap {
  [cbName: string]: (...args: any[]) => void;
}

let collectionChangedCB: () => void;

function onAddSelectionImpl(
  api: types.IExtensionApi,
  collectionId: string,
  modIds: string[],
) {
  const state = api.getState();
  const gameId = selectors.activeGameId(state);
  const collection = state.persistent.mods[gameId][collectionId];

  if (collection !== undefined) {
    modIds.forEach((modId) => {
      if (!alreadyIncluded(collection.rules, modId)) {
        api.store.dispatch(
          actions.addModRule(gameId, collectionId, {
            type: "requires",
            reference: {
              id: modId,
            },
          }),
        );
      }
    });
  } else {
    log(
      "warn",
      "failed to add mods to collection, collection no longer found",
      { gameId, collectionId, modIds },
    );
  }
}

const localState = util.makeReactive<{
  ownCollections: IRevision[];
}>({
  ownCollections: [],
});

function register(
  context: types.IExtensionContext,
  collectionsCB: ICallbackMap,
) {
  context.registerReducer(["session", "collections"], sessionReducer);
  context.registerReducer(["session", "collections"], trackingReducer);
  context.registerReducer(["settings", "collections"], settingsReducer);
  context.registerReducer(["persistent", "collections"], persistentReducer);

  const onSwitchProfile = (profileId: string) => {
    return new Promise<void>((resolve, reject) => {
      context.api.events.once("profile-did-change", (newProfileId: string) => {
        if (newProfileId === profileId) {
          resolve();
        } else {
          log(
            "warn",
            `Failed to switch to profile ${profileId}; got ${newProfileId}`,
          );
          const profile = selectors.profileById(
            context.api.getState(),
            profileId,
          );
          if (profile === undefined) {
            reject(
              new Error(
                `Failed to switch to profile ${profileId}; got ${newProfileId}`,
              ),
            );
          }

          // The profile exists - this is a memoization issue, lets just switch to
          //  it rather crashing the app. The installDriver has a fallback mechanism
          //  to ensure it uses the correct profile anyway.
          //
          // P.S. previously the fallback mechanism was being executed in the background
          //  for each switch anyway. (so even if we crash the app, the profile was still
          //  being activated)
          context.api.store.dispatch(actions.setNextProfile(profileId));
          resolve();
        }
      });
      context.api.store.dispatch(actions.setNextProfile(profileId));
    });
  };

  context.registerDialog("collection-install", InstallStartDialog, () => ({
    driver,
    onSwitchProfile,
  }));

  const onClone = (collectionId: string) =>
    cloneInstalledCollection(context.api, collectionId);
  const onCreateCollection = (profile: types.IProfile, name: string) =>
    createNewCollection(context.api, profile, name);
  const onRemoveCollection = (gameId: string, modId: string, cancel: boolean) =>
    removeCollection(context.api, gameId, modId, cancel);
  const onUpdateMeta = () => updateMeta(context.api);
  const editCollection = (id: string) => collectionsCB.editCollection(id);
  const onInstallCollection = (revision: IRevision) =>
    installCollection(context.api, revision);

  context.registerDialog("collection-finish", InstallFinishDialog, () => ({
    api: context.api,
    driver,
    onClone,
    editCollection,
  }));

  context.registerDialog(
    "collection-changelog",
    InstallChangelogDialog,
    () => ({}),
  );

  const onAddSelection = (collectionId: string, modIds: string[]) =>
    onAddSelectionImpl(context.api, collectionId, modIds);

  context.registerDialog("add-mod-to-collection", AddModsDialog, () => ({
    onAddSelection,
  }));

  context.registerDialog(
    "collection-health-downvote",
    HealthDownvoteDialog,
    () => ({}),
  );

  let resetPageCB: () => void;
  const resetCB = (cb) => (resetPageCB = cb);
  const onAddCallback = (cbName: string, cb: (...args: any[]) => void) => {
    collectionsCB[cbName] = cb;
  };

  context.registerMainPage("collection", "Collections", CollectionsMainPage, {
    priority: 50,
    hotkey: "C",
    group: "per-game",
    visible: () => selectors.activeGameId(context.api.getState()) !== undefined,
    props: () => ({
      driver,
      localState,
      onInstallCollection,
      onAddCallback,
      onRemoveCollection,
      onCloneCollection: onClone,
      onCreateCollection,
      onUpdateMeta,
      resetCB,
      pathTool,
    }),
    onReset: () => resetPageCB?.(),
    mdi: nxmCollection,
  } as any);

  context.registerModType(
    MOD_TYPE,
    200,
    () => true,
    () => undefined,
    () => Bluebird.resolve(false),
    {
      name: "Collection",
      customDependencyManagement: true,
      noConflicts: true,
    } as any,
  );

  const stateFunc: () => types.IState = () => context.api.store.getState();

  const emptyArray = [];
  const emptyObj = {};

  const collectionsMapFunc = memoize(
    generateCollectionMap,
    collectionListEqual,
  );

  const collectionsMap = () =>
    collectionsMapFunc(
      stateFunc().persistent.mods[selectors.activeGameId(stateFunc())] ??
        emptyObj,
    );
  const collectionOptions = memoize(generateCollectionOptions);

  const collectionChanged = new util.Debouncer(() => {
    collectionChangedCB?.();
    return null;
  }, 500);

  const collectionAttribute: types.ITableAttribute<types.IMod> = {
    id: "collection",
    name: "Collection",
    description: "Collection(s) this mod was installed from (if any)",
    icon: "collection",
    placement: "both",
    customRenderer: (mod: types.IMod, detailCell: boolean) => {
      const collections = collectionsMap()[mod.id] || emptyArray;
      return React.createElement(
        CollectionAttributeRenderer,
        { modId: mod.id, collections, detailCell },
        [],
      );
    },
    calc: (mod: types.IMod) => {
      const collections = collectionsMap()[mod.id];
      return collections === undefined
        ? ""
        : collections.map((iter) => iter.id);
    },
    externalData: (onChanged: () => void) => {
      collectionChangedCB = onChanged;
    },
    isToggleable: true,
    edit: {},
    filter: new OptionsFilter(
      () => {
        const mods =
          stateFunc().persistent.mods[selectors.activeGameId(stateFunc())] ??
          {};
        return [
          {
            label: `<${context.api.translate("None")}>`,
            value: OptionsFilter.EMPTY,
          },
          ...collectionOptions(mods),
        ];
      },
      false,
      false,
    ),
    isGroupable: true,
    groupName: (modId: string) =>
      util.renderModName(
        stateFunc().persistent.mods[selectors.activeGameId(stateFunc())]?.[
          modId
        ],
      ),
    isDefaultVisible: false,
  };
  context.registerTableAttribute("mods", collectionAttribute);

  context.registerAction(
    "mods-action-icons",
    25,
    "collection-edit",
    {},
    "Edit Collection",
    (modIds: string[]) => {
      context.api.events.emit("show-main-page", "Collections");
      // have to delay this a bit because the callbacks are only set up once the page
      // is first opened
      setTimeout(() => {
        if (
          collectionsCB !== undefined &&
          collectionsCB.editCollection !== undefined
        ) {
          collectionsCB.editCollection(modIds[0]);
        }
      }, 100);
    },
    (modIds: string[]) => isEditableCollection(context.api.getState(), modIds),
  );

  context.registerAction(
    "mods-action-icons",
    50,
    "conflict",
    {},
    "Apply Collection Rules",
    (modIds: string[]) => {
      const state = context.api.getState();
      const gameId = selectors.activeGameId(state);
      const mods = state.persistent.mods[gameId];
      const stagingPath = selectors.installPathForGame(
        context.api.getState(),
        gameId,
      );
      const mod = mods[modIds[0]];
      if (mod !== undefined && mod.type === MOD_TYPE) {
        readCollection(
          context.api,
          path.join(stagingPath, mod.installationPath, "collection.json"),
        )
          .then(async (collectionInfo: ICollection) => {
            try {
              await postprocessCollection(
                context.api,
                gameId,
                mod,
                collectionInfo,
                mods,
              );
            } catch (err) {
              context.api.showErrorNotification(
                "Failed to apply collection rules",
                err,
                { message: util.renderModName(mod) },
              );
            }
          })
          .catch((err) => {
            context.api.showErrorNotification(
              "Failed to read collection info",
              err,
              { message: util.renderModName(mod) },
            );
          });
      }
    },
    (modIds: string[]) => {
      const state = context.api.getState();
      const gameId = selectors.activeGameId(state);
      const mod = state.persistent.mods[gameId][modIds[0]];
      return mod?.type === MOD_TYPE;
    },
  );
  /*
  context.registerAction('mods-action-icons', 75, 'start-install', {}, 'Install Optional Mods...',
    (modIds: string[]) => {
      const profile: types.IProfile = selectors.activeProfile(stateFunc());
      context.api.events.emit('install-recommendations', profile.id, profile.gameId, modIds);
    }, (modIds: string[]) => {
      const gameMode = selectors.activeGameId(stateFunc());
      const mod = stateFunc().persistent.mods[gameMode][modIds[0]];
      if (mod === undefined) {
        return false;
      }
      if ((mod.rules ?? []).find(rule => rule.type === 'recommends') === undefined) {
        return context.api.translate('No optional mods') as string;
      }
      return (mod.type === MOD_TYPE);
    });
  */

  // context.registerAction('global-icons', 100, 'highlight-lab', {}, 'Quick Collection', () => {
  //   initFromProfile(context.api)
  //     .catch(err => context.api.showErrorNotification('Failed to init collection', err));
  // }, () => {
  //   const state = context.api.getState();
  //   const activeProfile = selectors.activeProfile(state);
  //   return activeProfile !== undefined;
  // });

  context.registerAction(
    "profile-actions",
    150,
    "highlight-lab",
    {},
    "Init Collection",
    (profileIds: string[]) => {
      initFromProfile(context.api, profileIds[0]).catch((err) =>
        context.api.showErrorNotification("Failed to init collection", err),
      );
    },
    (profileIds: string[]) =>
      !profileCollectionExists(context.api, profileIds[0]),
  );

  context.registerAction(
    "profile-actions",
    150,
    "highlight-lab",
    {},
    "Update Collection",
    (profileIds: string[]) => {
      initFromProfile(context.api, profileIds[0]).catch((err) =>
        context.api.showErrorNotification("Failed to update collection", err),
      );
    },
    (profileIds: string[]) =>
      profileCollectionExists(context.api, profileIds[0]),
  );

  context.registerAction(
    "mods-action-icons",
    300,
    "collection",
    {},
    "Add to Collection...",
    (instanceIds: string[]) => {
      addCollectionAction(context.api, instanceIds)
        .then(() => collectionChanged.schedule())
        .catch((err) =>
          context.api.showErrorNotification(
            "failed to add mod to collection",
            err,
          ),
        );
    },
    (instanceIds: string[]) => addCollectionCondition(context.api, instanceIds),
  );

  context.registerAction(
    "mods-multirow-actions",
    300,
    "collection",
    {},
    "Add to Collection...",
    (instanceIds: string[]) => {
      addCollectionAction(context.api, instanceIds)
        .then(() => collectionChanged.schedule())
        .catch((err) =>
          context.api.showErrorNotification(
            "failed to add mod to collection",
            err,
          ),
        );
    },
    (instanceIds: string[]) => addCollectionCondition(context.api, instanceIds),
  );

  context.registerAction(
    "mods-action-icons",
    300,
    "collection",
    {},
    "Remove from Collection...",
    (instanceIds: string[]) => {
      removeCollectionAction(context.api, instanceIds)
        .then(() => collectionChanged.schedule())
        .catch((err) =>
          context.api.showErrorNotification(
            "failed to remove mod from collection",
            err,
          ),
        );
    },
    (instanceIds: string[]) =>
      removeCollectionCondition(context.api, instanceIds),
  );

  context.registerAction(
    "mods-multirow-actions",
    300,
    "collection",
    {},
    "Remove from Collection...",
    (instanceIds: string[]) => {
      removeCollectionAction(context.api, instanceIds)
        .then(() => collectionChanged.schedule())
        .catch((err) =>
          context.api.showErrorNotification(
            "failed to remove mod from collection",
            err,
          ),
        );
    },
    (instanceIds: string[]) =>
      removeCollectionCondition(context.api, instanceIds),
  );

  context.registerAttributeExtractor(100, genAttributeExtractor(context.api));

  context.registerInstaller(
    "collection",
    5,
    bbProm(testSupported),
    bbProm(makeInstall(context.api)),
  );

  context.registerAPI(
    "getActiveCollectionInstallSession",
    () => getActiveInstallSession(context.api.getState()),
    { minArguments: 0 },
  );

  context["registerCollectionFeature"] = (
    id: string,
    generate: (gameId: string, includedMods: string[]) => Promise<any>,
    parse: (gameId: string, collection: ICollection) => Promise<void>,
    clone: (
      gameId: string,
      collection: ICollection,
      from: types.IMod,
      to: types.IMod,
    ) => Promise<void>,
    title: (t: types.TFunction) => string,
    condition?: (state: types.IState, gameId: string) => boolean,
    editComponent?: React.ComponentType<IExtendedInterfaceProps>,
  ) => {
    addExtension({
      id,
      generate,
      parse,
      clone,
      condition,
      title,
      editComponent,
    });
  };

  context.registerActionCheck(
    "ADD_NOTIFICATION",
    (state: types.IState, action: Redux.Action) => {
      const notification: types.INotification = action["payload"];
      const ruleMatches = (rule) =>
        rule.reference.tag === notification.replace?.tag;

      let collection: types.IMod;
      if (
        driver?.collection !== undefined &&
        notification.id.startsWith("multiple-plugins-")
      ) {
        // reference tags may be updated during installation, so we need to get the
        // updated collection if necessary
        if (driver.profile !== undefined) {
          collection =
            state.persistent.mods[driver.profile.gameId]?.[
              driver.collection.id
            ] ?? driver.collection;
        } else {
          collection = driver.collection;
        }
      }

      if ((collection?.rules ?? []).find(ruleMatches) !== undefined) {
        return false as any;
      }
      return undefined;
    },
  );
}

async function triggerVoteNotification(
  api: types.IExtensionApi,
  revisionId: number,
  collectionSlug: string,
  revisionNumber: number,
): Promise<void> {
  if (collectionSlug === undefined || revisionNumber === undefined) {
    return Promise.resolve();
  }

  const revInfo = await driver.infoCache.getRevisionInfo(
    revisionId,
    collectionSlug,
    revisionNumber,
  );

  if (!revInfo) {
    // no info about that revision? This might be a temporary network issue but if we don't
    // resolve here and the revision actually doesn't exist any more we'd never get rid of
    // the vote request

    return Promise.resolve();
  }

  const sendRating = async (success: boolean) => {
    const vote = success ? "positive" : "negative";
    const voted: { success: boolean; averageRating?: nexusApi.IRating } = (
      await api.emitAndAwait("rate-nexus-collection-revision", revisionId, vote)
    )[0];
    if (voted.success) {
      api.store.dispatch(
        updateSuccessRate(
          revisionId,
          vote,
          voted.averageRating.average,
          voted.averageRating.total,
        ),
      );
    }
  };

  return new Promise((resolve, reject) => {
    api.sendNotification({
      type: "info",
      message: revInfo.collection.name,
      title: "Did the Collection work for you?",
      noDismiss: true,
      actions: [
        {
          title: "Yes",
          action: (dismiss) => {
            api.events.emit(
              "analytics-track-click-event",
              "Notifications",
              "Success rating - Yes",
            );
            sendRating(true);
            resolve();
            dismiss();
          },
        },
        {
          title: "No",
          action: (dismiss) => {
            api.events.emit(
              "analytics-track-click-event",
              "Notifications",
              "Success rating - No",
            );
            sendRating(false);
            resolve();
            dismiss();
          },
        },
        {
          icon: "close",
          action: (dismiss) => {
            api.events.emit(
              "analytics-track-click-event",
              "Notifications",
              "Success rating - Dismiss",
            );
            resolve();
            dismiss();
          },
        } as any,
      ],
    });
  });
}

async function checkVoteRequest(api: types.IExtensionApi): Promise<number> {
  let elapsed = 0;
  const state = api.getState();
  const pendingVotes = state.persistent["collections"].pendingVotes ?? {};
  const now = Date.now();

  for (const revisionIdRaw of Object.keys(pendingVotes)) {
    const pendingInfo = pendingVotes[revisionIdRaw];
    const revisionId = parseInt(revisionIdRaw, 10);
    if (now - pendingInfo.time >= TIME_BEFORE_VOTE) {
      await triggerVoteNotification(
        api,
        revisionId,
        pendingInfo.collectionSlug,
        pendingInfo.revisionNumber,
      );
      api.store.dispatch(clearPendingVote(revisionId));
    } else {
      elapsed = Math.max(elapsed, now - pendingInfo.time);
    }
  }

  // this doesn't account for the delay caused by the user reacting to the notification so
  // the next check and thereby next notification can take that much longer but I think
  // that's so irrelevant
  return TIME_BEFORE_VOTE - elapsed;
}

function once(api: types.IExtensionApi, collectionsCB: () => ICallbackMap) {
  const { store } = api;

  const applyCollectionModDefaults = new util.Debouncer(() => {
    const gameMode = selectors.activeGameId(state());
    const mods = util.getSafe(state(), ["persistent", "mods", gameMode], {});
    const collectionIds = Object.keys(mods).filter(
      (id) => mods[id]?.type === MOD_TYPE,
    );
    const redActions: Redux.Action[] = collectionIds.reduce((accum, id) => {
      const collection: types.IMod = mods[id];
      if (
        collection === undefined ||
        collection.attributes["editable"] !== true
      ) {
        return accum;
      }
      const collMods = (collection.rules ?? [])
        .map((rule) => util.findModByRef(rule.reference, mods))
        .filter((rule) => rule !== undefined);
      const action = genDefaultsAction(api, id, collMods, gameMode);
      if (action !== undefined) {
        accum.push(action);
      }
      return accum;
    }, []);

    if (redActions.length > 0) {
      util.batchDispatch(api.store, redActions);
    }
    return null;
  }, 1000);

  driver = new InstallDriver(api);

  driver.onUpdate(() => {
    // currently no UI associated with the start step
    if (driver.step === "start") {
      driver.continue();
    }

    if (driver.step === "review") {
      // this is called a few times so we need to check if collection is undefined or not so we only write timestamp once
      if (driver.collection === undefined) return;

      const gameId = driver.profile.gameId;
      const modId = driver.collection.id;

      api.store.dispatch(
        actions.setModAttribute(gameId, modId, "installCompleted", Date.now()),
      );
    }
  });

  // Pause collection installation if user becomes unauthenticated
  api.onStateChange(
    ["persistent", "nexus", "userInfo"],
    (oldValue, newValue) => {
      // Only pause if user logged out (userInfo became undefined), not during re-login
      if (oldValue !== undefined && newValue === undefined) {
        if (!driver.installDone && driver.collection !== undefined) {
          const gameId =
            driver.profile?.gameId ?? selectors.activeGameId(api.getState());
          const modId = driver.collection.id;
          log("info", "User logged out during collection install, pausing", {
            modId,
          });
          pauseCollection(api, gameId, modId, true)
            .then(() => {
              api.sendNotification({
                type: "warning",
                title: "Collection paused",
                message: "You have been logged out. Please log in and resume.",
                displayMS: 5000,
              });
            })
            .catch((err) => {
              log("error", "Failed to pause collection after logout", {
                modId,
                error: err.message,
              });
            });
        }
      }
    },
  );

  const doCheckVoteRequest = () => {
    checkVoteRequest(api).then((nextCheck: number) => {
      setTimeout(doCheckVoteRequest, nextCheck);
    });
  };

  setTimeout(doCheckVoteRequest, DELAY_FIRST_VOTE_REQUEST);

  api.setStylesheet("collections", path.join(__dirname, "style.scss"));

  const state: () => types.IState = () => store.getState();

  interface IModsDict {
    [gameId: string]: { [modId: string]: types.IMod };
  }

  api.onStateChange(
    ["persistent", "mods"],
    (prev: IModsDict, cur: IModsDict) => {
      const gameMode = selectors.activeGameId(api.getState());
      const prevG = prev[gameMode] ?? {};
      const curG = cur[gameMode] ?? {};
      const allIds = Array.from(
        new Set([].concat(Object.keys(prevG), Object.keys(curG))),
      );
      const collections = allIds.filter(
        (id) => prevG[id]?.type === MOD_TYPE || curG[id]?.type === MOD_TYPE,
      );
      const changed = collections.find(
        (modId) =>
          prevG[modId]?.attributes?.customFileName !==
          curG[modId]?.attributes?.customFileName,
      );
      if (changed !== undefined) {
        collectionChangedCB?.();
      }

      const foundRuleChanges: boolean =
        collections.find((id) => {
          if (prevG[id]?.rules === curG[id]?.rules) {
            return false;
          }
          const added = _.difference(curG[id]?.rules, prevG[id]?.rules);
          const removed = _.difference(prevG[id]?.rules, curG[id]?.rules);
          return (
            removed.length > 0 ||
            added.find((rule) =>
              ["requires", "recommends"].includes(rule.type),
            ) !== undefined
          );
        }) !== undefined;

      if (foundRuleChanges) {
        applyCollectionModDefaults.schedule();
        if (changed === undefined) {
          // The collectionChanged callback hasn't been called; yet
          //  the mod entries had been changed - we need to call the CB
          //  in order for the collection column on the mods page to rerender
          collectionChangedCB?.();
        }
      }
    },
  );

  api.events.on("did-dismiss-overlay", (overlayId: string, itemId: string) => {
    const OVERLAY_ID = "collection-instructions-overlay";
    const state = api.getState();
    const { gameId } = driver.profile ?? {};
    const mods = state.persistent.mods[gameId] ?? {};
    // the itemId will be a reference tag if this was from a collection or an archiveId otherwise
    if (
      driver.lastCollection !== undefined &&
      mods[driver.lastCollection.id] !== undefined &&
      itemId !== undefined &&
      state.settings.notifications.suppress[OVERLAY_ID] !== true
    ) {
      // have to update here because the reference tags may have been updated during installation
      const collections = mods[driver.lastCollection.id];
      const match = (collections.rules ?? []).find(
        (rule) => rule.type === "requires" && rule.reference.tag === itemId,
      );

      if (match !== undefined) {
        api
          .showDialog(
            "info",
            "Mod instructions",
            {
              text:
                "You can refer back to closed mod instructions at any time in the Instructions tab on " +
                "the Collections page.",
              checkboxes: [
                {
                  id: "dont_show_again",
                  value: false,
                  text: "Don't show again",
                },
              ],
            },
            [{ label: "Take me to instructions" }, { label: "Close" }],
            OVERLAY_ID,
          )
          .then((result: types.IDialogResult) => {
            if (result.input["dont_show_again"]) {
              api.store.dispatch(
                actions.suppressNotification(OVERLAY_ID, true),
              );
            }

            if (result.action === "Take me to instructions") {
              api.events.emit("show-main-page", "Collections");
              // have to delay this a bit because the callbacks are only set up once the page
              // is first opened
              setTimeout(() => {
                collectionsCB().viewCollection?.(driver.lastCollection.id);
              }, 100);
            }
          })
          .catch((err) => {
            log("warn", "failed to show mod instructions suppress dialog", {
              error: err.message,
            });
          });
      }
    }
  });

  api.events.on(
    "did-install-mod",
    async (gameId: string, archiveId: string, modId: string) => {
      // automatically enable collections once they're installed
      // Use the driver's target profile if available, otherwise fall back to last active profile
      const targetProfile = driver.profile;
      const profileId =
        targetProfile?.id ??
        selectors.lastActiveProfileForGame(state(), gameId);
      const profile =
        targetProfile ?? selectors.profileById(state(), profileId);
      if (profile === undefined) {
        return;
      }
      const mod = util.getSafe(
        state().persistent.mods,
        [gameId, modId],
        undefined,
      );
      if (mod === undefined) {
        // how ?
        return;
      }
      if (mod.type === MOD_TYPE) {
        if (driver.collection === undefined) {
          const awaitProfileSwitch =
            api.ext?.awaitProfileSwitch ?? (() => Promise.resolve());
          await awaitProfileSwitch();
          driver.query(profile, mod);
        } else {
          api.sendNotification({
            type: "info",
            message:
              "Collection can't be installed as another one is being installed already",
          });
        }
      } else if (driver.collection !== undefined) {
        const { collection, revisionId } = driver;

        const dependency = (collection?.rules ?? []).find((rule) => {
          const validType = ["requires", "recommends"].includes(rule.type);
          if (!validType) {
            return false;
          }
          const matchedRule = util.testModReference(mod, rule.reference);
          return matchedRule;
        });
        const isDependency = dependency !== undefined;
        if (isDependency) {
          driver.markModInstalledInTracking(dependency, modId);
          const modRules = await driver.infoCache.getCollectionModRules(
            revisionId,
            collection,
            gameId,
          );
          util.batchDispatch(
            api.store,
            (modRules ?? []).reduce((prev, rule) => {
              if (util.testModReference(mod, rule.source)) {
                prev.push(
                  actions.addModRule(gameId, modId, {
                    type: rule.type,
                    reference: rule.reference,
                    extra: {
                      fromCollection: collection.id,
                    },
                  }),
                );
              }
              return prev;
            }, []),
          );
        }
      }
    },
  );

  api.onAsync("will-remove-mods", makeWillRemoveMods(api));
  api.onAsync("did-remove-mods", makeDidRemoveMods());

  api.onAsync("unfulfilled-rules", makeOnUnfulfilledRules(api));
  api.events.on("collection-update", onCollectionUpdate(api, driver));

  api.events.on("did-finish-download", (dlId: string, outcome: string) => {
    if (outcome === "finished") {
      const download: types.IDownload =
        state().persistent.downloads.files[dlId];
      if (download === undefined) {
        return;
      }
    }
  });

  api.events.on("did-download-collection", async (dlId: string) => {
    try {
      const dlInfo: types.IDownload = util.getSafe(
        state().persistent.downloads.files,
        [dlId],
        undefined,
      );
      const profile = selectors.activeProfile(state());
      if (profile === undefined || dlInfo === undefined) {
        return;
      }
      if (!dlInfo.game.includes(profile.gameId)) {
        log(
          "info",
          "Collection downloaded for a different game than is being managed",
          { gameMode: profile.gameId, game: dlInfo.game },
        );
        const expectedGame = util.getGame(dlInfo.game[0]);
        const actualGame = util.getGame(profile.gameId);
        api.sendNotification({
          message:
            '"{{collectionName}}" - This collection is intended for {{expectedGame}} ' +
            "and cannot be installed to {{actualGame}}",
          type: "info",
          replace: {
            collectionName: dlInfo.modInfo?.name ?? dlInfo.localPath,
            expectedGame:
              expectedGame?.name ?? api.translate("an unsupported game"),
            actualGame: actualGame.name,
          },
        });

        // the collection was for a different game, can't install it now
        return;
      } else {
        // once this is complete it will automatically trigger did-install-mod
        // which will then start the ui for the installation process
        await util.toPromise<string>((cb) =>
          api.events.emit(
            "start-install-download",
            dlId,
            {
              allowAutoEnable: false,
            },
            cb,
          ),
        );
      }
    } catch (err) {
      if (!(err instanceof util.UserCanceled)) {
        api.showErrorNotification("Failed to add collection", err, {
          allowReport: !(err instanceof util.ProcessCanceled),
        });
      }
    }
  });

  api.events.on("view-collection", (modId: string, tabId?: string) => {
    api.events.emit("show-main-page", "Collections");
    // have to delay this a bit because the callbacks are only set up once the page
    // is first opened
    setTimeout(() => {
      collectionsCB().viewCollection?.(modId);
      collectionsCB().viewCollectionTab?.(tabId);
    }, 100);
  });

  api.events.on("edit-collection", (modId: string) => {
    api.events.emit("show-main-page", "Collections");
    // have to delay this a bit because the callbacks are only set up once the page
    // is first opened
    setTimeout(() => {
      collectionsCB().editCollection?.(modId);
    }, 100);
  });

  api.events.on("resume-collection", (gameId: string, modId: string) => {
    const state = api.getState();
    const profileId = selectors.lastActiveProfileForGame(state, gameId);
    const profile = state.persistent.profiles[profileId];
    const mod = state.persistent.mods[gameId]?.[modId];
    log("info", "resume collection", {
      gameId,
      modId,
      archiveId: mod?.archiveId,
    });
    driver.start(profile, mod);
  });

  api.onStateChange(
    ["persistent", "collections", "collections"],
    (prev, cur) => {
      // tslint:disable-next-line:no-shadowed-variable
      const state = api.getState();
      const changedIds = Object.keys(cur).filter(
        (id) => cur[id].info !== prev[id]?.info,
      );

      const knownGames = selectors.knownGames(state);

      const { mods } = state.persistent;

      changedIds.forEach((collId) => {
        const coll: nexusApi.ICollection = cur[collId].info;
        const gameId = util.convertGameIdReverse(
          knownGames,
          coll.game.domainName,
        );
        const collModId = Object.keys(mods[gameId] ?? {}).find(
          (modId) => mods[gameId][modId].attributes["collectionId"] === coll.id,
        );
        // don't set a "newestVersion" on own collections because we don't allow an update on those
        // anyway
        if (
          collModId !== undefined &&
          !mods[gameId][collModId].attributes.editable
        ) {
          const latestRevNumber = coll.latestPublishedRevision?.revisionNumber;

          if (latestRevNumber !== undefined) {
            api.store.dispatch(
              actions.setModAttribute(
                gameId,
                collModId,
                "newestVersion",
                latestRevNumber.toString(),
              ),
            );
          }
        }
      });
    },
  );

  util
    .installIconSet("collections", path.join(__dirname, "icons.svg"))
    .catch((err) =>
      api.showErrorNotification("failed to install icon set", err),
    );

  const iconPath = path.join(__dirname, "collectionicon.svg");
  document
    .getElementById("content")
    .style.setProperty(
      "--collection-icon",
      `url(${pathToFileURL(iconPath).href})`,
    );

  const updateOwnCollectionsCB = (gameId: string) =>
    api.emitAndAwait("get-my-collections", gameId).then((result) => {
      localState.ownCollections = result[0] ?? [];
    });

  api.events.on("gamemode-activated", updateOwnCollectionsCB);

  api.onStateChange(["persistent", "nexus", "userInfo"], (prev, cur) => {
    const gameMode = selectors.activeGameId(api.getState());
    updateOwnCollectionsCB(gameMode);
    if (prev?.isPremium !== cur?.isPremium) {
      restartDebouncer.schedule();
    }
  });

  const restartDebouncer = new util.Debouncer(
    async () => {
      if (driver?.collection !== undefined) {
        // user info changed, so we need to update the collection info
        await api.emitAndAwait("reset-dependency-installs");
        const profile = selectors.activeProfile(api.getState());
        await driver.start(profile, driver.collection);
      }
      return Promise.resolve();
    },
    2000,
    true,
    false,
  );

  driver.infoCache.clearCache();
}

const pathTool: IPathTools = {
  relative: path.relative,
};

function init(context: types.IExtensionContext): boolean {
  const collectionsCB: ICallbackMap = {};

  register(context, collectionsCB);

  initIniTweaks(context);
  initTools(context);

  context.once(() => {
    once(context.api, () => collectionsCB);
  });
  return true;
}

export default init;
