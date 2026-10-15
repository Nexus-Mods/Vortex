import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { createPortal } from "react-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// jsdom loads no pictures, so every picture's colour is the same, known one.
vi.mock("@/ui/components/image/useImageColour.hook", () => ({
  useImageColour: (src: string | undefined) => (src ? "rgb(1, 2, 3)" : undefined),
}));

import { Table } from "./Table";
import type { ITableColumn } from "./Table.types";
import { useTableRowEngaged } from "./TableRow.context";

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
      "var(--nxm-table-gutter-start) minmax(280px, 1fr) 80px var(--nxm-table-gutter)",
    );
  });

  it("marks a sticky column's cells, header and rows alike", () => {
    render(
      <Table
        columns={[COLUMNS[0], { ...COLUMNS[1], sticky: "end" }]}
        getRowId={(row) => row.id}
        label="Files"
        rows={ROWS}
      />,
    );

    const stuck = document.querySelectorAll('[data-sticky="end"]');
    expect(stuck).toHaveLength(ROWS.length + 1);
    expect(stuck[0]).toHaveTextContent("Size");
  });

  describe("a row's engagement", () => {
    const Engaged = ({ id }: { id: string }) => (
      <span data-testid={`engaged-${id}`}>{String(useTableRowEngaged())}</span>
    );

    const renderEngaged = () =>
      render(
        <Table
          columns={[
            COLUMNS[0],
            { id: "engaged", header: "Engaged", cell: (row) => <Engaged id={row.id} /> },
          ]}
          getRowId={(row) => row.id}
          label="Files"
          rows={ROWS}
        />,
      );

    const engagedIn = (id: string) => screen.getByTestId(`engaged-${id}`).textContent;
    const rowOf = (id: string) => screen.getByTestId(`engaged-${id}`).closest('[role="row"]')!;

    it("tells its cells once it's pointed at, and only that row's", async () => {
      renderEngaged();
      expect(engagedIn(ROWS[0].id)).toBe("false");

      await userEvent.hover(rowOf(ROWS[0].id));

      expect(engagedIn(ROWS[0].id)).toBe("true");
      expect(engagedIn(ROWS[1].id)).toBe("false");
    });

    it("tells its cells once something in it is focused, and stays so", async () => {
      renderEngaged();

      fireEvent.focus(rowOf(ROWS[1].id));
      fireEvent.blur(rowOf(ROWS[1].id));

      expect(engagedIn(ROWS[1].id)).toBe("true");
    });

    it("tells its cells while it's selected, though never pointed at, as a hovered row's", () => {
      render(
        <Table
          selectable
          columns={[
            COLUMNS[0],
            { id: "engaged", header: "Engaged", cell: (row) => <Engaged id={row.id} /> },
          ]}
          getRowId={(row) => row.id}
          label="Files"
          rows={ROWS}
          selectedIds={new Set([ROWS[1].id])}
        />,
      );

      expect(engagedIn(ROWS[0].id)).toBe("false");
      expect(engagedIn(ROWS[1].id)).toBe("true");
    });
  });

  // The width is CSS's to apply, on hover; the table only says how far.
  it("passes a sticky column's reveal width to its styles, only when it has one", () => {
    const { rerender } = render(
      <Table
        columns={[COLUMNS[0], { ...COLUMNS[1], sticky: "end", revealWidth: "72px" }]}
        getRowId={(row) => row.id}
        label="Files"
        rows={ROWS}
      />,
    );

    const table = screen.getByRole("grid");
    expect(table).toHaveAttribute("data-sticky-reveal");
    expect(table.style.getPropertyValue("--nxm-table-sticky-reveal")).toBe("72px");

    rerender(
      <Table
        columns={[COLUMNS[0], { ...COLUMNS[1], sticky: "end" }]}
        getRowId={(row) => row.id}
        label="Files"
        rows={ROWS}
      />,
    );
    expect(screen.getByRole("grid")).not.toHaveAttribute("data-sticky-reveal");
  });

  // A sticky column fades what passes under it, so the table's edge needn't.
  it("fades its right edge only without a sticky column", () => {
    const { rerender } = renderTable();
    expect(document.querySelector(".nxm-table-edge")).not.toBeNull();

    rerender(
      <Table
        columns={[COLUMNS[0], { ...COLUMNS[1], sticky: "end" }]}
        getRowId={(row) => row.id}
        label="Files"
        rows={ROWS}
      />,
    );
    expect(document.querySelector(".nxm-table-edge")).toBeNull();
  });

  it("renders each cell from its column, in column order", () => {
    renderTable();

    const [, firstRow] = screen.getAllByRole("row");
    const cells = within(firstRow).getAllByRole("gridcell");
    expect(cells.map((cell) => cell.textContent)).toEqual(["Alpha", "1 MB"]);
    expect(cells[1]).toHaveAttribute("data-align", "end");
  });
});

describe("Table sorted by a column", () => {
  const SORTABLE: Array<ITableColumn<IRow>> = [
    {
      ...COLUMNS[0],
      groupCell: (group) => group.label,
      sort: (a, b) => a.name.localeCompare(b.name),
    },
    COLUMNS[1],
  ];

  const names = () =>
    screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getAllByRole("gridcell")[0].textContent);

  it("marks the sorted column's cells, and only once a sort is chosen", async () => {
    render(<Table columns={SORTABLE} getRowId={(row) => row.id} label="Files" rows={ROWS} />);

    const sortedCells = () => document.querySelectorAll(".nxm-table-row [data-sorted]");
    expect(sortedCells()).toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: "Name" }));

    expect(sortedCells()).toHaveLength(ROWS.length);
    expect([...sortedCells()].map((cell) => cell.textContent)).toEqual(["Alpha", "Beta"]);
  });

  it("makes a sortable header a button, and sorts by it from the default", async () => {
    render(
      <Table
        columns={SORTABLE}
        defaultSort={{ columnId: "name", direction: "ascending" }}
        getRowId={(row) => row.id}
        label="Files"
        rows={[ROWS[1], ROWS[0]]}
      />,
    );

    const [nameHeader, sizeHeader] = screen.getAllByRole("columnheader");
    expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
    expect(sizeHeader).not.toHaveAttribute("aria-sort");
    expect(within(sizeHeader).queryByRole("button")).toBeNull();
    expect(names()).toEqual(["Alpha", "Beta"]);

    await userEvent.click(within(nameHeader).getByRole("button", { name: "Name" }));

    expect(nameHeader).toHaveAttribute("aria-sort", "descending");
    expect(names()).toEqual(["Beta", "Alpha"]);
  });

  it("sorts each group's rows, leaving the groups in their order", () => {
    render(
      <Table
        columns={SORTABLE}
        defaultSort={{ columnId: "name", direction: "descending" }}
        getRowId={(row) => row.id}
        groups={[
          { id: "first", label: "First", rows: [ROWS[0], ROWS[1]] },
          { id: "second", label: "Second", rows: [ROWS[0]] },
        ]}
        label="Files"
      />,
    );

    expect(names()).toEqual(["First", "Beta", "Alpha", "Second", "Alpha"]);
  });
});

describe("Table with selectable rows", () => {
  const renderSelectable = () =>
    render(
      <Table
        selectable
        columns={COLUMNS}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        label="Files"
        rows={ROWS}
      />,
    );

  const headerCheckbox = () => within(screen.getAllByRole("columnheader")[0]).getByRole("checkbox");

  const rowCheckbox = (index: number) =>
    within(screen.getAllByRole("row")[index + 1]).getByRole("checkbox");

  it("has no checkboxes unless its rows are selectable", () => {
    renderTable();

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("selects a row from its checkbox, leaving the header's part-ticked", async () => {
    renderSelectable();

    await userEvent.click(rowCheckbox(0));

    expect(screen.getAllByRole("row")[1]).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("row")[2]).toHaveAttribute("aria-selected", "false");
    expect(headerCheckbox()).toHaveAttribute("aria-checked", "mixed");
  });

  it("selects every row from the header's checkbox, and clears them again", async () => {
    renderSelectable();

    await userEvent.click(headerCheckbox());
    expect(rowCheckbox(0)).toHaveAttribute("aria-checked", "true");
    expect(rowCheckbox(1)).toHaveAttribute("aria-checked", "true");

    await userEvent.click(headerCheckbox());
    expect(rowCheckbox(0)).toHaveAttribute("aria-checked", "false");
    expect(headerCheckbox()).toHaveAttribute("aria-checked", "false");
  });

  describe("by clicking rows", () => {
    const FIVE: IRow[] = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"].map((name, index) => ({
      id: name.toLowerCase(),
      name,
      size: index,
    }));

    const onOpen = vi.fn();

    const WITH_CONTROL: Array<ITableColumn<IRow>> = [
      COLUMNS[0],
      {
        id: "open",
        header: "Open",
        width: "80px",
        cell: (row) => (
          <button type="button" onClick={onOpen}>
            Open {row.name}
          </button>
        ),
      },
    ];

    const renderFive = () =>
      render(
        <Table
          selectable
          columns={WITH_CONTROL}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.name}
          label="Files"
          rows={FIVE}
        />,
      );

    const cell = (name: string) => screen.getByText(name);

    const selected = () =>
      screen
        .getAllByRole("row")
        .filter((row) => row.getAttribute("aria-selected") === "true")
        .map((row) => within(row).getAllByRole("gridcell")[0].textContent);

    const clickWith = async (name: string, keys: string) => {
      const user = userEvent.setup();
      await user.keyboard(`{${keys}>}`);
      await user.click(cell(name));
      await user.keyboard(`{/${keys}}`);
    };

    it("selects only the row clicked", async () => {
      renderFive();

      await userEvent.click(cell("Alpha"));
      await userEvent.click(cell("Beta"));

      expect(selected()).toEqual(["Beta"]);
      expect(rowCheckbox(1)).toHaveAttribute("aria-checked", "true");
    });

    it("adds and removes a row with Ctrl held, leaving the rest", async () => {
      renderFive();

      await userEvent.click(cell("Alpha"));
      await clickWith("Beta", "Control");
      expect(selected()).toEqual(["Alpha", "Beta"]);

      await clickWith("Alpha", "Control");
      expect(selected()).toEqual(["Beta"]);
    });

    it("does the same with Cmd held", async () => {
      renderFive();

      await userEvent.click(cell("Alpha"));
      await clickWith("Gamma", "Meta");

      expect(selected()).toEqual(["Alpha", "Gamma"]);
    });

    it("selects the rows from the last clicked with Shift held, either way", async () => {
      renderFive();

      await userEvent.click(cell("Beta"));
      await clickWith("Delta", "Shift");
      expect(selected()).toEqual(["Beta", "Gamma", "Delta"]);

      // From the same row, so the range shrinks rather than grows.
      await clickWith("Alpha", "Shift");
      expect(selected()).toEqual(["Alpha", "Beta"]);
    });

    it("adds a range to the selection with Ctrl and Shift held", async () => {
      renderFive();

      await userEvent.click(cell("Alpha"));
      await clickWith("Delta", "Control");

      const user = userEvent.setup();
      await user.keyboard("{Control>}{Shift>}");
      await user.click(cell("Epsilon"));
      await user.keyboard("{/Shift}{/Control}");

      expect(selected()).toEqual(["Alpha", "Delta", "Epsilon"]);
    });

    it("runs a range from a row ticked by its checkbox", async () => {
      renderFive();

      await userEvent.click(rowCheckbox(1));
      await clickWith("Delta", "Shift");

      expect(selected()).toEqual(["Beta", "Gamma", "Delta"]);
    });

    it("adds rows from their checkboxes without clearing the others", async () => {
      renderFive();

      await userEvent.click(cell("Alpha"));
      await userEvent.click(rowCheckbox(2));
      await userEvent.click(rowCheckbox(4));
      expect(selected()).toEqual(["Alpha", "Gamma", "Epsilon"]);

      await userEvent.click(rowCheckbox(2));
      expect(selected()).toEqual(["Alpha", "Epsilon"]);
    });

    it("leaves the selection alone when a control in a row is used", async () => {
      renderFive();

      await userEvent.click(cell("Alpha"));
      await userEvent.click(screen.getByRole("button", { name: "Open Beta" }));

      expect(onOpen).toHaveBeenCalled();
      expect(selected()).toEqual(["Alpha"]);
    });

    it("clears the selection from a click on the table's empty space", async () => {
      renderFive();

      await userEvent.click(cell("Alpha"));
      await clickWith("Gamma", "Control");
      await userEvent.click(screen.getByRole("grid"));

      expect(selected()).toEqual([]);
    });

    it("leaves the selection to the page that controls it", async () => {
      const onSelectedIdsChange = vi.fn();
      render(
        <Table
          selectable
          columns={WITH_CONTROL}
          getRowId={(row) => row.id}
          label="Files"
          rows={FIVE}
          selectedIds={new Set(["beta"])}
          onSelectedIdsChange={onSelectedIdsChange}
        />,
      );
      expect(selected()).toEqual(["Beta"]);

      await clickWith("Delta", "Control");

      expect(onSelectedIdsChange).toHaveBeenCalledWith(new Set(["beta", "delta"]));
      // Not until the page passes it back.
      expect(selected()).toEqual(["Beta"]);
    });

    it("keeps the selection through a click on the header", async () => {
      renderFive();

      await userEvent.click(cell("Alpha"));
      await userEvent.click(screen.getByText("Name"));

      expect(selected()).toEqual(["Alpha"]);
    });
  });
});

describe("Table with a toolbar", () => {
  it("puts it in the head above the header row, which counts it among the rows", () => {
    render(
      <Table
        columns={COLUMNS}
        getRowId={(row) => row.id}
        label="Files"
        rows={ROWS}
        toolbar={<button type="button">Search</button>}
      />,
    );

    const grid = screen.getByRole("grid");
    const [toolbar, header, first] = within(grid).getAllByRole("row");
    expect(within(toolbar).getByRole("gridcell")).toHaveAttribute("aria-colspan", "2");
    expect(within(toolbar).getByRole("button", { name: "Search" })).toBeInTheDocument();
    expect(header).toHaveAttribute("aria-rowindex", "2");
    expect(first).toHaveAttribute("aria-rowindex", "3");
    expect(grid).toHaveAttribute("aria-rowcount", String(ROWS.length + 2));
  });
});

describe("Table with a footer", () => {
  it("puts it after the rows, as the last of them", () => {
    render(
      <Table
        columns={COLUMNS}
        footer={<button type="button">Deselect all</button>}
        getRowId={(row) => row.id}
        label="Files"
        rows={ROWS}
      />,
    );

    const grid = screen.getByRole("grid");
    const footer = within(grid).getAllByRole("row").at(-1) as HTMLElement;
    expect(within(footer).getByRole("button", { name: "Deselect all" })).toBeInTheDocument();
    expect(footer).toHaveAttribute("aria-rowindex", String(ROWS.length + 2));
    expect(grid).toHaveAttribute("aria-rowcount", String(ROWS.length + 2));
  });
});

describe("Table with nothing to show", () => {
  it("shows what it's given in place of the rows", () => {
    render(
      <Table
        columns={COLUMNS}
        empty={<p>No files match</p>}
        getRowId={(row) => row.id}
        label="Files"
        rows={[]}
      />,
    );

    const grid = screen.getByRole("grid");
    const [, empty] = within(grid).getAllByRole("row");
    expect(within(empty).getByText("No files match")).toBeInTheDocument();
    expect(grid).toHaveAttribute("aria-rowcount", "2");
  });

  it("leaves it out while there are rows", () => {
    render(
      <Table
        columns={COLUMNS}
        empty={<p>No files match</p>}
        getRowId={(row) => row.id}
        label="Files"
        rows={ROWS}
      />,
    );

    expect(screen.queryByText("No files match")).toBeNull();
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

  // Its solid background would hide the group's tint, so it draws its own.
  it("tints a sticky column's cells with their group's picture", () => {
    render(
      <Table
        columns={[GROUPED_COLUMNS[0], { ...GROUPED_COLUMNS[1], sticky: "end" }]}
        getRowId={(row) => row.id}
        groups={[{ ...GROUPS[0], image: "first.png" }, GROUPS[1]]}
        label="Files"
      />,
    );

    const tinted = [...document.querySelectorAll('[data-sticky="end"]')].filter((cell) =>
      cell.querySelector(".nxm-table-cell-tint"),
    );
    // The first group's row and its two rows; not the header, nor the second group's.
    expect(tinted).toHaveLength(3);
    expect(document.querySelectorAll(".nxm-table-cell-tint")).toHaveLength(3);
  });

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
    expect(groupRows[0].lastElementChild).toHaveClass("nxm-table-group-wash");
    expect(groupRows[0].lastElementChild).toHaveStyle({ backgroundColor: "rgb(1, 2, 3)" });
    expect(groupRows[1].querySelector(".nxm-table-group-wash")).toBeNull();
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

describe("Table's context menus", () => {
  const GROUPS = [
    { id: "first", label: "First", rows: [ROWS[0]] },
    { id: "second", label: "Second", rows: [ROWS[1]] },
  ];

  const groupRow = (name: string) =>
    screen.getByRole("button", { name }).closest('[role="row"]') as HTMLElement;
  const row = (name: string) => screen.getByText(name).closest('[role="row"]') as HTMLElement;
  const menuItems = () => screen.getAllByRole("menuitem").map((item) => item.textContent);
  // Hidden too: an open menu hides the rest of the page from assistive tech, as it holds focus.
  const checkbox = (name: string) => within(row(name)).getByRole("checkbox", { hidden: true });
  const checked = (name: string) => checkbox(name).getAttribute("aria-checked") === "true";

  const renderGrouped = (selectable = true) =>
    render(
      <Table
        columns={COLUMNS}
        getRowId={(r) => r.id}
        getRowLabel={(r) => r.name}
        groups={GROUPS}
        label="Files"
        selectable={selectable}
      />,
    );

  it("offers to collapse an open group, or every one, and to select its rows", () => {
    renderGrouped();

    fireEvent.contextMenu(groupRow("First"));

    expect(menuItems()).toEqual(["Collapse", "Collapse all", "Select all in group"]);
  });

  it("collapses the group, then offers to expand it", async () => {
    renderGrouped();

    fireEvent.contextMenu(groupRow("First"));
    await userEvent.click(screen.getByRole("menuitem", { name: "Collapse" }));

    expect(screen.getByRole("button", { name: "First" })).toHaveAttribute("aria-expanded", "false");
    fireEvent.contextMenu(groupRow("First"));
    expect(menuItems()).toEqual(["Expand", "Expand all", "Select all in group"]);
  });

  it("collapses every group, and expands them all again", async () => {
    renderGrouped();

    fireEvent.contextMenu(groupRow("First"));
    await userEvent.click(screen.getByRole("menuitem", { name: "Collapse all" }));
    expect(screen.getByRole("button", { name: "Second" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    fireEvent.contextMenu(groupRow("Second"));
    await userEvent.click(screen.getByRole("menuitem", { name: "Expand all" }));
    expect(screen.getByRole("button", { name: "First" })).toHaveAttribute("aria-expanded", "true");
  });

  it("adds the group's rows to the selection", async () => {
    renderGrouped();
    await userEvent.click(checkbox("Beta"));

    fireEvent.contextMenu(groupRow("First"));
    await userEvent.click(screen.getByRole("menuitem", { name: "Select all in group" }));

    expect([checked("Alpha"), checked("Beta")]).toEqual([true, true]);
  });

  it("offers to deselect the group's rows once they're all selected, leaving the rest", async () => {
    renderGrouped();
    await userEvent.click(checkbox("Alpha"));
    await userEvent.click(checkbox("Beta"));

    fireEvent.contextMenu(groupRow("First"));
    expect(menuItems()).toEqual(["Collapse", "Collapse all", "Deselect all in group"]);
    await userEvent.click(screen.getByRole("menuitem", { name: "Deselect all in group" }));

    expect([checked("Alpha"), checked("Beta")]).toEqual([false, true]);
  });

  it("expands every group from a collapsed one, though others are open", async () => {
    renderGrouped();
    fireEvent.contextMenu(groupRow("First"));
    await userEvent.click(screen.getByRole("menuitem", { name: "Collapse" }));

    fireEvent.contextMenu(groupRow("First"));
    await userEvent.click(screen.getByRole("menuitem", { name: "Expand all" }));

    expect(screen.getByRole("button", { name: "First" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Second" })).toHaveAttribute("aria-expanded", "true");
  });

  it("selects the group's rows as they are when chosen, not when it opened", async () => {
    const { rerender } = renderGrouped();
    fireEvent.contextMenu(groupRow("First"));

    rerender(
      <Table
        selectable
        columns={COLUMNS}
        getRowId={(r) => r.id}
        getRowLabel={(r) => r.name}
        groups={[{ id: "first", label: "First", rows: ROWS }]}
        label="Files"
      />,
    );
    await userEvent.click(screen.getByRole("menuitem", { name: "Select all in group" }));

    expect([checked("Alpha"), checked("Beta")]).toEqual([true, true]);
  });

  it("closes once its group is gone", () => {
    const { rerender } = renderGrouped();
    fireEvent.contextMenu(groupRow("First"));

    rerender(
      <Table
        selectable
        columns={COLUMNS}
        getRowId={(r) => r.id}
        getRowLabel={(r) => r.name}
        groups={[GROUPS[1]]}
        label="Files"
      />,
    );

    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("offers no selecting where rows can't be selected", () => {
    renderGrouped(false);

    fireEvent.contextMenu(groupRow("First"));

    expect(menuItems()).toEqual(["Collapse", "Collapse all"]);
  });

  describe("a row's", () => {
    const renderWithMenu = () =>
      render(
        <Table
          selectable
          columns={COLUMNS}
          getRowId={(r) => r.id}
          getRowLabel={(r) => r.name}
          label="Files"
          rowMenu={(r, close) => (
            <button type="button" onClick={close}>
              Menu for {r.name}
            </button>
          )}
          rows={ROWS}
        />,
      );

    it("opens its menu, selecting just it when it wasn't selected", async () => {
      renderWithMenu();
      await userEvent.click(checkbox("Beta"));

      fireEvent.contextMenu(row("Alpha"));

      expect(screen.getByRole("button", { name: "Menu for Alpha" })).toBeInTheDocument();
      expect([checked("Alpha"), checked("Beta")]).toEqual([true, false]);
    });

    it("keeps the selection when it's one of those selected", async () => {
      renderWithMenu();
      await userEvent.click(checkbox("Alpha"));
      await userEvent.click(checkbox("Beta"));

      fireEvent.contextMenu(row("Alpha"));

      expect([checked("Alpha"), checked("Beta")]).toEqual([true, true]);
    });

    it("builds its menu from the row as it is now, and closes once it's gone", () => {
      const menuFor = (r: IRow) => <span>Menu for {r.name}</span>;
      const { rerender } = render(
        <Table
          columns={COLUMNS}
          getRowId={(r) => r.id}
          label="Files"
          rowMenu={menuFor}
          rows={ROWS}
        />,
      );
      fireEvent.contextMenu(row("Alpha"));

      rerender(
        <Table
          columns={COLUMNS}
          getRowId={(r) => r.id}
          label="Files"
          rowMenu={menuFor}
          rows={[{ ...ROWS[0], name: "Renamed" }, ROWS[1]]}
        />,
      );
      expect(screen.getByText("Menu for Renamed")).toBeInTheDocument();

      rerender(
        <Table
          columns={COLUMNS}
          getRowId={(r) => r.id}
          label="Files"
          rowMenu={menuFor}
          rows={[ROWS[1]]}
        />,
      );
      expect(screen.queryByRole("menu")).toBeNull();
    });

    it("opens from the keyboard under the focused control, handing focus back to it", async () => {
      renderWithMenu();
      const control = checkbox("Alpha");
      control.focus();

      fireEvent.contextMenu(control, { button: -1 });
      expect(
        screen.getByRole("button", { name: "Menu for Alpha", hidden: true }),
      ).toBeInTheDocument();
      await userEvent.keyboard("{Escape}");

      expect(control).toHaveFocus();
    });

    it("opens none from a right-click in something its row portalled out", () => {
      render(
        <Table
          selectable
          columns={[
            {
              id: "name",
              header: "Name",
              cell: (r) => (
                <>
                  {r.name}
                  {r.id === "a" && createPortal(<span>Portalled</span>, document.body)}
                </>
              ),
            },
          ]}
          getRowId={(r) => r.id}
          label="Files"
          rowMenu={(r) => <span>Menu for {r.name}</span>}
          rows={ROWS}
        />,
      );

      fireEvent.contextMenu(screen.getByText("Portalled"));

      expect(screen.queryByText(/Menu for/)).toBeNull();
    });

    it("leaves the browser's menu alone without one", () => {
      renderTable();

      expect(fireEvent.contextMenu(row("Alpha"))).toBe(true);
    });
  });

  // The table reports, through callbacks, what's done with its menus; what's made of that is
  // the page's, so the table itself stays free of analytics.
  describe("reporting", () => {
    const renderReporting = () => {
      const onMenuOpen = vi.fn();
      const onGroupMenuAction = vi.fn();

      render(
        <Table
          selectable
          columns={COLUMNS}
          getRowId={(r) => r.id}
          getRowLabel={(r) => r.name}
          groups={GROUPS}
          label="Files"
          rowMenu={(r) => <span>Menu for {r.name}</span>}
          onGroupMenuAction={onGroupMenuAction}
          onMenuOpen={onMenuOpen}
        />,
      );

      return { onGroupMenuAction, onMenuOpen };
    };

    it("says a menu opened on a group header, from the pointer", () => {
      const { onMenuOpen } = renderReporting();

      fireEvent.contextMenu(groupRow("First"), { clientX: 10, clientY: 10 });

      expect(onMenuOpen).toHaveBeenCalledWith("group", "pointer");
    });

    it("says a menu opened on a row, from the keyboard", () => {
      const { onMenuOpen } = renderReporting();

      fireEvent.contextMenu(row("Alpha"), { button: -1 });

      expect(onMenuOpen).toHaveBeenCalledWith("row", "keyboard");
    });

    it("says a menu opened on a row of a multi-selection", async () => {
      const { onMenuOpen } = renderReporting();
      await userEvent.click(checkbox("Alpha"));
      await userEvent.click(checkbox("Beta"));

      fireEvent.contextMenu(row("Alpha"), { clientX: 10, clientY: 10 });

      expect(onMenuOpen).toHaveBeenCalledWith("selection", "pointer");
    });

    it("says which of a group menu's items was used", async () => {
      const { onGroupMenuAction } = renderReporting();

      fireEvent.contextMenu(groupRow("First"));
      await userEvent.click(screen.getByRole("menuitem", { name: "Collapse" }));
      fireEvent.contextMenu(groupRow("First"));
      await userEvent.click(screen.getByRole("menuitem", { name: "Expand all" }));
      fireEvent.contextMenu(groupRow("Second"));
      await userEvent.click(screen.getByRole("menuitem", { name: "Select all in group" }));

      expect(onGroupMenuAction.mock.calls).toEqual([["collapse"], ["expand_all"], ["select_all"]]);
    });
  });
});
