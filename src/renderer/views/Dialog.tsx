/* eslint-disable @eslint-react/hooks-extra/no-direct-set-state-in-use-effect */
// Disabled: This component legitimately syncs dialog state in effects when the
// dialogs array changes (tracking current dialog ID, content, and validation).

import type { ILink } from "../../actions";
import { triggerDialogLink } from "../../actions";
import type { DialogContentItem } from "../../actions/notifications";
import { closeDialog, closeDialogs } from "../../actions/notifications";
import Collapse from "../controls/Collapse";
import ErrorBoundary from "../controls/ErrorBoundary";
import Icon from "../controls/Icon";
import Webview from "../controls/Webview";
import type {
  ConditionResults,
  DialogType,
  ICheckbox,
  IConditionResult,
  IDialogContent,
  IInput,
} from "../../types/IDialog";
import type { IState } from "../../types/IState";
import bbcode from "../controls/bbcode";
import type { TFunction } from "../../util/i18n";
import lazyRequire from "../../util/lazyRequire";
import { MutexWrapper } from "../../util/MutexContext";

import type * as RemoteT from "@electron/remote";
import update from "immutability-helper";
import * as React from "react";
import {
  Button,
  Checkbox,
  ControlLabel,
  FormControl,
  FormGroup,
  Modal,
  Radio,
} from "react-bootstrap";
import ReactMarkdown from "react-markdown";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const remote = lazyRequire<typeof RemoteT>(() => require("@electron/remote"));

const nop = () => undefined;

interface IActionProps {
  onDismiss: (action: string) => void;
  action: string;
  isDefault: boolean;
  isDisabled: boolean;
}

function Action(props: IActionProps): React.JSX.Element {
  const { action, isDefault, isDisabled, onDismiss } = props;

  const { t } = useTranslation(["common"]);

  const dismiss = React.useCallback(() => {
    onDismiss(action);
  }, [onDismiss, action]);

  return (
    <Button
      id="close"
      onClick={dismiss}
      bsStyle={isDefault ? "primary" : undefined}
      autoFocus={isDefault}
      disabled={isDisabled}
    >
      {t(action)}
    </Button>
  );
}

export const Dialog: React.FC = () => {
  const { t } = useTranslation(["common"]);
  const dispatch = useDispatch();

  // Redux state
  const dialogs = useSelector(
    (state: IState) => state.session.notifications.dialogs,
  );

  // Local state
  const [currentDialogId, setCurrentDialogId] = React.useState<
    string | undefined
  >(undefined);
  const [dialogState, setDialogState] = React.useState<
    IDialogContent | undefined
  >(undefined);
  const [conditionResults, setConditionResults] =
    React.useState<ConditionResults>([]);

  // Refs for callbacks
  const stateRef = React.useRef({
    dialogs,
    currentDialogId,
    dialogState,
    conditionResults,
  });
  stateRef.current = {
    dialogs,
    currentDialogId,
    dialogState,
    conditionResults,
  };

  // Dispatch callbacks
  const onDismiss = React.useCallback(
    (id: string, action: string, input: IDialogContent) => {
      dispatch(closeDialog(id, action, input));
    },
    [dispatch],
  );

  const onDismissMultiple = React.useCallback(
    (ids: string[], action: string, input: IDialogContent) => {
      dispatch(closeDialogs(ids, action, input));
    },
    [dispatch],
  );

  // Helper functions
  const validateContent = React.useCallback(
    (content: IDialogContent): ConditionResults | undefined => {
      if (content?.condition === undefined) {
        return undefined;
      }
      return content.condition(content);
    },
    [],
  );

  const translateParts = React.useCallback(
    (message: string, tFunc: TFunction, parameters?: any) => {
      return (message || "")
        .split("\n")
        .map((line: string) =>
          line
            .split("\t")
            .map((block: string) =>
              tFunc(block, { replace: parameters, count: parameters?.count }),
            )
            .join(" "),
        )
        .join("\n");
    },
    [],
  );

  const iconForType = React.useCallback((type: DialogType) => {
    switch (type) {
      case "info":
        return <Icon name="dialog-info" className="icon-info" />;
      case "error":
        return <Icon name="dialog-error" className="icon-error" />;
      case "question":
        return <Icon name="dialog-question" className="icon-question" />;
      default:
        return null;
    }
  }, []);

  const focusMe = React.useCallback((ele: HTMLElement | null) => {
    if (ele !== null) {
      setTimeout(() => ele.focus(), 100);
    }
  }, []);

  const getValidationResult = React.useCallback(
    (input: IInput): IConditionResult[] => {
      const { conditionResults: results } = stateRef.current;
      return results.filter((res) => res.id === input.id);
    },
    [],
  );

  // Event handlers
  const changeInput = React.useCallback(
    (evt: any) => {
      const { dialogState: state } = stateRef.current;
      if (!state) return;

      const id = evt.currentTarget.id.split("-").slice(1).join("-");
      const idx = state.input.findIndex((form: IInput) => form.id === id);

      const newInput = { ...state.input[idx] };
      newInput.value = evt.currentTarget.value;

      const newDialogState = update(state, {
        input: { $splice: [[idx, 1, newInput]] },
      });

      setDialogState(newDialogState);

      const validationResults = validateContent(newDialogState);
      if (validationResults !== undefined) {
        setConditionResults(validationResults);
      }
    },
    [validateContent],
  );

  const toggleCheckbox = React.useCallback(
    (evt: React.MouseEvent<any>) => {
      const { dialogState: state } = stateRef.current;
      if (!state) return;

      const idx = state.checkboxes.findIndex((box: ICheckbox) => {
        return box.id === evt.currentTarget.id;
      });

      if (idx === -1) {
        return;
      }

      const newCheckboxes = JSON.parse(
        JSON.stringify(state.checkboxes.slice(0)),
      );
      newCheckboxes[idx].value = !newCheckboxes[idx].value;

      const newDialogState = update(state, {
        checkboxes: { $set: newCheckboxes },
      });

      setDialogState(newDialogState);

      const validationResults = validateContent(newDialogState);
      if (validationResults !== undefined) {
        setConditionResults(validationResults);
      }
    },
    [validateContent],
  );

  const enableMultiple = React.useCallback(
    (enabled: boolean = true) => {
      const { dialogState: state } = stateRef.current;
      if (!state) return;

      const newCheckboxes = JSON.parse(
        JSON.stringify(state.checkboxes.slice(0)),
      ).map((box: ICheckbox) => ({ ...box, value: enabled }));

      const newDialogState = update(state, {
        checkboxes: { $set: newCheckboxes },
      });

      setDialogState(newDialogState);

      const validationResults = validateContent(newDialogState);
      if (validationResults !== undefined) {
        setConditionResults(validationResults);
      }
    },
    [validateContent],
  );

  const enableAll = React.useCallback(() => {
    enableMultiple(true);
  }, [enableMultiple]);

  const disableAll = React.useCallback(() => {
    enableMultiple(false);
  }, [enableMultiple]);

  const toggleRadio = React.useCallback(
    (evt: React.MouseEvent<any>) => {
      const { dialogState: state } = stateRef.current;
      if (!state) return;

      const idx = state.choices.findIndex((box: ICheckbox) => {
        return box.id === evt.currentTarget.id;
      });

      if (idx < 0) {
        return;
      }

      const newChoices = state.choices.map((choice: ICheckbox) => ({
        ...choice,
        value: false,
      }));
      newChoices[idx].value = true;

      const newDialogState = update(state, {
        choices: { $set: newChoices },
      });

      setDialogState(newDialogState);

      const validationResults = validateContent(newDialogState);
      if (validationResults !== undefined) {
        setConditionResults(validationResults);
      }
    },
    [validateContent],
  );

  const triggerLink = React.useCallback((evt: React.MouseEvent<any>) => {
    evt.preventDefault();
    const { dialogs: d } = stateRef.current;
    triggerDialogLink(d[0].id, evt.currentTarget.getAttribute("data-linkidx"));
  }, []);

  const dismiss = React.useCallback(
    (action: string) => {
      const { dialogs: d, dialogState: state } = stateRef.current;

      const data: Record<string, unknown> = {};
      if (state?.checkboxes !== undefined) {
        state.checkboxes.forEach((box: ICheckbox) => {
          data[box.id] = box.value;
        });
      }

      if (state?.choices !== undefined) {
        state.choices.forEach((box: ICheckbox) => {
          data[box.id] = box.value;
        });
      }

      if (state?.input !== undefined) {
        state.input.forEach((input) => {
          data[input.id] = input.value;
        });
      }

      setCurrentDialogId(undefined);
      setDialogState(undefined);

      // If "remember" is checked, apply to all pending dialogs with the same title
      const rememberChecked = data["remember"] === true;
      if (rememberChecked && d.length > 1) {
        const currentDialog = d[0];
        const dialogActions = currentDialog.actions;
        // Find all pending dialogs with the same title (indicating same type of dialog)
        const matchingDialogIds = d
          .filter(
            (dialog) =>
              dialog.title === currentDialog.title ||
              JSON.stringify(dialogActions) === JSON.stringify(dialog.actions),
          )
          .map((dialog) => dialog.id);

        onDismissMultiple(matchingDialogIds, action, data as IDialogContent);
      } else {
        onDismiss(d[0].id, action, data as IDialogContent);
      }
    },
    [onDismiss, onDismissMultiple],
  );

  const handleKeyPress = React.useCallback(
    (evt: React.KeyboardEvent<Modal>) => {
      if (!evt.defaultPrevented) {
        const { dialogs: d, conditionResults: results } = stateRef.current;
        const dialog = d[0];
        if (evt.key === "Enter") {
          if (dialog.defaultAction !== undefined) {
            evt.preventDefault();

            const filterFunc = (res: IConditionResult) =>
              res.actions.find((act) => act === dialog.defaultAction) !==
              undefined;
            const isDisabled = results.find(filterFunc) !== undefined;
            if (!isDisabled) {
              dismiss(dialog.defaultAction);
            }
          }
        }
      }
    },
    [dismiss],
  );

  // Render helpers
  const renderInput = React.useCallback(
    (input: IInput, idx: number) => {
      const { dialogState: state } = stateRef.current;
      let valRes: IConditionResult[] | undefined;
      if (state?.condition !== undefined) {
        valRes = getValidationResult(input);
      }

      const validationState =
        valRes !== undefined
          ? valRes.length !== 0
            ? "error"
            : "success"
          : null;

      let effectiveType = input.type || "text";
      if (input.type === "multiline") {
        effectiveType = "text";
      }

      return (
        <FormGroup key={input.id} validationState={validationState}>
          {input.label ? <ControlLabel>{t(input.label)}</ControlLabel> : null}
          <FormControl
            id={`dialoginput-${input.id}`}
            componentClass={input.type === "multiline" ? "textarea" : undefined}
            type={effectiveType}
            value={input.value || ""}
            label={input.label}
            placeholder={input.placeholder}
            onChange={changeInput}
            inputRef={idx === 0 ? focusMe : undefined}
          />
          {valRes !== undefined && valRes.length !== 0 ? (
            <label className="control-label">
              {valRes.map((res) => res.errorText).join("\n")}
            </label>
          ) : null}
        </FormGroup>
      );
    },
    [t, changeInput, focusMe, getValidationResult],
  );

  const renderButton = React.useCallback(
    (link: ILink, idx: number) => {
      return (
        <div key={idx}>
          <Button onClick={triggerLink} data-linkidx={idx}>
            {link.label}
          </Button>
        </div>
      );
    },
    [triggerLink],
  );

  const renderLink = React.useCallback(
    (link: ILink, idx: number) => {
      return (
        <div key={idx}>
          <a onClick={triggerLink} data-linkidx={idx}>
            {link.label}
          </a>
        </div>
      );
    },
    [triggerLink],
  );

  const renderCheckbox = React.useCallback(
    (checkbox: ICheckbox, content: IDialogContent) => {
      const translated = content.options?.translated !== false;
      const text =
        checkbox.bbcode !== undefined
          ? bbcode(
              translated
                ? t(checkbox.bbcode, {
                    replace: content.parameters,
                    count: content.parameters?.count,
                  })
                : checkbox.bbcode,
              content.options?.bbcodeContext,
            )
          : translated
            ? t(checkbox.text, {
                replace: content.parameters,
                count: content.parameters?.count,
              })
            : checkbox.text;
      return (
        <Checkbox
          id={checkbox.id}
          key={checkbox.id}
          checked={checkbox.value}
          onChange={toggleCheckbox}
          disabled={checkbox.disabled}
        >
          {text}
        </Checkbox>
      );
    },
    [t, toggleCheckbox],
  );

  const renderRadiobutton = React.useCallback(
    (checkbox: ICheckbox) => {
      const content = (
        <div>
          {checkbox.subText !== undefined ? (
            <>
              <div className="choice-maintext">{t(checkbox.text)}</div>
              <div className="choice-subtext">{t(checkbox.subText)}</div>
            </>
          ) : (
            <div className="choice-text">{t(checkbox.text)}</div>
          )}
        </div>
      );

      return (
        <Radio
          id={checkbox.id}
          key={checkbox.id}
          name="dialog-radio"
          checked={checkbox.value}
          onChange={toggleRadio}
          disabled={checkbox.disabled}
        >
          {content}
        </Radio>
      );
    },
    [t, toggleRadio],
  );

  const renderContent = React.useCallback(
    (content: IDialogContent): JSX.Element => {
      let tFunc = t;
      if (content.options?.translated) {
        // bit of a hack, setting lngs to empty list so that no translation happens,
        // but we still make use of the i18next interpolator
        tFunc = (input: string, options?: any) =>
          t(input, { ...options, lngs: [] });
      }

      const controls: Array<{ id: DialogContentItem; control: JSX.Element }> =
        [];

      if (content.text) {
        controls.push({
          id: "text",
          control: (
            <div key="dialog-content-text" className="dialog-content-text">
              {tFunc(content.text, {
                replace: content.parameters,
                count: content.parameters?.count,
              })}
            </div>
          ),
        });
      }

      if (content.bbcode !== undefined) {
        // BBCode content is always raw text, not translation keys
        // Bypass i18next entirely to avoid key separator parsing
        let bbcodeContent = content.bbcode;

        // Manual parameter interpolation
        if (content.parameters) {
          Object.keys(content.parameters).forEach((key) => {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
            bbcodeContent = bbcodeContent.replace(
              regex,
              String(content.parameters[key]),
            );
          });
        }

        controls.push({
          id: "bbcode",
          control: (
            <div key="dialog-content-bbcode" className="dialog-content-bbcode">
              {bbcode(bbcodeContent, content.options?.bbcodeContext)}
            </div>
          ),
        });
      }

      if (content.md !== undefined) {
        controls.push({
          id: "md",
          control: (
            <div
              key="dialog-content-markdown"
              className="dialog-content-markdown"
            >
              <ReactMarkdown>
                {tFunc(content.md, {
                  replace: content.parameters,
                  count: content.parameters?.count,
                })}
              </ReactMarkdown>
            </div>
          ),
        });
      }

      if (content.message !== undefined) {
        const wrap =
          content.options !== undefined && content.options.wrap === true
            ? "on"
            : "off";
        const ctrl = (
          <textarea
            key="dialog-content-message"
            wrap={wrap}
            value={translateParts(content.message, tFunc, content.parameters)}
            readOnly={true}
          />
        );
        if (
          content.options !== undefined &&
          content.options.hideMessage === true
        ) {
          controls.push({
            id: "message",
            control: (
              <Collapse
                key="dialog-content-message-wrapper"
                showText={t("Show Details")}
                hideText={t("Hide Details")}
              >
                {ctrl}
              </Collapse>
            ),
          });
        } else {
          controls.push({ id: "message", control: ctrl });
        }
      }

      if (content.htmlFile !== undefined) {
        controls.push({
          id: "htmlFile",
          control: (
            <div key="dialog-content-html-file">
              <Webview src={`file://${content.htmlFile}`} />
            </div>
          ),
        });
      }

      if (content.htmlText !== undefined) {
        controls.push({
          id: "htmlText",
          control: (
            <div
              key="dialog-content-html-text"
              className="dialog-content-html"
              dangerouslySetInnerHTML={{ __html: content.htmlText }}
            />
          ),
        });
      }

      if (content.input !== undefined) {
        controls.push({
          id: "input",
          control: (
            <div key="dialog-form-content" className="dialog-content-input">
              {content.input.map(renderInput)}
            </div>
          ),
        });
      }

      if (content.checkboxes !== undefined) {
        controls.push({
          id: "checkboxes",
          control: (
            <div
              key="dialog-content-checkboxes"
              className="dialog-content-choices"
            >
              {content.checkboxes.length > 3 ? (
                <div className="dialog-apply-all-btns">
                  <a onClick={enableAll}>{t("Enable all")}</a>
                  &nbsp;
                  <a onClick={disableAll}>{t("Disable all")}</a>
                </div>
              ) : null}
              <div>
                {content.checkboxes.map((checkbox) =>
                  renderCheckbox(checkbox, content),
                )}
              </div>
            </div>
          ),
        });
      }

      if (content.choices !== undefined) {
        controls.push({
          id: "choices",
          control: (
            <div
              key="dialog-content-choices"
              className="dialog-content-choices"
            >
              <div>{content.choices.map(renderRadiobutton)}</div>
            </div>
          ),
        });
      }

      if (content.links !== undefined) {
        controls.push({
          id: "links",
          control: (
            <div key="dialog-form-links">
              {content.links.map(
                content.options?.linksAsButtons ? renderButton : renderLink,
              )}
            </div>
          ),
        });
      }

      if (content.options?.order !== undefined) {
        const { order } = content.options;
        controls.sort((lhs, rhs) => {
          const lIdx = order.includes(lhs.id)
            ? 100 + order.indexOf(lhs.id)
            : controls.indexOf(lhs);
          const rIdx = order.includes(rhs.id)
            ? 100 + order.indexOf(rhs.id)
            : controls.indexOf(rhs);
          return lIdx - rIdx;
        });
      }

      return (
        <div className="dialog-container">
          {controls.map((iter) => iter.control)}
        </div>
      );
    },
    [
      t,
      translateParts,
      renderInput,
      renderCheckbox,
      renderRadiobutton,
      renderButton,
      renderLink,
      enableAll,
      disableAll,
    ],
  );

  const renderAction = React.useCallback(
    (action: string, isDefault: boolean): JSX.Element => {
      const { conditionResults: results } = stateRef.current;
      const isDisabled =
        results.find(
          (res) => res.actions.find((act) => act === action) !== undefined,
        ) !== undefined;
      return (
        <Action
          key={action}
          action={action}
          isDefault={isDefault}
          onDismiss={dismiss}
          isDisabled={isDisabled}
        />
      );
    },
    [dismiss],
  );

  // Previous dialogs ref for comparison
  const prevDialogsRef = React.useRef(dialogs);

  // Handle dialogs changes (replaces componentWillReceiveProps and componentDidMount)
  React.useEffect(() => {
    if (dialogs.length > 0) {
      const prevDialogs = prevDialogsRef.current;
      const prevCurrentId = stateRef.current.currentDialogId;

      if (dialogs[0].id !== prevCurrentId) {
        // dialog changed
        const newDialogState = dialogs[0].content;
        setCurrentDialogId(dialogs[0].id);
        setDialogState(newDialogState);

        const validationResults = validateContent(newDialogState);
        if (validationResults !== undefined) {
          setConditionResults(validationResults);
        }

        const window = remote.getCurrentWindow();
        if (window.isMinimized()) {
          window.restore();
        }
        window.setAlwaysOnTop(true);
        window.show();
        window.setAlwaysOnTop(false);
      } else if (prevDialogs[0]?.content !== dialogs[0]?.content) {
        // same dialog id but maybe the content changed?
        const newDialogState = dialogs[0].content;
        setDialogState(newDialogState);

        const validationResults = validateContent(newDialogState);
        if (validationResults !== undefined) {
          setConditionResults(validationResults);
        }
      }
    }

    prevDialogsRef.current = dialogs;
  }, [dialogs, validateContent]);

  // Render
  const dialog = dialogs.length > 0 ? dialogs[0] : undefined;

  if (dialog === undefined || dialogState === undefined) {
    return null;
  }

  const type =
    dialog.content.htmlFile !== undefined ||
    dialog.content.htmlText !== undefined
      ? "wide"
      : "regular";

  return (
    <MutexWrapper show={dialog !== undefined}>
      <Modal
        id={dialog.id}
        className={`common-dialog-${type}`}
        show={dialog !== undefined}
        onHide={nop}
        onKeyPress={handleKeyPress}
      >
        <Modal.Header>
          <Modal.Title>
            {iconForType(dialog.type)}{" "}
            {t(dialog.title, {
              replace: dialog.content.parameters,
              count: dialog.content.parameters?.count,
            })}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <ErrorBoundary visible={true}>
            {renderContent(dialogState)}
          </ErrorBoundary>
        </Modal.Body>
        <Modal.Footer>
          {dialog.actions.map((action) =>
            renderAction(action, action === dialog.defaultAction),
          )}
        </Modal.Footer>
      </Modal>
    </MutexWrapper>
  );
};

export default Dialog;
