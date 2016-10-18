import { IGame } from '../../types/IGame';
import { ISupportedTool } from '../../types/ISupportedTool';

import { log } from '../../util/log';

import * as Promise from 'bluebird';
import Registry = require('winreg');

import * as fs from 'fs-extra-promise';
import * as path from 'path';

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

function findInProgramFiles(executable: string) {
  let base = 'C:\\Program Files (x86)';

  return new Promise<string>((resolve, reject) => {
    walk(base, (err, results) => {
      if (err) {
        log('error', 'failed to walk', { err: err.message });
        return reject(err.message);
      } else {
        if (results !== null) {
          console.log('debug', 'found', { results });
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
                let splittedFile = file.split(path.basename(file));
                let gamePath = splittedFile[0];
                return done(null, gamePath);
              }

              next();
            }
          });
        };
        next();
      });
    }
  });
}

let tools: ISupportedTool[] = [
  {
    id: 'TES5Edit',
    name: 'TES5Edit',
    logo: 'tes5edit.png',
    location: () => findInProgramFiles('TES5Edit.exe'),
  },
   {
    id: 'WryeBash',
    name: 'WryeBash',
    logo: 'wrye.png',
    location: () => findInProgramFiles('Wrye Bash.exe'),
  },
  {
    id: 'loot',
    name: 'LOOT',
    logo: 'loot.png',
    location: () => findInProgramFiles('LOOT.exe'),
  },
  {
    id: 'FNIS',
    name: 'FNIS',
    logo: 'fnis.png',
    location: () => findInProgramFiles('GenerateFNISforUsers.exe'),
  },
];

const game: IGame = {
  id: 'skyrim',
  name: 'Skyrim',
  mergeMods: true,
  queryGamePath: findGame,
  supportedTools: tools,
  queryModPath: () => '.',
  logo: 'logo.png',
  requiredFiles: [
    'TESV.exe',
  ],
};

export default game;
