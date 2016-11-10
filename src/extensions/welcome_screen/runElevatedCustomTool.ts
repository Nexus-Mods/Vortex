let toolPath: string = '';
let parameters: string = '';

function runElevatedCustomTool(ipcClient) {
  const exec = require('child_process').execFile;
  ipcClient.on('run-elevated-tool', () => {
    try {
      let params: string[] = parameters.split(' ');
      toolPath = toolPath.replace(/\\/g, '\\\\');
      exec(toolPath, params, (err, output) => {
        if (err) {
          ipcClient.emit('log', {
            level: 'error',
            message: 'Elevation Error',
            meta: { err: err.message },
          });
          return;
        }
      })
      .finally(() => {
          ipcClient.emit('finished', {});
        });
    } catch (err) {
      ipcClient.emit('log', {
        level: 'error',
        message: 'Elevation Error',
        meta: { err: err.message },
      });
    }
  });
  ipcClient.on('disconnect', () => {
    process.exit(0);
  });
  ipcClient.emit('initialised');
}

export default runElevatedCustomTool;
