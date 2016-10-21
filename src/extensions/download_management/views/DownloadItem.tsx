import { IComponentContext } from '../../../types/IComponentContext';
import { ComponentEx, translate } from '../../../util/ComponentEx';
import { Button } from '../../../views/TooltipControls';

import { DownloadState, IDownload } from '../types/IDownload';

import * as path from 'path';
import * as React from 'react';
import { ProgressBar } from 'react-bootstrap';
import Icon = require('react-fontawesome');

interface IBaseProps {
  downloadId: string;
  download: IDownload;
}

type IProps = IBaseProps;

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
        <td>{ this.renderProgress(download.state, download.received, download.size) }</td>
        <td>{ this.renderActions(downloadId, download) }</td>
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
      <p>{ name }</p>
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

  private renderActions(key: string, download: IDownload) {
    return (
        <div>
        { this.renderPauseAction(key, download) }
        { this.renderRemoveAction(key, download) }
        </div>
      );
  }
}

export default
  translate([ 'common' ], { wait: true })(DownloadItem);
