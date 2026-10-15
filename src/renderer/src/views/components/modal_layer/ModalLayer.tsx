import React, { useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { closeDialog, closeDialogs, triggerDialogLink } from "@/actions/notifications";
import type { ICheckbox, IDialog, IInput } from "@/types/IDialog";
import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { CheckboxField } from "@/ui/components/form/checkbox_field/CheckboxField";
import { TextField } from "@/ui/components/form/text_field/TextField";
import { MessageBox } from "@/ui/components/message_box/MessageBox";
import { Modal } from "@/ui/components/modal/Modal";
import { PlainText } from "@/ui/components/prose/plain_text/PlainText";
import { TypographyLink } from "@/ui/components/typography/TypographyLink";
import { canRenderWithModal } from "@/views/utils/can_render_with_modal/canRenderWithModal.util";
import { translateMessageParts } from "@/views/utils/translate_message_parts/translateMessageParts.util";

// One dialog at a time, and the reducer puts a new one at the front, so the newest is shown first.
// The legacy renderer does the same.
const allDialogs = (state: IState): IDialog[] => state.session.notifications.dialogs;

// The legacy renderer's rule, kept so both behave the same: a ticked "remember" also answers the
// queued dialogs with the same title or the same actions.
const rememberedDialogIds = (dialogs: IDialog[], current: IDialog): string[] => {
  const currentActions = JSON.stringify(current.actions);

  return dialogs
    .filter(
      (dialog) =>
        dialog.title === current.title || JSON.stringify(dialog.actions) === currentActions,
    )
    .map((dialog) => dialog.id);
};

// Buttons that destroy something get the danger variant. In a dialog with one, the default button
// stays neutral, so the red button is the only one that stands out. Add a label as design asks.
const DANGER_ACTIONS = new Set(["Remove"]);

// Buttons that only dismiss the dialog. Alone in a dialog, such a button is the strong neutral one
// even when it is marked the default, as an error dialog marks "Close". Add a label as design asks.
const DISMISS_ACTIONS = new Set(["Close"]);

// A short message reads better in the small modal. Longer ones keep the medium size.
const SMALL_MAX_TEXT_LENGTH = 200;

// Escape and backdrop clicks don't answer a legacy dialog, so there is nothing for them to do
// here either: closing without an action would leave the caller's promise pending forever.
const ignoreClose = () => undefined;

// What the user has changed in the dialog on screen. Tagged with the dialog's id so a new dialog
// starts from its own values without anything having to reset this.
interface IEdits {
  dialogId: string;
  checked: Record<string, boolean>;
  typed: Record<string, string>;
}

export const ModalLayer = () => {
  const { t } = useTranslation(["common"]);
  const dispatch = useDispatch();
  const dialogs = useSelector(allDialogs);
  const [edits, setEdits] = useState<IEdits>();
  const defaultButtonRef = useRef<HTMLButtonElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const dialog = dialogs[0];

  if (dialog === undefined || !canRenderWithModal(dialog)) {
    return null;
  }

  const { actions, content, defaultAction, id, title } = dialog;
  const { count } = content.parameters ?? {};
  const checkboxes = content.checkboxes ?? [];
  const inputs = content.input ?? [];
  const links = content.links ?? [];
  const editedChecked = edits?.dialogId === id ? edits.checked : {};
  const editedTyped = edits?.dialogId === id ? edits.typed : {};

  const isChecked = (checkbox: ICheckbox) => editedChecked[checkbox.id] ?? checkbox.value;
  const valueOf = (input: IInput) => editedTyped[input.id] ?? input.value;

  const translate = (text: string) => t(text, { replace: content.parameters, count });

  // `translated` means the caller already translated the text, so only interpolate.
  const text = content.text
    ? t(content.text, {
        replace: content.parameters,
        count,
        ...(content.options?.translated && { lngs: [] }),
      })
    : "";

  const translateMessage = (message: string) =>
    translateMessageParts(message, (part) =>
      t(part, {
        replace: content.parameters,
        count,
        ...(content.options?.translated && { lngs: [] }),
      }),
    );

  // The dialog's condition is checked against what the user has entered so far. It names the
  // control it is about and the buttons that can't be pressed until it is met.
  const results =
    content.condition?.({
      ...content,
      ...(content.input && { input: inputs.map((field) => ({ ...field, value: valueOf(field) })) }),
      ...(content.checkboxes && {
        checkboxes: checkboxes.map((box) => ({ ...box, value: isChecked(box) })),
      }),
    }) ?? [];
  const errorFor = (controlId: string) =>
    results
      .filter((result) => result.id === controlId)
      .map((result) => result.errorText)
      .join("\n");
  const isDisabled = (action: string) => results.some((result) => result.actions.includes(action));

  const hasDangerAction = actions.some((action) => DANGER_ACTIONS.has(action));

  // The default action is the primary one, unless the dialog has a danger button, which then stands
  // out alone. A lone action that isn't the default is a way out, like "Close", so it is the strong
  // neutral button, and so is a lone dismiss button that is the default. Anything else is a neutral
  // alternative.
  const buttonColour = (action: string) => {
    const isLone = actions.length === 1;

    if (DANGER_ACTIONS.has(action)) {
      return { brand: "danger" } as const;
    }

    if (action === defaultAction && !hasDangerAction && !(isLone && DISMISS_ACTIONS.has(action))) {
      return {};
    }

    return isLone
      ? ({ appearance: "strong", brand: "neutral" } as const)
      : ({ appearance: "moderate", brand: "neutral" } as const);
  };

  const answer = (action: string) => {
    // `{}` is what the legacy renderer hands back when the dialog has no controls.
    const input = Object.fromEntries([
      ...inputs.map((field) => [field.id, valueOf(field)]),
      ...checkboxes.map((box) => [box.id, isChecked(box)]),
    ]);

    dispatch(
      input.remember === true && dialogs.length > 1
        ? closeDialogs(rememberedDialogIds(dialogs, dialog), action, input)
        : closeDialog(id, action, input),
    );
  };

  // The legacy renderer answers the default action when Enter is pressed in an input.
  const answerDefaultOnEnter = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && defaultAction !== undefined && !isDisabled(defaultAction)) {
      event.preventDefault();
      answer(defaultAction);
    }
  };

  return (
    <Modal
      initialFocusRef={inputs.length > 0 ? firstInputRef : defaultButtonRef}
      isOpen
      key={id}
      showCloseButton={false}
      size={!content.message && text.length <= SMALL_MAX_TEXT_LENGTH ? "sm" : "md"}
      title={translate(title)}
      onClose={ignoreClose}
    >
      {!!text && <PlainText size="sm" text={text} />}

      {content.message !== undefined && (
        <div className="mt-3">
          <MessageBox
            copyLabel={t("Copy message")}
            hideLabel={t("Hide Details")}
            isCollapsible={content.options?.hideMessage === true}
            message={translateMessage(content.message)}
            onCopied={() => toast.success(t("Copied to clipboard"))}
            shouldWrap={content.options?.wrap === true}
            showLabel={t("Show Details")}
          />
        </div>
      )}

      {inputs.length > 0 && (
        <div className="mt-3 flex flex-col gap-y-3" onKeyDown={answerDefaultOnEnter}>
          {inputs.map((input, index) => (
            <TextField
              data-testid={`dialog-input-${input.id}`}
              errorMessage={errorFor(input.id) || undefined}
              key={input.id}
              label={translate(input.label)}
              placeholder={input.placeholder}
              ref={index === 0 ? firstInputRef : undefined}
              type={input.type === "multiline" ? undefined : input.type}
              value={valueOf(input) ?? ""}
              onChange={(event) =>
                setEdits({
                  dialogId: id,
                  checked: editedChecked,
                  typed: { ...editedTyped, [input.id]: event.target.value },
                })
              }
            />
          ))}
        </div>
      )}

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
                setEdits({
                  dialogId: id,
                  checked: { ...editedChecked, [checkbox.id]: checked },
                  typed: editedTyped,
                })
              }
            />
          ))}
        </div>
      )}

      {links.length > 0 && (
        <div className="mt-3 flex flex-col items-start gap-y-1">
          {links.map((link, index) =>
            // A link runs its callback and leaves the dialog open.
            content.options?.linksAsButtons ? (
              <Button
                appearance="moderate"
                brand="neutral"
                data-testid={`dialog-link-${index}`}
                key={`${index}-${link.label}`}
                size="sm"
                onClick={() => triggerDialogLink(id, index)}
              >
                {link.label}
              </Button>
            ) : (
              <TypographyLink
                data-testid={`dialog-link-${index}`}
                key={`${index}-${link.label}`}
                typographyType="body-sm"
                onClick={() => triggerDialogLink(id, index)}
              >
                {link.label}
              </TypographyLink>
            ),
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {actions.map((action) => (
          <Button
            data-testid={`dialog-action-${action}`}
            disabled={isDisabled(action)}
            key={action}
            ref={action === defaultAction ? defaultButtonRef : undefined}
            {...buttonColour(action)}
            onClick={() => answer(action)}
          >
            {t(action)}
          </Button>
        ))}
      </div>
    </Modal>
  );
};
