import Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as path from 'path';
import { generate as shortid } from 'shortid';
import { IDialogResult } from '../../../types/IDialog';
import { IExtensionApi } from '../../../types/IExtensionContext';
import { IDownload, IState } from '../../../types/IState';
import { ProcessCanceled, UserCanceled } from '../../../util/CustomErrors';
import * as fs from '../../../util/fs';
import { truthy } from '../../../util/util';
import { setDownloadPath } from '../actions/settings';
import { removeDownload } from '../actions/state';
import getDownloadPath from './getDownloadPath';

const app = remote !== undefined ? remote.app : appIn;

export const DOWNLOADS_DIR_TAG = '__vortex_downloads_folder';

export function writeDownloadsTag(api: IExtensionApi, tagPath: string): Promise<void> {
  const state: IState = api.store.getState();
  const data = {
    instance: state.app.instanceId,
  };

  const writeTag = () => fs.writeFileAsync(path.join(tagPath, DOWNLOADS_DIR_TAG),
    JSON.stringify(data), {  encoding: 'utf8' });

  return writeTag()
    .catch({ code: 'EISDIR' }, err => {
      // __vortex_downloads_folder exists inside the tag path. (as a folder!)
      //  It's possible the user tried to create it manually in an attempt
      //  to fix some other error, but it's also possible that this is actually
      //  a bug somewhere in the application. We're going to try to re-create the
      //  tag.
      return api.showDialog('question', 'Reinitialize Tag', {
        text: 'Vortex expected the below filepath to lead to a file but found '
            + 'a directory instead - Vortex can try to re-initialize this file for you, '
            + 'but we suggest you manually ensure it doesn\'t contain any files you may '
            + 'need before proceeding.',
        message: path.join(tagPath, DOWNLOADS_DIR_TAG),
      }, [
        { label: 'Cancel' },
        { label: 'Proceed' },
      ]).then(res => (res.action === 'Proceed')
          ? fs.removeAsync(path.join(tagPath, DOWNLOADS_DIR_TAG))
          : Promise.reject(err))
        .catch({ code: 'ENOENT' }, remErr => Promise.resolve())
        .then(() => writeTag())
        .catch(innerErr => Promise.reject(err));
    });
}

function removeDownloadsMetadata(api: IExtensionApi): Promise<void> {
  const state: IState = api.store.getState();
  const downloads: {[id: string]: IDownload} = state.persistent.downloads.files;
  return Promise.each(Object.keys(downloads), dlId => {
    api.store.dispatch(removeDownload(dlId));
    return Promise.resolve();
  }).then(() => Promise.resolve());
}

function queryDownloadFolderInvalid(api: IExtensionApi,
                                    err: Error,
                                    dirExists: boolean,
                                    currentDownloadPath: string)
                                    : Promise<IDialogResult> {
  if (dirExists) {
    // dir exists but not tagged
    return api.showDialog('error', 'Downloads Folder invalid', {
      bbcode: 'Your downloads folder "{{path}}" is not marked correctly. This may be ok '
          + 'if you\'ve updated from a very old version of Vortex and you can ignore this.<br/>'
          + '[b]However[/b], if you use a removable medium (network or USB drive) and that path '
          + 'does not actually point to your real Vortex download folder, you [b]have[/b] '
          + 'to make sure the actual folder is available and tell Vortex where it is.',
      message: err.message,
      parameters: {
        path: currentDownloadPath,
      },
    }, [
      { label: 'Quit Vortex' },
      { label: 'Ignore' },
      { label: 'Browse...' },
    ]);
  }
  return api.showDialog('error', ' Downloads Folder missing!', {
        text: 'Your downloads folder "{{path}}" is missing. This might happen because you '
            + 'deleted it or - if you have it on a removable drive - it is not currently '
            + 'connected.\nIf you continue now, a new downloads folder will be created but all '
            + 'your previous mod archives will be lost.\n\n'
            + 'If you have moved the folder or the drive letter changed, you can browse '
            + 'for the new location manually, but please be extra careful to select the right '
            + 'folder!',
        message: err.message,
        parameters: {
          path: currentDownloadPath,
        },
      }, [
        { label: 'Quit Vortex' },
        { label: 'Reinitialize' },
        { label: 'Browse...' },
      ]);
}

function validateDownloadsTag(api: IExtensionApi, tagPath: string): Promise<void> {
  return fs.readFileAsync(tagPath, { encoding: 'utf8' })
    .then(data => {
      const state: IState = api.store.getState();
      const tag = JSON.parse(data);
      if (tag.instance !== state.app.instanceId) {
        return api.showDialog('question', 'Confirm', {
          text: 'This is a downloads folder but it appears to belong to a different Vortex '
              + 'instance. If you\'re using Vortex in shared and "regular" mode, do not use '
              + 'the same downloads folder for both!',
        }, [
          { label: 'Cancel' },
          { label: 'Continue' },
        ])
        .then(result => (result.action === 'Cancel')
          ? Promise.reject(new UserCanceled())
          : Promise.resolve());
      }
      return Promise.resolve();
    })
    .catch(() => {
      return api.showDialog('question', 'Confirm', {
        text: 'This directory is not marked as a downloads folder. '
            + 'Are you *sure* it\'s the right directory?',
      }, [
        { label: 'Cancel' },
        { label: 'I\'m sure' },
      ])
      .then(result => result.action === 'Cancel'
        ? Promise.reject(new UserCanceled())
        : Promise.resolve());
    });
}

export function ensureDownloadsDirectory(api: IExtensionApi): Promise<void> {
  const state: IState = api.getState();

  let currentDownloadPath = getDownloadPath(state.settings.downloads.path);
  let dirExists = false;

  return fs.statAsync(currentDownloadPath)
    .then(() => {
      dirExists = true;
      // download dir exists, does the tag exist?
      return fs.statAsync(path.join(currentDownloadPath, DOWNLOADS_DIR_TAG));
    })
    .catch(err => {
      if (!dirExists
          && (Object.keys(state.persistent.downloads.files ?? {}).length === 0)) {
        return fs.ensureDirWritableAsync(currentDownloadPath, () => Promise.resolve());
      }

      return queryDownloadFolderInvalid(api, err, dirExists, currentDownloadPath)
        .then(result => {
        if (result.action === 'Quit Vortex') {
          app.exit(0);
          return Promise.reject(new UserCanceled());
        } else if (result.action === 'Reinitialize') {
          const id = shortid();
          api.sendNotification({
            id,
            type: 'activity',
            message: 'Cleaning downloads metadata',
          });
          return removeDownloadsMetadata(api)
            .then(() => fs.ensureDirWritableAsync(currentDownloadPath, () => Promise.resolve()))
            .catch(() => {
              api.showDialog('error', 'Downloads Folder missing!', {
                bbcode: 'The downloads folder could not be created. '
                      + 'You [b][color=red]have[/color][/b] to go to settings->downloads and '
                      + 'change it to a valid directory [b][color=red]before doing anything '
                      + 'else[/color][/b] or you will get further error messages.',
              }, [
                { label: 'Close' },
              ]);
              return Promise.reject(new ProcessCanceled(
                'Failed to reinitialize download directory'));
            })
            .finally(() => {
              api.dismissNotification(id);
            });
        } else if (result.action === 'Ignore') {
          return Promise.resolve();
        } else { // Browse...
          return api.selectDir({
            defaultPath: currentDownloadPath,
            title: api.translate('Select downloads folder'),
          }).then((selectedPath) => {
            if (!truthy(selectedPath)) {
              return Promise.reject(new UserCanceled());
            }
            return validateDownloadsTag(api, path.join(selectedPath, DOWNLOADS_DIR_TAG))
              .then(() => {
                currentDownloadPath = selectedPath;
                api.store.dispatch(setDownloadPath(currentDownloadPath));
                return Promise.resolve();
              });
          })
          .catch(() => ensureDownloadsDirectory(api));
        }
      });
    })
      .then(() => writeDownloadsTag(api, currentDownloadPath));
}
