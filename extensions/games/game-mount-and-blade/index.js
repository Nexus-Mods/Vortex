/* 
  Mount & Blade games consist of 2 modTypes:
    - Entire module based mods which include a module.ini file.
    - Mods without a module.ini will be deployed to the native module
        folder based upon their file extension.
*/
const Promise = require('bluebird');
const path = require('path');
const winapi = require('winapi-bindings');
const { fs, util } = require('vortex-api');

// Mount and Blade module based mods have a module.ini
//  file. We can use this to find the root directory of the
//  mod regardless of archive folder structure.
const MAB_MODULE_FILE = 'module.ini';

// The common registry key path which can be used to
//  find the installation folder using the game's steam ID.
const steamReg = 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App ';

// A map of file extensions mapped against their
//  expected folder name. ()
const MOD_EXT_DESTINATION = {
  '.dds': 'textures',
  '.brf': 'resource',
  '.sco': 'sceneobj',
  '.txt': '',
  // Music and sound override mods are currently not supported due to the fact
  //  that all sound extensions are used interchangeably between the Music and sound
  //  folders - this is making it hard to differentiate between the wanted destination
  //  folder, unless the mod creator places the files within the correct folders.

  //  TODO: Enhance extension to support correctly placed Sound/Music files.
  //'.mp3':
};

// Mount and blade game dictionary containing all
//  relevant information for game discovery.
const MAB_GAMES = {
  mountandblade: {
    id: 'mountandblade',
    name: 'Mount & Blade',
    steamId: '22100',
    regPath: steamReg + '22100',
    logo: 'gameart.jpg',
    exec: 'mount&blade.exe',
    nativeModuleName: 'native',
    versionRgx: /^works_with_version_max.*[0-9]$/gm,
  },
  mbwarband: {
    id: 'mbwarband',
    name: 'Mount & Blade:\tWarband',
    steamId: '48700',
    regPath: steamReg + '48700',
    logo: 'gameartwarband.png',
    exec: 'mb_warband.exe',
    nativeModuleName: 'native',
    versionRgx: /^compatible_multiplayer_version_no.*[0-9]$/gm,
  },
  mbwithfireandsword: {
    id: 'mbwithfireandsword',
    name: 'Mount & Blade:\tWith Fire and Sword',
    steamId: '48720',
    regPath: steamReg + '48720',
    logo: 'gameartfire.png',
    exec: 'mb_wfas.exe',
    nativeModuleName: 'Ogniem i Mieczem',
    versionRgx: /^module_version.*[0-9]$/gm,
  },
  // Not sure if Viking Conquest is a Warband mod or
  //  a standalone game ? Will keep this commented out
  //  until we can test it.
  //
  // vikingConquest: {
  //   id: 'mountandbladevikingconquest',
  //   name: 'Mount & Blade: Viking Conquest',
  //   steamId: '321300',
  //   regPath: steamReg + '321300',
  //   logo: 'gameartviking.png',
  //   exec: ?????
  // },
}

function findGame(mabGame) {
  const { name, regPath } = mabGame;

  try {
    const instPath = winapi.RegGetValue(
      'HKEY_LOCAL_MACHINE',
      regPath,
      'InstallLocation');
    if (!instPath) {
      throw new Error('empty registry key');
    }
    return Promise.resolve(instPath.value);
  } catch (err) {
    return util.steam.findByName(name)
      .then(game => game.gamePath);
  }
}

async function resolveGameVersion(discoveryPath, mnbGame) {
  const nativeModuleName = MAB_GAMES[mnbGame].nativeModuleName;
  const rgx = MAB_GAMES[mnbGame].versionRgx;
  const nativeIniPath = path.join(discoveryPath, 'Modules', nativeModuleName, 'module.ini');
  try {
    const iniData = await fs.readFileAsync(nativeIniPath, { encoding: 'utf8' });
    const match = iniData.match(rgx);
    const version = (match !== null)
      ? match[0].replace(/[^0-9.]/gm, '')
      : undefined;

    return version !== undefined
      ? Promise.resolve(version)
      : Promise.reject(new util.DataInvalid('Cannot resolve game version'));
  } catch (err) {
    return Promise.reject(err);
  }
}

function prepareForModding(discovery) {
    return fs.ensureDirAsync(path.join(discovery.path, 'modules'));
}

function main(context) {
  Object.keys(MAB_GAMES).map(key => {
    const mabGame = MAB_GAMES[key];
    context.registerGame({
      id: mabGame.id,
      name: mabGame.name,
      mergeMods: true,
      queryPath: () => findGame(mabGame),
      queryModPath: () => 'modules',
      logo: mabGame.logo,
      executable: () => mabGame.exec,
      getGameVersion: (discoveryPath) => resolveGameVersion(discoveryPath, key),
      requiredFiles: [
        mabGame.exec,
      ],
      environment: {
        SteamAPPId: mabGame.steamId,
      },
      details: {
        steamAppId: parseInt(mabGame.steamId, 10),
      },
      setup: prepareForModding,
    });
  });

  context.registerInstaller('mount-and-blade-mod', 25, testSupportedContent, installContent);

  return true;
}

function installContent(files,
                        destinationPath,
                        gameId,
                        progressDelegate) {
  let instructions = [];
  if (files.find((file => path.basename(file).toLowerCase() === MAB_MODULE_FILE)) !== undefined) {
    const modName = path.parse(path.basename(destinationPath)).name;
    instructions = installModuleMod(files, modName);
  } else if (files.find(file => path.extname(file).toLowerCase() in MOD_EXT_DESTINATION) !== undefined) {
    instructions = installOverrideMod(files, MAB_GAMES[gameId].nativeModuleName);
  }
  return Promise.resolve({instructions});
}

function testSupportedContent(files, gameId) {
  // Make sure we have a module.ini configuration file, or known overridable files within the archive.
  const supported = (gameId in MAB_GAMES) 
    && ((files.find((file => path.basename(file).toLowerCase() === MAB_MODULE_FILE)) !== undefined) 
    || (files.find(file => path.extname(file).toLowerCase() in MOD_EXT_DESTINATION) !== undefined))
  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function installOverrideMod(files, nativeModuleName) {
  // We were not able to find a module.ini file; we will treat this as
  //  an override mod and place recognised file extensions in their expected
  //  directory.
  const instructions = files
    .filter(file => MOD_EXT_DESTINATION[path.extname(file).toLowerCase()] !== undefined)
    .map(file => {
      const fileType = path.extname(file).toLowerCase();
      let extFolder = MOD_EXT_DESTINATION[fileType];
      let finalDestination = path.join(nativeModuleName, extFolder, path.basename(file));

      return {
        type: 'copy',
        source: file,
        destination: finalDestination,
      };
    });

  return instructions;
}

function installModuleMod(files, moduleName) {
  // We're going to assume that the folder where we find the module.ini file
  //  is the root directory of the module.
  //  - We're going to ignore any files that are outside the root directory.
  const filtered = files.filter(file => path.extname(file) !== '');
  const trimIndex = filtered.find((file => path.basename(file).toLowerCase() === MAB_MODULE_FILE)).indexOf(MAB_MODULE_FILE);
  const instructions = filtered.map(file => {
        // Remove all precedent folders up to the modRoot directory.
        //  this way we ensure we don't create huge pointless folder structures
        //  which the M&B game can't support.
        const finalDestination = trimIndex !== 0 
          ? path.join(moduleName, file.substr(trimIndex))
          : path.join(moduleName, file);
        
        const instruction = {
          type: 'copy',
          source: file,
          destination: finalDestination,
        }
        return (instruction.destination !== path.join(moduleName, ''))
          ? instruction
          : undefined;
    });

  return instructions.filter(inst => inst !== undefined);
}

module.exports = {
  default: main
};
