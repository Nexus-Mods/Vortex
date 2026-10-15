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

  it.each<[string, IDialogContent["options"]]>([
    ["order", { order: ["checkboxes", "text"] }],
    ["bbcodeContext", { bbcodeContext: {} as never }],
  ])("rejects the %s option, which ModalLayer does not follow", (_name, options) => {
    expect(canRenderWithModal(dialogWith({ text: "t", options }))).toBe(false);
  });

  it("rejects a field it has never heard of", () => {
    const content = { text: "t", somethingNew: true } as IDialogContent;

    expect(canRenderWithModal(dialogWith(content))).toBe(false);
  });

  it("rejects a dialog without text", () => {
    expect(canRenderWithModal(dialogWith({}))).toBe(false);
  });

  it.each<[string, IDialogContent]>([
    ["bbcode", { text: "t", bbcode: "[b]b[/b]" }],
    ["md", { text: "t", md: "# h" }],
    ["htmlText", { text: "t", htmlText: "<b>b</b>" }],
    ["htmlFile", { text: "t", htmlFile: "f.html" }],
    ["choices", { text: "t", choices: [{ id: "a", value: true }] }],
  ])("rejects a dialog with %s", (_name, content) => {
    expect(canRenderWithModal(dialogWith(content))).toBe(false);
  });

  it("accepts plain checkboxes", () => {
    expect(
      canRenderWithModal(
        dialogWith({ text: "t", checkboxes: [{ id: "remember", value: false, text: "Remember" }] }),
      ),
    ).toBe(true);
  });

  it.each<[string, ICheckbox]>([
    ["no text", { id: "a", value: false }],
    ["bbcode", { id: "a", value: false, text: "t", bbcode: "[b]b[/b]" }],
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

    it.each<[string, IInput]>([
      ["no label", { id: "a" }],
      ["a multiline type", { id: "a", label: "A", type: "multiline" }],
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

  it.each([1, 2, 3])("accepts %i actions", (count) => {
    const actions = Array.from({ length: count }, (_v, i) => `Action ${i}`);
    expect(canRenderWithModal(dialogWith({ text: "t" }, actions))).toBe(true);
  });

  it.each([0, 4])("rejects %i actions", (count) => {
    const actions = Array.from({ length: count }, (_v, i) => `Action ${i}`);
    expect(canRenderWithModal(dialogWith({ text: "t" }, actions))).toBe(false);
  });
});
