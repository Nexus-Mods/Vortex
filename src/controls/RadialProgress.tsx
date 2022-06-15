import * as d3 from 'd3';
import * as React from 'react';

const spinData = {
  class: 'running',
  min: 0,
  max: 100,
  value: 25,
};

export interface IBar {
  value: number;
  min: number;
  max: number;
  class: string;
}

export interface IBaseProps {
  data: IBar[];
  className?: string;
  innerGap?: number;
  gap?: number;
  totalRadius: number;
  offset?: number;
  maxWidth?: number;
  style?: React.CSSProperties;
  restOverlap?: boolean;
  spin?: boolean;
}

type IProps = IBaseProps;

class RadialProgress extends React.Component<IProps, {}> {
  private mArcGen: d3.Arc<any, IBar>;
  private mRestArcGen: d3.Arc<any, IBar>;
  private mWidthPerArc: number;

  constructor(props) {
    super(props);

    this.updateArcGen(props);
  }

  public UNSAFE_componentWillReceiveProps(newProps: IProps) {
    this.updateArcGen(newProps);
  }

  public render(): JSX.Element {
    const { className, data, offset, style, totalRadius, spin } = this.props;
    const sideLength = (totalRadius + (offset || 0)) * 2;

    const classNames = ['radial', className];

    let progressData = [...data]
    
    if (spin && progressData.length == 0) {
      // The normal progress has higher priority than the spin
      classNames.push('radial--spin');
      progressData.push(spinData);
    }

    return (
      <svg className={classNames.join(' ')} viewBox={`0 0 ${sideLength} ${sideLength}`} style={style}>
        {progressData.map(this.renderArc)}
      </svg>
    );
  }

  private perc = (bar: IBar) => bar.value / (bar.max - bar.min);

  private renderArc = (bar: IBar, idx: number, arr: IBar[]): JSX.Element => {
    const { offset, totalRadius } = this.props;
    return (
      <g
        key={idx}
        transform={`translate(${totalRadius + (offset || 0)}, ${totalRadius + (offset || 0)})`}
      >
        <path
          className={`radial-progress radial-progress-${bar.class}`}
          d={this.mArcGen(bar, idx, arr.length)}
        />

        <path
          className='radial-rest'
          d={this.mRestArcGen(bar, idx, arr.length)}
        />
      </g>
    );
  }

  private updateArcGen(props: IProps) {
    const { data, maxWidth, totalRadius } = props;
    const length = Math.max(data.length + 1, 2);
    this.mWidthPerArc = totalRadius / length;
    if (maxWidth !== undefined) {
      this.mWidthPerArc = Math.min(this.mWidthPerArc, maxWidth);
    }

    const offset = this.props.offset ?? 0;
    const gap = this.props.gap ?? 1;
    const innerGap = this.props.innerGap ?? 0;
    const restOverlap = this.props.restOverlap ?? true;

    const inner = (isRest: boolean, idx: number) => {
      let res = offset + innerGap + this.mWidthPerArc * (idx + 1);
      if (isRest && restOverlap) {
        res += (this.mWidthPerArc - gap) / 4;
      }
      return res;
    };

    const outer = (isRest: boolean, idx: number) => {
      let res = offset + this.mWidthPerArc * (idx + 2);
      if (isRest && restOverlap) {
        res -= gap - (this.mWidthPerArc - gap) / 4;
      }
      return res;
    };

    this.mArcGen = d3.arc<any, IBar>()
      .startAngle(0)
      .endAngle((item: IBar) => this.perc(item) * 2 * Math.PI)
      .cornerRadius(4)
      .innerRadius((item: IBar, idx: number, count: number) => inner(false, idx))
      .outerRadius((item: IBar, idx: number, count: number) => outer(false, idx));

    this.mRestArcGen = d3.arc<any, IBar>()
      .startAngle((item: IBar) => this.perc(item) * 2 * Math.PI)
      .endAngle(2 * Math.PI)
      .innerRadius((item: IBar, idx: number, count: number) => inner(true, idx))
      .outerRadius((item: IBar, idx: number, count: number) => outer(true, idx));
   }
}

export default RadialProgress as React.ComponentClass<IBaseProps>;
