/**
 * Tests for which IntersectionObserver root a VisibilityProxy is observed against. The
 * root is what decides whether the proxy counts as visible: one that doesn't clip counts
 * everything inside it as on screen.
 */
import { render } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { log } from "../util/log";
import VisibilityProxy from "./VisibilityProxy";

vi.mock("../util/log", () => ({ log: vi.fn() }));

interface IObserverCall {
  op: "observe" | "unobserve";
  root: Element | null;
  target: Element;
}

const calls: IObserverCall[] = [];

class FakeIntersectionObserver {
  private mRoot: Element | null;
  constructor(_callback: unknown, options: IntersectionObserverInit) {
    this.mRoot = (options.root as Element) ?? null;
  }
  public observe(target: Element) {
    calls.push({ op: "observe", root: this.mRoot, target });
  }
  public unobserve(target: Element) {
    calls.push({ op: "unobserve", root: this.mRoot, target });
  }
  public disconnect() {
    // nop
  }
}

beforeAll(() => {
  window.IntersectionObserver = FakeIntersectionObserver as any;
});

// testing-library unmounts each test's proxy after the test, so its unobserve lands late
beforeEach(() => {
  calls.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function Proxy(props: { container: HTMLElement | null }) {
  return (
    <VisibilityProxy
      container={props.container}
      content={() => <div />}
      placeholder={() => <div data-testid="entry" />}
      visible={false}
      setVisible={() => undefined}
    />
  );
}

/** A componentClass that renders a <section> and passes its ref on to it. */
const Section = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  function Section(props, ref) {
    return <section ref={ref} {...props} />;
  },
);

/** A componentClass whose ref is its instance, not an element. */
class Opaque extends React.Component<{ children?: React.ReactNode }> {
  public render() {
    return <div>{this.props.children}</div>;
  }
}

describe("VisibilityProxy", () => {
  it("is observed against the container it mounts with", () => {
    const scroller = document.createElement("div");
    const { getByTestId } = render(<Proxy container={scroller} />);

    expect(calls).toEqual([
      { op: "observe", root: scroller, target: getByTestId("entry").parentElement },
    ]);
  });

  // The conflict editor passes a ref's `current`: null on the first render, where the
  // viewport (clipped by the modal body) is the root that virtualises its entries, and
  // an unclipped wrapper <div> on every render after that.
  it("keeps the root it mounted with when the container changes", () => {
    const { getByTestId, rerender, unmount } = render(<Proxy container={null} />);
    const wrapper = getByTestId("entry").parentElement;

    rerender(<Proxy container={document.createElement("div")} />);
    unmount();

    expect(calls).toEqual([
      { op: "observe", root: null, target: wrapper },
      { op: "unobserve", root: null, target: wrapper },
    ]);
  });

  it("observes a <div> around its content when it has no componentClass", () => {
    const { getByTestId } = render(<Proxy container={null} />);

    const wrapper = getByTestId("entry").parentElement;
    expect(wrapper?.tagName).toBe("DIV");
    expect(calls).toEqual([{ op: "observe", root: null, target: wrapper }]);
  });

  it("observes the element its componentClass renders", () => {
    const { getByTestId } = render(
      <VisibilityProxy
        componentClass="div"
        container={null}
        content={() => null}
        data-testid="row"
        placeholder={() => null}
        visible={false}
        setVisible={() => undefined}
      />,
    );

    expect(calls).toEqual([{ op: "observe", root: null, target: getByTestId("row") }]);
  });

  it("observes the element a componentClass passes its ref on to", () => {
    const { getByTestId } = render(
      <VisibilityProxy
        componentClass={Section}
        container={null}
        content={() => null}
        data-testid="row"
        placeholder={() => null}
        visible={false}
        setVisible={() => undefined}
      />,
    );

    expect(calls).toEqual([{ op: "observe", root: null, target: getByTestId("row") }]);
  });

  it("is observed against the viewport when its container is undefined", () => {
    const { getByTestId } = render(<Proxy container={undefined} />);

    expect(calls).toEqual([
      { op: "observe", root: null, target: getByTestId("entry").parentElement },
    ]);
  });

  it("observes an SVG element its componentClass renders", () => {
    const { getByTestId } = render(
      <VisibilityProxy
        componentClass="svg"
        container={null}
        content={() => null}
        data-testid="row"
        placeholder={() => null}
        visible={false}
        setVisible={() => undefined}
      />,
    );

    expect(calls).toEqual([{ op: "observe", root: null, target: getByTestId("row") }]);
  });

  // e.g. a componentClass made inline, which is a new component on every render
  it("moves to the new element when its componentClass replaces it", () => {
    const Other = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
      function Other(props, ref) {
        return <article ref={ref} {...props} />;
      },
    );
    const renderWith = (componentClass: React.ElementType) => (
      <VisibilityProxy
        componentClass={componentClass}
        container={null}
        content={() => null}
        data-testid="row"
        placeholder={() => null}
        visible={false}
        setVisible={() => undefined}
      />
    );
    const { getByTestId, rerender } = render(renderWith(Section));
    const before = getByTestId("row");

    rerender(renderWith(Other));

    expect(calls).toEqual([
      { op: "observe", root: null, target: before },
      { op: "unobserve", root: null, target: before },
      { op: "observe", root: null, target: getByTestId("row") },
    ]);
  });

  // An extension's componentClass may not pass its ref on. Its element is found the way it was
  // before refs, so its layout doesn't change, until React 19 removes findDOMNode.
  it("observes the element of a class componentClass, with nothing added around its content", () => {
    const setVisible = vi.fn();

    const { container, getByTestId } = render(
      <VisibilityProxy
        componentClass={Opaque}
        container={null}
        content={() => null}
        placeholder={() => <span data-testid="entry" />}
        visible={false}
        setVisible={setVisible}
      />,
    );

    const element = getByTestId("entry").parentElement;
    expect(element?.parentElement).toBe(container);
    expect(calls).toEqual([{ op: "observe", root: null, target: element }]);
    expect(setVisible).not.toHaveBeenCalled();
    // an extension author learns to forward the ref before React 19
    expect(log).toHaveBeenCalledWith(
      "warn",
      expect.stringContaining("React.forwardRef"),
      expect.objectContaining({ componentClass: "Opaque" }),
    );
  });

  it("keeps the cells of a function componentClass's <tr> straight in it", () => {
    const consoleError = vi.spyOn(console, "error");
    const Row = (props: React.HTMLAttributes<HTMLTableRowElement>) => <tr {...props} />;

    const { getByTestId } = render(
      <table>
        <tbody>
          <VisibilityProxy
            componentClass={Row}
            container={null}
            content={() => null}
            placeholder={() => <td data-testid="cell" />}
            visible={false}
            setVisible={() => undefined}
          />
        </tbody>
      </table>,
    );

    const row = getByTestId("cell").parentElement;
    expect(row?.tagName).toBe("TR");
    expect(calls).toEqual([{ op: "observe", root: null, target: row }]);
    // a function component can't take a ref, so the proxy doesn't give it one
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("names a memo componentClass after the function it wraps", () => {
    const Row = (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />;

    render(
      <VisibilityProxy
        componentClass={React.memo(Row)}
        container={null}
        content={() => null}
        placeholder={() => null}
        visible={false}
        setVisible={() => undefined}
      />,
    );

    expect(log).toHaveBeenCalledWith("warn", expect.stringContaining("doesn't pass its ref on"), {
      componentClass: "Row",
    });
  });

  // StrictMode mounts each component, unmounts it and mounts the same instance again
  it("observes again when the same instance mounts again", () => {
    const { getByTestId } = render(
      <React.StrictMode>
        <VisibilityProxy
          componentClass="div"
          container={null}
          content={() => null}
          data-testid="row"
          placeholder={() => null}
          visible={false}
          setVisible={() => undefined}
        />
      </React.StrictMode>,
    );

    const row = getByTestId("row");
    expect(calls).toEqual([
      { op: "observe", root: null, target: row },
      { op: "unobserve", root: null, target: row },
      { op: "observe", root: null, target: row },
    ]);
  });

  // Fragment, like Suspense, StrictMode and Profiler, is a symbol rather than a component, and
  // an extension may well try it, as the warning about a missing componentClass suggests one.
  it("observes the first element of a Fragment componentClass's content, and warns once", () => {
    const { getAllByTestId } = render(
      <>
        {[1, 2].map((key) => (
          <VisibilityProxy
            key={key}
            componentClass={React.Fragment}
            container={null}
            content={() => null}
            placeholder={() => <div data-testid="entry" />}
            visible={false}
            setVisible={() => undefined}
          />
        ))}
      </>,
    );

    const entries = getAllByTestId("entry");
    expect(calls).toEqual(entries.map((target) => ({ op: "observe", root: null, target })));
    const warnings = vi
      .mocked(log)
      .mock.calls.filter(
        ([, , meta]) => (meta as { componentClass?: string })?.componentClass === "react.fragment",
      );
    expect(warnings).toEqual([
      ["warn", expect.stringContaining("doesn't pass its ref on"), expect.anything()],
    ]);
  });

  it("warns once per componentClass that gives no element, however many entries use it", () => {
    class Item extends React.Component<{ children?: React.ReactNode }> {
      public render() {
        return <li>{this.props.children}</li>;
      }
    }
    render(
      <ul>
        {[1, 2, 3].map((key) => (
          <VisibilityProxy
            key={key}
            componentClass={Item}
            container={null}
            content={() => null}
            placeholder={() => null}
            visible={false}
            setVisible={() => undefined}
          />
        ))}
      </ul>,
    );

    const warnings = vi
      .mocked(log)
      .mock.calls.filter(
        ([, , meta]) => (meta as { componentClass?: string })?.componentClass === "Item",
      );
    expect(warnings).toHaveLength(1);
  });

  // Logged once for the whole app, so this counts every proxy this file has mounted without one.
  it("warns once about proxies without a componentClass, however many mount", () => {
    render(
      <>
        <Proxy container={null} />
        <Proxy container={null} />
      </>,
    );

    const warnings = vi
      .mocked(log)
      .mock.calls.filter(([, message]) => message.includes("without a componentClass"));
    expect(warnings).toHaveLength(1);
  });
});
