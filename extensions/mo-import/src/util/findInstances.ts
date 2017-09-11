import parseMOIni from './parseMOIni';

import * as Promise from 'bluebird';
import { FileAccessError } from 'core-error-predicates';
import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import { types } from 'vortex-api';

export function instancesPath(): string {
  return path.resolve(remote.app.getPath('appData'), '..', 'local', 'ModOrganizer');
}

function findInstances(games: {[gameId: string]: types.IDiscoveryResult},
                       gameId: string): Promise<string[]> {
  const base = instancesPath();
  return fs.readdirAsync(base)
    .filter(fileName => fs.statAsync(path.join(base, fileName))
                            .then(stat => stat.isDirectory())
                            .catch(FileAccessError, () => false))
    .filter(dirName => parseMOIni(games, path.join(base, dirName))
                            .then(moConfig => moConfig.game === gameId)
                            .catch(err => false))
    .then((instances: string[]) => instances);
}

export default findInstances;
