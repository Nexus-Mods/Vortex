import { addNotification, DialogActions, DialogType, IDialogContent,
         IDialogResult, showDialog} from '../../../actions/notifications';
import { setSettingsPage } from '../../../actions/session';
import ToolbarIcon from '../../../controls/ToolbarIcon';
import { INotificationAction } from '../../../types/INotification';
import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { TemporaryError, UserCanceled } from '../../../util/CustomErrors';
import { showError } from '../../../util/message';
import { activeGameId } from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';

import { IDeploymentMethod } from '../types/IDeploymentMethod';
import { NoDeployment } from '../util/exceptions';

import Promise from 'bluebird';
import * as React from 'react';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { setConfirmPurge } from '../actions/settings';

interface IConnectedProps {
  activator: IDeploymentMethod;
  confirmPurge: boolean;
}

interface IActionProps {
  onShowError: (message: string, details?: string | any, allowReport?: boolean) => void;
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
                 actions: DialogActions) => Promise<IDialogResult>;
  onSetConfirmPurge: (enabled: boolean) => void;
  onShowWarning: (message: string, dialogAction: INotificationAction, id: string) => void;
  onSetSettingsPage: (pageId: string) => void;
}

export interface IBaseProps {
  buttonType: 'text' | 'icon' | 'both';
  getActivators: () => IDeploymentMethod[];
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

const nop = () => undefined;

class DeactivationButton extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, activator, buttonType } = this.props;

    return (
      <ToolbarIcon
        id='purge-mods'
        icon='purge'
        text={t('Purge Mods')}
        onClick={activator !== undefined ? this.activate : this.noMethod}
      />
    );
  }

  private activate = () => {
    const { confirmPurge, onShowError } = this.props;
    const prom = (confirmPurge !== false) ? this.confirmPurge() : Promise.resolve();
    prom
      .then(() => new Promise((resolve, reject) => {
        this.context.api.events.emit('purge-mods', false, (err) => {
          if (err !== null) {
            reject(err);
          } else {
            resolve();
          }
        });
      }))
      .catch(UserCanceled, () => null)
      .catch(TemporaryError, err =>
        onShowError('Failed to purge mods, please try again', err.message, false))
      .catch(NoDeployment, () => {
        onShowError('You need to select a deployment method in settings',
                    undefined, false);
      })
      .catch(err => {
        if ((err.code === undefined) && (err.errno !== undefined)) {
          // unresolved windows error code
          onShowError('Failed to purge mods', {
            error: err,
            ErrorCode: err.errno,
          }, true);
        } else {
          onShowError('Failed to purge mods', err, !['ENOTFOUND', 'ENOENT'].includes(err.code));
        }
      });
  }

  private noMethod = () => {
    const { onSetSettingsPage, onShowWarning } = this.props;
    onShowWarning('You have to select a deployment method first', {
      title: 'Fix',
      action: (dismiss: () => void) => {
        this.context.api.events.emit('show-main-page', 'application_settings');
        onSetSettingsPage('Mods');
        dismiss();
      },
    }, 'select-deployment-method-first');
  }

  private confirmPurge(): Promise<void> {
    const { onSetConfirmPurge, onShowDialog } = this.props;
    return onShowDialog('question', 'Confirm purge', {
      text: 'Purging will remove all links deployed to the game directory.\n'
          + 'This is not a destructive operation, on the next deployment all links will be '
          + 'restored.\n'
          + 'Use this operation to force a complete re-deployment or to restore the game '
          + 'directory to an unmodded-state.',
      checkboxes: [ { id: 'confirm_purge', text: 'Don\'t ask again', value: false } ],
    }, [
      { label: 'Cancel' },
      { label: 'Continue' },
    ])
    .then(result => {
      if (result.action === 'Cancel') {
        return Promise.reject(new UserCanceled());
      } else {
        if (result.input.confirm_purge) {
          onSetConfirmPurge(false);
        }
        return Promise.resolve();
      }
    });
  }
}

function mapStateToProps(state: IState, ownProps: IProps): IConnectedProps {
  const gameId = activeGameId(state);
  const activatorId = getSafe(state, ['settings', 'mods', 'activator', gameId], undefined);
  let activator: IDeploymentMethod;
  if (activatorId !== undefined) {
    activator = ownProps.getActivators().find((act: IDeploymentMethod) => act.id === activatorId);
  }
  return {
    activator,
    confirmPurge: state.settings.mods.confirmPurge,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onShowError: (message: string, details?: string, allowReport?: boolean) =>
      showError(dispatch, message, details, { allowReport }),
    onShowDialog: (type, title, content, dialogActions) =>
      dispatch(showDialog(type, title, content, dialogActions)),
    onSetConfirmPurge: (enabled: boolean) =>
      dispatch(setConfirmPurge(enabled)),
    onShowWarning: (message: string, dialogAction: INotificationAction, id: string) =>
      dispatch(addNotification({
        id,
        type: 'warning',
        message,
        actions: [ dialogAction ],
    })),
    onSetSettingsPage: (pageId: string) => dispatch(setSettingsPage(pageId)),
  };
}

export default
  translate(['common'])(
    connect(mapStateToProps, mapDispatchToProps)(DeactivationButton),
  ) as React.ComponentClass<IBaseProps>;
