import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { Pagination } from "./Pagination";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const renderComponent = (props: Partial<React.ComponentProps<typeof Pagination>> = {}) => {
  const onPaginationUpdate = vi.fn();

  render(
    <Pagination
      currentPage={1}
      recordsPerPage={10}
      totalRecords={50}
      onPaginationUpdate={onPaginationUpdate}
      {...props}
    />,
  );

  return { onPaginationUpdate };
};

// --- Tests ---

describe("Pagination", () => {
  it("renders nothing when there is a single page", () => {
    renderComponent({ totalRecords: 5 });
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("renders a button per page plus prev/next", () => {
    renderComponent();
    // pages 1..5
    for (const page of [1, 2, 3, 4, 5]) {
      expect(screen.getByRole("button", { name: `Go to page ${page}` })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Go to previous page" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to next page" })).toBeInTheDocument();
  });

  it("marks the current page", () => {
    renderComponent({ currentPage: 2 });
    const current = screen.getByRole("button", { name: "Go to page 2" });
    expect(current).toHaveAttribute("aria-current", "true");
    expect(current).toHaveClass("nxm-pagination-number-active");
  });

  it("calls onPaginationUpdate with the clicked page and page size", async () => {
    const { onPaginationUpdate } = renderComponent();
    await userEvent.click(screen.getByRole("button", { name: "Go to page 3" }));
    expect(onPaginationUpdate).toHaveBeenCalledWith(3, 10);
  });

  it("advances to the next page via the next arrow", async () => {
    const { onPaginationUpdate } = renderComponent();
    await userEvent.click(screen.getByRole("button", { name: "Go to next page" }));
    expect(onPaginationUpdate).toHaveBeenCalledWith(2, 10);
  });

  describe("boundaries", () => {
    it("disables the previous arrow on the first page", () => {
      renderComponent();
      expect(screen.getByRole("button", { name: "Go to previous page" })).toBeDisabled();
    });

    it("disables the next arrow on the last page", () => {
      renderComponent({ currentPage: 5 });
      expect(screen.getByRole("button", { name: "Go to next page" })).toBeDisabled();
    });
  });

  describe("jump to page", () => {
    it("renders the jump-to-page input for large page counts", () => {
      renderComponent({ totalRecords: 100 });
      expect(screen.getByLabelText("Jump to page")).toBeInTheDocument();
    });

    it("does not render the jump-to-page input for small page counts", () => {
      renderComponent();
      expect(screen.queryByLabelText("Jump to page")).not.toBeInTheDocument();
    });
  });
});
