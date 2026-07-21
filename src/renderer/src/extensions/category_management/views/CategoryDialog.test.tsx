import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import CategoryDialog from "./CategoryDialog";

// eslint-disable-next-line @eslint-react/component-hook-factories
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock("./CategoryList", () => ({
  default: () => <div data-testid="cat-list">stub</div>,
}));

afterEach(() => cleanup());

describe("CategoryDialog", () => {
  it("does not render when not visible", () => {
    render(<CategoryDialog visible={false} onHide={vi.fn()} />);
    expect(screen.queryByTestId("cat-list")).not.toBeInTheDocument();
  });

  it("renders title and calls onHide when closed", async () => {
    const onHide = vi.fn();
    render(<CategoryDialog visible={true} onHide={onHide} />);
    expect(screen.getByText("Categories")).toBeInTheDocument();
    // Close button is provided by Modal; query and click like Modal.test
    const close = document.querySelector(".nxm-modal-close");
    await userEvent.click(close);
    expect(onHide).toHaveBeenCalledOnce();
  });
});
