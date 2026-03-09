/* eslint-disable */
import * as path from 'path';
import { log, selectors, types, util } from 'vortex-api';

import { GAME_ID } from './common';
import { DivineAction, IDivineOptions, IDivineOutput } from './types';
import { getLatestLSLibMod, logError } from './util';

import * as nodeUtil from 'util';
import * as child_process from 'child_process';

const exec = nodeUtil.promisify(child_process.exec);

// Run 5 concurrent Divine processes - retry each process 5 times if it fails.
const concurrencyLimiter: util.ConcurrencyLimiter = new util.ConcurrencyLimiter(5, () => true);

// This is probably overkill - mod extraction shouldn't take
//  more than a few seconds.
const TIMEOUT_MS = 10000;

export class DivineExecMissing extends Error {
  constructor() {
    super('Divine executable is missing');
    this.name = 'DivineExecMissing';
  }
}

export class DivineMissingDotNet extends Error {
  constructor() {
    super('LSLib requires .NET 8 Desktop Runtime to be installed.');
    this.name = 'DivineMissingDotNet';
  }
}

export class DivineTimedOut extends Error {
  constructor() {
    super('Divine process timed out');
    this.name = 'DivineTimedOut';
  }
}

const execOpts: child_process.ExecOptions = {
  timeout: TIMEOUT_MS,
};

async function runDivine(api: types.IExtensionApi,
                         action: DivineAction,
                         divineOpts: IDivineOptions)
                         : Promise<IDivineOutput> {
  return new Promise((resolve, reject) => concurrencyLimiter.do(async () => {
    try {
      const result = await divine(api, action, divineOpts, execOpts);
      return resolve(result);
    } catch (err) {
      return reject(err);
    }
  }));
}

async function divine(api: types.IExtensionApi,
  action: DivineAction,
  divineOpts: IDivineOptions,
  execOpts: child_process.ExecOptions): Promise<IDivineOutput> {
  return new Promise<IDivineOutput>(async (resolve, reject) => {
    const state = api.getState();
    const stagingFolder = selectors.installPathForGame(state, GAME_ID);
    const lsLib: types.IMod = getLatestLSLibMod(api);
    if (lsLib === undefined) {
      const err = new Error('LSLib/Divine tool is missing');
      err['attachLogOnReport'] = false;
      return reject(err);
    }
    const exe = path.join(stagingFolder, lsLib.installationPath, 'tools', 'divine.exe');
    const args = [
      '--action', action,
      '--source', `"${divineOpts.source}"`,
      '--game', 'bg3',
    ];

    if (divineOpts.loglevel !== undefined) {
      args.push('--loglevel', divineOpts.loglevel);
    } else {
      args.push('--loglevel', 'off');
    }

    if (divineOpts.destination !== undefined) {
      args.push('--destination', `"${divineOpts.destination}"`);
    }
    if (divineOpts.expression !== undefined) {
      args.push('--expression', `"${divineOpts.expression}"`);
    }

    try {
      const command = `"${exe}" ${args.join(' ')}`;
      const { stdout, stderr } = await exec(command, execOpts);
      if (!!stderr) {
        return reject(new Error(`divine.exe failed: ${stderr}`));
      }
      if (!stdout && action !== 'list-package') {
        return resolve({ stdout: '', returnCode: 2 })
      }      
      const stdoutStr = typeof stdout === 'string' ? stdout : stdout?.toString?.() ?? '';
      if (['error', 'fatal'].some(x => stdoutStr.toLowerCase().startsWith(x))) {
        // Really?
        return reject(new Error(`divine.exe failed: ${stdoutStr}`));
      } else  {
        return resolve({ stdout: stdoutStr, returnCode: 0 });
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        return reject(new DivineExecMissing());
      }

      if(err.message.includes('You must install or update .NET')) {
        return reject(new DivineMissingDotNet());
      }

      const error = new Error(`divine.exe failed: ${err.message}`);
      error['attachLogOnReport'] = true;
      return reject(error);
    }
  });
}

export async function extractPak(api: types.IExtensionApi, pakPath, destPath, pattern) {
  return runDivine(api, 'extract-package',
    { source: pakPath, destination: destPath, expression: pattern });
}

export async function listPackage(api: types.IExtensionApi, pakPath: string): Promise<string[]> {
  let res;
  try {
    res = await runDivine(api, 'list-package', { source: pakPath, loglevel: 'off' });
  } catch (error) {    
    logError(`listPackage caught error: `, { error });
    //log('debug', 'listPackage error', error.message);

    if(error instanceof DivineMissingDotNet) {  
      log('error', 'Missing .NET', error.message);
      api.dismissNotification('bg3-reading-paks-activity');
      api.showErrorNotification('LSLib requires .NET 8', 
      'LSLib requires .NET 8 Desktop Runtime to be installed.' +
      '[br][/br][br][/br]' +
      '[list=1][*]Download and Install [url=https://dotnet.microsoft.com/en-us/download/dotnet/thank-you/runtime-desktop-8.0.3-windows-x64-installer].NET 8.0 Desktop Runtime from Microsoft[/url]'  + 
      '[*]Close Vortex' + 
      '[*]Restart Computer' + 
      '[*]Open Vortex[/list]',
       { id: 'bg3-dotnet-error', allowReport: false, isBBCode: true });
    }
  }

  //logDebug(`listPackage res=`, res);
  const lines = (res?.stdout || '').split('\n').map(line => line.trim()).filter(line => line.length !== 0);

  //logDebug(`listPackage lines=`, lines);

  return lines;
}