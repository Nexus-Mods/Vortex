import path from 'path';
import { Dirent, readdirSync, readFileSync } from 'node:fs';
import { FileHandle, open, readdir } from 'node:fs/promises';
import { NativeFileSystem, types as vetypes, allocWithoutOwnership } from 'fomod-installer-native';

export class VortexModInstallerFileSystem {
  private mFileSystem: NativeFileSystem;

  public constructor() {
    this.mFileSystem = new NativeFileSystem(
      this.readFileContent,
      this.readDirectoryFileList,
      this.readDirectoryList
    );
  }

  public useVortexFuntions() {
    this.mFileSystem.setCallbacks();
  }

  public useLibraryFunctions() {
    NativeFileSystem.setDefaultCallbacks();
  }

  /**
   * Callback
   */
  private readFileContent = (filePath: string, offset: number, length: number): Uint8Array | null => {
    try {
      if (offset === 0 && length === -1) {
        const data = readFileSync(filePath);
        return new Uint8Array(data);
      } else if (offset >= 0 && length > 0) {
        // TODO: read the chunk we actually need, but there's no readFile()
        //const fd = fs.openSync(filePath, 'r');
        //const buffer = Buffer.alloc(length);
        //fs.readSync(fd, buffer, offset, length, 0);
        return new Uint8Array(readFileSync(filePath)).slice(offset, offset + length);
      } else {
        return null;
      }
    } catch {
      return null;
    }
  };

  /**
   * Callback
   */
  private readDirectoryFileList = (directoryPath: string): string[] | null => {
    try {
      return readdirSync(directoryPath, { withFileTypes: true })
        .filter((x: Dirent) => x.isFile())
        .map<string>((x: Dirent) => path.join(directoryPath, x.name));
    } catch {
      return null;
    }
  };

  /**
   * Callback
   */
  private readDirectoryList = (directoryPath: string): string[] | null => {
    try {
      return readdirSync(directoryPath, { withFileTypes: true })
        .filter((x: Dirent) => x.isDirectory())
        .map<string>((x: Dirent) => path.join(directoryPath, x.name));
    } catch {
      return null;
    }
  };

  /**
   * Callback
   */
  private readFileContentAsync = async (
    filePath: string,
    offset: number,
    length: number
  ): Promise<Uint8Array | null> => {
    try {
      let fileHandle: FileHandle | null = null;
      try {
        fileHandle = await open(filePath, 'r');
        if (length === -1) {
          const stats = await fileHandle.stat();
          length = stats.size;
        }
        const buffer = allocWithoutOwnership(length) ?? new Uint8Array(length);
        await fileHandle.read(buffer, 0, length, offset);
        return buffer;
      } finally {
        await fileHandle?.close();
      }
    } catch (err) {
      // ENOENT means that a file or folder is not found, it's an expected error
      if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
        return null;
      }
      //const { localize: t } = LocalizationManager.getInstance(this.api);
      //this.api.showErrorNotification?.(t('Error reading file content'), err);
    }
    return null;
  };

  /**
   * Callback
   */
  private readDirectoryFileListAsync = async (directoryPath: string): Promise<string[] | null> => {
    try {
      const dirs = await readdir(directoryPath, { withFileTypes: true });
      const res = dirs.filter((x) => x.isFile()).map<string>((x) => path.join(directoryPath, x.name));
      return res;
    } catch (err) {
      // ENOENT means that a file or folder is not found, it's an expected error
      if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
        return null;
      }
      //const { localize: t } = LocalizationManager.getInstance(this.api);
      //this.api.showErrorNotification?.(t('Error reading directory file list'), err);
    }
    return null;
  };

  /**
   * Callback
   */
  private readDirectoryListAsync = async (directoryPath: string): Promise<string[] | null> => {
    try {
      const dirs = await readdir(directoryPath, { withFileTypes: true });
      const res = dirs.filter((x) => x.isDirectory()).map<string>((x) => path.join(directoryPath, x.name));
      return res;
    } catch (err) {
      // ENOENT means that a file or folder is not found, it's an expected error
      if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
        return null;
      }
      //const { localize: t } = LocalizationManager.getInstance(this.api);
      //this.api.showErrorNotification?.(t('Error reading directory list'), err);
    }
    return null;
  };
}