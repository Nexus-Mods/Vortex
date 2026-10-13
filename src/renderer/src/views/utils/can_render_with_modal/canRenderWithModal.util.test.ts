import { describe, expect, it } from "vitest";

import type { ICheckbox, IDialog, IDialogContent, IInput, ILink } from "@/types/IDialog";

import { canRenderWithModal } from "./canRenderWithModal.util";

const dialogWith = (
  content: IDialogContent,
  actions: string[] = ["Cancel", "Continue"],
): IDialog => ({
  id: "dialog",
  type: "question",
  title: "Title",
  content,
  defaultAction: "Continue",
  actions,
});

describe("canRenderWithModal", () => {
  it("accepts a plain text dialog", () => {
    expect(canRenderWithModal(dialogWith({ text: "Are you sure?" }))).toBe(true);
  });

  it("accepts parameters and the options that only affect how the text is read", () => {
    expect(
      canRenderWithModal(
        dialogWith({
          text: "{{name}}",
          parameters: { name: "x" },
          options: { translated: true, wrap: true },
        }),
      ),
    ).toBe(true);
  });

  it("ignores a field that is present but undefined", () => {
    expect(canRenderWithModal(dialogWith({ text: "t", bbcode: undefined }))).toBe(true);
  });

  it("accepts html text, with or without other text", () => {
    expect(canRenderWithModal(dialogWith({ htmlText: "<b>b</b>" }))).toBe(true);
    expect(canRenderWithModal(dialogWith({ text: "t", htmlText: "<b>b</b>" }))).toBe(true);
  });

  it("accepts the order option, which ModalLayer follows", () => {
    expect(
      canRenderWithModal(dialogWith({ text: "t", options: { order: ["checkboxes", "text"] } })),
    ).toBe(true);
  });

  it("rejects a field it has never heard of", () => {
    const content = { text: "t", somethingNew: true } as IDialogContent;

    expect(canRenderWithModal(dialogWith(content))).toBe(false);
  });

  it("rejects a dialog without text", () => {
    expect(canRenderWithModal(dialogWith({}))).toBe(false);
  });

  it.each<[string, IDialogContent]>([["htmlFile", { text: "t", htmlFile: "f.html" }]])(
    "rejects a dialog with %s",
    (_name, content) => {
      expect(canRenderWithModal(dialogWith(content))).toBe(false);
    },
  );

  describe("choices", () => {
    it("accepts radio choices, with or without a hint, and with or without text", () => {
      const choices = [
        { id: "a", value: true, text: "A", subText: "More about A" },
        { id: "b", value: false, text: "B" },
      ];

      expect(canRenderWithModal(dialogWith({ text: "t", choices }))).toBe(true);
      expect(canRenderWithModal(dialogWith({ choices }))).toBe(true);
    });

    it.each<[string, ICheckbox]>([
      ["no text", { id: "a", value: false }],
      ["bbcode", { id: "a", value: false, text: "t", bbcode: "[b]b[/b]" }],
      [
        "a field it has never heard of",
        { id: "a", value: false, text: "t", extra: 1 } as ICheckbox,
      ],
    ])("rejects a choice with %s", (_name, choice) => {
      expect(canRenderWithModal(dialogWith({ text: "t", choices: [choice] }))).toBe(false);
    });
  });

  it("accepts plain checkboxes", () => {
    expect(
      canRenderWithModal(
        dialogWith({ text: "t", checkboxes: [{ id: "remember", value: false, text: "Remember" }] }),
      ),
    ).toBe(true);
  });

  it("accepts a checkbox named by its bbcode", () => {
    expect(
      canRenderWithModal(
        dialogWith({ text: "t", checkboxes: [{ id: "a", value: false, bbcode: "[b]Agree[/b]" }] }),
      ),
    ).toBe(true);
  });

  it.each<[string, ICheckbox]>([
    ["no text and no bbcode", { id: "a", value: false }],
    ["a sub-line", { id: "a", value: false, text: "t", subText: "more" }],
    ["a field it has never heard of", { id: "a", value: false, text: "t", extra: 1 } as ICheckbox],
  ])("rejects a checkbox with %s", (_name, checkbox) => {
    expect(canRenderWithModal(dialogWith({ text: "t", checkboxes: [checkbox] }))).toBe(false);
  });

  describe("condition", () => {
    it("accepts a condition, which ModalLayer checks as the user types", () => {
      expect(
        canRenderWithModal(
          dialogWith({ text: "t", input: [{ id: "a", label: "A" }], condition: () => [] }),
        ),
      ).toBe(true);
    });
  });

  describe("bbcode and markdown", () => {
    it("accepts a bbcode or markdown body, with or without text", () => {
      expect(canRenderWithModal(dialogWith({ text: "t", bbcode: "[b]b[/b]" }))).toBe(true);
      expect(canRenderWithModal(dialogWith({ bbcode: "[b]b[/b]" }))).toBe(true);
      expect(canRenderWithModal(dialogWith({ md: "# Heading" }))).toBe(true);
    });

    it("accepts the context bbcode tags are drawn in", () => {
      expect(
        canRenderWithModal(
          dialogWith({ bbcode: "[b]b[/b]", options: { bbcodeContext: {} as never } }),
        ),
      ).toBe(true);
    });
  });

  describe("message", () => {
    it("accepts a message, with or without text, and the options that shape its box", () => {
      expect(canRenderWithModal(dialogWith({ text: "t", message: "m" }))).toBe(true);
      expect(canRenderWithModal(dialogWith({ message: "m" }))).toBe(true);
      expect(
        canRenderWithModal(
          dialogWith({ text: "t", message: "m", options: { wrap: true, hideMessage: true } }),
        ),
      ).toBe(true);
    });
  });

  describe("inputs", () => {
    it("accepts a labelled input, with or without text", () => {
      const input = [{ id: "name", label: "Name", type: "password" as const }];

      expect(canRenderWithModal(dialogWith({ text: "t", input }))).toBe(true);
      expect(canRenderWithModal(dialogWith({ input }))).toBe(true);
    });

    it("accepts an input without a label, which the dialog's title names", () => {
      expect(
        canRenderWithModal(dialogWith({ text: "t", input: [{ id: "url", type: "url" }] })),
      ).toBe(true);
    });

    it("accepts a multiline input", () => {
      expect(
        canRenderWithModal(
          dialogWith({ text: "t", input: [{ id: "a", label: "A", type: "multiline" }] }),
        ),
      ).toBe(true);
    });

    it.each<[string, IInput]>([
      ["a field it has never heard of", { id: "a", label: "A", extra: 1 } as IInput],
    ])("rejects an input with %s", (_name, input) => {
      expect(canRenderWithModal(dialogWith({ text: "t", input: [input] }))).toBe(false);
    });
  });

  describe("links", () => {
    it("accepts links with a label and an action", () => {
      expect(
        canRenderWithModal(
          dialogWith({
            text: "t",
            links: [{ label: "Open", id: "open", action: () => undefined }],
          }),
        ),
      ).toBe(true);
    });

    it.each<[string, ILink]>([
      ["no label", {} as ILink],
      ["a field it has never heard of", { label: "More", extra: 1 } as ILink],
    ])("rejects a link with %s", (_name, link) => {
      expect(canRenderWithModal(dialogWith({ text: "t", links: [link] }))).toBe(false);
    });

    it("accepts links shown as buttons", () => {
      expect(
        canRenderWithModal(
          dialogWith({ text: "t", links: [{ label: "Open" }], options: { linksAsButtons: true } }),
        ),
      ).toBe(true);
    });
  });

  it.each([1, 2, 3, 4, 6])("accepts %i actions", (count) => {
    const actions = Array.from({ length: count }, (_v, i) => `Action ${i}`);
    expect(canRenderWithModal(dialogWith({ text: "t" }, actions))).toBe(true);
  });

  it("rejects a dialog with no actions", () => {
    expect(canRenderWithModal(dialogWith({ text: "t" }, []))).toBe(false);
  });
});
