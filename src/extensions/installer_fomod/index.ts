import {
  IExtensionApi,
  IExtensionContext,
  IInstallResult,
  ISupportedResult,
  ProgressDelegate,
} from '../../types/IExtensionContext';
import { ITestResult } from '../../types/ITestResult';
import { DataInvalid, SetupError, UserCanceled } from '../../util/CustomErrors';
import Debouncer from '../../util/Debouncer';
import * as fs from '../../util/fs';
import getVortexPath from '../../util/getVortexPath';
import { log } from '../../util/log';
import { getSafe } from '../../util/storeHelper';
import { delayed, toPromise, truthy} from '../../util/util';

import { getGame } from '../gamemode_management/util/getGame';
import { ArchiveBrokenError } from '../mod_management/InstallManager';
import { IMod } from '../mod_management/types/IMod';

import { clearDialog, endDialog, setInstallerDataPath } from './actions/installerUI';
import Core from './delegates/Core';
import { installerUIReducer } from './reducers/installerUI';
import { IGroupList, IInstallerState } from './types/interface';
import {
  getPluginPath,
  getStopPatterns,
} from './util/gameSupport';
import InstallerDialog from './views/InstallerDialog';

import { CONTAINER_NAME, NET_CORE_DOWNLOAD, NET_CORE_DOWNLOAD_SITE } from './constants';

import Bluebird from 'bluebird';
import { createIPC } from 'fomod-installer';
import * as net from 'net';
import * as path from 'path';
import { generate as shortid } from 'shortid';
import * as util from 'util';
import * as winapi from 'winapi-bindings';
import { execFile, spawn } from 'child_process';
import { SITE_ID } from '../gamemode_management/constants';
import { downloadPathForGame } from '../download_management/selectors';
import opn from '../../util/opn';

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
    if (err.FileName !== undefined) {
      if (err.FileName.indexOf('PublicKeyToken') !== -1) {
        const fileName = err.FileName.split(',')[0];
        result = new SetupError(`Your system is missing "${fileName}" which is supposed to be part `
                               + 'of the .NET Framework. Please reinstall it.');
      } else if (err.FileName.indexOf('node_modules\\fomod-installer') !== -1) {
        const fileName = err.FileName.replace(/^file:\/*/, '');
        result = new SetupError(`Your installation is missing "${fileName}" which is part of the `
          + 'Vortex installer. This would only happen if you use an unofficial installer or the '
          + 'Vortex installation was modified.');
      }
    }
  } else if (err.name === 'System.IO.DirectoryNotFoundException') {
    result = new ArchiveBrokenError('The install directory is incomplete, this may mean the '
                                  + 'archive is damaged, extraction failed or the directory '
                                  + 'was externally modified between extraction and now. '
                                  + `"${err.Message}"`);
  } else if (err.name === 'System.IO.FileLoadException') {
    if (err?.FileName) {
      if (err.FileName.indexOf('node_modules\\fomod-installer') !== -1) {
        const fileName = err.FileName.replace(/^file:\/*/, '');
        result = new SetupError(`Windows prevented Vortex from loading "${fileName}". `
          + 'This is usually caused if you don\'t install Vortex but only extracted it because '
          + 'Windows will then block all executable files. '
          + 'Please install Vortex or unblock all .dll and .exe files manually.');
      }
    } else {
      result = new SetupError('Windows prevented Vortex from loading the files necessary '
        + 'to complete installation operations. '
        + 'This is usually caused if you don\'t install Vortex but only extracted it because '
        + 'Windows will then block all executable files. '
        + 'Please install Vortex or unblock all .dll and .exe files manually.');
    }
  } else if (err.name === 'System.IO.PathTooLongException') {
    result = new SetupError('The installer tried to access a file with a path longer than 260 '
                        + 'characters. This usually means that your mod staging path is too long.');
  } else if ((err.name === 'System.IO.IOException')
             && (err.stack.indexOf('System.IO.Path.InternalGetTempFileName'))) {
    const tempDir = getVortexPath('temp');
    result = new SetupError(`Your temp directory "${tempDir}" contains too many files. `
                          + 'You need to clean up that directory. Files in that directory '
                          + 'should be safe to delete (they are temporary after all) but '
                          + 'some will be inaccessible, just ignore those.');
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
    result = new Error(err.name ?? err.Message ?? 'unknown error: ' + util.inspect(err));
    if (err['code'] !== undefined) {
      result['code'] = err['code'];
    }
  }
  [
    { in: 'StackTrace', out: 'stack' },
    { in: 'stack', out: 'stack' },
    { in: 'FileName', out: 'path' },
    { in: 'message', out: 'message' },
    { in: 'HResult', out: 'code' },
    { in: 'name', out: 'Name' },
    { in: 'Source', out: 'Module' },
    { in: 'data', out: 'data' },
  ].forEach(transform => {
    if (err[transform.in] !== undefined) {
      result[transform.out] = err[transform.in];
    }
  });

  return result;
}

function processAttributes(input: any, modPath: string): Bluebird<any> {
  if (modPath === undefined) {
    return Bluebird.resolve({});
  }
  return fs.readFileAsync(path.join(modPath, 'fomod', 'info.xml'))
    .then((data: Buffer) => {
      let offset = 0;
      let encoding: BufferEncoding = 'utf8';
      if (data.readUInt16LE(0) === 0xFEFF) {
        encoding = 'utf16le';
        offset = 2;
      } else if (data.compare(Buffer.from([0xEF, 0xBB, 0xBF]), 0, 3, 0, 3) === 0) {
        offset = 3;
      }
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data.slice(offset).toString(encoding), 'text/xml');
      const name: Element = xmlDoc.querySelector('fomod Name');
      return truthy(name)
        ? {
          customFileName: name.childNodes[0].nodeValue,
        } : {};
    })
    .catch(() => ({}));
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

  api.showDialog('info', '.NET is being installed', {
    text: 'Please follow the instructions in the .NET installer. If you can\'t see the installer window, please check if it\'s hidden '
        + 'behind another window.',
  }, [
    { label: 'Ok' },
  ]);

  const args = ['/passive'];
  if (repair) {
    args.push('/repair');
  }

  log('info', 'spawning dotnet installer', { fullPath, args });
  return spawnRetry(api, fullPath, args);
}

async function checkNetInstall(api: IExtensionApi): Promise<ITestResult> {
  if (process.platform !== 'win32') {
    // currently only supported/tested on windows
    return Promise.resolve(undefined);
  }

  const probeExe = path.join(getVortexPath('assets_unpacked'), 'dotnetprobe.exe');
  let stderr: string = '';
  const exitCode = await new Promise<number>((resolve) => {
    const proc = execFile(probeExe).on('close', code => resolve(code));
    proc.stderr.on('data', dat => stderr += dat.toString());
  });

  return (exitCode !== 0)
    ? Promise.resolve({
      description: {
        short: 'Microsoft .NET installation required',
        long: 'Vortex requires Microsoft .NET to perform important tasks.'
            + '[br][/br]Click "Fix" below to install the required version.'
            + '[br][/br]If you already have Microsoft .NET 6 or later installed, there may be a problem with your installation, '
            + 'please click below for technical details.'
            + '[br][/br][spoiler label="Show details"]{{stderr}}[/spoiler][/quote]',
        replace: { stderr: stderr.replace('\n', '[br][/br]') },
      },
      automaticFix: () => installDotNet(api, false),
      severity: 'fatal',
    })
    : Promise.resolve(undefined);
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
            winapi?.GrantAppContainer?.(CONTAINER_NAME, pipePath, 'named_pipe', ['all_access']);
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
  public static async bind(retry: boolean = false): Promise<ConnectionIPC> {
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

    if ((ConnectionIPC.sListenOut === undefined) || retry) {
      // only set up the listening server once, otherwise we might end
      // up creating orphaned connections if a connection later dies
      ConnectionIPC.sListenOut = await createSocket({ debug, pipeId });
    } else {
      ConnectionIPC.sListenOut.server.removeAllListeners('connection');
    }

    if (pipe) {
      if ((ConnectionIPC.sListenIn === undefined) || retry) {
        ConnectionIPC.sListenIn = await createSocket({ debug, pipeId: pipeId + '_reply' });
      } else {
        ConnectionIPC.sListenIn.server.removeAllListeners('connection');
      }
      ConnectionIPC.sListenIn.server.on('connection', sockIn => {
        log('debug', '[installer] peer connected reply');
        sockIn.setEncoding('utf8');
        cliSocket = sockIn;
        // technically we should verify both connections are established but the cli
        // is supposed to open the reply channel last anyway
        const onInitMsg = (msg: Buffer) => {
          log('info', 'client says', { msg: msg.toString() });
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

    const { ipcId } = ConnectionIPC.sListenOut;

    log('debug', '[installer] waiting for peer process to connect', { pipe, ipcId });

    ConnectionIPC.sListenOut.server.on('connection', sockIn => {
      log('debug', '[installer] peer connected there');
      sockIn.setEncoding('utf8');
      if (!wasConnected) {
        servSocket = sockIn;
        if (!pipe) {
          cliSocket = servSocket;
          log('info', 'bidir channel connected');
          // onResolve?.();
        } else {
          log('info', 'there channel connected');
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
          onExitCBs?.(code);
        };

        let msg: string = '';
        // stdout can be emitted in arbitrary chunks, using a debouncer to ensure
        // (more or less) we get full messages in a single call
        const stdoutDebouncer = new Debouncer(() => {
          const lines = msg.split('\n');
          msg = '';

          let isErr: number = -1;

          lines.forEach((line: string, idx: number) => {
            // if the client failed to connect to our pipe, try a second time connecting
            // via socket
            if (retry && line.includes('The operation has timed out')) {
              (async () => {
                try {
                  res = await ConnectionIPC.bind(true);
                  setConnectOutcome(null, true);
                } catch (err) {
                  setConnectOutcome(err, true);
                }
              })();
            }

            if (line.startsWith('Failed')
                || line.includes('Exception')
                || line.includes('fatal error')) {
              isErr = idx;
            }
          });

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
          } else {
            log('info', 'from installer:', lines.join(';'));
          }
          return Promise.resolve();
        }, 100);

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

        pid = await createIPC(pipe, ipcId, onExit, onStdout, CONTAINER_NAME);
      } catch (err) {
        setConnectOutcome(err, true);
      }
    }

    // wait until the child process has actually connected, any error in this phase
    // probably means it's not going to happen...
    await awaitConnected();

    if (res === undefined) {
      res = new ConnectionIPC({ in: cliSocket, out: servSocket }, pid);
      onExitCBs = code => res.onExit(code);
    }
    return res;
  }

  private static sListenOut: { ipcId: string, server: net.Server };
  private static sListenIn: { ipcId: string, server: net.Server };

  private mSocket: { in: net.Socket, out: net.Socket };
  private mAwaitedReplies: { [id: string]: IAwaitingPromise } = {};
  private mDelegates: { [id: string]: Core } = {};
  private mOnInterrupted: (err: Error) => void;
  private mReceivedBuffer: string;
  private mActionLog: string[];
  private mOnDrained: Array<() => void> = [];
  private mPid: number;

  constructor(socket: { in: net.Socket, out: net.Socket }, pid: number) {
    this.mSocket = socket;
    this.mActionLog = [];
    this.mPid = pid;

    socket.out.on('drain', (hadError) => {
      this.mOnDrained.forEach(cb => cb());
      this.mOnDrained = [];
    });

    socket.in.on('close', async () => {
      socket.out.destroy();
      log('info', 'remote was disconnected');
      try {
        // just making sure, the remote is probably closing anyway
        await new Promise((resolve) => setTimeout(resolve, 1000));
        process.kill(pid);
        this.interrupt(new Error(`Installer process disconnected unexpectedly`));
      } catch (err) {
        // nop
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
        if (this.mReceivedBuffer.endsWith('\uffff')) {
          this.logAction(`processing ${this.mReceivedBuffer.length} bytes`);
          try {
            this.processData(this.mReceivedBuffer);
            this.mReceivedBuffer = undefined;
          } catch (err) {
            log('error', 'failed to parse data from remote process', err.message);
            this.mReceivedBuffer = undefined;
          }
        }
      }
    })
    .on('error', (err) => {
      log('error', 'ipc socket error', err.message);
    });
  }

  public isActive(): boolean {
    // kill accepts numeric signal codes and returns a boolean to signal success
    // For some reason the type declaration is incomplete

    // return (this.mProcess === null) ||  (this.mProcess.kill as any)(0);
    if (this.mPid === undefined) {
      return true;
    }
    try {
      process.kill(this.mPid, 0);
      return true;
    } catch (err) {
      return false;
    }
  }

  public async sendMessage(command: string, data: any, delegate?: Core): Promise<any> {
    // reset action log because we're starting a new exchange
    this.mActionLog = [];
    return Promise.race([
      this.interruptible(),
      this.sendMessageInner(command, data, delegate),
    ]);
  }

  public async onExit(code) {
    log(code === 0 ? 'info' : 'error', 'remote process exited', { code });
    try {
      await toPromise(cb => this.mSocket.out.end(cb));
      this.interrupt(new Error(`Installer process quit unexpectedly (Code ${code})`));
    } catch (err) {
      log('warn', 'failed to close connection to fomod installer process', err.message);
    }
  }

  private logAction(message: string) {
    this.mActionLog.push(message);
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

    const written = this.mSocket.out.write(outData + '\uFFFF');
    if (!written) {
      await new Promise<void>(resolve => {
        this.mOnDrained.push(resolve);
      });
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
    // there may be multiple messages sent at once
    const messages = data.split('\uFFFF');
    messages.forEach(msg => {
      if (msg.length > 0) {
        try {
          this.logAction(`processing message "${this.mReceivedBuffer}"`);
          this.processDataImpl(msg);
        } catch (err) {
          log('error', 'failed to parse', { input: msg, error: err.message });
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
    }
  }

  private interrupt(err: Error) {
    if (this.mSocket?.out !== this.mSocket?.in) {
      this.mSocket?.out?.end();
    }
    this.mSocket?.in?.end();

    log('warn', 'interrupted, recent actions', JSON.stringify(this.mActionLog, undefined, 2));
    if (this.mOnInterrupted !== undefined) {
      this.mOnInterrupted(err);
      this.mOnInterrupted = undefined;
    }
  }
}

const ensureConnected = (() => {
  let conn: ConnectionIPC;
  return async (): Promise<ConnectionIPC> => {
    if ((conn === undefined) || !conn.isActive()) {
      conn = await ConnectionIPC.bind();
      log('debug', '[installer] connection bound');
      conn.handleMessages();
    }
    return Promise.resolve(conn);
  };
})();

async function testSupportedScripted(files: string[]): Promise<ISupportedResult> {
  try {
    const connection = await ensureConnected();

    log('debug', '[installer] test supported');
    const res = await connection.sendMessage(
      'TestSupported', { files, allowedTypes: ['XmlScript', 'CSharpScript'] });
    log('debug', '[installer] test supported result', JSON.stringify(res));
    return res;
  } catch (err) {
    throw transformError(err);
  }
}

async function testSupportedFallback(files: string[]): Promise<ISupportedResult> {
  try {
    const connection = await ensureConnected();

    const res = await connection.sendMessage(
      'TestSupported', { files, allowedTypes: ['Basic'] })
    if (!res.supported) {
      log('warn', 'fomod fallback installer not supported, that shouldn\'t happen');
    }
    return res;
  } catch (err) {
    throw transformError(err);
  }
}

async function install(files: string[],
                       stopPatterns: string[],
                       pluginPath: string,
                       scriptPath: string,
                       fomodChoices: any,
                       validate: boolean,
                       progressDelegate: ProgressDelegate,
                       coreDelegates: Core): Promise<IInstallResult> {
  const connection = await ensureConnected();

  return await connection.sendMessage(
    'Install',
    { files, stopPatterns, pluginPath, scriptPath, fomodChoices, validate },
    coreDelegates);
}

function toBlue<T>(func: (...args: any[]) => Promise<T>): (...args: any[]) => Bluebird<T> {
  return (...args: any[]) => Bluebird.resolve(func(...args));
}

function init(context: IExtensionContext): boolean {
  const installWrap =
      async (files, scriptPath, gameId, progressDelegate, choicesIn, unattended) => {
    const canBeUnattended = (choicesIn !== undefined) && (choicesIn.type === 'fomod');
    const coreDelegates = new Core(context.api, gameId, canBeUnattended && (unattended === true));
    const stopPatterns = getStopPatterns(gameId, getGame(gameId));
    const pluginPath = getPluginPath(gameId);
    // await currentInstallPromise;

    winapi?.GrantAppContainer?.(
      CONTAINER_NAME, scriptPath, 'file_object', ['generic_read', 'list_directory']);
    context.api.store.dispatch(setInstallerDataPath(scriptPath));

    const fomodChoices = (choicesIn !== undefined) && (choicesIn.type === 'fomod')
      ? (choicesIn.options ?? {})
      : undefined;

    const invokeInstall = async (validate: boolean) => {
      const result = await install(files, stopPatterns, pluginPath,
        scriptPath, fomodChoices, validate, progressDelegate, coreDelegates);

      const state = context.api.store.getState();
      const dialogState: IInstallerState = state.session.fomod.installer.dialog.state;

      const choices = (dialogState === undefined)
      ? undefined
      : dialogState.installSteps.map(step => {
        const ofg: IGroupList = step.optionalFileGroups || { group: [], order: 'Explicit' };
        return {
          name: step.name,
          groups: (ofg.group || []).map(group => ({
            name: group.name,
            choices: group.options
              .filter(opt => opt.selected)
              .map(opt => ({ name: opt.name, idx: opt.id })),
          })),
        };
      });

      result.instructions.push({
        type: 'attribute',
        key: 'installerChoices',
        value: {
          type: 'fomod',
          options: choices,
        },
      });
      return result;
    };

    try {
      return await invokeInstall(true);
    } catch (err) {
      context.api.store.dispatch(endDialog());
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
      context.api.store.dispatch(clearDialog());
      coreDelegates.detach();
    }
  };

  const wrapper = <T>(cb: (...args: any[]) => Promise<T>) => {
    return (...args: any[]) =>
      toBlue(cb)(...args)
        .catch(err => {
          if (((err['code'] === 0xE0434352) && err.message.includes('Could not load file or assembly'))
              || (err['code'] === 0x80008083) && err.message.includes('the required library')) {
            context.api.showDialog('error', 'Mod installation failed', {
              text: 'The mod installation failed with an error message that indicates '
                + 'your .NET installation is damaged. '
                + 'We can download & repair the installation for you, otherwise '
                + 'you have to do that manually.\n'
                + '',
              links: [{ label: 'Open page', action: () => opn(NET_CORE_DOWNLOAD_SITE).catch(() => null) }],
            }, [
              { label: 'Cancel' },
              { label: 'Repair' },
            ])
              .then(result => {
                if (result.action === 'Repair') {
                  return installDotNet(context.api, true)
                    .catch(err => {
                      const allowReport: boolean = err.code !== 'ENOENT';
                      context.api.showErrorNotification('Failed to repair .NET installation, try installing it manually', err, {
                        allowReport,
                      });
                    })
                }
              });
            err['allowReport'] = false;
          }
          return Promise.reject(err);
        });
  }

  context.registerReducer(['session', 'fomod', 'installer', 'dialog'], installerUIReducer);

  context.registerInstaller('fomod', 20, wrapper(testSupportedScripted), wrapper(installWrap));
  context.registerInstaller('fomod', 100, wrapper(testSupportedFallback), wrapper(installWrap));

  if (process.platform === 'win32') {
    context.registerTest('net-current', 'startup', () => Bluebird.resolve(checkNetInstall(context.api)));
  }
  context.registerDialog('fomod-installer', InstallerDialog);

  context.registerTableAttribute('mods', {
    id: 'installer',
    name: 'Installer',
    description: 'Choices made in the installer',
    icon: 'inspect',
    placement: 'detail',
    calc: (mod: IMod) => {
      const choices = getSafe(mod.attributes, ['installerChoices'], undefined);
      if ((choices === undefined) || (choices.type !== 'fomod')) {
        return '<None>';
      }
      return (choices.options || []).reduce((prev, step) => {
        prev.push(...step.groups
          .filter(group => group.choices.length > 0)
          .map(group =>
            `${group.name} = ${group.choices.map(choice => choice.name).join(', ')}`));
        return prev;
      }, []);
    },
    edit: {},
    isDefaultVisible: false,
  });

  context.registerAttributeExtractor(75, processAttributes);

  return true;
}

export default init;
