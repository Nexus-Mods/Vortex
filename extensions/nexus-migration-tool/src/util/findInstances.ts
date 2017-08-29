import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

function convertGameId(input: string): string {
  return input.replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
}

function getVirtualFolder(userConfig: string, gameId: string): string {
  const parser = new DOMParser();

  const xmlDoc = parser.parseFromString(userConfig, 'text/xml');

  const item = xmlDoc
    .querySelector(`setting[name="VirtualFolder"] item[modeId="${convertGameId(gameId)}"] string`);

  if (item === null) {
    return undefined;
  }

  const setting = item.textContent;
  return setting;
}

function findInstances(gameId: string): Promise<string[]> {
  const base = path.resolve(remote.app.getPath('appData'), '..', 'local', 'Black_Tree_Gaming');
  return fs.readdirAsync(base)
    .then((instances: string[]) =>
      Promise.map(instances, instance =>
        fs.readdirAsync(path.join(base, instance))
        .then((versions: string[]) =>
          Promise.map(versions, version =>
            fs.readFileAsync(path.join(base, instance, version, 'user.config'))
            .then((data: NodeBuffer) => {
              return getVirtualFolder(data.toString(), gameId);
          })))))
      .then(result => {
          // remove duplicates, in a case-insensitive way, remove undefined
          const set = result.reduce((prev: { [key: string]: string }, value: string[]) => {
              value.forEach(val => {
                  if (val !== undefined) {
                      prev[val.toUpperCase()] = val;
                  }
              });
              return prev;
          }, {});
          return Object.keys(set).map(key => set[key]);
      })
    .catch(err => (err.code === 'ENOENT') ? [] : Promise.reject(err));
}

export default findInstances;
