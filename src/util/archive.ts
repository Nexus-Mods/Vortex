import * as path from 'path';
import { spawn } from 'child_process';
import ZipT = require('node-7z');
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
  const proc = spawn('tar', [...args, archivePath, '-C', destPath]);
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
  const SevenZip: typeof ZipT = require('node-7z');
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
        await SevenZip.extractFull(archivePath, destPath, { ssc, password }, () => undefined, () => undefined);
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
  const SevenZip: typeof ZipT = require('node-7z');
  const maxAttempts = 3;
  const baseDelay = 500;
  const ssw = options?.ssw ?? true;

  const attempt = async (n: number): Promise<void> => {
    try {
      await SevenZip.add(destArchive, files, { ssw });
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