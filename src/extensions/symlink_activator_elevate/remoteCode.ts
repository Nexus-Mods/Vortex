export function remoteCode(ipcClient) {
  const TAG_NAME = '__delete_if_empty';

  const walk = require('./walk').default;
  const fs = require('fs-extra-promise');
  const path = require('path');

  ipcClient.on('link-file', (payload) => {
    const {source, destination} = payload;
    fs.ensureDirAsync(path.dirname(destination))
        .then(created => {
          if (created !== null) {
            ipcClient.emit('log', {
              level: 'debug',
              message: 'created directory',
              meta: { dirName: path.dirname(destination) },
            });
            return fs.writeFileAsync(
                path.join(created, TAG_NAME),
                'This directory was created by Vortex deployment and will be removed ' +
                    'during purging if it\'s empty');
          } else {
            return Promise.resolve();
          }
        })
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
    const { destination } = payload;
    fs.lstatAsync(destination)
    .then(stats => {
      if (stats.isSymbolicLink()) {
        return fs.removeAsync(destination);
      }
    })
    .finally(() => { ipcClient.emit('finished', {destination}); });
  });

  ipcClient.on('create-link', (payload) => {
    const {source, destination} = payload;
    try {
      walk(source, (iterPath: string, stat) => {
        const relPath: string = path.relative(source, iterPath);
        const destFile: string = path.join(destination, relPath);
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
