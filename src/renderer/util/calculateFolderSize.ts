import walk from "./walk";

function calculateFolderSize(dirPath: string): Promise<number> {
  let totalSize = 0;
  return walk(dirPath, (iterPath, stats) => {
    if (stats.isFile()) {
      totalSize += stats.size;
    }
    return Promise.resolve();
  }, { ignoreErrors: true })
    .then(() => totalSize);
}

export default calculateFolderSize;
