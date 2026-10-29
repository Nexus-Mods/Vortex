import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import type { IWhatsNew } from "../reducers";
import { WhatsNewDialog } from "./WhatsNewDialog";

const renderDialog = (whatsNew: IWhatsNew | undefined, visible = true) => {
  const onHide = vi.fn();
  const onConfirm = vi.fn();
  const store = {
    getState: () => ({ session: { updater: { whatsNew } }, persistent: {} }),
    subscribe: () => () => undefined,
    dispatch: vi.fn(),
  };

  render(
    <Provider store={store as never}>
      <WhatsNewDialog visible={visible} onConfirm={onConfirm} onHide={onHide} />
    </Provider>,
  );

  return { onHide, onConfirm };
};

describe("WhatsNewDialog", () => {
  it("renders nothing until there are notes to show", () => {
    renderDialog(undefined);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is not shown while not visible", () => {
    renderDialog({ version: "2.7.0", notes: "<p>Notes</p>" }, false);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the release notes, keeping their images and video", () => {
    renderDialog({
      version: "2.7.0",
      notes:
        '<section class="changelog-release"><h4>2.7.0</h4>' +
        '<img src="https://example.com/a.png" alt="shot">' +
        '<details open><summary>demo.mp4</summary><video src="https://example.com/v.mp4"></video></details>' +
        "</section>",
    });

    expect(screen.getByRole("dialog")).toHaveTextContent("What's New in");
    expect(screen.getByRole("img", { name: "shot" })).toBeInTheDocument();
    expect(document.querySelector("video")).not.toBeNull();
    expect(screen.getByRole("dialog")).not.toHaveTextContent("demo.mp4");
  });

  it("offers to download an update, then hides itself and acts", async () => {
    const { onHide, onConfirm } = renderDialog({
      version: "2.7.0",
      notes: "<p>Notes</p>",
      action: "download",
    });

    await userEvent.click(screen.getByRole("button", { name: "Download" }));

    expect(onHide).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("offers to restart for an update already staged", () => {
    renderDialog({ version: "2.7.0", notes: "<p>Notes</p>", action: "restart" });

    expect(screen.getByRole("button", { name: "Restart Now" })).toBeInTheDocument();
  });

  it("has only Close after an update", async () => {
    const { onHide, onConfirm } = renderDialog({ version: "2.7.0", notes: "<p>Notes</p>" });

    expect(screen.getAllByRole("button")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onHide).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("makes Close the strong button when it is alone", () => {
    renderDialog({ version: "2.7.0", notes: "<p>Notes</p>" });

    expect(screen.getByRole("button", { name: "Close" })).toHaveClass("nxm-button-strong");
  });

  it("makes Close the quieter button beside the update's", () => {
    renderDialog({ version: "2.7.0", notes: "<p>Notes</p>", action: "download" });

    expect(screen.getByRole("button", { name: "Close" })).toHaveClass("nxm-button-moderate");
  });

  it("says so when there are no notes", () => {
    renderDialog({ version: "2.7.0" });
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "No release notes are available for this update.",
    );
  });

  it("says a new version is available when an update has no notes", () => {
    renderDialog({ version: "2.7.0", action: "download" });
    expect(screen.getByRole("dialog")).toHaveTextContent("A new version of Vortex is available.");
  });
});
