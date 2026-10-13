import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { toast } from "react-hot-toast";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { closeDialog, closeDialogs, triggerDialogLink } from "@/actions/notifications";
import { settleTransitions } from "@/test-utils/transitions";
import type { IDialog, IDialogContent } from "@/types/IDialog";
import type { IState } from "@/types/IState";

import { ModalLayer } from "./ModalLayer";

vi.mock("react-hot-toast", () => ({ toast: { success: vi.fn() } }));

vi.mock("@/actions/notifications", () => ({
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
      dialogWith("legacy", { text: "t", htmlText: "<b>b</b>" }),
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

    it("draws a checkbox's bbcode as its label", async () => {
      renderLayer([
        dialogWith("one", {
          text: "t",
          checkboxes: [{ id: "agree", value: false, bbcode: "I [b]agree[/b]" }],
        }),
      ]);

      const labelId = screen.getByTestId("dialog-checkbox-agree").getAttribute("aria-labelledby");
      const label = document.getElementById(labelId ?? "");

      expect(label).toHaveTextContent("I agree");
      expect(label?.querySelector("b, strong")).toHaveTextContent("agree");

      await settleTransitions();
    });
  });
  describe("size", () => {
    it("uses the small modal for a short message", async () => {
      renderLayer([dialogWith("one", { text: "Remove it?" })]);

      expect(screen.getByRole("dialog")).toHaveClass("nxm-modal-sm");

      await settleTransitions();
    });

    it("uses the medium modal for a longer message", async () => {
      renderLayer([dialogWith("one", { text: "x".repeat(201) })]);

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

  describe("links as buttons", () => {
    it("shows the links as buttons that run their callback without answering", async () => {
      renderLayer([
        dialogWith("one", {
          text: "t",
          links: [{ label: "Open" }],
          options: { linksAsButtons: true },
        }),
      ]);

      expect(screen.getByTestId("dialog-link-0")).toHaveClass("nxm-button");

      await userEvent.click(screen.getByTestId("dialog-link-0"));

      expect(triggerDialogLink).toHaveBeenCalledExactlyOnceWith("one", 0);
      expect(closeDialog).not.toHaveBeenCalled();

      await settleTransitions();
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
  describe("copying a message", () => {
    it("says so in a toast once the message has been copied", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("api", { clipboard: { writeText } });
      renderLayer([dialogWith("one", { text: "Failed", message: "details" })]);

      await userEvent.click(screen.getByTestId("dialog-message-copy"));

      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Copied to clipboard"));
      expect(writeText).toHaveBeenCalledWith("details");

      vi.unstubAllGlobals();
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
  describe("condition", () => {
    const requireName = (content: IDialogContent) =>
      content.input?.[0]?.value
        ? []
        : [{ actions: ["Delete"], errorText: "A name is required", id: "name" }];

    const named = (): IDialog => ({
      ...dialogWith("one", {
        text: "Name it",
        input: [{ id: "name", label: "Name" }],
        condition: requireName,
      }),
      defaultAction: "Delete",
    });

    it("marks the input invalid and disables the buttons the condition names", async () => {
      renderLayer([named()]);

      expect(screen.getByTestId("dialog-input-name")).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByTestId("dialog-action-Delete")).toBeDisabled();
      expect(screen.getByTestId("dialog-action-Cancel")).toBeEnabled();

      await settleTransitions();
    });

    it("clears the error and enables the button once the condition is met", async () => {
      renderLayer([named()]);

      await userEvent.type(screen.getByTestId("dialog-input-name"), "Done");

      expect(screen.getByTestId("dialog-input-name")).not.toHaveAttribute("aria-invalid", "true");
      expect(screen.getByTestId("dialog-action-Delete")).toBeEnabled();

      await settleTransitions();
    });

    it("checks the condition against what has been typed and ticked so far", async () => {
      const condition = vi.fn(() => []);
      renderLayer([
        dialogWith("one", {
          text: "t",
          input: [{ id: "name", label: "Name", value: "Start" }],
          checkboxes: [{ id: "agree", value: false, text: "Agree" }],
          condition,
        }),
      ]);

      await userEvent.type(screen.getByTestId("dialog-input-name"), "!");
      await userEvent.click(screen.getByTestId("dialog-checkbox-agree"));

      expect(condition).toHaveBeenLastCalledWith(
        expect.objectContaining({
          input: [expect.objectContaining({ id: "name", value: "Start!" })],
          checkboxes: [expect.objectContaining({ id: "agree", value: true })],
        }),
      );

      await settleTransitions();
    });

    it("does not answer the default action on Enter while it is disabled", async () => {
      renderLayer([named()]);

      await userEvent.type(screen.getByTestId("dialog-input-name"), "{Enter}");

      expect(closeDialog).not.toHaveBeenCalled();

      await settleTransitions();
    });
  });
  describe("buttons", () => {
    const asking = (actions: string[], defaultAction?: string): IDialog => ({
      ...dialogWith("one", { text: "Hello" }),
      actions,
      defaultAction: defaultAction as string,
    });

    it("lets the buttons hug their labels instead of filling the row", async () => {
      renderLayer([asking(["Cancel", "Continue"], "Continue")]);

      for (const button of screen.getAllByRole("button")) {
        expect(button).not.toHaveClass("flex-1");
      }

      await settleTransitions();
    });

    it("shows a lone action that is not the default as the strong neutral button", async () => {
      renderLayer([asking(["Close"])]);

      expect(screen.getByTestId("dialog-action-Close")).toHaveClass(
        "nxm-button-neutral",
        "nxm-button-strong",
      );

      await settleTransitions();
    });

    it("shows a lone Close as the strong neutral button even when it is the default", async () => {
      renderLayer([asking(["Close"], "Close")]);

      expect(screen.getByTestId("dialog-action-Close")).toHaveClass(
        "nxm-button-neutral",
        "nxm-button-strong",
      );
      expect(screen.getByTestId("dialog-action-Close")).not.toHaveClass("nxm-button-primary");

      await settleTransitions();
    });

    it("keeps Close as the default button's focus, whatever its colour", async () => {
      renderLayer([asking(["Close"], "Close")]);

      await settleTransitions();

      expect(screen.getByTestId("dialog-action-Close")).toHaveFocus();
    });

    it("still shows Close as the primary button beside another action", async () => {
      renderLayer([asking(["Report", "Close"], "Close")]);

      expect(screen.getByTestId("dialog-action-Close")).toHaveClass("nxm-button-primary");
      expect(screen.getByTestId("dialog-action-Report")).toHaveClass("nxm-button-moderate");

      await settleTransitions();
    });

    it("shows a lone action that is the default as the primary button", async () => {
      renderLayer([asking(["Save"], "Save")]);

      expect(screen.getByTestId("dialog-action-Save")).toHaveClass("nxm-button-primary");

      await settleTransitions();
    });

    it("shows the other actions of a dialog as neutral alternatives", async () => {
      renderLayer([asking(["Cancel", "Continue"], "Continue")]);

      expect(screen.getByTestId("dialog-action-Cancel")).toHaveClass(
        "nxm-button-neutral",
        "nxm-button-moderate",
      );
      expect(screen.getByTestId("dialog-action-Continue")).toHaveClass("nxm-button-primary");

      await settleTransitions();
    });
  });

  describe("text", () => {
    it("draws the text as small prose, keeping its line breaks", async () => {
      renderLayer([dialogWith("one", { text: "First line\n\nSecond line" })]);

      const prose = screen.getByRole("dialog").querySelector(".nxm-prose");

      expect(prose).toHaveClass("nxm-prose-sm", "whitespace-pre-line");
      expect(prose?.textContent).toBe("First line\n\nSecond line");

      await settleTransitions();
    });
  });

  describe("bbcode and markdown", () => {
    it("draws bbcode tags", async () => {
      renderLayer([dialogWith("one", { bbcode: "A [b]bold[/b] word" })]);

      expect(screen.getByTestId("dialog-bbcode")).toHaveTextContent("A bold word");
      expect(screen.getByTestId("dialog-bbcode").querySelector("b, strong")).toHaveTextContent(
        "bold",
      );

      await settleTransitions();
    });

    it("fills in the parameters by hand, since bbcode is not a translation key", async () => {
      renderLayer([
        dialogWith("one", {
          bbcode: "Hello [b]{{name}}[/b], you have {{count}} mods",
          parameters: { name: "Ada", count: 3 },
        }),
      ]);

      expect(screen.getByTestId("dialog-bbcode")).toHaveTextContent("Hello Ada, you have 3 mods");

      await settleTransitions();
    });

    it("draws markdown", async () => {
      renderLayer([dialogWith("one", { md: "Some **strong** text" })]);

      expect(screen.getByTestId("dialog-markdown").querySelector("strong")).toHaveTextContent(
        "strong",
      );

      await settleTransitions();
    });

    it("shows the bbcode after the text", async () => {
      renderLayer([dialogWith("one", { text: "First", bbcode: "Second" })]);

      const prose = screen.getByRole("dialog").querySelector(".nxm-prose") as HTMLElement;

      expect(
        prose.compareDocumentPosition(screen.getByTestId("dialog-bbcode")) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();

      await settleTransitions();
    });

    it("uses the medium modal even when the body is short", async () => {
      renderLayer([dialogWith("one", { bbcode: "Short" })]);

      expect(screen.getByRole("dialog")).toHaveClass("nxm-modal-md");

      await settleTransitions();
    });
  });
  describe("beyond the basics", () => {
    it("names an input without a label after the dialog's title, without showing a label", async () => {
      renderLayer([dialogWith("one", { text: "t", input: [{ id: "url", type: "url" }] })]);

      expect(screen.getByRole("textbox", { name: "Title one" })).toBe(
        screen.getByTestId("dialog-input-url"),
      );

      await settleTransitions();
    });

    it("shows every button of a dialog with more than three", async () => {
      const dialog: IDialog = {
        ...dialogWith("one", { text: "Pick one" }),
        actions: ["One", "Two", "Three", "Four", "Five"],
        defaultAction: "One",
      };
      renderLayer([dialog]);

      expect(screen.getAllByRole("button")).toHaveLength(5);

      await settleTransitions();
    });

    it("uses the medium modal for more than three buttons, so they fit on one row", async () => {
      const dialog: IDialog = {
        ...dialogWith("one", { text: "Short." }),
        actions: ["One", "Two", "Three", "Four"],
        defaultAction: "One",
      };
      renderLayer([dialog]);

      expect(screen.getByRole("dialog")).toHaveClass("nxm-modal-md");

      await settleTransitions();
    });

    it("keeps the small modal for three buttons", async () => {
      const dialog: IDialog = {
        ...dialogWith("one", { text: "Short." }),
        actions: ["One", "Two", "Three"],
        defaultAction: "One",
      };
      renderLayer([dialog]);

      expect(screen.getByRole("dialog")).toHaveClass("nxm-modal-sm");

      await settleTransitions();
    });
  });
});
