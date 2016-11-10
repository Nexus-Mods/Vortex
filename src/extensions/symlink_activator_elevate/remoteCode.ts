export function remoteCode(ipcClient) {
  let walk = require('./walk').default;
  let fs = require('fs-extra-promise');
  let path = require('path');

  ipcClient.on('create-link', (payload) => {
    let{source, destination} = payload;
    try {
      walk(source, (iterPath: string, stat) => {
        let relPath: string = path.relative(source, iterPath);
        let destFile: string = path.join(destination, relPath);
        if (stat.isDirectory()) {
          return fs.mkdirAsync(iterPath);
        } else {
          return fs.symlinkAsync(iterPath, destFile)
              .then(() => {
                ipcClient.emit('log', {
                  level: 'info',
                  message: 'installed',
                  meta: {source: iterPath, destination: destFile},
                });
              })
              .catch((err) => {
                ipcClient.emit('log', {
                  level: 'error',
                  message: 'failed to install symlink',
                  meta: {err: err.message},
                });
              });
        }
      }).finally(() => { ipcClient.emit('finished', {source}); });
    } catch (err) {
      ipcClient.emit('log', {
        level: 'info',
        message: 'failed to create link',
        meta: {err: err.message},
      });
    }
  });
  ipcClient.on('disconnect', () => { process.exit(0); });
  ipcClient.emit('initialised');
}
