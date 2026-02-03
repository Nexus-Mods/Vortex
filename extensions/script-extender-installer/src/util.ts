import * as Bluebird from "bluebird";
import { fs, selectors, types, log } from "vortex-api";
import supportData from "./gameSupport";
import { IGameSupport } from "./types";
import getVersion from "exe-version";
import * as semver from "semver";

const getGameStore = (
  gameId: string,
  api: types.IExtensionApi,
): string | undefined =>
  selectors.discoveryByGame(api.getState(), gameId)["store"];

const getScriptExtenderVersion = (extenderPath: string): Promise<string> => {
  // Check the file we're looking for actually exists.
  return new Promise((resolve, reject) => {
    fs.statAsync(extenderPath)
      .then(() => {
        // The exe versions appear to have a leading zero. So we need to cut it off.
        let exeVersion = getVersion(extenderPath);
        exeVersion = exeVersion.startsWith("0")
          ? exeVersion.substr(exeVersion.indexOf("."), exeVersion.length)
          : exeVersion;
        return resolve(semver.coerce(exeVersion).version);
      })
      .catch(() => {
        // Return a blank string if the file doesn't exist.
        log("debug", "Script extender not found:", extenderPath);
        return resolve(undefined);
      });
  });
};

const getGamePath = (gameId: string, api): string => {
  const state: types.IState = api.store.getState();
  const discovery = state.settings.gameMode.discovered[gameId];
  if (discovery !== undefined) {
    return discovery.path;
  } else {
    return undefined;
  }
};

function toBlue<T>(
  func: (...args: any[]) => Promise<T>,
): (...args: any[]) => Bluebird<T> {
  return (...args: any[]) => Bluebird.resolve(func(...args));
}

function clearNotifications(
  api: types.IExtensionApi,
  preserveMissing?: boolean,
) {
  Object.keys(supportData).forEach((key) => {
    if (!preserveMissing) {
      api.dismissNotification(`scriptextender-missing-${key}`);
    }
    api.dismissNotification(`scriptextender-update-${key}`);
  });
}

function ignoreNotifications(gameSupport: IGameSupport) {
  // Allows the github downloader to set the ignore flag.
  const match = Object.keys(supportData).find(
    (key) => key === gameSupport.gameId,
  );
  supportData[match].ignore = true;
}

export {
  getGameStore,
  getScriptExtenderVersion,
  getGamePath,
  toBlue,
  clearNotifications,
  ignoreNotifications,
};
