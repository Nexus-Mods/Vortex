import * as path from 'path';
import { types } from 'vortex-api';

import { LSLIB_FILES, ORIGINAL_FILES } from './common';
import { logDebug } from './util';

export async function isLSLib(files: types.IInstruction[]) {
  const origFile = files.find(iter =>
    (iter.type === 'copy') && LSLIB_FILES.has(path.basename(iter.destination).toLowerCase()));
  return origFile !== undefined
    ? Promise.resolve(true)
    : Promise.resolve(false);
}

export async function isBG3SE(files: types.IInstruction[]) {
  const origFile = files.find(iter =>
    (iter.type === 'copy') && (path.basename(iter.destination).toLowerCase() === 'dwrite.dll'));
  return origFile !== undefined
    ? Promise.resolve(true)
    : Promise.resolve(false);
}

export async function isLoose(instructions: types.IInstruction[]): Promise<boolean> { 
  // only interested in copy instructions
  const copyInstructions = instructions.filter(instr => instr.type === 'copy');

  // do we have a data folder? 
  const hasDataFolder:boolean = copyInstructions.find(instr =>
    instr.source.indexOf('Data' + path.sep) !== -1) !== undefined;

  // do we have a public or generated folder?
  const hasGenOrPublicFolder:boolean = copyInstructions.find(instr =>
    instr.source.indexOf('Generated' + path.sep) !== -1 || 
    instr.source.indexOf('Public' + path.sep) !== -1
    ) !== undefined;

  logDebug('isLoose', { instructions: instructions, hasDataFolder: hasDataFolder || hasGenOrPublicFolder });

  return Promise.resolve(hasDataFolder || hasGenOrPublicFolder);
}

export async function isReplacer(api: types.IExtensionApi, files: types.IInstruction[]): Promise<boolean> {

  const origFile = files.find(iter =>
    (iter.type === 'copy') && ORIGINAL_FILES.has(iter.destination.toLowerCase()));

  const paks = files.filter(iter =>
    (iter.type === 'copy') && (path.extname(iter.destination).toLowerCase() === '.pak'));

  logDebug('isReplacer',  {origFile: origFile, paks: paks});

  //if ((origFile !== undefined) || (paks.length === 0)) {
  if ((origFile !== undefined)) {
    return api.showDialog('question', 'Mod looks like a replacer', {
      bbcode: 'The mod you just installed looks like a "replacer", meaning it is intended to replace '
          + 'one of the files shipped with the game.<br/>'
          + 'You should be aware that such a replacer includes a copy of some game data from a '
          + 'specific version of the game and may therefore break as soon as the game gets updated.<br/>'
          + 'Even if doesn\'t break, it may revert bugfixes that the game '
          + 'developers have made.<br/><br/>'
          + 'Therefore [color="red"]please take extra care to keep this mod updated[/color] and remove it when it '
          + 'no longer matches the game version.',
    }, [
      { label: 'Install as Mod (will likely not work)' },
      { label: 'Install as Replacer', default: true },
    ]).then(result => result.action === 'Install as Replacer');
  } else {
    return Promise.resolve(false);
  }
}