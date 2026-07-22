import * as _ from "lodash";
import * as semver from "semver";

import { log } from "@/logging";

import { setDialogVisible, setExtensionEnabled } from "../../actions";
import { isExtSame } from "../../ExtensionManager";
import type {
  IAvailableExtension,
  IExtension,
  IExtensionDownloadInfo,
} from "../../types/extensions";
import type {
  IExtensionApi,
  IExtensionContext,
  ISupportedResult,
} from "../../types/IExtensionContext";
import type { NotificationDismiss } from "../../types/INotification";
import type { IExtensionLoadFailure, IState } from "../../types/IState";
import { getGame } from "../../util/api";
import { relaunch } from "../../util/commandLine";
import { DataInvalid, ProcessCanceled } from "../../util/CustomErrors";
import makeReactive from "../../util/makeReactive";
import { setAvailableExtensions, setExtensionsUpdate, setInstalledExtensions } from "./actions";
import BrowseExtensions from "./BrowseExtensions";
import type { IBrowseExtensionsProps } from "./BrowseExtensions";
import ExtensionManager from "./ExtensionManager";
import type { IExtensionManagerProps } from "./ExtensionManager";
import sessionReducer from "./reducers";
import { downloadAndInstallExtension, fetchAvailableExtensions, readExtensions } from "./util";

declare module "../../types/IExtensionContext" {
  interface ApiEvents {
    "install-extension": (info: IExtensionDownloadInfo) => boolean;
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
  const { available, installed } = state.session.extensions;

  const updateable = Object.values(installed).reduce<
    { current: IExtension; update: IAvailableExtension }[]
  >((prev, ext) => {
    const update = available.find((iter) => isExtSame(ext, iter));

    if (update === undefined || update.version === undefined) {
      // as of Vortex 1.8 we expect to find all extension, including the bundled ones, in the
      // list of available extensions
      if (ext.modId !== undefined) {
        log("warn", "extension not available", { ext: JSON.stringify(ext) });
      }
      return prev;
    }

    const extVer = semver.coerce(ext.version);
    const updateVer = semver.coerce(update.version);

    if (extVer === null || updateVer === null) {
      log("warn", "invalid version on extension", {
        local: ext.version,
        update: update.version,
      });
      return prev;
    }

    if (semver.gte(extVer, updateVer)) {
      return prev;
    }

    prev.push({ current: ext, update });

    return prev;
  }, []);

  let forceRestart: boolean = false;

  const { commandLine } = state.session.base;
  if (commandLine.installExtension !== undefined) {
    const request = parseInstallCmdLine(commandLine.installExtension);
    const update = available.find(
      (ext) => request.modId !== undefined && ext.modId === request.modId,
    );

    if (update !== undefined) {
      forceRestart = true;
      updateable.push({
        current: {
          author: update.author,
          description: update.description.short,
          name: update.name,
          version: "",
        },
        update,
      });
    }
  }

  if (updateable.length === 0) return;

  api.sendNotification({
    id: "extension-updates",
    type: "info",
    message: "{{ count }} extensions will be updated",
    replace: { count: updateable.length },
  });

  log("info", "extensions will be updated", {
    updateable: updateable.map(
      (ext) =>
        `${ext.current.name} v${ext.current.version} ` +
        `-> ${ext.update.name} v${ext.update.version}`,
    ),
  });

  const promises = updateable.map((update) => downloadAndInstallExtension(api, update.update));
  const success = await Promise.all(promises);

  api.dismissNotification("extension-updates");
  localState.reloadNecessary = true;

  if (success.find((iter) => iter === true)) {
    if (forceRestart) {
      relaunch();
    } else {
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
    const { time, extensions } = await Promise.resolve(fetchAvailableExtensions(true, force));
    api.store.dispatch(setExtensionsUpdate(time.getTime()));
    api.store.dispatch(setAvailableExtensions(extensions));
    await checkForUpdates(api);
  } catch (err) {
    const allowReport = !(err instanceof DataInvalid);

    api.showErrorNotification("Failed to fetch available extensions", err, {
      allowReport,
    });
  }
}

async function installDependency(
  api: IExtensionApi,
  dependencyId: string,
  updateInstalled: (initial: boolean) => Promise<void>,
): Promise<boolean> {
  const state = api.getState();
  const availableExtensions = state.session.extensions.available;
  const installedExtensions = state.session.extensions.installed;

  if (installedExtensions[dependencyId] !== undefined) {
    // installed, probably failed to load or disabled
    if (!state.app.extensions[dependencyId].enabled) {
      api.store.dispatch(setExtensionEnabled(dependencyId, true));
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

  const toDownload = availableExtensions.find(
    (iter) => !iter.type && (iter.name === dependencyId || iter.id === dependencyId),
  );

  if (toDownload === undefined) return false;

  const success = await downloadAndInstallExtension(api, toDownload);
  if (success) {
    await updateInstalled(false);
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

  const updateInstalled = genUpdateInstalledExtensions(api);

  const promises = missingDependencies.values().map((dependencyId) =>
    installDependency(api, dependencyId, updateInstalled).catch((err) => {
      api.showErrorNotification("Failed to install extension", err, {
        message: dependencyId,
      });
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
            await Promise.all(promises);
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
          })();
        },
      },
    ],
  });
}

function genUpdateInstalledExtensions(api: IExtensionApi) {
  return async (initial: boolean): Promise<void> => {
    try {
      // TODO: native Promise
      const extensions = await Promise.resolve(readExtensions(true));

      const state = api.getState();
      if (!initial && !_.isEqual(state.session.extensions.installed, extensions)) {
        if (!localState.reloadNecessary) {
          localState.reloadNecessary = true;

          // Identify newly installed game extensions so we can pass --game
          // on restart, allowing the profile manager to offer to manage it
          const oldInstalled = state.session.extensions.installed;
          const newGameExt = Object.entries(extensions).find(
            ([id, info]) => oldInstalled[id] === undefined && info.name?.startsWith("Game:"),
          );
          const relaunchArgs =
            newGameExt !== undefined ? ["--game", newGameExt[1].name] : undefined;

          api.sendNotification({
            id: "extension-updates",
            type: "success",
            message: "Extensions installed, please restart to use them",
            actions: [
              {
                title: "Restart now",
                action: () => {
                  relaunch(relaunchArgs);
                },
              },
            ],
          });
        }
      }
      api.store.dispatch(setInstalledExtensions(extensions));
    } catch (err) {
      // this probably only occurs if the user deletes the plugins directory after start
      api.showErrorNotification("Failed to read extension directory", err, {
        allowReport: false,
      });
    }
  };
}

function parseInstallCmdLine(argument: string): IExtensionDownloadInfo {
  const modIdMatch = argument.match(/modId:(\d+)/);
  if (modIdMatch != null) {
    return {
      name: "Commandline Request",
      modId: parseInt(modIdMatch[1], 10),
    };
  } else {
    throw new Error(`invalid command line argument "${argument}"`);
  }
}

function init(context: IExtensionContext) {
  const updateExtensions = genUpdateInstalledExtensions(context.api);
  context.registerReducer(["session", "extensions"], sessionReducer);

  context.registerMainPage("extensions", "Extensions", ExtensionManager, {
    priority: 20,
    hotkey: "X",
    group: "global",
    // visible: () => context.api.store.getState().settings.interface.advanced,
    props: () =>
      ({
        localState,
        updateExtensions: () => updateExtensions(false),
      }) satisfies Partial<IExtensionManagerProps>,
  });

  const forceUpdateExtensions = () => {
    void updateAvailableExtensions(context.api, true);
  };

  context.registerAction("extensions-layout-icons", 500, "refresh", {}, "Update Extensions", () => {
    forceUpdateExtensions();
  });

  context.registerDialog(
    "browse-extensions",
    BrowseExtensions,
    () =>
      ({
        localState,
        updateExtensions: () => updateExtensions(false),
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
      await updateExtensions(true);
      await updateAvailableExtensions(context.api);
      onDidFetch();
    })();

    context.api.onAsync<"install-extension">("install-extension", async (ext) => {
      await didFetchAvailableExtensions;
      const success = await downloadAndInstallExtension(context.api, ext);

      if (success) void updateExtensions(false);
      return success;
    });

    context.api.events.on("gamemode-activated", (gameMode: string) => {
      const state = context.api.getState();
      const game = getGame(gameMode);
      const gameExtId = Object.keys(state.session.extensions.installed).find(
        (key) => game.extensionPath === state.session.extensions.installed[key].path,
      );

      if (!gameExtId || !state.session.extensions.optional[gameExtId]) {
        return;
      }

      const requiredIds: string[] = [];
      for (const ext of state.session.extensions.optional[gameExtId]) {
        if (!state.session.extensions.installed[ext.id]) {
          requiredIds.push(ext.id);
        }
      }

      if (requiredIds.length > 0) {
        const t = context.api.translate;
        context.api.sendNotification({
          id: `missing-optional-extensions-${gameExtId}`,
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
                    message: `Missing extensions:\n\n${requiredIds.map((id) => `- ${id}\n`).join("")}`,
                  },
                  [
                    { label: "Cancel", action: () => dismiss() },
                    {
                      label: "Install",
                      action: () => {
                        dismiss();
                        const promises = requiredIds.map((id) =>
                          installDependency(context.api, id, updateExtensions),
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
                const promises = requiredIds.map((id) =>
                  installDependency(context.api, id, updateExtensions),
                );
                void Promise.all(promises);
              },
            },
          ],
        });
      }
    });

    context.api.onAsync<boolean>("install-extension-from-download", async (archiveId: string) => {
      const state = context.api.getState();
      const modId = state.persistent.downloads.files[archiveId]?.modInfo?.nexus?.ids?.modId;
      const ext = state.session.extensions.available.find((iter) => iter.modId === modId);
      const isInstalled =
        Object.values(state.session.extensions.installed).find(
          (inst) =>
            !!inst?.modId && // Corrupt state ? (#9935)
            inst.modId === ext?.modId &&
            inst.version === ext?.version,
        ) !== undefined;

      if (isInstalled) {
        context.api.sendNotification({
          id: "extension-already-installed",
          type: "info",
          message: "Vortex extension is already installed",
        });

        return false;
      }

      if (modId !== undefined && ext !== undefined) {
        const success = await downloadAndInstallExtension(context.api, ext);
        if (success) void updateExtensions(false);
        return success;
      } else {
        context.api.sendNotification({
          id: "not-an-extension",
          type: "warning",
          title: "Archive not recognized as a Vortex extension.",
          message: "If this is a new extension it may not have been approved yet.",
        });

        return false;
      }
    });

    context.api.events.on("show-extension-page", (modId: number) => {
      localState.preselectModId = modId;
      context.api.store.dispatch(setDialogVisible("browse-extensions"));
    });

    context.api.onStateChange(["session", "base", "extLoadFailures"], (prev, current) => {
      checkMissingDependencies(context.api, current);
    });

    {
      const state: IState = context.api.store.getState();
      checkMissingDependencies(context.api, state.session.base.extLoadFailures);
    }
  });

  return true;
}

export default init;
