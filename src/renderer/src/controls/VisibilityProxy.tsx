import { getErrorMessageOrDefault } from "@vortex/shared";
import * as _ from "lodash";
import * as React from "react";
import * as ReactDOM from "react-dom";

import { log } from "../util/log";

// how long an element stays rendered after becoming visible, however soon it leaves view
const VISIBLE_HOLD_MS = 1000;

// Elements are rendered in two tiers. One entering the scroll area itself renders at once.
// One entering the margin around it (a scroll-area height above and below) renders when the
// renderer is idle, so a wheel scroll finds it already rendered. A jump (a scrollbar click or
// drag) then only waits for the elements actually on screen, not for the whole margin around
// them, and a slow margin render can't hold up the visible ones.
const RENDER_AHEAD_MARGIN = "100% 0px 100% 0px";
// longest an idle render-ahead may wait while the renderer stays busy
const RENDER_AHEAD_TIMEOUT_MS = 500;

type Tier = "view" | "ahead";

const whenIdle: (cb: () => void, opts: { timeout: number }) => number =
  typeof requestIdleCallback === "function"
    ? (cb, opts) => requestIdleCallback(cb, opts)
    : (cb) => setTimeout(cb, 0) as unknown as number;
const cancelIdle: (handle: number) => void =
  typeof cancelIdleCallback === "function"
    ? (handle) => cancelIdleCallback(handle)
    : (handle) => clearTimeout(handle);

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
  private static sObservers: Record<Tier, Map<Element, IntersectionObserver>> = {
    view: new Map(),
    ahead: new Map(),
  };
  private static sInstances: Map<Element, (tier: Tier, visible: boolean) => void> = new Map();

  private static getObserver(tier: Tier, container: HTMLElement) {
    const observers = VisibilityProxy.sObservers[tier];
    const key = container || null;
    if (!observers.has(key)) {
      observers.set(
        key,
        new IntersectionObserver((entries) => VisibilityProxy.callback(tier, entries), {
          root: container,
          rootMargin: tier === "view" ? "0px" : RENDER_AHEAD_MARGIN,
        } as any),
      );
    }
    return observers.get(key);
  }

  private static callback(tier: Tier, entries: IntersectionObserverEntry[]) {
    entries.forEach((entry) => {
      const cb = VisibilityProxy.sInstances.get(entry.target);
      if (cb !== undefined) {
        cb(tier, entry.isIntersecting);
      }
    });
  }

  private static observe(
    container: HTMLElement,
    target: HTMLElement,
    cb: (tier: Tier, visible: boolean) => void,
  ) {
    VisibilityProxy.sInstances.set(target, cb);
    VisibilityProxy.getObserver("view", container).observe(target);
    VisibilityProxy.getObserver("ahead", container).observe(target);
  }

  private static unobserve(container: HTMLElement, target: HTMLElement) {
    if (target === null) {
      return;
    }
    VisibilityProxy.sInstances.delete(target);
    try {
      VisibilityProxy.getObserver("view", container).unobserve(target);
      VisibilityProxy.getObserver("ahead", container).unobserve(target);
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
  #aheadRequest: number | undefined;

  public componentDidMount() {
    const node = ReactDOM.findDOMNode(this) as HTMLElement;
    this.#observed = { container: this.props.container, node };
    VisibilityProxy.observe(this.props.container, node, (tier: Tier, visible: boolean) =>
      this.onTier(node, tier, visible),
    );
  }

  public componentWillUnmount() {
    clearTimeout(this.#hideTimer);
    this.cancelAhead();
    VisibilityProxy.unobserve(this.#observed.container, this.#observed.node);
  }

  // "view" entering: show now. "ahead" entering: show when idle. "ahead" leaving is the
  // element leaving the whole render zone, the only report that hides it.
  private onTier(node: HTMLElement, tier: Tier, visible: boolean) {
    if (tier === "view") {
      if (visible) {
        this.cancelAhead();
        this.onIntersection(node, true);
      }
      return;
    }
    if (!visible) {
      this.cancelAhead();
      this.onIntersection(node, false);
      return;
    }
    this.#inView = true;
    clearTimeout(this.#hideTimer);
    this.#hideTimer = undefined;
    if (this.mLastVisible || this.#aheadRequest !== undefined) {
      return;
    }
    this.#aheadRequest = whenIdle(
      () => {
        this.#aheadRequest = undefined;
        if (this.#inView) {
          this.applyVisible(true);
        }
      },
      { timeout: RENDER_AHEAD_TIMEOUT_MS },
    );
  }

  private cancelAhead() {
    if (this.#aheadRequest !== undefined) {
      cancelIdle(this.#aheadRequest);
      this.#aheadRequest = undefined;
    }
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
