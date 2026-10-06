import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Table } from "./Table";
import type { ITableColumn } from "./Table.types";

interface IRow {
  id: string;
  name: string;
  size: number;
}

const ROWS: IRow[] = [
  { id: "a", name: "Alpha", size: 1 },
  { id: "b", name: "Beta", size: 2 },
];

const COLUMNS: Array<ITableColumn<IRow>> = [
  { id: "name", header: "Name", cell: (row) => row.name },
  { id: "size", header: "Size", width: "80px", align: "end", cell: (row) => `${row.size} MB` },
];

const renderTable = () =>
  render(<Table columns={COLUMNS} getRowId={(row) => row.id} label="Files" rows={ROWS} />);

describe("Table", () => {
  it("is a grid named by its label, with a header row and a row per item", () => {
    renderTable();

    const grid = screen.getByRole("grid", { name: "Files" });
    expect(within(grid).getAllByRole("row")).toHaveLength(ROWS.length + 1);
    expect(grid).toHaveAttribute("aria-rowcount", String(ROWS.length + 1));
    expect(within(grid).getAllByRole("columnheader")).toHaveLength(COLUMNS.length);
  });

  it("makes its tracks from the column widths, between the gutters", () => {
    renderTable();

    expect(screen.getByRole("grid").style.gridTemplateColumns).toBe(
      "var(--nxm-table-gutter) minmax(0, 1fr) 80px var(--nxm-table-gutter)",
    );
  });

  it("renders each cell from its column, in column order", () => {
    renderTable();

    const [, firstRow] = screen.getAllByRole("row");
    const cells = within(firstRow).getAllByRole("gridcell");
    expect(cells.map((cell) => cell.textContent)).toEqual(["Alpha", "1 MB"]);
    expect(cells[1]).toHaveAttribute("data-align", "end");
  });
});

describe("Table with groups", () => {
  const GROUPS = [
    { id: "first", label: "First", rows: [ROWS[0], ROWS[1]] },
    { id: "second", label: "Second", rows: [ROWS[1]] },
  ];

  const GROUPED_COLUMNS: Array<ITableColumn<IRow>> = [
    { ...COLUMNS[0], groupCell: (group) => <span data-testid="group-name">{group.label}</span> },
    COLUMNS[1],
  ];

  const renderGrouped = () =>
    render(
      <Table columns={GROUPED_COLUMNS} getRowId={(row) => row.id} groups={GROUPS} label="Files" />,
    );

  it("is a treegrid of group rows, each above its own rows, a row in two groups in both", () => {
    renderGrouped();

    const grid = screen.getByRole("treegrid", { name: "Files" });
    const rows = within(grid).getAllByRole("row");
    expect(rows.map((row) => row.getAttribute("aria-level"))).toEqual([
      null,
      "1",
      "2",
      "2",
      "1",
      "2",
    ]);
    expect(screen.getAllByTestId("group-name").map((name) => name.textContent)).toEqual([
      "First",
      "Second",
    ]);
  });

  it("washes a group's row from its image, when it has one", () => {
    const { container } = render(
      <Table
        columns={GROUPED_COLUMNS}
        getRowId={(row) => row.id}
        groups={[{ ...GROUPS[0], image: "first.png" }, GROUPS[1]]}
        label="Files"
      />,
    );

    const groupRows = container.querySelectorAll(".nxm-table-group-row");
    expect(groupRows[0].lastElementChild?.tagName).toBe("CANVAS");
    expect(groupRows[1].querySelector("canvas")).toBeNull();
  });

  it("tints an open group's rows from its image, below its own row, until it collapses", async () => {
    const { container } = render(
      <Table
        columns={GROUPED_COLUMNS}
        getRowId={(row) => row.id}
        groups={[{ ...GROUPS[0], image: "first.png" }, GROUPS[1]]}
        label="Files"
      />,
    );

    const backdrops = () => container.querySelectorAll<HTMLElement>(".nxm-table-group-backdrop");
    expect(backdrops()).toHaveLength(1);
    // Under the first group's row, 48px and a 4px gap, over its two 40px rows.
    expect(backdrops()[0].style.getPropertyValue("--nxm-table-backdrop-top")).toBe("52px");
    expect(backdrops()[0].style.height).toBe("80px");

    await userEvent.click(screen.getByRole("button", { name: "First" }));

    expect(backdrops()).toHaveLength(0);
  });

  it("collapses a group's rows from its button, and opens them again", async () => {
    renderGrouped();
    const toggle = screen.getByRole("button", { name: "First" });

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getAllByRole("row")).toHaveLength(4);
    expect(screen.getByRole("treegrid")).toHaveAttribute("aria-rowcount", "4");

    await userEvent.click(toggle);

    expect(screen.getAllByRole("row")).toHaveLength(6);
  });
});

describe("Table in a scrolling page", () => {
  const MANY: IRow[] = Array.from({ length: 200 }, (_, index) => ({
    id: String(index),
    name: `Row ${index}`,
    size: index,
  }));

  const FOCUSABLE: Array<ITableColumn<IRow>> = [
    { id: "name", header: "Name", cell: (row) => <button type="button">{row.name}</button> },
  ];

  // jsdom has no layout: give the page's scroller a height, and the rows a place in it.
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.dataset.testid === "page" ? 400 : 0;
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderInPage = () =>
    render(
      <div data-testid="page" style={{ overflowY: "auto" }}>
        <Table columns={FOCUSABLE} getRowId={(row) => row.id} label="Files" rows={MANY} />
      </div>,
    );

  const scrollTo = (page: HTMLElement, top: number) => {
    Object.defineProperty(page, "scrollTop", { configurable: true, value: top });
    fireEvent.scroll(page);
  };

  it("renders only the rows in view, counting them all", () => {
    renderInPage();

    const grid = screen.getByRole("grid");
    const rows = within(grid).getAllByRole("row").slice(1);
    expect(rows.length).toBeLessThan(30);
    expect(rows[0]).toHaveAttribute("aria-rowindex", "2");
    expect(grid).toHaveAttribute("aria-rowcount", String(MANY.length + 1));
  });

  it("renders the rows scrolled to, keeping the focused one", () => {
    renderInPage();
    act(() => screen.getByRole("button", { name: "Row 0" }).focus());

    scrollTo(screen.getByTestId("page"), 4000);

    expect(screen.getByRole("button", { name: "Row 100" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Row 0" })).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Row 1" })).toBeNull();
  });
});
