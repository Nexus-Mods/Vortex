import path from 'path';
import { execFile, spawn } from 'child_process';
import Bluebird from 'bluebird';
import { NET_CORE_DOWNLOAD } from './constants';
import { SITE_ID } from '../gamemode_management/constants';
import { downloadPathForGame } from '../download_management/selectors';
import { ITestResult, IExtensionApi, IExtensionContext } from '../../types/api';
import { getVortexPath, UserCanceled } from '../../util/api';
import { delayed, toPromise } from '../../util/util';
import { log } from '../../util/log';

const spawnAsync = (command: string, args: string[]): Promise<void> => {
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

const spawnRetry = async (api: IExtensionApi, command: string, args: string[], tries = 3): Promise<void> => {
  try {
    return await spawnAsync(command, args);
  } catch (err: any) {
    if (err.code === 'EBUSY') {
      if (tries > 0) {
        return delayed(100)
          .then(() => spawnRetry(api, command, args, tries - 1));
      } else {
        return api.showDialog?.('error', 'File locked', {
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
  }
}

let dotNetResolve: (() => void) | undefined;
const dotNetAssert = new Promise<void>((resolve) => {
  dotNetResolve = resolve;
});

const onFoundDotNet = () => {
  dotNetResolve?.();
  dotNetResolve = undefined; // Prevent multiple calls
};

const installDotNet = async (api: IExtensionApi, repair: boolean): Promise<void> => {
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
  if (!download?.localPath) {
    log('error', 'No downloads path for game', { gameId: SITE_ID });
    return Promise.resolve();
  }

  const fullPath = path.join(downloadsPath, download.localPath);

  api.showDialog?.('info', 'Microsoft .NET Desktop Runtime 9 is being installed', {
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

const checkNetInstall = (api: IExtensionApi): Bluebird<ITestResult> => {
  return Bluebird.resolve((async () => {
    if (process.platform !== 'win32') {
      // currently only supported/tested on windows
      onFoundDotNet();
      return undefined!;
    }

    const probeExe = path.join(getVortexPath('assets_unpacked'), 'dotnetprobe.exe');
    let stderr: string = '';
    const exitCode = await new Promise<number | null>((resolve) => {
      const proc = execFile(probeExe).on('close', code => resolve(code));
      proc.stderr?.on('data', dat => stderr += dat.toString());
    });


    if (exitCode === 0) {
      onFoundDotNet();
      return undefined!;
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
        replace: { stderr: stderr.replace(/\n/g, '[br][/br]') },
      },
      automaticFix: () => Bluebird.resolve(installDotNet(api, false)),
      severity: 'fatal',
    };

    return result;
  })());
}

/**
 * Extension initialization
 */
const main = (context: IExtensionContext): boolean => {

  context.api.ext['awaitDotnetAssert'] = () => dotNetAssert;

  // Register .NET 9 Desktop Runtime check
  context.registerTest('dotnet-installed', 'startup', () => Bluebird.resolve(checkNetInstall(context.api)));

  return true;
}

export default main;
