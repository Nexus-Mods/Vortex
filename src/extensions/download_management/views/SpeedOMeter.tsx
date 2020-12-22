import Icon from '../../../controls/Icon';
import ProgressBar from '../../../controls/ProgressBar';
import { connect, PureComponentEx, translate } from '../../../util/ComponentEx';
import { bytesToString } from '../../../util/util';

import * as React from 'react';
import { IState } from '../../../types/IState';
import { DownloadState, IDownload } from '../types/IDownload';

import { setAttributeFilter } from '../../../actions/tables'

export interface IBaseProps {
  slim: boolean;
}

interface IConnectedProps {
  downloads: { [downloadId: string]: IDownload };
  speed: number;
}

type IProps = IBaseProps & IConnectedProps;

const STATES: DownloadState[] = ['finalizing', 'started', 'paused'];

class SpeedOMeter extends PureComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, downloads, slim, speed } = this.props;

    const activeDownloads = Object.keys(downloads ?? {})
      .filter(id => STATES.includes(downloads[id].state))
      .map(id => downloads[id])
      .sort((lhs, rhs) => {
        if (lhs.state !== rhs.state) {
          return STATES.indexOf(lhs.state) - STATES.indexOf(rhs.state);
        } else {
          return lhs.startTime - rhs.startTime;
        }
      });

    if (activeDownloads.length === 0) {
      return null;
    }

    if (slim) {
      return (
        <span className='active-downloads-slim'>
          <Icon name='download-speed' />{' '}{bytesToString(speed)}
        </span>
      );
    } else {
      return (
        <div className='active-downloads-container'>
          <span>{t('Active Downloads')}</span>
          {activeDownloads.slice(0, 2).map(this.renderDownload)}
          {(activeDownloads.length > 2)
            ? <a onClick={this.openDownloads}>{t('More...')}</a>
            : null}
          <span><Icon name='download-speed' />{' '}{bytesToString(speed)}/s</span>
        </div>
      );
    }
  }

  private openDownloads = () => {
    this.context.api.events.emit('show-main-page', 'Downloads');
    this.context.api.store.dispatch(setAttributeFilter('downloads', 'progress', 'In Progress'));
  }

  private renderDownload = (download: IDownload) => {
    const size = Math.max(1, download.size, download.received);
    const perc = ((download.received * 100) / size);
    return (
      <ProgressBar
        key={download.localPath}
        min={0}
        max={size}
        now={download.received}
        labelLeft={download.localPath}
        labelRight={perc.toFixed(0) + '%'}
      />
    );
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    downloads: state.persistent.downloads.files,
    speed: state.persistent.downloads.speed || 0,
  };
}

export default
  translate(['common'])(
    connect(mapStateToProps)(
      SpeedOMeter)) as React.ComponentClass<IBaseProps>;
