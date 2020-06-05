import * as React from 'react';
import { timeToString } from '../util/util';

export interface IBaseProps {
  className?: string;
  style?: React.CSSProperties;
  min?: number;
  max?: number;
  now: number;
  labelLeft?: string;
  labelRight?: string;
  showPercentage?: boolean;
  showTimeLeft?: boolean;
}

interface IProgressBarState {
  startTime: number;
  startPos: number;
}

/**
 * custom progress bar control, since the one from bootstrap isn't customizable
 * enough
 */
class ProgressBar extends React.PureComponent<IBaseProps, IProgressBarState> {
  constructor(props: IBaseProps) {
    super(props);

    this.state = {
      startTime: undefined,
      startPos: undefined,
    };
  }

  public UNSAFE_componentWillReceiveProps(newProps: IBaseProps) {
    if ((this.props.now !== newProps.now) && (this.state.startTime === undefined)) {
      this.setState({ startTime: Date.now(), startPos: newProps.now });
    }
  }

  public render(): JSX.Element {
    const { className, labelLeft, labelRight, showPercentage, showTimeLeft,
            style, now } = this.props;

    const min = this.props.min || 0;
    const max = this.props.max || 100;
    const percent = Math.floor((now - min) / (max - min) * 100);

    const hasLabel = (labelLeft !== undefined) || (labelRight !== undefined);

    return (
      <div className={(className || '') + ' progressbar'} style={style}>
        <div className='progressbar-container'>
          {hasLabel ? this.renderLabels() : null}
          <div className='progressbar-track'>
            <div className='progressbar-progress' style={{ width: `${percent}%` }} />
          </div>
        </div>
        {showPercentage ? this.renderPercentage(percent) : null}
        {showTimeLeft ? this.renderTimeLeft(percent) : null}
      </div>
    );
  }

  private renderLabels(): JSX.Element {
    const {labelLeft, labelRight} = this.props;

    return (
      <div className='progressbar-labels'>
        <div>{labelLeft || ''}</div>
        <div>{labelRight || ''}</div>
      </div>
    );
  }

  private renderPercentage(percent: number): JSX.Element {
    const percString = ((percent < 0) || (percent > 100))
      ? '???'
      : `${percent}`;
    return <div className='progressbar-percentage'>{percString}%</div>;
  }

  private renderTimeLeft(percent: number): JSX.Element {
    const elapsed = Date.now() - this.state.startTime;

    if (Number.isNaN(elapsed) || (percent === 0)) {
      return null;
    }

    const expected = elapsed / (percent / 100);
    const timeString = (elapsed < expected)
      ? timeToString((expected - elapsed) / 1000)
      : '???';

    return (
      <div className='progressbar-timeleft'>
        {timeString}
      </div>
    );
  }
}

export default ProgressBar;
