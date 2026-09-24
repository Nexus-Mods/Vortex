import { getErrorMessageOrDefault } from "@vortex/shared";
import * as _ from "lodash";
import * as React from "react";
import * as ReactDOM from "react-dom";

import { log } from "../util/log";

// how long an element stays rendered after becoming visible, however soon it leaves view
const VISIBLE_HOLD_MS = 1000;

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
  private static sInstances: Map<Element, (visible: boolean) => void> = new Map();

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

  private static callback(entries: IntersectionObserverEntry[], observer: IntersectionObserver) {
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
  // `container` is read once, on mount; a later change is ignored. The conflict editor
  // passes a ref's `current`, null until it re-renders and then an element that doesn't
  // clip, so moving to the new container would count every entry as visible.
  #observed: { container: HTMLElement; node: HTMLElement };
  #inView: boolean = false;
  #hideTimer: ReturnType<typeof setTimeout> | undefined;

  public componentDidMount() {
    const node = ReactDOM.findDOMNode(this) as HTMLElement;
    this.#observed = { container: this.props.container, node };
    VisibilityProxy.observe(this.props.container, node, (visible: boolean) =>
      this.onIntersection(node, visible),
    );
  }

  public componentDidUpdate() {
    // The parent can show the content itself (the table does, for rows a scroll brought into
    // view). Count that as shown, so the observer's later "not visible" still hides it.
    if (this.props.visible && !this.mLastVisible) {
      this.mLastVisible = true;
      this.mVisibleTime = Date.now();
      this.#inView = true;
    }
  }

  public componentWillUnmount() {
    clearTimeout(this.#hideTimer);
    VisibilityProxy.unobserve(this.#observed.container, this.#observed.node);
  }

  // workaround: There is the situation where when an element becomes visible it
  //   changes the layout around it which in turn pushes the element somwhere where it
  //   _isn't_ visible anymore, triggering an endless loop of the element switching
  //   between visible and invisible. Hence we don't turn items invisible if it
  //   became visible less than a second ago. The observer is flank triggered, so it won't
  //   report the element again: a hide that arrives within that second is deferred until
  //   the second has passed, then applied if the element is still out of view.
  private onIntersection(node: HTMLElement, visible: boolean) {
    this.#inView = visible;
    if (visible) {
      clearTimeout(this.#hideTimer);
      this.#hideTimer = undefined;
      this.applyVisible(true);
      return;
    }
    if (!this.mLastVisible || this.#hideTimer !== undefined) {
      return;
    }
    const remaining = VISIBLE_HOLD_MS - (Date.now() - this.mVisibleTime);
    if (remaining < 0) {
      this.applyVisible(false);
    } else {
      this.#hideTimer = setTimeout(() => {
        this.#hideTimer = undefined;
        // without a componentClass, content that renders a different element replaces the
        // observed node. A report on the detached node says nothing about the content.
        if (!this.#inView && node.isConnected) {
          this.applyVisible(false);
        }
      }, remaining);
    }
  }

  private applyVisible(visible: boolean) {
    if (this.mLastVisible !== visible) {
      this.mLastVisible = visible;
      this.mVisibleTime = Date.now();
      this.props.setVisible?.(visible);
    }
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
