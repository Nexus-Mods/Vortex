// dummy declarations
let toolPath: string;
// tslint:disable-next-line:prefer-const
let toolCWD: string;
// tslint:disable-next-line:prefer-const
let parameters: string[];

function runElevatedCustomTool(ipcClient) {
  const exec = require('child_process').execFile;
  try {
    let params: string[] = [];
    if (parameters !== undefined) {
      params = parameters;
    }

    const execOptions = {
        cwd: toolCWD,
      };

    toolPath = toolPath.replace(/\\/g, '\\\\');
    exec(toolPath, params, execOptions, (err, output) => {
      // exec will report an error even if it's simply a not-0 exit code
      // which is not something we should react to (when you start from
      // windows explorer or similar you don't get notified of status
      // code != 0 either so it shouldn't be a situation to worry about
      ipcClient.emit('finished', {});
      process.exit(0);
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
