import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Search } from "./Search";

vi.mock("react-i18next", () => vi.importActual("@/test-utils/i18nMock"));

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

    fireEvent.change(screen.getByPlaceholderText("Search games..."), {
      target: { value: "Skyr" },
    });

    expect(onChange).toHaveBeenCalledWith("Skyr");
  });

  it("offers no way to clear an already-empty field", () => {
    renderComponent();
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
  });

  it("offers to clear once there's something to clear", () => {
    renderComponent({ value: "Skyr" });
    expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument();
  });

  it("clears the value", () => {
    const { onChange } = renderComponent({ value: "Skyr" });

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("puts focus back in the input after clearing, ready for a new search", () => {
    renderComponent({ value: "Skyr" });

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(screen.getByPlaceholderText("Search games...")).toHaveFocus();
  });

  it("submits on enter without navigating away", () => {
    const { onSubmit } = renderComponent({ value: "Skyr" });

    fireEvent.submit(screen.getByPlaceholderText("Search games...").closest("form")!);

    expect(onSubmit).toHaveBeenCalled();
  });

  it("does not submit when the field is cleared", () => {
    const { onSubmit } = renderComponent({ value: "Skyr" });

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
