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
 * The componentClasses already warned about, and whether a proxy without one has been. Each
 * warning is logged once, not once per proxy: a list of thousands of entries would flood the log.
 */
const sWarnedComponentClasses = new WeakSet<object>();
let sWarnedNoComponentClass = false;

interface INamedType {
  displayName?: string;
  name?: string;
}

/** A name for the log; a bare `React.memo(fn)` or `forwardRef` has none of its own. */
function componentClassName(componentClass: React.ElementType): string {
  if (typeof componentClass === "string") {
    return componentClass;
  }
  const type = componentClass as INamedType & { type?: INamedType; render?: INamedType };
  return (
    type.displayName ||
    type.name ||
    type.type?.displayName ||
    type.type?.name ||
    type.render?.name ||
    "anonymous"
  );
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

/** Tells an extension author once per componentClass to pass its ref on before React 19. */
function warnNoElement(componentClass: React.ElementType) {
  if (typeof componentClass !== "string") {
    if (sWarnedComponentClasses.has(componentClass)) {
      return;
    }
    sWarnedComponentClasses.add(componentClass);
  }
  log(
    "warn",
    "VisibilityProxy: componentClass doesn't pass its ref on to an element, so Vortex finds " +
      "the element with findDOMNode, which React 19 removes. Wrap the componentClass in " +
      "React.forwardRef and pass the ref to the element it renders",
    { componentClass: componentClassName(componentClass) },
  );
}

/** Whether a ref holds a DOM element, from this window or another. */
function isElement(ref: unknown): ref is Element {
  return (ref as Node | null)?.nodeType === Node.ELEMENT_NODE;
}

const FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
const MEMO_TYPE = Symbol.for("react.memo");

/**
 * Whether a ref given to this componentClass reaches whatever it chooses: a tag, a forwardRef,
 * or a memo of one. It's decided before rendering because a plain function component can't
 * take a ref at all (React logs an error), and a class takes it as its instance, not an element.
 */
function passesRefOn(componentClass: React.ElementType): boolean {
  if (typeof componentClass === "string") {
    return true;
  }
  const type = componentClass as { $$typeof?: symbol; type?: React.ElementType };
  if (type.$$typeof === FORWARD_REF_TYPE) {
    return true;
  }
  return type.$$typeof === MEMO_TYPE && type.type !== undefined && passesRefOn(type.type);
}

/**
 * Finds the element of a componentClass that doesn't pass its ref on, an extension's, the way
 * Vortex did before refs, so its layout stays as it was. React 19 removes findDOMNode, and this
 * goes with it. The test setup lets this one caller through by its name.
 */
function findDOMNodeUntilReact19(instance: React.Component): Element | null {
  const node = ReactDOM.findDOMNode(instance);
  return isElement(node) ? node : null;
}

/**
 * proxy component that delays loading of a control until it comes into view
 *
 * @class VisibilityProxy
 * @extends {React.Component<IProps>}
 */
class VisibilityProxy extends React.PureComponent<any> {
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
  /** the element the ref gave: the componentClass's, or the <div> used when there's none */
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

  /**
   * Forgets the observed element as well as unobserving it: StrictMode and `<Activity>` mount
   * the same instance again, and it has to start observing afresh.
   */
  public componentWillUnmount() {
    this.#mounted = false;
    clearTimeout(this.#hideTimer);
    if (this.#observed !== undefined) {
      VisibilityProxy.unobserve(this.#container, this.#observed);
      this.#observed = undefined;
    }
  }

  /** The element whose visibility this proxy tracks: the componentClass's, or its own <div>. */
  public get element(): Element | null {
    return this.#observed ?? null;
  }

  /**
   * Observes the element the content is in, moving off the one observed before if it was
   * replaced, e.g. by a new componentClass. One that doesn't pass its ref on to an element is
   * found with findDOMNode instead.
   */
  private observeElement() {
    const element = this.#element ?? this.findElementWithoutRef();
    if (element === null || element === this.#observed) {
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
   * The element of a componentClass whose ref gave none. Without a componentClass there's
   * nothing to find: the <div> rendered in its place always hands over its ref. No warning when
   * there's no element yet: a forwardRef that renders null at first gives its ref later.
   */
  private findElementWithoutRef(): Element | null {
    const { componentClass } = this.props;
    if (componentClass === undefined) {
      return null;
    }
    const element = findDOMNodeUntilReact19(this);
    if (element !== null) {
      warnNoElement(componentClass);
    }
    return element;
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
    }
    return (
      <Component {...props} ref={passesRefOn(Component) ? this.setElement : undefined}>
        {content}
      </Component>
    );
  }
}

export default VisibilityProxy;
