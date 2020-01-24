import {IGameDetail} from '../../../types/IExtensionContext';
import {IGame} from '../../../types/IGame';
import * as fs from '../../../util/fs';
import {log} from '../../../util/log';
import walk from '../../../util/walk';

import {IDiscoveryResult} from '../types/IDiscoveryResult';

import Promise from 'bluebird';

function queryGameInfo(game: IGame & IDiscoveryResult): Promise<{ [key: string]: IGameDetail }> {
  if (game.path === undefined) {
    return Promise.resolve({});
  }
  let totalSize = 0;
  let sizeWithoutLinks = 0;
  const start = Date.now();
  return walk(game.path, (iter: string, stats: fs.Stats) => {
    totalSize += stats.size;
    // symbolic links are still counted because walk uses lstat, so the size returned is
    // the size of the link itself, not the linked file so it's appropriate the add it
    if (stats.nlink === 1) {
      sizeWithoutLinks += stats.size;
    }
    return Promise.resolve();
  })
  .then(() => {
    return {
      size: {title: 'Space Used', value: totalSize, type: 'bytes'},
      size_nolinks: {
        title: 'Space Used (No Symlinks)',
        value: sizeWithoutLinks,
        type: 'bytes',
      },
    };
  })
  .catch(err => {
    log('error', 'failed to query game info', { err: err.message });
    return {};
  });
}
export default queryGameInfo;
