import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { settleTransitions } from "@/test-utils/transitions";

import { closeDialog } from "../../actions/notifications";
import type { IDialog, IDialogContent } from "../../types/IDialog";
import type { IState } from "../../types/IState";
import { ModalLayer } from "./ModalLayer";

vi.mock("../../actions/notifications", () => ({
  closeDialog: vi.fn((id: string, action?: string, input?: unknown) => ({
    type: "CLOSE_DIALOG",
    id,
    action,
    input,
  })),
}));

const dialogWith = (id: string, content: IDialogContent): IDialog => ({
  id,
  type: "question",
  title: `Title ${id}`,
  content,
  defaultAction: "Delete",
  actions: ["Cancel", "Delete"],
});

const renderLayer = (dialogs: IDialog[]) => {
  const dispatch = vi.fn();
  const store = {
    getState: () => ({ session: { notifications: { dialogs } } }) as unknown as IState,
    subscribe: () => () => undefined,
    dispatch,
  };

  render(
    <Provider store={store as never}>
      <ModalLayer />
    </Provider>,
  );

  return { dispatch };
};

describe("ModalLayer", () => {
  it("renders nothing without dialogs", () => {
    renderLayer([]);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders nothing when the first dialog needs the legacy renderer", () => {
    renderLayer([
      dialogWith("legacy", { text: "t", bbcode: "[b]b[/b]" }),
      dialogWith("text", { text: "t" }),
    ]);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders one button per action and no close button", async () => {
    renderLayer([dialogWith("one", { text: "Hello" })]);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);

    await settleTransitions();
  });

  it("closes the dialog with the label of the clicked action", async () => {
    const { dispatch } = renderLayer([dialogWith("one", { text: "Hello" })]);

    await userEvent.click(screen.getByTestId("dialog-action-Cancel"));

    expect(closeDialog).toHaveBeenCalledWith("one", "Cancel", {});
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "CLOSE_DIALOG", id: "one" }),
    );

    await settleTransitions();
  });

  it("focuses the default action and answers it on Enter", async () => {
    const { dispatch } = renderLayer([dialogWith("one", { text: "Hello" })]);

    await settleTransitions();
    expect(screen.getByTestId("dialog-action-Delete")).toHaveFocus();

    await userEvent.keyboard("{Enter}");

    expect(dispatch).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "one", action: "Delete" }),
    );

    await settleTransitions();
  });

  it("is not dismissed by Escape, which would leave the caller waiting", async () => {
    const { dispatch } = renderLayer([dialogWith("one", { text: "Hello" })]);

    await userEvent.keyboard("{Escape}");

    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await settleTransitions();
  });
});
