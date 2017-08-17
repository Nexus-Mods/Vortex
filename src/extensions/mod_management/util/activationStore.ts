import {showDialog} from '../../../actions/notifications';
import {IExtensionApi} from '../../../types/IExtensionContext';
import {UserCanceled} from '../../../util/CustomErrors';
import {IDeployedFile} from '../types/IModActivator';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

function fallbackPurge(basePath: string,
                       files: IDeployedFile[]): Promise<void> {
  return Promise.map(files, file => {
    const fullPath = path.join(basePath, file.relPath);
    return fs.statAsync(fullPath).then(stats => {
      if (stats.mtime.getTime() === file.time) {
        return fs.unlinkAsync(fullPath);
      } else {
        return Promise.resolve();
      }
    })
    .catch(err => {
      if (err.code !== 'ENOENT') {
        return Promise.reject(err);
      } // otherwise ignore
    });
  })
  .then(() => undefined);
}

function queryPurge(api: IExtensionApi,
                    basePath: string,
                    files: IDeployedFile[]): Promise<void> {
  const t = api.translate;
  return api.store.dispatch(showDialog('info', t('Purge files from different instance?'), {
    message: t('IMPORTANT: This game was modded by another instance of Vortex.\n\n' +
      'If you switch between different instances (or between shared and ' +
      'single-user mode) it\'s better if you purge mods before switching.\n\n' +
      'Vortex can try to clean up now but this is less reliable (*) than doing it ' +
      'from the instance that deployed the files in the first place.\n\n' +
      'If you modified any files in the game directory you should back them up ' +
      'before continuing.\n\n' +
      '(*) This purge relies on a manifest of deployed files, created by that other ' +
      'instance. Files that have been changed since that manifest was created ' +
      'won\'t be removed to prevent data loss. If the manifest is damaged or ' +
      'outdated the purge may be incomplete. When purging from the "right" instance ' +
      'the manifest isn\'t required, it can reliably deduce which files need to ' +
      'be removed.'),
  }, [ { label: 'Cancel' }, { label: 'Purge' } ]))
    .then(result => {
      if (result.action === 'Purge') {
        return fallbackPurge(basePath, files);
      } else {
        return Promise.reject(new UserCanceled());
      }
    });
}

export function loadActivation(api: IExtensionApi, gamePath: string): Promise<IDeployedFile[]> {
  const tagFile = path.join(gamePath, 'vortex.deployment.json');
  return fs.readFileAsync(tagFile).then(tagData => {
    const state = api.store.getState();
    const tagObject = JSON.parse(tagData.toString());
    if (tagObject.instance !== state.app.instanceId) {
      return queryPurge(api, gamePath, tagObject.files)
          .then(() => saveActivation(state.app.instanceId, gamePath, []))
          .then(() => Promise.resolve([]));
    } else {
      return Promise.resolve(tagObject.files);
    }
  })
  .catch(() => []);
}

export function saveActivation(instance: string, gamePath: string, activation: IDeployedFile[]) {
  const tagFile = path.join(gamePath, 'vortex.deployment.json');

  return fs.writeFileAsync(tagFile, JSON.stringify(
                                        {
                                          instance,
                                          files: activation,
                                        },
                                        undefined, 2));
}
