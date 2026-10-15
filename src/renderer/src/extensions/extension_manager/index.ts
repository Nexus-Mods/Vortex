import * as path from "node:path";

import { mdiPuzzleOutline } from "@mdi/js";
import { getErrorMessageOrDefault } from "@vortex/shared";
import * as semver from "semver";

import { log } from "@/logging";

import {
  declineExtensionNexusLink,
  setDialogVisible,
  setExtensionEnabled,
  setExtensionModId,
} from "../../actions";
import { isExtSame } from "../../ExtensionManager";
import type { IAvailableExtension, IExtensionDownloadInfo } from "../../types/extensions";
import type {
  IExtensionApi,
  IExtensionContext,
  ISupportedResult,
} from "../../types/IExtensionContext";
import type { IExtensionLoadFailure, IExtensionState, IState } from "../../types/IState";
import { getGame } from "../../util/api";
import { relaunch } from "../../util/commandLine";
import { DataInvalid, ProcessCanceled } from "../../util/CustomErrors";
import makeReactive from "../../util/makeReactive";
import { knownGames } from "../gamemode_management/selectors";
import { nexusGameId } from "../nexus_integration/util/convertGameId";
import { setAvailableExtensions, setExtensionsUpdate } from "./actions";
import BrowseExtensions from "./BrowseExtensions";
import type { IBrowseExtensionsProps } from "./BrowseExtensions";
import { ExtensionManager } from "./ExtensionManager";
import type { IExtensionManagerProps } from "./ExtensionManager";
import {
  findDependencyInCatalog,
  findInCatalog,
  findInstalled,
  findInstalledDependency,
  findLinkCandidates,
  findUpdatableExtensions,
  getMissingOptionalExtensions,
} from "./queries";
import sessionReducer from "./reducers";
import { downloadAndInstallExtension, fetchAvailableExtensions } from "./util";
import {
  type ILinkCandidate,
  type ILinkExtensionsDialogProps,
  LinkExtensionsDialog,
} from "./views/LinkExtensionsDialog";

declare module "../../types/IExtensionContext" {
  interface ApiEvents {
    "install-extension": (info: IExtensionDownloadInfo) => boolean;
    /** Settles once the startup fetch of the extension catalog has finished, successful or not. */
    "await-extension-catalog": () => void;
  }
}

interface ILocalState {
  reloadNecessary: boolean;
  preselectModId: number;
}

const localState: ILocalState = makeReactive({
  reloadNecessary: false,
  preselectModId: undefined,
});

async function checkForUpdates(api: IExtensionApi): Promise<void> {
  const state = api.getState();
  const { available } = state.session.extensions;
  const installed = state.app.extensions ?? {};

  await updateExtensions(api, findUpdatableExtensions(installed, available));
}

// asked at most once per session, so refreshing the catalog doesn't repeat the question
const offeredLinks = new Set<string>();

const LINK_DIALOG_ID = "link-extensions-dialog";
// read by the dialog's props callback, which runs when the dialog is shown
let linkOffer: {
  candidates: ILinkCandidate[];
  answer: (selected: string[] | undefined) => void;
} = { candidates: [], answer: () => undefined };

async function offerNexusLinks(api: IExtensionApi): Promise<void> {
  const state = api.getState();
  const games = knownGames(state).map((game) => ({
    extensionPath: game.extensionPath,
    domain: nexusGameId(game),
  }));
  const candidates = findLinkCandidates(
    state.app.extensions ?? {},
    games,
    state.session.extensions.available,
  ).filter(({ key }) => !offeredLinks.has(key));

  if (candidates.length === 0) return;
  candidates.forEach(({ key }) => offeredLinks.add(key));

  // the state entry's name is an identifier, often the folder name
  const loaded = api.getLoadedExtensions();
  const samePath = (lhs: string, rhs: string) =>
    path.normalize(lhs).toLowerCase() === path.normalize(rhs).toLowerCase();
  const displayName = (installed: IExtensionState) =>
    loaded.find((ext) => samePath(ext.path, installed.path))?.info?.name ?? installed.name;

  const selected = await new Promise<string[] | undefined>((resolve) => {
    linkOffer = {
      candidates: candidates.map(({ key, installed, available }) => ({
        key,
        name: displayName(installed),
        version: installed.version,
        replacementName: available.name,
        replacementVersion: available.version,
      })),
      answer: resolve,
    };
    api.store.dispatch(setDialogVisible(LINK_DIALOG_ID));
  });
  if (selected === undefined) return;

  const accepted = candidates.filter(({ key }) => selected.includes(key));
  for (const { key, available } of candidates) {
    api.store.dispatch(
      accepted.some((candidate) => candidate.key === key)
        ? setExtensionModId(key, available.modId)
        : declineExtensionNexusLink(key),
    );
  }

  await updateExtensions(api, accepted);
}

async function updateExtensions(
  api: IExtensionApi,
  updateable: Array<{ installed: IExtensionState; available: IAvailableExtension }>,
): Promise<void> {
  if (updateable.length === 0) return;

  api.sendNotification({
    id: "extension-updates",
    type: "info",
    message: "{{ count }} extensions will be updated",
    replace: { count: updateable.length },
  });

  log("info", "extensions will be updated", {
    updateable: updateable.map(
      ({ installed, available }) =>
        `${installed.name} v${installed.version} ${available.name} v${available.version}`,
    ),
  });

  const promises = updateable.map(({ available }) => downloadAndInstallExtension(api, available));
  const success = await Promise.all(promises);

  api.dismissNotification("extension-updates");
  localState.reloadNecessary = true;

  if (success.find((iter) => iter === true)) {
    api.sendNotification({
      id: "extension-updates",
      type: "success",
      message: "Extensions updated, please restart to apply them",
      actions: [
        {
          title: "Restart now",
          action: () => {
            relaunch();
          },
        },
      ],
    });
  }
}

async function updateAvailableExtensions(
  api: IExtensionApi,
  force: boolean = false,
): Promise<void> {
  const state = api.getState();
  if (!state.session.base.networkConnected) {
    return;
  }

  try {
    const extensions = await fetchAvailableExtensions(api, force);
    api.store.dispatch(setExtensionsUpdate(Date.now()));
    api.store.dispatch(setAvailableExtensions(extensions));
    await checkForUpdates(api);
    // not awaited: extension installs wait for this fetch, not for the user's answer
    offerNexusLinks(api).catch((err) =>
      log("warn", "failed to offer linking extensions", {
        error: getErrorMessageOrDefault(err),
      }),
    );
  } catch (err) {
    const allowReport = !(err instanceof DataInvalid);

    api.showErrorNotification("Failed to fetch available extensions", err, {
      allowReport,
    });
  }
}

async function installDependency(api: IExtensionApi, dependencyId: string): Promise<boolean> {
  const state = api.getState();
  const availableExtensions = state.session.extensions.available;

  const installedDependency = findInstalledDependency(state.app.extensions, dependencyId);

  if (installedDependency !== undefined) {
    // installed, probably failed to load or disabled
    if (!installedDependency.extension.enabled) {
      api.store.dispatch(setExtensionEnabled(installedDependency.key, true));
      return true;
    } else {
      api.showErrorNotification(
        "Failed to install extension",
        'The extension "{{ name }}" is already installed but failed to load, ' +
          'please review the load error on the "Extensions" tab.',
        {
          message: dependencyId,
          allowReport: false,
          replace: { name: dependencyId },
        },
      );

      return false;
    }
  }

  const toDownload = findDependencyInCatalog(availableExtensions, dependencyId);
  if (toDownload === undefined) return false;

  const success = await downloadAndInstallExtension(api, toDownload);
  if (success) {
    const gameName =
      toDownload.type === "game" || toDownload.name?.startsWith("Game:")
        ? toDownload.name
        : undefined;
    signalRestartNeeded(api, gameName);
  } else {
    api.showErrorNotification(
      "Failed to install extension",
      'The extension "{{ name }}" wasn\'t found in the repository. ' +
        "This might mean that the extension isn't available at all or " +
        "has been excluded for compatibility reasons. " +
        "Please check the installation instructions for this extension.",
      {
        message: dependencyId,
        allowReport: false,
        replace: { name: dependencyId },
      },
    );
  }

  return success;
}

function checkMissingDependencies(
  api: IExtensionApi,
  loadFailures: Record<string, IExtensionLoadFailure[]>,
): void {
  const missingDependencies = Object.values(loadFailures).reduce<Set<string>>((prev, failures) => {
    for (const failure of failures) {
      if (failure.id !== "dependency") continue;

      const { dependencyId } = failure.args;
      prev.add(dependencyId);
    }

    return prev;
  }, new Set<string>());

  if (missingDependencies.size === 0) return;

  const promises = missingDependencies.values().map((dependencyId) =>
    installDependency(api, dependencyId).catch((err) => {
      api.showErrorNotification("Failed to install extension", err, {
        message: dependencyId,
      });

      return false;
    }),
  );

  api.sendNotification({
    type: "warning",
    message:
      "Some of the installed extensions couldn't be loaded because " +
      "they have missing or incompatible dependencies.",
    actions: [
      {
        title: "Fix",
        action: (dismiss) => {
          void (async () => {
            const results = await Promise.all(promises);
            if (results.some((success) => success)) {
              api.sendNotification({
                type: "success",
                message: "Missing dependencies were installed - please restart Vortex",
                actions: [
                  {
                    title: "Restart now",
                    action: () => {
                      relaunch();
                    },
                  },
                ],
              });
              dismiss();
            }
          })();
        },
      },
    ],
  });
}

function signalRestartNeeded(api: IExtensionApi, gameName?: string): void {
  if (!localState.reloadNecessary) {
    localState.reloadNecessary = true;
    const relaunchArgs = gameName !== undefined ? ["--game", gameName] : undefined;
    api.sendNotification({
      id: "extension-updates",
      type: "success",
      message: "Extensions installed, please restart to use them",
      actions: [
        {
          title: "Restart now",
          action: () => relaunch(relaunchArgs),
        },
      ],
    });
  }
}

function init(context: IExtensionContext) {
  context.registerReducer(["session", "extensions"], sessionReducer);

  context.registerMainPage("extensions", "Extensions", ExtensionManager, {
    priority: 20,
    hotkey: "X",
    group: "global",
    newLayout: true,
    props: () =>
      ({
        localState,
        updateExtensions: () => {
          signalRestartNeeded(context.api);
          return Promise.resolve();
        },
        onRefresh: () => forceUpdateExtensions(),
      }) satisfies Partial<IExtensionManagerProps>,
    mdi: mdiPuzzleOutline,
  });

  const forceUpdateExtensions = () => {
    void updateAvailableExtensions(context.api, true);
  };

  context.registerDialog(
    LINK_DIALOG_ID,
    LinkExtensionsDialog,
    () =>
      ({
        candidates: linkOffer.candidates,
        onAnswer: (selected) => {
          const { answer } = linkOffer;
          // the dialog can close more than once, the offer is answered once
          linkOffer = { ...linkOffer, answer: () => undefined };
          answer(selected);
        },
      }) satisfies Partial<ILinkExtensionsDialogProps>,
  );

  context.registerDialog(
    "browse-extensions",
    BrowseExtensions,
    () =>
      ({
        localState,
        updateExtensions: () => {
          signalRestartNeeded(context.api);
          return Promise.resolve();
        },
        onRefreshExtensions: forceUpdateExtensions,
      }) satisfies Partial<IBrowseExtensionsProps>,
  );

  context.registerInstaller(
    "site-installer",
    0,
    (_, gameId: string) =>
      Promise.resolve<ISupportedResult>({
        supported: gameId === "site",
        requiredFiles: [],
      }),
    () => {
      return Promise.reject(
        new ProcessCanceled("Extensions have to be installed from the extensions page."),
      );
    },
  );

  context.once(() => {
    let onDidFetch: () => void;
    const didFetchAvailableExtensions = new Promise<void>((resolve) => (onDidFetch = resolve));

    void (async () => {
      await updateAvailableExtensions(context.api);
      onDidFetch();
    })();

    context.api.onAsync<"install-extension">("install-extension", async (ext) => {
      await didFetchAvailableExtensions;
      const success = await downloadAndInstallExtension(context.api, ext);

      if (success) signalRestartNeeded(context.api);
      return success;
    });

    context.api.onAsync<"await-extension-catalog">("await-extension-catalog", () => {
      return didFetchAvailableExtensions;
    });

    context.api.events.on("gamemode-activated", (gameMode: string) => {
      const state = context.api.getState();
      const game = getGame(gameMode);
      const loadedExtensions = context.api.getLoadedExtensions();

      const gameExtension = loadedExtensions.find((ext) => ext.path === game.extensionPath);
      if (!gameExtension) return;

      // TODO: use session-based key instead of the freaking name as key
      const optionalExtensions = state.session.extensions.optional[gameExtension.name];
      if (!optionalExtensions || optionalExtensions.length === 0) return;

      const missingExtensions = getMissingOptionalExtensions(optionalExtensions, loadedExtensions);
      if (missingExtensions.length === 0) return;

      const t = context.api.translate;
      context.api.sendNotification({
        id: `missing-optional-extensions-${gameExtension.name}`,
        type: "warning",
        message: "Missing Optional Extension/s",
        allowSuppress: true,
        actions: [
          {
            title: "More",
            action: (dismiss) => {
              context.api.showDialog(
                "question",
                "Missing Optional Extension/s",
                {
                  bbcode: t(
                    'Some optional extensions for "{{game}}" are missing.[br][/br][br][/br]' +
                      "Do you want to install them now?",
                    { replace: { game: game.name } },
                  ),
                  message: `Missing extensions:\n\n${missingExtensions.map((entry) => `- ${entry.id}\n`).join("")}`,
                },
                [
                  { label: "Cancel", action: () => dismiss() },
                  {
                    label: "Install",
                    action: () => {
                      dismiss();
                      const promises = missingExtensions.map((entry) =>
                        installDependency(context.api, entry.id),
                      );
                      void Promise.all(promises);
                    },
                  },
                ],
              );
            },
          },
          {
            title: "Install Extension/s",
            action: () => {
              const promises = missingExtensions.map((entry) =>
                installDependency(context.api, entry.id),
              );
              void Promise.all(promises);
            },
          },
        ],
      });
    });

    context.api.onAsync<boolean>("install-extension-from-download", async (archiveId: string) => {
      const state = context.api.getState();
      const ids = state.persistent.downloads.files[archiveId]?.modInfo?.nexus?.ids ?? {};

      const { modId, fileId } = ids;
      if (modId === undefined || fileId === undefined) return false;

      const isInstalled = findInstalled(state.app.extensions, { modId, fileId }) !== undefined;
      if (isInstalled) {
        context.api.sendNotification({
          id: "extension-already-installed",
          type: "info",
          message: "Vortex extension is already installed",
        });

        return false;
      }

      const catalogEntry = findInCatalog(state.session.extensions.available, { modId });
      if (catalogEntry === undefined) {
        context.api.sendNotification({
          id: "not-an-extension",
          type: "warning",
          title: "Archive not recognized as a Vortex extension.",
          message: "If this is a new extension it may not have been approved yet.",
        });

        return false;
      }

      const success = await downloadAndInstallExtension(context.api, catalogEntry);
      if (success) signalRestartNeeded(context.api, catalogEntry.gameName);
      return success;
    });

    context.api.events.on("show-extension-page", (modId: number) => {
      localState.preselectModId = modId;
      context.api.store.dispatch(setDialogVisible("browse-extensions"));
    });

    context.api.onStateChange(["session", "base", "extLoadFailures"], (prev, current) => {
      checkMissingDependencies(context.api, current);
    });

    {
      const state: IState = context.api.getState();
      checkMissingDependencies(context.api, state.session.base.extLoadFailures);
    }
  });

  return true;
}

export default init;
