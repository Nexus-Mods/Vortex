/**
 * Tests for when a VisibilityProxy turns its content off again. A proxy doesn't hide within a
 * second of being shown, so a row whose own rendering pushes it out of view doesn't toggle
 * forever. IntersectionObserver only reports changes, so a row that left inside that second
 * is never reported again: the proxy has to act on it once the second has passed.
 */
import { act, render } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import VisibilityProxy from "./VisibilityProxy";

type Callback = (entries: IntersectionObserverEntry[], observer: unknown) => void;

/**
 * Stands in for IntersectionObserver with its one rule that matters here: an entry is only
 * delivered when a target's intersection state differs from the last one delivered for it.
 */
class FakeIntersectionObserver {
  public static sInstances: FakeIntersectionObserver[] = [];

  private mCallback: Callback;
  private mTargets = new Map<Element, boolean | undefined>();

  constructor(callback: Callback) {
    this.mCallback = callback;
    FakeIntersectionObserver.sInstances.push(this);
  }

  public observe(target: Element) {
    this.mTargets.set(target, undefined);
  }

  public unobserve(target: Element) {
    this.mTargets.delete(target);
  }

  public disconnect() {
    this.mTargets.clear();
  }

  public observes(target: Element): boolean {
    return this.mTargets.has(target);
  }

  public report(target: Element, isIntersecting: boolean) {
    if (!this.mTargets.has(target) || this.mTargets.get(target) === isIntersecting) {
      return;
    }
    this.mTargets.set(target, isIntersecting);
    this.mCallback([{ target, isIntersecting } as IntersectionObserverEntry], this);
  }
}

function report(target: Element, isIntersecting: boolean) {
  const observer = FakeIntersectionObserver.sInstances.find((obs) => obs.observes(target));
  expect(observer).toBeDefined();
  act(() => observer.report(target, isIntersecting));
}

/** A proxy whose parent owns `visible`, the way TableRow and ConflictEditor use it. */
function Row(props: { container: HTMLElement; onSetVisible: (visible: boolean) => void }) {
  const [visible, setVisible] = React.useState(false);
  const onSetVisible = React.useCallback(
    (value: boolean) => {
      props.onSetVisible(value);
      setVisible(value);
    },
    [props.onSetVisible],
  );
  return (
    <VisibilityProxy
      componentClass="div"
      container={props.container}
      content={() => <span data-testid="content" />}
      data-testid="row"
      placeholder={() => <span data-testid="placeholder" />}
      visible={visible}
      setVisible={onSetVisible}
    />
  );
}

function renderRow() {
  const onSetVisible = vi.fn();
  const utils = render(
    <Row container={document.createElement("div")} onSetVisible={onSetVisible} />,
  );
  return { ...utils, onSetVisible, row: utils.getByTestId("row") };
}

beforeAll(() => {
  window.IntersectionObserver = FakeIntersectionObserver as any;
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("VisibilityProxy hiding", () => {
  it("hides a row that left view within a second of showing, once the second has passed", () => {
    const { onSetVisible, queryByTestId, row } = renderRow();

    report(row, true);
    act(() => vi.advanceTimersByTime(200));
    report(row, false);
    expect(queryByTestId("content")).not.toBeNull();

    act(() => vi.advanceTimersByTime(1000));

    expect(onSetVisible.mock.calls).toEqual([[true], [false]]);
    expect(queryByTestId("placeholder")).not.toBeNull();
  });

  it("hides a row straight away when it has been visible for over a second", () => {
    const { onSetVisible, row } = renderRow();

    report(row, true);
    act(() => vi.advanceTimersByTime(1500));
    report(row, false);

    expect(onSetVisible.mock.calls).toEqual([[true], [false]]);
  });

  it("keeps a row shown throughout when it toggles quickly and ends up in view", () => {
    const { onSetVisible, row } = renderRow();

    report(row, true);
    for (let i = 0; i < 4; ++i) {
      act(() => vi.advanceTimersByTime(100));
      report(row, false);
      act(() => vi.advanceTimersByTime(100));
      report(row, true);
    }
    act(() => vi.advanceTimersByTime(5000));

    expect(onSetVisible.mock.calls).toEqual([[true]]);
  });

  it("hides a row once after quick toggles that end out of view", () => {
    const { onSetVisible, row } = renderRow();

    report(row, true);
    for (let i = 0; i < 3; ++i) {
      act(() => vi.advanceTimersByTime(100));
      report(row, false);
      act(() => vi.advanceTimersByTime(100));
      report(row, true);
    }
    report(row, false);
    act(() => vi.advanceTimersByTime(5000));

    expect(onSetVisible.mock.calls).toEqual([[true], [false]]);
  });

  it("clears a pending hide when it unmounts", () => {
    const { onSetVisible, row, unmount } = renderRow();

    report(row, true);
    report(row, false);
    unmount();
    act(() => vi.advanceTimersByTime(5000));

    expect(onSetVisible.mock.calls).toEqual([[true]]);
    expect(vi.getTimerCount()).toBe(0);
  });

  // A componentClass made inline is a new component on every render, and Fast Refresh remounts
  // one in development: either way the row's element is replaced while the proxy stays mounted.
  it("keeps showing a row whose componentClass replaces its element", () => {
    const makeRow = () =>
      React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
        <div ref={ref} {...props} />
      ));
    const onSetVisible = vi.fn();
    function Entry(props: { componentClass: React.ElementType }) {
      const [visible, setVisible] = React.useState(false);
      return (
        <VisibilityProxy
          componentClass={props.componentClass}
          container={null}
          content={() => <span data-testid="content" />}
          data-testid="row"
          placeholder={() => <span data-testid="placeholder" />}
          visible={visible}
          setVisible={(value: boolean) => {
            onSetVisible(value);
            setVisible(value);
          }}
        />
      );
    }
    const { getByTestId, queryByTestId, rerender } = render(<Entry componentClass={makeRow()} />);
    report(getByTestId("row"), true);

    rerender(<Entry componentClass={makeRow()} />);
    report(getByTestId("row"), true);
    act(() => vi.advanceTimersByTime(5000));

    expect(onSetVisible.mock.calls).toEqual([[true]]);
    expect(queryByTestId("content")).not.toBeNull();
  });

  // Fast Refresh does this in development: the componentClass remounts its element while the
  // proxy's props, and so the proxy, stay as they were.
  it("keeps showing a row whose componentClass replaces its element on its own", () => {
    let replaceElement: () => void = () => undefined;
    const SelfReplacing = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
      function SelfReplacing(props, ref) {
        const [key, setKey] = React.useState(0);
        replaceElement = () => setKey((value) => value + 1);
        return <div key={key} ref={ref} {...props} />;
      },
    );
    const onSetVisible = vi.fn();
    function Entry() {
      const [visible, setVisible] = React.useState(false);
      return (
        <VisibilityProxy
          componentClass={SelfReplacing}
          container={null}
          content={() => <span data-testid="content" />}
          data-testid="row"
          placeholder={() => <span data-testid="placeholder" />}
          visible={visible}
          setVisible={(value: boolean) => {
            onSetVisible(value);
            setVisible(value);
          }}
        />
      );
    }
    const { getByTestId, queryByTestId } = render(<Entry />);
    const before = getByTestId("row");
    report(before, true);

    act(() => replaceElement());
    const after = getByTestId("row");
    expect(after).not.toBe(before);
    expect(FakeIntersectionObserver.sInstances.some((obs) => obs.observes(before))).toBe(false);
    report(after, true);
    act(() => vi.advanceTimersByTime(5000));

    expect(onSetVisible.mock.calls).toEqual([[true]]);
    expect(queryByTestId("content")).not.toBeNull();
  });

  // Without a componentClass the proxy wraps its content in a <div> and observes that, so
  // swapping the placeholder for content doesn't change the node it observes.
  describe("without a componentClass", () => {
    function renderEntry(placeholder: () => React.ReactNode, content: () => React.ReactNode) {
      const onSetVisible = vi.fn();
      function Entry() {
        const [visible, setVisible] = React.useState(false);
        return (
          <VisibilityProxy
            container={null}
            content={content}
            placeholder={placeholder}
            visible={visible}
            setVisible={(value: boolean) => {
              onSetVisible(value);
              setVisible(value);
            }}
          />
        );
      }
      return { ...render(<Entry />), onSetVisible };
    }

    it("hides and shows again when content and placeholder share their node", () => {
      const { getByTestId, onSetVisible } = renderEntry(
        () => <div data-testid="entry" />,
        () => <div data-testid="entry">content</div>,
      );
      const wrapper = getByTestId("entry").parentElement;

      report(wrapper, true);
      report(wrapper, false);
      act(() => vi.advanceTimersByTime(1000));
      report(wrapper, true);

      expect(onSetVisible.mock.calls).toEqual([[true], [false], [true]]);
      expect(getByTestId("entry").textContent).toBe("content");
    });

    it("hides and shows again when content and placeholder render different elements", () => {
      const { getByTestId, onSetVisible, queryByTestId } = renderEntry(
        () => <span data-testid="placeholder" />,
        () => <div data-testid="content" />,
      );
      const wrapper = getByTestId("placeholder").parentElement;

      report(wrapper, true);
      expect(queryByTestId("content")).not.toBeNull();
      report(wrapper, false);
      act(() => vi.advanceTimersByTime(1000));
      expect(queryByTestId("placeholder")).not.toBeNull();
      report(wrapper, true);

      expect(onSetVisible.mock.calls).toEqual([[true], [false], [true]]);
      expect(queryByTestId("content")).not.toBeNull();
    });
  });
});
