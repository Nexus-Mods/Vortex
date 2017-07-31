import update = require('immutability-helper');
import * as React from 'react';
import * as ReactDOM from 'react-dom';

interface IRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface IProps {
  container?: HTMLElement;
  placeholder: JSX.Element;
}

export interface IState {
  visible: boolean;
}

/**
 * proxy component that delays loading of a control until it comes into view
 *
 * @class VisibilityProxy
 * @extends {React.Component<IProps, IState>}
 */
class VisibilityProxy extends React.Component<IProps, IState> {
  private mNode: Element;
  private mDebounceTimer: NodeJS.Timer;
  private mTimer: NodeJS.Timer;

  constructor(props: IProps) {
    super(props);
    this.state = {
      visible: false,
    };
  }

  public componentDidMount() {
    this.mNode = ReactDOM.findDOMNode(this);
    if (!this.testVisible()) {
      this.watch();
    }
  }

  public componentWillUnmount() {
    this.unwatch();
  }

  public render(): JSX.Element {
    if (this.state.visible) {
      return React.Children.only(this.props.children);
    } else {
      return this.props.placeholder;
    }
  }

  private get container(): HTMLElement | Window {
    return this.props.container || window;
  }

  private get containerRect(): IRect {
    const {container} = this.props;
    if (container) {
      const rect = container.getBoundingClientRect();
      return {
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        right: rect.right,
      };
    } else {
      return {
        top: 0,
        left: 0,
        bottom: window.innerHeight,
        right: window.innerWidth,
      };
    }
  }

  private watch() {
    this.startTimer();
    this.container.addEventListener('scroll', this.testVisibleTimer);
    this.container.addEventListener('resize', this.testVisibleTimer);
  }

  private unwatch() {
    this.container.removeEventListener('scroll', this.testVisibleTimer);
    this.container.removeEventListener('resize', this.testVisibleTimer);
    clearTimeout(this.mTimer);
  }

  private startTimer() {
    this.mTimer = setTimeout(() => {
      this.testVisibleTimer();
      this.startTimer();
    }, 1000);
  }

  private testVisibleTimer = () => {
    if (this.mDebounceTimer !== undefined) {
      // update already scheduled
      return;
    }
    this.mDebounceTimer = setTimeout(() => {
      this.mDebounceTimer = undefined;
      this.testVisible();
    }, 100);
  }

  private testVisible() {
    if (this.mNode === undefined) {
      return false;
    }
    const bounds = this.mNode.getBoundingClientRect();
    const refRect = this.containerRect;
    const newVisible = !(
      (bounds.bottom < refRect.top)
      || (bounds.top > refRect.bottom)
      || (bounds.right < refRect.left)
      || (bounds.left > refRect.right)
    );

    if (newVisible !== this.state.visible) {
      this.setState(update(this.state, {
        visible: { $set: newVisible },
      }));
    }
    if (newVisible) {
      this.unwatch();
    }
    return newVisible;
  }

}

export default VisibilityProxy;
