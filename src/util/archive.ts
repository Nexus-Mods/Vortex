import * as path from 'path';
import * as fs from 'fs';
import { spawn, spawnSync } from 'child_process';
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

function isZipArchive(archivePath: string): boolean {
  const lower = archivePath.toLowerCase();
  return lower.endsWith('.zip');
}

function isSevenZArchive(archivePath: string): boolean {
  const lower = archivePath.toLowerCase();
  return lower.endsWith('.7z');
}

function isRarArchive(archivePath: string): boolean {
  const lower = archivePath.toLowerCase();
  return lower.endsWith('.rar');
}

// Read a small magic header from the file to detect actual format
function readMagicHeader(archivePath: string): Buffer {
  try {
    const fd = fs.openSync(archivePath, 'r');
    const buf = Buffer.alloc(8);
    fs.readSync(fd, buf, 0, 8, 0);
    fs.closeSync(fd);
    return buf;
  } catch (_) {
    return Buffer.alloc(0);
  }
}

function isZipMagic(buf: Buffer): boolean {
  // ZIP files commonly start with 'PK\x03\x04' or 'PK\x05\x06' (empty archive)
  return buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4B;
}

function is7zMagic(buf: Buffer): boolean {
  // 7z magic: 37 7A BC AF 27 1C
  return buf.length >= 6
    && buf[0] === 0x37 && buf[1] === 0x7A && buf[2] === 0xBC
    && buf[3] === 0xAF && buf[4] === 0x27 && buf[5] === 0x1C;
}

function isRarMagic(buf: Buffer): boolean {
  // RAR magic: 52 61 72 21 ('Rar!') possibly followed by 0x1A 0x07 0x00
  return buf.length >= 4
    && buf[0] === 0x52 && buf[1] === 0x61 && buf[2] === 0x72 && buf[3] === 0x21;
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

function extractWithBSDTar(archivePath: string, destPath: string): Promise<void> {
  // Use bsdtar (libarchive) which ships on macOS and can read many formats including 7z/rar
  const args = ['-x', '-f', archivePath, '-C', destPath];
  const bsdtarPath = resolveToolPathSync('bsdtar') || 'bsdtar';
  const proc = spawn(bsdtarPath, args);
  return new Promise<void>((resolve, reject) => {
    let stderr = '';
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('error', err => reject(err));
    proc.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        const err = new Error(`bsdtar exited with code ${code}: ${stderr}`);
        reject(err);
      }
    });
  });
}

function extractWithDittoZip(archivePath: string, destPath: string): Promise<void> {
  // On macOS, ditto is robust for zip extraction (handles resource forks/symlinks)
  const dittoPath = resolveToolPathSync('ditto') || 'ditto';
  const proc = spawn(dittoPath, ['-x', '-k', archivePath, destPath]);
  return new Promise<void>((resolve, reject) => {
    let stderr = '';
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('error', err => reject(err));
    proc.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        const err = new Error(`ditto exited with code ${code}: ${stderr}`);
        reject(err);
      }
    });
  });
}

function extractWithUnzip(archivePath: string, destPath: string): Promise<void> {
  // Use unzip as a secondary native fallback; -X ignores extra file attributes
  const unzipPath = resolveToolPathSync('unzip') || 'unzip';
  const proc = spawn(unzipPath, ['-o', '-qq', '-X', archivePath, '-d', destPath]);
  return new Promise<void>((resolve, reject) => {
    let stderr = '';
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('error', err => reject(err));
    proc.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        const err = new Error(`unzip exited with code ${code}: ${stderr}`);
        reject(err);
      }
    });
  });
}

function resolveToolPathSync(cmd: string): string | undefined {
  try {
    const res = spawnSync('which', [cmd], { encoding: 'utf8' });
    if (res && res.status === 0) {
      const p = (res.stdout || '').toString().trim();
      if (p && fs.existsSync(p)) {
        return p;
      }
    }
  } catch (_) { /* ignore */ }
  // Common Homebrew locations on macOS for tools
  if (process.platform === 'darwin') {
    const candidates: Record<string, string[]> = {
      'unar': ['/opt/homebrew/bin/unar', '/usr/local/bin/unar'],
      '7z': ['/opt/homebrew/bin/7z', '/usr/local/bin/7z'],
      'bsdtar': ['/usr/bin/bsdtar'],
      'unzip': ['/usr/bin/unzip'],
      'ditto': ['/usr/bin/ditto'],
    };
    const list = candidates[cmd];
    if (list) {
      for (const cand of list) {
        try {
          if (fs.existsSync(cand)) {
            return cand;
          }
        } catch (_) { /* ignore */ }
      }
    }
  }
  return undefined;
}

function extractWithUnar(archivePath: string, destPath: string): Promise<void> {
  // Use 'unar' (The Unarchiver) if available; supports 7z/rar and more
  // Options: -quiet, -force-overwrite, -no-directory, -output dest
  const args = ['-quiet', '-force-overwrite', '-no-directory', '-output', destPath, archivePath];
  const unarPath = resolveToolPathSync('unar') || 'unar';
  const proc = spawn(unarPath, args);
  return new Promise<void>((resolve, reject) => {
    let stderr = '';
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('error', err => reject(err));
    proc.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        const err = new Error(`unar exited with code ${code}: ${stderr}`);
        reject(err);
      }
    });
  });
}

function toolAvailableSync(cmd: string, args: string[] = ['--version']): boolean {
  const resolved = resolveToolPathSync(cmd) || cmd;
  try {
    const res = spawnSync(resolved, args, { stdio: 'ignore' });
    // If the tool exists, spawnSync should return a status (0 or non-zero).
    // ENOENT cases will typically throw or have an error; we treat those as not available.
    return typeof res.status === 'number';
  } catch (_) {
    return false;
  }
}

function getPackaged7zPathSync(): string | undefined {
  try {
    // Try 7zip-bin first
    const sevenZipBin = require('7zip-bin');
    const candidate = sevenZipBin?.path7za || sevenZipBin;
    if (candidate && typeof candidate === 'string') {
      try {
        fs.statSync(candidate);
        try { fs.chmodSync(candidate, 0o755 as any); } catch (_) { /* ignore */ }
        return candidate;
      } catch (_) { /* ignore */ }
    }
  } catch (_) { /* ignore */ }
  try {
    // Fallback to 7z-bin if present
    const sevenZBin = require('7z-bin');
    const candidate = sevenZBin?.path7za || sevenZBin;
    if (candidate && typeof candidate === 'string') {
      try {
        fs.statSync(candidate);
        try { fs.chmodSync(candidate, 0o755 as any); } catch (_) { /* ignore */ }
        return candidate;
      } catch (_) { /* ignore */ }
    }
  } catch (_) { /* ignore */ }
  return undefined;
}

function extractWithPackaged7z(archivePath: string, destPath: string): Promise<void> {
  const bin = getPackaged7zPathSync();
  if (!bin) {
    return Promise.reject(new Error('No bundled 7z binary available'));
  }
  const args = ['x', '-y', archivePath, `-o${destPath}`];
  const proc = spawn(bin, args);
  return new Promise<void>((resolve, reject) => {
    let stderr = '';
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('error', err => reject(err));
    proc.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        const err = new Error(`bundled 7z exited with code ${code}: ${stderr}`);
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
      const magic = readMagicHeader(archivePath);
      const zipByMagic = isZipMagic(magic);
      const sevenZByMagic = is7zMagic(magic);
      const rarByMagic = isRarMagic(magic);

      // Multi-part detection (simple heuristic): suggest selecting the first part
      const base = path.basename(archivePath).toLowerCase();
      const isMultipartRar = base.match(/\.part(\d+)\.rar$/) || base.endsWith('.r00');
      const isMultipartSevenZ = base.match(/\.7z\.(\d{3})$/) || base.endsWith('.7z.001');
      if (isMultipartRar || isMultipartSevenZ) {
        // Enforce selecting the first part to avoid extraction errors
        const matchRar = base.match(/\.part(\d+)\.rar$/);
        const match7z = base.match(/\.7z\.(\d{3})$/);
        const isFirstRar = matchRar ? (matchRar[1] === '1') : base.endsWith('.r00');
        const isFirst7z = match7z ? (match7z[1] === '001') : base.endsWith('.7z.001');
        const isFirstPart = isMultipartRar ? isFirstRar : isFirst7z;
        if (!isFirstPart) {
          const hint = 'Select the first part of the multi-part archive (e.g., .part1.rar or .7z.001).';
          log('error', 'Wrong multi-part archive segment selected', { archivePath, hint });
          throw new Error('Wrong multi-part archive segment selected. ' + hint);
        }
        // Optional: check if next part exists to warn early
        try {
          const dir = path.dirname(archivePath);
          const stem = isMultipartRar
            ? base.replace(/\.part\d+\.rar$/, '')
            : base.replace(/\.7z\.\d{3}$/, '');
          const nextPart = isMultipartRar ? path.join(dir, `${stem}.part2.rar`) : path.join(dir, `${stem}.7z.002`);
          if (!fs.existsSync(nextPart)) {
            log('warn', 'Next part of multi-part archive not found', { expectedNextPart: nextPart });
          }
        } catch (e) {
          // Non-fatal; continue
        }
      }

      if (isTarArchive(archivePath) && (process.platform === 'darwin' || process.platform === 'linux')) {
        log('info', 'Using tar extractor for archive', { archivePath, destPath, platform: process.platform });
        await extractWithTar(archivePath, destPath);
      } else if (process.platform === 'darwin' && (isZipArchive(archivePath) || zipByMagic)) {
        // Prefer native macOS extraction for zip archives to avoid 7z quirks on macOS
        const hasDitto = toolAvailableSync('ditto', ['-v']);
        const hasUnzip = toolAvailableSync('unzip');
        log('info', 'Using macOS zip extractor', { archivePath, destPath, detectedZip: zipByMagic, hasDitto, hasUnzip });
        try {
          if (hasDitto) {
            await extractWithDittoZip(archivePath, destPath);
          } else if (hasUnzip) {
            await extractWithUnzip(archivePath, destPath);
          } else {
            log('warn', 'No native zip tools available; falling back to node-7z');
            throw new Error('No native zip tools');
          }
        } catch (dittoErr) {
          if (hasUnzip) {
            log('warn', 'macOS zip extraction failed with ditto, trying unzip fallback', { error: (dittoErr as Error)?.message });
            await extractWithUnzip(archivePath, destPath);
          } else {
            log('warn', 'zip extraction failed and unzip not available; falling back to node-7z', { error: (dittoErr as Error)?.message });
            throw dittoErr;
          }
        }
      } else if (process.platform === 'darwin' && (isSevenZArchive(archivePath) || sevenZByMagic || isRarArchive(archivePath) || rarByMagic)) {
        // Use native macOS tools for 7z/rar where possible; avoid node-7z
        const type = (isSevenZArchive(archivePath) || sevenZByMagic) ? '7z' : 'rar';
        const packaged7zPath = getPackaged7zPathSync();
        const hasBSDTar = toolAvailableSync('bsdtar', ['--version']);
        const hasUnar = toolAvailableSync('unar', ['-version']);
        log('info', 'Using macOS native extractor for archive', { archivePath, destPath, type, hasBSDTar, hasUnar, packaged7zAvailable: !!packaged7zPath, packaged7zPath });
        try {
          if (hasBSDTar) {
            await extractWithBSDTar(archivePath, destPath);
          } else if (hasUnar) {
            await extractWithUnar(archivePath, destPath);
          } else if (packaged7zPath) {
            await extractWithPackaged7z(archivePath, destPath);
          } else {
            const hint = 'On macOS, install native extractors via Homebrew: "brew install unar" for RAR/7z support or "brew install p7zip".';
            log('error', 'No suitable macOS extractors available', { archivePath, destPath, hint });
            throw new Error('No macOS extractors available');
          }
        } catch (bsdtarErr) {
          if (hasUnar) {
            log('warn', 'bsdtar extraction failed, trying unar fallback', { error: (bsdtarErr as Error)?.message });
            try {
              await extractWithUnar(archivePath, destPath);
            } catch (unarErr) {
              if (packaged7zPath) {
                log('warn', 'unar extraction failed, trying bundled 7z CLI fallback', { error: (unarErr as Error)?.message });
                try {
                  await extractWithPackaged7z(archivePath, destPath);
                } catch (packErr) {
                  const hint = 'On macOS, install native extractors via Homebrew: "brew install unar" for RAR/7z support or "brew install p7zip".';
                  log('error', 'macOS native extraction failed', { archivePath, destPath, error: (packErr as Error)?.message, hint });
                  throw packErr;
                }
              } else {
                const hint = 'On macOS, install native extractors via Homebrew: "brew install unar" for RAR/7z support or "brew install p7zip".';
                log('error', 'No unar or bundled 7z available for extraction', { archivePath, destPath, error: (unarErr as Error)?.message, hint });
                throw unarErr;
              }
            }
          } else if (packaged7zPath) {
            log('warn', 'bsdtar extraction failed and unar not available, trying bundled 7z CLI', { error: (bsdtarErr as Error)?.message });
            await extractWithPackaged7z(archivePath, destPath);
          } else {
            const hint = 'On macOS, install native extractors via Homebrew: "brew install unar" for RAR/7z support or "brew install p7zip".';
            log('error', 'No suitable macOS extractors available (bsdtar unavailable, unar unavailable, no bundled 7z)', { archivePath, destPath, error: (bsdtarErr as Error)?.message, hint });
            throw bsdtarErr;
          }
        }
      } else {
        log('info', 'Using node-7z extractor for archive', { archivePath, destPath, ssc, platform: process.platform });
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