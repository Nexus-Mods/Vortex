import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { Modal } from "./Modal";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

// --- Tests ---

describe("Modal", () => {
  it("does not render its content when closed", () => {
    render(
      <Modal isOpen={false} size="md" onClose={() => undefined}>
        Body content
      </Modal>,
    );
    expect(screen.queryByText("Body content")).not.toBeInTheDocument();
  });

  it("renders the title and children when open", () => {
    render(
      <Modal isOpen={true} size="md" title="My title" onClose={() => undefined}>
        Body content
      </Modal>,
    );
    expect(screen.getByText("My title")).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });

  it("applies the size modifier class", () => {
    render(
      <Modal isOpen={true} size="lg" onClose={() => undefined}>
        Body
      </Modal>,
    );
    expect(document.querySelector(".nxm-modal")).toHaveClass("nxm-modal-lg");
  });

  it("renders a close button by default that calls onClose", async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} size="md" title="My title" onClose={onClose}>
        Body
      </Modal>,
    );
    const close = document.querySelector(".nxm-modal-close");
    expect(close).toBeInTheDocument();
    await userEvent.click(close as Element);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("hides the close button when showCloseButton is false", () => {
    render(
      <Modal
        isOpen={true}
        showCloseButton={false}
        size="md"
        title="My title"
        onClose={() => undefined}
      >
        Body
      </Modal>,
    );
    expect(document.querySelector(".nxm-modal-close")).not.toBeInTheDocument();
  });
});
