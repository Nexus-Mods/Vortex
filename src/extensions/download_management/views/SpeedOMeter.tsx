import Icon from '../../../controls/Icon';
import ProgressBar from '../../../controls/ProgressBar';
import { connect, PureComponentEx, translate } from '../../../util/ComponentEx';
import { bytesToString } from '../../../util/util';

import * as React from 'react';
import { IState } from '../../../types/IState';
import { IDownload } from '../types/IDownload';

export interface IBaseProps {
  slim: boolean;
}

interface IConnectedProps {
  downloads: { [downloadId: string]: IDownload };
  speed: number;
}

type IProps = IBaseProps & IConnectedProps;

class SpeedOMeter extends PureComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, downloads, slim, speed } = this.props;

    const activeDownloads = Object.keys(downloads ?? {})
      .filter(id => downloads[id].state === 'started' || downloads[id].state === 'paused')
      .map(id => downloads[id]);

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
          {(activeDownloads.length > 2) ? t('More...') : null}
          <span><Icon name='download-speed' />{' '}{bytesToString(speed)}/s</span>
        </div>
      );
    }
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
