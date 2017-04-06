import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { activeGameId } from '../../../util/selectors';

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
  public render(): JSX.Element {
    let { t } = this.props;

    return <ToolbarIcon
      id='install-from-archive'
      icon='archive'
      text={ t('Install from file') }
      onClick={ this.startInstallFile }
      buttonType='both'
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
  const gameMode = activeGameId(state);
  return {
    paths: state.settings.mods.paths[gameMode],
    gameMode,
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps)(InstallButton)
  );
