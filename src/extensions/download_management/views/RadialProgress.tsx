import * as d3 from 'd3';
import * as React from 'react';

export interface IBar {
  value: number;
  min: number;
  max: number;
  class: string;
}

export interface IBaseProps {
  data: IBar[];
  gap: number;
  totalRadius: number;
  style?: React.CSSProperties;
}

type IProps = IBaseProps;

class RadialProgress extends React.Component<IProps, {}> {
  private mArcGen: d3.Arc<any, IBar>;
  private mRestArcGen: d3.Arc<any, IBar>;
  private mRadiusPerArc: number;

  constructor(props) {
    super(props);

    this.updateArcGen(props);
  }

  public componentWillReceiveProps(newProps: IProps) {
    this.updateArcGen(newProps);
  }

  public render(): JSX.Element {
    const { data, style, totalRadius } = this.props;
    return (
      <svg viewBox='0 0 200 200' style={style}>
        {data.map(this.renderArc)}
      </svg>
    );
  }

  private perc = (bar: IBar) => bar.value / (bar.max - bar.min);

  private renderArc = (bar: IBar, idx: number, arr: IBar[]): JSX.Element => {
    const { totalRadius } = this.props;
    return (
      <g key={idx} transform={`translate(${totalRadius}, ${totalRadius})`}>
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
    const { data, gap, totalRadius } = props;
    this.mRadiusPerArc = totalRadius / (data.length + 1);

    this.mArcGen = d3.arc<any, IBar>()
      .startAngle(0)
      .endAngle((item: IBar) => this.perc(item) * 2 * Math.PI)
      .innerRadius((item: IBar, idx: number, count: number) => this.mRadiusPerArc * (idx + 1))
      .outerRadius((item: IBar, idx: number, count: number) =>
        this.mRadiusPerArc * (idx + 2) - gap);

    this.mRestArcGen = d3.arc<any, IBar>()
      .startAngle((item: IBar) => this.perc(item) * 2 * Math.PI)
      .endAngle(2 * Math.PI)
      .innerRadius((item: IBar, idx: number, count: number) =>
        this.mRadiusPerArc * (idx + 1) + (this.mRadiusPerArc - gap) / 4)
      .outerRadius((item: IBar, idx: number, count: number) =>
        this.mRadiusPerArc * (idx + 2) - gap - (this.mRadiusPerArc - gap) / 4);
   }
}

export default RadialProgress;
