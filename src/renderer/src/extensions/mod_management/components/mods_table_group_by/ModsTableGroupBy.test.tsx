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

    expect(screen.getByRole("button", { name: /Group by/ })).toHaveTextContent("Category");
  });

  it("offers none, then each column it can group by, in order", async () => {
    renderGroupBy();

    await userEvent.click(screen.getByRole("button", { name: /Group by/ }));

    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "None",
      "Status",
      "Category",
    ]);
  });

  it("groups by the column chosen", async () => {
    const onChange = renderGroupBy();

    await userEvent.click(screen.getByRole("button", { name: /Group by/ }));
    await userEvent.click(screen.getByRole("option", { name: "Status" }));

    expect(onChange).toHaveBeenCalledWith("status");
  });
});
