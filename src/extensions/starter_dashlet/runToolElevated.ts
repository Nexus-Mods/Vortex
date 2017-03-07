import { IDiscoveredTool } from '../../types/IDiscoveredTool';
import elevated from '../../util/elevated';
import {log} from '../../util/log';

import runElevatedCustomTool from './runElevatedCustomTool';

import ipc = require('node-ipc');
import * as path from 'path';
import { generate as shortid } from 'shortid';

// run the specified tool in a separate process with elevated
// permissions
function runToolElevated(tool: IDiscoveredTool,
                         onError: (message: string, details: string) => void) {
  let toolCWD = tool.currentWorkingDirectory !== undefined ?
    tool.currentWorkingDirectory : path.dirname(tool.path);
  let elevatedTool = {
    id: tool.id,
    toolPath: tool.path.replace(/\\/g, '\\\\'),
    parameters: tool.parameters,
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
