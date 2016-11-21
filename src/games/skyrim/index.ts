import { IGame } from '../../types/IGame';
import { ITool } from '../../types/ITool';

import * as Promise from 'bluebird';
import Registry = require('winreg');

function findGame() {
  if (Registry === undefined) {
    // linux ? macos ?
    return null;
  }

  let regKey = new Registry({
    hive: Registry.HKLM,
    key: '\\Software\\Wow6432Node\\Bethesda Softworks\\skyrim',
  });

  return new Promise<string>((resolve, reject) => {
    regKey.get('Installed Path', (err: Error, result: Registry.RegistryItem) => {
      if (err !== null) {
        reject(new Error(err.message));
      } else {
        resolve(result.value);
      }
    });
  });
}
/*
function findInProgramFiles(executable: string) {
  let base = 'C:\\Program Files (x86)';

  return new Promise<string>((resolve, reject) => {
    walk(base, (err, results) => {
      if (err) {
        log('error', 'failed to walk', { err: err.message });
        return reject(err.message);
      } else {
        if (results !== null) {
          return resolve(results);
        }
      }
    });

    function walk(directory: string, done: (err, res) => void) {
      fs.readdir(directory, (readErr, list) => {
        if (readErr) {
          log('error', 'failed to read directory', { directory, err: readErr.message });
          return done(readErr, null);
        }
        let i = 0;
        let next = () => {
          let file = list[i++];
          if (!file) {
            return done(null, null);
          }
          file = directory + '/' + file;
          fs.stat(file, (statErr, stat) => {
            if (stat && stat.isDirectory()) {
              walk(file, (walkErr, res) => {
                if (walkErr) {
                  log('error', 'failed to walk', { file, err: walkErr.message });
                } else if (res !== '') {
                  done(null, res);
                }
                next();
              });
            } else {
              if (path.basename(file) === executable) {
                log('info', 'found tool', { executable });
                return done(null, file);
              }

              next();
            }
          });
        };
        next();
      });
    }
  });
}*/

let tools: ITool[] = [
  {
    id: 'TES5Edit',
    name: 'TES5Edit',
    logo: 'tes5edit.png',
    executable: () => 'tes5edit.exe',
    requiredFiles: [
      'tes5edit.exe',
    ],
  },
   {
    id: 'WryeBash',
    name: 'WryeBash',
    logo: 'wrye.png',
    executable: () => 'wryebash.exe',
    requiredFiles: [
      'wryebash.exe',
    ],
  },
  {
    id: 'loot',
    name: 'LOOT',
    logo: 'loot.png',
    executable: () => 'loot.exe',
    requiredFiles: [
      'loot.exe',
    ],
  },
  {
    id: 'FNIS',
    name: 'FNIS',
    logo: 'fnis.png',
    executable: () => 'GenerateFNISForUsers.exe',
    requiredFiles: [
      'GenerateFNISForUsers.exe',
    ],
  },
];

const game: IGame = {
  id: 'skyrim',
  name: 'Skyrim',
  mergeMods: true,
  queryPath: findGame,
  supportedTools: tools,
  queryModPath: () => '.',
  logo: 'logo.png',
  executable: () => 'TESV.exe',
  requiredFiles: [
    'TESV.exe',
  ],
};

export default game;
