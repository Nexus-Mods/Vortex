import { IExtensionContext, IDeploymentMethod, IDeployedFile, IUnavailableReason, IExtensionApi } from '../../types/api';
import { IGame } from '../../types/IGame';
import { fs, log } from 'vortex-api';
import { isMacOS, getAppDataPath } from '../../util/platform';
import { MacOSAdminAccessManager } from '../../util/macOSAdminAccess';
import { TFunction } from '../../util/i18n';
import { Normalize } from '../../util/getNormalizeFunc';
import { IFileChange } from '../mod_management/types/IDeploymentMethod';
import * as path from 'path';
// TODO: Remove Bluebird import - using native Promise;
import { copyFileCloneAtomic } from '../../util/fsAtomic';
import { promiseMap } from '../../util/bluebird-migration-helpers.local';

// Interface for tracking deployed files
interface IDeployedFileRecord {
  sourcePath: string;
  targetPath: string;
  relPath: string;
  sourceName: string;
}

// Global registry to track deployed files by mod
const deployedFiles: { [modName: string]: IDeployedFileRecord[] } = {};

class DeploymentMethod implements IDeploymentMethod {
  public id: string = 'copy_activator';
  public name: string = 'Copy Files (macOS)';
  public description: string = 'Copies mod files directly to the game directory. Recommended for macOS.';
  public priority: number = isMacOS() ? 5 : 15; // Higher priority than symlink on macOS, lower on other platforms
  public isFallbackPurgeSafe: boolean = true;

  private api: IExtensionApi;

  constructor(api: IExtensionApi) {
    this.api = api;
  }

  public detailedDescription(t: TFunction): string {
    return t('copy_activator_description', {
      defaultValue: 'This deployment method copies mod files directly to the game directory. '
        + 'This is the most compatible method for macOS, avoiding permission issues with symbolic links. '
        + 'Files are physically copied, so changes to deployed files won\'t affect the original mod files. '
        + 'This method requires more disk space but provides maximum compatibility.'
    });
  }

  public isSupported(state, gameId, modTypeId): IUnavailableReason {
    // Only available on macOS to avoid symlink issues
    if (!isMacOS()) {
      return {
        description: t => t('Copy deployment is only available on macOS'),
        order: 100,
      };
    }
    
    // Return undefined when supported (TypeScript will infer this as valid)
    return undefined as any;
  }

  public userGate(): Promise<void> {
    return Promise.resolve();
  }

  public prepare(dataPath: string, clean: boolean, lastActivation: IDeployedFile[], normalize: Normalize): Promise<void> {
    // Ensure the data path exists
    return fs.ensureDirAsync(dataPath);
  }

  public finalize(gameId: string, dataPath: string, installationPath: string, progressCB?: (files: number, total: number) => void): Promise<IDeployedFile[]> {
    // Return empty array as we don't need special purge handling for copied files
    return Promise.resolve([]);
  }

  public activate(sourcePath: string, sourceName: string, deployPath: string, blackList: Set<string>): Promise<void> {
    const fullDeployPath = path.join(deployPath);
    
    // Initialize tracking for this mod
    deployedFiles[sourceName] = [];
    
    // On macOS, proactively request admin access if needed for destination
    const ensureMacAccess = async () => {
      if (!isMacOS()) return;
      const manager = MacOSAdminAccessManager.getInstance();
      try {
        const res = await manager.checkWriteAccess(fullDeployPath);
        if (!res.hasAccess && res.canRequestAdmin) {
          const appData = getAppDataPath();
          const isAppSupport = fullDeployPath.startsWith(appData) || fullDeployPath.includes('/Library/Application Support');
          const prompt = isAppSupport
            ? 'Vortex needs access to your Library/Application Support to deploy mods.'
            : 'Vortex needs administrator access to deploy mods to this location.';
          const granted = await manager.requestAdminAccess(fullDeployPath, {
            prompt,
            reason: 'Deploying mod files requires write access to the destination.'
          });
          if (!granted) {
            log('warn', 'Admin access not granted for deployment path; continuing and will attempt normal copy', { deployPath: fullDeployPath });
          }
        }
      } catch (e) {
        log('debug', 'Error while checking/requesting macOS admin access', { deployPath: fullDeployPath, error: (e as any)?.message });
      }
    };

    // Ensure target directory exists and copy all files from source to destination
    return Promise.resolve()
      .then(() => ensureMacAccess())
      .then(() => fs.ensureDirAsync(fullDeployPath))
      .then(() => this.copyDirectory(sourcePath, fullDeployPath, blackList, sourceName))
      .then(async () => {
        log('info', 'Copy activation completed', { sourceName, deployPath: fullDeployPath });
        // Remove macOS quarantine attribute recursively on deployed files
        if (isMacOS()) {
          try {
            const xattrCmd = '/usr/bin/xattr';
            await this.api.runExecutable(xattrCmd, ['-r', '-d', 'com.apple.quarantine', fullDeployPath], {
              constrained: true,
              attribution: 'copy_activator',
              expectSuccess: true,
            });
            log('info', 'Removed macOS quarantine from deployed files', { deployPath: fullDeployPath });
          } catch (err) {
            log('warn', 'Failed to remove macOS quarantine after copy deployment', { deployPath: fullDeployPath, error: (err as Error)?.message });
          }
        }
      });
  }

  public deactivate(sourcePath: string, dataPath: string, sourceName: string): Promise<void> {
    // Remove all files that were deployed by this mod
    const modFiles = deployedFiles[sourceName] || [];
    
    if (modFiles.length === 0) {
      log('debug', 'No files to deactivate for mod', { sourceName });
      return Promise.resolve();
    }
    
    log('info', 'Deactivating mod files', { sourceName, fileCount: modFiles.length });
    
    return promiseMap(modFiles, (fileRecord) => {
      return fs.removeAsync(fileRecord.targetPath)
        .catch(err => {
          if (err.code === 'ENOENT') {
            log('debug', 'File already removed', { path: fileRecord.targetPath });
          } else {
            log('warn', 'Failed to remove file during deactivation', { 
              path: fileRecord.targetPath, 
              error: err.message 
            });
          }
        });
    })
    .then(() => {
      // Clean up empty directories
      return this.removeEmptyDirectories(dataPath, modFiles);
    })
    .then(() => {
      // Clear the tracking for this mod
      delete deployedFiles[sourceName];
      log('info', 'Mod deactivation completed', { sourceName });
    });
  }

  public prePurge(installPath: string): Promise<void> {
    return Promise.resolve();
  }

  public purge(installPath: string, dataPath: string, gameId?: string, onProgress?: (num: number, total: number) => void): Promise<void> {
    // For copy deployment, purging means removing all copied files from all mods
    log('info', 'Purging all copy-deployed files', { dataPath });
    
    const allFiles: IDeployedFileRecord[] = [];
    Object.values(deployedFiles).forEach(modFiles => {
      allFiles.push(...modFiles);
    });
    
    if (allFiles.length === 0) {
      log('debug', 'No files to purge');
      return Promise.resolve();
    }
    
    let processed = 0;
    return promiseMap(allFiles, (fileRecord) => {
      return fs.removeAsync(fileRecord.targetPath)
        .catch(err => {
          if (err.code === 'ENOENT') {
            log('debug', 'File already removed during purge', { path: fileRecord.targetPath });
          } else {
            log('warn', 'Failed to remove file during purge', { 
              path: fileRecord.targetPath, 
              error: err.message 
            });
          }
        })
        .finally(() => {
          processed++;
          if (onProgress) {
            onProgress(processed, allFiles.length);
          }
        });
    })
    .then(() => {
      // Clean up empty directories
      return this.removeEmptyDirectories(dataPath, allFiles);
    })
    .then(() => {
      // Clear all tracking
      Object.keys(deployedFiles).forEach(key => delete deployedFiles[key]);
      log('info', 'Purge completed', { filesRemoved: allFiles.length });
    });
  }

  public postPurge(): Promise<void> {
    return Promise.resolve();
  }

  public externalChanges(gameId: string, installPath: string, dataPath: string, activation: IDeployedFile[]): Promise<IFileChange[]> {
    // Return empty array for now - detecting external changes for copied files
    // would require maintaining checksums or timestamps
    return Promise.resolve([]);
  }

  public getDeployedPath(input: string): string {
    return input;
  }

  public isDeployed(installPath: string, dataPath: string, file: IDeployedFile): Promise<boolean> {
    const deployedPath = path.join(dataPath, file.relPath);
    return fs.statAsync(deployedPath).then(() => true).catch(() => false);
  }

  private copyDirectory(source: string, target: string, blackList: Set<string>, sourceName: string, basePath: string = ''): Promise<void> {
    type TaskEntry = {
      entry: string;
      sourcePath: string;
      targetPath: string;
      relPath: string;
      stat: fs.Stats;
    };
    return fs.readdirAsync(source)
      .then((entries: string[]) => {
        // Gather stats and partition into directories and files with sizes
        return promiseMap(entries, async (entry: string) => {
          if (blackList.has(entry)) {
            return null;
          }
          const sourcePath = path.join(source, entry);
          const targetPath = path.join(target, entry);
          const relPath = path.join(basePath, entry);
          try {
            const stat = await fs.statAsync(sourcePath);
            return { entry, sourcePath, targetPath, relPath, stat };
          } catch (e) {
            log('warn', 'Failed to stat entry during copy', { sourcePath, error: (e as any)?.message });
            return null;
          }
        });
      })
      .then((tasks: Array<TaskEntry | null>) => {
        const isTaskEntry = (t: TaskEntry | null): t is TaskEntry => !!t && !!t.stat;
        const dirEntries: TaskEntry[] = tasks.filter((t): t is TaskEntry => isTaskEntry(t) && t.stat.isDirectory());
        const fileEntries: TaskEntry[] = tasks.filter((t): t is TaskEntry => isTaskEntry(t) && !t.stat.isDirectory());

        // Process directories first (depth-first)
        return promiseMap(dirEntries, async (t: TaskEntry) => {
          await fs.ensureDirAsync(t.targetPath);
          await this.copyDirectory(t.sourcePath, t.targetPath, blackList, sourceName, t.relPath);
        })
        .then(() => {
          // Bucket files by size for adaptive concurrency
          const small: TaskEntry[] = [];
          const medium: TaskEntry[] = [];
          const large: TaskEntry[] = [];
          fileEntries.forEach((t: TaskEntry) => {
            const size = t.stat.size || 0;
            if (size <= 256 * 1024) {
              small.push(t);
            } else if (size <= 8 * 1024 * 1024) {
              medium.push(t);
            } else {
              large.push(t);
            }
          });

          const copyOne = async (t: TaskEntry) => {
            // Track the deployed file
            deployedFiles[sourceName].push({
              sourcePath: t.sourcePath,
              targetPath: t.targetPath,
              relPath: t.relPath,
              sourceName,
            });
            if (isMacOS()) {
              // Attempt clone-aware atomic copy on macOS; fallback to regular copy
              return copyFileCloneAtomic(t.sourcePath, t.targetPath)
                .catch(() => fs.copyAsync(t.sourcePath, t.targetPath, { overwrite: true }));
            }
            return fs.copyAsync(t.sourcePath, t.targetPath, { overwrite: true });
          };

          // Copy with adaptive concurrency to reduce disk contention
          return promiseMap(small, copyOne)
            .then(() => promiseMap(medium, copyOne))
            .then(() => promiseMap(large, copyOne));
        });
      })
      .then(() => undefined);
  }

  private removeEmptyDirectories(dataPath: string, fileRecords: IDeployedFileRecord[]): Promise<void> {
    // Get all unique directory paths from the file records
    const dirPaths = new Set<string>();
    fileRecords.forEach(record => {
      let dir = path.dirname(record.targetPath);
      while (dir !== dataPath && dir !== path.dirname(dir)) {
        dirPaths.add(dir);
        dir = path.dirname(dir);
      }
    });

    // Sort directories by depth (deepest first) to remove from bottom up
    const sortedDirs = Array.from(dirPaths).sort((a, b) => b.split(path.sep).length - a.split(path.sep).length);

    return promiseMap(sortedDirs, (dirPath) => {
      return fs.readdirAsync(dirPath)
        .then(entries => {
          if (entries.length === 0) {
            return fs.rmdirAsync(dirPath)
              .catch(err => {
                if (err.code !== 'ENOENT' && err.code !== 'ENOTEMPTY') {
                  log('debug', 'Failed to remove empty directory', { path: dirPath, error: err.message });
                }
              });
          }
        })
        .catch(err => {
          if (err.code !== 'ENOENT') {
            log('debug', 'Error checking directory for cleanup', { path: dirPath, error: err.message });
          }
        });
    })
    .then(() => undefined);
  }
}

function init(context: IExtensionContext): boolean {
  context.registerDeploymentMethod(new DeploymentMethod(context.api));
  return true;
}

export default init;