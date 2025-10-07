import * as path from 'path';
import { spawn } from 'child_process';
// NOTE: node-7z can export either functions (extractFull, add)
// or a default class with instance methods depending on platform/mocks.
// We normalize here to a functional API and await the stream completion.
import { log } from './log';

type ExtractOptions = { ssc?: boolean, password?: string };
type AddOptions = { ssw?: boolean };

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function isTarArchive(archivePath: string): boolean {
  const lower = archivePath.toLowerCase();
  return lower.endsWith('.tar') || lower.endsWith('.tar.gz') || lower.endsWith('.tgz');
}

function extractWithTar(archivePath: string, destPath: string): Promise<void> {
  const lower = archivePath.toLowerCase();
  const args = ['-xf'];
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
    args[0] = '-xzf';
  }
  // Exclude macOS metadata and disable extended attributes/xattrs restoration
  const exclude = ['--exclude=__MACOSX', '--exclude=*/__MACOSX/*'];
  const xattrs = process.platform === 'darwin' ? ['--no-xattrs'] : [];
  const proc = spawn('tar', [...args, archivePath, '-C', destPath, ...exclude, ...xattrs]);
  return new Promise<void>((resolve, reject) => {
    let stderr = '';
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('error', err => reject(err));
    proc.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        const err = new Error(`tar exited with code ${code}: ${stderr}`);
        reject(err);
      }
    });
  });
}

export function extractArchive(archivePath: string, destPath: string, options?: ExtractOptions): Promise<void> {
  const SevenZipMod = require('node-7z');
  const getExtract = () => {
    if (SevenZipMod && typeof SevenZipMod.extractFull === 'function') {
      return SevenZipMod.extractFull as (a: string, d: string, o?: any) => { promise?: () => Promise<void>, on: Function };
    }
    const Ctor = SevenZipMod?.default ?? SevenZipMod;
    if (typeof Ctor === 'function') {
      const inst = new Ctor();
      return (a: string, d: string, o?: any) => inst.extractFull(a, d, o);
    }
    throw new Error('node-7z module does not provide extractFull');
  };
  const maxAttempts = 3;
  const baseDelay = 500;
  const ssc = options?.ssc ?? false;
  const password = options?.password;

  const attempt = async (n: number): Promise<void> => {
    try {
      if (isTarArchive(archivePath) && (process.platform === 'darwin' || process.platform === 'linux')) {
        log('info', 'Using tar extractor for archive', { archivePath, destPath });
        await extractWithTar(archivePath, destPath);
      } else {
        log('info', 'Using node-7z extractor for archive', { archivePath, destPath, ssc });
        const extract = getExtract();
        const stream = extract(archivePath, destPath, { ssc, password });
        // Wait for completion. If node-7z exposes promise(), await it; otherwise
        // wrap the EventEmitter and wait for 'end' or 'error'. This prevents
        // continuing before extraction finishes, especially on macOS.
        if (typeof stream?.promise === 'function') {
          await stream.promise();
        } else if (typeof stream?.on === 'function') {
          await new Promise<void>((resolve, reject) => {
            let finished = false;
            try {
              stream.on('end', () => {
                finished = true;
                resolve();
              });
              stream.on('error', (err: any) => {
                if (!finished) {
                  reject(err);
                }
              });
            } catch (err) {
              reject(err as any);
            }
          });
        } else {
          // If we get here, the module returned an unexpected type; fail clearly
          throw new Error('node-7z extract did not provide a promise or EventEmitter');
        }
      }
    } catch (err) {
      if (n >= maxAttempts) {
        log('error', 'Archive extraction failed after max attempts', { archivePath, destPath, error: (err as Error)?.message });
        throw err;
      }
      const delayMs = Math.min(baseDelay * Math.pow(2, n - 1), 4000);
      log('warn', 'Archive extraction failed, retrying with backoff', { attempt: n, delayMs, error: (err as Error)?.message });
      await delay(delayMs);
      return attempt(n + 1);
    }
  };

  return attempt(1);
}

export function addToArchive(destArchive: string, files: string[], options?: AddOptions): Promise<void> {
  const SevenZipMod = require('node-7z');
  const getAdd = () => {
    if (SevenZipMod && typeof SevenZipMod.add === 'function') {
      return SevenZipMod.add as (a: string, f: string[], o?: any) => { promise?: () => Promise<void>, on: Function };
    }
    const Ctor = SevenZipMod?.default ?? SevenZipMod;
    if (typeof Ctor === 'function') {
      const inst = new Ctor();
      return (a: string, f: string[], o?: any) => inst.add(a, f, o);
    }
    throw new Error('node-7z module does not provide add');
  };
  const maxAttempts = 3;
  const baseDelay = 500;
  const ssw = options?.ssw ?? true;

  const attempt = async (n: number): Promise<void> => {
    try {
      const add = getAdd();
      const stream = add(destArchive, files, { ssw });
      if (typeof stream?.promise === 'function') {
        await stream.promise();
      }
    } catch (err) {
      if (n >= maxAttempts) {
        log('error', 'Archive creation failed after max attempts', { destArchive, error: (err as Error)?.message });
        throw err;
      }
      const delayMs = Math.min(baseDelay * Math.pow(2, n - 1), 4000);
      log('warn', 'Archive creation failed, retrying with backoff', { attempt: n, delayMs, error: (err as Error)?.message });
      await delay(delayMs);
      return attempt(n + 1);
    }
  };

  return attempt(1);
}