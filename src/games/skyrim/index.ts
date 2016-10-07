import { IGame } from '../../types/IGame';
import { ISupportedTools } from '../../types/ISupportedTools';

import * as Promise from 'bluebird';
import Registry = require('winreg');

import { log } from '../../util/log';

let fs = require('fs-extra');
let path = require('path');

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

function findPath(toolExecutable: string) {

    let directory = "C:\\Program Files (x86)";
           
    return new Promise<string>((resolve, reject) => {
        walk(directory, function (err, results) {
            if (err) {
                console.log('ERROR '+err);
                return reject(err.message);
            }
            else {
                if (results !== null) {
                    console.log('FIND '+results);
                    return resolve(results.value);
                }
            }
        });

        function walk(directory, done) {
            fs.readdir(directory, function (err, list) {
                if (err) {
                    console.log('ERR2 ' + err);
                    return done(err);
                }
                let i = 0;
                (function next() {
                    let file = list[i++];
                    if (!file) {
                        return done(null, null);
                    }
                    file = directory + '/' + file;
                    fs.stat(file, function (err, stat) {
                        if (stat && stat.isDirectory()) {
                            walk(file, function (err, res) {
                                if (err) {
                                    //return done(err);
                                }
                                else if (res !== '') {
                                    done(err, res);
                                }
                                next();
                            });
                        } else {
                                                        
                            if (path.basename(file) === toolExecutable) {
                                console.log('TOOL '+ toolExecutable);
                                let splittedFile = file.split(path.basename(file));
                                let gamePath = splittedFile[0];
                                return done(null, gamePath);
                            }

                            next();
                        }
                    });
                })();
            });
        };
    });
    
}

function findRegEditPath(toolExecutable: string) {
    
        if (Registry === undefined) {
            // linux ? macos ?
            return null;
        }
        //"toolRegEditPath": "\\SOFTWARE\\WOW6432Node\\LOOT"
        
        let regKey = new Registry({
            hive: Registry.HKLM,
            key: '\\Software\\Wow6432Node\\Bethesda Softworks\\skyrim',
        });

        return new Promise<string>((resolve, reject) => {
            regKey.get('Installed Path', (err: Error, result: Registry.RegistryItem) => {
                if (err !== null) {
                    log('info', 'reg error', { err });
                    reject(err.message);
                } else {
                    resolve(result.value);
                }
            });
        });
    
}

function findTools(): ISupportedTools[] {

    let SupportedTools = [];

    try {
        var tools = require('supportedtools.json');
        
        for (let spawn of tools.spawn) {
        
            let tool: ISupportedTools = {
                name: spawn.toolName,
                executable: spawn.executable,
                icon: spawn.toolIcon,
                location: findPath,
            };
                      
            SupportedTools.push(tool);
            
        }
    }
    catch (err) { console.log(err) }
    
    return SupportedTools;
}

const game: IGame = {
  id: 'skyrim',
  name: 'Skyrim',
  queryGamePath: findGame,
  supportedTools: findTools,
  logo: 'logo.png',
  requiredFiles: [
    'TESV.exe',
  ],
  

};

export default game;
