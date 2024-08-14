import { addNotification } from '../../../actions/notifications';
import { setSettingsPage } from '../../../actions/session';
import ToolbarIcon from '../../../controls/ToolbarIcon';
import { INotificationAction } from '../../../types/INotification';
import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { UserCanceled } from '../../../util/CustomErrors';
import { showError } from '../../../util/message';
import onceCB from '../../../util/onceCB';
import * as selectors from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';

import { IDeploymentMethod } from '../types/IDeploymentMethod';
import { NoDeployment } from '../util/exceptions';

import * as React from 'react';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

interface IConnectedProps {
  activator: IDeploymentMethod;
  needToDeploy: boolean;
  profileId: string;
}

interface IActionProps {
  onShowError: (message: string, details?: string, allowReport?: boolean) => void;
  onShowWarning: (message: string, dialogAction: INotificationAction, id: string) => void;
  onSetSettingsPage: (pageId: string) => void;
}

export interface IBaseProps {
  buttonType: 'text' | 'icon' | 'both';
  getActivators: () => IDeploymentMethod[];
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

const nop = () => undefined;

class ActivationButton extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, activator, needToDeploy } = this.props;

    return (
      <ToolbarIcon
        id='deploy-mods'
        icon='deploy'
        text={t('Deploy Mods')}
        className={needToDeploy ? 'toolbar-flash-button' : undefined}
        onClick={activator !== undefined ? this.activate : this.noMethod}
      />
    );
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

  private activate = () => {
    this.context.api.events.emit('deploy-mods', onceCB((err) => {
      if (err !== null) {
        if (err instanceof UserCanceled) {
          // Nothing to see here, move along.
          return;
        } else if (err instanceof NoDeployment) {
          this.props.onShowError(
            'You need to select a deployment method in settings',
            undefined, false);
        } else {
          this.props.onShowError('Failed to activate mods', err);
        }
      }
    }), this.props.profileId, undefined, { manual: true });
  }
}

function mapStateToProps(state: IState, ownProps: IProps): IConnectedProps {
  const gameId = selectors.activeGameId(state);
  const activatorId = getSafe(state, ['settings', 'mods', 'activator', gameId], undefined);
  const profileId = selectors.lastActiveProfileForGame(state, gameId);
  let activator: IDeploymentMethod;
  if (activatorId !== undefined) {
    activator = ownProps.getActivators().find((act: IDeploymentMethod) => act.id === activatorId);
  }
  return {
    profileId,
    activator,
    needToDeploy: selectors.needToDeploy(state),
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<IState, null, Redux.Action>): IActionProps {
  return {
    onShowError: (message: string, details?: string, allowReport?: boolean) =>
      showError(dispatch, message, details, { allowReport }),
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
    connect(mapStateToProps, mapDispatchToProps)(ActivationButton),
  ) as React.ComponentClass<IBaseProps>;
