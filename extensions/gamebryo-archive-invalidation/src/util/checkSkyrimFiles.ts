import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as moment from 'moment';
import { types } from 'nmm-api';
import * as path from 'path';

function checkSkyrimFiles(
  store: Redux.Store<types.IState>,
  gameId: string,
  gamePath: string): Promise<string[]> {

  let invalidFiles: string[] = [];

  return fs.readdirAsync(gamePath)
    .then((files) => {
      let fileName: string[] = files.filter((file) => {
        return file.substring(0, 9) === 'Skyrim - ' && path.extname(file) === '.bsa';
      });

      return Promise.all(fileName.map((file) => {
        return fs.statAsync(path.join(gamePath, file))
          .then((stats: any) => {
            let edgeDate = moment('2008-10-1', 'yyyy-mm-dd');
            if (stats.mtime > edgeDate) {
              invalidFiles.push(file);
            }
          });
      }));
    })
    .then(() => {
      return Promise.resolve(invalidFiles);
    });
}

export default checkSkyrimFiles;
