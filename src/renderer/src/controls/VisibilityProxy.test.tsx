/**
 * Tests for which IntersectionObserver root a VisibilityProxy is observed against. The
 * root is what decides whether the proxy counts as visible: one that doesn't clip counts
 * everything inside it as on screen.
 */
import { render } from "@testing-library/react";
import * as React from "react";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import VisibilityProxy from "./VisibilityProxy";

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

describe("VisibilityProxy", () => {
  it("is observed against the container it mounts with", () => {
    const scroller = document.createElement("div");
    const { getByTestId } = render(<Proxy container={scroller} />);

    expect(calls).toEqual([{ op: "observe", root: scroller, target: getByTestId("entry") }]);
  });

  // The conflict editor passes a ref's `current`: null on the first render, where the
  // viewport (clipped by the modal body) is the root that virtualises its entries, and
  // an unclipped wrapper <div> on every render after that.
  it("keeps the root it mounted with when the container changes", () => {
    const { getByTestId, rerender, unmount } = render(<Proxy container={null} />);
    const entry = getByTestId("entry");

    rerender(<Proxy container={document.createElement("div")} />);
    unmount();

    expect(calls).toEqual([
      { op: "observe", root: null, target: entry },
      { op: "unobserve", root: null, target: entry },
    ]);
  });
});
