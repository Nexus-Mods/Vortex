import type { ICheckbox, IDialog, IDialogContent, IInput, ILink } from "@/types/IDialog";

// What ModalLayer knows how to draw. Anything else a dialog carries, including a field this list
// has never heard of, keeps it on the legacy renderer. Add an entry as each content type gets a
// design; once ModalLayer draws everything, this file and the legacy Dialog can both go.
const SUPPORTED_CONTENT = new Set<keyof IDialogContent>([
  "text",
  "bbcode",
  "md",
  "htmlText",
  "message",
  "checkboxes",
  "choices",
  "input",
  "links",
  "condition",
  "parameters",
  "options",
]);

// The options ModalLayer follows: how the text is read, how the message box behaves, how links
// look, the context bbcode tags are drawn in, and the order the parts of the dialog come in.
const SUPPORTED_OPTIONS = new Set([
  "translated",
  "wrap",
  "hideMessage",
  "linksAsButtons",
  "bbcodeContext",
  "order",
]);

const SUPPORTED_CHECKBOX_FIELDS = new Set<keyof ICheckbox>([
  "id",
  "value",
  "text",
  "bbcode",
  "disabled",
]);

// A radio option can also carry a line of help text under its label.
const SUPPORTED_CHOICE_FIELDS = new Set<keyof ICheckbox>([
  "id",
  "value",
  "text",
  "subText",
  "disabled",
]);

const SUPPORTED_INPUT_FIELDS = new Set<keyof IInput>([
  "id",
  "type",
  "value",
  "label",
  "placeholder",
]);

// What TextField and TextAreaField can draw.
const SUPPORTED_INPUT_TYPES = new Set<IInput["type"]>([
  "text",
  "password",
  "number",
  "date",
  "time",
  "email",
  "url",
  "multiline",
]);

const SUPPORTED_LINK_FIELDS = new Set<keyof ILink>(["label", "id", "action"]);

const usesOnly = (fields: object, supported: Set<string>) =>
  Object.entries(fields).every(([name, value]) => value === undefined || supported.has(name));

// A checkbox is named by its text, or by its bbcode when it has that instead.
const isSupportedCheckbox = (checkbox: ICheckbox) =>
  (!!checkbox.text || !!checkbox.bbcode) && usesOnly(checkbox, SUPPORTED_CHECKBOX_FIELDS);

const isSupportedChoice = (choice: ICheckbox) =>
  !!choice.text && usesOnly(choice, SUPPORTED_CHOICE_FIELDS);

const isSupportedInput = (input: IInput) =>
  usesOnly(input, SUPPORTED_INPUT_FIELDS) &&
  (input.type === undefined || SUPPORTED_INPUT_TYPES.has(input.type));

const isSupportedLink = (link: ILink) => !!link.label && usesOnly(link, SUPPORTED_LINK_FIELDS);

export const canRenderWithModal = (dialog: IDialog): boolean => {
  const { actions, content } = dialog;

  return (
    // Something to show besides the buttons.
    (!!content.text ||
      !!content.bbcode ||
      !!content.md ||
      !!content.htmlText ||
      !!content.message ||
      (content.choices?.length ?? 0) > 0 ||
      (content.input?.length ?? 0) > 0) &&
    actions.length >= 1 &&
    usesOnly(content, SUPPORTED_CONTENT) &&
    usesOnly(content.options ?? {}, SUPPORTED_OPTIONS) &&
    (content.checkboxes ?? []).every(isSupportedCheckbox) &&
    (content.choices ?? []).every(isSupportedChoice) &&
    (content.input ?? []).every(isSupportedInput) &&
    (content.links ?? []).every(isSupportedLink)
  );
};
