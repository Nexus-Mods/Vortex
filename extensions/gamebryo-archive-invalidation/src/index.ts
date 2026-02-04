import filesNewer from "./util/filesNewer";
import {
  bsaVersion,
  fileFilter,
  iniPath,
  initGameSupport,
  isSupported,
  targetAge,
} from "./util/gameSupport";
import Settings from "./views/Settings";

import { toggleInvalidation } from "./bsaRedirection";
import { REDIRECTION_MOD } from "./constants";

import I18next from "i18next";
import * as path from "path";
import {} from "redux-thunk";
import { actions, fs, log, selectors, types, util } from "vortex-api";
import { IniFile } from "vortex-parse-ini";

function testArchivesAge(api: types.IExtensionApi) {
  const state: types.IState = api.store.getState();
  const gameId = selectors.activeGameId(state);

  if (!isSupported(gameId)) {
    return Promise.resolve(undefined);
  }

  const gamePath: string = util.getSafe(
    state,
    ["settings", "gameMode", "discovered", gameId, "path"],
    undefined,
  );

  if (gamePath === undefined) {
    // TODO: happened in testing, but how does one get here with no path configured?
    return Promise.resolve(undefined);
  }

  const game = util.getGame(gameId);
  const dataPath = game.getModPaths(gamePath)[""];

  const age = targetAge(gameId);
  if (age === undefined) {
    return Promise.resolve(undefined);
  }

  const t = api.translate;
  return filesNewer(dataPath, fileFilter(gameId), age)
    .then((files: string[]) => {
      if (files.length === 0) {
        return Promise.resolve(undefined);
      }
      return Promise.all(
        files.map((file) =>
          fs.utimesAsync(
            path.join(dataPath, file),
            age.getTime() / 1000,
            age.getTime() / 1000,
          ),
        ),
      ).then(() => {
        log(
          "info",
          `Updated timestamps on ${files.length} archive files for game ${gameId}`,
        );
        return Promise.resolve(undefined);
      });
    })
    .catch((err: Error) => {
      const canceled =
        err instanceof util.ProcessCanceled || err instanceof util.UserCanceled;
      api.showErrorNotification("Failed to read bsa/ba2 files.", err, {
        allowReport:
          !canceled && !["ENOENT", "EPERM"].includes((err as any).code),
      });
      return Promise.resolve(undefined);
    });
}

function applyIniSettings(
  api: types.IExtensionApi,
  profile: types.IProfile,
  iniFile: IniFile<any>,
) {
  if (iniFile.data.Archive === undefined) {
    iniFile.data.Archive = {};
  }
  iniFile.data.Archive.bInvalidateOlderFiles = 1;
  iniFile.data.Archive.sResourceDataDirsFinal = "";
}

interface IToDoProps {
  gameMode: string;
  mods: { [id: string]: types.IMod };
}

function useBSARedirection(gameMode: string) {
  return isSupported(gameMode) && bsaVersion(gameMode) !== undefined;
}

function init(context: types.IExtensionContext): boolean {
  initGameSupport(context.api);
  context.registerTest(
    "archive-backdate",
    "gamemode-activated",
    () => testArchivesAge(context.api) as any,
  );

  context.registerToDo(
    "bsa-redirection",
    "workaround",
    (state: types.IState): IToDoProps => {
      const gameMode = selectors.activeGameId(state);
      return {
        gameMode,
        mods: util.getSafe(state, ["persistent", "mods", gameMode], {}),
      };
    },
    "workaround",
    "Archive Invalidation",
    (props: IToDoProps) => toggleInvalidation(context.api, props.gameMode),
    (props: IToDoProps) => useBSARedirection(props.gameMode),
    (t: typeof I18next.t, props: IToDoProps) =>
      props.mods[REDIRECTION_MOD] !== undefined ? t("Yes") : t("No"),
    undefined,
  );

  (context.registerSettings as any)("Workarounds", Settings, undefined, () =>
    useBSARedirection(selectors.activeGameId(context.api.store.getState())),
  );

  context.once(() => {
    context.api.onAsync(
      "apply-settings",
      (profile: types.IProfile, filePath: string, ini: IniFile<any>) => {
        log("debug", "apply AI settings", { gameId: profile.gameId, filePath });
        if (
          isSupported(profile.gameId) &&
          filePath.toLowerCase() === iniPath(profile.gameId).toLowerCase()
        ) {
          applyIniSettings(context.api, profile, ini);
        }
        return Promise.resolve();
      },
    );
  });

  return true;
}

export default init;
