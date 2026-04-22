import * as nodeUtil from 'util';
import * as child_process from 'child_process';
import * as fs from 'fs/promises';

import type { DivineAction, IDivineOptions, IDivineOutput } from './types';

const exec = nodeUtil.promisify(child_process.exec);

export const DEFAULT_TIMEOUT_MS = 10000;

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

export class DivineAborted extends Error {
  constructor() {
    super('Divine operation was aborted');
    this.name = 'DivineAborted';
  }
}

export class DivinePakInvalid extends Error {
  public readonly details: string;
  constructor(details: string) {
    super(`divine.exe reported pak is invalid: ${details}`);
    this.name = 'DivinePakInvalid';
    this.details = details;
  }
}

export interface IExecErrorShape {
  code?: number | string;
  signal?: string;
  message?: string;
  stderr?: string;
  stdout?: string;
}

export interface IDivineRunOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export function buildDivineArgs(action: DivineAction, opts: IDivineOptions): string[] {
  // Default to 'error' (not 'off') so divine surfaces genuine failures on
  // stdout — the exit-code path alone doesn't distinguish "empty pak" from
  // "unreadable pak" for the list-package action.
  const args = [
    '--action', action,
    '--source', `"${opts.source}"`,
    '--game', 'bg3',
    '--loglevel', opts.loglevel ?? 'error',
  ];
  if (opts.destination !== undefined) {
    args.push('--destination', `"${opts.destination}"`);
  }
  if (opts.expression !== undefined) {
    args.push('--expression', `"${opts.expression}"`);
  }
  return args;
}

// divine.exe tags error lines with [ERROR] or [FATAL] at loglevel=error and
// above. Used to classify pak-format failures distinct from generic errors.
const PAK_INVALID_MARKER = /\[(?:ERROR|FATAL)\]/i;

function classifyPakInvalid(stdout: string, stderr: string): DivinePakInvalid | undefined {
  const stdoutTrim = stdout.trim();
  const stderrTrim = stderr.trim();
  if (PAK_INVALID_MARKER.test(stdoutTrim) || PAK_INVALID_MARKER.test(stderrTrim)) {
    return new DivinePakInvalid(stdoutTrim || stderrTrim);
  }
  return undefined;
}

export function translateDivineError(
  err: IExecErrorShape,
  action: DivineAction,
  signalAborted: boolean,
): Error {
  // Abort check runs first: a cancelled process exits via SIGTERM, which is
  // indistinguishable from a timeout by signal name alone.
  if (signalAborted) {
    return new DivineAborted();
  }
  if (err.code === 'ENOENT') {
    return new DivineExecMissing();
  }
  if (err.message?.includes('You must install or update .NET')) {
    return new DivineMissingDotNet();
  }
  if (err.signal === 'SIGTERM') {
    return new DivineTimedOut();
  }

  const stderrStr = typeof err.stderr === 'string' ? err.stderr : '';
  const stdoutStr = typeof err.stdout === 'string' ? err.stdout : '';

  const pakInvalid = classifyPakInvalid(stdoutStr, stderrStr);
  if (pakInvalid !== undefined) {
    return pakInvalid;
  }

  const stderrTrim = stderrStr.trim();
  const stdoutTrim = stdoutStr.trim();
  const parts: string[] = [`action=${action}`];
  if (typeof err.code === 'number') {
    parts.push(`exitCode=${err.code}`);
  } else if (typeof err.code === 'string') {
    parts.push(`code=${err.code}`);
  }
  if (err.signal) {
    parts.push(`signal=${err.signal}`);
  }
  if (stderrTrim) {
    parts.push(`stderr=${stderrTrim}`);
  }
  if (stdoutTrim) {
    parts.push(`stdout=${stdoutTrim}`);
  }
  const detail = parts.length > 1 ? parts.join('; ') : (err.message ?? 'unknown');
  return new Error(`divine.exe failed: ${detail}`);
}

export function parsePackageListOutput(stdout: string): string[] {
  return stdout
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

export async function runDivineCore(
  exePath: string,
  action: DivineAction,
  opts: IDivineOptions,
  runOpts: IDivineRunOptions = {},
): Promise<IDivineOutput> {
  // exec runs via the shell, so a missing target surfaces as a generic
  // non-zero exit code rather than ENOENT on the spawn itself. Pre-check
  // so DivineExecMissing fires for its intended case (LSLib not installed).
  try {
    await fs.stat(exePath);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new DivineExecMissing();
    }
    throw e;
  }

  const args = buildDivineArgs(action, opts);
  const command = `"${exePath}" ${args.join(' ')}`;
  const execOpts: child_process.ExecOptions = {
    timeout: runOpts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    signal: runOpts.signal,
  };

  let stdout: string;
  let stderr: string;
  try {
    const result = await exec(command, execOpts);
    stdout = typeof result.stdout === 'string' ? result.stdout : result.stdout?.toString() ?? '';
    stderr = typeof result.stderr === 'string' ? result.stderr : result.stderr?.toString() ?? '';
  } catch (e) {
    throw translateDivineError(
      e as IExecErrorShape,
      action,
      runOpts.signal?.aborted ?? false,
    );
  }

  // exec succeeded (exit 0) but divine may still have reported a problem:
  // failures show up on stdout (or occasionally stderr) with a bracketed
  // [ERROR]/[FATAL] marker rather than via non-zero exit.
  const pakInvalid = classifyPakInvalid(stdout, stderr);
  if (pakInvalid !== undefined) {
    throw pakInvalid;
  }
  if (stderr) {
    // Non-bracketed stderr on exit 0 — unusual but surface it anyway.
    throw new Error(`divine.exe failed: ${stderr.trim()}`);
  }
  if (!stdout && action !== 'list-package') {
    return { stdout: '', returnCode: 2 };
  }
  return { stdout, returnCode: 0 };
}

export async function listPackageCore(
  exePath: string,
  pakPath: string,
  runOpts: IDivineRunOptions = {},
): Promise<string[]> {
  const res = await runDivineCore(exePath, 'list-package', { source: pakPath }, runOpts);
  return parsePackageListOutput(res.stdout);
}

export async function extractPakCore(
  exePath: string,
  pakPath: string,
  destPath: string,
  pattern: string,
  runOpts: IDivineRunOptions = {},
): Promise<IDivineOutput> {
  return runDivineCore(
    exePath,
    'extract-package',
    { source: pakPath, destination: destPath, expression: pattern },
    runOpts,
  );
}
