/* eslint-disable */
import path from 'path';
import { types } from 'vortex-api';
import { CONFIG_MATRIX_REL_PATH, GAME_ID, SCRIPT_MERGER_FILES, PART_SUFFIX } from './common';
import { PrefixType } from './types';

export function scriptMergerTest(files, gameId) {
  const matcher = (file => SCRIPT_MERGER_FILES.includes(file));
  const supported = ((gameId === GAME_ID) && (files.filter(matcher).length > 0));

  return Promise.resolve({ supported, requiredFiles: SCRIPT_MERGER_FILES });
}

export function scriptMergerDummyInstaller() {
  return (api: types.IExtensionApi) => {
    api.showErrorNotification('Invalid Mod', 'It looks like you tried to install '
      + 'The Witcher 3 Script Merger, which is a tool and not a mod for The Witcher 3.\n\n'
      + 'The script merger should\'ve been installed automatically by Vortex as soon as you activated this extension. '
      + 'If the download or installation has failed for any reason - please let us know why, by reporting the error through '
      + 'our feedback system and make sure to include vortex logs. Please note: if you\'ve installed '
      + 'the script merger in previous versions of Vortex as a mod and STILL have it installed '
      + '(it\'s present in your mod list) - you should consider un-installing it followed by a Vortex restart; '
      + 'the automatic merger installer/updater should then kick off and set up the tool for you.',
      { allowReport: false });
    return Promise.reject(new util.ProcessCanceled('Invalid mod'));
  }
}

export function testMenuModRoot(instructions: any[], gameId: string): Promise<types.ISupportedResult | boolean> {
  // This function can test for both installers and modTypes
  const hasMenuModPattern = (filePath: string) => [CONFIG_MATRIX_REL_PATH, PART_SUFFIX].some(pattern =>
    filePath.toLowerCase().indexOf(pattern) !== -1);
  const predicate = (instr) => (!!gameId)
    ? ((GAME_ID === gameId) && (hasMenuModPattern(instr))) // Test for installer
    : ((instr.type === 'copy') && (hasMenuModPattern(instr.source))); // Test for modType

  return (!!gameId)
    ? Promise.resolve({
      supported: instructions.find(predicate) !== undefined,
      requiredFiles: [],
    })
    : Promise.resolve(instructions.find(predicate) !== undefined);
}

export function installMenuMod(files: string[], destinationPath: string) {
  // Input specific files need to be installed outside the mods folder while
  //  all other mod files are to be installed as usual.
  const filtered = files.filter(file => path.extname(path.basename(file)) !== '');
  const inputFiles = filtered.filter(file => file.indexOf(CONFIG_MATRIX_REL_PATH) !== -1);
  const uniqueInput = inputFiles.reduce((accum, iter) => {
    // Some mods tend to include a backup file meant for the user to restore
    //  his game to vanilla (obvs we only want to apply the non-backup).
    const fileName = path.basename(iter);

    if (accum.find(entry => path.basename(entry) === fileName) !== undefined) {
      // This config file has already been added to the accumulator.
      //  Ignore this instance.
      return accum;
    }

    const instances = inputFiles.filter(file => path.basename(file) === fileName);
    if (instances.length > 1) {
      // We have multiple instances of the same menu config file - mod author probably included
      //  a backup file to restore vanilla state, or perhaps this is a variant mod which we
      //  can't currently support.
      // It's difficult for us to correctly identify the correct file but we're going to
      //  try and guess based on whether the config file has a "backup" folder segment
      //  otherwise we just add the first file instance (I'm going to regret adding this aren't I ?)
      if (iter.toLowerCase().indexOf('backup') === -1) {
        // We're going to assume that this is the right file.
        accum.push(iter);
      }
    } else {
      // This is a unique menu configuration file - add it.
      accum.push(iter);
    }
    return accum;
  }, []);

  let otherFiles = filtered.filter(file => !inputFiles.includes(file));
  const inputFileDestination = CONFIG_MATRIX_REL_PATH;

  // Get the mod's root folder.
  const binIdx = uniqueInput?.[0]?.toLowerCase()?.split(path.sep)?.indexOf?.('bin');

  // Refers to files located inside the archive's 'Mods' directory.
  //  This array can very well be empty if a mods folder doesn't exist
  const modFiles = otherFiles.filter(file =>
    file.toLowerCase().split(path.sep).includes('mods'));

  const modsIdx = (modFiles.length > 0)
    ? modFiles[0].toLowerCase().split(path.sep).indexOf('mods')
    : -1;
  const modNames = (modsIdx !== -1)
    ? modFiles.reduce((accum, iter) => {
      const modName = iter.split(path.sep).splice(modsIdx + 1, 1).join();
      if (!accum.includes(modName)) {
        accum.push(modName);
      }
      return accum;
    }, [])
    : [];
  // The presence of a mods folder indicates that this mod may provide
  //  several mod entries.
  if (modFiles.length > 0) {
    otherFiles = otherFiles.filter(file => !modFiles.includes(file));
  }

  // We're hoping that the mod author has included the mod name in the archive's
  //  structure - if he didn't - we're going to use the destination path instead.
  const modName = (binIdx > 0)
    ? inputFiles[0].split(path.sep)[binIdx - 1]
    : ('mod' + path.basename(destinationPath, '.installing')).replace(/\s/g, '');

  const trimmedFiles = otherFiles.map(file => {
    const source = file;
    let relPath = file.split(path.sep)
      .slice(binIdx);
    if (relPath[0] === undefined) {
      // This file must've been inside the root of the archive;
      //  deploy as is.
      relPath = file.split(path.sep);
    }

    const firstSeg = relPath[0].toLowerCase();
    if (firstSeg === 'content' || firstSeg.endsWith(PART_SUFFIX)) {
      relPath = [].concat(['Mods', modName], relPath);
    }

    return {
      source,
      relPath: relPath.join(path.sep),
    };
  });

  const toCopyInstruction = (source, destination) => ({
    type: 'copy',
    source,
    destination,
  });

  const inputInstructions = uniqueInput.map(file =>
    toCopyInstruction(file, path.join(inputFileDestination, path.basename(file))));

  const otherInstructions = trimmedFiles.map(file =>
    toCopyInstruction(file.source, file.relPath));

  const modFileInstructions = modFiles.map(file =>
    toCopyInstruction(file, file));

  const instructions = [].concat(inputInstructions, otherInstructions, modFileInstructions);
  if (modNames.length > 0) {
    instructions.push({
      type: 'attribute',
      key: 'modComponents',
      value: modNames,
    });
  }
  return Promise.resolve({ instructions });
}


export function testSupportedContent(files: string[], gameId: string) {
  const supported = (gameId === GAME_ID)
    && (files.find(file => file.toLowerCase().startsWith('content' + path.sep) !== undefined));
  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

export function installContent(files: string[], destinationPath: string) {
  return Promise.resolve(files
    .filter(file => file.toLowerCase().startsWith('content' + path.sep))
    .map(file => {
      const fileBase = file.split(path.sep).slice(1).join(path.sep);
      return {
        type: 'copy',
        source: file,
        destination: path.join('mod' + destinationPath, fileBase),
      };
    }));
}

export function testSupportedTL(files: string[], gameId: string) {
  const supported = (gameId === GAME_ID)
    && (files.find(file =>
      file.toLowerCase().split(path.sep).indexOf('mods') !== -1) !== undefined);
  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

export function installTL(files: string[]) {
  let prefix = files.reduce((prev, file) => {
    const components: string[] = file.toLowerCase().split(path.sep);
    const idx = components.indexOf('mods');
    if ((idx > 0) && ((prev === undefined) || (idx < prev.length))) {
      return components.slice(0, idx) + path.sep;
    } else {
      return prev;
    }
  }, '');

  const instructions = files
    .filter(file => !file.endsWith(path.sep) && file.toLowerCase().startsWith(prefix))
    .map(file => ({
      type: 'copy',
      source: file,
      destination: file.slice(prefix.length),
    }));

  return Promise.resolve({ instructions });
}

export function testDLCMod(files: string[], gameId: string): Promise<types.ISupportedResult> {
  if (gameId !== GAME_ID) {
    return Promise.resolve({ supported: false, requiredFiles: [] });
  }

  const nonDlcFile = files.find(file => !file.toLowerCase().startsWith('dlc'));
  return (nonDlcFile !== undefined)
    ? Promise.resolve({ supported: false, requiredFiles: [] })
    : Promise.resolve({ supported: true, requiredFiles: [] });
}

export function installDLCMod(files: string[]) {
  const modNames = [];
  const setModTypeInstr: types.IInstruction = {
    type: 'setmodtype',
    value: 'witcher3dlc',
  };
  const instructions: types.IInstruction[] = files.reduce((accum, iter) => {
    if (path.extname(iter) === '') {
      return accum;
    }
    const segments = iter.split(path.sep);
    const properlyFormatted = segments.length > 2
      ? (segments[0].toLowerCase() === 'dlc') && ((segments[2] || '').toLowerCase() === 'content')
      : false;
    const modName = properlyFormatted
      ? segments[1]
      : segments[0];
    modNames.push(modName);
    const destination = properlyFormatted
      ? segments.slice(1).join(path.sep)
      : segments.join(path.sep);
    accum.push({
      type: 'copy',
      source: iter,
      destination,
    })
    return accum;
  }, [setModTypeInstr]);

  const modNamesAttr: types.IInstruction = {
    type: 'attribute',
    key: 'modComponents',
    value: modNames,
  };
  instructions.push(modNamesAttr);
  return Promise.resolve({ instructions });
}

const hasPrefix = (prefix: PrefixType, fileEntry: string) => {
  const segments = fileEntry.toLowerCase().split(path.sep);
  const contentIdx = segments.indexOf('content');
  if ([-1, 0].includes(contentIdx)) {
    // No content folder, no mod.
    return false;
  }

  return segments[contentIdx - 1].indexOf(prefix) !== -1;
};

const isRootDirectory = (fileEntry: string) => {
  const segments = fileEntry.toLowerCase().split(path.sep);
  return (['mods', 'dlc'].includes(segments[0]));
}

export function testSupportedMixed(files: string[], gameId: string): Promise<types.ISupportedResult> {
  if (gameId !== GAME_ID) {
    return Promise.resolve({ supported: false, requiredFiles: [] });
  }

  const hasConfigMatrixFile = files.find(file =>
    path.basename(file).toLowerCase() === CONFIG_MATRIX_REL_PATH) !== undefined;
  if (hasConfigMatrixFile) {
    return Promise.resolve({ supported: false, requiredFiles: [] });
  }

  const supported = (files.some(file => hasPrefix('dlc', file))) && (files.some(file => hasPrefix('mod', file)));
  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

export function installMixed(files: string[]) {
  // We can only assume that files with the 'dlc' prefix go inside dlc and files
  //  with the 'mod' prefix go inside mods.
  const modNames: string[] = [];
  const instructions: types.IInstruction[] = files.reduce((accum, iter) => {
    const isRootDir = isRootDirectory(iter);
    const segments = iter.split(path.sep);
    if (!path.extname(segments[segments.length - 1])) {
      return accum;
    }

    let destinationSegments = [];
    const contentIdx = segments.map(seg => seg.toLowerCase()).indexOf('content');

    if (isRootDir) {
      // Take out the root folder.
      segments.shift();
    } else if (contentIdx > 1) {
      // Take out anything prior to the mod folder.
      segments.splice(contentIdx - 1);
    }

    if (hasPrefix('dlc', iter)) {
      destinationSegments = ['dlc'].concat(segments);
    } else if (hasPrefix('mod', iter)) {
      destinationSegments = ['mods'].concat(segments);
    } else {
      // Don't know, don't care
      destinationSegments = iter.split(path.sep);
    }

    modNames.push(segments[0]);
    const instruction: types.IInstruction = {
      type: 'copy',
      source: iter,
      destination: destinationSegments.join(path.sep),
    };
    accum.push(instruction);

    return accum;
  }, []).concat([
    {
      type: 'attribute',
      key: 'modComponents',
      value: Array.from(new Set(modNames)),
    },
    {
      type: 'setmodtype',
      value: 'witcher3menumodroot',
    }
  ]);
  return Promise.resolve({ instructions });
}
