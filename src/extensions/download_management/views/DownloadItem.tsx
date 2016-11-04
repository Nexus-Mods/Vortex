import { showDialog } from '../../../actions/notifications';
import { IComponentContext } from '../../../types/IComponentContext';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import Icon from '../../../views/Icon';
import { Button } from '../../../views/TooltipControls';

import { DownloadState, IDownload } from '../types/IDownload';

import * as Promise from 'bluebird';
import * as path from 'path';
import * as React from 'react';
import { ProgressBar } from 'react-bootstrap';

interface IBaseProps {
  downloadId: string;
  download: IDownload;
}

interface IActionProps {
  onShowDialog: (type, title, content, actions) => Promise<{ action, input }>;
}

type IProps = IBaseProps & IActionProps;

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

  public render(): JSX.Element {
    const { downloadId, download } = this.props;
    return (
      <tr>
        <td>{ this.renderFileName(download.localPath) }</td>
        <td style={{ textAlign: 'center' }}>
          { this.renderProgress(download.state, download.received, download.size) }
        </td>
        <td style={{ textAlign: 'center' }}>
          { this.renderActions(downloadId, download) }
        </td>
      </tr>
    );
  }

  private renderFileName(filePath: string) {
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

  private resume = () => {
    const { downloadId } = this.props;
    this.context.api.events.emit('resume-download', downloadId);
  }

  private renderPauseAction(key: string, download: IDownload) {
    const { t } = this.props;

    if (['init', 'started'].indexOf(download.state) >= 0) {
      return (
        <Button
          id={'pause-btn-' + key}
          className='btn-embed'
          tooltip={t('Pause')}
          onClick={this.pause}
        >
          <Icon name='pause' />
        </Button>
      );
    } else if (download.state === 'paused') {
      // offer resume instead. resume and pause are mutually exclusive
      return (
        <Button
          id={'resume-btn-' + key}
          className='btn-embed'
          tooltip={t('Resume')}
          onClick={this.resume}
        >
          <Icon name='play' />
        </Button>
      );
    } else {
      return null;
    }
  }

  private remove = () => {
    const { downloadId } = this.props;
    this.context.api.events.emit('remove-download', downloadId);
  }

  private renderRemoveAction(key: string, download: IDownload) {
    const { t } = this.props;

    if (['finished', 'failed'].indexOf(download.state) >= 0) {
      // offer removal only for finished downloads. Offer cancel otherwise
      return (
        <Button
          id={'remove-btn-' + key}
          className='btn-embed'
          tooltip={t('Remove')}
          onClick={this.remove}
        >
          <Icon name='remove' />
        </Button>
      );
    } else {
      return (
        <Button
          id={'cancel-btn-' + key}
          className='btn-embed'
          tooltip={t('Cancel')}
          onClick={this.remove}
        >
          <Icon name='stop' />
        </Button>
      );
    }
  }

  private install = () => {
    const { download } = this.props;
    this.context.api.events.emit('start-install', download.localPath);
  }

  private renderInstallAction(key: string, download: IDownload) {
    const { t } = this.props;

    if (download.state === 'finished') {
      return (
        <Button
          id={'install-btn-' + key}
          className='btn-embed'
          tooltip={t('Install')}
          onClick={this.install}
        >
          <Icon name='archive' />
        </Button>
      );
    } else {
      return null;
    }
  }

  private inspect = () => {
    const { download, downloadId, onShowDialog } = this.props;
    if (download.failCause.htmlFile !== undefined) {
      onShowDialog('error', 'Download failed', {
        htmlFile: download.failCause.htmlFile,
      }, {
        Delete: () => this.context.api.events.emit('remove-download', downloadId),
        Close: null,
      });
    }
  }

  private renderInspectAction(key: string, download: IDownload) {
    const { t } = this.props;

    if (download.state === 'failed') {
      return (
        <Button
          id={'inspect-btn-' + key}
          className='btn-embed'
          tooltip={t('Inspect')}
          onClick={this.inspect}
        >
          <Icon name='eye' />
        </Button>
      );
    } else {
      return null;
    }
  }

  private renderActions(key: string, download: IDownload) {
    return (
        <div>
        { this.renderInspectAction(key, download) }
        { this.renderInstallAction(key, download) }
        { this.renderPauseAction(key, download) }
        { this.renderRemoveAction(key, download) }
        </div>
      );
  }
}

function mapStateToProps(state) {
  return {};
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
  };
}

export default
  translate([ 'common' ], { wait: true })(
    connect(mapStateToProps, mapDispatchToProps)(DownloadItem)
  ) as React.ComponentClass<IBaseProps>;
