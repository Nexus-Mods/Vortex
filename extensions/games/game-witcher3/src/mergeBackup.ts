/* eslint-disable */
import _ from 'lodash';
import path from 'path';
import turbowalk from 'turbowalk';
import { fs, log, selectors, types, util } from 'vortex-api';

import { GAME_ID, getLoadOrderFilePath, MERGE_INV_MANIFEST,
  SCRIPT_MERGER_ID, W3_TEMP_DATA_DIR, MergeDataViolationError } from './common';

import { generate } from 'shortid';

import { hex2Buffer, prepareFileData, restoreFileData } from './collections/util';

import { getNamesOfMergedMods } from './mergeInventoryParsing';

import { getMergedModName, downloadScriptMerger } from './scriptmerger';

import { getDeployment } from './util';

import { IDeployedFile, IDeployment } from './types';

type OpType = 'import' | 'export';
interface IBaseProps {
  api: types.IExtensionApi;
  state: types.IState;
  profile: types.IProfile;
  scriptMergerTool: types.IDiscoveredTool;
  gamePath: string;
}

const sortInc = (lhs: string, rhs: string) => lhs.length - rhs.length;
const sortDec = (lhs: string, rhs: string) => rhs.length - lhs.length;

function genBaseProps(api: types.IExtensionApi,
                      profileId: string, force?: boolean): IBaseProps {
  if (!profileId) {
    return undefined;
  }
  const state = api.getState();
  const profile: types.IProfile = selectors.profileById(state, profileId);
  if (profile?.gameId !== GAME_ID) {
    return undefined;
  }

  const localMergedScripts: boolean = (force) ? true : util.getSafe(state,
    ['persistent', 'profiles', profileId, 'features', 'local_merges'], false);
  if (!localMergedScripts) {
    return undefined;
  }

  const discovery: types.IDiscoveryResult = util.getSafe(state,
    ['settings', 'gameMode', 'discovered', GAME_ID], undefined);
  const scriptMergerTool: types.IDiscoveredTool = discovery?.tools?.[SCRIPT_MERGER_ID];
  if (!scriptMergerTool?.path) {
    // Regardless of the user's profile settings - there's no point in backing up
    //  the merges if we don't know where the script merger is!
    return undefined;
  }

  return { api, state, profile, scriptMergerTool, gamePath: discovery.path };
}

function getFileEntries(filePath: string): Promise<string[]> {
  let files: string[] = [];
  return turbowalk(filePath, entries => {
    const validEntries = entries.filter(entry => !entry.isDirectory)
                                .map(entry => entry.filePath);
    files = files.concat(validEntries);
  }, { recurse: true })
  .catch(err => ['ENOENT', 'ENOTFOUND'].includes(err.code)
    ? Promise.resolve()
    : Promise.reject(err))
  .then(() => Promise.resolve(files));
}

async function moveFile(from: string, to: string, fileName: string) {
  const src = path.join(from, fileName);
  const dest = path.join(to, fileName);
  try {
    await copyFile(src, dest);
  } catch (err) {
    // It's perfectly possible for the user not to have any merges yet.
    return (err.code !== 'ENOENT')
      ? Promise.reject(err)
      : Promise.resolve();
  }
}

async function removeFile(filePath: string) {
  if (path.extname(filePath) === '') {
    return;
  }
  try {
    await fs.removeAsync(filePath);
  } catch (err) {
    return (err.code === 'ENOENT')
      ? Promise.resolve()
      : Promise.reject(err);
  }
}

async function copyFile(src: string, dest: string) {
  try {
    await fs.ensureDirWritableAsync(path.dirname(dest));
    await removeFile(dest);
    await fs.copyAsync(src, dest);
  } catch (err) {
    return Promise.reject(err);
  }
}

async function moveFiles(src: string, dest: string, props: IBaseProps) {
  const t = props.api.translate;
  const removeDestFiles = async () => {
    try {
      const destFiles: string[] = await getFileEntries(dest);
      destFiles.sort(sortDec);
      for (const destFile of destFiles) {
        await fs.removeAsync(destFile);
      }
    } catch (err) {
      if (['EPERM'].includes(err.code)) {
        return props.api.showDialog('error', 'Failed to restore merged files', {
          bbcode: t('Vortex encountered a permissions related error while attempting '
            + 'to replace:{{bl}}"{{filePath}}"{{bl}}'
            + 'Please try to resolve any permissions related issues and return to this '
            + 'dialog when you think you managed to fix it. There are a couple of things '
            + 'you can try to fix this:[br][/br][list][*] Close/Disable any applications that may '
            + 'interfere with Vortex\'s operations such as the game itself, the witcher script merger, '
            + 'any external modding tools, any anti-virus software. '
            + '[*] Ensure that your Windows user account has full read/write permissions to the file specified '
            + '[/list]', { replace: { filePath: err.path, bl: '[br][/br][br][/br]' } }),
        },
        [
          { label: 'Cancel', action: () => Promise.reject(new util.UserCanceled()) },
          { label: 'Try Again', action: () => removeDestFiles() },
        ]);
      } else {
        // We failed to clean up the destination folder - we can't
        //  continue.
        return Promise.reject(new util.ProcessCanceled(err.message));
      }
    }
  };

  await removeDestFiles();
  const copied: string[] = [];
  try {
    const srcFiles: string[] = await getFileEntries(src);
    srcFiles.sort(sortInc);
    for (const srcFile of srcFiles) {
      const relPath = path.relative(src, srcFile);
      const targetPath = path.join(dest, relPath);
      try {
        await copyFile(srcFile, targetPath);
        copied.push(targetPath);
      } catch (err) {
        log('error', 'failed to move file', err);
      }
    }

    // if (cleanUp) {
    //   // We managed to copy all the files, clean up the source
    //   srcFiles.sort(sortDec);
    //   for (const srcFile of srcFiles) {
    //     await fs.removeAsync(srcFile);
    //   }
    // }
  } catch (err) {
    if (!!err.path && !err.path.includes(dest)) {
      // We failed to clean up the source
      return;
    }

    // We failed to copy - clean up.
    copied.sort(sortDec);
    for (const link of copied) {
      await fs.removeAsync(link);
    }
  }
}

function backupPath(profile: types.IProfile): string {
  return path.join(util.getVortexPath('userData'),
    profile.gameId, 'profiles', profile.id, 'backup');
}

async function handleMergedScripts(props: IBaseProps, opType: OpType, dest?: string) {
  const { scriptMergerTool, profile, gamePath } = props;
  if (!scriptMergerTool?.path) {
    return Promise.reject(new util.NotFound('Script merging tool path'));
  }
  if (!profile?.id) {
    return Promise.reject(new util.ArgumentInvalid('invalid profile'));
  }

  try {
    const mergerToolDir = path.dirname(scriptMergerTool.path);
    const profilePath: string = (dest === undefined)
      ? path.join(mergerToolDir, profile.id)
      : dest;
    const loarOrderFilepath: string = getLoadOrderFilePath();
    const mergedModName = await getMergedModName(mergerToolDir);
    const mergedScriptsPath = path.join(gamePath, 'Mods', mergedModName);

    // Just in case it's missing.
    await fs.ensureDirWritableAsync(mergedScriptsPath);

    if (opType === 'export') {
      await moveFile(mergerToolDir, profilePath, MERGE_INV_MANIFEST);
      await moveFile(path.dirname(loarOrderFilepath), profilePath, path.basename(loarOrderFilepath));
      await moveFiles(mergedScriptsPath, path.join(profilePath, mergedModName), props);
    } else if (opType === 'import') {
      await moveFile(profilePath, mergerToolDir, MERGE_INV_MANIFEST);
      await moveFile(profilePath, path.dirname(loarOrderFilepath), path.basename(loarOrderFilepath));
      await moveFiles(path.join(profilePath, mergedModName), mergedScriptsPath, props);
    }
    return Promise.resolve();
  } catch (err) {
    log('error', 'failed to store/restore merged scripts', err);
    return Promise.reject(err);
  }
}

export async function storeToProfile(api: types.IExtensionApi, profileId: string) {
  const props: IBaseProps = genBaseProps(api, profileId);
  if (props === undefined) {
    return;
  }

  const bakPath = backupPath(props.profile);
  try {
    await handleMergedScripts(props, 'export', bakPath);
  } catch (err) {
    return Promise.reject(err);
  }
  return handleMergedScripts(props, 'export');
}

export async function restoreFromProfile(api: types.IExtensionApi, profileId: string) {
  const props: IBaseProps = genBaseProps(api, profileId);
  if (props === undefined) {
    return;
  }

  const bakPath = backupPath(props.profile);
  try {
    await handleMergedScripts(props, 'import', bakPath);
  } catch (err) {
    return Promise.reject(err);
  }
  return handleMergedScripts(props, 'import');
}

export async function queryScriptMerges(api: types.IExtensionApi,
                                        includedModIds: string[],
                                        collection: types.IMod) {
  const state = api.getState();
  const mods: { [modId: string]: types.IMod } = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const modTypes: { [typeId: string]: string } = selectors.modPathsForGame(state, GAME_ID);
  const deployment: IDeployment = await getDeployment(api, includedModIds);
  const deployedNames: string[] = Object.keys(modTypes).reduce((accum, typeId) => {
    const modPath = modTypes[typeId];
    const files: IDeployedFile[] = deployment[typeId];
    const isRootMod = modPath.toLowerCase().split(path.sep).indexOf('mods') === -1;
    const names = files.map(file => {
      const nameSegments = file.relPath.split(path.sep);
      if (isRootMod) {
        const nameIdx = nameSegments.map(seg => seg.toLowerCase()).indexOf('mods') + 1;
        return (nameIdx > 0)
          ? nameSegments[nameIdx]
          : undefined;
      } else {
        return nameSegments[0];
      }
    });
    accum = accum.concat(names.filter(name => !!name));
    return accum;
  }, []);
  const uniqueDeployed = Array.from(new Set(deployedNames));
  const merged = await getNamesOfMergedMods(api);
  const diff = _.difference(merged, uniqueDeployed);
  const isOptional = (modId: string) => (collection.rules ?? []).find(rule => {
    const mod: types.IMod = mods[modId];
    if (mod === undefined) {
      return false;
    }
    const validType = ['recommends'].includes(rule.type);
    if (!validType) {
      return false;
    }
    const matchedRule = util.testModReference(mod, rule.reference);
    return matchedRule;
  }) !== undefined;
  const optionalMods = includedModIds.filter(isOptional);
  if (optionalMods.length > 0 || diff.length !== 0) {
    throw new MergeDataViolationError(diff || [],
      optionalMods || [], util.renderModName(collection));
  }
}

export async function exportScriptMerges(api: types.IExtensionApi,
                                         profileId: string,
                                         includedModIds: string[],
                                         collection: types.IMod) {
  const props: IBaseProps = genBaseProps(api, profileId, true);
  if (props === undefined) {
    return;
  }

  const exportMergedData = async () => {
    try {
      const tempPath = path.join(W3_TEMP_DATA_DIR, generate());
      await fs.ensureDirWritableAsync(tempPath);
      await handleMergedScripts(props, 'export', tempPath);
      const data = await prepareFileData(tempPath);
      return Promise.resolve(data);
    } catch (err) {
      return Promise.reject(err);
    }
  };

  try {
    await queryScriptMerges(api, includedModIds, collection);
    return exportMergedData();
  } catch (err) {
    if (err instanceof MergeDataViolationError) {
      const violationError = (err as MergeDataViolationError);
      const optional = violationError.Optional;
      const notIncluded = violationError.NotIncluded;
      const optionalSegment = (optional.length > 0)
        ? 'Marked as "optional" but need to be marked "required":{{br}}[list]'
          + optional.map(opt => `[*]${opt}`) + '[/list]{{br}}'
        : '';
      const notIncludedSegment = (notIncluded.length > 0)
        ? 'No longer part of the collection and need to be re-added:{{br}}[list]'
          + notIncluded.map(ni => `[*]${ni}`) + '[/list]{{br}}'
        : '';
      return api.showDialog('question', 'Potential merged data mismatch', {
        bbcode: 'Your collection includes a script merge that is referencing mods '
          + `that are...{{bl}} ${notIncludedSegment}${optionalSegment}`
          + 'For the collection to function correctly you will need to address the '
          + 'above or re-run the Script Merger to remove traces of merges referencing '
          + 'these mods. Please, do only proceed to upload the collection/revision as '
          + 'is if you intend to upload the script merge as is and if the reference for '
          + 'the merge will e.g. be acquired from an external source as part of the collection.',
        parameters: { br: '[br][/br]', bl: '[br][/br][br][/br]' },
      }, [
        { label: 'Cancel' },
        { label: 'Upload Collection' }
      ]).then(res => (res.action === 'Cancel')
        ? Promise.reject(new util.UserCanceled)
        : exportMergedData());
    }
    return Promise.reject(err);
  }
}

export async function importScriptMerges(api: types.IExtensionApi,
                                         profileId: string,
                                         fileData: Buffer) {
  const props: IBaseProps = genBaseProps(api, profileId, true);
  if (props === undefined) {
    return;
  }
  const res = await api.showDialog('question', 'Script Merges Import', {
    text: 'The collection you are importing contains script merges which the creator of '
        + 'the collection deemed necessary for the mods to function correctly. Please note that '
        + 'importing these will overwrite any existing script merges you may have effectuated. '
        + 'Please ensure to back up any existing merges (if applicable/required) before '
        + 'proceeding.',
  },
  [
    { label: 'Cancel' },
    { label: 'Import Merges' },
  ], 'import-w3-script-merges-warning');

  if (res.action === 'Cancel') {
    return Promise.reject(new util.UserCanceled());
  }
  try {
    const tempPath = path.join(W3_TEMP_DATA_DIR, generate());
    await fs.ensureDirWritableAsync(tempPath);
    const data = await restoreFileData(fileData, tempPath);
    await handleMergedScripts(props, 'import', tempPath);
    api.sendNotification({
      message: 'Script merges imported successfully',
      id: 'witcher3-script-merges-status',
      type: 'success',
    });
    return data;
  } catch (err) {
    return Promise.reject(err);
  }
}

export async function makeOnContextImport(api: types.IExtensionApi, collectionId: string) {
  const state = api.getState();
  const mods: { [modId: string]: types.IMod } = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const collectionMod = mods[collectionId];
  if (collectionMod?.installationPath === undefined) {
    log('error', 'collection mod is missing', collectionId);
    return;
  }

  const stagingFolder = selectors.installPathForGame(state, GAME_ID);
  try {
    const fileData = await fs.readFileAsync(path.join(stagingFolder, collectionMod.installationPath, 'collection.json'), { encoding: 'utf8' });
    const collection = JSON.parse(fileData);
    const { scriptMergedData } = collection.mergedData;
    if (scriptMergedData !== undefined) {
      // Make sure we have the script merger installed straight away!
      const scriptMergerTool = util.getSafe(state,
        ['settings', 'gameMode', 'discovered', GAME_ID, 'tools', SCRIPT_MERGER_ID], undefined);
      if (scriptMergerTool === undefined) {
        await downloadScriptMerger(api);
      }
      const profileId = selectors.lastActiveProfileForGame(state, GAME_ID);
      await importScriptMerges(api, profileId, hex2Buffer(scriptMergedData));
    }
  } catch (err) {
    if (!(err instanceof util.UserCanceled)) {
      api.showErrorNotification('Failed to import script merges', err);
    }
  }
}
