// dummy declarations. Filled with random data to ensure webpack (-plugins) don't try to
// optimize these away
let toolPath: string = `${Math.random()}`;
// tslint:disable-next-line:prefer-const
let toolCWD: string = `${Math.random()}`;
// tslint:disable-next-line:prefer-const
let parameters: string[] = [`${Math.random()}`];
// tslint:disable-next-line:prefer-const
let environment: any = { foobar: Math.random() };

function runElevatedCustomTool(ipcClient, req: NodeRequire): Promise<void> {
  return new Promise((resolve, reject) => {
    const emit = (message, payload) => {
      ipcClient.sendMessage({ message, payload });
    };

    const exec = req('child_process').execFile;
    try {
      let params: string[] = [];
      if (parameters !== undefined) {
        params = parameters;
      }

      const execOptions = {
          cwd: toolCWD,
          env: { ...process.env, ...environment },
        };

      toolPath = toolPath.replace(/\\/g, '\\\\');
      emit('log', {
        level: 'info',
        message: 'start tool elevated',
        meta: { toolPath, params },
      });
      exec(toolPath, params, execOptions, (err, output) => {
        // exec will report an error even if it's simply a not-0 exit code
        // which is not something we should react to (when you start from
        // windows explorer or similar you don't get notified of status
        // code != 0 either so it shouldn't be a situation to worry about
        emit('finished', {});
        emit('log', {
          level: err ? 'error' : 'info',
          message: 'tool finished',
          meta: err ? { err } : {},
        });
        resolve();
      });
    } catch (err) {
      emit('log', {
        level: 'error',
        message: 'Elevation Error',
        meta: { err: err.message },
      });
      reject(err);
    }
  });
}

export default runElevatedCustomTool;
