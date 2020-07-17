import * as _ from 'lodash';
import { PackeryOptions } from 'packery';
import * as React from 'react';

const LAYOUT_SETTLE_MS = 5000;

export interface IProps {
  totalWidth: number;
  onChangeLayout: (items: string[]) => void;
  settings: any;
  items: string[];
}

function setEqual(lhs: Set<any>, rhs: Set<any>) {
  // catch case where lhs is a subset or superset of rhs
  if (lhs.size !== rhs.size) {
    return false;
  }

  // if they are the same size and each element from lhs exists
  // in rhs they have to be the same. This is a set (no duplicates)
  // after all
  return (Array.from(lhs.keys())
    .find(lKey => !rhs.has(lKey)) === undefined);
}

/**
 * wrapper for packery
 *
 * @class Packery
 * @extends {React.Component<IProps, {}>}
 */
class Packery extends React.Component<IProps, {}> {
  private mPackery: any;
  private mLayoutTimer: NodeJS.Timer;
  private mRefreshTimer: NodeJS.Timer;
  private mChildren: Set<string>;
  private mMounted: number = 0;

  constructor(props: typeof Packery.prototype.props) {
    super(props);
    this.mChildren = new Set(React.Children.map(props.children, (child: any) => child.key));
  }

  public componentDidUpdate() {
    // TODO: If we layout here without condition packery end up in an endless loop were every
    //   layout triggers didUpdate again
    //   But on startup we need several layout calls before the the layout has actually settled
    //   and everything is where it should be. Haven't found a nice solution yet
    if (Date.now() - this.mMounted < LAYOUT_SETTLE_MS) {
      this.scheduleLayout();
    }
  }

  public componentDidMount() {
    this.mMounted = Date.now();
  }

  public UNSAFE_componentWillReceiveProps(nextProps: typeof Packery.prototype.props) {
    const nextChildren = new Set<string>(
      React.Children.map(nextProps.children, (child: any) => child.key));
    if ((nextProps.totalWidth !== this.props.totalWidth)
        || !setEqual(this.mChildren, nextChildren)) {
      this.mChildren = nextChildren;
      this.scheduleRefresh();
    }

    if (nextProps.settings !== this.props.settings) {
      this.scheduleLayout();
    }

    if (!_.isEqual(nextProps.items, this.props.items)) {
      this.scheduleLayout();
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
      this.mPackery.on('dragItemPositioned', (draggedItem) => {
        this.scheduleLayout();
      });
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
