import {IState} from '../../../types/IState';
import {ComponentEx, connect} from '../../../util/ComponentEx';

import {speedDataPoints} from '../reducers/state';
import {IDownload} from '../types/IDownload';
import bytesToString from '../util/bytesToString';

import * as React from 'react';
import { Area, AreaChart, Tooltip } from 'recharts';

interface IBaseProps {
  t: I18next.TranslationFunction;
}

interface IConnectedProps {
  speeds: number[];
  files: { [id: string]: IDownload };
}

type IProps = IBaseProps & IConnectedProps;

/**
 * download speed dashlet
 */
class DownloadsDashlet extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const {t, files, speeds} = this.props;
    const data = this.convertData(speeds);

    let activeDownloads = Object.keys(files).filter(
      (key: string) => files[key].state === 'started');

    // TODO animation disabled because https://github.com/recharts/recharts/issues/375
    return (<div>
      <h5>{t('{{ count }} download', {
        count: activeDownloads.length,
        replace: { count: activeDownloads.length }
      })}</h5>
      <div style={{ textAlign: '-webkit-center' }} >
        <AreaChart width={200} height={200} data={data}>
          <defs>
            <linearGradient id='colorUv' x1='0' y1='0' x2='0' y2='1'>
              <stop offset='5%' stopColor='#cf862a' stopOpacity={0.8} />
              <stop offset='95%' stopColor='#cf862a' stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type='monotone'
            dataKey='speed'
            stroke='#cf862a'
            fill='url(#colorUv)'
            isAnimationActive={false}
          />
          <Tooltip
            formatter={this.valueFormatter}
            labelFormatter={this.labelFormatter}
          />
        </AreaChart>
      </div>
    </div>);
  }

  private valueFormatter = (value: number) => {
    return bytesToString(value) + '/s';
  }

  private labelFormatter = (name: string) => {
    return `${speedDataPoints - parseInt(name, 10)}s ago`;
  }

  private convertData(speeds: number[]): any {
    return speeds.map((value: number, idx: number) => ({ name: idx.toString(), speed: value }));
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    speeds: state.persistent.downloads.speedHistory,
    files: state.persistent.downloads.files,
  };
}

export default connect(mapStateToProps)(
  DownloadsDashlet) as React.ComponentClass<{}>;
