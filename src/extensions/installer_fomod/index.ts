import {
  IExtensionContext,
  IInstallResult,
  ISupportedResult,
  ProgressDelegate,
} from '../../types/IExtensionContext';
import { ITestResult } from '../../types/ITestResult';
import { DataInvalid, SetupError, UserCanceled } from '../../util/CustomErrors';
import * as fs from '../../util/fs';
import { log } from '../../util/log';
import {truthy} from '../../util/util';
import { getVortexPath } from '../../util/api';

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
import { createIPC } from 'fomod-installer';
import * as path from 'path';
import * as semver from 'semver';
import { generate as shortid } from 'shortid';
import * as util from 'util';
import { Pair } from 'zeromq';

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
    if (err.FileName.indexOf('node_modules\\fomod-installer') !== -1) {
      const fileName = err.FileName.replace(/^file:\/*/, '');
      result = new SetupError(`Windows prevented Vortex from loading "${fileName}". `
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
  } else if ((err.stack.indexOf('XNodeValidator.ValidationCallback') !== -1)
             || (err.stack.indexOf('XmlTextReaderImpl.ParseXmlDeclaration') !== -1)
             || (err.stack.indexOf('XmlTextReaderImpl.ParseAttributes') !== -1)
             || (err.stack.indexOf('XmlScriptType.GetXmlScriptVersion') !== -1)
             ) {
    result = new DataInvalid('Invalid installer script: ' + err.message);
  } else if ((err.name === 'System.Xml.XmlException')
             && ((err.stack.indexOf('System.Xml.XmlTextReaderImpl.ParseText') !== -1)
                 || (err.message.indexOf('does not match the end tag') !== -1))) {
    result = new DataInvalid('Invalid installer script: ' + err.message);
  } else if (err.name === 'System.AggregateException') {
    return transformError(err.InnerException);
  } else if (err.Message === 'task timeout') {
    result = new SetupError('A task in the script didn\'t complete in time. The timeouts are set '
                          + 'very generously so it\'s more likely that this is either caused '
                          + 'by a broken .Net installation or something else on your system '
                          + 'interrupted the process (like a debugger).');
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

class ConnectionIPC {
  public static async bind(): Promise<ConnectionIPC> {
    const socket = new Pair();
    let proc: ChildProcess = null;
    let onResolve: () => void;
    let onReject: (err: Error) => void;
    const connectedPromise = new Promise((resolve, reject) => {
      onResolve = resolve;
      onReject = reject;
    });
    let wasConnected = false;

    if (false) {
      // for debugging purposes, the user has to run the installer manually
      await socket.bind('tcp://127.0.0.1:12345');
    } else {
      // connect to random free port
      await socket.bind('tcp://127.0.0.1:*');
      socket.events.on('accept', () => {
        if (!wasConnected) {
          onResolve();
          wasConnected = true;
        }
      });
      // invoke the c# installer, passing the port
      proc = await createIPC(socket.lastEndpoint.split(':')[2]);
      proc.stderr.on('data', (dat: Buffer) => {
        const errorMessage = dat.toString();
        log('error', 'from installer: ', errorMessage);
        if (!wasConnected) {
          onReject(new Error(errorMessage));
          wasConnected = true;
        }
      });
    }

    // wait until the child process has actually connected, any error in this phase
    // probably means it's not going to happen...
    await connectedPromise;

    return new ConnectionIPC(socket, proc);
  }

  private mSocket: Pair;
  private mProcess: ChildProcess;
  private mAwaitedReplies: { [id: string]: IAwaitingPromise } = {};
  private mDelegates: { [id: string]: Core } = {};
  private mOnInterrupted: (err: Error) => void;

  constructor(socket: Pair, proc: ChildProcess) {
    this.mSocket = socket;
    this.mProcess = proc;

    if (proc !== null) {
      proc.on('exit', async (code, signal) => {
        log(code === 0 ? 'info' : 'error', 'remote process exited', { code, signal });
        try {
          await socket.unbind(socket.lastEndpoint);
          this.interrupt(new Error(`Installer process quit unexpectedly (Code ${code})`));
        } catch (err) {
          log('warn', 'failed to close connection to fomod installer process', err.message);
        }
      });
    }

    socket.events.on('disconnect', async () => {
      log('info', 'remote was disconnected');
      try {
        // just making sure, the remote is probably closing anyway
        await new Promise((resolve) => setTimeout(resolve, 1000));
        this.mProcess.kill();
        this.interrupt(new Error(`Installer process disconnected unexpectedly`));
      } catch (err) {
        // nop
      }
    });
  }

  public handleMessages() {
    this.receiveNext();
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

  private async sendMessageInner(command: string, data: any, delegate?: Core): Promise<any> {
    const id = shortid();

    const res = new Promise((resolve, reject) => {
      this.mAwaitedReplies[id] = { resolve, reject };
      if (delegate !== undefined) {
        this.mDelegates[id] = delegate;
      }
    });

    this.mSocket.send(JSON.stringify({
      id,
      payload: {
        ...data,
        command,
      },
    }));
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

  private processData(msg: Buffer) {
    const data = JSON.parse(msg.toString(), (key: string, value: any) => {
      if (truthy(value) && (typeof (value) === 'object')) {
        Object.keys(value).forEach(subKey => {
          if (truthy(value[subKey])
            && (typeof (value[subKey]) === 'object')
            && (value[subKey].__callback !== undefined)) {
            const callbackId = value[subKey].__callback;
            value[subKey] = (...args: any[]) => {
              this.sendMessageInner('Invoke', {
                requestId: data.id,
                callbackId,
                args,
              })
                .catch(err => {
                  log('info', 'process data', err.message);
                });
            };
          }
        });
      }
      return value;
    });
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

  private async receiveNext(): Promise<void> {
    const data = await this.mSocket.receive();
    data.forEach(dat => this.processData(dat));
    return this.receiveNext();
  }
}

const ensureConnected = (() => {
  let conn: ConnectionIPC;
  return async (): Promise<ConnectionIPC> => {
    if ((conn === undefined) || !conn.isActive()) {
      conn = await ConnectionIPC.bind();
      conn.handleMessages();
    }
    return Promise.resolve(conn);
  };
})();

async function testSupportedScripted(files: string[]): Promise<ISupportedResult> {
  const connection = await ensureConnected();

  try {
    return await connection.sendMessage('TestSupported',
      { files, allowedTypes: ['XmlScript', 'CSharpScript'] })
  } catch (err) {
    throw transformError(err);
  }
}

async function testSupportedFallback(files: string[]): Promise<ISupportedResult> {
  const connection = await ensureConnected();

  return connection.sendMessage('TestSupported', { files, allowedTypes: ['Basic'] })
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

  context.registerTest('net-current', 'startup', checkNetInstall);
  context.registerDialog('fomod-installer', InstallerDialog);
  context.registerReducer(['session', 'fomod', 'installer', 'dialog'], installerUIReducer);

  context.registerAttributeExtractor(75, processAttributes);

  return true;
}

export default init;
