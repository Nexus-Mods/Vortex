import * as React from 'react';

export interface IProps {
  width: number;
  height: number;
  totalWidth?: number;
}

class PackeryItem extends React.Component<IProps, {}> {
  public render(): JSX.Element {
    const { height, width, totalWidth } = this.props;
    const widthPerc = Math.floor((width / totalWidth) * 100);
    // we need two nested divs. The outer controls the width of
    // the item and it can't have a margin, otherwise the layout
    // would break.
    return (
      <div style={{ width: `${widthPerc}%` }} className={`packery-item packery-height-${height}`}>
        {this.props.children}
      </div>);
  }
}

export default PackeryItem;
