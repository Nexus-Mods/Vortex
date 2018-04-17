import { DialogType,
         IDialogContent, IDialogResult, showDialog } from '../../../actions/notifications';
import ToolbarIcon from '../../../controls/ToolbarIcon';
import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { showError } from '../../../util/message';
import { activeGameId, activeProfile } from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';

import { IDiscoveryResult } from '../../gamemode_management/types/IDiscoveryResult';
import { IProfileMod } from '../../profile_management/types/IProfile';

import { IDeploymentMethod } from '../types/IDeploymentMethod';
import { NoDeployment } from '../util/exceptions';

import * as Promise from 'bluebird';
import * as React from 'react';
import * as Redux from 'redux';

interface IConnectedProps {
  activator: IDeploymentMethod;
}

interface IActionProps {
  onShowError: (message: string, details?: string, allowReport?: boolean) => void;
}

export interface IBaseProps {
  buttonType: 'text' | 'icon' | 'both';
  activators: IDeploymentMethod[];
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

const nop = () => undefined;

class ActivationButton extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, activator, buttonType } = this.props;

    return (
      <ToolbarIcon
        id='deploy-mods'
        icon='deploy'
        text={t('Deploy Mods')}
        onClick={activator !== undefined ? this.activate : nop}
        disabled={activator === undefined}
      />
    );
  }

  private activate = () => {
    this.context.api.events.emit('deploy-mods', (err) => {
      if (err !== null) {
        if (err instanceof NoDeployment) {
          this.props.onShowError(
            'You need to select a deployment method in settings',
            undefined, false);
        } else {
          this.props.onShowError('Failed to activate mods', err);
        }
      }
    });
  }
}

function activeGameDiscovery(state: IState)  {
  return state.settings.gameMode.discovered[activeGameId(state)];
}

function mapStateToProps(state: IState, ownProps: IProps): IConnectedProps {
  const gameId = activeGameId(state);
  const activatorId = getSafe(state, ['settings', 'mods', 'activator', gameId], undefined);
  let activator: IDeploymentMethod;
  if (activatorId !== undefined) {
    activator = ownProps.activators.find((act: IDeploymentMethod) => act.id === activatorId);
  }
  return {
    activator,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<IState>): IActionProps {
  return {
    onShowError: (message: string, details?: string, allowReport?: boolean) =>
      showError(dispatch, message, details, { allowReport }),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(ActivationButton),
  ) as React.ComponentClass<IBaseProps>;
