import { app as appIn, remote } from 'electron';
import * as path from 'path';

const app = appIn || remote.app;

function bethIni(gamePath: string, iniName: string) {
  return path.join(app.getPath('documents'), 'My Games', gamePath, iniName + '.ini');
}

function toWordExp(input: string): string {
  return '\b' + input + '\b';
}

const gamebryoTopLevel: string[] = ['distantlod', 'textures', 'meshes', 'music', 'shaders', 'video',
      'interface', 'fonts', 'scripts', 'facegen', 'menus', 'lodsettings', 'lsdata', 'sound',
      'strings', 'trees', 'asi'];

const gamebryoPatterns: string[] = [
  '[^/]*\.esp$',
  '[^/]*\.esm$',
  '[^/]*\.esl$',
  'fomod/ModuleConfig.xml$',
].concat(gamebryoTopLevel.map(toWordExp));

const uniPatterns: string[] = ['fomod'].map(toWordExp);

function stopPatterns(gameMode: string) {
  switch (gameMode) {
    case 'fallout3': return [].concat(uniPatterns, gamebryoPatterns, ['fose'].map(toWordExp));
    case 'falloutnv': return [].concat(uniPatterns, gamebryoPatterns, ['nvse'].map(toWordExp));
    case 'fallout4': return [].concat(uniPatterns, gamebryoPatterns, ['f4se'].map(toWordExp));
    case 'oblivion': return [].concat(uniPatterns, gamebryoPatterns, ['obse'].map(toWordExp));
    case 'skyrim': return [].concat(uniPatterns, gamebryoPatterns,
                                    ['skse', 'SkyProc Patchers'].map(toWordExp));
    case 'skyrimse': return [].concat(uniPatterns, gamebryoPatterns);
    case 'dragonsdogma': return ['movie', 'rom', 'sa', 'sound', 'system', 'tgs',
                                 'usershader', 'usertexture'].map(toWordExp).concat(uniPatterns);
    case 'stateofdecay': return ['characters', 'dialog', 'Entities', 'languages',
                                  'levels', 'libs', 'objects', 'scripts',
                                   'sounds'].map(toWordExp).concat(uniPatterns);
    case 'witcher2': return ['abilities', 'characters', 'combat', 'cutscenes',
                              'engine', 'environment', 'environment_levels', 'fx',
                              'game', 'globals', 'items', 'junk', 'levels', 'reactions',
                              'speedtree', 'templates', 'tests'].map(toWordExp).concat(uniPatterns);
    default: return [].concat(uniPatterns);
  }
}

interface IGameSupport {
  iniPath?: string;
  stopPatterns: string[];
  pluginPath?: string;
}

const gameSupport: { [gameId: string]: IGameSupport } = {
  dragonsdogma: {
    stopPatterns: stopPatterns('dragonsdogma'),
  },
  fallout4: {
    iniPath: bethIni('Fallout4', 'Fallout4'),
    stopPatterns: stopPatterns('fallout4'),
    pluginPath: 'Data',
  },
  fallout3: {
    iniPath: bethIni('Fallout3', 'Fallout3'),
    stopPatterns: stopPatterns('fallout3'),
    pluginPath: 'Data',
  },
  falloutnv: {
    iniPath: bethIni('FalloutNV', 'Fallout'),
    stopPatterns: stopPatterns('falloutnv'),
    pluginPath: 'Data',
  },
  oblivion: {
    iniPath: bethIni('Oblivion', 'Oblivion'),
    stopPatterns: stopPatterns('oblivion'),
    pluginPath: 'Data',
  },
  skyrim: {
    iniPath: bethIni('Skyrim', 'Skyrim'),
    stopPatterns: stopPatterns('skyrim'),
    pluginPath: 'Data',
  },
  skyrimse: {
    iniPath: bethIni('Skyrim Special Edition', 'Skyrim'),
    stopPatterns: stopPatterns('skyrimse'),
    pluginPath: 'Data',
  },
  witcher2: {
    stopPatterns: stopPatterns('witcher2'),
  },
};

export function getIniFilePath(gameMode: string) {
  if ((gameSupport[gameMode] === undefined)
      || (gameSupport[gameMode].iniPath === undefined)) {
    return '';
  }

  return gameSupport[gameMode].iniPath;
}

export function getStopPatterns(gameMode: string) {
  if ((gameSupport[gameMode] === undefined)
      || (gameSupport[gameMode].stopPatterns === undefined)) {
    return [];
  }

  return gameSupport[gameMode].stopPatterns;
}

export function getPluginPath(gameMode: string) {
  if ((gameSupport[gameMode] === undefined)
      || (gameSupport[gameMode].pluginPath === undefined)) {
    return null;
  }

  return gameSupport[gameMode].pluginPath;
}
