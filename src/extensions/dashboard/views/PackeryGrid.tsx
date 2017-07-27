import {} from 'packery';
import * as React from 'react';

export interface IProps {
  totalWidth: number;
  onChangeLayout: (items: string[]) => void;
}

/**
 * wrapper for packery
 *
 * @class Packery
 * @extends {React.Component<IProps, {}>}
 */
class Packery extends React.Component<IProps, {}> {
  private mPackery: any;
  private mRef: Element;
  private mRefreshTimer: NodeJS.Timer;

  constructor(props: IProps) {
    super(props);
  }

  public componentDidUpdate() {
    if (this.mPackery !== undefined) {
      this.mPackery.layout();
    }
  }

  public componentWillReceiveProps(nextProps: IProps) {
    if (nextProps.totalWidth !== this.props.totalWidth) {
      this.scheduleRefresh();
    }
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
            packery: this.mPackery,
          }))}
      </div>
    );
  }

  private refContainer = (ref: Element) => {
    this.mRef = ref;
    // gutter is manually implemented in css as a padding, that way it
    // can access variables
    const options = {
      itemSelector: '.packery-item',
      gutter: 0,
      percentPosition: false,
    };

    if (ref !== null) {
      const PackeryLib = require('packery');
      this.mPackery = new PackeryLib(ref, options);
      this.mPackery.on('layoutComplete', this.saveLayout);
      this.scheduleRefresh();
    } else {
      this.mPackery = undefined;
    }
  }

  private saveLayout = (items) => {
    this.props.onChangeLayout(items.map(item => item.element.id));
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
