import { app as appIn, remote } from 'electron';
import * as path from 'path';

const app = appIn || remote.app;

function bethIni(gamePath: string, iniName: string) {
  return path.join(app.getPath('documents'), 'My Games', gamePath, iniName + '.ini');
}

const gamebryoTopLevel: string[] = ['distantlod', 'textures', 'meshes', 'music', 'shaders', 'video',
      'interface', 'fonts', 'scripts', 'facegen', 'menus', 'lodsettings', 'lsdata', 'sound',
      'strings', 'trees', 'asi'];

const allTopLevel: string[] = ['fomod'];

function archiveTopLevelDirectories(gameMode: string) {
  switch (gameMode) {
    case 'fallout3': return [].concat(allTopLevel, gamebryoTopLevel, ['fose']);
    case 'falloutnv': return [].concat(allTopLevel, gamebryoTopLevel, ['nvse']);
    case 'fallout4': return [].concat(allTopLevel, gamebryoTopLevel, ['f4se']);
    case 'oblivion': return [].concat(allTopLevel, gamebryoTopLevel, ['obse']);
    case 'skyrim': return [].concat(allTopLevel, gamebryoTopLevel, ['skse', 'SkyProc Patchers']);
    case 'skyrimse': return [].concat(allTopLevel, gamebryoTopLevel);
    case 'dragonsdogma': return ['movie', 'rom', 'sa', 'sound', 'system', 'tgs',
                                 'usershader', 'usertexture'].concat(allTopLevel);
    case 'stateofdecay': return ['characters', 'dialog', 'Entities', 'languages',
                                  'levels', 'libs', 'objects', 'scripts',
                                   'sounds'].concat(allTopLevel);
    case 'witcher2': return ['abilities', 'characters', 'combat', 'cutscenes',
                              'engine', 'environment', 'environment_levels', 'fx',
                              'game', 'globals', 'items', 'junk', 'levels', 'reactions',
                              'speedtree', 'templates', 'tests'].concat(allTopLevel);
    default: return [].concat(allTopLevel);
  }
}

const gameSupport = {
  dragonsdogma: {
    topLevelDirectories: () => archiveTopLevelDirectories('dragonsdogma'),
  },
  fallout4: {
    iniPath: () => bethIni('Fallout4', 'Fallout4'),
    topLevelDirectories: () => archiveTopLevelDirectories('fallout4'),
  },
  fallout3: {
    iniPath: () => bethIni('Fallout3', 'Fallout3'),
    topLevelDirectories: () => archiveTopLevelDirectories('fallout3'),
  },
  falloutnv: {
    iniPath: () => bethIni('FalloutNV', 'Fallout'),
    topLevelDirectories: () => archiveTopLevelDirectories('falloutnv'),
  },
  oblivion: {
    iniPath: () => bethIni('Oblivion', 'Oblivion'),
    topLevelDirectories: () => archiveTopLevelDirectories('oblivion'),
  },
  skyrim: {
    iniPath: () => bethIni('Skyrim', 'Skyrim'),
    topLevelDirectories: () => archiveTopLevelDirectories('skyrim'),
  },
  skyrimse: {
    iniPath: () => bethIni('Skyrim Special Edition', 'Skyrim'),
    topLevelDirectories: () => archiveTopLevelDirectories('skyrimse'),
  },
  witcher2: {
    topLevelDirectories: () => archiveTopLevelDirectories('witcher2'),
  },
};

export function getIniFilePath(gameMode: string) {
  if ((gameSupport[gameMode] === undefined)
      || (gameSupport[gameMode].iniPath === undefined)) {
    return '';
  }

  return gameSupport[gameMode].iniPath();
}

export function getTopLevelDirectories(gameMode: string) {
  if ((gameSupport[gameMode] === undefined)
      || (gameSupport[gameMode].topLevelDirectories === undefined)) {
    return [];
  }

  return gameSupport[gameMode].topLevelDirectories();
}
