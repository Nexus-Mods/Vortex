import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { Pagination } from "./Pagination";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

// --- Tests ---

describe("Pagination", () => {
  it("renders nothing when there is a single page", () => {
    const { container } = render(
      <Pagination currentPage={1} recordsPerPage={10} totalRecords={5} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a button per page plus prev/next", () => {
    render(<Pagination currentPage={1} recordsPerPage={10} totalRecords={50} />);
    // pages 1..5
    for (const page of [1, 2, 3, 4, 5]) {
      expect(screen.getByRole("button", { name: `Go to page ${page}` })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Go to previous page" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to next page" })).toBeInTheDocument();
  });

  it("marks the current page", () => {
    render(<Pagination currentPage={2} recordsPerPage={10} totalRecords={50} />);
    const current = screen.getByRole("button", { name: "Go to page 2" });
    expect(current).toHaveAttribute("aria-current", "true");
    expect(current).toHaveClass("nxm-pagination-number-active");
  });

  it("calls onPaginationUpdate with the clicked page and page size", async () => {
    const onPaginationUpdate = vi.fn();
    render(
      <Pagination
        currentPage={1}
        recordsPerPage={10}
        totalRecords={50}
        onPaginationUpdate={onPaginationUpdate}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Go to page 3" }));
    expect(onPaginationUpdate).toHaveBeenCalledWith(3, 10);
  });

  it("advances to the next page via the next arrow", async () => {
    const onPaginationUpdate = vi.fn();
    render(
      <Pagination
        currentPage={1}
        recordsPerPage={10}
        totalRecords={50}
        onPaginationUpdate={onPaginationUpdate}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Go to next page" }));
    expect(onPaginationUpdate).toHaveBeenCalledWith(2, 10);
  });

  describe("boundaries", () => {
    it("disables the previous arrow on the first page", () => {
      render(<Pagination currentPage={1} recordsPerPage={10} totalRecords={50} />);
      expect(screen.getByRole("button", { name: "Go to previous page" })).toBeDisabled();
    });

    it("disables the next arrow on the last page", () => {
      render(<Pagination currentPage={5} recordsPerPage={10} totalRecords={50} />);
      expect(screen.getByRole("button", { name: "Go to next page" })).toBeDisabled();
    });
  });

  describe("jump to page", () => {
    it("renders the jump-to-page input for large page counts", () => {
      render(<Pagination currentPage={1} recordsPerPage={10} totalRecords={100} />);
      expect(screen.getByLabelText("Jump to page")).toBeInTheDocument();
    });

    it("does not render the jump-to-page input for small page counts", () => {
      render(<Pagination currentPage={1} recordsPerPage={10} totalRecords={50} />);
      expect(screen.queryByLabelText("Jump to page")).not.toBeInTheDocument();
    });
  });
});
