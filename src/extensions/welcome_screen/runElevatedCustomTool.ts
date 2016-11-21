// dummy declarations
let toolPath: string;
let toolCWD: string;
let parameters: string[];

function runElevatedCustomTool(ipcClient) {
  const exec = require('child_process').execFile;
  try {
    let params: string[] = [];
    if (parameters !== undefined) {
      params = parameters;
    }

    let execOptions = {
        cwd: toolCWD,
      };

    toolPath = toolPath.replace(/\\/g, '\\\\');
    exec(toolPath, params, execOptions, (err, output) => {
      // exec will report an error even if it's simply a not-0 exit code
      // which is not something we should react to (when you start from
      // windows explorer or similar you don't get notified of status
      // code != 0 either so it shouldn't be a situation to worry about
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
