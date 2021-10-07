import { ButtonType } from '../../../controls/IconBar';
import ToolbarIcon from '../../../controls/ToolbarIcon';
import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { activeGameId } from '../../../util/selectors';

import * as React from 'react';

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

    this.context.api.selectFile(options)
    .then(result => {
      const { api } = this.context;
      if (result !== undefined) {
        if (this.props.copyOnIFF) {
          api.events.emit('import-downloads', [result], (dlIds: string[]) => {
            dlIds.forEach(dlId => {
              api.events.emit('start-install-download', dlId);
            });
          });
        } else {
          api.events.emit('start-install', result);
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
