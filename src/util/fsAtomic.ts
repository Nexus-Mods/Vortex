import * as fs from './fs';
import * as Promise from 'bluebird';
import { file } from 'tmp';
import { createHash } from 'crypto';
import { log } from './log';

export function checksum(input: Buffer): string {
  return createHash('md5')
    .update(input)
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

export function writeFileAtomic(filePath: string, input: string | Buffer) {
  return writeFileAtomicImpl(filePath, input, 3);
}

function writeFileAtomicImpl(filePath: string, input: string | Buffer, attempts: number) {
  const stackErr = new Error();
  let cleanup: () => void;
  let tmpPath: string;
  const buf: Buffer = input instanceof Buffer
    ? input
    : Buffer.from(input);

  const hash = checksum(buf);
  return new Promise<number>((resolve, reject) => {
    file({ template: `${filePath}.XXXXXX.tmp` },
         (err: any, genPath: string, fd: number, cleanupCB: () => void) => {
      if (err) {
        return reject(err);
      }
      cleanup = cleanupCB;
      tmpPath = genPath;
      resolve(fd);
    });
  })
  .then(fd => {
    return fs.writeAsync(fd, buf, 0, buf.byteLength, 0)
      .then(() => fs.closeAsync(fd));
  })
  .then(() => fs.readFileAsync(tmpPath))
  .then(data => (checksum(data) !== hash)
      ? attempts > 0
        // retry
        ? writeFileAtomicImpl(filePath, input, attempts - 1)
        : Promise.reject(new Error('Write failed, checksums differ'))
      : Promise.resolve())
  .then(() => fs.renameAsync(tmpPath, filePath)
    .then(() => {
      cleanup = undefined;
    })
    .catch({ code: 'EEXIST' }, () =>
      // renameAsync is supposed to overwrite so this is likely to fail as well
      fs.removeAsync(filePath).then(() => fs.renameAsync(tmpPath, filePath))))
  .catch(err => {
    err.stack = err.message + '\n' + stackErr.stack;
    return Promise.reject(err);
  })
  .finally(() => {
    if (cleanup !== undefined) {
      try {
        cleanup();
      } catch (err) {
        log('error', 'failed to clean up temporary file', err.message);
      }
    }
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

