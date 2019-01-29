export function remoteCode(ipcClient, req) {
  return new Promise<void>((resolve, reject) => {
    const TAG_NAME = process.platform === 'win32' ? '__folder_managed_by_vortex' : '.__folder_managed_by_vortex';

    const fs = req('fs-extra-promise');
    const path = req('path');

    ipcClient.on('link-file', (payload) => {
      const {source, destination, num} = payload;
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
              // if the directory did exist there is a chance the destination file already
              // exists
              return fs.removeAsync(destination)
                .catch(err => (err.code === 'ENOENT')
                  ? Promise.resolve()
                  : Promise.reject(err));
            }
          })
          .then(() => fs.symlinkAsync(source, destination)
              .catch(err => (err.code !== 'EEXIST')
                  ? Promise.reject(err)
                  : fs.removeAsync(destination)
                    .then(() => fs.symlinkAsync(source, destination))))
          .then(() => {
            ipcClient.emit('log', {
              level: 'debug',
              message: 'installed',
              meta: {source, destination},
            });
            ipcClient.emit('completed', { err: null, num });
          })
          .catch((err) => {
            if (err.code === 'EISDIR') {
              ipcClient.emit('report', 'not-supported');
            } else {
              ipcClient.emit('log', {
                level: 'error',
                message: 'failed to install symlink',
                meta: { err: err.message },
              });
            }
            ipcClient.emit('completed', { err, num });
          });
    });

    ipcClient.on('remove-link', (payload) => {
      const { destination, num } = payload;
      fs.lstatAsync(destination)
      .then(stats => {
        if (stats.isSymbolicLink()) {
          return fs.removeAsync(destination);
        }
      })
      .then(() => {
        ipcClient.emit('completed', { err: null, num });
      })
      .catch((err) => {
        ipcClient.emit('completed', { err, num });
      });
    });

    ipcClient.on('disconnect', () => { resolve(); });
    ipcClient.emit('initialised');
  });
}
