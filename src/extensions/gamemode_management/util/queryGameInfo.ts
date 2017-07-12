import {IGameDetail} from '../../../types/IExtensionContext';
import {IGame} from '../../../types/IGame';
import walk from '../../../util/walk';

import {IDiscoveryResult} from '../types/IDiscoveryResult';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';

function queryGameInfo(game: IGame & IDiscoveryResult): Promise<{ [key: string]: IGameDetail }> {
  if (game.path === undefined) {
    return Promise.resolve({});
  }
  let totalSize = 0;
  let sizeWithoutLinks = 0;
  const start = new Date().getTime();
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
      path: {title: 'Path', value: game.path, type: 'url'},
      size: {title: 'Space Used', value: totalSize, type: 'bytes'},
      size_nolinks: {
        title: 'Space Used (without links)',
        value: sizeWithoutLinks,
        type: 'bytes',
      },
    };
  });
}

export default queryGameInfo;
