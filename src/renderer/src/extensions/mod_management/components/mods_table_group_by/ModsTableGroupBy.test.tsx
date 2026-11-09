import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { ModsTableGroupBy } from "./ModsTableGroupBy";

const COLUMNS = [
  { id: "status", header: "Status" },
  { id: "category", header: "Category" },
];

const renderGroupBy = (grouping = "none") => {
  const onChange = vi.fn();
  render(<ModsTableGroupBy columns={COLUMNS} grouping={grouping} onChange={onChange} />);
  return onChange;
};

describe("ModsTableGroupBy", () => {
  it("shows what the table groups by", () => {
    renderGroupBy("category");

    expect(screen.getByRole("button")).toHaveTextContent("Category");
  });

  it("offers none, then each column it can group by, in order", async () => {
    const onChange = renderGroupBy("category");

    await userEvent.click(screen.getByRole("button"));

    const [none, ...columns] = screen.getAllByRole("option");
    expect(columns.map((option) => option.textContent)).toEqual(["Status", "Category"]);

    await userEvent.click(none);
    expect(onChange).toHaveBeenCalledWith("none");
  });

  it("groups by the column chosen", async () => {
    const onChange = renderGroupBy();

    await userEvent.click(screen.getByRole("button"));
    await userEvent.click(screen.getByRole("option", { name: "Status" }));

    expect(onChange).toHaveBeenCalledWith("status");
  });
});
