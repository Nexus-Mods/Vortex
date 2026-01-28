import { actions, log, selectors, types, util } from "vortex-api";
import * as path from "path";
import * as http from "http";
import { IncomingMessage } from "http";
import * as semver from "semver";
import * as url from "url";
import { IGameSupport } from "./types";

export function checkForUpdate(
  api: types.IExtensionApi,
  gameSupport: IGameSupport,
  scriptExtenderVersion: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(gameSupport.website);
    } catch (err) {
      log("error", "Invalid website URL", {
        url: gameSupport.website,
        error: err.message,
      });
      return resolve(scriptExtenderVersion);
    }
    //const lib = parsed.protocol === 'https:' ? https : http;
    const lib = http;
    lib
      .get(parsed, (res: IncomingMessage) => {
        const { statusCode } = res;
        if (statusCode !== 200) {
          return resolve(scriptExtenderVersion);
        }
        res.setEncoding("utf8");
        let rawData = "";
        res.on("data", (chunk) => (rawData += chunk));
        res.on("end", () => {
          try {
            // We just loaded the Script Extender website. Find our download link.
            const urlpath: string = rawData.match(gameSupport.regex)[0];

            // Remove the beta tag for the file name.
            const splitName: string[] = urlpath.split(path.sep);

            // Pop the last item in the array (file name)
            const downloadName: string = splitName.pop().toString();

            // We need to clean this up to make it semantic.
            // By replacing underscores with dots, replacing double zeros with single zeros
            // and removing leading zeros.
            // If we choose not to download directly, the regex can be adjusted to find the
            // version in the text.
            const newVersion: string = downloadName
              .match(/_([0-9]+_[0-9]+_[0-9a-z]+)/i)[1]
              .replace(/\_/g, ".")
              .replace(/([a-z]+)/g, "")
              .replace(/[0]+/g, "0")
              .replace(/(0)[1-9]/g, (replacement) =>
                replacement.replace("0", ""),
              );

            // If it's still not semantic, try coercing it.
            const latestVersion: string = semver.valid(newVersion)
              ? newVersion
              : semver.coerce(newVersion).version;

            // If it's STILL not valid, exit here.
            if (!semver.valid(latestVersion)) {
              return resolve(scriptExtenderVersion);
            }
            log("debug", "Latest Version script extender", [
              gameSupport.name,
              latestVersion,
            ]);

            // If the version from the website is greater than the installed version, inform the user.
            if (semver.gt(latestVersion, scriptExtenderVersion)) {
              notifyNewVersion(
                latestVersion,
                scriptExtenderVersion,
                gameSupport,
                api,
              );
            }

            return resolve(latestVersion);
          } catch (err) {
            log("warn", "Error geting script extender data", err.message);
            return resolve(scriptExtenderVersion);
          }
        });
      })
      .on("error", (err: Error) => {
        log("warn", "Error getting script extender data", err.message);
        return resolve(scriptExtenderVersion);
      });
  });
}

function notifyNewVersion(
  latest: string,
  current: string,
  gameSupportData: IGameSupport,
  api: types.IExtensionApi,
) {
  // Raise a notification.
  api.sendNotification({
    type: "info",
    id: `scriptextender-update-${gameSupportData.gameId}`,
    allowSuppress: true,
    title: "Update for {{name}}",
    message: "Latest: {{latest}}, Installed: {{current}}",
    replace: {
      name: gameSupportData.name,
      latest,
      current,
    },
    actions: [
      {
        title: "More",
        action: (dismiss: () => void) => {
          api.showDialog(
            "info",
            "Script Extender Update",
            {
              text:
                "Vortex has detected a newer version of {{name}} ({{latest}}) available to download from {{website}}. You currently have version {{current}} installed." +
                "\nThe buttons below will open the script extender download page where you can download it directly into Vortex or through your browser. Please ensure you select the correct build for your game version. " +
                "\n\nIf you ignore this message, Vortex will not remind you again until you restart it.",
              parameters: {
                name: gameSupportData.name,
                latest,
                website: gameSupportData.website,
                current,
              },
            },
            dialogActions(api, gameSupportData, dismiss),
          );
        },
      },
    ],
  });
}

export function notifyNotInstalled(
  gameSupportData: IGameSupport,
  api: types.IExtensionApi,
) {
  const t = api.translate;

  api.sendNotification({
    type: "info",
    id: `scriptextender-missing-${gameSupportData.gameId}`,
    allowSuppress: true,
    message: "{{name}} not installed",
    replace: { name: gameSupportData.name },
    actions: [
      {
        title: "More",
        action: (dismiss) => {
          api.showDialog(
            "info",
            `{{name}} not found`,
            {
              text:
                "Vortex could not detect {{name}}. This means it is either not installed or installed incorrectly." +
                "\n\nFor the best modding experience, we recommend installing the script extender by visiting {{website}}, Vortex can open the download page using the options below." +
                "\n\nIf you ignore this notice, Vortex will not remind you again until it is restarted.",
              parameters: {
                name: gameSupportData.name,
                website: gameSupportData.website,
              },
            },
            dialogActions(api, gameSupportData, dismiss),
          );
        },
      },
    ],
  });
}

function dialogActions(
  api: types.IExtensionApi,
  gameSupportData: IGameSupport,
  dismiss: () => void,
): types.IDialogAction[] {
  const t = api.translate;
  const state = api.store.getState();
  const activeProfile: types.IProfile = selectors.activeProfile(state);
  return [
    {
      label: "Ignore",
      action: () => {
        // Ignore this update until Vortex is restarted.
        gameSupportData.ignore = true;
        dismiss();
      },
    },
    {
      label: "Open in Vortex",
      action: () => {
        const instructions = t(
          "To install {{name}}, download the latest 7z archive for {{gameName}}.",
          {
            replace: {
              name: gameSupportData.name,
              gameName: gameSupportData.gameName,
            },
          },
        );
        // Open the script extender site in Vortex.
        api
          .emitAndAwait(
            "browse-for-download",
            gameSupportData.website,
            instructions,
          )
          .then((result: string[]) => {
            if (!result || !result.length) {
              // If the user clicks outside the window without downloading.
              return Promise.reject(new util.UserCanceled());
            }
            const downloadUrl = result[0].indexOf("<")
              ? result[0].split("<")[0]
              : result[0];
            const correctFile = downloadUrl.match(gameSupportData.regex);
            if (!!correctFile) {
              const dlInfo = {
                game: gameSupportData.gameId,
                name: gameSupportData.name,
              };
              api.events.emit(
                "start-download",
                [downloadUrl],
                dlInfo,
                undefined,
                (error, id) => {
                  if (error !== null) {
                    if (
                      error.name === "AlreadyDownloaded" &&
                      error.downloadId !== undefined
                    ) {
                      // if the file was already downloaded then that's fine, just install
                      // that file
                      id = error.downloadId;
                    } else {
                      // Possibly redundant error notification ?
                      api.showErrorNotification("Download failed", error, {
                        allowReport: false,
                      });
                      dismiss();
                      return Promise.resolve();
                    }
                  }
                  api.events.emit(
                    "start-install-download",
                    id,
                    true,
                    async (err, modId) => {
                      if (err) {
                        // Error notification gets reported by the event listener
                        log("error", "Error installing download", err.message);
                      } else {
                        // It's safe to assume that if the user chose to download and install
                        //  the new script extender, he also expects it to be enabled and deployed
                        //  straight away.
                        if (activeProfile?.id !== undefined) {
                          // Disable existing SE mods
                          const mods = util.getSafe(
                            api.store.getState(),
                            ["persistent", "mods", activeProfile.gameId],
                            {},
                          );

                          const modArray = Object.keys(mods).map(
                            (k) => mods[k],
                          );
                          const scriptExtenders = modArray.filter((mod) => {
                            const isScriptExtender = util.getSafe(
                              mod,
                              ["attributes", "scriptExtender"],
                              false,
                            );

                            const isEnabled = util.getSafe(
                              activeProfile,
                              ["modState", mod.id, "enabled"],
                              false,
                            );

                            return isScriptExtender && isEnabled;
                          });
                          // Disable any other copies of the script extender
                          scriptExtenders.forEach((se) =>
                            api.store.dispatch(
                              actions.setModEnabled(
                                activeProfile.id,
                                se.id,
                                false,
                              ),
                            ),
                          );
                          // Enable the new script extender mod
                          api.store.dispatch(
                            actions.setModEnabled(
                              activeProfile.id,
                              modId,
                              true,
                            ),
                          );
                          // Force-deploy the xSE files
                          await api.emitAndAwait(
                            "deploy-single-mod",
                            activeProfile.gameId,
                            modId,
                            true,
                          );
                          // Refresh the tools dashlet (does this actually work?)
                          await api.emitAndAwait(
                            "discover-tools",
                            activeProfile.gameId,
                          );
                          // Set the xSE tool as primary.
                          api.store.dispatch({
                            type: "SET_PRIMARY_TOOL",
                            payload: {
                              gameId: activeProfile.gameId,
                              toolId: gameSupportData.toolId,
                            },
                          });
                          // api.store.dispatch(
                          //   actions.setDeploymentNecessary(activeProfile.gameId, true)
                          // );
                        }
                      }
                      dismiss();
                      return Promise.resolve();
                    },
                  );
                },
                "never",
                { allowInstall: false },
              );
            } else {
              api.sendNotification({
                type: "warning",
                id: "scriptextender-wrong",
                title: t("Script Extender Mismatch - {{file}}", {
                  replace: { file: path.basename(downloadUrl) },
                }),
                message: t(
                  "Looks like you selected the wrong file. Please try again.",
                ),
              });
            }
          })
          .catch((err) => {
            if (err instanceof util.UserCanceled) {
              return log(
                "info",
                "User clicked outside the browser without downloading. Script extender update cancelled.",
              );
            }
            api.showErrorNotification("Error browsing for download", err);
          });
      },
    },
    {
      label: "Open in browser",
      action: () => {
        // Open the script extender site in Vortex.
        util.opn(gameSupportData.website).catch(() => undefined);
        dismiss();
      },
    },
  ];
}
