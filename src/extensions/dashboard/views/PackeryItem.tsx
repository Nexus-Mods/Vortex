import * as React from 'react';

export interface IProps {
  width: number;
  totalWidth?: number;
}

class PackeryItem extends React.Component<IProps, {}> {
  public render(): JSX.Element {
    const { width, totalWidth } = this.props;
    let perc = Math.floor((width / totalWidth) * 100);
    return (<div style={{ width: `${perc}%` }}>
      {this.props.children}
      </div>);
  }
}

export default PackeryItem;
