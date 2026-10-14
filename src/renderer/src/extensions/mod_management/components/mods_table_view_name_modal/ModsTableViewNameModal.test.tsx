import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { ModsTableViewNameModal } from "./ModsTableViewNameModal";

const renderModal = (renaming?: string) => {
  const onCreate = vi.fn();
  const onClose = vi.fn();
  render(
    <ModsTableViewNameModal isOpen renaming={renaming} onClose={onClose} onSubmit={onCreate} />,
  );
  return { onCreate, onClose };
};

const nameField = () => screen.getByRole("textbox", { name: "Name view" });

describe("ModsTableViewNameModal", () => {
  it("asks for a name, as the design words it", () => {
    renderModal();

    expect(screen.getByRole("dialog", { name: "Create a new view" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Give your view a name. You can customise its columns, grouping and filters after creating it.",
      ),
    ).toBeInTheDocument();
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
      "Give your view a new name. Your columns, grouping and filters won't change.",
    );
    expect(nameField()).toHaveValue("Mine");

    await userEvent.clear(nameField());
    await userEvent.type(nameField(), "Theirs");
    await userEvent.click(screen.getByRole("button", { name: "Rename view" }));

    expect(onCreate).toHaveBeenCalledWith("Theirs");
  });
});
