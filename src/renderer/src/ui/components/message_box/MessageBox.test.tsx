import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MessageBox } from "./MessageBox";

const renderBox = (props: Partial<React.ComponentProps<typeof MessageBox>> = {}) =>
  render(
    <MessageBox
      copyLabel="Copy"
      hideLabel="Hide Details"
      isCollapsible={false}
      message={"first line\nsecond line"}
      shouldWrap={false}
      showLabel="Show Details"
      {...props}
    />,
  );

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

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

  it("has no margin of its own, so its parent places it", () => {
    const { container } = renderBox();

    expect(container.firstElementChild).toHaveClass("nxm-message-box");
    expect(container.firstElementChild?.className).not.toMatch(/\bm[tblrxy]?-\d/);
  });

  describe("copy button", () => {
    const stubClipboard = () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("api", { clipboard: { writeText } });

      return writeText;
    };

    it("is named by copyLabel", () => {
      renderBox({ copyLabel: "Copy details" });

      expect(screen.getByRole("button", { name: "Copy details" })).toBeInTheDocument();
    });

    it("is drawn as a small neutral button, with the button styles' classes", () => {
      renderBox();

      expect(screen.getByTestId("dialog-message-copy")).toHaveClass(
        "nxm-button",
        "nxm-button-neutral",
        "nxm-button-weak",
        "nxm-button-sm",
      );
    });

    it("tells its parent once the message has been copied, and not before", async () => {
      const writeText = stubClipboard();
      const onCopied = vi.fn();
      renderBox({ onCopied });

      expect(onCopied).not.toHaveBeenCalled();

      await userEvent.click(screen.getByTestId("dialog-message-copy"));

      await waitFor(() => expect(onCopied).toHaveBeenCalledTimes(1));
      expect(writeText).toHaveBeenCalledWith("first line\nsecond line");
    });

    it("shows only an icon, named by copyLabel, with the same text as its tooltip", async () => {
      renderBox({ copyLabel: "Copy message" });

      const button = screen.getByRole("button", { name: "Copy message" });
      expect(button).toHaveTextContent("");
      expect(button.querySelector(".nxm-icon")).toBeInTheDocument();

      await userEvent.hover(button);

      expect(await screen.findByRole("tooltip")).toHaveTextContent("Copy message");
    });

    it("is not shown while the box is closed", () => {
      renderBox({ isCollapsible: true });

      expect(screen.queryByTestId("dialog-message-copy")).not.toBeInTheDocument();
    });

    it("copies the message, and shows a tick for a moment", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const writeText = stubClipboard();
      renderBox();

      const copy = screen.getByTestId("dialog-message-copy");
      const symbol = () => copy.querySelector("[data-symbol]")?.getAttribute("data-symbol");
      expect(symbol()).toBe("content_copy");

      await userEvent.click(copy);

      expect(writeText).toHaveBeenCalledWith("first line\nsecond line");
      await waitFor(() => expect(symbol()).toBe("check"));

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(symbol()).toBe("content_copy");
    });
  });
});
