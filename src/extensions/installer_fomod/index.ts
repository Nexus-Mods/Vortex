import {
  IExtensionContext,
  IInstallResult,
  ISupportedResult,
  ProgressDelegate,
} from '../../types/IExtensionContext';
import { ITestResult } from '../../types/ITestResult';
import { DataInvalid, ProcessCanceled, SetupError, UserCanceled } from '../../util/CustomErrors';
import * as fs from '../../util/fs';
import { log } from '../../util/log';
import {delayed, toPromise, truthy} from '../../util/util';

import { getGame } from '../gamemode_management/util/getGame';
import { ArchiveBrokenError } from '../mod_management/InstallManager';

import { endDialog, setInstallerDataPath } from './actions/installerUI';
import Core from './delegates/Core';
import { installerUIReducer } from './reducers/installerUI';
import {
  getPluginPath,
  getStopPatterns,
} from './util/gameSupport';
import { checkAssemblies, getNetVersion } from './util/netVersion';
import InstallerDialog from './views/InstallerDialog';

import Bluebird from 'bluebird';
import { ChildProcess } from 'child_process';
import { app as appIn, remote } from 'electron';
import { createIPC } from 'fomod-installer';
import * as net from 'net';
import * as path from 'path';
import * as semver from 'semver';
import { generate as shortid } from 'shortid';
import * as util from 'util';

const app = appIn !== undefined ? appIn : remote.app;

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
                               + 'of the .Net Framework. Please reinstall it.');
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
    const tempDir = app.getPath('temp');
    result = new SetupError(`Your temp directory "${tempDir}" contains too many files. `
                          + 'You need to clean up that directory. Files in that directory '
                          + 'should be safe to delete (they are temporary after all) but '
                          + 'some will be inaccessible, just ignore those.');
  } else if ((err.stack !== null)
             && ((err.stack.indexOf('XNodeValidator.ValidationCallback') !== -1)
             || (err.stack.indexOf('XmlTextReaderImpl.ParseXmlDeclaration') !== -1)
             || (err.stack.indexOf('XmlTextReaderImpl.ParseAttributes') !== -1)
             || (err.stack.indexOf('XmlTextReaderImpl.ParseDocumentContent') !== -1)
             || (err.stack.indexOf('XmlScriptType.GetXmlScriptVersion') !== -1))
             ) {
    result = new DataInvalid('Invalid installer script: ' + err.message);
  } else if ((err.name === 'System.Xml.XmlException')
             && ((err.stack.indexOf('System.Xml.XmlTextReaderImpl.ParseText') !== -1)
                 || (err.message.indexOf('does not match the end tag') !== -1))) {
    result = new DataInvalid('Invalid installer script: ' + err.message);
  } else if ((err.name === 'System.AggregateException') && (err.InnerException !== undefined)) {
    return transformError(err.InnerException);
  } else if (err.Message === 'task timeout') {
    result = new SetupError('A task in the script didn\'t complete in time. The timeouts are set '
                          + 'very generously so it\'s more likely that this is either caused '
                          + 'by a broken .Net installation or something else on your system '
                          + 'interrupted the process (like a debugger).');
  }

  if (result === undefined) {
    result = new Error(err.name ?? err.Message ?? 'unknown error: ' + util.inspect(err));
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
        let encoding = 'utf8';
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
      .catch(err => ({}));
}

function checkNetInstall() {
  const netVersion = getNetVersion();
  if ((netVersion === undefined) || semver.lt(netVersion, '4.6.0')) {
    const res: ITestResult = {
      description: {
        short: '.Net installation incompatible',
        long: 'It appears that your installation of the .Net framework is outdated or missing.'
            + '[br][/br]You will probably not be able to install mods.'
            + '[br][/br]Please install a current version of .Net (at least version 4.6).',
      },
      severity: 'error',
    };
    return Bluebird.resolve(res);
  } else {
    return checkAssemblies()
      .then(valid => {
        if (valid) {
          return Bluebird.resolve(undefined);
        } else {
          const res: ITestResult = {
            description: {
              short: '.Net installation broken',
              long: 'It appears that your installation of the .Net framework is broken.[br][/br]'
                + 'You will probably not be able to install mods.[br][/br]'
                + 'Please (re-)install .Net (at least version 4.6).',
            },
            severity: 'error',
          };
          return Bluebird.resolve(res);
        }
      });
  }
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
  // if true, use a pipe. windows only
  pipe: boolean;
  // if true, use a fixed id/port for the connection
  debug: boolean;
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
      if (options.pipe && !options.debug) {
        // on windows, using a socket is a pita because firewalls and AVs...
        const ipcId = options.debug ? 'debug' : shortid();
        server.listen(`\\\\?\\pipe\\${ipcId}`, () => {
          resolve({ ipcId, server });
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

function createConnection(ipcPath: string, tries: number = 5): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const errCB = err => {
      if ((err['code'] === 'ENOENT') && (tries > 0)) {
        delayed(1000)
          .then(() => createConnection(ipcPath, tries - 1))
          .then(resolve)
          .catch(reject);
      } else {
        err.message = err.message.replace(ipcPath, '<ipc path>');
        reject(err);
      }
    };

    const sock = net.createConnection(ipcPath, () => {
      sock.off('error', errCB);
      resolve(sock);
    });
    sock.on('error', errCB);
  });
}

class ConnectionIPC {
  public static async bind(retry: boolean = false): Promise<ConnectionIPC> {
    let proc: ChildProcess = null;
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

    if ((ConnectionIPC.sListen === undefined) || retry) {
      // only set up the listening server once, otherwise we might end
      // up creating orphaned connections if a connection later dies
      ConnectionIPC.sListen = await createSocket({
        pipe,
        debug,
      });
    } else {
      ConnectionIPC.sListen.server.removeAllListeners('connection');
    }

    const { server, ipcId } = ConnectionIPC.sListen;

    log('debug', '[installer] waiting for peer process to connect', { pipe, ipcId });

    server.on('connection', sock => {
      log('debug', '[installer] peer connected');
      sock.setEncoding('utf8');
      if (!wasConnected) {
        wasConnected = true;
        servSocket = sock;
        if (pipe && !debug) {
          log('debug', '[installer] connecting to reply pipe');
          createConnection(`\\\\?\\pipe\\${ipcId}_reply`)
          .then(sockIn => {
            log('debug', '[installer] reply pipe connected');
            sockIn.setEncoding('utf-8');
            sockIn.on('error', err => {
              log('error', '[installer] socket error', err.message);
            });
            cliSocket = sockIn;
            onResolve();
          })
          .catch(err => {
            onReject(err);
          });
        } else {
          cliSocket = servSocket;
          onResolve();
        }
      }
    });

    let res: ConnectionIPC;

    if (!debug) {
      // for debugging purposes, the user has to run the installer manually
      // invoke the c# installer, passing the id/port
      try {
        proc = await createIPC(pipe, ipcId, procCB => {
          procCB.stdout.on('data', (dat: Buffer) => {
            log('debug', 'from installer:', dat.toString().trim());
          });
          procCB.stderr.on('data', async (dat: Buffer) => {
            const errorMessage = dat.toString().trim();
            if (!retry && errorMessage.includes('The operation has timed out')) {
              // if the client failed to connect to our pipe, try a second time connecting
              // via socket
              try {
                res = await ConnectionIPC.bind(true);
                onResolve();
              } catch (err) {
                onReject?.(err);
                onReject = undefined;
              }
            } else if (errorMessage.length > 0) {
              log('error', 'from installer:', errorMessage);
              if (!wasConnected) {
                onReject?.(new Error(errorMessage));
                onReject = undefined;
                wasConnected = true;
              }
            }
          });
        });
      } catch (err) {
        onReject?.(new ProcessCanceled(err.message));
        onReject = undefined;
      }
    }

    // wait until the child process has actually connected, any error in this phase
    // probably means it's not going to happen...
    await connectedPromise;

    if (res === undefined) {
      return new ConnectionIPC({ in: cliSocket, out: servSocket }, proc);
    }
    return res;
  }

  private static sListen: { ipcId: string, server: net.Server };

  private mSocket: { in: net.Socket, out: net.Socket };
  private mProcess: ChildProcess;
  private mAwaitedReplies: { [id: string]: IAwaitingPromise } = {};
  private mDelegates: { [id: string]: Core } = {};
  private mOnInterrupted: (err: Error) => void;
  private mReceivedBuffer: string;
  private mActionLog: string[];
  private mOnDrained: Array<() => void> = [];

  constructor(socket: { in: net.Socket, out: net.Socket }, proc: ChildProcess) {
    this.mSocket = socket;
    this.mProcess = proc;
    this.mActionLog = [];

    if (proc !== null) {
      proc.on('exit', async (code, signal) => {
        log(code === 0 ? 'info' : 'error', 'remote process exited', { code, signal });
        try {
          await toPromise(cb => socket.out.end(cb));
          this.interrupt(new Error(`Installer process quit unexpectedly (Code ${code})`));
        } catch (err) {
          log('warn', 'failed to close connection to fomod installer process', err.message);
        }
      });
    }

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
        this.mProcess?.kill();
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
    return (this.mProcess === null) ||  (this.mProcess.kill as any)(0);
  }

  public async sendMessage(command: string, data: any, delegate?: Core): Promise<any> {
    // reset action log because we're starting a new exchange
    this.mActionLog = [];
    return Promise.race([
      this.interruptible(),
      this.sendMessageInner(command, data, delegate),
    ]);
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
        this.sendMessageInner(`Reply`, { request: data, data: response, error: this.copyErr(err) })
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
  const connection = await ensureConnected();

  try {
    log('debug', '[installer] test supported');
    const res = await connection.sendMessage('TestSupported',
      { files, allowedTypes: ['XmlScript', 'CSharpScript'] });
    log('debug', '[installer] test supported result', JSON.stringify(res));
    return res;
  } catch (err) {
    throw transformError(err);
  }
}

async function testSupportedFallback(files: string[]): Promise<ISupportedResult> {
  const connection = await ensureConnected();

  return connection.sendMessage('TestSupported', { files, allowedTypes: ['Basic'] })
    .then((result: ISupportedResult) => {
      if (!result.supported) {
        log('warn', 'fomod fallback installer not supported, that shouldn\'t happen');
      }
      return result;
    })
    .catch(err => Promise.reject(transformError(err)));
}

async function install(files: string[],
                       stopPatterns: string[],
                       pluginPath: string,
                       scriptPath: string,
                       progressDelegate: ProgressDelegate,
                       coreDelegates: Core): Promise<IInstallResult> {
  const connection = await ensureConnected();

  return connection.sendMessage('Install',
                                { files, stopPatterns, pluginPath, scriptPath },
                                coreDelegates);
}

function toBlue<T>(func: (...args: any[]) => Promise<T>): (...args: any[]) => Bluebird<T> {
  return (...args: any[]) => Bluebird.resolve(func(...args));
}

function init(context: IExtensionContext): boolean {
  const installWrap = async (files, scriptPath, gameId, progressDelegate) => {
    const coreDelegates = new Core(context.api, gameId);
    const stopPatterns = getStopPatterns(gameId, getGame(gameId));
    const pluginPath = getPluginPath(gameId);
    // await currentInstallPromise;

    context.api.store.dispatch(setInstallerDataPath(scriptPath));
    try {
      return await install(files, stopPatterns, pluginPath,
        scriptPath, progressDelegate, coreDelegates);
    } catch (err) {
      context.api.store.dispatch(endDialog());
      return Promise.reject(transformError(err));
    } finally {
      coreDelegates.detach();
    }
  };

  context.registerInstaller('fomod', 20, toBlue(testSupportedScripted), toBlue(installWrap));
  context.registerInstaller('fomod', 100, toBlue(testSupportedFallback), toBlue(installWrap));

  if (process.platform === 'win32') {
    context.registerTest('net-current', 'startup', checkNetInstall);
  }
  context.registerDialog('fomod-installer', InstallerDialog);
  context.registerReducer(['session', 'fomod', 'installer', 'dialog'], installerUIReducer);

  context.registerAttributeExtractor(75, processAttributes);

  return true;
}

export default init;
