import { addNotification, dismissNotification } from '../../actions/notifications';
import { INotification } from '../../types/INotification';
import { log } from '../../util/log';
import { showError } from '../../util/message';

import { addMod, setModAttribute, setModInstallationPath, setModState } from './actions/mods';
import { IMod, ModState } from './types/IMod';

import { IInstallContext } from './types/IInstallContext';

import * as path from 'path';

interface IOnAddMod {
  (mod: IMod): void;
}

interface IOnAddNotification {
  (notification: INotification): void;
}

class InstallContext implements IInstallContext {

  private mAddMod: (mod: IMod) => void;
  private mAddNotification: (notification: INotification) => void;
  private mDismissNotification: (id: string) => void;
  private mShowError: (message: string, details?: string | Error) => void;
  private mSetModState: (id: string, state: ModState) => void;
  private mSetModAttribute: (id: string, key: string, value: any) => void;
  private mSetModInstallationPath: (id: string, installPath: string) => void;

  constructor(gameMode: string, dispatch: Redux.Dispatch<any>) {
    this.mAddMod = (mod) => dispatch(addMod(gameMode, mod));
    this.mAddNotification = (notification) =>
      dispatch(addNotification(notification));
    this.mDismissNotification = (id) =>
      dispatch(dismissNotification(id));
    this.mShowError = (message, details?) =>
      showError(dispatch, message, details);
    this.mSetModState = (id, state) =>
      dispatch(setModState(gameMode, id, state));
    this.mSetModAttribute = (id, key, value) =>
      dispatch(setModAttribute(gameMode, id, key, value));
    this.mSetModInstallationPath = (id, installPath) =>
      dispatch(setModInstallationPath(gameMode, id, installPath));
  }

  public startIndicator(id: string): void {
    this.mAddNotification({
      id: 'install_' + id,
      message: 'Installing ' + id,
      type: 'activity',
    });
  }

  public stopIndicator(id: string): void {
    this.mDismissNotification('install_' + id);

    this.mAddNotification({
      type: 'success',
      message: `${id} installed`,
      displayMS: 4000,
    });
  }

  public startInstallCB(id: string, archiveId: string): void {
    this.mAddMod({
      id,
      archiveId,
      installationPath: id,
      state: 'installing',
      attributes: {
        name: id,
        installTime: 'ongoing',
      },
    });
  }

  public finishInstallCB(id: string, success: boolean, info?: any): void {
    if (success) {
      this.mSetModState(id, 'installed');
      this.mSetModAttribute(id, 'installTime', new Date());
      this.mSetModAttribute(id, 'category', info.category);
      this.mSetModAttribute(id, 'version', info.version);
      this.mSetModAttribute(id, 'endorsed', false);

      if (info !== undefined) {
        Object.keys(info).forEach(
          (key: string) => { this.mSetModAttribute(id, key, info[key]); });
      }
    }
  }

  public setInstallPathCB(id: string, installPath: string) {
    this.mSetModInstallationPath(id, path.basename(installPath));
  }

  public reportError(message: string, details?: string | Error): void {
    log('error', 'install error', { message, details });
    this.mShowError(message, details);
  }

  public progressCB(percent: number, file: string): void {
    log('debug', 'install progress', { percent, file });
  }
}

export default InstallContext;
