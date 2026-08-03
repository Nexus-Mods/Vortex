import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import CategoryDialog from "./CategoryDialog";

vi.mock("./CategoryList", () => ({
  default: () => <div data-testid="cat-list">stub</div>,
}));

describe("CategoryDialog", () => {
  it("does not render when not visible", () => {
    render(<CategoryDialog visible={false} onHide={vi.fn()} />);
    expect(screen.queryByTestId("cat-list")).not.toBeInTheDocument();
  });

  it("renders the list and calls onHide when closed", async () => {
    const onHide = vi.fn();
    render(<CategoryDialog visible={true} onHide={onHide} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("cat-list")).toBeInTheDocument();
    // Close button is provided by Modal; query and click like Modal.test
    const close = document.querySelector(".nxm-modal-close");
    await userEvent.click(close);
    expect(onHide).toHaveBeenCalledOnce();
  });
});
