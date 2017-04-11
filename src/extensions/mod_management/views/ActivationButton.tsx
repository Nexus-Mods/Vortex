import { DialogActions, DialogType,
         IDialogContent, IDialogResult, showDialog } from '../../../actions/notifications';
import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { showError } from '../../../util/message';
import { activeGameId, activeProfile } from '../../../util/selectors';
import ToolbarIcon from '../../../views/ToolbarIcon';

import { IDiscoveryResult } from '../../gamemode_management/types/IDiscoveryResult';
import { currentActivator, installPath } from '../../mod_management/selectors';
import { IProfileMod } from '../../profile_management/types/IProfile';

import { IMod } from '../types/IMod';
import { IModActivator } from '../types/IModActivator';

import * as Promise from 'bluebird';
import * as React from 'react';

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

export interface IBaseProps {
  activators: IModActivator[];
  buttonType: 'text' | 'icon' | 'both';
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class ActivationButton extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    let { t, buttonType } = this.props;

    return <ToolbarIcon
      id='activate-mods'
      icon='chain'
      text={t('Deploy Mods')}
      onClick={this.activate}
      buttonType={buttonType}
    />;
  }

  private activate = () => {
    this.context.api.events.emit('activate-mods', (err) => {
      if (err !== null) {
        this.props.onShowError('Failed to activate mods', err);
      }
    });
  };
}

function activeGameDiscovery(state: IState)  {
  return state.settings.gameMode.discovered[activeGameId(state)];
}

function mapStateToProps(state: IState): IConnectedProps {
  const profile = activeProfile(state);
  const gameMode = activeGameId(state);

  return {
    installPath: installPath(state),
    gameDiscovery: activeGameDiscovery(state),
    mods: state.persistent.mods[gameMode] || {},
    modState: profile !== undefined ? profile.modState : {},
    currentActivator: currentActivator(state),
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<IState>): IActionProps {
  return {
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
    onShowError: (message: string, details?: string) => showError(dispatch, message, details),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(ActivationButton)
  ) as React.ComponentClass<IBaseProps>;
