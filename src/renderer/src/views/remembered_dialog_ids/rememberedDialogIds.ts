import type { IDialog } from "../../types/IDialog";

/**
 * The queued dialogs that a ticked "remember" answers along with `current`: the same title, or
 * the same actions. This is the legacy renderer's rule, kept as it is so both behave the same.
 */
export const rememberedDialogIds = (dialogs: IDialog[], current: IDialog): string[] => {
  const currentActions = JSON.stringify(current.actions);

  return dialogs
    .filter(
      (dialog) =>
        dialog.title === current.title || JSON.stringify(dialog.actions) === currentActions,
    )
    .map((dialog) => dialog.id);
};
