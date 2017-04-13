export function remoteCode(ipcClient) {
  let walk = require('./walk').default;
  let fs = require('fs-extra-promise');
  let path = require('path');

  ipcClient.on('link-file', (payload) => {
    let {source, destination} = payload;
    fs.ensureDirAsync(path.dirname(destination))
        .then(() => fs.symlinkAsync(source, destination))
        .then(() => {
          ipcClient.emit('log', {
            level: 'debug',
            message: 'installed',
            meta: {source, destination},
          });
        })
        .catch((err) => {
          ipcClient.emit('log', {
            level: 'error',
            message: 'failed to install symlink',
            meta: {err: err.message},
          });
        })
        .finally(() => { ipcClient.emit('finished', {source}); });
  });

  ipcClient.on('remove-link', (payload) => {
    let { destination } = payload;
    fs.lstatAsync(destination)
    .then(stats => {
      if (stats.isSymbolicLink()) {
        return fs.removeAsync(destination);
      }
    })
    .finally(() => { ipcClient.emit('finished', {destination}); });
    ;
  });

  ipcClient.on('create-link', (payload) => {
    let {source, destination} = payload;
    try {
      walk(source, (iterPath: string, stat) => {
        let relPath: string = path.relative(source, iterPath);
        let destFile: string = path.join(destination, relPath);
        if (stat.isDirectory()) {
          return fs.mkdirAsync(destFile);
        } else {
          return fs.symlinkAsync(iterPath, destFile)
              .then(() => {
                ipcClient.emit('log', {
                  level: 'debug',
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
