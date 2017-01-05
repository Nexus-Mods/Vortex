import { showDialog } from '../../../actions/notifications';
import { IDialogResult } from '../../../types/IDialog';
import { IIconDefinition } from '../../../types/IIconDefinition';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import IconBar from '../../../views/IconBar';

import { IGameStored } from '../../gamemode_management/types/IStateEx';
import { downloadPath } from '../../mod_management/selectors';

import { DownloadState, IDownload } from '../types/IDownload';

import * as Promise from 'bluebird';
import * as path from 'path';
import * as React from 'react';
import { ProgressBar } from 'react-bootstrap';

export interface IBaseProps {
  downloadId: string;
  download: IDownload;
  showGame: boolean;
}

export interface IConnectedProps {
  knownGames: IGameStored[];
  downloadPath: string;
}

interface IActionProps {
  onShowDialog: (type, title, content, actions) => Promise<IDialogResult>;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

/**
 * a single row in the download list
 * 
 * @class DownloadItem
 * @extends {ComponentEx<IProps, {}>}
 */
class DownloadItem extends ComponentEx<IProps, {}> {

  private downloadActions: IIconDefinition[];

  constructor(props: IProps) {
    super(props);

  }

  public render(): JSX.Element {
    const { downloadId, download, showGame } = this.props;
    return (
      <tr>
        <td>{ this.renderFileName(download.localPath) }</td>
        { showGame ? <td>{ this.renderGame(download.game) }</td> : null }
        <td style={{ textAlign: 'center' }}>
          { this.renderProgress(download.state, download.received, download.size) }
        </td>
        <td style={{ textAlign: 'center' }}>
          <IconBar
            group='downloaditem-icons'
            instanceId={ downloadId }
            downloadId={ downloadId }
            className='download-actions'
            staticElements={ this.downloadActions }
          />
        </td>
      </tr>
    );
  }

  private renderFileName(filePath: string): JSX.Element {
    const { t } = this.props;
    let name;
    if (filePath !== undefined) {
      name = path.basename(filePath);
    } else {
      name = t('Pending');
    }
    return (
      <span>{ name }</span>
    );
  }

  private renderGame(gameId: string): JSX.Element {
    const { t, knownGames } = this.props;
    let game = knownGames.find((ele: IGameStored) => gameId === ele.id);
    return <span>{ game ? t(game.name) : gameId }</span>;
  }

  private renderProgress(state: DownloadState, received: number, size: number): JSX.Element {
    let { t } = this.props;
    switch (state) {
      case 'init': return <span>{ t('Pending') }</span>;
      case 'finished': return <span>{ t('Finished') }</span>;
      case 'failed': return <span>{ t('Failed') }</span>;
      case 'paused': return <span>{ t('Paused') }</span>;
      default: {
        let label = ((received * 100) / size).toFixed(0);
        return (
          <ProgressBar now={received} max={size} label={`${label} %`} />
        );
      }
    }
  }
}

function mapStateToProps(state): IConnectedProps {
  return {
    knownGames: state.session.gameMode.known,
    downloadPath: downloadPath(state),
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
  };
}

export default
  translate([ 'common' ], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(DownloadItem)
  ) as React.ComponentClass<IBaseProps>;
