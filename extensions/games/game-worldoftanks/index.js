const fs = require('fs');
const { parseString } = require('xml2js');
const path = require('path');
const winapi = require('winapi-bindings');
const { util } = require('vortex-api');

function findGame() {
  if (process.platform !== 'win32') {
    return Promise.reject(new Error('Currently only discovered on windows'));
  }
  return new Promise((resolve, reject) => {
    try {
      winapi.WithRegOpen('HKEY_CURRENT_USER', 'Software\\Wargaming.net\\Launcher\\Apps\\wot', hkey => {
        const keys = winapi.RegEnumValues(hkey);
        // the keys seem to be a hash or something, but even
        // on a vanilla installation there are two entries, both
        // with the same value (though different capitalization)
        if (keys.length > 0) {
          const value = winapi.RegGetValue(hkey, '', keys[0].key);
          return resolve(value.value);
        } else {
          return resolve(null);
        }
      });
    } catch (err) {
      return reject(err);
    }
  });
}

let version;

function queryModPath(api, gamePath) {
  if (version === undefined) {
    try {
      const data = fs.readFileSync(path.join(gamePath, 'version.xml'), { encoding: 'utf8' });
      parseString(data, (err, res) => {
        if (err) {
          throw err;
        }
        version = res?.['version.xml']?.version?.[0];
        version = version.replace(/ ?v.([0-9.]*) .*/, '$1');
        fs.statSync(path.join(gamePath, 'res_mods', version));
      });
    } catch (parseErr) {
      version = undefined;
      api.showErrorNotification('Game not installed',
        'World of Tanks doesn\'t seem to be installed correctly. '
      + 'Please check the version.xml file in your game directory.'
      , { allowReport: false, id: 'wot-not-installed' });
      return '.';
    }
  }

  return path.join(gamePath, 'res_mods', version);
}

function main(context) {
  context.registerGame({
    id: 'worldoftanks',
    name: 'World Of Tanks',
    mergeMods: true,
    queryPath: findGame,
    queryModPath: (gamePath) => queryModPath(context.api, gamePath),
    logo: 'gameart.jpg',
    executable: () => 'WorldOfTanks.exe',
    requiredFiles: [
      'WorldOfTanks.exe',
      'version.xml'
    ],
    details: {
    },
  });

  return true;
}

module.exports = {
  default: main,
};
