import getDownloadPath from "../extensions/download_management/util/getDownloadPath";
import resolvePath, {
  pathDefaults,
} from "../extensions/mod_management/util/resolvePath";
import type { IState } from "../types/IState";

import {
  clearOAuthCredentials,
  completeMigration,
  setForcedLogout,
  setDownloadPath,
  setInstallPath,
  setUserAPIKey,
  setUserInfo,
} from "../actions";
import * as fs from "./fs";
import makeCI from "./makeCaseInsensitive";

import { UserCanceled } from "./CustomErrors";
import { log } from "./log";

import PromiseBB from "bluebird";
import type { BrowserWindow } from "electron";
import { dialog } from "electron";
import * as path from "path";
import type * as Redux from "redux";
import * as semver from "semver";
import format from "string-template";
import { getErrorCode } from "@vortex/shared";

interface IMigration {
  id: string;
  minVersion: string;
  maySkip: boolean;
  doQuery: boolean;
  description: string;
  apply: (
    window: BrowserWindow | null,
    store: Redux.Store<IState>,
  ) => PromiseBB<void>;
}

function selectDirectory(
  window: BrowserWindow | null,
  defaultPathPattern: string,
): PromiseBB<string> {
  const defaultPath = getDownloadPath(defaultPathPattern, undefined);
  return fs
    .ensureDirWritableAsync(defaultPath, () => PromiseBB.resolve())
    .then(() =>
      dialog.showOpenDialog(window, {
        title: "Select empty directory to store downloads",
        properties: ["openDirectory", "createDirectory", "promptToCreate"],
        defaultPath,
      }),
    )
    .then((result) => {
      const { filePaths } = result;
      if (filePaths === undefined || filePaths.length === 0) {
        return PromiseBB.reject(new UserCanceled());
      }
      return fs
        .readdirAsync(filePaths[0])
        .catch((err) => {
          const code = getErrorCode(err);
          return code === "ENOENT"
            ? fs
                .ensureDirWritableAsync(filePaths[0], () => PromiseBB.resolve())
                .then(() => [])
            : PromiseBB.reject(err);
        })
        .then((files) => {
          if (files.length > 0) {
            dialog.showErrorBox(
              "Invalid path selected",
              "The directory needs to be empty",
            );
            return selectDirectory(window, defaultPathPattern);
          } else {
            return PromiseBB.resolve(filePaths[0]);
          }
        });
    });
}

function transferPath(from: string, to: string): PromiseBB<void> {
  return PromiseBB.join(
    fs.statAsync(from),
    fs.statAsync(to),
    (statOld: fs.Stats, statNew: fs.Stats) =>
      PromiseBB.resolve(statOld.dev === statNew.dev),
  )
    .then((sameVolume: boolean) => {
      const func = sameVolume ? fs.renameAsync : fs.copyAsync;
      return PromiseBB.resolve(fs.readdirAsync(from))
        .map((fileName: string) =>
          func(path.join(from, fileName), path.join(to, fileName)).catch(
            (err) =>
              getErrorCode(err) === "EXDEV"
                ? // EXDEV implies we tried to rename when source and destination are
                  // not in fact on the same volume. This is what comparing the stat.dev
                  // was supposed to prevent.
                  fs.copyAsync(
                    path.join(from, fileName),
                    path.join(to, fileName),
                  )
                : PromiseBB.reject(err),
          ),
        )
        .then(() => fs.removeAsync(from));
    })
    .catch((err) =>
      getErrorCode(err) === "ENOENT"
        ? PromiseBB.resolve()
        : PromiseBB.reject(err),
    );
}

function dialogProm(
  window: BrowserWindow | null,
  type: string,
  title: string,
  message: string,
  options: string[],
): PromiseBB<string> {
  return PromiseBB.resolve(
    dialog.showMessageBox(window, {
      type: type as "none" | "info" | "error" | "question" | "warning",
      buttons: options,
      title,
      message,
      noLink: true,
    }),
  ).then((result) => options[result.response]);
}

function forceLogoutForOauth_1_9(
  window: BrowserWindow,
  store: Redux.Store<IState>,
): PromiseBB<void> {
  const state = store.getState();

  const apiKey = state.confidential.account?.["nexus"]?.["APIKey"];
  const oauthCred = state.confidential.account?.["nexus"]?.["OAuthCredentials"];

  const loggedIn = apiKey !== undefined || oauthCred !== undefined;

  log(
    "info",
    "forceLogoutForOauth_1_9() migration function for pre-oauth (1.9) versions",
    {
      apiKey: apiKey,
      oauthCred: oauthCred,
      loggedIn: loggedIn,
    },
  );

  // we only care about forcing re-authing if they are logged in already
  if (!loggedIn) {
    log(
      "warn",
      "forceLogoutForOauth_1_9() not logged in so skipping migration",
    );
    return PromiseBB.resolve();
  }

  // this is going to force a logout and set the ForceLogout flag in the state so that the nexus_integration extension can pick up the change
  store.dispatch(setUserAPIKey(undefined));
  store.dispatch(clearOAuthCredentials(null));
  store.dispatch(setUserInfo(undefined));
  store.dispatch(setForcedLogout(true));

  log("info", "forceLogoutForOauth_1_9() should be logged out");

  return PromiseBB.resolve();
}

function moveDownloads_0_16(
  window: BrowserWindow,
  store: Redux.Store<IState>,
): PromiseBB<void> {
  const state = store.getState();
  log("info", "importing downloads from pre-0.16.0 version");
  return dialogProm(
    window,
    "info",
    "Moving Downloads",
    "On the next screen, please select an empty directory where all your " +
      "downloads from vortex (for all games) will be placed",
    ["Next"],
  )
    .then(() => selectDirectory(window, state.settings.downloads.path))
    .then((downloadPath) => {
      store.dispatch(setDownloadPath(downloadPath));
      return PromiseBB.map(
        Object.keys(state.settings.gameMode.discovered),
        (gameId) => {
          const resolvedPath = path.join(downloadPath, gameId);
          return fs
            .ensureDirAsync(resolvedPath)
            .then(() =>
              transferPath(
                resolvePath(
                  "download",
                  (state.settings.mods as any).paths,
                  gameId,
                ),
                resolvedPath,
              ),
            );
        },
      ).then(() => {});
    });
}

function updateInstallPath_0_16(
  window: BrowserWindow,
  store: Redux.Store<IState>,
): PromiseBB<void> {
  const state = store.getState();
  const { paths } = state.settings.mods as any;
  return PromiseBB.map(Object.keys(paths || {}), (gameId) => {
    const base = resolvePath("base", paths, gameId);
    log(
      "info",
      "set install path",
      format(paths[gameId].install || pathDefaults.install, { base }),
    );
    store.dispatch(
      setInstallPath(
        gameId,
        format(
          paths[gameId].install || pathDefaults.install,
          makeCI({
            base,
            game: "{GAME}",
            userData: "{USERDATA}",
          }),
        ),
      ),
    );
    return PromiseBB.resolve();
  }).then(() => {});
}

const migrations: IMigration[] = [
  {
    id: "move-downloads-0.16",
    minVersion: "0.16.0",
    maySkip: false,
    doQuery: true,
    description:
      "The directory structure for downloads was changed so we need to move them. " +
      "Please note: there will be no progress indication, please be patient.",
    apply: moveDownloads_0_16,
  },
  {
    id: "update-install-path-0.16",
    minVersion: "0.16.0",
    maySkip: false,
    doQuery: false,
    description: "install path is now in a different spot of the store",
    apply: updateInstallPath_0_16,
  },
  {
    id: "forceLogoutForOauth_1_9",
    minVersion: "1.9.0",
    maySkip: false,
    doQuery: false,
    description:
      "forcing logout for anything pre-oauth, and deprecating apikey logins",
    apply: forceLogoutForOauth_1_9,
  },
];

function queryMigration(
  window: BrowserWindow | null,
  migration: IMigration,
): PromiseBB<boolean> {
  if (!migration.doQuery) {
    return PromiseBB.resolve(true);
  }
  return new PromiseBB((resolve, reject) => {
    const buttons = migration.maySkip
      ? ["Cancel", "Skip", "Continue"]
      : ["Cancel", "Continue"];
    dialog
      .showMessageBox(window, {
        type: "info",
        buttons,
        title: "Migration necessary",
        message: migration.description,
        noLink: true,
      })
      .then((result) => {
        if (buttons[result.response] === "Cancel") {
          return reject(new UserCanceled());
        }
        return resolve(buttons[result.response] === "Continue");
      });
  });
}

function queryContinue(
  window: BrowserWindow | null,
  err: Error,
): PromiseBB<void> {
  return dialogProm(
    window,
    "error",
    "Migration failed",
    "A migration step failed. You should quit now and resolve the cause of the issue.\n" +
      err.stack || err.message,
    ["Ignore", "Quit"],
  ).then((selection) =>
    selection === "Ignore" ? PromiseBB.resolve() : PromiseBB.reject(err),
  );
}

function migrate(
  store: Redux.Store<IState>,
  window: BrowserWindow | null,
): PromiseBB<void> {
  const state = store.getState();
  const oldVersion = state.app.appVersion || "0.0.0";
  const neccessaryMigrations = migrations
    .filter((mig) => semver.lt(oldVersion, mig.minVersion))
    .filter((mig) => state.app.migrations.indexOf(mig.id) === -1);
  return PromiseBB.each(neccessaryMigrations, (migration) =>
    queryMigration(window, migration)
      .then((proceed: boolean) =>
        proceed ? migration.apply(window, store) : PromiseBB.resolve(),
      )
      .then(() => {
        store.dispatch(completeMigration(migration.id));
        return PromiseBB.resolve();
      })
      .catch((err: Error) => {
        if (err instanceof UserCanceled) {
          throw err;
        }
        return queryContinue(window, err);
      }),
  ).then(() => {});
}

export default migrate;
