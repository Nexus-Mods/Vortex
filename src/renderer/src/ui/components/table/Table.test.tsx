import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it } from "vitest";

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
