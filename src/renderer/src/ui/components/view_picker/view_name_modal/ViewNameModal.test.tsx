import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { ViewNameModal } from "./ViewNameModal";

const renderModal = (renaming?: string) => {
  const onCreate = vi.fn();
  const onClose = vi.fn();
  render(
    <ViewNameModal
      isOpen
      createDescription="Give your view a name."
      placeholder="e.g. Author view"
      renameDescription="Give your view a new name."
      renaming={renaming}
      onClose={onClose}
      onSubmit={onCreate}
    />,
  );
  return { onCreate, onClose };
};

const nameField = () => screen.getByRole("textbox", { name: "Name view" });

describe("ViewNameModal", () => {
  it("asks for a name, in the page's words", () => {
    renderModal();

    expect(screen.getByRole("dialog", { name: "Create a new view" })).toBeInTheDocument();
    expect(screen.getByText("Give your view a name.")).toBeInTheDocument();
    expect(nameField()).toHaveAttribute("placeholder", "e.g. Author view");
  });

  it("can't create a view without a name", async () => {
    renderModal();

    expect(screen.getByRole("button", { name: "Create view" })).toBeDisabled();

    await userEvent.type(nameField(), "   ");
    expect(screen.getByRole("button", { name: "Create view" })).toBeDisabled();
  });

  it("creates the view by its name, trimmed, from the button or Enter", async () => {
    const { onCreate } = renderModal();

    await userEvent.type(nameField(), "  Recently installed {Enter}");

    expect(onCreate).toHaveBeenCalledWith("Recently installed");
  });

  it("leaves without creating one on Cancel", async () => {
    const { onCreate, onClose } = renderModal();

    await userEvent.type(nameField(), "Mine");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("renames a view, starting from its name", async () => {
    const { onCreate } = renderModal("Mine");

    expect(screen.getByRole("dialog", { name: "Rename view" })).toHaveTextContent(
      "Give your view a new name.",
    );
    expect(nameField()).toHaveValue("Mine");

    await userEvent.clear(nameField());
    await userEvent.type(nameField(), "Theirs");
    await userEvent.click(screen.getByRole("button", { name: "Rename view" }));

    expect(onCreate).toHaveBeenCalledWith("Theirs");
  });
});
