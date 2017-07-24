import * as React from 'react';

export interface IProps {
  width: number;
  totalWidth?: number;
}

class PackeryItem extends React.Component<IProps, {}> {
  public render(): JSX.Element {
    const { width, totalWidth } = this.props;
    const perc = Math.floor((width / totalWidth) * 100);
    // we need two nested divs. The outer controls the width of
    // the item and it can't have a margin, otherwise the layout
    // would break.
    return (
      <div style={{ width: `${perc}%` }}>
        <div className='packery-container'>
        {this.props.children}
        </div>
      </div>);
  }
}

export default PackeryItem;
