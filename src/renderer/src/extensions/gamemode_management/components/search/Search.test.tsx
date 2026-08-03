import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Search } from "./Search";

afterEach(cleanup);

const renderComponent = (props: Partial<React.ComponentProps<typeof Search>> = {}) => {
  const onChange = vi.fn();
  const onSubmit = vi.fn();

  render(
    <Search
      placeholder="Search games..."
      value=""
      onChange={onChange}
      onSubmit={onSubmit}
      {...props}
    />,
  );

  return { onChange, onSubmit };
};

describe("Search", () => {
  it("reports what was typed", () => {
    const { onChange } = renderComponent();

    fireEvent.change(screen.getByTestId("search-input"), {
      target: { value: "Skyr" },
    });

    expect(onChange).toHaveBeenCalledWith("Skyr");
  });

  it("offers no way to clear an already-empty field", () => {
    renderComponent();
    expect(screen.queryByTestId("search-clear")).not.toBeInTheDocument();
  });

  it("offers to clear once there's something to clear", () => {
    renderComponent({ value: "Skyr" });
    expect(screen.getByTestId("search-clear")).toBeInTheDocument();
  });

  it("clears the value", () => {
    const { onChange } = renderComponent({ value: "Skyr" });

    fireEvent.click(screen.getByTestId("search-clear"));

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("puts focus back in the input after clearing, ready for a new search", () => {
    renderComponent({ value: "Skyr" });

    fireEvent.click(screen.getByTestId("search-clear"));

    expect(screen.getByTestId("search-input")).toHaveFocus();
  });

  it("submits on enter without navigating away", () => {
    const { onSubmit } = renderComponent({ value: "Skyr" });

    fireEvent.submit(screen.getByTestId("search-input").closest("form")!);

    expect(onSubmit).toHaveBeenCalled();
  });

  it("does not submit when the field is cleared", () => {
    const { onSubmit } = renderComponent({ value: "Skyr" });

    fireEvent.click(screen.getByTestId("search-clear"));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
