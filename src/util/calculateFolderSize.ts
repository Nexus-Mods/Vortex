// TODO: Remove Bluebird import - using native Promise;
import path from 'path';
import walk from './walk';

function calculateFolderSize(dirPath: string): Promise<number> {
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
    .then(() => Promise.resolve(totalSize))
    .catch(err => Promise.reject(err));
}

export default calculateFolderSize;
