import * as path from 'path';
import { IEntry } from 'turbowalk';

interface ITypeDescription {
  icon: string;
  tooltip: string;
}

export const typeDescription: { [id: string]: ITypeDescription } = {
  plugin:     { icon: 'plugin', tooltip: 'Game Plugins' },
  interface:  { icon: 'interface', tooltip: 'Interface' },
  texture:    { icon: 'texture', tooltip: 'Textures' },
  mesh:       { icon: 'mesh', tooltip: 'Meshes' },
  animation:  { icon: 'animation', tooltip: 'Animations' },
  map:        { icon: 'map', tooltip: 'Game Map' },
  music:      { icon: 'music', tooltip: 'Music & Sound' },
  shader:     { icon: 'shader', tooltip: 'Graphics Shaders' },
  archive:    { icon: 'archive', tooltip: 'Asset Bundle' },
  script:     { icon: 'script', tooltip: 'Scripts' },
  extender:   { icon: 'extender', tooltip: 'Extends modding capabilities' },
  config:     { icon: 'config', tooltip: 'Configuration' },
  executable: { icon: 'executable', tooltip: 'Executable (Tools and such)' },
  fomod:     { icon: 'select-install', tooltip: 'Installed using a FOMOD installer' },
};

export const typeIndices = Object.keys(typeDescription).reduce((prev, type, idx) => {
  prev[type] = idx;
  return prev;
}, {});

export function byTypeIndex(lhs: string, rhs: string): number {
  return typeIndices[lhs] - typeIndices[rhs];
}

interface IFileType {
  type: string;
  condition?: (gameId: string, entry: IEntry) => boolean;
}

const scriptExtenderGames = new Set([
  'oblivion', 'skyrim', 'skyrimse', 'skyrimvr',
  'fallout3', 'falloutnv', 'fallout4', 'fallout4vr',
  'enderal', 'enderalspecialedition',
]);

function supportsScriptExtender(gameId: string): boolean {
  return scriptExtenderGames.has(gameId);
}

const gamesUsingPythonScripting = new Set([
  'thesims4',
]);

const gamesUsingDLLPlugins = new Set([
  'stardewvalley',
]);

const gamesUsingImagesAsTextures = new Set([
  'stardewvalley', 'darksouls2', 'intothebreach',
]);

export const fileTypes: { [ext: string]: IFileType[] } = {
  '.dds': [{ type: 'texture' }],
  '.exe': [{ type: 'executable' }],
  '.bat': [{ type: 'executable' }],
  '.cmd': [{ type: 'executable' }],
  '.jar': [{ type: 'executable' }],
  '.py': [{ type: 'executable', condition: gameId => !gamesUsingPythonScripting.has(gameId) },
          { type: 'script', condition: gameId => gamesUsingPythonScripting.has(gameId) }],

  '.swf': [{ type: 'interface' }],
  '.xml': [{ type: 'config' }],
  '.json': [{ type: 'config',
              condition: (gameId, entry) => path.basename(entry.filePath) !== 'manifest.json' }],
  '.ini': [{ type: 'config' }],

  '.wav': [{ type: 'music' }],
  '.mp3': [{ type: 'music' }],
  '.ogg': [{ type: 'music' }],

  '.png': [{ type: 'texture', condition: gameId => gamesUsingImagesAsTextures.has(gameId) }],
  '.jpg': [{ type: 'texture', condition: gameId => gamesUsingImagesAsTextures.has(gameId) }],
  '.tga': [{ type: 'texture' }],

  '.unity3d': [{ type: 'archive' }],
  '.arc': [{ type: 'archive' }],
  '.tri': [{ type: 'mesh' }], // facegen
  '.pak': [{ type: 'archive' }],

  // gamebryo formats
  '.nif': [{ type: 'mesh' }], // net immerse
  '.xwm': [{ type: 'music' }],
  '.fuz': [{ type: 'music' }], // audio + lip sync data
  '.bsa': [{ type: 'archive' }],
  '.ba2': [{ type: 'archive' }],
  '.esp': [{ type: 'plugin' }],
  '.esm': [{ type: 'plugin' }],
  '.esl': [{ type: 'plugin' }],
  '.pex': [{ type: 'script' }],
  '.dll': [{ type: 'extender', condition: supportsScriptExtender },
           { type: 'plugin', condition: gameId => gamesUsingDLLPlugins.has(gameId) }],
  '.hkx': [{ type: 'animation' }],

  // sims 4
  '.ts4script': [{ type: 'script' }],
  '.package': [{ type: 'archive' }],
  '.bpi': [{ type: 'plugin' }],
  '.blueprint': [{ type: 'plugin' }],
  '.trayitem': [{ type: 'plugin' }],
  '.sfx': [{ type: 'music' }],
  '.ion': [{ type: 'plugin' }],
  '.householdbinary': [{ type: 'plugin' }],
  '.sgi': [{ type: 'plugin' }],
  '.hhi': [{ type: 'plugin' }],
  '.room': [{ type: 'plugin' }],
  '.midi': [{ type: 'music' }],
  '.rmi': [{ type: 'plugin' }],

  // Stardew Valley
  '.tbin': [{ type: 'textures' }], // actually tilesets

  // Neverwinter Nights
  '.mod': [{ type: 'plugin' }],
  '.hak': [{ type: 'archive' }],
  '.bmu': [{ type: 'music' }],

  // Dragon Age
  '.ani': [{ type: 'animation' }],

  // Rage Engine (GTA and such)
  '.rpf': [{ type: 'archive' }],
  '.asi': [{ type: 'extender' }],
  '.ytd': [{ type: 'texture' }],
  '.awc': [{ type: 'music' }],
  '.ymt': [{ type: 'config' }],
  '.gfx': [{ type: 'interface' }],
  '.meta': [{ type: 'config' }],

  // Into the Breach
  '.lua': [{type: 'script'}],
};
