/* eslint-disable */
import path from 'path';
import { fs, types, selectors, util } from 'vortex-api';
import { Builder, parseStringPromise } from 'xml2js';

import { GAME_ID, CONFIG_MATRIX_REL_PATH, CONFIG_MATRIX_FILES, VORTEX_BACKUP_TAG } from './common';
import { getPersistentLoadOrder } from './migrations';
import { fileExists, getDocumentsPath, isSettingsFile, isXML } from './util';
import ini from 'ini';

class ModXMLDataInvalid extends util.DataInvalid {
  constructor(message: string, modFilePath: string) {
    super(`${message}:\n${modFilePath}`);
  }
}

// Example of how we expect the vars to be wrapped:
// <?xml version="1.0" encoding="UTF-16"?>
// <UserConfig>
// 	<Group builder="Input" id="PCInput" displayName="controls_pc" tags="keybinds">
// 		<VisibleVars>
// 			<Var builder="Input" id="MoveFwd"					displayName="move_forward"						displayType="INPUTPC" actions="MoveForward;MovementDoubleTapW;ChangeChoiceUp"/>
// 			<Var builder="Input" id="MoveBck"					displayName="move_back"							displayType="INPUTPC" actions="MoveBackward;MovementDoubleTapS;ChangeChoiceDown;GI_Decelerate"/>
//     </VisibleVars>
// 	</Group>
// </UserConfig>
// Adding a group with a different id will create a new group in the game's input.xml
//  file, if the group already exists it will merge the vars into the existing group.
export const doMergeXML = (api: types.IExtensionApi) => async (modFilePath: string, targetMergeDir: string) => {
  try {
    const modData = await fs.readFileAsync(modFilePath);
    const modXml = await parseStringPromise(modData);
    const modGroups = modXml?.UserConfig?.Group;
    if (!modGroups) {
      const err = new ModXMLDataInvalid('Invalid XML data - inform mod author', modFilePath);
      api.showErrorNotification('Failed to merge XML data', err, { allowReport: false });
      return Promise.resolve();
    }
    const currentInputFile = await readXMLInputFile(api, modFilePath, targetMergeDir);
    if (!currentInputFile) {
      // If the current input file is not found, we cannot merge, so we just return.
      return Promise.resolve();
    }
    const mergedXmlData = await parseStringPromise(currentInputFile);
    modGroups.forEach(modGroup => {
      const gameGroups = mergedXmlData?.UserConfig?.Group;
      const modVars = modGroup?.VisibleVars?.[0]?.Var;
      const gameGroup = gameGroups.find(group => group?.$?.id === modGroup?.$?.id);
      if (gameGroup) {
        const gameVars = gameGroup?.VisibleVars?.[0]?.Var;
        modVars.forEach(modVar => {
          const gameVar = gameVars.find(v => v?.$?.id === modVar?.$?.id);
          if (gameVar) {
            Object.assign(gameVar, modVar);
          } else {
            gameVars.push(modVar);
          }
        });
      } else {
        gameGroups.push(modGroup);
      }
    });
    const builder = new Builder({ doctype: { dtd: 'UTF-16' } });
    const xml = builder.buildObject(mergedXmlData);
    await fs.ensureDirWritableAsync(path.join(targetMergeDir, CONFIG_MATRIX_REL_PATH));
    return fs.writeFileAsync(path.join(targetMergeDir, CONFIG_MATRIX_REL_PATH, path.basename(modFilePath)), xml);
  } catch (err) {
    const activeProfile = selectors.activeProfile(api.store.getState());
    if (!activeProfile?.id) {
      api.showErrorNotification('Failed to merge XML data', 'No active profile found', { allowReport: false });
      return Promise.resolve();
    }
    const loadOrder = getPersistentLoadOrder(api);
    const extendedErr = util.deepMerge({ modFilePath, targetMergeDir, message: err.message, stack: err.stack }, err);
    api.showErrorNotification('Failed to merge XML data', extendedErr, {
      allowReport: true,
      attachments: [
        {
          id: `${activeProfile.id}_loadOrder`,
          type: 'data',
          data: loadOrder,
          description: 'Current load order'
        },
      ],
    });
    return Promise.resolve();
  }
}

export const canMergeXML = (api: types.IExtensionApi) => {
  return (game, gameDiscovery) => {
    if (game.id !== GAME_ID) {
      return undefined;
    }

    return {
      baseFiles: (deployedFiles: types.IDeployedFile[]) => deployedFiles
        .filter(file => isXML(file.relPath))
        .map(file => ({
          in: path.join(gameDiscovery.path, CONFIG_MATRIX_REL_PATH, file.relPath),
          out: path.join(CONFIG_MATRIX_REL_PATH, file.relPath),
        })),
      filter: filePath => isXML(filePath) && CONFIG_MATRIX_FILES.includes(path.basename(filePath, path.extname(filePath))),
    };
  }
}

async function readXMLInputFile(api: types.IExtensionApi, modFilePath: string, mergeDirPath: string) {
  const state = api.store.getState();
  const discovery = util.getSafe(state, ['settings', 'gameMode', 'discovered', GAME_ID], undefined);
  if (!discovery?.path) {
    return Promise.reject({ code: 'ENOENT', message: 'Game is not discovered' });
  }
  const gameInputFilepath = path.join(discovery.path, CONFIG_MATRIX_REL_PATH, path.basename(modFilePath));
  const mergedFilePath = path.join(mergeDirPath, CONFIG_MATRIX_REL_PATH, path.basename(modFilePath));
  const backupFilePath = gameInputFilepath + VORTEX_BACKUP_TAG;
  try {
    let inputFileData;
    if (await fileExists(mergedFilePath)) {
      inputFileData = fs.readFileAsync(mergedFilePath);
    } else if (await fileExists(backupFilePath)) {
      inputFileData = fs.readFileAsync(backupFilePath);
    } else {
      inputFileData = fs.readFileAsync(gameInputFilepath);
    }
    return inputFileData;
  } catch (err) {
    const res = await api.showDialog('error', 'Failed to read merged/native xml file', {
      text: 'A native XML file is missing. Please verify your game files through the game store client.',
    }, [
      { label: 'Close', default: true },
    ], 'w3-xml-merge-fail');
    return Promise.resolve(null);
  }
}

//#region experimental settings merge
// This is an experimental feature that will merge settings files in the game's documents folder.
//  currently unused due to troublesome migration from the old settings system.
export const canMergeSettings = (api: types.IExtensionApi) => {
  return (game: types.IGame, gameDiscovery: types.IDiscoveryResult) => {
    if (game.id !== GAME_ID) {
      return undefined;
    }
    // if (isSettingsMergeSuppressed(api)) {
    //   return undefined;
    // }

    return {
      baseFiles: (deployedFiles: types.IDeployedFile[]) => deployedFiles
        .filter(file => isSettingsFile(path.basename(file.relPath)))
        .map(file => ({
          in: path.join(getDocumentsPath(game), path.basename(file.relPath)),
          out: path.basename(file.relPath),
        })),
      filter: filePath => isSettingsFile(filePath),
    };
  };
}

export const doMergeSettings = (api: types.IExtensionApi) => async (modFilePath: string, targetMergeDir: string) => {
  // if (isSettingsMergeSuppressed(api)) {
  //   return Promise.resolve();
  // }

  try {
    const modData = await fs.readFileAsync(modFilePath, { encoding: 'utf8' });
    const modIniData = ini.parse(modData);
    const currentSettingsFile = await readSettingsFile(api, modFilePath, targetMergeDir);
    const mergedIniData = ini.parse(currentSettingsFile);
    Object.keys(modIniData).forEach(section => {
      if (!mergedIniData[section]) {
        mergedIniData[section] = modIniData[section];
      } else {
        Object.keys(modIniData[section]).forEach(key => {
          mergedIniData[section][key] = modIniData[section][key];
        });
      }
    });

    const mergedIniString = ini.stringify(mergedIniData);
    await fs.ensureDirWritableAsync(targetMergeDir);
    return fs.writeFileAsync(path.join(targetMergeDir, path.basename(modFilePath)), mergedIniString);
  } catch (err) {
    const state = api.store.getState();
    const activeProfile = selectors.activeProfile(state);
    const loadOrder = getPersistentLoadOrder(api);
    const extendedErr = util.deepMerge({ modFilePath, targetMergeDir, message: err.message, stack: err.stack }, err);
    const mergedData = await readSettingsFile(api, modFilePath, targetMergeDir);
    const modData = await fs.readFileAsync(modFilePath, { encoding: 'utf8' });
    api.showErrorNotification('Failed to merge settings data', extendedErr, {
      allowReport: true,
      attachments: [
        {
          id: `${activeProfile.id}_loadOrder`,
          type: 'data',
          data: loadOrder,
          description: 'Current load order'
        },
        {
          id: `${activeProfile.id}_merged_settings`,
          type: 'data',
          data: mergedData,
          description: 'Merged settings'
        },
        {
          id: `${activeProfile.id}_mod_settings`,
          type: 'data',
          data: modData,
          description: 'Mod settings'
        }
      ],
    });
    return Promise.resolve();
  }
}

async function readSettingsFile(api: types.IExtensionApi, modFilePath: string, mergeDirPath: string) {
  const state = api.store.getState();
  const discovery = util.getSafe(state, ['settings', 'gameMode', 'discovered', GAME_ID], undefined);
  if (!discovery?.path) {
    return Promise.reject({ code: 'ENOENT', message: 'Game is not discovered' });
  }
  const gameSettingsFilepath = path.join(getDocumentsPath(discovery), path.basename(modFilePath));
  const mergedFilePath = path.join(mergeDirPath, path.basename(modFilePath));
  const backupFilePath = gameSettingsFilepath + VORTEX_BACKUP_TAG;
  try {
    if (await fileExists(mergedFilePath)) {
      return fs.readFileAsync(mergedFilePath);
    }
    if (await fileExists(backupFilePath)) {
      return fs.readFileAsync(backupFilePath);
    }
    return fs.readFileAsync(gameSettingsFilepath);
  } catch (err) {
    return Promise.reject(err);
  }
}

//#endregion