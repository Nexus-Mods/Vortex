import { setSettingsPage } from '../../actions/session';
import {
  IExtensionApi,
  IExtensionContext,
  IInstallResult,
  ISupportedResult,
  ProgressDelegate,
} from '../../types/IExtensionContext';
import { ITestResult } from '../../types/ITestResult';
import { DataInvalid, ProcessCanceled, SetupError, UserCanceled } from '../../util/CustomErrors';
import Debouncer from '../../util/Debouncer';
import getVortexPath from '../../util/getVortexPath';
import { log } from '../../util/log';
import { delayed, toPromise, truthy} from '../../util/util';

import { getGame } from '../gamemode_management/util/getGame';
import { ArchiveBrokenError } from '../mod_management/InstallManager';

import { setInstallerSandbox } from './actions/settings';
import Core from './delegates/Core';
import { settingsReducer } from './reducers/settings';
import {
  getPluginPath,
  getStopPatterns,
  uniPatterns,
} from '../installer_fomod_shared/utils/gameSupport';
import { getChoicesFromState } from '../installer_fomod_shared/utils/helpers';

import Workarounds from './views/Workarounds';

import { CONTAINER_NAME, NET_CORE_DOWNLOAD, NET_CORE_DOWNLOAD_SITE } from './constants';

import Bluebird from 'bluebird';
import { createIPC, killProcess } from 'fomod-installer-ipc';
import * as net from 'net';
import * as path from 'path';
import { generate as shortid } from 'shortid';
import * as util from 'util';
import * as winapi from 'winapi-bindings';
import { execFile, spawn } from 'child_process';
import { SITE_ID } from '../gamemode_management/constants';
import { downloadPathForGame } from '../download_management/selectors';
import ConcurrencyLimiter from '../../util/ConcurrencyLimiter';
import { ITestSupportedDetails } from '../mod_management/types/TestSupported';
import { IInstallationDetails } from '../mod_management/types/InstallFunc';

const fomodProcessLimiter = new ConcurrencyLimiter(5);

// Process management for FOMOD installer processes
interface IActiveProcess {
  pid: number;
  connectionId: string;
  kill?: () => void;
  isolated?: boolean;
  containerName?: string;
  integrity?: string;
}

// Keep track of all spawned processes for cleanup per connection
const activeProcessesByConnection = new Map<string, IActiveProcess>();
let exitHandlerRegistered = false;

// Track exit listeners added by createIPC to prevent accumulation
const exitListenersByConnection = new Map<string, () => void>();

// Function to check and log current listener status for debugging
function checkListenerStatus(context: string = 'manual check') {
  const currentListenerCount = process.listenerCount('exit');
  const trackedListenerCount = exitListenersByConnection.size;
  const activeProcessCount = activeProcessesByConnection.size;

  log('debug', 'Process exit listener status check', {
    context,
    totalExitListeners: currentListenerCount,
    trackedListeners: trackedListenerCount,
    activeProcesses: activeProcessCount,
    untracked: currentListenerCount - trackedListenerCount - (exitHandlerRegistered ? 3 : 0) // 3 for our global handlers
  });

  return {
    totalExitListeners: currentListenerCount,
    trackedListeners: trackedListenerCount,
    activeProcesses: activeProcessCount
  };
}

// Global cleanup function to kill all active processes
function cleanupAllProcesses() {
  log('info', 'Cleaning up all FOMOD installer processes', {
    count: activeProcessesByConnection.size,
    exitListeners: exitListenersByConnection.size
  });

  for (const connectionId of Array.from(activeProcessesByConnection.keys())) {
    try {
      log('debug', 'Aggressive cleanup: unregistering process for connection', { connectionId });
      unregisterProcess(connectionId);
    } catch (err) {
      log('warn', 'Failed to unregister process during cleanup', { connectionId, error: err.message });
    }
  }

  // As a fallback, forcibly remove any remaining listeners
  for (const [connectionId, listener] of Array.from(exitListenersByConnection.entries())) {
    try {
      (process as any).removeListener('exit', listener);
      log('debug', 'Aggressive cleanup: forcibly removed lingering exit listener', { connectionId });
    } catch (err) {
      log('warn', 'Failed to forcibly remove lingering exit listener', { connectionId, error: err.message });
    }
    exitListenersByConnection.delete(connectionId);
  }

  activeProcessesByConnection.clear();
  exitListenersByConnection.clear();
}

// Register global exit handler only once
function ensureExitHandler() {
  if (!exitHandlerRegistered) {
    // Handle normal exit
    process.on('exit', (code) => {
      log('info', 'Process exiting, cleaning up FOMOD processes', {
        code,
        processCount: activeProcessesByConnection.size
      });
      cleanupAllProcesses();
    });

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      log('info', 'Received SIGINT, cleaning up FOMOD processes');
      cleanupAllProcesses();
      process.exit(0);
    });

    // Handle termination signal
    process.on('SIGTERM', () => {
      log('info', 'Received SIGTERM, cleaning up FOMOD processes');
      cleanupAllProcesses();
      process.exit(0);
    });

    exitHandlerRegistered = true;
  }
}

function registerProcess(connectionId: string, pid: number, killCallback?: () => void) {
  ensureExitHandler();

  // Always remove any existing process and exit listener for this connection first (deduplication)
  if (activeProcessesByConnection.has(connectionId)) {
    log('debug', 'Deduplicating: unregistering previous process for connection', { connectionId });
    unregisterProcess(connectionId);
  }
  if (exitListenersByConnection.has(connectionId)) {
    const oldListener = exitListenersByConnection.get(connectionId);
    try {
      (process as any).removeListener('exit', oldListener);
      log('debug', 'Deduplicating: removed previous exit listener for connection', { connectionId });
    } catch (err) {
      log('warn', 'Failed to remove previous exit listener during deduplication', { connectionId, error: err.message });
    }
    exitListenersByConnection.delete(connectionId);
  }

  const processInfo: IActiveProcess = {
    pid,
    connectionId,
    kill: killCallback,
  };

  activeProcessesByConnection.set(connectionId, processInfo);

  log('debug', 'Registered process for connection', {
    connectionId,
    pid,
    totalProcesses: activeProcessesByConnection.size
  });
}

function unregisterProcess(connectionId: string) {
  // Remove any exit listeners that were added for this connection
  if (exitListenersByConnection.has(connectionId)) {
    const exitListener = exitListenersByConnection.get(connectionId);
    try {
      (process as any).removeListener('exit', exitListener);
      log('debug', 'Removed exit listener for connection', { connectionId });
    } catch (err) {
      log('warn', 'Failed to remove exit listener', { connectionId, error: err.message });
    }
    exitListenersByConnection.delete(connectionId);
  }

  // Remove the process from tracking
  const removed = activeProcessesByConnection.delete(connectionId);
  if (removed) {
    log('debug', 'Unregistered process for connection', {
      connectionId,
      remainingProcesses: activeProcessesByConnection.size,
      remainingExitListeners: exitListenersByConnection.size
    });
  }
}

// Function to kill a specific process by connection ID
function killProcessForConnection(connectionId: string): boolean {
  const proc = activeProcessesByConnection.get(connectionId);
  if (proc) {
    try {
      log('debug', 'Killing process for connection', { connectionId, pid: proc.pid });
      killProcess(proc.pid);
      unregisterProcess(connectionId);
      return true;
    } catch (err) {
      log('warn', 'Failed to kill process for connection', {
        connectionId,
        pid: proc.pid,
        error: err.message
      });
      return false;
    }
  }
  return false;
}

// The rest of the error message is localized
const assemblyMissing = new RegExp('Could not load file or assembly \'([a-zA-Z0-9.]*).*');

const INSTALLER_TRIES = 2;

// TODO: Running the fomod installer as a low integrity process is implemented and basically functional
//   (and should be mostly secure) except the host process can't connect to a named pipe the installer
//   process opened and the installer process can't create a pipe for writing.
//   There may be a solution using unnamed pipes inherited to the process or communicating via stdout
//   but that would require a considerable rewrite of this functionality
enum SecurityLevel {
  Regular,
  LowIntegrity,
  Sandbox,
}

export class InstallerFailedException extends Error {
  private mCode: number;
  constructor(code: number) {
    super(`Installer process terminated (Code "${code.toString(16)}")`);
    this.name = this.constructor.name;
    this.mCode = code;
  }

  public get code() {
    return this.mCode;
  }
}

function transformError(err: any): Error {
  let result: Error;
  if (err === undefined) {
    result = new Error('unknown error');
  } else if (typeof(err) === 'string') {
    // I hope these errors aren't localised or something...
    result = ((err === 'The operation was cancelled.')
              || (err === 'A task was canceled'))
      // weeell, we don't actually know if it was the user who cancelled...
      ? new UserCanceled()
      : new Error(err);
  } else if (err.name === 'System.Threading.Tasks.TaskCanceledException') {
    result = new UserCanceled();
  } else if (err.name === 'System.IO.FileNotFoundException') {
    if (err.message.includes('node_modules\\fomod-installer')) {
      const fileName: string = err.FileName.replace(/^file:\/*/, '');
      result = new SetupError(`Your installation is missing "${fileName}" which is part of the `
        + 'Vortex installer. This would only happen if you use an unofficial installer or the '
        + 'Vortex installation was modified.');
    } else {
      const match = err.message.match(assemblyMissing);
      if (match !== null) {
        result = new SetupError(`Your system is missing "${match[1]}" which is supposed to be part `
          + 'of the .NET Runtime. Please reinstall it.', 'netruntime');
      }
    }
  } else if (err.name === 'System.IO.DirectoryNotFoundException') {
    result = new ArchiveBrokenError('The install directory is incomplete, this may mean the '
                                  + 'archive is damaged, extraction failed or the directory '
                                  + 'was externally modified between extraction and now. '
                                  + `"${err.Message}"`);
  } else if ((err.name === 'System.IO.FileLoadException')
             || (err.message ?? '').includes('FileLoadException: Could not load file or assembly')) {
    if (err?.FileName) {
      if (err.FileName.indexOf('node_modules\\fomod-installer') !== -1) {
        const fileName = err.FileName.replace(/^file:\/*/, '');
        result = new SetupError(`Windows prevented Vortex from loading "${fileName}". `
          + 'This is usually caused if you don\'t install Vortex but only extracted it because '
          + 'Windows will then block all executable files. '
          + 'Please install Vortex or unblock all .dll and .exe files manually.');
      }
    } else {
      result = new SetupError('Windows prevented Vortex from loading files necessary '
        + 'to complete the installation. '
        + 'This is often caused if you extracted Vortex manually instead of running the installer or '
        + 'because your windows setup or third party software modified access permissions for these files. '
        + 'Please install Vortex or unblock all .dll and .exe files manually.');
    }
  } else if (err.name === 'System.IO.PathTooLongException') {
    result = new SetupError('The installer tried to access a file with a path longer than 260 '
                        + 'characters. This usually means that your mod staging path is too long.');
  } else if ((err.name === 'System.IO.IOException')
             && (err.stack.includes('System.IO.Path.InternalGetTempFileName'))) {
    const tempDir = getVortexPath('temp');
    result = new SetupError(`Your temp directory "${tempDir}" contains too many files. `
                          + 'You need to clean up that directory. Files in that directory '
                          + 'should be safe to delete (they are temporary after all) but '
                          + 'some will be inaccessible, just ignore those.');
  } else if ((err.Message ?? '').includes('There is not enough space on the disk')) {
    result = new SetupError(err.Message);
  } else if ((err.stack !== null)
             && ((err.stack.indexOf('XNodeValidator.ValidationCallback') !== -1)
             || (err.stack.indexOf('XmlTextReaderImpl.ParseXmlDeclaration') !== -1)
             || (err.stack.indexOf('XmlTextReaderImpl.ParseAttributes') !== -1)
             || (err.stack.indexOf('XmlTextReaderImpl.ParseDocumentContent') !== -1)
             || (err.stack.indexOf('XmlScriptType.Validate') !== -1)
             || (err.stack.indexOf('XmlScriptType.GetXmlScriptVersion') !== -1))) {
    result = new DataInvalid('Invalid installer script: ' + err.message);
  } else if ((err.name === 'System.Xml.XmlException')
             && ((err.stack.indexOf('System.Xml.XmlTextReaderImpl.ParseText') !== -1)
                 || (err.message.indexOf('does not match the end tag') !== -1))) {
    result = new DataInvalid('Invalid installer script: ' + err.message);
  } else if ((err.name === 'System.AggregateException') && (err.InnerException !== undefined)) {
    return transformError(err.InnerException);
  } else if (err.name === 'System.Runtime.Remoting.RemotingException') {
    result = new SetupError('Communication with fomod installer failed. '
                            + 'If you have any details on why or when this happens, '
                            + 'please let us know.');
  } else if (err.Message === 'task timeout') {
    result = new SetupError('A task in the script didn\'t complete in time. The timeouts are set '
                          + 'very generously so it\'s more likely that this is either caused '
                          + 'by a broken .NET installation or something else on your system '
                          + 'interrupted the process (like a debugger).');
  }

  if (result === undefined) {
    if (err instanceof Error) {
      result = err;
    } else {
      result = new Error(err.message ?? err.Message ?? err.name ?? 'unknown error: ' + util.inspect(err));
      if (err['code'] !== undefined) {
        result['code'] = err['code'];
      }
    }
  }

  [
    { in: 'StackTrace', out: 'stack' },
    { in: 'stack', out: 'stack' },
    { in: 'FileName', out: 'path' },
    { in: 'HResult', out: 'code' },
    { in: 'name', out: 'Name' },
    { in: 'Source', out: 'Module' },
    { in: 'data', out: 'data' },
  ].forEach(transform => {
    if (err[transform.in] !== undefined) {
      result[transform.out] = err[transform.in];
    }
  });

  if ((result['name'] === undefined) || (err['name'] !== undefined)) {
    result['name'] = err['name'];
  }

  result['attachLogOnReport'] = true;

  return result;
}

function spawnAsync(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      spawn(command, args)
        .on('close', () => resolve())
        .on('error', err => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

function spawnRetry(api: IExtensionApi, command: string, args: string[], tries = 3): Promise<void> {
  return spawnAsync(command, args)
    .catch(err => {
      if (err.code === 'EBUSY') {
        if (tries > 0) {
          return delayed(100)
            .then(() => spawnRetry(api, command, args, tries - 1))
        } else {
          return api.showDialog('error', 'File locked', {
            text: 'The file "{{fileName}}" is locked, probably because it\'s being accessed by another process.',
            parameters: {
              fileName: command,
            },
          }, [
            { label: 'Cancel' },
            { label: 'Retry' },
          ])
            .then(result => {
              if (result.action === 'Cancel') {
                return Promise.reject(new UserCanceled());
              } else {
                return spawnRetry(api, command, args);
              }
            });
        }
      }
    });
}

let onFoundDotNet: () => void;
const dotNetAssert = new Promise<void>((resolve) => {
  onFoundDotNet = () => {
    resolve();
    onFoundDotNet = () => {
      // nop
    };
  };
});

async function installDotNet(api: IExtensionApi, repair: boolean): Promise<void> {
  const dlId: string = await toPromise(cb =>
    api.events.emit('start-download', [NET_CORE_DOWNLOAD], { game: SITE_ID }, undefined, cb, 'replace', { allowInstall: false }));

  if (dlId === undefined) {
    log('warn', 'failed to download .NET');
    // trigger a new check
    return Promise.resolve();
  }

  const state = api.getState();
  const download = state.persistent.downloads.files[dlId];

  if (download?.state !== 'finished') {
    log('warn', '.NET download not finished');
    // trigger a new check
    return Promise.resolve();
  }

  const downloadsPath = downloadPathForGame(state, SITE_ID);
  const fullPath = path.join(downloadsPath, download.localPath);

  api.showDialog('info', 'Microsoft .NET Desktop Runtime 9 is being installed', {
    bbcode: 'Please follow the instructions in the .NET installer. If you can\'t see the installer window, please check if it\'s hidden behind another window.'
    + '[br][/br][br][/br]'
        + 'Please note: In rare cases you will need to restart windows before .NET works properly.',
  }, [
    { label: 'Ok' },
  ]);

  const args = ['/passive', '/norestart'];
  if (repair) {
    args.push('/repair');
  }

  log('info', 'spawning dotnet installer', { fullPath, args });
  return spawnRetry(api, fullPath, args);
}

function checkNetInstall(api: IExtensionApi): Bluebird<ITestResult> {
  return Bluebird.resolve((async () => {
    if (process.platform !== 'win32') {
      // currently only supported/tested on windows
      onFoundDotNet();
      return undefined;
    }

    const probeExe = path.join(getVortexPath('assets_unpacked'), 'dotnetprobe.exe');
    let stderr: string = '';
    const exitCode = await new Promise<number>((resolve) => {
      const proc = execFile(probeExe).on('close', code => resolve(code));
      proc.stderr.on('data', dat => stderr += dat.toString());
    });


    if (exitCode === 0) {
      onFoundDotNet();
      return undefined;
    }

    const result: ITestResult = {
      description: {
        short: 'Microsoft .NET Desktop Runtime 9 required',
        long: 'Vortex requires .NET Desktop Runtime 9 to be installed to run FOMOD mod installers.'
          + '[br][/br][br][/br]'
          + 'If you already have .NET Desktop Runtime 9 installed then there may be a problem with your installation and a reinstall might be needed.'
          + '[br][/br][br][/br]'
          + 'Click "Fix" below to install the required version.'
          + '[br][/br][br][/br]'
          + '[spoiler label="Show detailed error"]{{stderr}}[/spoiler]',
        replace: { stderr: stderr.replace('\n', '[br][/br]') },
      },
      automaticFix: () => Bluebird.resolve(installDotNet(api, false)),
      severity: 'fatal',
    };

    return result;
  })());
}

interface IAwaitingPromise {
  resolve: (data: any) => void;
  reject: (err: Error) => void;
}

function jsonReplace(key: string, value: any) {
  return (typeof(value) === 'object' && value?.type === 'Buffer')
    ? { type: 'Buffer', data: Buffer.from(value.data).toString('base64') }
    : value;
}

function makeJsonRevive(invoke: (data: any) => Promise<void>, getId: () => string) {
  return (key: string, value: any) => {
    if (truthy(value) && (typeof (value) === 'object')) {
      if (value.type === 'Buffer') {
        return Buffer.from(value.data, 'base64');
      }
      Object.keys(value).forEach(subKey => {
        if (truthy(value[subKey])
          && (typeof (value[subKey]) === 'object')
          && (value[subKey].__callback !== undefined)) {
          const callbackId = value[subKey].__callback;
          value[subKey] = (...args: any[]) => {
            invoke({ requestId: getId(), callbackId, args })
              .catch(err => {
                log('info', 'process data', err.message);
              });
          };
        }
      });
    }
    return value;
  };
}

interface ICreateSocketOptions {
  // if true, use a fixed id/port for the connection
  debug: boolean;
  pipeId?: string;
  useAppContainer: boolean;
}

/**
 * create a socket that will be used to communicate with the installer process
 * @param options options that control how the socket is created
 */
function createSocket(options: ICreateSocketOptions)
    : Promise<{ ipcId: string, server: net.Server }> {
  return new Promise((resolve, reject) => {
    try {
      const server = new net.Server();
      server.on('error', err => {
        reject(err);
      });
      if ((options.pipeId !== undefined) && !options.debug) {
        // on windows, using a socket is a pita because firewalls and AVs...
        const pipePath = `\\\\?\\pipe\\${options.pipeId}`;
        log('info', 'listen', { pipePath });
        server.listen(pipePath, () => {
          try {
            if (options.useAppContainer) {
              winapi?.GrantAppContainer?.(`${CONTAINER_NAME}_${options.pipeId}`, pipePath, 'named_pipe', ['all_access']);
            }
          } catch (err) {
            log('error', 'Failed to allow access to pipe', { pipePath, message: err.message });
          }
          resolve({ ipcId: options.pipeId, server });
        });
      } else {
        const port = options.debug ? 12345 : 0;
        server.listen(port, 'localhost', () => {
          const ipcId = (server.address() as net.AddressInfo).port.toString();
          resolve({ ipcId, server });
        });
      }
    } catch (err) {
      reject(err);
    }
  });
}

class ConnectionIPC {
  public static async bind(securityLevel: SecurityLevel,
                           retry: boolean = false)
                           : Promise<ConnectionIPC> {
    // Use concurrency limiter with isolated IPC connections per installation
    return fomodProcessLimiter.do(async () => {
      return ConnectionIPC.bindDirect(securityLevel, retry);
    });
  }

  public static async bindDirect(securityLevel: SecurityLevel,
                                 retry: boolean = false)
                                 : Promise<ConnectionIPC> {
    // checkListenerStatus('before new FOMOD connection');

    // Generate unique connection ID for this installation
    const connectionId = shortid();

    // Increase max listeners to handle concurrent FOMOD installations
    // Each installation adds exit listeners, and with parallel installations
    // we can exceed the default limit of 10
    const currentMaxListeners = process.getMaxListeners();
    if (currentMaxListeners < 50) {
      process.setMaxListeners(50);
      log('debug', 'Increased process max listeners for FOMOD installations', {
        previous: currentMaxListeners,
        new: 50,
        connectionId
      });
    }

    let onResolve: () => void;
    let onReject: (err: Error) => void;
    const connectedPromise = new Promise<void>((resolve, reject) => {
      onResolve = resolve;
      onReject = reject;
    });
    let wasConnected = false;
    let servSocket: net.Socket;
    let cliSocket: net.Socket;

    // on windows, retry using a network socket, maybe that will work
    const pipe = (process.platform === 'win32') && !retry;
    const debug = false;

    const pipeId = pipe ? (debug ? 'debug' : shortid()) : undefined;
    
    log('debug', 'Starting FOMOD installer with isolated IPC connections', {
      pipe,
      securityLevel: SecurityLevel[securityLevel],
      retry,
      pipeId,
      connectionId
    });

    const useAppContainer = securityLevel === SecurityLevel.Sandbox;

    let listenOut: { ipcId: string, server: net.Server };
    let listenIn: { ipcId: string, server: net.Server };

    // Each FOMOD installation gets its own dedicated sockets
    listenOut = await createSocket({ debug, pipeId, useAppContainer });

    if (pipe) {
      listenIn = await createSocket({ debug, pipeId: pipeId + '_reply', useAppContainer });
      listenIn.server.on('connection', sockIn => {
        log('debug', '[installer] peer connected (inbound channel)');
        sockIn.setEncoding('utf8');
        cliSocket = sockIn;
        const onInitMsg = (msg: Buffer) => {
          log('info', 'client handshake received', { msg: msg.toString() });
          wasConnected = true;
          cliSocket.off('data', onInitMsg);
          setTimeout(() => {
            onResolve?.();
          }, 100);
        };
        cliSocket.on('data', onInitMsg);
        // onResolve?.();
      });
    }

    const { ipcId } = listenOut;

    log('debug', '[installer] waiting for peer process to connect', { pipe, ipcId });

    listenOut.server.on('connection', sockOut => {
      log('debug', '[installer] peer connected (outbound channel)');
      sockOut.setEncoding('utf8');
      if (!wasConnected) {
        servSocket = sockOut;
        if (!pipe) {
          // For non-pipe connections, use bidirectional socket
          cliSocket = servSocket;
          log('info', 'bidir channel connected');
          // onResolve?.();
        } else {
          log('info', 'outbound channel connected, waiting for inbound channel');
        }
      }
    });

    let res: ConnectionIPC;

    // yuck. This is necessary to avoid race conditions between this process and the
    // fomod installer, though there is probably a simpler way...
    let connectOutcome: null | Error;
    let setConnectOutcome = (error: Error, send: boolean) => {
      if (connectOutcome === undefined) {
        connectOutcome = error;
      }
    };

    const awaitConnected = async () => {
      if (connectOutcome !== undefined) {
        return connectOutcome === null ? Promise.resolve() : Promise.reject(connectOutcome);
      } else {
        setConnectOutcome = (error: Error, send: boolean) => {
          if (connectOutcome === undefined) {
            connectOutcome = error;
          } else if (error['code'] !== undefined) {
            connectOutcome['code'] = error['code'];
          }

          if (send) {
            if (connectOutcome === null) {
              onResolve?.();
            } else {
              onReject?.(connectOutcome);
            }
            onResolve = onReject = undefined;
          }
        };
        return connectedPromise;
      }
    };

    let pid: number;
    let exitCode: number;
    let onExitCBs: (code: number) => void;

    if (!debug) {
      // for debugging purposes, the user has to run the installer manually
      // invoke the c# installer, passing the id/port
      try {
        const onExit = (code: number) => {
          exitCode = code;

          // Check if this is an intentional quit (connection exists and was marked as quitting)
          const isIntentionalQuit = res?.['mIntentionalQuit'] === true && code === 1;
          const effectiveCode = isIntentionalQuit ? 0 : code;

          log('debug', 'FOMOD installer process exited', {
            code,
            effectiveCode,
            connectionId,
            hasConnection: res !== undefined,
            wasConnected,
            intentionalQuit: res?.['mIntentionalQuit']
          });

          if (effectiveCode !== 0) {
            log('warn', 'FOMOD installer process failed', {
              code: effectiveCode,
              originalCode: code,
              connectionId,
              hasConnection: res !== undefined
            });

            // If we have a non-zero exit code and no connection was established,
            // this indicates a critical failure in the installer executable
            if (!wasConnected && res === undefined) {
              const err = new Error(`FOMOD installer process exited with code ${code}. This usually indicates the installer executable (ModInstallerIPC.exe) could not start properly.`);
              err['code'] = code;
              err['attachLogOnReport'] = true;
              setConnectOutcome(err, true);
            }
          }
          onExitCBs?.(effectiveCode);
        };

        let msg: string = '';
        // stdout can be emitted in arbitrary chunks, using a debouncer to ensure
        // (more or less) we get full messages in a single call
        const stdoutDebouncer = new Debouncer(() => {
          const lines = msg.split('\n').filter(line => line.trim().length !== 0);
          msg = '';

          let isErr: number = -1;

          lines.forEach((line: string, idx: number) => {
            // if the client failed to connect to our pipe, try a second time connecting
            // via socket
            if (retry && line.includes('The operation has timed out')) {
              (async () => {
                try {
                  res = await ConnectionIPC.bind(securityLevel, true);
                  setConnectOutcome(null, true);
                } catch (err) {
                  setConnectOutcome(err, true);
                }
              })();
            }

            if (line.includes('  at ')) {
              // stack line
            } else if (line.startsWith('Failed')
                || line.startsWith('Unhandled exception')
                || line.includes('Exception')
                || line.includes('fatal error')) {
              isErr = idx;
            }
          });

          log('info', 'from installer:', lines.join(';'));

          // Check for specific error patterns that indicate executable issues
          const hasExecutableError = lines.some(line =>
            line.includes('Failed to resolve full path of the current executable') ||
            line.includes('could not execute the application') ||
            line.includes('application failed to initialize') ||
            line.includes('The application was unable to start correctly')
          );
          if (hasExecutableError) {
            log('error', 'FOMOD installer executable error detected', {
              lines,
              connectionId,
              exitCode,
              securityLevel: SecurityLevel[securityLevel] || 'unknown',
              processEnv: {
                DOTNET_SYSTEM_GLOBALIZATION_INVARIANT: process.env['DOTNET_SYSTEM_GLOBALIZATION_INVARIANT'],
                TEMP: process.env['TEMP'],
              },
              nodeVersion: process.version,
              platform: process.platform,
              arch: process.arch
            });

            // Create specific error for executable resolution failures
            const err = new Error('FOMOD installer executable failed to start properly. This typically indicates a .NET runtime issue, Windows App Container restrictions, or corrupted installation files.');
            err['code'] = exitCode || 'EXECUTABLE_RESOLUTION_FAILED';
            err['attachLogOnReport'] = true;
            err['executablePath'] = 'ModInstallerIPC.exe';
            err['securityLevel'] = SecurityLevel[securityLevel];
            setConnectOutcome(err, false);
            wasConnected = true;
            return Promise.resolve();
          }

          if (isErr !== -1) {
            const errStack = lines.slice(isErr + 1).join('\n');
            const err = new Error(lines[isErr]);
            err.stack = errStack;
            if (exitCode !== undefined) {
              err['code'] = exitCode;
            }
            err['attachLogOnReport'] = true;
            setConnectOutcome(err, false);
            wasConnected = true;
          }
          return Promise.resolve();
        }, 1000);

        const onStdout = (dat: string) => {
          msg += dat;
          stdoutDebouncer.schedule();
        };

        onExitCBs = (code: number) => {
          exitCode = code;

          stdoutDebouncer.runNow(() => {
            // if there is an error message logged, the stdout debouncer will already have
            // assigned a connection outcome so this call wouldn't have an effect.
            // This is merely a fallback in case the log output isn't recognized as an
            // error.
            const err = new Error('Fomod installer startup failed, please review your log file');
            err['code'] = code;
            err['attachLogOnReport'] = true;
            setConnectOutcome(err, true);
          });
        };

        log('info', 'waiting until we know .NET is installed');
        await dotNetAssert;

        log('info', 'start fomod installer process', { securityLevel })

        // avoid issues for users missing icu components.
        // Bit of a hack, would be better to pass the environment to createIPC and
        // create the process with that environment but that would require some
        // considerable and errorprone changes to the underlying api
        const oldGlobInvariant = process.env['DOTNET_SYSTEM_GLOBALIZATION_INVARIANT'];
        process.env['DOTNET_SYSTEM_GLOBALIZATION_INVARIANT'] = '1';

        try {
          log('debug', 'Creating FOMOD IPC connection', {
            pipe,
            ipcId,
            securityLevel: SecurityLevel[securityLevel],
            connectionId,
            containerName: securityLevel === SecurityLevel.Sandbox ? `${CONTAINER_NAME}_${pipeId}` : undefined,
            executableEnv: {
              DOTNET_SYSTEM_GLOBALIZATION_INVARIANT: process.env['DOTNET_SYSTEM_GLOBALIZATION_INVARIANT'],
              TEMP: process.env['TEMP']
            }
          });

          // Track the number of exit listeners before createIPC
          const listenerCountBefore = process.listenerCount('exit');

          pid = await createIPC(
            pipe, ipcId, onExit, onStdout,
            securityLevel === SecurityLevel.Sandbox ? `${CONTAINER_NAME}_${pipeId}` : undefined,
            false);
            // securityLevel === SecurityLevel.LowIntegrity);
          log('debug', 'FOMOD IPC connection created successfully', { pid, connectionId });

          const listenerCountAfter = process.listenerCount('exit');
          if (listenerCountAfter > listenerCountBefore) {
            log('debug', 'createIPC added exit listeners', {
              before: listenerCountBefore,
              after: listenerCountAfter,
              added: listenerCountAfter - listenerCountBefore,
              connectionId
            });
            const allListeners = (process as any).listeners('exit');
            if (allListeners.length > 0) {
              const newListener = allListeners[allListeners.length - 1];
              exitListenersByConnection.set(connectionId, newListener);
            }
          }

          // Register the process with our management system
          registerProcess(connectionId, pid, () => {
            return killProcess(pid);
          });

        } catch (ipcErr) {
          log('error', 'Failed to create FOMOD IPC connection', {
            error: ipcErr.message,
            securityLevel: SecurityLevel[securityLevel],
            connectionId,
            pipe,
            ipcId,
            stack: ipcErr.stack,
            containerName: securityLevel === SecurityLevel.Sandbox ? `${CONTAINER_NAME}_${pipeId}` : undefined
          });

          killProcessForConnection(connectionId);

          // Enhanced error reporting for common issues
          if (ipcErr.message.includes('ENOENT') || ipcErr.message.includes('file not found')) {
            const enhancedErr = new Error('FOMOD installer executable (ModInstallerIPC.exe) could not be found. This may indicate a corrupted Vortex installation or missing .NET runtime components.');
            enhancedErr['code'] = 'ENOENT';
            enhancedErr['originalError'] = ipcErr;
            throw enhancedErr;
          } else if (ipcErr.message.includes('access denied') || ipcErr.message.includes('EACCES')) {
            const enhancedErr = new Error('Access denied when trying to start FOMOD installer. This may be caused by antivirus software or insufficient permissions.');
            enhancedErr['code'] = 'EACCES';
            enhancedErr['originalError'] = ipcErr;
            throw enhancedErr;
          }

          throw ipcErr;
        }

        if (oldGlobInvariant === undefined) {
          delete process.env['DOTNET_SYSTEM_GLOBALIZATION_INVARIANT'];
        } else {
          process.env['DOTNET_SYSTEM_GLOBALIZATION_INVARIANT'] = oldGlobInvariant;
        }
      } catch (err) {
        setConnectOutcome(err, true);
      }
    }

    // wait until the child process has actually connected, any error in this phase
    // probably means it's not going to happen...
    await awaitConnected();

    if (res === undefined) {
      // Ensure proper socket assignment based on connection type
      if (pipe) {
        // For pipe connections, we have separate in/out sockets
        res = new ConnectionIPC({ in: cliSocket, out: servSocket }, pid, connectionId);
      } else {
        // For network connections, we use the same socket bidirectionally
        res = new ConnectionIPC({ in: servSocket, out: servSocket }, pid, connectionId);
      }
      onExitCBs = code => {
        // Pass the original code to onExit - it will handle the effective code internally
        res.onExit(code);
        // Clean up isolated IPC connections when process exits
        try {
          listenOut.server.close();
          if (pipe && listenIn) {
            listenIn.server.close();
          }
          log('debug', 'Cleaned up isolated FOMOD IPC connections', { ipcId });
        } catch (cleanupErr) {
          log('warn', 'Error cleaning up FOMOD IPC connections', { error: cleanupErr.message, ipcId });
        }
      };
    }
    return res;
  }

  private mSocket: { in: net.Socket, out: net.Socket };
  private mAwaitedReplies: { [id: string]: IAwaitingPromise } = {};
  private mDelegates: { [id: string]: Core } = {};
  private mOnInterrupted: (err: Error) => void;
  private mReceivedBuffer: string;
  private mActionLog: string[];
  private mOnDrained: Array<() => void> = [];
  private mPid: number;
  private mConnectionId: string;
  private mIntentionalQuit: boolean = false;

  constructor(socket: { in: net.Socket, out: net.Socket }, pid: number, connectionId?: string) {
    this.mSocket = socket;
    this.mActionLog = [];
    this.mPid = pid;
    this.mConnectionId = connectionId || shortid();

    socket.out.on('drain', (hadError) => {
      this.mOnDrained.forEach(cb => cb());
      this.mOnDrained = [];
    });

    // Ensure we catch errors on the outbound socket so EPIPE and similar don't
    //  become uncaught exceptions in the renderer process. On error we log and
    //  interrupt the connection to trigger proper cleanup.
    socket.out.on('error', (err: Error) => {
      log('warn', 'ipc outbound socket error', {
        error: err?.message ?? err,
        connectionId: this.mConnectionId,
      });
      try {
        this.interrupt(err);
      } catch (e) {
        // swallow any error during interrupt to avoid bubbling
      }
    });

    socket.in.on('close', async () => {
      socket.out.destroy();
      log('info', 'remote was disconnected', { connectionId: this.mConnectionId });
      try {
        // Only treat as error if not an intentional quit
        if (!this.mIntentionalQuit) {
          killProcessForConnection(this.mConnectionId);
          this.interrupt(new Error(`Installer process disconnected unexpectedly`));
        } else {
          // Clean shutdown - just clean up the process registration
          killProcessForConnection(this.mConnectionId);
        }
      } catch (err) {
        log('warn', 'Error during socket close cleanup', {
          connectionId: this.mConnectionId,
          error: err.message,
          intentionalQuit: this.mIntentionalQuit
        });
      }
    });
  }

  public handleMessages() {
    this.mSocket.in.on('data', (data: string) => {
      this.logAction(`receiving ${data.length} bytes`);
      if (data.length > 0) {
        this.mReceivedBuffer = (this.mReceivedBuffer === undefined)
          ? data
          : this.mReceivedBuffer + data;

        // Process complete messages (ending with delimiter)
        while (this.mReceivedBuffer && this.mReceivedBuffer.includes('\uffff')) {
          const delimiterIndex = this.mReceivedBuffer.indexOf('\uffff');
          const completeMessage = this.mReceivedBuffer.substring(0, delimiterIndex + 1);
          this.mReceivedBuffer = this.mReceivedBuffer.substring(delimiterIndex + 1);

          this.logAction(`processing complete message of ${completeMessage.length} bytes`);
          try {
            this.processData(completeMessage);
          } catch (err) {
            log('error', 'failed to parse data from remote process', {
              error: err.message,
              connectionId: this.mConnectionId
            });
          }
        }
      }
    })
      .on('error', (err) => {
        log('error', 'ipc socket error', {
          error: err.message,
          connectionId: this.mConnectionId
        });
      });
  }

  public quit(): boolean {
    log('debug', 'Quitting connection', { connectionId: this.mConnectionId, pid: this.mPid });
    this.mIntentionalQuit = true;
    return killProcessForConnection(this.mConnectionId);
  }

  public hasActiveDelegates(): boolean {
    return Object.keys(this.mDelegates).length > 0 || Object.keys(this.mAwaitedReplies).length > 0;
  }

  public getConnectionId(): string {
    return this.mConnectionId;
  }

  public getActiveDelegateCount(): number {
    return Object.keys(this.mDelegates).length;
  }

  public getAwaitedRepliesCount(): number {
    return Object.keys(this.mAwaitedReplies).length;
  }

  public async sendMessage(command: string, data: any, delegate?: Core): Promise<any> {
    // reset action log because we're starting a new exchange
    this.mActionLog = [];
    return Promise.race([
      this.interruptible(),
      this.sendMessageInner(command, data, delegate),
    ]);
  }

  public async onExit(code: number) {
    // If we intentionally quit the process, treat exit code 1 as success
    const isIntentionalQuit = this.mIntentionalQuit && code === 1;
    const effectiveCode = isIntentionalQuit ? 0 : code;

    log(effectiveCode === 0 ? 'info' : 'error', 'remote process exited', {
      code,
      effectiveCode,
      intentionalQuit: this.mIntentionalQuit,
      connectionId: this.mConnectionId
    });

    // Unregister the process from our management system
    unregisterProcess(this.mConnectionId);

    const currentListenerCount = process.listenerCount('exit');
    const trackedListenerCount = exitListenersByConnection.size;

    if (currentListenerCount > 20) {
      log('warn', 'High number of process exit listeners detected', {
        count: currentListenerCount,
        trackedListeners: trackedListenerCount,
        activeProcesses: activeProcessesByConnection.size,
        connectionId: this.mConnectionId
      });
    }
    try {
      // Only call end if the socket is writable and not destroyed
      if (this.mSocket?.out && !this.mSocket.out.destroyed && this.mSocket.out.writable) {
        await toPromise(cb => {
          try {
            this.mSocket.out.end(cb);
          } catch (e) {
            // Some streams may already be destroyed; ignore that specific error
            if (e && e.message && e.message.includes('Cannot call end after a stream was destroyed')) {
              return cb();
            }
            return cb(e);
          }
        });
      }
    } catch (err) {
      log('warn', 'failed to close connection to fomod installer process', {
        error: err?.message ?? err,
        connectionId: this.mConnectionId
      });
    }
    // Use the effective code (0 for intentional quits) when throwing the exception
    if (effectiveCode !== 0) {
      this.interrupt(new InstallerFailedException(effectiveCode));
    }
  }

  private logAction(message: string) {
    this.mActionLog.push(`[${this.mConnectionId}] ${message}`);
  }

  private async interruptible() {
    return new Promise((resolve, reject) => {
      this.mOnInterrupted = reject;
    });
  }

  private async sendMessageInner(command: string, data: any, delegate?: Core): Promise<any> {
    const id = shortid();

    const res = new Promise((resolve, reject) => {
      this.mAwaitedReplies[id] = { resolve, reject };
      if (delegate !== undefined) {
        this.mDelegates[id] = delegate;
      }
    });

    this.logAction(`sending cmd ${command}: ${JSON.stringify(data)}`);

    const outData = JSON.stringify({
      id,
      payload: {
        ...data,
        command,
      },
    }, jsonReplace);

    try {
      if (!this.mSocket?.out || this.mSocket.out.destroyed || !this.mSocket.out.writable) {
        throw new Error('socket not writable');
      }

      const written = this.mSocket.out.write(outData + '\uFFFF');
      if (!written) {
        await new Promise<void>(resolve => {
          this.mOnDrained.push(resolve);
        });
      }
    } catch (e) {
      // Clean up the awaiting reply and any delegate we registered for this id
      try {
        if (this.mAwaitedReplies[id] !== undefined) {
          try {
            this.mAwaitedReplies[id].reject(e);
          } catch (err) {
            // no-op
          }
          delete this.mAwaitedReplies[id];
        }
        if (this.mDelegates[id] !== undefined) {
          delete this.mDelegates[id];
        }
      } catch (err) {
        // no-op
      }

      // Let the callers decide how to proceed without this becoming an unrecoverable exception.
      log('debug', 'ipc write failed (ignored)', { error: e?.message, connectionId: this.mConnectionId });
      return res;
    }

    return res;
  }

  private copyErr(input: Error): any {
    if (input === null) {
      return null;
    }
    return {
      message: input.message,
      name: input.name,
      code: input['code'],
    };
  }

  private processData(data: string) {
    // Remove the delimiter before processing
    const cleanData = data.replace(/\uffff$/, '');

    // there may be multiple messages sent at once
    const messages = cleanData.split('\uffff');
    messages.forEach(msg => {
      if (msg.length > 0) {
        try {
          this.logAction(`processing individual message: ${msg.substring(0, 100)}...`);
          this.processDataImpl(msg);
        } catch (err) {
          log('error', 'failed to parse individual message', { input: msg.substring(0, 100), error: err.message });
        }
      }
    });
  }

  private processDataImpl(msg: string) {
    const data: any = JSON.parse(msg, makeJsonRevive((payload) =>
      this.sendMessageInner('Invoke', payload), () => data.id));

    if (data.id === 'parseerror') {
      const err = new Error(data.error.message);
      err.stack = data.error.stack;
      if (truthy(data.error.name)) {
        err.name = data.error.name;
      }
      Object.keys(this.mAwaitedReplies).forEach(replyId => {
        this.mAwaitedReplies[replyId].reject(err);
        delete this.mAwaitedReplies[replyId];
        // Also clean up any associated delegates on error
        if (this.mDelegates[replyId] !== undefined) {
          delete this.mDelegates[replyId];
        }
      });
    } else if ((data.callback !== null)
        && (this.mDelegates[data.callback.id] !== undefined)) {
      const func = this.mDelegates[data.callback.id][data.callback.type][data.data.name];
      func(...data.data.args, (err, response) => {
        this.sendMessageInner('Reply', { request: data, data: response, error: this.copyErr(err) })
          .catch(e => {
            log('info', 'process data', e.message);
          });
      });
    } else if (this.mAwaitedReplies[data.id] !== undefined) {
      if (data.error !== null) {
        const err = new Error(data.error.message);
        err.stack = data.error.stack;
        if (truthy(data.error.name)) {
          err.name = data.error.name;
        }
        if (truthy(data.error.data)) {
          err['data'] = data.error.data;
        }
        this.mAwaitedReplies[data.id].reject(err);
      } else {
        this.mAwaitedReplies[data.id].resolve(data.data);
      }
      delete this.mAwaitedReplies[data.id];
      // Also clean up any associated delegate to prevent connection leaks
      if (this.mDelegates[data.id] !== undefined) {
        delete this.mDelegates[data.id];
      }
    }
  }

  private interrupt(err: Error) {
    if (this.mSocket?.out !== this.mSocket?.in) {
      this.mSocket?.out?.end();
    }
    this.mSocket?.in?.end();

    if (this.mOnInterrupted !== undefined) {
      this.mOnInterrupted(err);
      this.mOnInterrupted = undefined;
    }
  }
}

// Create isolated connections for each installation to prevent message mixing
async function createIsolatedConnection(securityLevel: SecurityLevel): Promise<ConnectionIPC> {
  return fomodProcessLimiter.do(async () => {
    const conn = await ConnectionIPC.bindDirect(securityLevel);
    conn.handleMessages();
    return conn;
  });
}

async function testSupportedScripted(securityLevel: SecurityLevel,
                                     files: string[],
                                     gameId: string,
                                     _archivePath: string,
                                     details?: ITestSupportedDetails)
                                     : Promise<ISupportedResult> {
  if (!['oblivion', 'fallout3', 'falloutnv'].includes(gameId)) {
    return { 
      supported: false,
      requiredFiles: []
    };
  }

  if (details !== undefined && details.hasCSScripts === false) {
    return { 
      supported: false,
      requiredFiles: []
    };
  }

  let connection: ConnectionIPC;
  try {
    connection = await createIsolatedConnection(securityLevel);

    log('debug', '[installer] test supported');
    const res: ISupportedResult = await connection.sendMessage(
      'TestSupported', { files, allowedTypes: ['CSharpScript'] });
    log('debug', '[installer] test supported result', JSON.stringify(res));
    return res;
  } catch (err) {
    if (err.message.includes('socket') && securityLevel !== 0) {
      if (connection) {
        connection.quit();
      }
      return testSupportedScripted(securityLevel - 1, files, gameId, _archivePath, details);
    }
    throw transformError(err);
  } finally {
    // Clean up the isolated connection
    if (connection) {
      connection.quit();
    }
  }
}

async function install(securityLevel: SecurityLevel,
                       files: string[],
                       stopPatterns: string[],
                       pluginPath: string,
                       scriptPath: string,
                       fomodChoices: any,
                       validate: boolean,
                       progressDelegate: ProgressDelegate,
                       coreDelegates: Core,
                       store?): Promise<IInstallResult> {
  let connection: ConnectionIPC;
  try {
    // Use regular process limiter - let UI delegate queue handle dialog conflicts
    connection = await createIsolatedConnection(securityLevel);

    const result = await connection.sendMessage(
      'Install',
      { files, stopPatterns, pluginPath, scriptPath, fomodChoices, validate },
      coreDelegates);

    return result;
  } finally {
    // Clean up the isolated connection after installation completes
    if (connection) {
      connection.quit();
    }
  }
}

function toBlue<T>(func: (...args: any[]) => Promise<T>): (...args: any[]) => Bluebird<T> {
  return (...args: any[]) => Bluebird.resolve(func(...args));
}

function init(context: IExtensionContext): boolean {
  // Proactively increase max listeners to handle concurrent FOMOD installations
  // The fomod-installer package adds process exit listeners and with our new
  // parallel installation system, we can have many concurrent FOMOD installs
  if (process.getMaxListeners() < 50) {
    process.setMaxListeners(50);
    log('info', 'Increased process max listeners for concurrent FOMOD installations', {
      maxListeners: 50
    });
  }

  // Register .NET 9 Desktop Runtime check
  context.registerTest('dotnet-installed', 'startup', () => Bluebird.resolve(checkNetInstall(context.api)));

  const osSupportsAppContainer = winapi?.SupportsAppContainer?.() ?? false;

  const installWrap = async (useAppContainer, files, scriptPath, gameId,
                             progressDelegate, choicesIn, unattended, archivePath, details: IInstallationDetails) => {
    const canBeUnattended = (choicesIn !== undefined) && (choicesIn.type === 'fomod');
    // If we have fomod choices, automatically bypass the dialog regardless of unattended flag
    const shouldBypassDialog = canBeUnattended && (unattended === true);
    const instanceId = shortid();

    const coreDelegates = new Core(context.api, gameId, instanceId, scriptPath);
    // When override instructions file is present, use only the universal stop patterns and null pluginPath
    // to prevent any automatic path manipulation (both FindPathPrefix and pluginPath stripping)
    const stopPatterns = details.hasInstructionsOverrideFile ? uniPatterns : getStopPatterns(gameId, getGame(gameId));
    const pluginPath = details.hasInstructionsOverrideFile ? null : getPluginPath(gameId);

    if (useAppContainer) {
      log('info', 'granting app container access to',
          { scriptPath, grant: winapi?.GrantAppContainer !== undefined });
      winapi?.GrantAppContainer?.(
        `${CONTAINER_NAME}_${instanceId}`, scriptPath, 'file_object', ['generic_read', 'list_directory']);
    }

    const fomodChoices = (choicesIn !== undefined) && (choicesIn.type === 'fomod')
    ? (choicesIn.options ?? {})
    : undefined;
    
    const hasModuleConfig = files.some(file => path.basename(file).toLowerCase() === 'moduleconfig.xml');
    if (hasModuleConfig && !shouldBypassDialog) {
      // This mod will require user interaction, we need to make sure
      //  the the previous phase is deployed.
      await context.api.ext.awaitNextPhaseDeployment?.();
    }

    const invokeInstall = async (validate: boolean) => {
      const result = await install(
        useAppContainer, files, stopPatterns, pluginPath,
        scriptPath, fomodChoices, validate, progressDelegate, coreDelegates,
        context.api.store);

      const choices = getChoicesFromState(context.api, instanceId);

      result.instructions.push({
        type: 'attribute',
        key: 'installerChoices',
        value: {
          type: 'fomod',
          options: choices ?? fomodChoices,
        },
      });
      return result;
    };

    try {
      return await invokeInstall(true);
    } catch (err) {
      // Don't immediately close dialog on error - other installations might be using it
      // The finally block will handle safe cleanup
      if (err.name === 'System.Xml.XmlException') {
        const res = await context.api.showDialog('error', 'Invalid fomod', {
          text: 'This fomod failed validation. Vortex tends to be stricter validating installers '
              + 'than other tools to ensure mods actually work as expected.\n'
              + 'You can try installing it anyway but we strongly suggest you test if it '
              + 'actually works correctly afterwards - and you should still inform the mod author '
              + 'about this issue.',
          message: err.message,
        }, [
          { label: 'Cancel' },
          { label: 'Ignore' },
        ]);
        if (res.action === 'Ignore') {
          try {
            return await invokeInstall(false);
          } catch (innerErr) {
            const err2 = transformError(innerErr);
            err2['allowReport'] = false;
            return Promise.reject(err2);
          }
        }
      }

      return Promise.reject(transformError(err));
    } finally {
      coreDelegates.detach();
    }
  };
  
  const wrapper = <T>(func: 'test' | 'install', cb: (...args: any[]) => Promise<T>) => {
    const invoke = (securityLevel: SecurityLevel, tries: number, ...args: any[]) =>
      toBlue(cb)(securityLevel, ...args)
        .catch(err => {
          // afaik 0x80008085 would only happen if our installer wasn't used or if running in
          // dev environment
          // I have found no documentation of what 80008096 means
          if ([0x80008085, 0x80008093, 0x80008096].includes(err['code'])) {
            log('info', 'retrying without security sandbox', { error: err.message });
            // invalid runtime configuration? Very likely caused by permission errors due to the process
            // being low integrity, otherwise it would mean Vortex has been modified and then the user
            // already received an error message about that.
            return invoke(SecurityLevel.Regular, INSTALLER_TRIES, ...args);
          } else if (err instanceof InstallerFailedException) {
            log('error', 'installer failed', err.code);
            if ([0, 1].includes(err.code) && (tries > 0)) {
              // Probably due to sandboxing issues, retrying without sandbox
              log('info', 'retrying without security sandbox', { error: err.message });
              return invoke(SecurityLevel.Regular, tries - 1, ...args);
            } else if ([0xC0000005, 0xC0000096, 0xC000041D, 0xCFFFFFFFFF].includes(err.code)) {
              context.api.sendNotification({
                type: 'error',
                message: 'Installer process crashed. This likely means your .NET 9 installation is damaged. '
                       + 'Vortex can try to repair .NET automatically here, this will require a download '
                       + 'of the .NET installer (~55MB).',
                actions: [
                  {
                    title: 'Repair .NET', action: (dismiss) => {
                      installDotNet(context.api, true)
                        .catch(err => {
                          if (err instanceof UserCanceled) {
                            return;
                          }
                          context.api.showErrorNotification('Failed to repair .NET installation, try installing it manually', err, {
                            allowReport: false,
                          });
                        });
                      dismiss();
                    }
                  },
                ],
              });
              return Promise.reject(new ProcessCanceled('Installer failed'));
            } else {
              err['allowReport'] = false;
              return Promise.reject(err);
            }
          } else if (err['name'] === 'System.UnauthorizedAccessException') {
            const archivePath = (func === 'test' ? args[2] : args[6]) ?? '';

            if ((func === 'install') && err.message.includes(args[1])) {
              log('debug', 'Failed to setup sandbox:', { error: err.message, archivePath });
              return toBlue(cb)(SecurityLevel.Regular, ...args);
            }
            const dialogId = shortid();
            return new Promise((resolve, reject) => {
              context.api.showDialog('error', 'Unauthorized Access', {
                bbcode: 'Vortex has prevented the mod installer for "{{name}}" from accessing a protected area of your system '
                      + 'that it shouldn\'t need access to. This indicates that the installer may have an error in it '
                      + 'or that it was attempting to insert malicious code onto your machine.[br][/br][br][/br]'
                      + 'If you feel this mod is safe, please report this issue to the mod author who can work with our team '
                      + 'to investigate the issue.[br][/br][br][/br]'
                      + 'Alternatively, you can ignore this warning and continue the installation at your own risk.',
                parameters: {
                  errorMessage: err.message,
                  name: path.basename(archivePath),
                }
              }, [
                { label: 'Cancel Install', default: true },
                { label: 'Install (not recommended)' },
              ], dialogId)
                .then(result => {
                  if (result.action === 'Install (not recommended)') {
                    resolve(toBlue(cb)(SecurityLevel.Regular, ...args));
                  } else {
                    err['allowReport'] = false;
                    reject(err);
                  }
                });
            });
          } else {
            return Promise.reject(err);
          }
        })
        .catch(err => {
          // 80008083 indicates a version conflict
          if ((err['code'] === 0x80008083)
            || ((err['code'] === 0xE0434352) && err.message.includes('Could not load file or assembly'))
            || ((err['code'] === 0x80008096) && err.message.includes('It was not possible to find any compatible framework version'))
            || ((err instanceof SetupError) && (err.component === 'netruntime'))
          ) {
            const t = context.api.translate;
            context.api.showDialog('error', 'Mod installation failed', {
              bbcode: 'The mod installation failed with an error message that indicates '
                + 'your .NET installation is damaged. '
                + 'More information on .NET, and manual download options, can be found on the {{url}}{{br}}{{br}}'
                + 'Click "Repair" below to automatically download and repair the installation.',
              parameters: { br: '[br][/br]', url: `[url=${NET_CORE_DOWNLOAD_SITE}]${t('.NET website.')}[/url]` },
            }, [
              { label: 'Cancel' },
              { label: 'Repair' },
            ])
              .then(result => {
                if (result.action === 'Repair') {
                  return installDotNet(context.api, true)
                    .catch(err => {
                      if (err instanceof UserCanceled) {
                        return;
                      }
                      const allowReport: boolean = err.code !== 'ENOENT';
                      context.api.showErrorNotification('Failed to repair .NET installation, try installing it manually', err, {
                        allowReport,
                      });
                    })
                }
              });
            err['allowReport'] = false;
          }

          if (['WinApiException', 'HResultException'].includes(err.name)) {
            // this almost certainly means the sandbox failed to set up
            const dialogId = shortid();
            return new Promise((resolve, reject) => {
              context.api.showDialog('error', 'Mod installation failed', {
                bbcode: 'Vortex was unable to set up a security sandbox to protect your system against '
                      + 'mod installers that could potentially contain malicious C# code. '
                      + 'These mod installers are most commonly used in older Bethesda games '
                      + '(Fallout 3, Oblivion, Fallout: New Vegas).[br][/br][br][/br]'
                      + 'The security sandbox is a Windows feature, so this could indicate a '
                      + 'configuration issue with your operating system.[br][/br][br][/br]'
                      + 'You can disable the security sandbox and allow these mod types to install '
                      + 'unprotected at your own risk. '
                      + 'This option can be re-enabled under [url="cb://opensettings"]Settings->Workarounds[/url] '
                      + 'later on.',
                options: {
                  bbcodeContext: {
                    callbacks: {
                      opensettings: () => {
                        context.api.events.emit('show-main-page', 'application_settings');
                        context.api.store.dispatch(setSettingsPage('Workarounds'));
                        context.api.highlightControl('#dotnet-appcontainer', 5000);
                        context.api.closeDialog(dialogId);
                        reject(err);
                      },
                    },
                  },
                },
              }, [
                { label: 'Close' },
                { label: 'Disable Sandbox' },
              ], dialogId)
                .then(result => {
                  if (result.action === 'Disable Sandbox') {
                    context.api.store.dispatch(setInstallerSandbox(false));
                    resolve(toBlue(cb)(SecurityLevel.Regular, ...args));
                  } else {
                    err['allowReport'] = false;
                    reject(err);
                  }
                });
            });
          }
          return Promise.reject(err);
        });

    // Track sandbox permission failures to temporarily disable sandbox mode
    let sandboxFailureCount = 0;
    let lastSandboxFailure = 0;
    const SANDBOX_FAILURE_THRESHOLD = 3;
    const SANDBOX_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

    return (...args: any[]) => {
      const state = context.api.getState();
      const now = Date.now();
      
      // Reset failure count if enough time has passed
      if (now - lastSandboxFailure > SANDBOX_COOLDOWN_MS) {
        sandboxFailureCount = 0;
      }
      
      // Determine security level - temporarily disable sandbox if too many failures
      let securityLevel: SecurityLevel;
      if (osSupportsAppContainer && state.settings.mods.installerSandbox && sandboxFailureCount < SANDBOX_FAILURE_THRESHOLD) {
        securityLevel = SecurityLevel.Sandbox;
      } else {
        securityLevel = SecurityLevel.Regular;
        if (sandboxFailureCount >= SANDBOX_FAILURE_THRESHOLD) {
          log('info', 'Temporarily using regular security due to repeated sandbox failures', { 
            failureCount: sandboxFailureCount,
            cooldownUntil: new Date(lastSandboxFailure + SANDBOX_COOLDOWN_MS)
          });
        }
      }

      const originalInvoke = invoke;
      const wrappedInvoke = (sl: SecurityLevel, tries: number, ...invokeArgs: any[]) => {
        return originalInvoke(sl, tries, ...invokeArgs)
          .catch(err => {
            // Track sandbox permission failures
            if (err instanceof InstallerFailedException && 
                err.code === 1 && 
                sl === SecurityLevel.Sandbox && 
                err.message?.includes('Failed to grant permissions')) {
              sandboxFailureCount++;
              lastSandboxFailure = now;
              log('warn', 'Sandbox permission failure detected', { 
                failureCount: sandboxFailureCount,
                threshold: SANDBOX_FAILURE_THRESHOLD
              });
            }
            throw err;
          });
      };

      // Temporarily replace invoke with our wrapper
      const result = wrappedInvoke(securityLevel, INSTALLER_TRIES, ...args);
      return result;
    };
  }

  context.registerReducer(['settings', 'mods'], settingsReducer);

  context.registerInstaller('fomod', 20, wrapper('test', testSupportedScripted), wrapper('install', installWrap));

  context.registerSettings('Workarounds', Workarounds, () => ({
    osSupportsAppContainer,
  }));

  // This attribute extractor is reading and parsing xml files just for the sake
  //  of finding the fomod's name - it's not worth the hassle.
  // context.registerAttributeExtractor(75, processAttributes);

  return true;
}

export {
  cleanupAllProcesses,
  killProcessForConnection,
  activeProcessesByConnection,
};

export default init;
