import type { ICheckbox, IDialog, IDialogContent } from "../../types/IDialog";

// Everything the legacy renderer can show besides plain text. A dialog that uses any of these
// has no design in the new Modal yet, so it stays on the legacy renderer. Remove an entry as its
// design lands; once the list is empty this file and the legacy Dialog can both go.
const UNSUPPORTED_CONTENT: Array<keyof IDialogContent> = [
  "message",
  "bbcode",
  "md",
  "htmlText",
  "htmlFile",
  "choices",
  "input",
  "links",
  "condition",
];

// The new dialog's action row holds one to three buttons.
const MAX_ACTIONS = 3;

// A checkbox with rich text or a sub-line has no design in the new Modal yet either.
const isPlainCheckbox = (checkbox: ICheckbox) =>
  !!checkbox.text && checkbox.bbcode === undefined && checkbox.subText === undefined;

export const canRenderWithModal = (dialog: IDialog): boolean => {
  const { actions, content } = dialog;

  return (
    !!content.text &&
    actions.length >= 1 &&
    actions.length <= MAX_ACTIONS &&
    UNSUPPORTED_CONTENT.every((key) => content[key] === undefined) &&
    (content.checkboxes ?? []).every(isPlainCheckbox)
  );
};
