import * as React from 'react';

export interface IBaseProps {
  className?: string;
  min?: number;
  max?: number;
  now: number;
  labelLeft?: string;
  labelRight?: string;
  showPercentage?: boolean;
}

/**
 * custom progress bar control, since the one from bootstrap isn't customizable
 * enough
 */
class ProgressBar extends React.PureComponent<IBaseProps, {}> {
  public render(): JSX.Element {
    const { className, labelLeft, labelRight, showPercentage, now } = this.props;

    const min = this.props.min || 0;
    const max = this.props.max || 100;
    const percent = Math.floor((now - min) / (max - min) * 100);

    const hasLabel = (labelLeft !== undefined) || (labelRight !== undefined);

    return (
      <div className={(className || '') + ' progressbar'}>
        <div className='progressbar-container'>
          {hasLabel ? this.renderLabels() : null}
          <div className='progressbar-track'>
            <div className='progressbar-progress' style={{ width: `${percent}%` }} />
          </div>
        </div>
        {showPercentage ? this.renderPercentage(percent) : null}
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
    return <div className='progressbar-percentage'>{percent}%</div>;
  }
}

export default ProgressBar;
