import Advanced from '../../../controls/Advanced';
import ToolbarIcon from '../../../controls/ToolbarIcon';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { showError } from '../../../util/message';
import { activeGameId, activeProfile, currentGameDiscovery } from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';

import { IDiscoveryResult } from '../../gamemode_management/types/IDiscoveryResult';
import { currentActivator, installPath } from '../../mod_management/selectors';
import { IProfileMod } from '../../profile_management/types/IProfile';

import { IDeploymentMethod } from '../types/IDeploymentMethod';
import { IMod } from '../types/IMod';
import { NoDeployment } from '../util/exceptions';

import * as React from 'react';
import * as Redux from 'redux';
import { generate as shortid } from 'shortid';

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

class DeactivationButton extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, activator, buttonType } = this.props;

    return (
      <Advanced><ToolbarIcon
        id='deploy-mods'
        icon='purge'
        text={t('Purge Mods')}
        onClick={activator !== undefined ? this.activate : nop}
        disabled={activator === undefined}
      /></Advanced>
    );
  }

  private activate = () => {
    this.context.api.events.emit('purge-mods', (err) => {
      if (err !== null) {
        if (err instanceof NoDeployment) {
          this.props.onShowError('You need to select a deployment method in settings',
                                 undefined, false);
        } else {
          this.props.onShowError('Failed to purge mods', err);
        }
      }
    });
  }
}

function mapStateToProps(state: any, ownProps: IProps): IConnectedProps {
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

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onShowError: (message: string, details?: string, allowReport?: boolean) =>
      showError(dispatch, message, details, { allowReport }),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(DeactivationButton),
  ) as React.ComponentClass<IBaseProps>;
