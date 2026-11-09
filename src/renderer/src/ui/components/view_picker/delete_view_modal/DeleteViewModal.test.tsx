import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { DeleteViewModal } from "./DeleteViewModal";

const renderModal = (name?: string) => {
  const onDelete = vi.fn();
  const onClose = vi.fn();
  render(
    <DeleteViewModal
      description={`Delete "${name}" for good?`}
      name={name}
      onClose={onClose}
      onDelete={onDelete}
    />,
  );
  return { onDelete, onClose };
};

describe("DeleteViewModal", () => {
  it("asks before deleting a view, in the page's words", () => {
    renderModal("Mine");

    expect(screen.getByRole("dialog", { name: "Delete view" })).toHaveTextContent(
      'Delete "Mine" for good?',
    );
  });

  it("isn't showing without a view to delete", () => {
    renderModal(undefined);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("deletes it, or keeps it on Cancel", async () => {
    const { onDelete, onClose } = renderModal("Mine");

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Delete view" }));
    expect(onDelete).toHaveBeenCalled();
  });
});
