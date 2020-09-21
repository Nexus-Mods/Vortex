import * as fs from './fs';
import { log } from './log';

import Promise from 'bluebird';
import { createHash } from 'crypto';
import { file } from 'tmp';

export function checksum(input: Buffer): string {
  return createHash('md5')
    .update(input || '')
    .digest('hex');
}

export function fileMD5(filePath: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('readable', () => {
      const data = stream.read();
      if (data) {
        hash.update(data);
      }
    });
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

export function writeFileAtomic(filePath: string, input: string | Buffer): Promise<void> {
  return writeFileAtomicImpl(filePath, input, 3);
}

function writeFileAtomicImpl(filePath: string,
                             input: string | Buffer,
                             attempts: number): Promise<void> {
  const stackErr = new Error();
  let cleanup: () => void;
  let tmpPath: string;
  const buf: Buffer = input instanceof Buffer
    ? input
    : Buffer.from(input);

  const callCleanup = () => {
    if (cleanup !== undefined) {
      try {
        cleanup();
      } catch (err) {
        log('error', 'failed to clean up temporary file', err.message);
      }

      cleanup = undefined;
    }
  };

  const hash = checksum(buf);
  let fd = -1;
  return fs.withTmpFile((fdIn: number, pathIn: string) => {
    fd = fdIn;
    tmpPath = pathIn;
    return fs.writeAsync(fd, buf, 0, buf.byteLength, 0)
      .then(() => fs.fsyncAsync(fd).catch(() => Promise.resolve()))
      .then(() => fs.closeAsync(fd).catch(() => Promise.resolve()));
  }, {
    cleanup: false,
    template: `${filePath}.XXXXXX.tmp`,
  })
    .then(() => fs.readFileAsync(tmpPath))
    .catch({ code: 'EBADF' }, () => {
      log('warn', 'failed to access temporary file', {
        filePath,
        fd,
      });
      return Promise.resolve(undefined);
    })
    .then(data => {
      if ((data === undefined) || (checksum(data) !== hash)) {
        callCleanup();
        return (attempts > 0)
          // retry
          ? writeFileAtomicImpl(filePath, input, attempts - 1)
          : Promise.reject(new Error('Write failed, checksums differ'));
      } else {
        return fs.renameAsync(tmpPath, filePath)
          .catch({ code: 'EEXIST' }, () =>
            // renameAsync is supposed to overwrite so this is likely to fail as well
            fs.removeAsync(filePath).then(() => fs.renameAsync(tmpPath, filePath)));
      }
    })
    .catch(err => {
      err.stack = err.stack + '\n' + stackErr.stack;
      return Promise.reject(err);
    })
    .finally(() => {
      callCleanup();
    });
}

/**
 * copy a file in such a way that it will not replace the target if the copy is
 * somehow interrupted. The file is first copied to a temporary file in the same
 * directory as the destination, then deletes the destination and renames the temp
 * to destination. Since the rename is atomic and the deletion only happens after
 * a successful write this should minimize the risk of error.
 *
 * @export
 * @param {string} srcPath
 * @param {string} destPath
 * @returns {Promise<void>}
 */
export function copyFileAtomic(srcPath: string,
                               destPath: string): Promise<void> {
  let cleanup: () => void;
  let tmpPath: string;
  return new Promise((resolve, reject) => {
           file({template: `${destPath}.XXXXXX.tmp`},
                (err: any, genPath: string, fd: number,
                 cleanupCB: () => void) => {
                  if (err) {
                    return reject(err);
                  }
                  cleanup = cleanupCB;
                  tmpPath = genPath;
                  resolve(fd);
                });
         })
      .then((fd: number) => fs.closeAsync(fd))
      .then(() => fs.copyAsync(srcPath, tmpPath))
      .then(() => fs.unlinkAsync(destPath).catch((err) => {
        if (err.code === 'EPERM') {
          // if the file is currently in use, try a second time
          // 100ms later
          log('debug', 'file locked, retrying delete', destPath);
          return Promise.delay(100).then(() => fs.unlinkAsync(destPath));
        } else if (err.code === 'ENOENT') {
          // file doesn't exist anyway? no problem
          return Promise.resolve();
        } else {
          return Promise.reject(err);
        }
      }))
      .catch(err => err.code === 'ENOENT' ? Promise.resolve() : Promise.reject(err))
      .then(() => (tmpPath !== undefined)
          ? fs.renameAsync(tmpPath, destPath)
          : Promise.resolve())
      .catch(err => {
        log('info', 'failed to copy', {srcPath, destPath, err: err.stack});
        if (cleanup !== undefined) {
          try {
            cleanup();
          } catch (cleanupErr) {
            log('error', 'failed to clean up temporary file', cleanupErr.message);
          }
        }
        return Promise.reject(err);
      });
}
