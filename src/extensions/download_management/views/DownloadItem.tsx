import { showDialog } from '../../../actions/notifications';
import { IComponentContext } from '../../../types/IComponentContext';
import { IDialogResult } from '../../../types/IDialog';
import { IIconDefinition } from '../../../types/IIconDefinition';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import IconBar from '../../../views/IconBar';

import { IGameStored } from '../../gamemode_management/types/IStateEx';

import { DownloadState, IDownload } from '../types/IDownload';

import * as Promise from 'bluebird';
import * as path from 'path';
import * as React from 'react';
import { ProgressBar } from 'react-bootstrap';

import { log } from '../../../util/log';

export interface IBaseProps {
  downloadId: string;
  download: IDownload;
  showGame: boolean;
}

export interface IConnectedProps {
  knownGames: IGameStored[];
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

  public static contextTypes: React.ValidationMap<any> = {
    api: React.PropTypes.object.isRequired,
  };

  public context: IComponentContext;

  private downloadActions: IIconDefinition[];

  constructor(props: IProps) {
    super(props);

    this.downloadActions = [
      {
        icon: 'eye',
        title: 'Inspect',
        action: this.inspect,
        condition: this.inspectable,
      },
      {
        icon: 'archive',
        title: 'Install',
        action: this.install,
        condition: this.installable,
      },
      {
        icon: 'pause',
        title: 'Pause',
        action: this.pause,
        condition: this.pausable,
      },
      {
        icon: 'play',
        title: 'Resume',
        action: this.resume,
        condition: this.resumable,
      },
      {
        icon: 'remove',
        title: 'Remove',
        action: this.remove,
        condition: this.removable,
      },
      {
        icon: 'stop',
        title: 'Cancel',
        action: this.remove,
        condition: this.cancelable,
      },
    ];
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
            className='download-actions'
            staticElements={ this.downloadActions }
            downloadId={ downloadId }
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

  private pause = () => {
    const { downloadId } = this.props;
    this.context.api.events.emit('pause-download', downloadId);
  }

  private pausable = (instanceId: string) => {
    const { download } = this.props;
    return download.state === 'started';
  }

  private resume = () => {
    const { downloadId } = this.props;
    this.context.api.events.emit('resume-download', downloadId);
  }

  private resumable = () => {
    const { download } = this.props;
    return download.state === 'paused';
  }

  private remove = () => {
    const { downloadId } = this.props;
    this.context.api.events.emit('remove-download', downloadId);
  }

  private removable = () => {
    const { download } = this.props;
    return ['finished', 'failed'].indexOf(download.state) >= 0;
  }

  private cancelable = () => {
    const { download } = this.props;
    return ['init', 'started', 'paused'].indexOf(download.state) >= 0;
  }

  private install = () => {
    const { downloadId } = this.props;
    this.context.api.events.emit('start-install-download', downloadId);
  }

  private installable = () => {
    const { download } = this.props;
    return download.state === 'finished';
  }

  private inspect = () => {
    const { download, downloadId, onShowDialog } = this.props;
    if (download.state === 'failed') {
      if (download.failCause.htmlFile !== undefined) {
        onShowDialog('error', 'Download failed', {
          htmlFile: download.failCause.htmlFile,
        }, {
            Delete: () => this.context.api.events.emit('remove-download', downloadId),
            Close: null,
          });
      }
    } else {
      this.context.api.lookupModMeta(download.localPath, {})
        .then((info) => {
          log('info', 'meta', { info });
        });
    }
  }

  private inspectable = () => {
    const { download } = this.props;
    return [ 'failed', 'finished' ].indexOf(download.state) >= 0;
  }
}

function mapStateToProps(state): IConnectedProps {
  return {
    knownGames: state.session.gameMode.known,
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
