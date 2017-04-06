import { DialogActions, DialogType,
         IDialogContent, IDialogResult, showDialog } from '../../../actions/notifications';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { showError } from '../../../util/message';
import { activeGameId, activeProfile } from '../../../util/selectors';
import ToolbarIcon from '../../../views/ToolbarIcon';

import { IDiscoveryResult } from '../../gamemode_management/types/IDiscoveryResult';
import { currentActivator, installPath } from '../../mod_management/selectors';
import { IProfileMod } from '../../profile_management/types/IProfile';

import { IFileEntry } from '../types/IFileEntry';
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

interface IBaseProps {
  activators: IModActivator[];
}

interface IComponentState {
  fileActions: IFileEntry[];
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class ActivationButton extends ComponentEx<IProps, IComponentState> {
  constructor(props) {
    super(props);
    this.initState({ fileActions: undefined });
  }

  public render(): JSX.Element {
    let { t } = this.props;

    return <div style={{ float: 'left' }}>
      <ToolbarIcon
        id='activate-mods'
        icon='chain'
        text={t('Link Mods')}
        onClick={this.activate}
      />
    </div>;
  }

  private activate = () => {
    this.context.api.events.emit('activate-mods', (err) => {
      if (err !== null) {
        this.props.onShowError('Failed to activate mods', err);
      }
    });
  };
}

function activeGameDiscovery(state: any)  {
  return state.settings.gameMode.discovered[activeGameId(state)];
}

function mapStateToProps(state: any): IConnectedProps {
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
