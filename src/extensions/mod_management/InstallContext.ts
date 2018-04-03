import { addNotification, dismissNotification } from '../../actions/notifications';
import { INotification } from '../../types/INotification';
import { IState } from '../../types/IState';
import { log } from '../../util/log';
import { showError } from '../../util/message';
import { getSafe } from '../../util/storeHelper';

import { setDownloadInstalled } from '../download_management/actions/state';
import { setModEnabled } from '../profile_management/actions/profiles';
import { activeProfile } from '../profile_management/selectors';

import {
  addMod,
  removeMod,
  setModAttribute,
  setModInstallationPath,
  setModState,
  setModType,
} from './actions/mods';
import { IMod, ModState } from './types/IMod';

import { IInstallContext, InstallOutcome } from './types/IInstallContext';

import * as Promise from 'bluebird';
import * as path from 'path';
import * as Redux from 'redux';
import { IExtensionApi } from '../../types/IExtensionContext';

type IOnAddMod = (mod: IMod) => void;
type IOnAddNotification = (notification: INotification) => void;

class InstallContext implements IInstallContext {
  private mAddMod: (mod: IMod) => void;
  private mRemoveMod: (modId: string) => void;
  private mAddNotification: (notification: INotification) => void;
  private mDismissNotification: (id: string) => void;
  private mShowError: (message: string, details?: string | Error, allowReport?: boolean) => void;
  private mSetModState: (id: string, state: ModState) => void;
  private mSetModAttribute: (id: string, key: string, value: any) => void;
  private mSetModInstallationPath: (id: string, installPath: string) => void;
  private mSetModType: (id: string, modType: string) => void;
  private mEnableMod: (modId: string) => void;
  private mSetDownloadInstalled: (archiveId: string, gameId: string, modId: string) => void;

  private mAddedId: string;
  private mIndicatorId: string;
  private mGameId: string;
  private mArchiveId: string;
  private mInstallOutcome: InstallOutcome;
  private mIsEnabled: (modId: string) => boolean;

  constructor(gameMode: string, api: IExtensionApi) {
    const store: Redux.Store<any> = api.store;
    const dispatch = store.dispatch;
    this.mAddMod = (mod) => dispatch(addMod(gameMode, mod));
    this.mRemoveMod = (modId) => dispatch(removeMod(gameMode, modId));
    this.mAddNotification = (notification) =>
      dispatch(addNotification(notification));
    this.mDismissNotification = (id) =>
      dispatch(dismissNotification(id));
    this.mShowError = (message, details?, allowReport?) =>
      showError(dispatch, message, details, false, undefined, allowReport);
    this.mSetModState = (id, state) =>
      dispatch(setModState(gameMode, id, state));
    this.mSetModAttribute = (id, key, value) => {
      if (value !== undefined) {
        dispatch(setModAttribute(gameMode, id, key, value));
      }
    };
    this.mSetModInstallationPath = (id, installPath) =>
      dispatch(setModInstallationPath(gameMode, id, installPath));
    this.mSetModType = (id, modType) =>
      dispatch(setModType(gameMode, id, modType));
    this.mEnableMod = (modId) => {
      const state: IState = store.getState();
      const profileId = state.settings.profiles.lastActiveProfile[this.mGameId];
      dispatch(setModEnabled(profileId, modId, true));
      api.events.emit('mods-enabled', [ modId ], true);
    };
    this.mIsEnabled = (modId) => {
      const state: IState = store.getState();

      const profileId = state.settings.profiles.lastActiveProfile[this.mGameId];
      const profile = state.persistent.profiles[profileId];
      return getSafe(profile, ['modState', modId, 'enabled'], false);
    };
    this.mSetDownloadInstalled = (archiveId, gameId, modId) => {
      dispatch(setDownloadInstalled(archiveId, gameId, modId));
    };
  }

  public startIndicator(id: string): void {
    log('info', 'start mod install', { id });
    this.mAddNotification({
      id: 'install_' + id,
      message: 'Installing ' + id,
      type: 'activity',
    });
    this.mIndicatorId = id;
    this.mInstallOutcome = undefined;
  }

  public stopIndicator(): void {
    if (this.mIndicatorId === undefined) {
      return;
    }

    this.mDismissNotification('install_' + this.mIndicatorId);

    Promise.delay(500)
    .then(() => {
      this.mAddNotification(
        this.outcomeNotification(
          this.mInstallOutcome, this.mIndicatorId, this.mIsEnabled(this.mAddedId)));
    });
  }

  public startInstallCB(id: string, gameId: string, archiveId: string): void {
    this.mAddMod({
      id,
      type: '',
      archiveId,
      installationPath: id,
      state: 'installing',
      attributes: {
        name: id,
        installTime: new Date(),
      },
    });
    this.mAddedId = id;
    this.mGameId = gameId;
    this.mArchiveId = archiveId;
  }

  public finishInstallCB(outcome: InstallOutcome, info?: any): void {
    log('info', 'finish mod install', {
      id: this.mIndicatorId,
      outcome: this.mInstallOutcome,
      info,
    });
    if (outcome === 'success') {
      this.mSetModState(this.mAddedId, 'installed');
      this.mSetModAttribute(this.mAddedId, 'installTime', new Date());
      this.mSetModAttribute(this.mAddedId, 'category', info.category);
      this.mSetModAttribute(this.mAddedId, 'version', info.version);
      this.mSetModAttribute(this.mAddedId, 'fileId', info.fileId);
      this.mSetModAttribute(this.mAddedId, 'newestFileId', info.fileId);
      this.mSetModAttribute(this.mAddedId, 'changelog', info.changelog);
      this.mSetModAttribute(this.mAddedId, 'endorsed', undefined);
      this.mSetModAttribute(this.mAddedId, 'bugMessage', '');

      if (info !== undefined) {
        Object.keys(info).forEach(
          (key: string) => { this.mSetModAttribute(this.mAddedId, key, info[key]); });
      }
      this.mSetDownloadInstalled(this.mArchiveId, this.mGameId, this.mAddedId);
    } else {
      if (this.mAddedId !== undefined) {
        this.mRemoveMod(this.mAddedId);
      }
    }
    this.mInstallOutcome = outcome;
  }

  public setInstallPathCB(id: string, installPath: string) {
    log('info', 'using install path', { id, installPath });
    this.mSetModInstallationPath(id, path.basename(installPath));
  }

  public setModType(id: string, modType: string) {
    log('info', 'determined mod type', { id, modType });
    this.mSetModType(id, modType);
  }

  public reportError(message: string, details?: string | Error, allowReport?: boolean): void {
    log('error', 'install error', { message, details });
    this.mShowError(message, details, allowReport);
  }

  public progressCB(percent: number, file: string): void {
    log('debug', 'install progress', { percent, file });
  }

  private outcomeNotification(outcome: InstallOutcome, id: string,
                              isEnabled: boolean): INotification {
    switch (outcome) {
      case 'success':
        return {
          type: 'success',
          message: `${id} installed`,
          group: 'mod-installed',
          displayMS: isEnabled ? 4000 : undefined,
          actions: isEnabled ? [] : [
            {
              title: 'Enable',
              action: dismiss => {
                this.mEnableMod(this.mAddedId);
                dismiss();
              },
            },
          ],
        };
      case 'canceled': return {
        type: 'info',
        message: 'Installation canceled',
        displayMS: 2000,
      };
      default: return {
        type: 'error',
        message: `${id} failed to install`,
      };
    }
  }
}

export default InstallContext;
