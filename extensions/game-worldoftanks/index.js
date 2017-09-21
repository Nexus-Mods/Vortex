const fs = require('fs');
const path = require('path');
const Registry = require('winreg');
const { Parser } = require('xml2js');
const { log, util } = require('vortex-api');

function findGame() {
  if (Registry === undefined) {
    // linux ? macos ?
    return null;
  }

  let regKey = new Registry({
    hive: Registry.HKCU,
    key: '\\Software\\Wargaming.net\\Launcher\\Apps\\wot',
  });

  return new Promise((resolve, reject) => {
    regKey.values((err, result) => {
      if (err !== null) {
        return reject(err);
      }
      if (result.length === 0) {
        return resolve(null);
      }
      // the keys seem to be a hash or something, but even
      // on a vanilla installation there are two entries, both
      // with the same value (though different capitalization)
      resolve(result[0].value);
    });
  });
}

let version;

function queryModPath(gamePath) {
  if (version === undefined) {
    const data = fs.readFileSync(path.join(gamePath, 'version.xml'), { encoding: 'utf8' });
    const parser = new Parser();
    parser.parseString(data, (err, res) => {
      if (err !== null) {
        throw err;
      }
      try {
        version = res['version.xml'].version[0];
        version = version.replace(/ ?v.([0-9.]*) .*/, '$1');
        fs.statSync(path.join(gamePath, 'res_mods', version));
      } catch (parseErr) {
        throw new Error('failed to determine correct mod directory');
      }
    });
  }

  return path.join(gamePath, 'res_mods', version);
}

function main(context) {
  context.registerGame({
    id: 'worldoftanks',
    name: 'World Of Tanks',
    mergeMods: false,
    queryPath: findGame,
    queryModPath,
    logo: 'gameart.png',
    executable: () => 'WorldOfTanks.exe',
    requiredFiles: [
      'WorldOfTanks.exe',
    ],
    details: {
    },
  });

  return true;
}

module.exports = {
  default: main,
};
