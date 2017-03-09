import elevated from '../../util/elevated';
import {log} from '../../util/log';

import runElevatedCustomTool from './runElevatedCustomTool';
import StarterInfo from './StarterInfo';

import ipc = require('node-ipc');
import * as path from 'path';
import { generate as shortid } from 'shortid';

// run the specified tool in a separate process with elevated
// permissions
function runToolElevated(starter: StarterInfo,
                         onError: (message: string, details: string) => void) {
  let toolCWD = starter.workingDirectory !== undefined ?
    starter.workingDirectory : path.dirname(starter.exePath);
  let elevatedTool = {
    id: starter.id,
    toolPath: starter.exePath.replace(/\\/g, '\\\\'),
    parameters: starter.commandLine,
    toolCWD,
  };

  // the ipc path has to be different every time so that
  // the ipc lib doesn't report EADDRINUSE when the same tool
  // is started multiple times.
  // Also node-ipc has a bug and would crash the application
  // if that were to happen
  const ipcPath: string = 'tool_elevated_' + shortid();
  // communicate with the elevated process via ipc
  ipc.serve(ipcPath, () => {
    ipc.server.on('finished', (modPath: string) => {
      ipc.server.stop();
    });
    ipc.server.on('socket.disconnected', () => {
      log('info', 'disconnected');
    });
    ipc.server.on('log', (ipcData: any) => {
      log(ipcData.level, ipcData.message, ipcData.meta);
      onError(ipcData.message, ipcData.meta.err);
    });
    // run it
    elevated(ipcPath, runElevatedCustomTool,
      elevatedTool);
  });
  ipc.server.start();
}

export default runToolElevated;
