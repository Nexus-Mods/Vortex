/* eslint-disable */
import * as path from 'path';
import { log, selectors, types, util } from 'vortex-api';

import { GAME_ID } from './common';
import { DivineAction, IDivineOptions, IDivineOutput } from './types';
import { getLatestLSLibMod, logError } from './util';

import {
  DEFAULT_TIMEOUT_MS,
  DivineAborted,
  DivineExecMissing,
  DivineMissingDotNet,
  DivinePakInvalid,
  IDivineRunOptions,
  parsePackageListOutput,
  runDivineCore,
} from './divineCore';

// Run 5 concurrent Divine processes. Retry on transient failures, but fail
// fast for deterministic ones — retrying a missing exe, a missing .NET
// runtime, or a malformed pak just multiplies log volume without changing
// the outcome.
const concurrencyLimiter: util.ConcurrencyLimiter = new util.ConcurrencyLimiter(
  5,
  (err: Error) => !(err instanceof DivineAborted)
               && !(err instanceof DivineExecMissing)
               && !(err instanceof DivineMissingDotNet)
               && !(err instanceof DivinePakInvalid));

// Module-level AbortController lets callers cancel all in-flight and queued
// divine operations at once (e.g. when switching games). Replaced after each
// abort so subsequent calls run normally.
let abortController = new AbortController();

export function abortDivineOperations(): void {
  abortController.abort();
  abortController = new AbortController();
  concurrencyLimiter.clearQueue();
}

function resolveExePath(api: types.IExtensionApi): string {
  const state = api.getState();
  const stagingFolder = selectors.installPathForGame(state, GAME_ID);
  const lsLib = getLatestLSLibMod(api);
  if (lsLib === undefined) {
    throw new Error('LSLib/Divine tool is missing');
  }
  return path.join(stagingFolder, lsLib.installationPath, 'tools', 'divine.exe');
}

async function runDivine(api: types.IExtensionApi,
                         action: DivineAction,
                         divineOpts: IDivineOptions)
                         : Promise<IDivineOutput> {
  // Capture the signal at enqueue time. If the controller is replaced by
  // abortDivineOperations() while this call is queued or retrying, the
  // captured signal stays aborted and every attempt fails fast.
  const signal = abortController.signal;
  const runOpts: IDivineRunOptions = { signal, timeoutMs: DEFAULT_TIMEOUT_MS };
  return new Promise((resolve, reject) => concurrencyLimiter.do(async () => {
    try {
      const exePath = resolveExePath(api);
      const result = await runDivineCore(exePath, action, divineOpts, runOpts);
      return resolve(result);
    } catch (err) {
      return reject(err);
    }
  }));
}

export async function extractPak(api: types.IExtensionApi, pakPath: string, destPath: string, pattern: string): Promise<IDivineOutput> {
  return runDivine(api, 'extract-package',
    { source: pakPath, destination: destPath, expression: pattern });
}

export async function listPackage(api: types.IExtensionApi, pakPath: string): Promise<string[]> {
  let res: IDivineOutput | undefined;
  try {
    res = await runDivine(api, 'list-package', { source: pakPath, loglevel: 'off' });
  } catch (error) {
    if (error instanceof DivineAborted) {
      throw error;
    }
    logError(`listPackage caught error: `, { error });

    if (error instanceof DivineMissingDotNet) {
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

  return parsePackageListOutput(res?.stdout ?? '');
}
