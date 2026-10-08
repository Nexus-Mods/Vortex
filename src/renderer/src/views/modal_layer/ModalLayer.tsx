import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { Button } from "@/ui/components/button/Button";
import { Modal } from "@/ui/components/modal/Modal";
import { Typography } from "@/ui/components/typography/Typography";

import { closeDialog } from "../../actions/notifications";
import type { IDialog } from "../../types/IDialog";
import type { IState } from "../../types/IState";
import { canRenderWithModal } from "../can_render_with_modal/canRenderWithModal";

// Dialogs are answered one at a time, oldest first, the same as the legacy renderer.
const firstDialog = (state: IState): IDialog | undefined => state.session.notifications.dialogs[0];

// Escape and backdrop clicks don't answer a legacy dialog, so there is nothing for them to do
// here either: closing without an action would leave the caller's promise pending forever.
const ignoreClose = () => undefined;

export const ModalLayer = () => {
  const { t } = useTranslation(["common"]);
  const dispatch = useDispatch();
  const dialog = useSelector(firstDialog);
  const defaultButtonRef = useRef<HTMLButtonElement>(null);

  if (dialog === undefined || !canRenderWithModal(dialog)) {
    return null;
  }

  const { actions, content, defaultAction, id, title } = dialog;
  const { count } = content.parameters ?? {};

  // `translated` means the caller already translated the text, so only interpolate.
  const text = t(content.text, {
    replace: content.parameters,
    count,
    ...(content.options?.translated && { lngs: [] }),
  });

  return (
    <Modal
      initialFocusRef={defaultButtonRef}
      isOpen
      key={id}
      showCloseButton={false}
      size="md"
      title={t(title, { replace: content.parameters, count })}
      onClose={ignoreClose}
    >
      <Typography appearance="subdued" className="whitespace-pre-wrap" typographyType="body-sm">
        {text}
      </Typography>

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
              // `{}` is what the legacy renderer hands back when the dialog has no controls.
              onClick={() => dispatch(closeDialog(id, action, {}))}
            >
              {t(action)}
            </Button>
          );
        })}
      </div>
    </Modal>
  );
};
