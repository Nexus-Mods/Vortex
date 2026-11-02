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

const nameField = () => screen.getByRole("textbox");
const submitButton = () => screen.getByTestId("view-name-submit");

describe("ModsTableViewNameModal", () => {
  // By key, as the test `t` hands keys back: which wording shows is what tells the modes apart.
  it("asks for a name for a new view", () => {
    renderModal();

    expect(screen.getByRole("dialog")).toHaveAccessibleName("modsTable::viewName::createTitle");
    expect(screen.getByRole("dialog")).toHaveTextContent("modsTable::viewName::createIntro");
    expect(submitButton()).toHaveTextContent("modsTable::viewName::create");
    expect(nameField()).toHaveValue("");
  });

  it("can't create a view without a name", async () => {
    renderModal();

    expect(submitButton()).toBeDisabled();

    await userEvent.type(nameField(), "   ");
    expect(submitButton()).toBeDisabled();
  });

  it("creates the view by its name, trimmed, from the button or Enter", async () => {
    const { onCreate } = renderModal();

    await userEvent.type(nameField(), "  Recently installed {Enter}");

    expect(onCreate).toHaveBeenCalledWith("Recently installed");
  });

  it("leaves without creating one on Cancel", async () => {
    const { onCreate, onClose } = renderModal();

    await userEvent.type(nameField(), "Mine");
    await userEvent.click(screen.getByTestId("view-name-cancel"));

    expect(onClose).toHaveBeenCalled();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("renames a view, starting from its name", async () => {
    const { onCreate } = renderModal("Mine");

    expect(screen.getByRole("dialog")).toHaveAccessibleName("modsTable::viewName::renameTitle");
    expect(screen.getByRole("dialog")).toHaveTextContent("modsTable::viewName::renameIntro");
    expect(nameField()).toHaveValue("Mine");

    await userEvent.clear(nameField());
    await userEvent.type(nameField(), "Theirs");
    await userEvent.click(submitButton());

    expect(onCreate).toHaveBeenCalledWith("Theirs");
  });
});
