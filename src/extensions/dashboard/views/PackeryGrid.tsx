import PackeryLib = require('packery');

import * as React from 'react';

export interface IProps {
  totalWidth: number;
}

/**
 * wrapper for packery
 *
 * @class Packery
 * @extends {React.Component<IProps, {}>}
 */
class Packery extends React.Component<IProps, {}> {
  private mPackery: any;
  private mRefreshTimer: NodeJS.Timer;

  constructor(props: IProps) {
    super(props);
  }

  public componentDidUpdate() {
    if (this.mPackery !== undefined) {
      this.mPackery.layout();
    }
  }

  public componentWillReceiveProps() {
    this.scheduleRefresh();
  }

  public componentDidMount() {
    setImmediate(() => {
      if (this.mPackery !== undefined) {
        this.mPackery.layout();
      }
    });
  }

  public componentWillUnmount() {
    clearTimeout(this.mRefreshTimer);
    this.mPackery = undefined;
  }

  public render(): JSX.Element {
    const {children, totalWidth} = this.props;
    return (
      <div ref={this.refContainer}>
        {React.Children.map(children,
          (child: React.ReactElement<any>) => React.cloneElement(child, {
            totalWidth,
          }))}
      </div>
    );
  }

  private refContainer = (ele: Element) => {
    const options = {};
    if (ele !== null) {
      const PackeryLibImpl = require('packery');
      this.mPackery = new PackeryLibImpl(ele, options);
    } else {
      this.mPackery = undefined;
    }
  }

  private scheduleRefresh() {
    if (this.mRefreshTimer !== undefined) {
      clearTimeout(this.mRefreshTimer);
    }
    this.mRefreshTimer = setTimeout(() => {
      this.mRefreshTimer = undefined;
      if (this.mPackery !== undefined) {
        this.mPackery.reloadItems();
        this.forceUpdate();
      } else {
        this.scheduleRefresh();
      }
    }, 50);
  }
}

export default Packery;
