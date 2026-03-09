const Promise = require('bluebird');
const path = require('path');
const { util } = require('vortex-api');
const winapi = require('winapi-bindings');

/* 
Ignore the Meshes\AnimTextData\AnimationOffsets\PersistantSubgraphInfoAndOffsetData.txt file as a conflict. 
It's present in a lot of weapon mods but doesn't matter if it's overwritten. 
This issue is compounded by users extracting all their BA2s. 
*/
const IGNORED_FILES = [ path.join('**', 'PersistantSubgraphInfoAndOffsetData.txt') ];

const MS_ID = 'BethesdaSoftworks.Fallout4-PC';
const GOG_ID = '1998527297';
const EPIC_ID = '61d52ce4d09d41e48800c22784d13ae8';
const STEAM_ID = '377160';

let tools = [
  {
    id: 'FO4Edit',
    name: 'FO4Edit',
    logo: 'fo3edit.png',
    executable: () => 'FO4Edit.exe',
    requiredFiles: [
      'FO4Edit.exe',
    ],
  },
  {
    id: 'WryeBash',
    name: 'Wrye Bash',
    logo: 'wrye.png',
    executable: () => 'Wrye Bash.exe',
    requiredFiles: [
      'Wrye Bash.exe',
    ],
  },
  {
    id: 'f4se',
    name: 'Fallout 4 Script Extender',
    shortName: 'F4SE',
    executable: () => 'f4se_loader.exe',
    requiredFiles: [
      'f4se_loader.exe',
      'Fallout4.exe',
    ],
    relative: true,
    exclusive: true,
    defaultPrimary: true
  },
  {
    id: 'bodyslide',
    name: 'BodySlide',
    executable: () => path.join('Data', 'Tools', 'BodySlide', 'BodySlide x64.exe'),
    requiredFiles: [
      path.join('Data', 'Tools', 'BodySlide', 'BodySlide x64.exe'),
    ],
    relative: true,
    logo: 'auto',
  }
];

async function requiresLauncher(gamePath, store) {
  const xboxSettings = {
    launcher: 'xbox',
    addInfo: {
      appId: MS_ID,
      parameters: [
        { appExecName: 'Game' },
      ],
    }
  };
  const epicSettings = {
    launcher: 'epic',
    addInfo: {
      appId: EPIC_ID,
    }
  };
  if (store !== undefined) {
    if (store === 'xbox') return Promise.resolve(xboxSettings);
    if (store === 'epic') return Promise.resolve(epicSettings);
    else return Promise.resolve(undefined);
  }
  // Store type isn't detected. Try and match the Xbox path. 
  try {
    const game = await util.GameStoreHelper.findByAppId([MS_ID], 'xbox');
    const normalizeFunc = await util.getNormalizeFunc(gamePath);
    if (normalizeFunc(game.gamePath) === normalizeFunc(gamePath)) return Promise.resolve(xboxSettings);
    else return Promise.resolve(undefined);
  }
  catch(err) {
    return Promise.resolve(undefined);
  }
}

function main(context) {
  context.registerGame({
    id: 'fallout4',
    name: 'Fallout 4',
    mergeMods: true,
    queryArgs: {
      steam: [{ name: 'Fallout 4' }],
      xbox: [{ id: MS_ID }],      
      gog: [{ id: GOG_ID, prefer: 0 }],
      epic: [{ id: EPIC_ID }],
      registry: [{ id: 'HKEY_LOCAL_MACHINE:Software\\Wow6432Node\\Bethesda Softworks\\Fallout4:Installed Path' }],
    },
    supportedTools: tools,
    queryModPath: () => 'Data',
    logo: 'gameart.jpg',
    executable: () => 'Fallout4.exe',
    requiredFiles: [
      'Fallout4.exe',
    ],
    requiresLauncher,
    environment: {
      SteamAPPId: STEAM_ID,
      GogAPPId: GOG_ID,
      XboxAPPId: MS_ID,
      EpicAPPId: EPIC_ID,   
    },
    details: {
      steamAppId: +STEAM_ID,
      gogAppId: GOG_ID,
      xboxAppId: MS_ID,
      epicAppId: EPIC_ID,
      ignoreConflicts: IGNORED_FILES,
      compatibleDownloads: ['fallout4london'],
      hashFiles: [
        'appxmanifest.xml',
        'Data/Fallout4.esm',
      ]
    }
  });

  return true;
}

module.exports = {
  default: main,
};
