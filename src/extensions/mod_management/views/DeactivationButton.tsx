import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { showError } from '../../../util/message';
import ToolbarIcon from '../../../views/ToolbarIcon';

import { IDiscoveryResult } from '../../gamemode_management/types/IStateEx';
import {installPath} from '../../mod_management/selectors';
import { IProfile, IProfileMod } from '../../profile_management/types/IProfile';

import { IMod } from '../types/IMod';
import { IModActivator } from '../types/IModActivator';

import { deactivateMods } from '../modActivation';

import * as React from 'react';
import {generate as shortid} from 'shortid';

interface IConnectedProps {
  installPath: string;
  gameDiscovery: IDiscoveryResult;
  mods: { [id: string]: IMod };
  modState: { [id: string]: IProfileMod };
  currentActivator: string;
}

interface IActionProps {
  onShowError: (message: string, details?: string) => void;
}

interface IBaseProps {
  activators: IModActivator[];
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class DeactivationButton extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    let { t } = this.props;

    return <ToolbarIcon
      id='activate-mods'
      icon='chain-broken'
      tooltip={ t('Unlink Mods') }
      onClick={ this.activate }
    />;
  }

  private activate = () => {
    let { t, activators, currentActivator, gameDiscovery, installPath, onShowError } = this.props;

    let activator: IModActivator = currentActivator !== undefined
      ? activators.find((act: IModActivator) => act.id === currentActivator)
      : activators[0];

    let notificationId = shortid();
    this.context.api.sendNotification({
      id: notificationId,
      type: 'activity',
      message: t('Purging mods'),
      title: t('Purging'),
    });

    deactivateMods(installPath, gameDiscovery.modPath, activator).catch((err) => {
      onShowError('failed to deactivate mods', err.message);
    }).finally(() => {
      this.context.api.dismissNotification(notificationId);
    });
;
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
    onShowError: (message: string, details?: string) => showError(dispatch, message, details),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(DeactivationButton)
  );
