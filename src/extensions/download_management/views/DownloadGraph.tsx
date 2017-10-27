import {IState} from '../../../types/IState';
import asyncRequire from '../../../util/asyncRequire';
import {ComponentEx, connect} from '../../../util/ComponentEx';
import { log } from '../../../util/log';
import { bytesToString, truthy } from '../../../util/util';

import {speedDataPoints} from '../reducers/state';
import {IDownload} from '../types/IDownload';

import * as I18next from 'i18next';
import * as React from 'react';
import * as rechartsT from 'recharts';
let recharts: typeof rechartsT;

interface IBaseProps {
  t: I18next.TranslationFunction;
}

interface IConnectedProps {
  speeds: number[];
  files: { [id: string]: IDownload };
}

type IProps = IBaseProps & IConnectedProps;

interface IComponentState {
  width: number;
}

/**
 * download speed dashlet
 */
class DownloadGraph extends ComponentEx<IProps, IComponentState> {
  private mRef: HTMLDivElement;
  private mIsMounted: boolean = false;

  constructor(props: IProps) {
    super(props);
    this.initState({ width: 800 });
  }

  public componentWillMount() {
    asyncRequire('recharts')
    .then((rechartsIn) => {
      recharts = rechartsIn;
      this.forceUpdate();
    })
    .catch((err) => {
      log('error', 'failed to load recharts', { err });
    });
  }

  public componentDidMount() {
    this.updateDimensions();
    window.addEventListener('resize', this.updateDimensions);
    this.mIsMounted = true;
  }

  public componentWillUnmount() {
    window.removeEventListener('resize', this.updateDimensions);
    this.mIsMounted = false;
  }

  public render(): JSX.Element {
    const {t, files, speeds} = this.props;
    const data = this.convertData(speeds);

    const activeDownloads = Object.keys(files).filter(
      (key: string) => files[key].state === 'started');

    if (recharts === undefined) {
      return null;
    }

    const maxData = Math.max(...speeds);
    const maxRounded = this.byteRound(maxData);
    const ticks = [0, this.byteRound(maxRounded / 3),
                   this.byteRound((maxRounded * 2) / 3), maxRounded];

    // TODO: animation disabled because https://github.com/recharts/recharts/issues/375
    return (
      <div className='chart-container download-chart' ref={this.setRef} >
        <recharts.AreaChart width={this.state.width} height={200} data={data}>
          <recharts.YAxis
            tickFormatter={this.valueFormatter}
            ticks={ticks}
            domain={[0, maxRounded]}
          />
          <recharts.CartesianGrid strokeDasharray='3 3' vertical={false}/>
          <recharts.Area
            type='monotone'
            dataKey='speed'
            isAnimationActive={false}
            dot={false}
            fill='url(#graph-gradient)'
          />
          { // updating the tooltip is extremely costy for some reason, ~22ms every time we update
            /* <recharts.Tooltip
            formatter={this.valueFormatter}
            labelFormatter={this.labelFormatter}
            wrapperStyle={{ backgroundColor: '', border: '' }}
          /> */}
        </recharts.AreaChart>
      </div>
    );
  }

  private byteRound(input: number): number {
    const roundVal = 128 * 1024;
    return Math.ceil(input / roundVal) * roundVal;
  }

  private updateDimensions = () => {
    if (truthy(this.mRef) && this.mIsMounted) {
      this.nextState.width = this.mRef.clientWidth;
    }
  }

  private setRef = (ref: HTMLDivElement) => {
    this.mRef = ref;
    this.updateDimensions();
  }

  private valueFormatter = (value: number) => {
    return bytesToString(value) + '/s';
  }

  private labelFormatter = (name: string) => {
    return `${speedDataPoints - parseInt(name, 10)}s ago`;
  }

  private convertData(speeds: number[]): any {
    const padded = Array(speedDataPoints - speeds.length).fill(0).concat(speeds);
    return padded.map((value: number, idx: number) => ({
      name: idx.toString(), speed: value, formatted: this.valueFormatter(value),
    }));
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    speeds: state.persistent.downloads.speedHistory,
    files: state.persistent.downloads.files,
  };
}

export default connect(mapStateToProps)(
  DownloadGraph) as React.ComponentClass<{}>;
