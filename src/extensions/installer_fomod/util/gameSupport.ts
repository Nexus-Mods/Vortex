import { IGame } from '../../../types/IGame';

import * as path from 'path';
import { IDiscoveryResult } from '../../../types/IState';
import getVortexPath from '../../../util/getVortexPath';
import { discoveryByGame } from '../../gamemode_management/selectors';
import { makeOverlayableDictionary } from '../../../util/util';
import { IExtensionApi } from '../../../types/IExtensionContext';

function bethIni(gamePath: string, iniName: string) {
  return path.join(getVortexPath('documents'), 'My Games', gamePath, iniName + '.ini');
}

function toWordExp(input: string): string {
  return '(^|/)' + input + '(/|$)';
}

const gamebryoTopLevel: string[] = ['distantlod', 'textures', 'meshes', 'music', 'shaders', 'video',
      'interface', 'fonts', 'scripts', 'facegen', 'menus', 'lodsettings', 'lsdata', 'sound',
      'strings', 'trees', 'asi', 'tools', 'calientetools'];

const gamebryoPatterns: string[] = [
  '[^/]*\\.esp$',
  '[^/]*\\.esm$',
  '[^/]*\\.esl$',
  '[^/]*\\.bsa$',
  '[^/]*\\.ba2$',
  'fomod/ModuleConfig.xml$',
].concat(gamebryoTopLevel.map(toWordExp));

const uniPatterns: string[] = ['fomod'].map(toWordExp);

function stopPatterns(gameMode: string) {
  switch (gameMode) {
    case 'fallout3': return [].concat(uniPatterns, gamebryoPatterns, ['fose'].map(toWordExp));
    case 'falloutnv': return [].concat(uniPatterns, gamebryoPatterns, ['nvse'].map(toWordExp));
    case 'fallout4': return [].concat(uniPatterns, gamebryoPatterns, ['f4se'].map(toWordExp));
    case 'fallout4vr': return [].concat(uniPatterns, gamebryoPatterns, ['f4se'].map(toWordExp));
    case 'oblivion': return [].concat(uniPatterns, gamebryoPatterns, ['obse'].map(toWordExp));
    case 'morrowind': return [].concat(uniPatterns, gamebryoPatterns, ['mwse'].map(toWordExp));
    case 'skyrim': return [].concat(uniPatterns, gamebryoPatterns,
                                    ['skse', 'SkyProc Patchers'].map(toWordExp));
    case 'skyrimse': return [].concat(uniPatterns, gamebryoPatterns,
                                      ['skse'].map(toWordExp));
    case 'dragonsdogma': return ['movie', 'rom', 'sa', 'sound', 'system', 'tgs',
                                 'usershader', 'usertexture'].map(toWordExp).concat(uniPatterns);
    case 'stateofdecay': return ['characters', 'dialog', 'Entities', 'languages',
                                  'levels', 'libs', 'objects', 'scripts',
                                   'sounds'].map(toWordExp).concat(uniPatterns);
    case 'witcher2': return ['abilities', 'characters', 'combat', 'cutscenes',
                              'engine', 'environment', 'environment_levels', 'fx',
                              'game', 'globals', 'items', 'junk', 'levels', 'reactions',
                              'speedtree', 'templates', 'tests'].map(toWordExp).concat(uniPatterns);
    case 'kingdomcomedeliverance':
      return ['[^/]*\\.pak$'].concat(['mod.manifest'].map(toWordExp), uniPatterns);
    case 'pillarsofeternity2':
      return ['manifest.json', 'thumb.png', 'localized', 'conversations', 'atlases'].map(toWordExp);
    case 'vampirebloodlines':
      return ['[^/]*\\.vpk$'].concat(['cfg', 'cl_dlls', 'dlg', 'dlls', 'maps', 'materials',
              'models', 'particles', 'python', 'resource', 'save', 'scripts', 'sound',
              'vdata'].map(toWordExp));
    case 'sekiro':
      return ['action', 'Artwork_MiniSoundtrack', 'chr', 'cutscene', 'event', 'facegen', 'font',
              'map', 'menu', 'movie', 'msg', 'mtd', 'obj', 'other', 'param', 'parts', 'script',
              'sfx', 'shader', 'sound'].map(toWordExp);
    case 'darkestdungeon':
      return ['audio', 'campaign', 'colours', 'curios', 'cursors', 'dlc', 'dungeons',
              'effects', 'fe_flow', 'fonts', 'fx', 'heroes', 'inventory', 'loading_screen',
              'localization', 'loot', 'maps', 'modes', 'monsters', 'overlays', 'panels',
              'props', 'raid', 'raid_results', 'scripts', 'scrolls', 'shaders', 'shared',
              'trinkets', 'upgrades', 'video'].map(toWordExp);
    case 'bladeandsorcery':
      return ['Brains', 'Collisions', 'Containers', 'Creatures', 'CreatureTables', 'Damagers',
              'Effects', 'Expressions', 'FXs', 'HandPoses', 'Interactables', 'Items', 'LootTables',
              'PhysicMaterials', 'Ragdolls', 'Spells', 'Texts', 'UMAPresets',
              'Waves'].map(toWordExp);
    case 'shadowrunreturns':
      return ['data', 'project.cpack.txt', 'project.cpack.bytes'].map(toWordExp);
    case 'neverwinter':
      return ['ambient', 'database', 'development', 'dmvault', 'hak',
              'localvault', 'logs', 'modules', 'movies', 'music', 'nwsync', 'override', 'portraits',
              'servervault', 'tempclient', 'tlk'].map(toWordExp);
    case 'neverwinter2':
      return ['ambient', 'ambient_X1', 'ambient_X2', 'Campaigns', 'data', 'database', 'dmvault',
              'hak', 'localvault', 'modules', 'movies', 'music', 'music_X1', 'music_X2', 'nwm',
              'override', 'patch', 'portraits', 'pwc', 'saves', 'servervault', 'texturepacks',
              'tlk', 'ui'].map(toWordExp);
    case 'daggerfallunity':
      return ['factions', 'fonts', 'mods', 'questpacks', 'quests', 'soundfonts', 'spellicons',
              'tables', 'text', 'textures'].map(toWordExp);
    case 'thesims4':
      return ['[^/]*\\.package$', '[^/]*\\.ts4script$', '[^/]*\\.py[co]?$'];
    default: return [].concat(uniPatterns);
  }
}

interface IGameSupport {
  iniPath?: () => string;
  stopPatterns: string[];
  pluginPath?: string;
  nativePlugins?: string[];
}

const gameSupport = makeOverlayableDictionary<string, IGameSupport>({
  dragonsdogma: {
    stopPatterns: stopPatterns('dragonsdogma'),
  },
  fallout4: {
    iniPath: () => bethIni('Fallout4', 'Fallout4'),
    stopPatterns: stopPatterns('fallout4'),
    pluginPath: 'Data',
    nativePlugins: [
      'fallout4.esm',
      'dlcrobot.esm',
      'dlcworkshop01.esm',
      'dlccoast.esm',
      'dlcultrahighresolution.esm',
      'dlcworkshop02.esm',
      'dlcworkshop03.esm',
      'dlcnukaworld.esm',
      'ccbgsfo4001-pipboy(black).esl',
      'ccbgsfo4002-pipboy(blue).esl',
      'ccbgsfo4003-pipboy(camo01).esl',
      'ccbgsfo4004-pipboy(camo02).esl',
      'ccbgsfo4006-pipboy(chrome).esl',
      'ccbgsfo4012-pipboy(red).esl',
      'ccbgsfo4014-pipboy(white).esl',
      'ccbgsfo4016-prey.esl',
      'ccbgsfo4017-mauler.esl',
      'ccbgsfo4018-gaussrifleprototype.esl',
      'ccbgsfo4019-chinesestealtharmor.esl',
      'ccbgsfo4020-powerarmorskin(black).esl',
      'ccbgsfo4038-horsearmor.esl',
      'ccbgsfo4039-tunnelsnakes.esl',
      'ccbgsfo4041-doommarinearmor.esl',
      'ccbgsfo4042-bfg.esl',
      'ccbgsfo4043-doomchainsaw.esl',
      'ccbgsfo4044-hellfirepowerarmor.esl',
      'ccfsvfo4001-modularmilitarybackpack.esl',
      'ccfsvfo4002-midcenturymodern.esl',
      'ccfrsfo4001-handmadeshotgun.esl',
      'cceejfo4001-decorationpack.esl',
    ],
  },
  fallout4vr: {
    iniPath: () => bethIni('Fallout4VR', 'Fallout4Custom'),
    stopPatterns: stopPatterns('fallout4'),
    pluginPath: 'Data',
    nativePlugins: [
      'fallout4.esm',
      'dlcrobot.esm',
      'dlcworkshop01.esm',
      'dlccoast.esm',
      'dlcultrahighresolution.esm',
      'dlcworkshop02.esm',
      'dlcworkshop03.esm',
      'dlcnukaworld.esm',
    ],
  },
  fallout3: {
    iniPath: () => bethIni('Fallout3', 'Fallout3'),
    stopPatterns: stopPatterns('fallout3'),
    pluginPath: 'Data',
    nativePlugins: [
      'fallout3.esm',
      'anchorage.esm',
      'thepitt.esm',
      'brokensteel.esm',
      'pointlookout.esm',
      'zeta.esm',
    ],
  },
  falloutnv: {
    iniPath: () => bethIni('FalloutNV', 'Fallout'),
    stopPatterns: stopPatterns('falloutnv'),
    pluginPath: 'Data',
    nativePlugins: [
      'falloutnv.esm',
    ],
  },
  morrowind: {
    iniPath: () => bethIni('Morrowind', 'Morrowind'),
    stopPatterns: stopPatterns('morrowind'),
    pluginPath: 'Data',
    nativePlugins: [
      'morrowind.esm',
    ],
  },
  oblivion: {
    iniPath: () => bethIni('Oblivion', 'Oblivion'),
    stopPatterns: stopPatterns('oblivion'),
    pluginPath: 'Data',
    nativePlugins: [
      'oblivion.esm',
    ],
  },
  nehrim: {
    stopPatterns: stopPatterns('oblivion'),
    pluginPath: 'Data',
    nativePlugins: [
      'nehrim.esm',
    ],
  },
  skyrim: {
    iniPath: () => bethIni('Skyrim', 'Skyrim'),
    stopPatterns: stopPatterns('skyrim'),
    pluginPath: 'Data',
    nativePlugins: [
      'skyrim.esm',
      'update.esm',
    ],
  },
  enderal: {
    iniPath: () => bethIni('Enderal', 'Enderal'),
    stopPatterns: stopPatterns('skyrim'),
    pluginPath: 'Data',
    nativePlugins: [
      'skyrim.esm',
      'update.esm',
    ],
  },
  enderalspecialedition: {
    iniPath: () => bethIni('Enderal Special Edition', 'Enderal'),
    stopPatterns: stopPatterns('skyrimse'),
    pluginPath: 'Data',
    nativePlugins: [],
  },
  skyrimse: {
    iniPath: () => bethIni('Skyrim Special Edition', 'Skyrim'),
    stopPatterns: stopPatterns('skyrimse'),
    pluginPath: 'Data',
    nativePlugins: [
      'skyrim.esm',
      'update.esm',
      'dawnguard.esm',
      'hearthfires.esm',
      'dragonborn.esm',
    ],
  },
  skyrimvr: {
    iniPath: () => bethIni('Skyrim VR', 'Skyrim'),
    stopPatterns: stopPatterns('skyrimse'),
    pluginPath: 'Data',
    nativePlugins: [
      'skyrim.esm',
      'skyrimvr.esm',
      'update.esm',
      'dawnguard.esm',
      'hearthfires.esm',
      'dragonborn.esm',
    ],
  },
  witcher2: {
    stopPatterns: stopPatterns('witcher2'),
  },
  kingdomcomedeliverance: {
    stopPatterns: stopPatterns('kingdomcomedeliverance'),
  },
  subnautica: {
    stopPatterns: stopPatterns('subnautica'),
    pluginPath: 'QMods',
  },
  stateofdecay: {
    stopPatterns: stopPatterns('stateofdecay'),
  },
  pillarsofeternity2: {
    stopPatterns: stopPatterns('pillarsofeternity2'),
  },
  vampirebloodlines: {
    stopPatterns: stopPatterns('vampirebloodlines'),
  },
  sekiro: {
    stopPatterns: stopPatterns('sekiro'),
  },
  darkestdungeon: {
    stopPatterns: stopPatterns('darkestdungeon'),
  },
  bladeandsorcery: {
    stopPatterns: stopPatterns('bladeandsorcery'),
  },
  shadowrunreturns: {
    stopPatterns:  stopPatterns('shadowrunreturns'),
  },
  nwn: {
    stopPatterns: stopPatterns('neverwinter'),
  },
  nwnee: {
    stopPatterns: stopPatterns('neverwinter'),
  },
  neverwinter2: {
    stopPatterns: stopPatterns('neverwinter2'),
  },
  daggerfallunity: {
    stopPatterns: stopPatterns('daggerfallunity'),
  },
  thesims4: {
    stopPatterns: stopPatterns('thesims4'),
  },
}, {
  gog: {
    skyrimse: {
      iniPath: () => bethIni('Skyrim Special Edition GOG', 'Skyrim'),
    },
  },
  epic: {
    skyrimse: {
      iniPath: () => bethIni('Skyrim Special Edition EPIC', 'Skyrim'),
    },
  },
  xbox: {
    skyrimse: {
      iniPath: () => bethIni('Skyrim Special Edition MS', 'Skyrim'),
    },
    fallout4: {
      iniPath: () => bethIni('Fallout4 MS', 'Fallout4'),
    },
  },
  enderalseOverlay: {
    enderalspecialedition: {
      iniPath: () => bethIni('Skyrim Special Edition', 'Skyrim'),
    },
  },
}, (gameId: string) => {
  const discovery = discoveryForGame(gameId);
  if ((discovery?.path !== undefined)
      && (gameId === 'enderalspecialedition')
      && discovery.path.includes('skyrim')) {
    return 'enderalseOverlay';
  }
  else {
    return discovery?.store;
  }
});

let discoveryForGame: (gameId: string) => IDiscoveryResult = () => undefined;

export function initGameSupport(api: IExtensionApi) {
  discoveryForGame = (gameId: string) => discoveryByGame(api.store.getState(), gameId);
}

export function getIniFilePath(gameMode: string): string {
  return gameSupport.get(gameMode, 'iniPath')?.() ?? '';
}

export function getStopPatterns(gameMode: string, game: IGame): string[] {
  if ((game?.details?.stopPatterns !== undefined)) {
    return game.details.stopPatterns;
  }
  return gameSupport.get(gameMode, 'stopPatterns') ?? [];
}

export function getPluginPath(gameMode: string): string {
  return gameSupport.get(gameMode, 'pluginPath') ?? null;
}

export function getNativePlugins(gameMode: string): string[] {
  const x = gameSupport.get(gameMode, 'nativePlugins');
  return gameSupport.get(gameMode, 'nativePlugins') ?? [];
}
