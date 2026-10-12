import type { ICheckbox, IDialog, IDialogContent } from "../../types/IDialog";

// What ModalLayer knows how to draw. Anything else a dialog carries, including a field this list
// has never heard of, keeps it on the legacy renderer. Add an entry as each content type gets a
// design; once ModalLayer draws everything, this file and the legacy Dialog can both go.
const SUPPORTED_CONTENT = new Set<keyof IDialogContent>([
  "text",
  "checkboxes",
  "parameters",
  "options",
]);

// The options that only change how the text is read. The rest (such as `order`) change the layout
// in ways ModalLayer doesn't follow.
const SUPPORTED_OPTIONS = new Set(["translated", "wrap"]);

const SUPPORTED_CHECKBOX_FIELDS = new Set<keyof ICheckbox>(["id", "value", "text", "disabled"]);

// The new dialog's action row holds one to three buttons.
const MAX_ACTIONS = 3;

const usesOnly = (fields: object, supported: Set<string>) =>
  Object.entries(fields).every(([name, value]) => value === undefined || supported.has(name));

const isSupportedCheckbox = (checkbox: ICheckbox) =>
  !!checkbox.text && usesOnly(checkbox, SUPPORTED_CHECKBOX_FIELDS);

export const canRenderWithModal = (dialog: IDialog): boolean => {
  const { actions, content } = dialog;

  return (
    !!content.text &&
    actions.length >= 1 &&
    actions.length <= MAX_ACTIONS &&
    usesOnly(content, SUPPORTED_CONTENT) &&
    usesOnly(content.options ?? {}, SUPPORTED_OPTIONS) &&
    (content.checkboxes ?? []).every(isSupportedCheckbox)
  );
};
