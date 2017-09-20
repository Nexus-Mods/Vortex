import { DialogType,
         IDialogContent, IDialogResult, showDialog } from '../../../actions/notifications';
import ToolbarIcon from '../../../controls/ToolbarIcon';
import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { showError } from '../../../util/message';
import { activeGameId, activeProfile } from '../../../util/selectors';

import { IDiscoveryResult } from '../../gamemode_management/types/IDiscoveryResult';
import { IProfileMod } from '../../profile_management/types/IProfile';

import { IDeploymentMethod } from '../types/IDeploymentMethod';

import * as Promise from 'bluebird';
import * as React from 'react';
import * as Redux from 'redux';

interface IConnectedProps {
}

interface IActionProps {
  onShowError: (message: string, details?: string) => void;
}

export interface IBaseProps {
  buttonType: 'text' | 'icon' | 'both';
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class ActivationButton extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, buttonType } = this.props;

    return (
    <ToolbarIcon
      id='activate-mods'
      icon='chain'
      text={t('Deploy Mods')}
      onClick={this.activate}
      buttonType={buttonType}
    />
    );
  }

  private activate = () => {
    this.context.api.events.emit('activate-mods', (err) => {
      if (err !== null) {
        this.props.onShowError('Failed to activate mods', err);
      }
    });
  }
}

function activeGameDiscovery(state: IState)  {
  return state.settings.gameMode.discovered[activeGameId(state)];
}

function mapStateToProps(state: IState): IConnectedProps {
  return {};
}

function mapDispatchToProps(dispatch: Redux.Dispatch<IState>): IActionProps {
  return {
    onShowError: (message: string, details?: string) => showError(dispatch, message, details),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(ActivationButton),
  ) as React.ComponentClass<IBaseProps>;
