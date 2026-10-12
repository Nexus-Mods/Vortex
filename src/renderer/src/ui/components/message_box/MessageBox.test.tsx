import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it } from "vitest";

import { MessageBox } from "./MessageBox";

const renderBox = (props: Partial<React.ComponentProps<typeof MessageBox>> = {}) =>
  render(
    <MessageBox
      hideLabel="Hide Details"
      isCollapsible={false}
      message={"first line\nsecond line"}
      shouldWrap={false}
      showLabel="Show Details"
      {...props}
    />,
  );

describe("MessageBox", () => {
  it("shows the message in a read-only box", () => {
    renderBox();

    expect(screen.getByTestId("dialog-message")).toHaveValue("first line\nsecond line");
    expect(screen.getByTestId("dialog-message")).toHaveAttribute("readonly");
  });

  it("has no toggle when it is not collapsible", () => {
    renderBox();

    expect(screen.queryByTestId("dialog-message-toggle")).not.toBeInTheDocument();
  });

  it("starts closed behind a toggle when it is collapsible", () => {
    renderBox({ isCollapsible: true });

    expect(screen.queryByTestId("dialog-message")).not.toBeInTheDocument();
    expect(screen.getByTestId("dialog-message-toggle")).toHaveAttribute("aria-expanded", "false");
  });

  it("opens and closes with the toggle", async () => {
    renderBox({ isCollapsible: true });

    await userEvent.click(screen.getByTestId("dialog-message-toggle"));

    expect(screen.getByTestId("dialog-message")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-message-toggle")).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(screen.getByTestId("dialog-message-toggle"));

    expect(screen.queryByTestId("dialog-message")).not.toBeInTheDocument();
  });

  it("wraps long lines only when asked to", () => {
    const { unmount } = renderBox({ shouldWrap: true });
    expect(screen.getByTestId("dialog-message")).toHaveAttribute("wrap", "soft");
    unmount();

    renderBox({ shouldWrap: false });
    expect(screen.getByTestId("dialog-message")).toHaveAttribute("wrap", "off");
  });
});
