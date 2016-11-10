// dummy declarations
let toolPath: string;
let parameters: string;

function runElevatedCustomTool(ipcClient) {
  const exec = require('child_process').execFile;
  try {
    let params: string[] = [];
    if (parameters !== undefined) {
      params = parameters.split(' ');
    }
    toolPath = toolPath.replace(/\\/g, '\\\\');
    exec(toolPath, params, (err, output) => {
      if (err) {
        ipcClient.emit('log', {
          level: 'error',
          message: 'Elevation Error',
          meta: { err: err.message },
        });
      }
      ipcClient.emit('finished', {});
    });
  } catch (err) {
    ipcClient.emit('log', {
      level: 'error',
      message: 'Elevation Error',
      meta: { err: err.message },
    });
  }
  ipcClient.on('disconnect', () => {
    process.exit(0);
  });
}

export default runElevatedCustomTool;
