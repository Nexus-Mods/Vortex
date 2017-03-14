import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import { types } from 'nmm-api';
import * as path from 'path';

function checkFallout4Files(
  store: Redux.Store<types.IState>,
  gameId: string,
  gamePath: string): Promise<string[]> {

  let invalidFiles: string[] = [];

  return fs.readdirAsync(gamePath)
    .then((files) => {
      let fileName: string[] = files.filter((file) => {
        return file.startsWith('Fallout4 - ', 0) && path.extname(file) === '.ba2';
      });

      return Promise.all(fileName.map((file) => {
        return fs.statAsync(path.join(gamePath, file))
          .then((stats: any) => {
            if (stats.mtime > new Date(2008, 10, 1)) {
              invalidFiles.push(file);
            }
          });
      }));
    })
    .then(() => {
      return Promise.resolve(invalidFiles);
    });
}

export default checkFallout4Files;
