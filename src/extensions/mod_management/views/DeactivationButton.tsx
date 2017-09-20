import Advanced from '../../../controls/Advanced';
import ToolbarIcon from '../../../controls/ToolbarIcon';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { showError } from '../../../util/message';
import { activeGameId, activeProfile, currentGameDiscovery } from '../../../util/selectors';

import { IDiscoveryResult } from '../../gamemode_management/types/IDiscoveryResult';
import { currentActivator, installPath } from '../../mod_management/selectors';
import { IProfileMod } from '../../profile_management/types/IProfile';

import { IMod } from '../types/IMod';
import { IDeploymentMethod } from '../types/IDeploymentMethod';

import * as React from 'react';
import * as Redux from 'redux';
import { generate as shortid } from 'shortid';

interface IConnectedProps {
}

interface IActionProps {
  onShowError: (message: string, details?: string) => void;
}

export interface IBaseProps {
  buttonType: 'text' | 'icon' | 'both';
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class DeactivationButton extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, buttonType } = this.props;

    return (
      <Advanced><ToolbarIcon
        id='activate-mods'
        icon='chain-broken'
        text={t('Purge Mods')}
        onClick={this.activate}
        buttonType={buttonType}
      /></Advanced>
    );
  }

  private activate = () => {
    this.context.api.events.emit('purge-mods', (err) => {
      if (err !== null) {
        this.props.onShowError('Failed to purge mods', err);
      }
    });
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {};
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onShowError: (message: string, details?: string) => showError(dispatch, message, details),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(DeactivationButton),
  ) as React.ComponentClass<IBaseProps>;
