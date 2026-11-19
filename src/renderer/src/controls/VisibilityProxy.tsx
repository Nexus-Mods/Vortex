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

interface IState {
  /** the componentClass gave no element to observe, so the content goes in a <div> inside it */
  wrapContent: boolean;
}

/**
 * The componentClasses already warned about, and whether a proxy without one has been. Each
 * warning is logged once, not once per proxy: a list of thousands of entries would flood the log.
 */
const sWarnedComponentClasses = new WeakSet<object>();
let sWarnedNoComponentClass = false;

function componentClassName(componentClass: React.ElementType): string | undefined {
  return typeof componentClass === "string"
    ? componentClass
    : ((componentClass as { displayName?: string }).displayName ?? componentClass.name);
}

/** Tells an extension author once that a proxy without a componentClass adds a <div>. */
function warnNoComponentClass() {
  if (sWarnedNoComponentClass) {
    return;
  }
  sWarnedNoComponentClass = true;
  log(
    "warn",
    "VisibilityProxy without a componentClass wraps its content in a <div>, which breaks " +
      "layout inside a <tbody>, a list, a flex or a grid. Pass the element to render as " +
      "componentClass",
  );
}

/** Tells an extension author once per componentClass that their content gets an extra <div>. */
function warnNoElement(componentClass: React.ElementType) {
  if (typeof componentClass !== "string") {
    if (sWarnedComponentClasses.has(componentClass)) {
      return;
    }
    sWarnedComponentClasses.add(componentClass);
  }
  log(
    "warn",
    "VisibilityProxy: componentClass doesn't pass its ref on to an element, so its content " +
      "is wrapped in a <div> to see when it scrolls into view",
    { componentClass: componentClassName(componentClass) },
  );
}

/** Whether a ref holds a DOM element, from this window or another. */
function isElement(ref: unknown): ref is Element {
  return (ref as Node | null)?.nodeType === Node.ELEMENT_NODE;
}

/**
 * proxy component that delays loading of a control until it comes into view
 *
 * @class VisibilityProxy
 * @extends {React.Component<IProps, IState>}
 */
class VisibilityProxy extends React.PureComponent<any, IState> {
  // need to use maps because the keys aren't PODs
  private static sObservers: Map<Element, IntersectionObserver> = new Map();
  private static sInstances: Map<Element, (visible: boolean) => void> = new Map();

  private static getObserver(container: HTMLElement) {
    const root = container || null;
    if (!VisibilityProxy.sObservers.has(root)) {
      VisibilityProxy.sObservers.set(
        root,
        new IntersectionObserver(VisibilityProxy.callback, {
          root,
          rootMargin: "360px 0px 360px 0px",
        } as any),
      );
    }
    return VisibilityProxy.sObservers.get(root);
  }

  private static callback(entries: IntersectionObserverEntry[], observer: IntersectionObserver) {
    entries.forEach((entry) => {
      const cb = VisibilityProxy.sInstances.get(entry.target);
      if (cb !== undefined) {
        cb((entry as any).isIntersecting);
      }
    });
  }

  private static observe(container: HTMLElement, target: Element, cb: (visible: boolean) => void) {
    VisibilityProxy.sInstances.set(target, cb);
    VisibilityProxy.getObserver(container).observe(target);
  }

  private static unobserve(container: HTMLElement, target: Element) {
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

  public state: IState = { wrapContent: false };

  private mLastVisible: boolean = false;
  private mVisibleTime: number = 0;
  /**
   * The container read on mount; a later change is ignored. The conflict editor passes a ref's
   * `current`, null until it re-renders and then an element that doesn't clip, so moving to the
   * new container would count every entry as visible.
   */
  #container: HTMLElement | undefined;
  #mounted: boolean = false;
  #observed: Element | undefined;
  /** the element render() puts the content in: the componentClass's, or the wrapping <div> */
  #element: Element | null = null;
  #inView: boolean = false;
  #hideTimer: ReturnType<typeof setTimeout> | undefined;

  public componentDidMount() {
    this.#mounted = true;
    this.#container = this.props.container;
    if (this.props.componentClass === undefined) {
      warnNoComponentClass();
    }
    this.observeElement();
  }

  public componentDidUpdate() {
    this.observeElement();
  }

  public componentWillUnmount() {
    this.#mounted = false;
    clearTimeout(this.#hideTimer);
    if (this.#observed !== undefined) {
      VisibilityProxy.unobserve(this.#container, this.#observed);
    }
  }

  /** The element whose visibility this proxy tracks: the componentClass's, or its own <div>. */
  public get element(): Element | null {
    return this.#element;
  }

  /**
   * Observes the element render() put the content in, moving off the one observed before if
   * it was replaced, e.g. by a new componentClass. A componentClass that gave no element gets
   * its content wrapped in a <div> on the next render, and that <div> is observed instead.
   */
  private observeElement() {
    const element = this.#element;
    if (element === null) {
      if (!this.state.wrapContent) {
        warnNoElement(this.props.componentClass);
        this.setState({ wrapContent: true });
      }
      return;
    }
    if (element === this.#observed) {
      return;
    }
    if (this.#observed !== undefined) {
      VisibilityProxy.unobserve(this.#container, this.#observed);
    }
    this.#observed = element;
    VisibilityProxy.observe(this.#container, element, (visible: boolean) =>
      this.onIntersection(visible),
    );
  }

  /**
   * Once mounted, a new element is observed as soon as its ref arrives: a componentClass can
   * replace its element without this proxy re-rendering, as Fast Refresh does in development.
   */
  private setElement = (ref: unknown) => {
    this.#element = isElement(ref) ? ref : null;
    if (this.#mounted && this.#element !== null) {
      this.observeElement();
    }
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
    const { wrapContent } = this.state;
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
    } else if (wrapContent) {
      return (
        <Component {...props}>
          <div ref={this.setElement}>{content}</div>
        </Component>
      );
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
