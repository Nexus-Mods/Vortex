import {
  IExtensionApi,
  IExtensionContext,
  IInstallResult,
  ISupportedResult,
  ProgressDelegate,
} from '../../types/IExtensionContext';
import { ITestResult } from '../../types/ITestResult';
import { DataInvalid, SetupError, UserCanceled } from '../../util/CustomErrors';
import * as fs from '../../util/fs';
import getVortexPath from '../../util/getVortexPath';
import lazyRequire from '../../util/lazyRequire';
import { log } from '../../util/log';
import { getSafe } from '../../util/storeHelper';
import {truthy} from '../../util/util';

import { getGame } from '../gamemode_management/util/getGame';
import { ArchiveBrokenError } from '../mod_management/InstallManager';
import { IMod } from '../mod_management/types/IMod';

import { endDialog, setInstallerDataPath } from './actions/installerUI';
import Core from './delegates/Core';
import { installerUIReducer } from './reducers/installerUI';
import { IGroupList, IInstallerState } from './types/interface';
import {
  getPluginPath,
  getStopPatterns,
} from './util/gameSupport';
import { checkAssemblies, getNetVersion } from './util/netVersion';
import InstallerDialog from './views/InstallerDialog';

import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as edgeT from 'electron-edge-js';
const edge = lazyRequire<typeof edgeT>(() => require('electron-edge-js'));
import * as path from 'path';
import * as semver from 'semver';
import * as util from 'util';

const app = appIn !== undefined ? appIn : remote.app;

let testSupportedLib;
let installLib;

const basePath = path.join(getVortexPath('modules_unpacked'), 'fomod-installer', 'dist');

function transformError(err: any): Error {
  let result: Error;
  if (typeof(err) === 'string') {
    // I hope these errors aren't localised or something...
    result = (err === 'The operation was cancelled.')
      // weeell, we don't actually know if it was the user who cancelled...
      ? new UserCanceled()
      : new Error(err);
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
             && (err.StackTrace.indexOf('System.IO.Path.InternalGetTempFileName'))) {
    const tempDir = app.getPath('temp');
    result = new SetupError(`Your temp directory "${tempDir}" contains too many files. `
                          + 'You need to clean up that directory. Files in that directory '
                          + 'should be safe to delete (they are temporary after all) but '
                          + 'some will be inaccessible, just ignore those.');
  } else if ((err.StackTrace.indexOf('XNodeValidator.ValidationCallback') !== -1)
             || (err.StackTrace.indexOf('XmlTextReaderImpl.ParseXmlDeclaration') !== -1)
             || (err.StackTrace.indexOf('XmlTextReaderImpl.ParseAttributes') !== -1)
             || (err.StackTrace.indexOf('XmlScriptType.GetXmlScriptVersion') !== -1)
             ) {
    result = new DataInvalid('Invalid installer script: ' + err.message);
  } else if ((err.name === 'System.Xml.XmlException')
             && ((err.StackTrace.indexOf('System.Xml.XmlTextReaderImpl.ParseText') !== -1)
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

function assertEdgeValid() {
  if (typeof(edge.func) !== 'function') {
    log('error', 'edge.func isn\'t a function', { type: typeof(edge.func) });
    throw new SetupError(
      '.Net interface library not loaded correctly. This usually means your .Net framework '
      + 'is damaged or outdated. Please report this only if you have further insight into '
      + 'what might have caused this and how to fix.');
  }
}

function tsLib() {
  if (testSupportedLib === undefined) {
    try {
      assertEdgeValid();
      testSupportedLib = edge.func({
        assemblyFile: path.join(basePath, 'ModInstaller.dll'),
        typeName: 'FomodInstaller.ModInstaller.InstallerProxy',
        methodName: 'TestSupported',
      });
    } catch (err) {
      if (err.message.startsWith('error: 126')) {
        const newErr = new SetupError(
          'Failed to load the fomod support library. This is an indication your .Net '
          + 'installation is invalid or outdated.');
        newErr.stack = err.stack;
        throw newErr;
      }
      throw err.Data === undefined ? err : transformError(err);
    }
  }
  return testSupportedLib;
}

function testSupportedScripted(files: string[]): Promise<ISupportedResult> {
  const testSupported = tsLib();
  return new Promise<ISupportedResult>((resolve, reject) => {
    testSupported({files, allowedTypes: ['XmlScript', 'CSharpScript']},
                  (err: Error, result: ISupportedResult) => {
      if ((err !== null) && (err !== undefined)) {
        reject(transformError(err));
      } else {
        resolve(result);
      }
    });
  });
}

function testSupportedFallback(files: string[]): Promise<ISupportedResult> {
  const testSupported = tsLib();
  return new Promise<ISupportedResult>((resolve, reject) => {
    testSupported({files, allowedTypes: ['Basic']},
                  (err: Error, result: ISupportedResult) => {
      if ((err !== null) && (err !== undefined)) {
        reject(transformError(err));
      } else {
        resolve(result);
      }
    });
  });
}

let currentInstallPromise: Promise<any> = Promise.resolve();

function install(api: IExtensionApi,
                 files: string[],
                 stopPatterns: string[],
                 pluginPath: string,
                 scriptPath: string,
                 choicesIn: any,
                 progressDelegate: ProgressDelegate,
                 coreDelegates: Core): Promise<IInstallResult> {
  if (installLib === undefined) {
    try {
      assertEdgeValid();
      installLib = edge.func({
        assemblyFile: path.join(basePath, 'ModInstaller.dll'),
        typeName: 'FomodInstaller.ModInstaller.InstallerProxy',
        methodName: 'Install',
      });
    } catch (err) {
      return Promise.reject(err.Data === undefined ? err : transformError(err));
    }
  }

  currentInstallPromise = new Promise((resolve, reject) => {
    installLib({ files, stopPatterns, pluginPath, scriptPath,
                 choices: choicesIn, progressDelegate, coreDelegates },
      (err: Error, result: any) => {
        if ((err !== null) && (err !== undefined)) {
          reject(transformError(err));
        } else {
          try {
            const state = api.store.getState();
            const dialogState: IInstallerState = state.session.fomod.installer.dialog.state;

            const choices = (dialogState === undefined)
              ? undefined
              : dialogState.installSteps
                // some fomods may have multiple steps with the same name of which only one will be
                // visible at a time.
                .filter(step => step.visible)
                .map(step => {
                  const ofg: IGroupList =
                    step.optionalFileGroups || { group: [], order: 'Explicit' };
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

            resolve({
              message: result.message,
              instructions: [].concat(result.instructions, [{
                type: 'attribute',
                key: 'installerChoices',
                value: {
                  type: 'fomod',
                  options: choices,
                },
              }]),
            });
          } catch (err) {
            reject(err);
          }
      }
    });
  }).finally(() => {
    currentInstallPromise = Promise.resolve();
  });
  return currentInstallPromise;
}

function processAttributes(input: any, modPath: string): Promise<any> {
  if (modPath === undefined) {
    return Promise.resolve({});
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
    return Promise.resolve(res);
  } else {
    return checkAssemblies()
      .then(valid => {
        if (valid) {
          return Promise.resolve(undefined);
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
          return Promise.resolve(res);
        }
      });
  }
}

function init(context: IExtensionContext): boolean {
  const installWrap = (files, scriptPath, gameId, progressDelegate, choices, unattended) => {
    const canBeUnattended = (choices !== undefined) && (choices.type === 'fomod');
    const coreDelegates = new Core(context.api, gameId, canBeUnattended && (unattended === true));
    const stopPatterns = getStopPatterns(gameId, getGame(gameId));
    const pluginPath = getPluginPath(gameId);
    return currentInstallPromise
      .then(() => {
        context.api.store.dispatch(setInstallerDataPath(scriptPath));
        const fomodChoices = (choices !== undefined) && (choices.type === 'fomod')
          ? choices.options
          : undefined;
        return install(context.api, files, stopPatterns, pluginPath,
          scriptPath, fomodChoices,
          progressDelegate, coreDelegates);
      })
      .finally(() => {
        context.api.store.dispatch(endDialog());
        coreDelegates.detach();
      });
  };

  context.registerInstaller('fomod', 20, testSupportedScripted, installWrap);
  context.registerInstaller('fomod', 100, testSupportedFallback, installWrap);

  context.registerTest('net-current', 'startup', checkNetInstall);
  context.registerDialog('fomod-installer', InstallerDialog);
  context.registerReducer(['session', 'fomod', 'installer', 'dialog'], installerUIReducer);

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
