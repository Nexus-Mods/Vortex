/* eslint-disable */
import path = require("path");
import * as React from "react";
import { actions, fs, log, selectors, types, util } from "vortex-api";
import { ICollection } from "./types/ICollection";
import { IExtendedInterfaceProps } from "./types/IExtendedInterfaceProps";
import { IINITweak, TweakArray } from "./types/IINITweak";
import TweakList from "./views/IniTweaks";

import { INI_TWEAKS_PATH, OPTIONAL_TWEAK_PREFIX } from "./constants";

const gameSupport = {
  skyrim: {
    gameSettingsFiles: ["Skyrim.ini", "SkyrimPrefs.ini"],
  },
  skyrimse: {
    gameSettingsFiles: ["Skyrim.ini", "SkyrimPrefs.ini", "SkyrimCustom.ini"],
  },
  skyrimvr: {
    gameSettingsFiles: ["Skyrim.ini", "SkyrimPrefs.ini"],
  },
  fallout3: {
    gameSettingsFiles: ["Fallout.ini", "FalloutPrefs.ini", "FalloutCustom.ini"],
  },
  fallout4: {
    gameSettingsFiles: [
      "Fallout4.ini",
      "Fallout4Prefs.ini",
      "Fallout4Custom.ini",
    ],
  },
  fallout4vr: {
    gameSettingsFiles: ["Fallout4Custom.ini", "Fallout4Prefs.ini"],
  },
  falloutnv: {
    gameSettingsFiles: ["Fallout.ini", "FalloutPrefs.ini"],
  },
  starfield: {
    gameSettingsFiles: ["StarfieldCustom.ini", "StarfieldPrefs.ini"],
  },
  oblivion: {
    gameSettingsFiles: ["Oblivion.ini"],
  },
  enderal: {
    gameSettingsFiles: ["Enderal.ini", "EnderalPrefs.ini"],
  },
  enderalspecialedition: {
    gameSettingsFiles: ["Enderal.ini", "EnderalPrefs.ini"],
  },
};

function isSupported(gameId: string) {
  return gameSupport[gameId] !== undefined;
}

function validateFilenameInput(
  content: types.IDialogContent,
): types.IConditionResult[] {
  const input = content.input[0].value || "";
  if (input.length < 2 || !(util as any).isFilenameValid(input)) {
    return [
      {
        actions: ["Confirm"],
        errorText: "Has to be a valid file name",
        id: content.input[0].id,
      },
    ];
  } else {
    return [];
  }
}

function TweakListWrap(
  api: types.IExtensionApi,
  prop: IExtendedInterfaceProps,
): JSX.Element {
  return React.createElement(TweakList, {
    ...prop,
    settingsFiles: gameSupport[prop.gameId].gameSettingsFiles,
    onRefreshTweaks: genRefreshTweaks,
    onAddIniTweak: (modPath: string, settingsFiles: string[]) =>
      genAddIniTweak(api, modPath, settingsFiles),
    onRemoveIniTweak: (modPath: string, tweak: IINITweak) =>
      genRemoveIniTweak(api, prop, modPath, tweak),
  });
}

async function getTweaks(dirPath: string): Promise<string[]> {
  try {
    const tweaks = await fs.readdirAsync(dirPath);
    return tweaks;
  } catch (err) {
    log("debug", "failed to find tweaks", err);
    return [];
  }
}

export function getEnabledTweaks(
  api: types.IExtensionApi,
  gameId: string,
  modId: string,
) {
  const state = api.getState();
  const mods: { [modId: string]: types.IMod } = util.getSafe(
    state,
    ["persistent", "mods", gameId],
    {},
  );
  const tweaks = util.getSafe(mods[modId], ["enabledINITweaks"], []);
  return tweaks;
}

export async function importTweaks(
  api: types.IExtensionApi,
  profile: types.IProfile,
  mods: { [modId: string]: types.IMod },
  destCollection: types.IMod,
  force?: boolean,
) {
  const tweaks = await getAllTweaks(api, profile, mods);
  const state = api.getState();
  const stagingFolder = selectors.installPathForGame(state, profile.gameId);
  const destTweakDirPath = path.join(
    stagingFolder,
    destCollection.id,
    INI_TWEAKS_PATH,
  );
  const batchedActions = [];
  const existingTweaks = destCollection.enabledINITweaks ?? [];
  await fs.ensureDirWritableAsync(destTweakDirPath);
  for (const tweak of tweaks) {
    if (force !== true && existingTweaks.includes(tweak.fileName)) {
      // Don't import existing tweaks.
      continue;
    }
    try {
      const dest = path.join(destTweakDirPath, path.basename(tweak.sourcePath));
      await fs.copyAsync(tweak.sourcePath, dest, { overwrite: true });
      batchedActions.push(
        actions.setINITweakEnabled(
          profile.gameId,
          destCollection.id,
          tweak.fileName,
          true,
        ),
      );
    } catch (err) {
      log("error", "Unable to import tweak", err);
      continue;
    }
  }

  if (batchedActions.length > 0) {
    util.batchDispatch(api.store, batchedActions);
  }
  return Promise.resolve(tweaks);
}

async function getAllTweaks(
  api: types.IExtensionApi,
  profile: types.IProfile,
  mods: { [modId: string]: types.IMod },
): Promise<TweakArray> {
  const state = api.getState();
  if (profile?.gameId === undefined) {
    return Promise.resolve([]);
  }

  const installationPath = selectors.installPathForGame(state, profile.gameId);
  const enabledMods = Object.keys(mods).filter(
    (id) =>
      util.getSafe(profile.modState, [id, "enabled"], false) &&
      mods[id].installationPath !== undefined,
  );
  const validTweaks: IINITweak[] = [];
  for (const modId of enabledMods) {
    const modPath = path.join(installationPath, mods[modId].installationPath);
    const tweaks = getEnabledTweaks(api, profile.gameId, modId);
    if (tweaks.length === 0) {
      continue;
    }
    for (const tweak of tweaks) {
      try {
        const tweakPath = path.join(modPath, INI_TWEAKS_PATH, tweak);
        await fs.statAsync(tweakPath);
        validTweaks.push({
          enabled: true,
          sourcePath: tweakPath,
          fileName: tweak,
        });
      } catch (err) {
        continue;
      }
    }
  }
  return Promise.resolve(validTweaks);
}

async function removeOptionalPrefix(filePath: string) {
  // The point of this function is to fix/remove the optional prefix
  //  from existing ini tweaks.
  try {
    if (filePath.indexOf(OPTIONAL_TWEAK_PREFIX) !== -1) {
      const trimmedFilePath = filePath.replace(OPTIONAL_TWEAK_PREFIX, "");
      await fs.removeAsync(trimmedFilePath).catch((err) => null);
      await fs.linkAsync(filePath, trimmedFilePath);
      await fs.removeAsync(filePath);
      return Promise.resolve(trimmedFilePath);
    } else {
      // No fix needed.
      return Promise.resolve(filePath);
    }
  } catch (err) {
    log("error", "failed to remove optional prefix from ini file", {
      error: err,
      filePath,
    });
    return Promise.resolve(filePath);
  }
}

async function genRefreshTweaks(modPath: string): Promise<TweakArray> {
  const tweakPath = path.join(modPath, INI_TWEAKS_PATH);
  const tweaks = await getTweaks(tweakPath);
  return tweaks.reduce(async (accumP, twk) => {
    const accum = await accumP;
    const filePath = await removeOptionalPrefix(path.join(tweakPath, twk));
    accum.push({ fileName: path.basename(filePath) });
    return accum;
  }, Promise.resolve([]));
}

async function genRemoveIniTweak(
  api: types.IExtensionApi,
  props: IExtendedInterfaceProps,
  modPath: string,
  tweak: IINITweak,
) {
  return api
    .showDialog(
      "question",
      "Remove INI Tweak",
      {
        text: 'You are about to remove an INI tweak "{{fileName}}" from the collection. Are you sure you wish to proceed ?',
        parameters: { fileName: tweak.fileName },
      },
      [{ label: "Cancel" }, { label: "Remove" }],
    )
    .then(async (res) => {
      if (res.action === "Remove") {
        try {
          const tweaks = await genRefreshTweaks(modPath);
          const targetTweak = tweaks.find(
            (twk) => twk.fileName === tweak.fileName,
          );
          const tweakPath = path.join(
            modPath,
            INI_TWEAKS_PATH,
            targetTweak.fileName,
          );
          await fs.removeAsync(tweakPath);
          const { gameId, collection } = props;
          api.store.dispatch(
            actions.setINITweakEnabled(
              gameId,
              collection.id,
              targetTweak.fileName,
              false,
            ),
          );
        } catch (err) {
          if (err.code === "ENOENT") {
            // No file, no problem.
            const { gameId, collection } = props;
            api.store.dispatch(
              actions.setINITweakEnabled(
                gameId,
                collection.id,
                tweak.fileName,
                false,
              ),
            );
            return;
          }
          api.showErrorNotification("Failed to remove INI tweak", err, {
            allowReport: ["EPERM"].includes(err.code),
          });
        }
      }
    });
}

async function genAddIniTweak(
  api: types.IExtensionApi,
  modPath: string,
  settingsFiles: string[],
): Promise<void> {
  return api
    .showDialog(
      "question",
      "Name",
      {
        text: "Please enter a name for the ini tweak",
        input: [{ id: "name", type: "text" }],
        choices: settingsFiles.map((fileName, idx) => ({
          text: fileName,
          value: idx === 0,
          id: fileName,
        })),
        condition: validateFilenameInput,
      },
      [{ label: "Cancel" }, { label: "Confirm" }],
    )
    .then((res) => {
      if (res.action === "Confirm") {
        const tweaksPath = path.join(modPath, INI_TWEAKS_PATH);
        let selectedIni = Object.keys(res.input).find(
          (key) => path.extname(key) === ".ini" && res.input[key] === true,
        );
        if (selectedIni === undefined) {
          // shouldn't be possible since it's radiobuttons and one is preset so
          // one should always be selected.
          return Promise.reject(new Error("No ini file selected"));
        }
        selectedIni = path.basename(selectedIni, path.extname(selectedIni));
        const fileName = `${res.input["name"]} [${selectedIni}].ini`;
        return fs
          .ensureDirWritableAsync(tweaksPath, () => Promise.resolve())
          .then(() => fs.writeFileAsync(path.join(tweaksPath, fileName), ""));
      } else {
        return Promise.resolve();
      }
    });
}

async function genEnableIniTweaks(
  api: types.IExtensionApi,
  gameId: string,
  mod: types.IMod,
) {
  const stagingPath = selectors.installPathForGame(api.getState(), gameId);
  const modPath = path.join(stagingPath, mod.installationPath);
  try {
    const tweaks: TweakArray = await genRefreshTweaks(modPath);
    const batched = tweaks.map((req) =>
      actions.setINITweakEnabled(gameId, mod.id, req.fileName, true),
    );
    if (batched.length > 0) {
      util.batchDispatch(api.store, batched);
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      api.showErrorNotification("Failed to enable collection ini tweaks", err);
    }
  }
}

function init(context: types.IExtensionContext) {
  context.optional.registerCollectionFeature(
    "ini-tweaks",
    () => Promise.resolve({}),
    (gameId: string, collection: ICollection, mod: types.IMod) =>
      genEnableIniTweaks(context.api, gameId, mod),
    () => Promise.resolve(),
    () => "INI Tweaks",
    (state: types.IState, gameId: string) => isSupported(gameId),
    (prop: IExtendedInterfaceProps) => TweakListWrap(context.api, prop),
  );

  // Useful for debugging - currently we would have to check if the ini tweaks
  //  folder exists before showing the below action which would be an async operation
  //  and therefore not currently supported. Alternatively we could decide to have this
  //  enabled at all times ? (even if we don't know whether the collection has any ini tweaks)
  // context.registerAction('mods-action-icons', 999, 'resume', {}, 'Apply INI Tweaks', instanceIds => {
  //   const state = context.api.getState();
  //   const modId = instanceIds[0];
  //   const gameId = selectors.activeGameId(state);
  //   const mod: types.IMod = state.persistent.mods[gameId]?.[modId];
  //   if (mod.type === MOD_TYPE) {
  //     const profile = selectors.activeProfile(state);
  //     if (util.getSafe(profile, ['modState', mod.id, 'enabled'], false)) {
  //       enableIniTweaks(context.api, gameId, mod);
  //     }
  //   }
  // }, instanceIds => {
  //   const modId = instanceIds[0];
  //   const state = context.api.store.getState();
  //   const gameId = selectors.activeGameId(state);
  //   const mod: types.IMod = state.persistent.mods[gameId]?.[modId];
  //   const profile = selectors.activeProfile(state);
  //   return mod?.type === MOD_TYPE && (util.getSafe(profile, ['modState', modId, 'enabled'], false));
  // });
}

export default init;
