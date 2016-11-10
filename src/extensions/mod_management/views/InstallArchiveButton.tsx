import { IComponentContext } from '../../../types/IComponentContext';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';

import ToolbarIcon from '../../../views/ToolbarIcon';

import { IStatePaths } from '../types/IStateSettings';

import { dialog as dialogIn, remote } from 'electron';
import * as React from 'react';

const dialog = remote !== undefined ? remote.dialog : dialogIn;

interface IConnectedProps {
  paths: IStatePaths;
  gameMode: string;
}

class InstallButton extends ComponentEx<IConnectedProps, {}> {
  public static contextTypes: React.ValidationMap<any> = {
    api: React.PropTypes.object.isRequired,
  };

  public context: IComponentContext;

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
    const options: Electron.OpenDialogOptions = {
      properties: ['openFile'],
    };

    dialog.showOpenDialog(null, options, (fileNames: string[]) => {
      if ((fileNames !== undefined) && (fileNames.length > 0)) {
        this.context.api.events.emit('start-install', fileNames[0]);
      }
    });
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    paths: state.gameSettings.mods.paths,
    gameMode: state.settings.gameMode.current,
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps)(InstallButton)
  );
