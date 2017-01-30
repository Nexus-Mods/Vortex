import { DialogActions, DialogType,
         IDialogContent, IDialogResult, showDialog } from '../../../actions/notifications';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { showError } from '../../../util/message';
import ToolbarIcon from '../../../views/ToolbarIcon';

import { IDiscoveryResult } from '../../gamemode_management/types/IStateEx';
import {installPath} from '../../mod_management/selectors';
import { IProfile, IProfileMod } from '../../profile_management/types/IProfile';

import { IMod } from '../types/IMod';
import { IFileChange, IModActivator } from '../types/IModActivator';

import sortMods from '../util/sort';

import { activateMods } from '../modActivation';

import ExternalChangeDialog, { FileAction, IFileEntry } from './ExternalChangeDialog';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as React from 'react';
import {generate as shortid} from 'shortid';

function UserCanceled() {
  /* nop */
};

interface IConnectedProps {
  installPath: string;
  gameDiscovery: IDiscoveryResult;
  mods: { [id: string]: IMod };
  modState: { [id: string]: IProfileMod };
  currentActivator: string;
}

interface IActionProps {
  onShowDialog: (type: DialogType, title: string,
                 content: IDialogContent, actions: DialogActions) => Promise<IDialogResult>;
  onShowError: (message: string, details?: string) => void;
}

interface IBaseProps {
  activators: IModActivator[];
}

interface IComponentState {
  fileActions: IFileEntry[];
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class ActivationButton extends ComponentEx<IProps, IComponentState> {

  private closeChangeDialog: (cancel: boolean) => void = undefined;

  constructor(props) {
    super(props);
    this.initState({ fileActions: undefined });
  }

  public render(): JSX.Element {
    let { t } = this.props;

    return <div style={{ float: 'left' }}><ToolbarIcon
      id='activate-mods'
      icon='chain'
      tooltip={t('Link Mods')}
      onClick={this.activate}
    />
      <ExternalChangeDialog
        actions={this.state.fileActions}
        onChangeAction={this.changeFileAction}
        onClose={this.closeChangeDialog}
      />
    </div>;
  }

  private changeFileAction = (fileName: string, action: FileAction) => {
    this.nextState.fileActions.find(
      (entry: IFileEntry) => entry.filePath === fileName
      ).action = action;
  }

  private activate = () => {
    let { t, activators, currentActivator, gameDiscovery, installPath,
      mods, modState, onShowError } = this.props;

    let activator: IModActivator = currentActivator !== undefined
      ? activators.find((act: IModActivator) => act.id === currentActivator)
      : activators[0];

    let modList: IMod[] = Object.keys(mods).map((key: string) => mods[key]);

    let notificationId = shortid();
    this.context.api.sendNotification({
      id: notificationId,
      type: 'activity',
      message: t('Activating mods'),
      title: t('Activating'),
    });

    let fileActions: IFileEntry[];

    activator.externalChanges(installPath, gameDiscovery.modPath)
      .then((changes: IFileChange[]) => {

        if (changes.length > 0) {
          return new Promise<void>((resolve, reject) => {
            this.closeChangeDialog = (cancel: boolean) => {
              fileActions = this.nextState.fileActions;
              this.nextState.fileActions = undefined;
              cancel ? reject(new UserCanceled()) : resolve();
            };
            this.nextState.fileActions = changes.map((change: IFileChange) =>
              ({
                filePath: change.filePath,
                source: change.source,
                type: change.changeType,
                action: (change.changeType === 'refchange' ? 'import' : 'keep') as FileAction,
              }));
          });
        } else {
          return Promise.resolve();
        }
      })
      .then(() => {
        if (fileActions === undefined) {
          return Promise.resolve();
        }

        return Promise.map(fileActions.filter((entry: IFileEntry) => entry.action === 'drop'),
          (entry) => fs.removeAsync(path.join(gameDiscovery.modPath, entry.filePath)))
          .then(() => Promise.map(
            fileActions.filter((entry: IFileEntry) => entry.action === 'import'),
            (entry) => fs.copyAsync(path.join(gameDiscovery.modPath, entry.filePath),
                                    path.join(installPath, entry.source, entry.filePath))
          )).then(() => undefined);
      })
      .then(() => sortMods(modList, this.context.api))
      .then((sortedMods: string[]) => {
        let sortedModList = modList.sort((lhs: IMod, rhs: IMod) =>
          sortedMods.indexOf(lhs.id) - sortedMods.indexOf(rhs.id));

        return activateMods(installPath, gameDiscovery.modPath, sortedModList, modState, activator);
      })
      .catch(UserCanceled, () => undefined)
      .catch((err) => {
        onShowError('failed to activate mods', err);
      })
      .finally(() => {
        this.context.api.dismissNotification(notificationId);
      });
  };
}

function activeProfile(state: any): IProfile {
  return state.gameSettings.profiles.profiles[state.gameSettings.profiles.currentProfile];
}

function activeGameDiscovery(state: any)  {
  const activeGameId = state.settings.gameMode.current;
  return state.settings.gameMode.discovered[activeGameId];
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    installPath: installPath(state),
    gameDiscovery: activeGameDiscovery(state),
    mods: state.mods.mods,
    modState: activeProfile(state).modState,
    currentActivator: state.gameSettings.mods.activator,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
    onShowError: (message: string, details?: string) => showError(dispatch, message, details),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(ActivationButton)
  );
