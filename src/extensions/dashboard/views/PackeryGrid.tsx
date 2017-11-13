import { PackeryOptions } from 'packery';
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
  private mLayoutTimer: NodeJS.Timer;
  private mRefreshTimer: NodeJS.Timer;

  constructor(props: IProps) {
    super(props);
  }

  public componentDidUpdate() {
    this.scheduleLayout();
  }

  public componentWillReceiveProps(nextProps: typeof Packery.prototype.props) {
    if ((nextProps.totalWidth !== this.props.totalWidth)
      || (React.Children.count(nextProps.children)
        !== React.Children.count(this.props.children))) {
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
    const options: PackeryOptions = {
      itemSelector: '.packery-item',
      gutter: 0,
      percentPosition: false,
      stamp: '.stamp',
    };

    if (ref !== null) {
      // there are no typings for current packery version
      const PackeryLib = require('packery');
      this.mPackery = new PackeryLib(ref, options);
      this.mPackery.on('layoutComplete', this.saveLayout);
      this.scheduleRefresh();
    } else {
      this.mPackery = undefined;
    }
  }

  private saveLayout = (items) => {
    // TODO: this gets called a lot, is that a bug?
    this.props.onChangeLayout(items.map(item => item.element.id));
  }

  private scheduleLayout() {
    if (this.mLayoutTimer !== undefined) {
      clearTimeout(this.mLayoutTimer);
    }
    this.mLayoutTimer = setTimeout(() => {
      this.mLayoutTimer = undefined;
      if (this.mPackery !== undefined) {
        this.mPackery.layout();
      }
    }, 50);
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
