import elevated from './elevated';
import {log} from './log';
import runElevatedCustomTool from './runElevatedCustomTool';
import StarterInfo from './StarterInfo';

import * as Promise from 'bluebird';
import { spawn } from 'child_process';
import ipc = require('node-ipc');
import * as path from 'path';
import { generate as shortid } from 'shortid';

export type DeployResult = 'auto' | 'yes' | 'skip' | 'cancel';

function runToolElevated(starter: StarterInfo,
                         onError: (message: string, details: string) => void) {
  const toolCWD = starter.workingDirectory !== undefined ?
    starter.workingDirectory : path.dirname(starter.exePath);
  const elevatedTool = {
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

function startDeploy(queryDeploy: () => Promise<DeployResult>,
                     events: NodeJS.EventEmitter): Promise<boolean> {
  return queryDeploy()
  .then(shouldDeploy => {
    if (shouldDeploy === 'yes') {
      return new Promise<boolean>((resolve, reject) => {
              events.emit('activate-mods', (err) => {
                if (err !== null) {
                  reject(err);
                } else {
                  resolve(true);
                }
              });
      });
    } else if (shouldDeploy === 'auto') {
      return new Promise<boolean>((resolve, reject) => {
        events.emit('await-activation', (err: Error) => {
          if (err !== null) {
            reject(err);
          } else {
            resolve(true);
          }
        });
      });
    } else if (shouldDeploy === 'cancel') {
      return Promise.resolve(false);
    } else { // skip
      return Promise.resolve(true);
    }
  });
}

function startTool(starter: StarterInfo,
                   events: NodeJS.EventEmitter,
                   queryElevate: (name: string) => Promise<boolean>,
                   queryDeploy: () => Promise<DeployResult>,
                   onShowError: (message: string, details?: string | Error) => void,
                   ): Promise<void> {
  return startDeploy(queryDeploy, events)
    .then((doStart: boolean) => {
      if (doStart) {
        try {
          const defaults = {
            cwd: starter.workingDirectory,
            env: { ...process.env, ...starter.environment },
          };
          const child = spawn(starter.exePath, [], defaults);

          child.on('error',
                   (err) => { onShowError('Failed to run executable', err); });

          child.on('close', (code) => {
            if (code !== 0) {
              // TODO: the child_process returns an exit code of 53 for SSE and
              // FO4, and an exit code of 1 for Skyrim. We don't know why but it
              // doesn't seem to affect anything
              log('warn', 'child process exited with code: ' + code, {});
            }
          });
        } catch (err) {
        // TODO: as of the current electron version (1.4.14) the error isn't precise
        //   enough to determine if the error was actually lack of elevation but among
        //   the errors that report "UNKNOWN" this should be the most likely one.
        if (err.errno === 'UNKNOWN') {
          queryElevate(starter.name)
          .then(shouldElevate => {
            if (shouldElevate) {
              runToolElevated(starter, onShowError);
            }
          });
        } else {
          log('info', 'failed to run custom tool', { err: err.message });
        }
      }
    }
  });
}

export default startTool;
