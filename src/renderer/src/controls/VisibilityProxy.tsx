import { log } from "../util/log";

import * as _ from "lodash";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { getErrorMessageOrDefault } from "@vortex/shared";

export interface IProps {
  container: HTMLElement;
  placeholder: () => React.ReactNode;
  content: () => React.ReactNode;
  visible: boolean;
  setVisible: (visible: boolean) => void;
  componentClass?: React.ElementType;
}

/**
 * proxy component that delays loading of a control until it comes into view
 *
 * @class VisibilityProxy
 * @extends {React.Component<IProps, IState>}
 */
class VisibilityProxy extends React.PureComponent<any, {}> {
  // need to use maps because the keys aren't PODs
  private static sObservers: Map<Element, IntersectionObserver> = new Map();
  private static sInstances: Map<Element, (visible: boolean) => void> =
    new Map();

  private static getObserver(container: HTMLElement) {
    if (!VisibilityProxy.sObservers.has(container || null)) {
      VisibilityProxy.sObservers.set(
        container || null,
        new IntersectionObserver(VisibilityProxy.callback, {
          root: container,
          rootMargin: "360px 0px 360px 0px",
        } as any),
      );
    }
    return VisibilityProxy.sObservers.get(container);
  }

  private static callback(
    entries: IntersectionObserverEntry[],
    observer: IntersectionObserver,
  ) {
    entries.forEach((entry) => {
      const cb = VisibilityProxy.sInstances.get(entry.target);
      if (cb !== undefined) {
        cb((entry as any).isIntersecting);
      }
    });
  }

  private static observe(
    container: HTMLElement,
    target: HTMLElement,
    cb: (visible: boolean) => void,
  ) {
    VisibilityProxy.sInstances.set(target, cb);
    VisibilityProxy.getObserver(container).observe(target);
  }

  private static unobserve(container: HTMLElement, target: HTMLElement) {
    if (target === null) {
      return;
    }
    VisibilityProxy.sInstances.delete(target);
    try {
      VisibilityProxy.getObserver(container).unobserve(target);
    } catch (err) {
      // not really critical, just not great for performance
      log("warn", "Failed to unobserve", {
        err: getErrorMessageOrDefault(err),
        id: target.id,
      });
    }
  }

  private mLastVisible: boolean = false;
  private mVisibleTime: number = 0;

  public componentDidMount() {
    const node = ReactDOM.findDOMNode(this) as HTMLElement;
    VisibilityProxy.observe(this.props.container, node, (visible: boolean) => {
      const now = Date.now();
      // workaround: There is the situation where when an element becomes visible it
      //   changes the layout around it which in turn pushes the element somwhere where it
      //   _isn't_ visible anymore, triggering an endless loop of the element switching
      //   between visible and invisible. Hence we don't turn items invisible if it
      //   became visible less than a second ago. Since the observer is flank triggered
      //   this may cause items to be rendered even though they don't have to but this
      //   is a performance optimisation anyway, nothing breaks.
      if (
        this.mLastVisible !== visible &&
        (visible || now - this.mVisibleTime > 1000.0)
      ) {
        this.mLastVisible = visible;
        this.mVisibleTime = now;
        this.props.setVisible?.(visible);
      }
    });
  }

  public componentWillUnmount() {
    VisibilityProxy.unobserve(
      this.props.container,
      ReactDOM.findDOMNode(this) as HTMLElement,
    );
  }

  public render(): JSX.Element {
    const { componentClass: Component } = this.props;
    const props = _.omit(this.props, [
      "container",
      "placeholder",
      "content",
      "visible",
      "setVisible",
      "componentClass",
    ]);

    const content: JSX.Element = this.props.visible
      ? this.props.content()
      : this.props.placeholder();

    if (Component === undefined) {
      // return <div className='visibility-proxy-wrap' {...props}>{content}</div>;
      return <>{content}</>;
    } else {
      return <Component {...props}>{content}</Component>;
    }
  }
}

export default VisibilityProxy;
