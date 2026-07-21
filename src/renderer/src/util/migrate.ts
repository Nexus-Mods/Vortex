import { mkdir, readdir, rename, rmdir, stat } from "node:fs/promises";
import * as path from "path";

import { getErrorCode } from "@vortex/shared";
import PromiseBB from "bluebird";
import type * as Redux from "redux";
import * as semver from "semver";
import format from "string-template";

import {
  clearOAuthCredentials,
  completeMigration,
  setForcedLogout,
  setDownloadPath,
  setInstallPath,
  setProfilesVisible,
  setUseModernLayout,
  setUserAPIKey,
  setUserInfo,
} from "../actions";
import { setCompatibleGames } from "../extensions/download_management/actions/state";
import { downloadPathForGame } from "../extensions/download_management/selectors";
import getDownloadPath from "../extensions/download_management/util/getDownloadPath";
import { knownGames } from "../extensions/gamemode_management/selectors";
import type { IGameStored } from "../extensions/gamemode_management/types/IGameStored";
import resolvePath, { pathDefaults } from "../extensions/mod_management/util/resolvePath";
import { convertGameIdReverse } from "../extensions/nexus_integration/util/convertGameId";
import { healStoragePathNameActions } from "../extensions/nexus_integration/util/healStoragePathNames";
import { activeGameId } from "../extensions/profile_management/selectors";
import { log } from "../logging";
import type { IState } from "../types/IState";
import { UserCanceled } from "./CustomErrors";
import * as fs from "./fs";
import makeCI from "./makeCaseInsensitive";
import { batchDispatch } from "./util";

interface IMigration {
  id: string;
  minVersion: string;
  maySkip: boolean;
  doQuery: boolean;
  description: string;
  apply: (store: Redux.Store<IState>) => PromiseBB<void> | Promise<void>;
}

function selectDirectory(defaultPathPattern: string): PromiseBB<string> {
  const defaultPath = getDownloadPath(defaultPathPattern, undefined);
  return fs
    .ensureDirWritableAsync(defaultPath, () => PromiseBB.resolve())
    .then(() =>
      window.api.dialog.showOpen({
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
            ? fs.ensureDirWritableAsync(filePaths[0], () => PromiseBB.resolve()).then(() => [])
            : PromiseBB.reject(err);
        })
        .then((files) => {
          if (files.length > 0) {
            void window.api.dialog.showErrorBox(
              "Invalid path selected",
              "The directory needs to be empty",
            );
            return selectDirectory(defaultPathPattern);
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
    (statOld: fs.Stats, statNew: fs.Stats) => PromiseBB.resolve(statOld.dev === statNew.dev),
  )
    .then((sameVolume: boolean) => {
      const func = sameVolume ? fs.renameAsync : fs.copyAsync;
      return PromiseBB.resolve(fs.readdirAsync(from))
        .map((fileName: string) =>
          func(path.join(from, fileName), path.join(to, fileName)).catch((err) =>
            getErrorCode(err) === "EXDEV"
              ? // EXDEV implies we tried to rename when source and destination are
                // not in fact on the same volume. This is what comparing the stat.dev
                // was supposed to prevent.
                fs.copyAsync(path.join(from, fileName), path.join(to, fileName))
              : PromiseBB.reject(err),
          ),
        )
        .then(() => fs.removeAsync(from));
    })
    .catch((err) => (getErrorCode(err) === "ENOENT" ? PromiseBB.resolve() : PromiseBB.reject(err)));
}

function dialogProm(
  type: string,
  title: string,
  message: string,
  options: string[],
): PromiseBB<string> {
  return PromiseBB.resolve(
    window.api.dialog.showMessageBox({
      type: type as "none" | "info" | "error" | "question" | "warning",
      buttons: options,
      title,
      message,
      noLink: true,
    }),
  ).then((result) => options[result.response]);
}

function forceLogoutForOauth_1_9(store: Redux.Store<IState>): PromiseBB<void> {
  const state = store.getState();

  const apiKey = state.confidential.account?.["nexus"]?.["APIKey"];
  const oauthCred = state.confidential.account?.["nexus"]?.["OAuthCredentials"];

  const loggedIn = apiKey !== undefined || oauthCred !== undefined;

  log("info", "forceLogoutForOauth_1_9() migration function for pre-oauth (1.9) versions", {
    apiKey: apiKey,
    oauthCred: oauthCred,
    loggedIn: loggedIn,
  });

  // we only care about forcing re-authing if they are logged in already
  if (!loggedIn) {
    log("warn", "forceLogoutForOauth_1_9() not logged in so skipping migration");
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

function moveDownloads_0_16(store: Redux.Store<IState>): PromiseBB<void> {
  const state = store.getState();
  log("info", "importing downloads from pre-0.16.0 version");
  return dialogProm(
    "info",
    "Moving Downloads",
    "On the next screen, please select an empty directory where all your " +
      "downloads from vortex (for all games) will be placed",
    ["Next"],
  )
    .then(() => selectDirectory(state.settings.downloads.path))
    .then((downloadPath) => {
      store.dispatch(setDownloadPath(downloadPath));
      return PromiseBB.map(Object.keys(state.settings.gameMode.discovered), (gameId) => {
        const resolvedPath = path.join(downloadPath, gameId);
        return fs
          .ensureDirAsync(resolvedPath)
          .then(() =>
            transferPath(
              resolvePath("download", (state.settings.mods as any).paths, gameId),
              resolvedPath,
            ),
          );
      }).then(() => {});
    });
}

function updateInstallPath_0_16(store: Redux.Store<IState>): PromiseBB<void> {
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

function enableModernLayout_2_0(store: Redux.Store<IState>): PromiseBB<void> {
  batchDispatch(store, [setUseModernLayout(true), setProfilesVisible(true)]);
  return PromiseBB.resolve();
}

async function moveDomainFile(src: string, dest: string): Promise<boolean> {
  try {
    await stat(dest);
    // Destination already exists; leave both in place rather than overwrite.
    return false;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }
  try {
    await stat(src);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw err;
  }
  await mkdir(path.dirname(dest), { recursive: true });
  await rename(src, dest);
  return true;
}

// Ordered list of loaded game ids that share the same nexusPageId as `domain`.
// First entry is the preferred internal: active game wins when multiple
// candidates qualify, otherwise convertGameIdReverse's hardcoded fallback.
// Returns `[]` when there's nothing to remap (unknown domain, or the domain
// is already its own preferred internal).
function resolveDomainCandidates(
  games: IGameStored[],
  activeId: string | undefined,
  domain: string,
): string[] {
  const matches = games.filter(
    (g) => g.id === domain.toLowerCase() || (g.details && g.details.nexusPageId === domain),
  );
  if (matches.length === 0) {
    const fallback = convertGameIdReverse(games, domain) || domain;
    return fallback === domain ? [] : [fallback];
  }
  let preferred: string | undefined;
  if (activeId !== undefined) {
    preferred = matches.find((g) => g.id === activeId)?.id;
  }
  if (preferred === undefined) {
    const fallback = convertGameIdReverse(games, domain);
    preferred = matches.find((g) => g.id === fallback)?.id ?? matches[0].id;
  }
  if (preferred === domain) return [];
  return Array.from(new Set([preferred, ...matches.map((g) => g.id)]));
}

async function tryMoveAndLog(
  src: string,
  dest: string,
  context: Record<string, unknown>,
): Promise<void> {
  try {
    const moved = await moveDomainFile(src, dest);
    if (moved) {
      log("info", "migration: moved download archive", { ...context, src, dest });
    }
  } catch (err) {
    // Keep going: state still gets rewritten so the install handler points
    // at the right folder once the user re-downloads.
    log("warn", "migration: failed to move download archive", {
      ...context,
      src,
      dest,
      err: (err as Error).message,
    });
  }
}

// Fixes the v2.1 regression where some callers passed Nexus domains as
// `modInfo.game`, causing downloads to land in `downloads/<domain>/` while
// install lookups key on the internal id. Rewrites `download.game` so the
// preferred internal comes first, moves the file to the matching folder, and
// sweeps any orphans left behind in domain-named directories.
async function moveDomainFolders_2_1(store: Redux.Store<IState>): Promise<void> {
  const state = store.getState();
  const downloads = state.persistent.downloads?.files ?? {};
  const games = knownGames(state);
  const activeId = activeGameId(state);

  const candidatesByDomain = new Map<string, string[]>();
  const stateActions: Redux.AnyAction[] = [];

  for (const dlId of Object.keys(downloads)) {
    const dl = downloads[dlId];
    const first = Array.isArray(dl.game) ? dl.game[0] : undefined;
    if (!first) continue;

    if (!candidatesByDomain.has(first)) {
      candidatesByDomain.set(first, resolveDomainCandidates(games, activeId, first));
    }
    const candidates = candidatesByDomain.get(first);
    if (candidates === undefined || candidates.length === 0) continue;
    const internal = candidates[0];

    if (dl.localPath) {
      await tryMoveAndLog(
        path.join(downloadPathForGame(state, first), dl.localPath),
        path.join(downloadPathForGame(state, internal), dl.localPath),
        { dlId },
      );
    }

    // All loaded candidates land in download.game so the install handler can
    // pick the right one regardless of which game the user is on at install
    // time. `Set` collapses any overlap with dl.game while preserving order.
    stateActions.push(setCompatibleGames(dlId, Array.from(new Set([...candidates, ...dl.game]))));
  }

  // Sweep orphan files left in domain folders (downloads dropped from state
  // earlier but still present on disk). Only run for domains we actually
  // remapped above.
  let folderPairs = 0;
  for (const [domain, candidates] of candidatesByDomain) {
    if (candidates.length === 0) continue;
    const internal = candidates[0];
    folderPairs += 1;

    const fromPath = downloadPathForGame(state, domain);
    const toPath = downloadPathForGame(state, internal);
    let leftover: string[];
    try {
      leftover = await readdir(fromPath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") continue;
      log("warn", "migration: failed to scan domain folder", {
        fromPath,
        err: (err as Error).message,
      });
      continue;
    }
    for (const name of leftover) {
      await tryMoveAndLog(path.join(fromPath, name), path.join(toPath, name), { domain });
    }
    // Best-effort: folder stays if anything got skipped (collision, perms).
    try {
      await rmdir(fromPath);
    } catch {
      // ignored
    }
  }

  if (stateActions.length > 0) {
    batchDispatch(store, stateActions);
  }
  log("info", "migration: domain folders normalized", {
    rewroteDownloads: stateActions.length,
    folderPairs,
  });
}

function healStoragePathNames_2_4(store: Redux.Store<IState>): PromiseBB<void> {
  const actions = healStoragePathNameActions(store.getState());
  if (actions.length > 0) {
    log("info", "migration: healing storage-path polluted names", {
      count: actions.length,
    });
    batchDispatch(store, actions);
  }
  return PromiseBB.resolve();
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
    description: "forcing logout for anything pre-oauth, and deprecating apikey logins",
    apply: forceLogoutForOauth_1_9,
  },
  {
    id: "enableModernLayout_2_0",
    minVersion: "2.0.0",
    maySkip: false,
    doQuery: false,
    description: "Switch to Modern UI layout for 2.0",
    apply: enableModernLayout_2_0,
  },
  {
    id: "moveDomainFolders_2_1",
    // Bug shipped first in 2.1.0-beta.4 (first public 2.1 beta); fix lands in
    // 2.1.0-beta.5. Targeting the fix version covers the entire affected
    // cohort (semver: any pre-release < the corresponding release).
    minVersion: "2.1.0-beta.5",
    maySkip: false,
    doQuery: false,
    description:
      "Move downloads saved under Nexus domain folders (e.g. skyrimspecialedition) " +
      "to the internal-id folder (skyrimse) used by the rest of Vortex.",
    apply: moveDomainFolders_2_1,
  },
  {
    id: "healStoragePathNames_2_4",
    // Bug shipped in 2.4.0-beta.1 (LAZ-807); fix lands in 2.4.0-beta.2.
    // Targeting the fix version covers the entire affected cohort.
    minVersion: "2.4.0-beta.2",
    maySkip: false,
    doQuery: false,
    description:
      "Repair mod and download names polluted with CDN storage paths " +
      '("5c/d3/1f/<guid>") by 2.4.0-beta.1.',
    apply: healStoragePathNames_2_4,
  },
];

function queryMigration(migration: IMigration): PromiseBB<boolean> {
  if (!migration.doQuery) {
    return PromiseBB.resolve(true);
  }
  return new PromiseBB((resolve, reject) => {
    const buttons = migration.maySkip ? ["Cancel", "Skip", "Continue"] : ["Cancel", "Continue"];
    void window.api.dialog
      .showMessageBox({
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

function queryContinue(err: Error): PromiseBB<void> {
  return dialogProm(
    "error",
    "Migration failed",
    "A migration step failed. You should quit now and resolve the cause of the issue.\n" +
      err.stack || err.message,
    ["Ignore", "Quit"],
  ).then((selection) => (selection === "Ignore" ? PromiseBB.resolve() : PromiseBB.reject(err)));
}

function migrate(store: Redux.Store<IState>, oldVersion?: string): PromiseBB<void> {
  const state = store.getState();
  // Callers should pass the *prior* persisted appVersion: in v2.x renderer
  // startup, `state.app.appVersion` is overwritten with the current version
  // by `applyAppMetadata` before any migration code gets to run, which would
  // make the semver filter below trivially false.
  const effectiveOldVersion = oldVersion ?? state.app.appVersion ?? "0.0.0";
  const alreadyApplied = state.app.migrations ?? [];

  const neccessaryMigrations = migrations
    .filter((mig) => semver.lt(effectiveOldVersion, mig.minVersion))
    .filter((mig) => alreadyApplied.indexOf(mig.id) === -1);
  return PromiseBB.each(neccessaryMigrations, (migration) =>
    queryMigration(migration)
      .then((proceed: boolean) => (proceed ? migration.apply(store) : PromiseBB.resolve()))
      .then(() => {
        store.dispatch(completeMigration(migration.id));
        return PromiseBB.resolve();
      })
      .catch((err: Error) => {
        if (err instanceof UserCanceled) {
          throw err;
        }
        return queryContinue(err);
      }),
  ).then(() => {});
}

export default migrate;
