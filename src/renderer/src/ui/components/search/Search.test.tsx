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

  it("clears the value on Escape", () => {
    const { onChange } = renderComponent({ value: "Skyr" });

    fireEvent.keyDown(screen.getByTestId("search-input"), { key: "Escape" });

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("leaves Escape to what's around it when the field is empty", () => {
    const onKeyDown = vi.fn();
    render(
      <div onKeyDown={onKeyDown}>
        <Search value="" onChange={vi.fn()} />
      </div>,
    );

    fireEvent.keyDown(screen.getByTestId("search-input"), { key: "Escape" });

    expect(onKeyDown).toHaveBeenCalled();
  });

  it("keeps Escape from what's around it while it clears", () => {
    const onKeyDown = vi.fn();
    render(
      <div onKeyDown={onKeyDown}>
        <Search value="Skyr" onChange={vi.fn()} />
      </div>,
    );

    fireEvent.keyDown(screen.getByTestId("search-input"), { key: "Escape" });

    expect(onKeyDown).not.toHaveBeenCalled();
  });

  it("stops at maxLength without showing a count", () => {
    renderComponent({ maxLength: 100 });

    expect(screen.getByTestId("search-input")).toHaveAttribute("maxlength", "100");
    expect(screen.queryByLabelText("remaining character count")).toBeNull();
  });

  it("marks the box invalid and says why", () => {
    renderComponent({ value: "a", errorMessage: "Enter at least 2 characters to search." });

    expect(screen.getByTestId("search-input")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByTestId("search-input")).toHaveAccessibleDescription(
      "Enter at least 2 characters to search.",
    );
  });

  it("shows the error in a tooltip under the box", () => {
    renderComponent({ value: "a", errorMessage: "Enter at least 2 characters to search." });

    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("shows no tooltip without an error", () => {
    renderComponent({ value: "a" });

    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
