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
  placeholder: () =>  JSX.Element;
  content: () =>  JSX.Element;
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
  // need to use maps because the keys aren't PODs
  private static sObservers: Map<Element, IntersectionObserver> = new Map();
  private static sInstances: Map<Element, () => void> = new Map();

  private static getObserver(container: HTMLElement) {
    if (!VisibilityProxy.sObservers.has(container || null)) {
      VisibilityProxy.sObservers.set(container || null,
          new IntersectionObserver(VisibilityProxy.callback, {
        root: container,
      }));
    }
    return VisibilityProxy.sObservers.get(container);
  }

  private static callback(entries: IntersectionObserverEntry[], observer: IntersectionObserver) {
    entries.forEach(entry => {
      if (entry.intersectionRatio > 0) {
        const cb = VisibilityProxy.sInstances.get(entry.target);
        if (cb !== undefined) {
          cb();
          observer.unobserve(entry.target);
          VisibilityProxy.sInstances.delete(entry.target);
        }
      }
    });
  }

  private static observe(container: HTMLElement, target: HTMLElement, cb: () => void) {
    VisibilityProxy.sInstances.set(target, cb);
    VisibilityProxy.getObserver(container).observe(target);
  }

  private static unobserve(container: HTMLElement, target: HTMLElement) {
    VisibilityProxy.getObserver(container).unobserve(target);
  }

  constructor(props: IProps) {
    super(props);
    this.state = {
      visible: false,
    };
  }

  public componentDidMount() {
    VisibilityProxy.observe(this.props.container, ReactDOM.findDOMNode(this), () => {
      this.setState({ visible: true });
    });
  }

  public componentWillUnmount() {
    VisibilityProxy.unobserve(this.props.container, ReactDOM.findDOMNode(this));
  }

  public render(): JSX.Element {
    return (this.state.visible)
      ? this.props.content()
      : this.props.placeholder();
  }
}

export default VisibilityProxy;
