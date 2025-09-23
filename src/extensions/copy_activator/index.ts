import { IExtensionContext, IDeploymentMethod, IDeployedFile, IUnavailableReason } from '../../types/api';
import { IGame } from '../../types/IGame';
import { fs, log, util } from 'vortex-api';
import { isMacOS } from '../../util/platform';
import { TFunction } from '../../util/i18n';
import { Normalize } from '../../util/getNormalizeFunc';
import { IFileChange } from '../mod_management/types/IDeploymentMethod';
import * as path from 'path';
import Promise from 'bluebird';

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
    
    // Ensure target directory exists and copy all files from source to destination
    return fs.ensureDirAsync(fullDeployPath)
      .then(() => this.copyDirectory(sourcePath, fullDeployPath, blackList, sourceName));
  }

  public deactivate(sourcePath: string, dataPath: string, sourceName: string): Promise<void> {
    // Remove all files that were deployed by this mod
    const modFiles = deployedFiles[sourceName] || [];
    
    if (modFiles.length === 0) {
      log('debug', 'No files to deactivate for mod', { sourceName });
      return Promise.resolve();
    }
    
    log('info', 'Deactivating mod files', { sourceName, fileCount: modFiles.length });
    
    return Promise.map(modFiles, (fileRecord) => {
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
    return Promise.map(allFiles, (fileRecord) => {
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
    return fs.readdirAsync(source)
      .then(entries => Promise.map(entries, entry => {
        if (blackList.has(entry)) {
          return Promise.resolve();
        }
        
        const sourcePath = path.join(source, entry);
        const targetPath = path.join(target, entry);
        const relPath = path.join(basePath, entry);
        
        return fs.statAsync(sourcePath)
          .then(stat => {
            if (stat.isDirectory()) {
              return fs.ensureDirAsync(targetPath)
                .then(() => this.copyDirectory(sourcePath, targetPath, blackList, sourceName, relPath));
            } else {
              // Track the deployed file
              deployedFiles[sourceName].push({
                sourcePath,
                targetPath,
                relPath,
                sourceName
              });
              return fs.copyAsync(sourcePath, targetPath);
            }
          });
      }))
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

    return Promise.map(sortedDirs, (dirPath) => {
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
  context.registerDeploymentMethod(new DeploymentMethod());
  return true;
}

export default init;