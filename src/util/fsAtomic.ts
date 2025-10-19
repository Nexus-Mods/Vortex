import { checksum } from './checksum';
import * as fs from './fs';
import { log } from './log';
import * as nodeFS from 'fs';
import { file } from 'tmp';

export function writeFileAtomic(filePath: string, input: string | Buffer): Promise<void> {
    return writeFileAtomicImpl(filePath, input, 3);
}

function writeFileAtomicImpl(filePath: string, input: string | Buffer, attempts: number): Promise<void> {
    const stackErr = new Error();
    let cleanup: (() => void) | undefined;
    let tmpPath: string | undefined;
    const buf: Buffer = input instanceof Buffer ? input : Buffer.from(input);
    const hash = checksum(buf);

    const finalizeCleanup = async (): Promise<void> => {
        if (cleanup !== undefined) {
            try {
                cleanup();
            } catch (err: any) {
                log('error', 'failed to clean up temporary file', err?.message ?? String(err));
            } finally {
                cleanup = undefined;
            }
        } else if (tmpPath !== undefined) {
            try {
                await fs.unlinkAsync(tmpPath);
            } catch {
                // ignore
            } finally {
                tmpPath = undefined;
            }
        }
    };

    return new Promise<number>((resolve, reject) => {
        file({ template: `${filePath}.XXXXXX.tmp` }, (err: any, genPath: string, fd: number, cleanupCB: () => void) => {
            if (err) return reject(err);
            tmpPath = genPath;
            cleanup = cleanupCB;
            resolve(fd);
        });
    })
        .then((fd: number) => fs.writeAsync(fd, buf, 0, buf.byteLength, 0)
            .then(() => fs.fsyncAsync(fd).catch(() => Promise.resolve()))
            .then(() => fs.closeAsync(fd).catch(() => Promise.resolve()))
        )
        .then(async () => {
            if (tmpPath === undefined) {
                throw new Error('Temporary file path was not created');
            }
            const data = await fs.readFileAsync(tmpPath);
            if (checksum(data) !== hash) {
                await finalizeCleanup();
                if (attempts > 0) {
                    return writeFileAtomicImpl(filePath, input, attempts - 1);
                } else {
                    throw new Error('Write failed, checksums differ');
                }
            }
        })
        .then(async () => {
            if (tmpPath === undefined) return;
            try {
                await fs.renameAsync(tmpPath, filePath);
                tmpPath = undefined; // renamed, no need to unlink in finally
            } catch (err: any) {
                if (err?.code === 'EEXIST') {
                    try {
                        await fs.removeAsync(filePath);
                    } catch {
                        // ignore, try rename anyway
                    }
                    await fs.renameAsync(tmpPath, filePath);
                    tmpPath = undefined;
                } else {
                    throw err;
                }
            }
        })
        .catch((err: any) => {
            err.stack = (err.stack ?? '') + '\n' + (stackErr.stack ?? '');
            return Promise.reject(err);
        })
        .finally(() => {
            return finalizeCleanup();
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
export function copyFileAtomic(srcPath: string, destPath: string): Promise<void> {
    let cleanup: (() => void) | undefined;
    let tmpPath: string | undefined;
    return new Promise<number>((resolve, reject) => {
        file({ template: `${destPath}.XXXXXX.tmp` },
            (err: any, genPath: string, fd: number, cleanupCB: () => void) => {
                if (err) return reject(err);
                cleanup = cleanupCB;
                tmpPath = genPath;
                resolve(fd);
            });
    })
        .then((fd: number) => fs.closeAsync(fd))
        .then(() => {
            if (tmpPath === undefined) throw new Error('Temporary file path was not created');
            return fs.copyAsync(srcPath, tmpPath);
        })
        .then(() => fs.unlinkAsync(destPath).catch((err: any) => {
            if (err.code === 'EPERM') {
                log('debug', 'file locked, retrying delete', destPath);
                return delay(100).then(() => fs.unlinkAsync(destPath));
            } else if (err.code === 'ENOENT') {
                return Promise.resolve();
            } else {
                return Promise.reject(err);
            }
        }))
        .catch((err: any) => err.code === 'ENOENT' ? Promise.resolve() : Promise.reject(err))
        .then(() => (tmpPath !== undefined) ? fs.renameAsync(tmpPath, destPath) : Promise.resolve())
        .catch((err: any) => {
            log('info', 'failed to copy', { srcPath, destPath, err: err.stack });
            if (cleanup !== undefined) {
                try {
                    cleanup();
                } catch (cleanupErr: any) {
                    log('error', 'failed to clean up temporary file', cleanupErr.message);
                }
            }
            return Promise.reject(err);
        });
}

/**
 * Perform an atomic copy using APFS clone where possible on macOS.
 * Falls back to regular copy if clone is unsupported or cross-volume.
 */
export function copyFileCloneAtomic(srcPath: string, destPath: string): Promise<void> {
    const canTryClone = (process.platform === 'darwin');
    let cleanup: (() => void) | undefined;
    let tmpPath: string | undefined;

    return new Promise<number>((resolve, reject) => {
        file({ template: `${destPath}.XXXXXX.tmp` },
            (err: any, genPath: string, fd: number, cleanupCB: () => void) => {
                if (err) return reject(err);
                cleanup = cleanupCB;
                tmpPath = genPath;
                resolve(fd);
            });
    })
        .then((fd: number) => fs.closeAsync(fd))
        .then(async () => {
            if (tmpPath === undefined) throw new Error('Temporary file path was not created');
            if (canTryClone) {
                const ficlone = ((nodeFS.constants as any)?.COPYFILE_FICLONE ?? 0) as number;
                try {
                    await nodeFS.promises.copyFile(srcPath, tmpPath, ficlone);
                } catch {
                    await fs.copyAsync(srcPath, tmpPath);
                }
            } else {
                await fs.copyAsync(srcPath, tmpPath);
            }
        })
        .then(() => fs.unlinkAsync(destPath).catch((err: any) => {
            if (err.code === 'EPERM') {
                log('debug', 'file locked, retrying delete', destPath);
                return delay(100).then(() => fs.unlinkAsync(destPath));
            } else if (err.code === 'ENOENT') {
                return Promise.resolve();
            } else {
                return Promise.reject(err);
            }
        }))
        .catch((err: any) => err.code === 'ENOENT' ? Promise.resolve() : Promise.reject(err))
        .then(() => (tmpPath !== undefined) ? fs.renameAsync(tmpPath, destPath) : Promise.resolve())
        .catch((err: any) => {
            log('info', 'failed to clone-copy', { srcPath, destPath, err: err.stack });
            if (cleanup !== undefined) {
                try {
                    cleanup();
                } catch (cleanupErr: any) {
                    log('error', 'failed to clean up temporary file', cleanupErr.message);
                }
            }
            return Promise.reject(err);
        });
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
