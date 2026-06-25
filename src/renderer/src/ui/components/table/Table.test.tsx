import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";

import { Table } from "./Table";
import type { IColumnDef } from "./Table.types";

afterEach(() => {
  cleanup();
});

interface IRow {
  id: string;
  name: string;
  category: string;
  version: number;
}

const ROWS: IRow[] = [
  { id: "1", name: "Charlie", category: "UI", version: 3 },
  { id: "2", name: "Alpha", category: "Audio", version: 1 },
  { id: "3", name: "Bravo", category: "UI", version: 2 },
];

const COLUMNS: Array<IColumnDef<IRow>> = [
  {
    id: "name",
    header: "Name",
    getValue: (row) => row.name,
    sortable: true,
    filter: { type: "text" },
  },
  {
    id: "category",
    header: "Category",
    getValue: (row) => row.category,
    groupable: true,
    filter: {
      type: "select",
      options: [
        { label: "UI", value: "UI" },
        { label: "Audio", value: "Audio" },
      ],
    },
  },
  {
    id: "version",
    header: "Version",
    getValue: (row) => row.version,
    sortable: true,
  },
];

const renderTable = (props: Partial<React.ComponentProps<typeof Table<IRow>>> = {}) =>
  render(
    <Table columns={COLUMNS} data={ROWS} getRowId={(row) => row.id} pageSize={50} {...props} />,
  );

// Returns the text of the first body cell of each rendered data row, in order.
const bodyFirstColumn = () =>
  screen
    .getAllByRole("row")
    // Drop the two header rows (header + filter row).
    .slice(2)
    .map((row) => within(row).getAllByRole("cell")[0]?.textContent);

describe("Table", () => {
  it("renders a row per data item plus header and filter rows", () => {
    renderTable();
    expect(screen.getByRole("table")).toBeInTheDocument();
    // 1 header row + 1 filter row + 3 data rows.
    expect(screen.getAllByRole("row")).toHaveLength(5);
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });

  it("falls back to getValue when no cell renderer is supplied", () => {
    renderTable();
    expect(screen.getByRole("cell", { name: "Audio" })).toBeInTheDocument();
  });

  it("sorts ascending then descending when a sortable header is clicked", async () => {
    renderTable();
    const sortButton = screen.getByRole("button", { name: /name/i });

    await userEvent.click(sortButton);
    expect(bodyFirstColumn()).toEqual(["Alpha", "Bravo", "Charlie"]);

    await userEvent.click(sortButton);
    expect(bodyFirstColumn()).toEqual(["Charlie", "Bravo", "Alpha"]);
  });

  it("filters rows with a text filter (case-insensitive substring)", async () => {
    renderTable();
    await userEvent.type(screen.getByRole("textbox", { name: /filter by name/i }), "al");
    expect(bodyFirstColumn()).toEqual(["Alpha"]);
  });

  it("filters rows with a select filter", async () => {
    renderTable();
    await userEvent.click(screen.getByRole("button", { name: /filter by category/i }));
    await userEvent.click(screen.getByRole("option", { name: "UI" }));
    expect(bodyFirstColumn()).toEqual(["Charlie", "Bravo"]);
  });

  it("paginates and only renders the current page", () => {
    renderTable({ pageSize: 2 });
    expect(bodyFirstColumn()).toHaveLength(2);
    expect(screen.getByRole("navigation", { name: /pagination/i })).toBeInTheDocument();
  });

  it("does not paginate when pageSize is omitted", () => {
    render(<Table columns={COLUMNS} data={ROWS} getRowId={(row) => row.id} />);
    expect(screen.queryByRole("navigation", { name: /pagination/i })).not.toBeInTheDocument();
    // Every row renders.
    expect(bodyFirstColumn()).toEqual(["Charlie", "Alpha", "Bravo"]);
  });

  it("hides a column through the column toggle", async () => {
    renderTable();
    expect(screen.getByRole("columnheader", { name: "Category" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /manage columns/i }));
    await userEvent.click(screen.getByRole("option", { name: "Category" }));

    expect(screen.queryByRole("columnheader", { name: "Category" })).not.toBeInTheDocument();
  });

  it("offers a reset-widths action in the column menu, disabled until a column is resized", async () => {
    renderTable();
    await userEvent.click(screen.getByRole("button", { name: /manage columns/i }));

    // No column has been resized yet, so resetting is a no-op and disabled.
    expect(screen.getByRole("button", { name: /reset column widths/i })).toBeDisabled();
  });

  it("omits the reset-widths action when column resizing is disabled", async () => {
    renderTable({ enableColumnResize: false });
    await userEvent.click(screen.getByRole("button", { name: /manage columns/i }));

    expect(screen.queryByRole("button", { name: /reset column widths/i })).not.toBeInTheDocument();
  });

  it("enables reset for restored widths and reports an empty map when cleared", async () => {
    const onColumnWidthsChange = vi.fn();
    renderTable({ columnWidths: { name: 300 }, onColumnWidthsChange });
    await userEvent.click(screen.getByRole("button", { name: /manage columns/i }));

    // Restored widths count as custom widths, so resetting is available.
    const reset = screen.getByRole("button", { name: /reset column widths/i });
    expect(reset).toBeEnabled();

    await userEvent.click(reset);

    // Reset reports the cleared map and dismisses the menu.
    expect(onColumnWidthsChange).toHaveBeenCalledWith({});
    expect(screen.queryByRole("button", { name: /reset column widths/i })).not.toBeInTheDocument();
  });

  it("renders the empty state when no rows match", async () => {
    renderTable();
    await userEvent.type(screen.getByRole("textbox", { name: /filter by name/i }), "zzz");
    expect(screen.getByText("No results found.")).toBeInTheDocument();
  });

  it("groups rows by a column and hides the pager", async () => {
    renderTable({ pageSize: 2 });
    expect(screen.getByRole("navigation", { name: /pagination/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /group by category/i }));

    // Two group headers (UI, Audio), and the pager is gone.
    expect(screen.getByRole("button", { name: "UI group, 2 rows" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Audio group, 1 row" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /pagination/i })).not.toBeInTheDocument();
    // All matching rows render despite pageSize 2 (grouping bypasses paging).
    expect(screen.getByRole("cell", { name: "Charlie" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Bravo" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Alpha" })).toBeInTheDocument();
  });

  it("collapses and expands a group", async () => {
    renderTable();
    await userEvent.click(screen.getByRole("button", { name: /group by category/i }));
    expect(screen.getByRole("cell", { name: "Alpha" })).toBeInTheDocument();

    // Collapse the Audio group -> its only row (Alpha) disappears.
    await userEvent.click(screen.getByRole("button", { name: "Audio group, 1 row" }));
    expect(screen.queryByRole("cell", { name: "Alpha" })).not.toBeInTheDocument();

    // Expand again -> row returns.
    await userEvent.click(screen.getByRole("button", { name: "Audio group, 1 row" }));
    expect(screen.getByRole("cell", { name: "Alpha" })).toBeInTheDocument();
  });

  it("toggles grouping off when the active group column is clicked again", async () => {
    renderTable({ pageSize: 2 });
    const groupButton = screen.getByRole("button", { name: /group by category/i });

    await userEvent.click(groupButton);
    expect(screen.queryByRole("navigation", { name: /pagination/i })).not.toBeInTheDocument();

    await userEvent.click(groupButton);
    expect(screen.getByRole("navigation", { name: /pagination/i })).toBeInTheDocument();
  });
});
