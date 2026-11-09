/**
 * Tests for what a table's rows are virtualised against and scrolled by. A table with a
 * sticky header doesn't scroll itself: its main pane has visible overflow and the page
 * scrolls it, so the rows have to be observed against, and brought into view by, that
 * page scroll, not the pane.
 */
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import * as PropTypes from "prop-types";
import * as React from "react";
import { Provider } from "react-redux";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import * as scrolling from "../smoothScroll";
import SuperTable from "./Table";
import HeaderCell from "./table/HeaderCell";

// Render the bare table: no store, extension registry or i18n instance to set up.
vi.mock("./ComponentEx", async (importOriginal) => {
  const identity = () => (component: unknown) => component;
  return {
    ...(await importOriginal<object>()),
    connect: identity,
    extend: identity,
    translate: identity,
  };
});

const observedRoots = new Map<Element, Element | null>();

class FakeIntersectionObserver {
  private mRoot: Element | null;
  constructor(_callback: unknown, options: IntersectionObserverInit) {
    this.mRoot = (options.root as Element) ?? null;
  }
  public observe(target: Element) {
    observedRoots.set(target, this.mRoot);
  }
  public unobserve(target: Element) {
    observedRoots.delete(target);
  }
  public disconnect() {
    // nop
  }
}

// what the table subscribed to on the api's events, such as `<tableId>-scroll-to`
const listeners = new Map<string, (...args: any[]) => void>();

const state = { settings: { interface: { usage: {} } }, persistent: {} };
const store = { getState: () => state, subscribe: () => () => undefined, dispatch: vi.fn() };

class LegacyContext extends React.Component<{ children: React.ReactNode }> {
  public static childContextTypes = { api: PropTypes.object };
  public getChildContext() {
    return {
      api: {
        events: {
          on: (event: string, listener: (...args: any[]) => void) => listeners.set(event, listener),
          emit: vi.fn(),
          removeAllListeners: vi.fn(),
        },
        getState: () => state,
        store,
      },
    };
  }
  public render() {
    return <Provider store={store as never}>{this.props.children}</Provider>;
  }
}

const attributes = [
  {
    id: "name",
    name: "Name",
    placement: "table",
    calc: (row: { name: string }) => row.name,
    edit: {},
    noShrink: true,
  },
];

const data = { a: { name: "a" }, b: { name: "b" }, c: { name: "c" } };

const Table = SuperTable as React.ComponentType<any>;

function renderTable(
  stickyHeader: boolean,
  options: { data?: typeof data; pageScroll?: boolean } = {},
) {
  // stands in for the page scroll around a sticky-header table
  const page = document.createElement("div");
  page.style.overflowY = options.pageScroll === false ? "visible" : "auto";
  const onChangeSelection = vi.fn();
  let tableInstance: any;
  const host = document.createElement("div");
  page.appendChild(host);
  document.body.appendChild(page);

  const result = render(
    <LegacyContext>
      <Table
        ref={(instance: any) => {
          if (instance) tableInstance = instance;
        }}
        t={(key: string) => key}
        tableId="test"
        data={options.data ?? data}
        objects={attributes}
        actions={[]}
        attributeState={{}}
        language="en"
        collapsedGroups={[]}
        hasActions={false}
        onChangeSelection={onChangeSelection}
        showDetails={false}
        stickyHeader={stickyHeader}
        onSetAttributeVisible={vi.fn()}
        onSetAttributeSort={vi.fn()}
        onSetAttributeFilter={vi.fn()}
        onSetGroupingAttribute={vi.fn()}
        onCollapseGroup={vi.fn()}
        onSetCollapsedGroups={vi.fn()}
      />
    </LegacyContext>,
    { container: host },
  );
  const pane = host.querySelector(".table-main-pane");
  return { ...result, page, pane, onChangeSelection, instance: () => tableInstance };
}

async function rowsOf(container: HTMLElement, count = 3): Promise<Element[]> {
  await waitFor(() => expect(container.querySelectorAll("tr[data-rowid]")).toHaveLength(count));
  return Array.from(container.querySelectorAll("tr[data-rowid]"));
}

beforeAll(() => {
  window.IntersectionObserver = FakeIntersectionObserver as any;
});

afterEach(() => {
  document.body.innerHTML = "";
  listeners.clear();
  vi.restoreAllMocks();
});

describe("SuperTable row virtualisation", () => {
  it("observes the rows of a sticky-header table against the page scroll", async () => {
    const { container, page, unmount } = renderTable(true);

    for (const row of await rowsOf(container)) {
      expect(observedRoots.get(row)).toBe(page);
    }
    unmount();
  });

  it("observes the rows of any other table against its own pane", async () => {
    const { container, pane, unmount } = renderTable(false);

    for (const row of await rowsOf(container)) {
      expect(observedRoots.get(row)).toBe(pane);
    }
    unmount();
  });

  it("keeps noShrink columns from shrinking while the page scrolls, until unmounted", async () => {
    const updateWidth = vi.spyOn(HeaderCell.prototype, "updateWidth");
    const { container, page, unmount } = renderTable(true);
    await rowsOf(container);

    page.dispatchEvent(new Event("scroll"));
    expect(updateWidth).toHaveBeenCalled();

    unmount();
    updateWidth.mockClear();
    page.dispatchEvent(new Event("scroll"));
    expect(updateWidth).not.toHaveBeenCalled();
  });
});

/**
 * Lays an element out for a jsdom that has no layout: a scroll position that sticks, a
 * visible height, and a box that moves up as `scroller` scrolls.
 */
function layOut(
  element: Element,
  box: { top: number; height: number },
  scroller: Element = element,
) {
  Object.defineProperty(element, "offsetHeight", { configurable: true, value: box.height });
  Object.defineProperty(element, "offsetTop", { configurable: true, value: box.top });
  if (element === scroller) {
    let scrollTop = 0;
    Object.defineProperty(element, "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
    Object.defineProperty(element, "clientHeight", { configurable: true, value: box.height });
  }
  element.getBoundingClientRect = () =>
    ({
      top: box.top - (element === scroller ? 0 : scroller.scrollTop),
      height: box.height,
    }) as DOMRect;
}

describe("SuperTable scroll-to", () => {
  // A 500px view with row c, the last, ending at 940: well below the fold.
  function layOutRows(scroller: Element, rows: Element[]) {
    layOut(scroller, { top: 0, height: 500 });
    rows.forEach((row, idx) => layOut(row, { top: 800 + idx * 50, height: 40 }, scroller));
  }

  it("scrolls the page around a sticky-header table to the row", async () => {
    const { container, page, pane, unmount } = renderTable(true);
    layOutRows(page, await rowsOf(container));
    // the pane is as tall as its rows, so scrolling it moves nothing
    layOut(pane, { top: 0, height: 1000 });

    listeners.get("test-scroll-to")("c");

    // row c ends at 940; it is brought up to a fifth of the view above the bottom
    expect(page.scrollTop).toBe(940 - 500 + 100);
    expect(pane.scrollTop).toBe(0);
    unmount();
  });

  it("scrolls up far enough that the sticky header doesn't cover the row", async () => {
    const { container, page, unmount } = renderTable(true);
    layOutRows(page, await rowsOf(container));
    Object.defineProperty(container.querySelector(".xthead"), "offsetHeight", { value: 60 });
    page.scrollTop = 2000;

    listeners.get("test-scroll-to")("a");

    // row a starts at 800: a fifth of the view below the header
    expect(page.scrollTop).toBe(800 - 60 - 100);
    unmount();
  });

  it("leaves a sticky-header table's page where it is when the row is in view", async () => {
    const { container, page, unmount } = renderTable(true);
    layOutRows(page, await rowsOf(container));
    Object.defineProperty(container.querySelector(".xthead"), "offsetHeight", { value: 60 });
    page.scrollTop = 600;

    listeners.get("test-scroll-to")("a");

    expect(page.scrollTop).toBe(600);
    unmount();
  });

  it("scrolls the pane of any other table to the row", async () => {
    const { container, pane, unmount } = renderTable(false);
    layOutRows(pane, await rowsOf(container));

    listeners.get("test-scroll-to")("c");

    expect(pane.scrollTop).toBe(940 - 500 + 100);
    unmount();
  });
});

describe("SuperTable scroller boundaries", () => {
  it.each([0, 700])("uses the ancestor origin when its scrollTop is %s", async (scrollTop) => {
    const { container, page, pane, unmount } = renderTable(true);
    const rows = await rowsOf(container);
    layOut(page, { top: 120, height: 500 });
    rows.forEach((row, idx) => layOut(row, { top: 920 + idx * 50, height: 40 }, page));
    layOut(pane, { top: 120, height: 1600 });
    page.scrollTop = scrollTop;

    listeners.get("test-scroll-to")("c");

    // c is 900px into the scrollable content, independent of the ancestor's viewport origin.
    expect(page.scrollTop).toBe(scrollTop === 0 ? 540 : 700);
    expect(pane.scrollTop).toBe(0);
    unmount();
  });

  it.each([0, 1600])(
    "scrolls the document when no ancestor scrolls, starting at %s",
    async (scrollTop) => {
      const root = document.documentElement;
      vi.spyOn(document, "scrollingElement", "get").mockReturnValue(root);
      const { container, pane, unmount } = renderTable(true, { pageScroll: false });
      const rows = await rowsOf(container);
      layOut(root, { top: -300, height: 500 });
      rows.forEach((row, idx) => layOut(row, { top: 800 + idx * 50, height: 40 }, root));
      layOut(pane, { top: 200, height: 1600 });
      Object.defineProperty(container.querySelector(".xthead"), "offsetHeight", { value: 60 });
      root.scrollTop = scrollTop;

      listeners.get("test-scroll-to")(scrollTop === 0 ? "c" : "a");

      expect(root.scrollTop).toBe(scrollTop === 0 ? 540 : 640);
      expect(pane.scrollTop).toBe(0);
      unmount();
    },
  );

  it.each([true, false])("pages by the visible scroller height (sticky=%s)", async (sticky) => {
    const manyRows = Object.fromEntries(
      Array.from({ length: 20 }, (_, idx) => {
        const id = "row-" + String(idx).padStart(2, "0");
        return [id, { name: id }];
      }),
    ) as typeof data;
    const { container, page, pane, onChangeSelection, unmount } = renderTable(sticky, {
      data: manyRows,
    });
    const rows = await rowsOf(container, 20);
    const scroller = sticky ? page : pane;
    layOut(scroller, { top: 100, height: 240 });
    if (sticky) layOut(pane, { top: 100, height: 2000 });
    rows.forEach((row, idx) => {
      layOut(row, { top: 100 + idx * 40, height: 40 }, scroller);
      Object.defineProperty(row, "clientHeight", { configurable: true, value: 40 });
    });
    act(() => listeners.get("test-select-item")("row-00"));
    fireEvent.keyDown(pane, { key: "PageDown", keyCode: 34 });
    await waitFor(() => expect(onChangeSelection).toHaveBeenLastCalledWith(["row-02"]));

    act(() => listeners.get("test-select-item")("row-10"));
    await waitFor(() => expect(onChangeSelection).toHaveBeenLastCalledWith(["row-10"]));
    // Supply layout for the selected element after its selection render.
    const selectedRow = container.querySelector('tr[data-rowid="row-10"]');
    layOut(selectedRow, { top: 500, height: 40 }, scroller);
    Object.defineProperty(selectedRow, "clientHeight", { configurable: true, value: 40 });
    fireEvent.keyDown(pane, { key: "PageUp", keyCode: 33 });
    await waitFor(() => expect(onChangeSelection).toHaveBeenLastCalledWith(["row-08"]));
    unmount();
  });
});

describe("SuperTable smooth scroll completion", () => {
  it.each([true, false])(
    "rechecks changed row geometry only after an uncancelled tween (%s)",
    async (continued) => {
      let finish: (continued: boolean) => void;
      const tween = vi.spyOn(scrolling, "default").mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            finish = resolve;
          }),
      );
      const { container, page, pane, instance, unmount } = renderTable(true);
      const rows = await rowsOf(container);
      layOut(page, { top: 0, height: 500 });
      layOut(pane, { top: 0, height: 1600 });
      rows.forEach((row, idx) => layOut(row, { top: 800 + idx * 50, height: 40 }, page));

      instance().scrollToItem(rows[2], true);
      expect(tween).toHaveBeenCalledOnce();
      expect(tween).toHaveBeenCalledWith(page, 540, 200);
      page.scrollTop = 540;
      // Rendering different row content during the tween moves its bottom down by 200px.
      layOut(rows[2], { top: 1100, height: 40 }, page);
      await act(async () => finish(continued));

      expect(page.scrollTop).toBe(continued ? 740 : 540);
      expect(pane.scrollTop).toBe(0);
      unmount();
    },
  );
});
