import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { Modal } from "./Modal";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const renderComponent = (props: Partial<React.ComponentProps<typeof Modal>> = {}) => {
  const onClose = vi.fn();

  render(
    <Modal isOpen={true} size="md" onClose={onClose} {...props}>
      {props.children ?? "Body content"}
    </Modal>,
  );

  return { onClose };
};

// --- Tests ---

describe("Modal", () => {
  it("does not render its content when closed", () => {
    renderComponent({ isOpen: false });
    expect(screen.queryByText("Body content")).not.toBeInTheDocument();
  });

  it("renders the title and children when open", () => {
    renderComponent({ title: "My title" });
    expect(screen.getByText("My title")).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });

  it("applies the size modifier class", () => {
    renderComponent({ size: "lg" });
    expect(document.querySelector(".nxm-modal")).toHaveClass("nxm-modal-lg");
  });

  it("renders a close button by default that calls onClose", async () => {
    const { onClose } = renderComponent({ title: "My title" });
    const close = document.querySelector(".nxm-modal-close");
    expect(close).toBeInTheDocument();
    await userEvent.click(close as Element);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("hides the close button when showCloseButton is false", () => {
    renderComponent({ showCloseButton: false, title: "My title" });
    expect(document.querySelector(".nxm-modal-close")).not.toBeInTheDocument();
  });
});
