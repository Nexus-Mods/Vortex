import PackeryLib = require('packery');

import * as React from 'react';

export interface IProps {
  totalWidth: number;
}

class Packery extends React.Component<IProps, {}> {
  private mPackery: PackeryLib;
  private mRefreshTimer: NodeJS.Timer;

  constructor(props: IProps) {
    super(props);
  }

  public componentDidUpdate() {
    this.mPackery.layout();
  }

  public componentWillReceiveProps() {
    if (this.mRefreshTimer !== undefined) {
      clearTimeout(this.mRefreshTimer);
    }
    this.mRefreshTimer = setTimeout(() => {
      this.mPackery.reloadItems();
      this.forceUpdate();
      this.mRefreshTimer = undefined;
    }, 50);
  }

  public componentWillUnmount() {
    clearTimeout(this.mRefreshTimer);
  }

  public render(): JSX.Element {
    const {children, totalWidth} = this.props;
    return (<div ref={this.refContainer}>
      {React.Children.map(children,
        (child: React.ReactElement<any>) => React.cloneElement(child, {
          totalWidth,
        }))}
    </div>);
  }

  private refContainer = (ele: Element) => {
    const options = {};
    let PackeryLibImpl = require('packery');
    this.mPackery = new PackeryLibImpl(ele, options);
  }
}

export default Packery;
