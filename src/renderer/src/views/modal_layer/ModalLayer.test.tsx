import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { settleTransitions } from "@/test-utils/transitions";

import { closeDialog, closeDialogs, triggerDialogLink } from "../../actions/notifications";
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
  closeDialogs: vi.fn((ids: string[], action?: string, input?: unknown) => ({
    type: "CLOSE_DIALOGS",
    ids,
    action,
    input,
  })),
  triggerDialogLink: vi.fn(),
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
  describe("checkboxes", () => {
    const withCheckboxes = (id: string, title = `Title ${id}`): IDialog => ({
      ...dialogWith(id, {
        text: "Hello",
        checkboxes: [
          { id: "remember", value: false, text: "Remember my choice" },
          { id: "locked", value: true, text: "Locked", disabled: true },
        ],
      }),
      title,
    });

    it("renders each checkbox with its starting value", async () => {
      renderLayer([withCheckboxes("one")]);

      expect(screen.getByTestId("dialog-checkbox-remember")).not.toBeChecked();
      expect(screen.getByTestId("dialog-checkbox-locked")).toBeChecked();
      expect(screen.getByTestId("dialog-checkbox-locked")).toHaveAttribute("aria-disabled", "true");

      await settleTransitions();
    });

    it("answers with the ticked values keyed by checkbox id", async () => {
      renderLayer([withCheckboxes("one")]);

      await userEvent.click(screen.getByTestId("dialog-checkbox-remember"));
      await userEvent.click(screen.getByTestId("dialog-action-Delete"));

      expect(closeDialog).toHaveBeenCalledWith("one", "Delete", { remember: true, locked: true });

      await settleTransitions();
    });

    it("answers a dialog without a ticked remember on its own", async () => {
      renderLayer([withCheckboxes("one"), withCheckboxes("two")]);

      await userEvent.click(screen.getByTestId("dialog-action-Cancel"));

      expect(closeDialog).toHaveBeenCalledWith("one", "Cancel", { remember: false, locked: true });
      expect(closeDialogs).not.toHaveBeenCalled();

      await settleTransitions();
    });

    it("answers the queued dialogs it matches when remember is ticked", async () => {
      renderLayer([
        withCheckboxes("one", "Same"),
        withCheckboxes("two", "Same"),
        { ...withCheckboxes("three", "Other"), actions: ["Yes", "No"] },
      ]);

      await userEvent.click(screen.getByTestId("dialog-checkbox-remember"));
      await userEvent.click(screen.getByTestId("dialog-action-Delete"));

      expect(closeDialogs).toHaveBeenCalledWith(["one", "two"], "Delete", {
        remember: true,
        locked: true,
      });

      await settleTransitions();
    });

    it("also answers queued dialogs with the same actions, whatever their title", async () => {
      renderLayer([withCheckboxes("one", "First"), withCheckboxes("two", "Second")]);

      await userEvent.click(screen.getByTestId("dialog-checkbox-remember"));
      await userEvent.click(screen.getByTestId("dialog-action-Cancel"));

      expect(closeDialogs).toHaveBeenCalledWith(["one", "two"], "Cancel", {
        remember: true,
        locked: true,
      });

      await settleTransitions();
    });

    it("leaves a dialog with a rich-text checkbox to the legacy renderer", () => {
      renderLayer([
        dialogWith("one", {
          text: "t",
          checkboxes: [{ id: "a", value: false, bbcode: "[b]b[/b]" }],
        }),
      ]);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
  describe("size", () => {
    it("uses the small modal for a short message", async () => {
      renderLayer([dialogWith("one", { text: "Remove it?" })]);

      expect(screen.getByRole("dialog")).toHaveClass("nxm-modal-sm");

      await settleTransitions();
    });

    it("uses the medium modal for a longer message", async () => {
      renderLayer([dialogWith("one", { text: "x".repeat(121) })]);

      expect(screen.getByRole("dialog")).toHaveClass("nxm-modal-md");

      await settleTransitions();
    });
  });
  describe("destructive actions", () => {
    const removing = (): IDialog => ({
      ...dialogWith("one", { text: "Remove it?" }),
      defaultAction: "Cancel",
      actions: ["Cancel", "Remove"],
    });

    it("shows Remove as a danger button and keeps the default Cancel neutral", async () => {
      renderLayer([removing()]);

      expect(screen.getByTestId("dialog-action-Remove")).toHaveClass("nxm-button-danger");
      expect(screen.getByTestId("dialog-action-Cancel")).toHaveClass("nxm-button-neutral");
      expect(screen.getByTestId("dialog-action-Cancel")).not.toHaveClass("nxm-button-primary");

      await settleTransitions();
    });

    it("still focuses the default action", async () => {
      renderLayer([removing()]);

      await settleTransitions();

      expect(screen.getByTestId("dialog-action-Cancel")).toHaveFocus();
    });

    it("keeps the default action primary when nothing is destructive", async () => {
      renderLayer([dialogWith("one", { text: "Hello" })]);

      expect(screen.getByTestId("dialog-action-Delete")).toHaveClass("nxm-button-primary");

      await settleTransitions();
    });
  });
  describe("inputs", () => {
    const withInput = (value?: string): IDialog => ({
      ...dialogWith("one", {
        text: "Name it",
        input: [{ id: "name", label: "Name", placeholder: "AAA", value }],
      }),
      defaultAction: "Delete",
    });

    it("shows the input with its starting value and focuses it", async () => {
      renderLayer([withInput("Start")]);

      await settleTransitions();

      expect(screen.getByTestId("dialog-input-name")).toHaveValue("Start");
      expect(screen.getByTestId("dialog-input-name")).toHaveFocus();
    });

    it("answers with what was typed, keyed by input id", async () => {
      renderLayer([withInput("Start")]);

      await userEvent.clear(screen.getByTestId("dialog-input-name"));
      await userEvent.type(screen.getByTestId("dialog-input-name"), "Typed");
      await userEvent.click(screen.getByTestId("dialog-action-Delete"));

      expect(closeDialog).toHaveBeenCalledWith("one", "Delete", { name: "Typed" });

      await settleTransitions();
    });

    it("answers with the starting value when nothing was typed, and undefined when there is none", async () => {
      renderLayer([withInput()]);

      await userEvent.click(screen.getByTestId("dialog-action-Cancel"));

      expect(closeDialog).toHaveBeenCalledWith("one", "Cancel", { name: undefined });

      await settleTransitions();
    });

    it("answers the default action when Enter is pressed in the input", async () => {
      renderLayer([withInput("Start")]);

      await userEvent.type(screen.getByTestId("dialog-input-name"), "{Enter}");

      expect(closeDialog).toHaveBeenCalledWith("one", "Delete", { name: "Start" });

      await settleTransitions();
    });

    it("shows a dialog that is only an input", async () => {
      renderLayer([
        dialogWith("one", { input: [{ id: "password", label: "Password", type: "password" }] }),
      ]);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByTestId("dialog-input-password")).toHaveAttribute("type", "password");

      await settleTransitions();
    });

    it("leaves a multiline input to the legacy renderer", () => {
      renderLayer([
        dialogWith("one", { text: "t", input: [{ id: "a", label: "A", type: "multiline" }] }),
      ]);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("links", () => {
    it("runs the link's callback without answering the dialog", async () => {
      renderLayer([
        dialogWith("one", { text: "t", links: [{ label: "Open" }, { label: "Open elsewhere" }] }),
      ]);

      await userEvent.click(screen.getByTestId("dialog-link-1"));

      expect(triggerDialogLink).toHaveBeenCalledExactlyOnceWith("one", 1);
      expect(closeDialog).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      await settleTransitions();
    });
  });
  describe("message", () => {
    it("shows the message in a read-only box, joining the parts of a line with a space", async () => {
      renderLayer([dialogWith("one", { text: "Failed", message: "first\tpart\nsecond line" })]);

      expect(screen.getByTestId("dialog-message")).toHaveValue("first part\nsecond line");

      await settleTransitions();
    });

    it("keeps the message behind a toggle when the dialog asks to hide it", async () => {
      renderLayer([
        dialogWith("one", { text: "Failed", message: "details", options: { hideMessage: true } }),
      ]);

      expect(screen.queryByTestId("dialog-message")).not.toBeInTheDocument();

      await userEvent.click(screen.getByTestId("dialog-message-toggle"));

      expect(screen.getByTestId("dialog-message")).toHaveValue("details");

      await settleTransitions();
    });

    it("uses the medium modal even when the text is short", async () => {
      renderLayer([dialogWith("one", { text: "Short.", message: "details" })]);

      expect(screen.getByRole("dialog")).toHaveClass("nxm-modal-md");

      await settleTransitions();
    });

    it("shows a dialog that is only a message", async () => {
      renderLayer([dialogWith("one", { message: "details" })]);

      expect(screen.getByTestId("dialog-message")).toHaveValue("details");

      await settleTransitions();
    });
  });
});
