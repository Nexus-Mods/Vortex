import Bluebird from 'bluebird';
import path from 'path';
import walk from './walk';

function calculateFolderSize(dirPath: string): Bluebird<number> {
  let totalSize = 0;
  const onIter = (walkPath, iter, stats) => {
    if (stats.isFile()) {
      totalSize += stats.size;
    }
    if (stats.isDirectory()) {
      return walk(path.join(walkPath, iter), (iter2, stats2) =>
        onIter(walkPath, iter2, stats2), { ignoreErrors: true });
    }
  };
  return walk(dirPath, (iter, stats) =>
    onIter(dirPath, iter, stats), { ignoreErrors: true })
      .then(() => Bluebird.resolve(totalSize))
      .catch(err => Bluebird.reject(err));
}

export default calculateFolderSize;
