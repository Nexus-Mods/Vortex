import React, { type ReactNode, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { closeDialog, closeDialogs, triggerDialogLink } from "@/actions/notifications";
import { renderSafeBBCode } from "@/controls/bbcode";
import type {
  DialogContentItem,
  ICheckbox,
  IDialog,
  IDialogContent,
  IInput,
} from "@/types/IDialog";
import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { CheckboxField } from "@/ui/components/form/checkbox_field/CheckboxField";
import { RadioGroupField } from "@/ui/components/form/radio_group_field/RadioGroupField";
import { TextAreaField } from "@/ui/components/form/text_area_field/TextAreaField";
import { TextField } from "@/ui/components/form/text_field/TextField";
import { MessageBox } from "@/ui/components/message_box/MessageBox";
import { Modal } from "@/ui/components/modal/Modal";
import { BBCode } from "@/ui/components/prose/bbcode/BBCode";
import { Html } from "@/ui/components/prose/html/Html";
import { Markdown } from "@/ui/components/prose/markdown/Markdown";
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

// A short message reads better in the small modal. Longer ones keep the medium size, and so does a
// dialog that needs room: a bbcode, markdown, HTML, message, choices or text area body, or more
// than three buttons, which then fit on one row as they did in the legacy dialog.
const SMALL_MAX_TEXT_LENGTH = 200;
const MAX_BUTTONS_IN_SMALL = 3;

// bbcode is raw text, not a translation key, and i18next would split it on its key separators. So
// the parameters are put in by hand, as in the legacy renderer.
const fillParameters = (text: string, parameters: IDialogContent["parameters"] = {}) =>
  Object.entries(parameters).reduce(
    (filled, [name, value]) => filled.split(`{{${name}}}`).join(String(value)),
    text,
  );

// A part of the dialog's body, named the way the dialog's `order` option names it.
interface ISection {
  id: DialogContentItem;
  node: ReactNode;
}

// The parts come in the order they are listed in. A dialog's `order` option moves the ones it names
// to the end, in the order it gives them, as in the legacy renderer.
const orderedSections = (sections: ISection[], order: DialogContentItem[] | undefined) => {
  if (order === undefined) {
    return sections;
  }

  const rank = (section: ISection) =>
    order.includes(section.id)
      ? sections.length + order.indexOf(section.id)
      : sections.indexOf(section);

  return [...sections].sort((lhs, rhs) => rank(lhs) - rank(rhs));
};

// A long list of checkboxes gets "Enable all" and "Disable all" above it, as in the legacy dialog.
const MAX_CHECKBOXES_WITHOUT_BULK = 3;

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
  // The first field, whichever kind it is: an input or a text area.
  const firstInputRef = useRef<HTMLElement>(null);
  const rememberFirstInput = (element: HTMLElement | null) => {
    firstInputRef.current = element;
  };

  const dialog = dialogs[0];

  if (dialog === undefined || !canRenderWithModal(dialog)) {
    return null;
  }

  const { actions, content, defaultAction, id, title } = dialog;
  const { count } = content.parameters ?? {};
  const checkboxes = content.checkboxes ?? [];
  const choices = content.choices ?? [];
  const inputs = content.input ?? [];
  const links = content.links ?? [];
  const editedChecked = edits?.dialogId === id ? edits.checked : {};
  const editedTyped = edits?.dialogId === id ? edits.typed : {};

  const isChecked = (checkbox: ICheckbox) => editedChecked[checkbox.id] ?? checkbox.value;
  const chosenId = choices.find(isChecked)?.id;
  const valueOf = (input: IInput) => editedTyped[input.id] ?? input.value;

  const translate = (text: string) => t(text, { replace: content.parameters, count });

  // A checkbox's bbcode, when it has any, is its label. `translated: false` leaves it as given.
  const checkboxLabel = (checkbox: ICheckbox) => {
    const label = checkbox.bbcode ?? checkbox.text;
    const shown = content.options?.translated === false ? label : translate(label);

    return checkbox.bbcode === undefined
      ? shown
      : renderSafeBBCode(shown, content.options?.bbcodeContext);
  };

  // `translated` means the caller already translated the text, so only interpolate.
  const translateBody = (key: string) =>
    t(key, {
      replace: content.parameters,
      count,
      ...(content.options?.translated && { lngs: [] }),
    });

  const text = content.text ? translateBody(content.text) : "";

  const translateMessage = (message: string) => translateMessageParts(message, translateBody);

  // The dialog's condition is checked against what the user has entered so far. It names the
  // control it is about and the buttons that can't be pressed until it is met.
  const results =
    content.condition?.({
      ...content,
      ...(content.input && { input: inputs.map((field) => ({ ...field, value: valueOf(field) })) }),
      ...(content.checkboxes && {
        checkboxes: checkboxes.map((box) => ({ ...box, value: isChecked(box) })),
      }),
      ...(content.choices && {
        choices: choices.map((choice) => ({ ...choice, value: isChecked(choice) })),
      }),
    }) ?? [];
  const errorFor = (controlId: string) =>
    results
      .filter((result) => result.id === controlId)
      .map((result) => result.errorText)
      .join("\n");
  const isDisabled = (action: string) => results.some((result) => result.actions.includes(action));

  const needsRoom =
    content.bbcode !== undefined ||
    content.md !== undefined ||
    content.htmlText !== undefined ||
    !!content.message ||
    choices.length > 0 ||
    inputs.some((input) => input.type === "multiline") ||
    actions.length > MAX_BUTTONS_IN_SMALL;

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

  // Ticks or unticks every checkbox the user can change.
  const setAllChecked = (checked: boolean) =>
    setEdits({
      dialogId: id,
      checked: {
        ...editedChecked,
        ...Object.fromEntries(
          checkboxes.filter((box) => !box.disabled).map((box) => [box.id, checked]),
        ),
      },
      typed: editedTyped,
    });

  const answer = (action: string) => {
    // `{}` is what the legacy renderer hands back when the dialog has no controls.
    const input = Object.fromEntries([
      ...inputs.map((field) => [field.id, valueOf(field)]),
      ...checkboxes.map((box) => [box.id, isChecked(box)]),
      ...choices.map((choice) => [choice.id, isChecked(choice)]),
    ]);

    dispatch(
      input.remember === true && dialogs.length > 1
        ? closeDialogs(rememberedDialogIds(dialogs, dialog), action, input)
        : closeDialog(id, action, input),
    );
  };

  // The legacy renderer answers the default action when Enter is pressed in an input. In a text
  // area Enter starts a new line.
  const answerDefaultOnEnter = (event: React.KeyboardEvent) => {
    if (
      event.key === "Enter" &&
      !(event.target instanceof HTMLTextAreaElement) &&
      defaultAction !== undefined &&
      !isDisabled(defaultAction)
    ) {
      event.preventDefault();
      answer(defaultAction);
    }
  };

  const sections: ISection[] = [];

  if (text) {
    sections.push({ id: "text", node: <PlainText size="sm" text={text} /> });
  }

  if (content.bbcode !== undefined) {
    sections.push({
      id: "bbcode",
      node: (
        <BBCode
          bbcode={fillParameters(content.bbcode, content.parameters)}
          context={content.options?.bbcodeContext}
          size="sm"
        />
      ),
    });
  }

  if (content.md !== undefined) {
    sections.push({ id: "md", node: <Markdown markdown={translateBody(content.md)} size="sm" /> });
  }

  if (content.message !== undefined) {
    sections.push({
      id: "message",
      node: (
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
      ),
    });
  }

  if (content.htmlText !== undefined) {
    sections.push({ id: "htmlText", node: <Html html={content.htmlText} size="sm" /> });
  }

  if (inputs.length > 0) {
    sections.push({
      id: "input",
      node: (
        <div className="mt-3 flex flex-col gap-y-3" onKeyDown={answerDefaultOnEnter}>
          {inputs.map((input, index) => {
            const fieldProps = {
              "data-testid": `dialog-input-${input.id}`,
              errorMessage: errorFor(input.id) || undefined,
              // The old dialog showed no label for an input without one, so the title names it.
              hideLabel: !input.label,
              label: translate(input.label || title),
              placeholder: input.placeholder,
              ref: index === 0 ? rememberFirstInput : undefined,
              value: valueOf(input) ?? "",
              onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                setEdits({
                  dialogId: id,
                  checked: editedChecked,
                  typed: { ...editedTyped, [input.id]: event.target.value },
                }),
            };

            return input.type === "multiline" ? (
              <TextAreaField key={input.id} {...fieldProps} />
            ) : (
              <TextField key={input.id} {...fieldProps} type={input.type} />
            );
          })}
        </div>
      ),
    });
  }

  if (checkboxes.length > 0) {
    sections.push({
      id: "checkboxes",
      node: (
        <div className="mt-3 flex flex-col gap-y-2">
          {checkboxes.length > MAX_CHECKBOXES_WITHOUT_BULK && (
            <div className="mb-1 flex gap-x-3">
              <TypographyLink
                data-testid="dialog-enable-all"
                typographyType="body-sm"
                onClick={() => setAllChecked(true)}
              >
                {t("Enable all")}
              </TypographyLink>

              <TypographyLink
                data-testid="dialog-disable-all"
                typographyType="body-sm"
                onClick={() => setAllChecked(false)}
              >
                {t("Disable all")}
              </TypographyLink>
            </div>
          )}

          {checkboxes.map((checkbox) => (
            <CheckboxField
              checked={isChecked(checkbox)}
              data-testid={`dialog-checkbox-${checkbox.id}`}
              disabled={checkbox.disabled}
              key={checkbox.id}
              label={checkboxLabel(checkbox)}
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
      ),
    });
  }

  if (choices.length > 0) {
    sections.push({
      id: "choices",
      node: (
        <RadioGroupField
          className="mt-3"
          label={translate(title)}
          options={choices.map((choice) => ({
            disabled: choice.disabled,
            hint: choice.subText ? translate(choice.subText) : undefined,
            label: translate(choice.text),
            testId: `dialog-choice-${choice.id}`,
            value: choice.id,
          }))}
          value={chosenId}
          // Choosing one clears the rest, as the legacy renderer does.
          onChange={(chosen) =>
            setEdits({
              dialogId: id,
              checked: {
                ...editedChecked,
                ...Object.fromEntries(choices.map((choice) => [choice.id, choice.id === chosen])),
              },
              typed: editedTyped,
            })
          }
        />
      ),
    });
  }

  if (links.length > 0) {
    sections.push({
      id: "links",
      node: (
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
      ),
    });
  }

  return (
    <Modal
      initialFocusRef={inputs.length > 0 ? firstInputRef : defaultButtonRef}
      isOpen
      key={id}
      showCloseButton={false}
      size={needsRoom || text.length > SMALL_MAX_TEXT_LENGTH ? "md" : "sm"}
      title={translate(title)}
      onClose={ignoreClose}
    >
      {orderedSections(sections, content.options?.order).map((section) => (
        <React.Fragment key={section.id}>{section.node}</React.Fragment>
      ))}

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
