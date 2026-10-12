import { describe, expect, it } from "vitest";

import type { ICheckbox, IDialog, IDialogContent } from "../../types/IDialog";
import { canRenderWithModal } from "./canRenderWithModal";

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
    ["hideMessage", { hideMessage: true }],
    ["linksAsButtons", { linksAsButtons: true }],
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
    ["message", { text: "t", message: "m" }],
    ["bbcode", { text: "t", bbcode: "[b]b[/b]" }],
    ["md", { text: "t", md: "# h" }],
    ["htmlText", { text: "t", htmlText: "<b>b</b>" }],
    ["htmlFile", { text: "t", htmlFile: "f.html" }],
    ["choices", { text: "t", choices: [{ id: "a", value: true }] }],
    ["input", { text: "t", input: [{ id: "name" }] }],
    ["links", { text: "t", links: [{ label: "More" }] }],
    ["condition", { text: "t", condition: () => [] }],
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

  it.each([1, 2, 3])("accepts %i actions", (count) => {
    const actions = Array.from({ length: count }, (_v, i) => `Action ${i}`);
    expect(canRenderWithModal(dialogWith({ text: "t" }, actions))).toBe(true);
  });

  it.each([0, 4])("rejects %i actions", (count) => {
    const actions = Array.from({ length: count }, (_v, i) => `Action ${i}`);
    expect(canRenderWithModal(dialogWith({ text: "t" }, actions))).toBe(false);
  });
});
