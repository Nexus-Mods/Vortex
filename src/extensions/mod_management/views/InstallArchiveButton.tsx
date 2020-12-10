import { ButtonType } from '../../../controls/IconBar';
import ToolbarIcon from '../../../controls/ToolbarIcon';
import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { activeGameId } from '../../../util/selectors';

import { dialog as dialogIn, remote } from 'electron';
import * as React from 'react';

const dialog = remote !== undefined ? remote.dialog : dialogIn;

export interface IBaseProps {
  buttonType: ButtonType;
}

interface IConnectedProps {
  gameMode: string;
  copyOnIFF: boolean;
}

type IProps = IBaseProps & IConnectedProps;

class InstallButton extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, buttonType } = this.props;

    return (
      <ToolbarIcon
        id='install-from-archive'
        icon='select-install'
        text={t('Install From File')}
        onClick={this.startInstallFile}
      />
    );
  }

  private startInstallFile = () => {
    const options: Electron.OpenDialogOptions = {
      properties: ['openFile'],
    };

    dialog.showOpenDialog(remote.getCurrentWindow(), options)
    .then(result => {
      const { filePaths } = result;
      const { api } = this.context;
      if ((filePaths !== undefined) && (filePaths.length > 0)) {
        if (this.props.copyOnIFF) {
          api.events.emit('import-downloads', [filePaths[0]], (dlIds: string[]) => {
            dlIds.forEach(dlId => {
              api.events.emit('start-install-download', dlId);
            });
          });
        } else {
          api.events.emit('start-install', filePaths[0]);
        }
      }
    });
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  const gameMode = activeGameId(state);
  return {
    gameMode,
    copyOnIFF: state.settings.downloads.copyOnIFF,
  };
}

export default
  translate(['common'])(
    connect(mapStateToProps)(
      InstallButton)) as React.ComponentClass<IBaseProps>;
