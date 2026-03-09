/* eslint-disable */
import path from 'path';
import * as rjson from 'relaxed-json';
import { fs, types, log, util } from 'vortex-api';

import { MOD_CONFIG_DEST_ELEMENT, MOD_INFO_JSON_FILE, GAME_ID, MOD_CONFIG_FILE, ASSEMBLY_EXT, MAP_EXT, HALO_GAMES } from './common';
import { IModConfig } from './types';
import { identifyHaloGames } from './util';

export async function testPlugAndPlayInstaller(files: string[], gameId: string) {
  const hasModInfoFile = files.some(file => path.basename(file).toLowerCase() === MOD_INFO_JSON_FILE);
  return Promise.resolve({ supported: (gameId === GAME_ID) && hasModInfoFile, requiredFiles: [] });
}

export async function installPlugAndPlay(files: string[], destinationPath: string) {
  const modInfo = files.find(file => path.basename(file).toLowerCase() === MOD_INFO_JSON_FILE);
  const modInfoData = await fs.readFileAsync(path.join(destinationPath, modInfo), { encoding: 'utf8' });
  const parsed: IModConfig = rjson.parse(modInfoData) as IModConfig;
  let modConfigAttributes: types.IInstruction[] = [];
  modConfigAttributes.push({
    type: 'attribute',
    key: 'haloGames',
    value: [HALO_GAMES[parsed.Engine.toLowerCase()].internalId],
  });

  if (parsed.ModVersion !== undefined) {
    modConfigAttributes.push({
      type: 'attribute',
      key: 'version',
      value: `${parsed.ModVersion.Major || 0}.${parsed.ModVersion.Minor || 0}.${parsed.ModVersion.Patch || 0}`,
    });
  }

  if (parsed.Title?.Neutral !== undefined) {
    modConfigAttributes.push({
      type: 'attribute',
      key: 'customFileName',
      value: parsed.Title.Neutral,
    });
  }

  const infoSegments = modInfo.split(path.sep);
  const modFolderIndex = infoSegments.length >= 1 ? infoSegments.length - 1 : 0;
  const filtered = files.filter(file => path.extname(path.basename(file)) !== '');
  const instructions: types.IInstruction[] = filtered.map(file => {
    const segments = file.split(path.sep);
    const destination = segments.slice(modFolderIndex);
    return {
      type: 'copy',
      source: file,
      destination: destination.join(path.sep),
    };
  });

  instructions.push(...modConfigAttributes);
  return Promise.resolve({ instructions });
}

export function testModConfigInstaller(files, gameId) {
  const isAssemblyOnlyMod = () => {
    // The presense of an .asmp file without any .map files is a clear indication
    //  that this mod can only be installed using the Assembly tool which we've
    //  yet to integrate into Vortex. This installer will not install these mods.
    return (files.find(file => path.extname(file) === ASSEMBLY_EXT) !== undefined)
      && (files.find(file => path.extname(file) === MAP_EXT) === undefined);
  };
  return (gameId !== GAME_ID)
   ? Promise.resolve({ supported: false, requiredFiles: [] })
   : Promise.resolve({
     supported: (files.find(file => path.basename(file) === MOD_CONFIG_FILE) !== undefined)
      && !isAssemblyOnlyMod(),
     requiredFiles: [],
    });
}

export async function installModConfig(files: string[], destinationPath: string) {
  // Find the mod config file and use it to build the instructions.
  const modConfigFile = files.find(file => path.basename(file) === MOD_CONFIG_FILE);
  const filtered = files.filter(file => {
    // No directories, assembly tool files, readmes or mod config files.
    const segments = file.split(path.sep);
    const lastElementExt = path.extname(segments[segments.length - 1]);
    return (modConfigFile !== file) && ['', '.txt', ASSEMBLY_EXT].indexOf(lastElementExt) === -1;
  });
  const configData = await fs.readFileAsync(path.join(destinationPath, modConfigFile), { encoding: 'utf8' });
  let data;
  try {
    data = rjson.parse(util.deBOM(configData));
  } catch (err) {
    log('error', 'Unable to parse modpack_config.cfg', err);
    return Promise.reject(new util.DataInvalid('Invalid modpack_config.cfg file'));
  }

  if (!data.entries) {
    return Promise.reject(new util.DataInvalid('modpack_config.cfg file contains no entries'))
  }

  const instructions = filtered.reduce((accum, file) => {
    const matchingEntry = data.entries.find(entry =>
      ('src' in entry) && (entry.src.toLowerCase() === file.toLowerCase()));
    if (!!matchingEntry) {
      const destination = matchingEntry.dest.substring(MOD_CONFIG_DEST_ELEMENT.length);
      accum.push({
        type: 'copy',
        source: file,
        destination,
      });
    } else {
      // This may just be a pointless addition by the mod author - we're going to log
      //  this and continue.
      log('warn', 'Failed to find matching manifest entry for file in archive', file);
    }

    return accum;
    }, []);
  return Promise.resolve({ instructions });
}

export function testInstaller(files, gameId) {
  if (gameId !== GAME_ID) {
    return Promise.resolve({ supported: false, requiredFiles: [] });
  }
  const haloGames = identifyHaloGames(files);
  return Promise.resolve({
    supported: (haloGames.length > 0),
    requiredFiles: [],
  });
}

export async function install(files: string[], destinationPath: string) {
  const haloGames =  identifyHaloGames(files);
  const internalIds = haloGames.map(game => game.internalId);
  const attrInstruction: types.IInstruction = {
    type: 'attribute',
    key: 'haloGames',
    value: internalIds,
  }
    
  const instructions: types.IInstruction[] = haloGames.reduce((accum, haloGame) => {
    const filtered = files.filter(file => {
      const segments = file.split(path.sep).filter(seg => !!seg);
      return (path.extname(segments[segments.length - 1]) !== '')
        && (segments.indexOf(haloGame.modsPath) !== -1);
    });

    filtered.forEach(element => {
      const segments = element.split(path.sep).filter(seg => !!seg);
      const rootIdx = segments.indexOf(haloGame.modsPath);
      const destination = segments.splice(rootIdx).join(path.sep);
      accum.push({
        type: 'copy',
        source: element,
        destination
      });
    });
    return accum;
  }, [attrInstruction]);
  return Promise.resolve({ instructions });
}