import { addNotification, dismissNotification } from '../../../actions/notifications';
import { INotification } from '../../../types/INotification';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { showError } from '../../../util/message';

import ToolbarIcon from '../../../views/ToolbarIcon';

import { addMod, setModAttribute, setModState } from '../actions/mods';
import { IMod, ModState } from '../types/IMod';
import { IStatePaths } from '../types/IStateSettings';
import resolvePath from '../util/resolvePath';

import { IInstallContext, startInstallFile } from '../modInstall';

import * as React from 'react';

interface IConnectedProps {
  paths: IStatePaths;
  gameMode: string;
}

interface IActionProps {
  onAddMod: (mod: IMod) => void;
  onAddNotification: (notification: INotification) => void;
  onShowError: (message: string, details: string) => void;
  onDismissNotification: (id: string) => void;
  onSetModState: (id: string, state: ModState) => void;
  onSetModAttribute: (id: string, key: string, value: any) => void;
}

class InstallButton extends ComponentEx<IConnectedProps & IActionProps, {}> {
  public render(): JSX.Element {
    let { t } = this.props;

    return <ToolbarIcon
      id='install-from-archive'
      icon='archive'
      tooltip={ t('Install from file') }
      onClick={ this.startInstallFile }
    />;
  }

  private startInstallFile = () => {
    const context: IInstallContext = {
      startInstallCB: this.startInstallCB,
      finishInstallCB: this.finishInstallCB,
      progressCB: (percent, file) => undefined,
      reportError: this.reportError,
    };

    let { paths, gameMode } = this.props;

    const installPath = resolvePath('install', paths, gameMode);
    startInstallFile(installPath, context);
  }

  private startInstallCB = (id: string, archivePath: string, destinationPath: string): void => {
    const mod: IMod = {
      id,
      archivePath,
      installationPath: destinationPath,
      state: 'installing',
      attributes: {
        name: id,
        installTime: 'ongoing',
      },
    };

    this.props.onAddMod(mod);

    this.props.onAddNotification({
      id: 'install_' + id,
      message: 'Installing ' + id,
      type: 'activity',
    });
  }

  private finishInstallCB = (id: string, success: boolean): void => {
    let { onAddNotification, onDismissNotification } = this.props;
    let { onSetModAttribute, onSetModState } = this.props;

    onDismissNotification('install_' + id);

    if (success) {
      onAddNotification({
        type: 'success',
        message: `${id} installed`,
        displayMS: 4000,
      });
      onSetModState(id, 'installed');
      onSetModAttribute(id, 'installTime', new Date());
    }
  }

  private reportError = (message: string, details?: string): void => {
    this.props.onShowError(message, details);
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    paths: state.gameSettings.mods.paths,
    gameMode: state.settings.gameMode.current,
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onAddMod: (mod: IMod) => {
      dispatch(addMod(mod));
    },
    onAddNotification: (notification: INotification) => {
      dispatch(addNotification(notification));
    },
    onShowError: (message: string, details?: string) => {
      showError(dispatch, message, details);
    },
    onDismissNotification: (id: string) => {
      dispatch(dismissNotification(id));
    },
    onSetModState: (id: string, state: ModState) => {
      dispatch(setModState(id, state));
    },
    onSetModAttribute: (id: string, key: string, value: any) => {
      dispatch(setModAttribute(id, key, value));
    },
  };
}

export default
  translate(['common'], { wait: true })(
    connect(mapStateToProps, mapDispatchToProps)(InstallButton)
  );
