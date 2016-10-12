import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { showError } from '../../../util/message';
import ToolbarIcon from '../../../views/ToolbarIcon';

import { IDiscoveryResult } from '../../gamemode_management/types/IStateEx';
import { IProfileMod } from '../../profile_management/types/IProfile';

import { IMod } from '../types/IMod';
import { IModActivator } from '../types/IModActivator';

import { activateMods } from '../modActivation';

import * as React from 'react';

interface IConnectedProps {
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

class ActivationButton extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    let { t } = this.props;

    return <ToolbarIcon
      key='activate-mods'
      id='activate-mods'
      icon='chain'
      tooltip={ t('Link Mods') }
      onClick={ this.activate }
    />;
  }

  private activate = () => {
    let { activators, currentActivator, gameDiscovery, mods, modState, onShowError } = this.props;

    let activator: IModActivator = currentActivator !== undefined
      ? activators.find((act: IModActivator) => act.id === currentActivator)
      : activators[0];

    let modList: IMod[] = Object.keys(mods).map((key: string) => mods[key]);

    activateMods(gameDiscovery.modPath, modList, modState, activator).catch((err) => {
      onShowError('failed to activate mods', err.message);
    });
  };
}

function mapStateToProps(state: any): IConnectedProps {
  const activeProfile =
    state.gameSettings.profiles.profiles[state.gameSettings.profiles.currentProfile];

  const activeGameId = state.settings.gameMode.current;

  const activeGameDiscovery: IDiscoveryResult =
    state.settings.gameMode.discovered[activeGameId];

  return {
    gameDiscovery: activeGameDiscovery,
    mods: state.mods.mods,
    modState: activeProfile.modState,
    currentActivator: state.gameSettings.mods.activator,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onShowError: (message: string, details?: string) => showError(dispatch, message, details),
  };
}

export default
  translate(['common'], { wait: true })(
    connect(mapStateToProps, mapDispatchToProps)(ActivationButton)
  );
