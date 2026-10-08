import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { Button } from "@/ui/components/button/Button";
import { CheckboxField } from "@/ui/components/form/checkbox_field/CheckboxField";
import { Modal } from "@/ui/components/modal/Modal";
import { Typography } from "@/ui/components/typography/Typography";

import { closeDialog, closeDialogs } from "../../actions/notifications";
import type { ICheckbox, IDialog } from "../../types/IDialog";
import type { IState } from "../../types/IState";
import { canRenderWithModal } from "../can_render_with_modal/canRenderWithModal";
import { rememberedDialogIds } from "../remembered_dialog_ids/rememberedDialogIds";

// Dialogs are answered one at a time, oldest first, the same as the legacy renderer.
const allDialogs = (state: IState): IDialog[] => state.session.notifications.dialogs;

// Escape and backdrop clicks don't answer a legacy dialog, so there is nothing for them to do
// here either: closing without an action would leave the caller's promise pending forever.
const ignoreClose = () => undefined;

// What the user has changed in the dialog on screen. Tagged with the dialog's id so a new dialog
// starts from its own checkbox values without anything having to reset this.
interface IEdits {
  dialogId: string;
  checked: Record<string, boolean>;
}

export const ModalLayer = () => {
  const { t } = useTranslation(["common"]);
  const dispatch = useDispatch();
  const dialogs = useSelector(allDialogs);
  const [edits, setEdits] = useState<IEdits>();
  const defaultButtonRef = useRef<HTMLButtonElement>(null);

  const dialog = dialogs[0];

  if (dialog === undefined || !canRenderWithModal(dialog)) {
    return null;
  }

  const { actions, content, defaultAction, id, title } = dialog;
  const { count } = content.parameters ?? {};
  const checkboxes = content.checkboxes ?? [];
  const editedChecked = edits?.dialogId === id ? edits.checked : {};

  const isChecked = (checkbox: ICheckbox) => editedChecked[checkbox.id] ?? checkbox.value;

  const translate = (text: string) => t(text, { replace: content.parameters, count });

  const answer = (action: string) => {
    // `{}` is what the legacy renderer hands back when the dialog has no controls.
    const input = Object.fromEntries(checkboxes.map((box) => [box.id, isChecked(box)]));

    dispatch(
      input.remember === true && dialogs.length > 1
        ? closeDialogs(rememberedDialogIds(dialogs, dialog), action, input)
        : closeDialog(id, action, input),
    );
  };

  return (
    <Modal
      initialFocusRef={defaultButtonRef}
      isOpen
      key={id}
      showCloseButton={false}
      size="md"
      title={translate(title)}
      onClose={ignoreClose}
    >
      <Typography appearance="subdued" className="whitespace-pre-wrap" typographyType="body-sm">
        {/* `translated` means the caller already translated the text, so only interpolate. */}
        {t(content.text, {
          replace: content.parameters,
          count,
          ...(content.options?.translated && { lngs: [] }),
        })}
      </Typography>

      {checkboxes.length > 0 && (
        <div className="mt-3 flex flex-col gap-y-2">
          {checkboxes.map((checkbox) => (
            <CheckboxField
              checked={isChecked(checkbox)}
              data-testid={`dialog-checkbox-${checkbox.id}`}
              disabled={checkbox.disabled}
              key={checkbox.id}
              label={
                content.options?.translated === false ? checkbox.text : translate(checkbox.text)
              }
              onChange={(checked) =>
                setEdits({ dialogId: id, checked: { ...editedChecked, [checkbox.id]: checked } })
              }
            />
          ))}
        </div>
      )}

      <div className="mt-4 flex gap-x-2">
        {actions.map((action) => {
          const isDefault = action === defaultAction;

          return (
            <Button
              className="flex-1"
              data-testid={`dialog-action-${action}`}
              key={action}
              ref={isDefault ? defaultButtonRef : undefined}
              {...(!isDefault && { appearance: "moderate", brand: "neutral" })}
              onClick={() => answer(action)}
            >
              {t(action)}
            </Button>
          );
        })}
      </div>
    </Modal>
  );
};
