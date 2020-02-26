import ErrorBoundary from '../../../controls/ErrorBoundary';
import {IState} from '../../../types/IState';
import {ComponentEx, connect} from '../../../util/ComponentEx';
import { bytesToString, truthy } from '../../../util/util';

import {NUM_SPEED_DATA_POINTS} from '../reducers/state';

import { TFunction } from 'i18next';
import * as React from 'react';
import ResizeDetector from 'react-resize-detector';
import * as recharts from 'recharts';

interface IBaseProps {
}

interface IConnectedProps {
  speeds: number[];
}

type IProps = IBaseProps & IConnectedProps;

interface IComponentState {
  width: number;
}

/**
 * download speed dashlet
 */
class DownloadGraph extends ComponentEx<IProps, IComponentState> {

  constructor(props: IProps) {
    super(props);
    this.initState({ width: 800 });
  }

  public componentDidMount() {
    this.forceUpdate();
  }

  public render(): JSX.Element {
    const {speeds} = this.props;
    const data = this.convertData(speeds);

    const maxData = Math.max(...speeds);
    const maxRounded = this.byteRound(maxData);
    const ticks = [0, this.byteRound(maxRounded / 3),
                   this.byteRound((maxRounded * 2) / 3), maxRounded];

    // TODO: animation disabled because https://github.com/recharts/recharts/issues/375
    return (
      <div className='chart-container download-chart' ref={this.setRef} >
        <ErrorBoundary>
          <recharts.AreaChart width={this.state.width} height={120} data={data}>
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
        </ErrorBoundary>
        <ErrorBoundary>
          <ResizeDetector handleWidth handleHeight onResize={this.onResize}/>
        </ErrorBoundary>
      </div>
    );
  }

  private onResize = (width: number, height: number) => {
    this.nextState.width = width;
  }

  private byteRound(input: number): number {
    const roundVal = 128 * 1024;
    return Math.ceil(input / roundVal) * roundVal;
  }

  private setRef = (ref: HTMLDivElement) => {
    if (truthy(ref)) {
      this.onResize(ref.clientWidth, ref.clientHeight);
    }
  }

  private valueFormatter = (value: number) => {
    return bytesToString(value) + '/s';
  }

  /*
  private labelFormatter = (name: string) => {
    return `${speedDataPoints - parseInt(name, 10)}s ago`;
  }*/

  private convertData(speeds: number[]): any {
    const padded = Array(NUM_SPEED_DATA_POINTS - speeds.length).fill(0).concat(speeds);
    return padded.map((value: number, idx: number) => ({
      name: idx.toString(), speed: value, formatted: this.valueFormatter(value),
    }));
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    speeds: state.persistent.downloads.speedHistory,
  };
}

export default connect(mapStateToProps)(DownloadGraph);
