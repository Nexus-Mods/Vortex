import { getErrorMessageOrDefault } from "@vortex/shared";
import * as _ from "lodash";
import * as React from "react";

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
  #observed: { container: HTMLElement; node: HTMLElement } | undefined;
  // the element render() puts the content in: the componentClass's, or the wrapping <div>
  #element: HTMLElement | null = null;
  #inView: boolean = false;
  #hideTimer: ReturnType<typeof setTimeout> | undefined;

  public componentDidMount() {
    const node = this.#element;
    if (node === null) {
      // A componentClass that doesn't pass its ref on to an element leaves nothing to observe,
      // so there's no telling when it comes into view. Show the content rather than a
      // placeholder that never fills, and say so: that content no longer loads lazily.
      const { componentClass } = this.props;
      log(
        "warn",
        "VisibilityProxy: componentClass doesn't pass its ref on to an element, so its " +
          "content renders right away instead of when it scrolls into view",
        {
          componentClass:
            typeof componentClass === "string"
              ? componentClass
              : (componentClass?.displayName ?? componentClass?.name),
        },
      );
      this.applyVisible(true);
      return;
    }
    this.#observed = { container: this.props.container, node };
    VisibilityProxy.observe(this.props.container, node, (visible: boolean) =>
      this.onIntersection(visible),
    );
  }

  public componentWillUnmount() {
    clearTimeout(this.#hideTimer);
    if (this.#observed !== undefined) {
      VisibilityProxy.unobserve(this.#observed.container, this.#observed.node);
    }
  }

  /** The element whose visibility this proxy tracks: the componentClass's, or its own <div>. */
  public get element(): HTMLElement | null {
    return this.#element;
  }

  private setElement = (ref: unknown) => {
    this.#element = ref instanceof HTMLElement ? ref : null;
  };

  // workaround: There is the situation where when an element becomes visible it
  //   changes the layout around it which in turn pushes the element somwhere where it
  //   _isn't_ visible anymore, triggering an endless loop of the element switching
  //   between visible and invisible. Hence we don't turn items invisible if it
  //   became visible less than a second ago. The observer is flank triggered, so it won't
  //   report the element again: a hide that arrives within that second is deferred until
  //   the second has passed, then applied if the element is still out of view.
  private onIntersection(visible: boolean) {
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
        if (!this.#inView) {
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
      return <div ref={this.setElement}>{content}</div>;
    } else {
      return (
        <Component {...props} ref={this.setElement}>
          {content}
        </Component>
      );
    }
  }
}

export default VisibilityProxy;
