import { IExtensionApi, IExtensionContext } from '../../types/IExtensionContext';
import { ITestResult } from '../../types/ITestResult';
import { ProcessCanceled, SetupError, UserCanceled } from '../../util/CustomErrors';
import getVortexPath from '../../util/getVortexPath';
import { log } from '../../util/log';
import { delayed, toPromise, truthy } from '../../util/util';

import { getGame } from '../gamemode_management/util/getGame';

import { activeGameId } from '../../util/selectors';

import Core from './delegates/Core';
import { checkAssemblies, getNetVersion } from './util/netVersion';

import Bluebird from 'bluebird';
import { ChildProcess } from 'child_process';
import { createIPC } from 'harmony-patcher';
import * as net from 'net';
import path from 'path';

import * as semver from 'semver';
import { generate as shortid } from 'shortid';
import * as util from 'util';
import { IPatchConfig } from './types/injector';

import { fs } from '../..';
import { IGameStored } from '../gamemode_management/types/IGameStored';

function transformError(err: any): Error {
  let result: Error;
  if (typeof(err) === 'string') {
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
      } else if (err.FileName.indexOf('node_modules\\harmony-patcher') !== -1) {
        const fileName = err.FileName.replace(/^file:\/*/, '');
        result = new SetupError(`Your installation is missing "${fileName}" which is part of the `
          + 'Vortex installer. This would only happen if you use an unofficial installer or the '
          + 'Vortex installation was modified.');
      }
    }
  } else if (err.name === 'System.IO.FileLoadException') {
    if (err?.FileName) {
      if (err.FileName.indexOf('node_modules\\harmony-patcher') !== -1) {
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
    result = new SetupError('The injector tried to access a file with a path longer than 260 '
                        + 'characters. This usually means that your mod staging path is too long.');
  } else if ((err.name === 'System.IO.IOException')
             && (err.stack.indexOf('System.IO.Path.InternalGetTempFileName'))) {
    const tempDir = getVortexPath('temp');
    result = new SetupError(`Your temp directory "${tempDir}" contains too many files. `
                          + 'You need to clean up that directory. Files in that directory '
                          + 'should be safe to delete (they are temporary after all) but '
                          + 'some will be inaccessible, just ignore those.');
  }

  if (result === undefined) {
    result = new Error(
      (err.Message !== undefined)
        ? err.Message
        : 'unknown error: ' + util.inspect(err));
  }
  [
    { in: 'StackTrace', out: 'stack' },
    { in: 'FileName', out: 'path' },
    { in: 'HResult', out: 'code' },
    { in: 'name', out: 'Name' },
    { in: 'Source', out: 'Module' },
  ].forEach(transform => {
    if (err[transform.in] !== undefined) {
      result[transform.out] = err[transform.in];
    }
  });

  return result;
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
 * create a socket that will be used to communicate with the injector process
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
      if (options.pipe) {
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
  public static async bind(): Promise<ConnectionIPC> {
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

    const pipe = process.platform === 'win32';
    const debug = false;
    const { ipcId, server } = await createSocket({
      pipe,
      debug,
    });
    log('debug', '[harmony-injector] waiting for peer process to connect');

    server.on('connection', sock => {
      log('debug', '[harmony-injector] peer connected');
      sock.setEncoding('utf8');
      if (!wasConnected) {
        wasConnected = true;
        servSocket = sock;
        if (pipe) {
          log('debug', '[harmony-injector] connecting to reply pipe');
          createConnection(`\\\\?\\pipe\\${ipcId}_reply`)
          .then(sockIn => {
            log('debug', '[harmony-injector] reply pipe connected');
            sockIn.setEncoding('utf-8');
            sockIn.on('error', err => {
              log('error', '[harmony-injector] socket error', err.message);
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

    if (!debug) {
      // for debugging purposes, the user has to run the injector manually
      // invoke the c# injector, passing the id/port
      try {
        proc = await createIPC(pipe, ipcId);
      } catch (err) {
        onReject(new ProcessCanceled(err.message));
      }
      proc.stdout.on('data', (dat: Buffer) => {
        log('debug', 'received from injector:', dat.toString());
      });
      proc.stderr.on('data', (dat: Buffer) => {
        const errorMessage = dat.toString();
        log('error', 'received from injector:', errorMessage);
        if (!wasConnected) {
          onReject(new Error(errorMessage));
          wasConnected = true;
        }
      });
    }

    // wait until the child process has actually connected, any error in this phase
    // probably means it's not going to happen...
    await connectedPromise;

    return new ConnectionIPC({ in: cliSocket, out: servSocket }, proc);
  }

  private mSocket: { in: net.Socket, out: net.Socket };
  private mProcess: ChildProcess;
  private mAwaitedReplies: { [id: string]: IAwaitingPromise } = {};
  private mDelegates: { [id: string]: Core } = {};
  private mOnInterrupted: (err: Error) => void;
  private mReceivedBuffer: string;

  constructor(socket: { in: net.Socket, out: net.Socket }, proc: ChildProcess) {
    this.mSocket = socket;
    this.mProcess = proc;

    if (proc !== null) {
      proc.on('exit', async (code, signal) => {
        log(code === 0 ? 'info' : 'error', 'remote process exited', { code, signal });
        try {
          await toPromise(cb => socket.out.end(cb));
          this.interrupt(new Error(`Injector process quit unexpectedly (Code ${code})`));
        } catch (err) {
          log('warn', 'failed to close connection to Harmony Injector process', err.message);
        }
      });
    }

    socket.in.on('close', async () => {
      socket.out.destroy();
      log('info', 'remote was disconnected');
      try {
        // just making sure, the remote is probably closing anyway
        await new Promise((resolve) => setTimeout(resolve, 1000));
        this.mProcess.kill();
        this.interrupt(new Error(`Harmony Injector process disconnected unexpectedly`));
      } catch (err) {
        // nop
      }
    });
  }

  public handleMessages() {
    this.mSocket.in.on('data', (data: string) => {
      if (data.length > 0) {
        this.mReceivedBuffer = (this.mReceivedBuffer === undefined)
          ? data
          : this.mReceivedBuffer + data;
        if (this.mReceivedBuffer.endsWith('\uffff')) {
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
    return Promise.race([
      this.interruptible(),
      this.sendMessageInner(command, data, delegate),
    ]);
  }

  private async interruptible() {
    return new Promise((resolve, reject) => {
      this.mOnInterrupted = reject;
    });
  }

  private async sendMessageInner(Command: string, data: any, delegate?: Core): Promise<any> {
    const id = shortid();

    const res = new Promise((resolve, reject) => {
      this.mAwaitedReplies[id] = { resolve, reject };
      if (delegate !== undefined) {
        this.mDelegates[id] = delegate;
      }
    });

    const stringified = JSON.stringify({
      id,
      payload: {
        ...data,
        Command,
      },
    }, jsonReplace);

    if (this.mSocket.out.writable) {
      this.mSocket.out.write(stringified + '\uFFFF');
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

    if ((data.callback !== null)
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
        this.mAwaitedReplies[data.id].reject(err);
      } else {
        this.mAwaitedReplies[data.id].resolve(data.data);
      }
      delete this.mAwaitedReplies[data.id];
    }
  }

  private interrupt(err: Error) {
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
      log('debug', '[harmony-injector] connection bound');
      conn.handleMessages();
    }
    return Promise.resolve(conn);
  };
})();

async function applyInjectCommand(patchConfig: IPatchConfig,
                                  coreDelegates: Core,
                                  data?: any,
                                  callback?: (err, result) => void): Promise<any> {
  const connection = await ensureConnected();
  const payload = (data !== undefined)
    ? { patchConfig, ...data } : { patchConfig };
  log('debug', '[harmony-injector] applying patch command', JSON.stringify(patchConfig));
  return connection.sendMessage(patchConfig.Command, payload, coreDelegates)
    .then(res => {
      log('debug', '[harmony-injector] result received', JSON.stringify(res));
      return (callback !== undefined) ? callback(undefined, res) : Promise.resolve();
    })
    .catch(err => {
      const error = transformError(err);
      if (callback !== undefined) {
        callback(error, undefined);
      }

      return Promise.reject(err);
    });
}

async function resolveGameId(api: IExtensionApi, patchConfig: IPatchConfig) {
  // We can't rely on the active gameId to be correct - we need to resolve
  //  the gameId using the extension path.
  const state = api.getState();
  const gameId = activeGameId(state);
  if (patchConfig.ExtensionPath === undefined) {
    return gameId;
  }

  try {
    // tslint:disable-next-line: max-line-length
    const knownGames: IGameStored[] = state.session.gameMode.known;
    const match = knownGames.find(game => game.extensionPath === patchConfig.ExtensionPath);
    return match !== undefined ? match.id : gameId;
  } catch (err) {
    log('error', 'failed to resolve gameId', err);
    return gameId;
  }
}

function init(context: IExtensionContext): boolean {
  const injectorWrap = async (patchConfig: IPatchConfig,
                              modLoaderPath: string,
                              data?: any,
                              callback?: (err, result) => void) => {
    const gameId = await resolveGameId(context.api, patchConfig);
    let coreDelegates;
    try {
      coreDelegates = new Core(context.api, gameId, modLoaderPath);
      await applyInjectCommand(patchConfig, coreDelegates, data, callback);
    } catch (err) {
      let allowReport = true;
      const game = getGame(gameId);
      if (game !== undefined) {
        allowReport = game.contributed === undefined;
      }
      context.api.showErrorNotification('Unable to apply patch command', err, { allowReport });
    } finally {
      if (coreDelegates !== undefined) {
        coreDelegates.detach();
      }
    }
  };

  context.registerAPI('applyInjectorCommand', (patchConfig: IPatchConfig,
                                               modLoaderPath: string,
                                               data: any,
                                               callback: (err, result) => void) => {
    injectorWrap(patchConfig, modLoaderPath, data, callback);
  }, { minArguments: 1 });

  if (process.platform === 'win32') {
    context.registerTest('net-current', 'startup', checkNetInstall);
  }

  return true;
}

export default init;
