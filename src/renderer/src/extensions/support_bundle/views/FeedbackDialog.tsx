import {
  DEFAULT_LOG_WINDOW_MINUTES,
  LOG_WINDOW_MINUTES,
  MAX_FEEDBACK_TEXT_LENGTH,
  type LogWindowMinutes,
} from "@vortex/shared";
import type { IFeedbackReplayInfo, IFeedbackScreenshot } from "@vortex/shared/ipc";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { setDialogVisible } from "@/actions";
import { useExtensionContext } from "@/ExtensionProvider";
import { AppSupportBundleClickedEvent } from "@/extensions/analytics/mixpanel/MixpanelEvents";
import { hasOAuthLogin } from "@/extensions/nexus_integration/selectors";
import { Alert } from "@/ui/components/alert/Alert";
import { Button } from "@/ui/components/button/Button";
import { CheckboxField } from "@/ui/components/form/checkbox_field/CheckboxField";
import { SliderField } from "@/ui/components/form/slider_field/SliderField";
import { TextAreaField } from "@/ui/components/form/text_area_field/TextAreaField";
import { Icon } from "@/ui/components/icon/Icon";
import { Modal } from "@/ui/components/modal/Modal";
import { Typography } from "@/ui/components/typography/Typography";
import { UserCanceled } from "@/util/CustomErrors";

import { useSendFeedback, type FeedbackFailure } from "../hooks/useSendFeedback";
import { clearFeedbackDraft, saveFeedbackDraft, takeFeedbackDraft } from "../util/feedbackDraft";
import {
  reopenFeedbackDialog,
  takeFeedbackCapture,
  takeFeedbackRecording,
} from "../util/openFeedbackDialog";

export interface IFeedbackDialogProps {
  visible: boolean;
  onHide: () => void;
}

/** The failures with wording of their own; any other shows the general message. */
const FAILURE_KEYS: Partial<Record<FeedbackFailure, string>> = {
  unauthorized: "feedback::failed::unauthorized",
  rate_limited: "feedback::failed::rateLimited",
  unavailable: "feedback::failed::unavailable",
  refused: "feedback::failed::refused",
};

/** The failures that sending the same feedback again would only repeat. */
const FINAL_FAILURES: readonly FeedbackFailure[] = ["rate_limited", "refused"];

interface IChoiceProps {
  title: string;
  description: string;
  button: string;
  testId: string;
  onChoose: () => void;
}

const Choice = ({ title, description, button, testId, onChoose }: IChoiceProps) => (
  <div className="flex items-center gap-4 rounded-sm border border-stroke-weak p-4">
    <div className="min-w-0 grow">
      <Typography as="p">{title}</Typography>

      <Typography appearance="moderate" as="p" className="mt-1" typographyType="body-sm">
        {description}
      </Typography>
    </div>

    <Button
      appearance="moderate"
      brand="neutral"
      className="shrink-0"
      data-testid={testId}
      onClick={onChoose}
    >
      {button}
    </Button>
  </div>
);

/**
 * The one place feedback starts from, for a logged-in user: it first asks whether to send the
 * feedback to the team or to build a support bundle file, then takes the feedback itself.
 */
export const FeedbackDialog = ({ visible, onHide }: IFeedbackDialogProps) => {
  const { t } = useTranslation(["support_bundle", "common"]);
  const dispatch = useDispatch();
  const extensions = useExtensionContext();
  // the feedback service takes the login the site issues today, not an old API key
  const canSend = useSelector(hasOAuthLogin);
  const { state, send, edit } = useSendFeedback(visible);

  const [chosen, setChosen] = useState(false);
  const [text, setText] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [includeSupportData, setIncludeSupportData] = useState(true);
  const [logWindowMinutes, setLogWindowMinutes] = useState<LogWindowMinutes>(
    DEFAULT_LOG_WINDOW_MINUTES,
  );
  const [capture, setCapture] = useState<IFeedbackScreenshot | undefined>(undefined);
  const [includeScreenshot, setIncludeScreenshot] = useState(false);
  const [recording, setRecording] = useState<IFeedbackReplayInfo | undefined>(undefined);
  const [includeReplay, setIncludeReplay] = useState(false);

  // The form is emptied as the dialog opens, during render, so its first frame doesn't show the
  // last feedback. The draft, capture and recording are taken once, so the effect below fills
  // them in.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setChosen(false);
      setShowAdvanced(false);
      setText("");
      setIncludeSupportData(true);
      setLogWindowMinutes(DEFAULT_LOG_WINDOW_MINUTES);
      setCapture(undefined);
      setIncludeScreenshot(false);
      setRecording(undefined);
      setIncludeReplay(false);
    }
  }

  useEffect(() => {
    if (!visible) {
      return;
    }

    // what the user wrote before logging in again comes back, straight to the form
    const draft = takeFeedbackDraft();
    setChosen(draft !== undefined);
    setShowAdvanced(draft?.showAdvanced ?? false);
    setText(draft?.text ?? "");
    setIncludeSupportData(draft?.includeSupportData ?? true);
    setLogWindowMinutes(draft?.logWindowMinutes ?? DEFAULT_LOG_WINDOW_MINUTES);
    setCapture(takeFeedbackCapture());
    setIncludeScreenshot(false);
    setRecording(takeFeedbackRecording());
    setIncludeReplay(false);
  }, [visible]);

  const logInAgain = () => {
    const api = extensions.getApi();
    // the login dialog takes this one's place, so what the user wrote is kept for when it reopens
    saveFeedbackDraft({ text, showAdvanced, includeSupportData, logWindowMinutes });
    dispatch(setDialogVisible("login-dialog"));
    api.events.emit("request-nexus-login", (err: Error) => {
      if (err == null) {
        void reopenFeedbackDialog(capture, () => dispatch(setDialogVisible("feedback-dialog")));
        return;
      }
      // the dialog doesn't come back, so the next one opened for anything else starts empty
      clearFeedbackDraft();
      if (!(err instanceof UserCanceled)) {
        api.showErrorNotification?.("Login Failed", err, {
          id: "failed-get-nexus-key",
          allowReport: false,
        });
      }
    });
  };

  const createSupportBundle = () => {
    extensions
      .getApi()
      .events.emit(
        "analytics-track-mixpanel-event",
        new AppSupportBundleClickedEvent({ source: "feedback_dialog" }),
      );
    // only one dialog shows at a time, so this takes the place of the feedback dialog
    dispatch(setDialogVisible("support-bundle-dialog"));
  };

  const submit = () =>
    send({
      text: text.trim(),
      includeSupportData,
      logWindowMinutes,
      screenshot: includeScreenshot ? capture : undefined,
      includeReplay: includeReplay && recording !== undefined,
    });

  const closeButton = (
    <Button appearance="moderate" brand="neutral" data-testid="feedback-close" onClick={onHide}>
      {state.status === "sending" || state.status === "editing"
        ? t("feedback::buttons::cancel")
        : t("feedback::buttons::close")}
    </Button>
  );

  let body: React.ReactNode;
  let actions: React.ReactNode;

  if (state.status === "sent") {
    // The form is gone: what is left is the outcome, with the ID as the thing to take away.
    body = (
      <div
        className="flex flex-col items-center gap-4 py-2 text-center"
        data-testid="feedback-sent"
      >
        <Icon className="text-success-strong" name="check_circle" size="xl" />

        <Typography as="p">{t("feedback::sent")}</Typography>

        <div className="w-full rounded-sm border border-stroke-weak p-4">
          <Typography appearance="moderate" as="p" typographyType="body-sm">
            {t("feedback::quoteId")}
          </Typography>

          <Typography
            as="p"
            className="mt-2 font-mono select-text"
            data-testid="feedback-id"
            typographyType="heading-md"
          >
            {state.feedbackId}
          </Typography>

          <Button
            appearance="moderate"
            brand="neutral"
            className="mt-3"
            data-testid="feedback-copy-id"
            leftIcon="content_copy"
            size="sm"
            onClick={() => void window.api.clipboard.writeText(state.feedbackId)}
          >
            {t("feedback::buttons::copyId")}
          </Button>
        </div>

        <Typography appearance="subdued" as="p" typographyType="body-sm">
          {t("feedback::idKept")}
        </Typography>
      </div>
    );
    actions = (
      <Button brand="neutral" data-testid="feedback-close" onClick={onHide}>
        {t("feedback::buttons::close")}
      </Button>
    );
  } else if (state.status === "failed") {
    body = (
      <Alert data-testid="feedback-error" severity="danger">
        {t(FAILURE_KEYS[state.reason] ?? "feedback::failed::unknown")}
      </Alert>
    );
    actions = (
      <>
        {closeButton}

        <Button appearance="moderate" brand="neutral" data-testid="feedback-edit" onClick={edit}>
          {t("feedback::buttons::back")}
        </Button>

        {state.reason === "unauthorized" ? (
          // sending again with the same login only fails the same way
          <Button data-testid="feedback-login" onClick={logInAgain}>
            {t("feedback::choose::logIn::button")}
          </Button>
        ) : (
          !FINAL_FAILURES.includes(state.reason) && (
            <Button data-testid="feedback-retry" onClick={submit}>
              {t("feedback::buttons::tryAgain")}
            </Button>
          )
        )}
      </>
    );
  } else if (state.status === "sending") {
    body = (
      <div className="flex items-center gap-x-2" data-testid="feedback-sending">
        <Icon className="animate-spin" name="progress_activity" size="sm" />

        <Typography as="p" typographyType="body-sm">
          {state.total > 1
            ? t("feedback::sendingProgress", { sent: state.sent, total: state.total })
            : t("feedback::sending")}
        </Typography>
      </div>
    );
    actions = closeButton;
  } else if (!chosen) {
    body = (
      <div className="space-y-4" data-testid="feedback-choose">
        <Typography appearance="moderate" as="p">
          {t("feedback::choose::intro")}
        </Typography>

        {canSend ? (
          <Choice
            button={t("feedback::choose::send::button")}
            description={t("feedback::choose::send::description")}
            testId="feedback-choose-send"
            title={t("feedback::choose::send::title")}
            onChoose={() => setChosen(true)}
          />
        ) : (
          <Choice
            button={t("feedback::choose::logIn::button")}
            description={t("feedback::choose::logIn::description")}
            testId="feedback-choose-login"
            title={t("feedback::choose::send::title")}
            onChoose={logInAgain}
          />
        )}

        <Choice
          button={t("feedback::choose::bundle::button")}
          description={t("feedback::choose::bundle::description")}
          testId="feedback-choose-bundle"
          title={t("feedback::choose::bundle::title")}
          onChoose={createSupportBundle}
        />
      </div>
    );
    actions = closeButton;
  } else {
    body = (
      <div className="space-y-4">
        <Typography appearance="moderate" as="p">
          {t("feedback::intro")}
        </Typography>

        <TextAreaField
          data-testid="feedback-text"
          label={t("feedback::text::label")}
          maxLength={MAX_FEEDBACK_TEXT_LENGTH}
          required={true}
          rows={6}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />

        <CheckboxField
          checked={showAdvanced}
          data-testid="feedback-advanced"
          label={t("feedback::advanced::label")}
          onChange={setShowAdvanced}
        />

        {showAdvanced && (
          <CheckboxField
            checked={includeSupportData}
            data-testid="feedback-include-support-data"
            hints={t("feedback::supportData::hint")}
            label={t("feedback::supportData::label")}
            onChange={setIncludeSupportData}
          />
        )}

        {showAdvanced && includeSupportData && (
          <SliderField
            data-testid="feedback-log-window"
            hints={t("feedback::logWindow::hint")}
            label={t("feedback::logWindow::label")}
            max={LOG_WINDOW_MINUTES.length - 1}
            min={0}
            value={LOG_WINDOW_MINUTES.indexOf(logWindowMinutes)}
            valueText={
              logWindowMinutes < 60
                ? t("feedback::logWindow::minutes", { count: logWindowMinutes })
                : t("feedback::logWindow::hours", { count: logWindowMinutes / 60 })
            }
            onChange={(stop) =>
              setLogWindowMinutes(LOG_WINDOW_MINUTES[stop] ?? DEFAULT_LOG_WINDOW_MINUTES)
            }
          />
        )}

        {showAdvanced && capture !== undefined && (
          <div className="space-y-2">
            <CheckboxField
              checked={includeScreenshot}
              data-testid="feedback-include-screenshot"
              hints={t("feedback::screenshot::hint")}
              label={t("feedback::screenshot::label")}
              onChange={setIncludeScreenshot}
            />

            {includeScreenshot && (
              <img
                alt={t("feedback::screenshot::alt")}
                className="max-h-48 rounded-sm border border-stroke-weak"
                data-testid="feedback-screenshot-preview"
                src={`data:${capture.mime};base64,${capture.data}`}
              />
            )}
          </div>
        )}

        {showAdvanced && recording !== undefined && (
          <CheckboxField
            checked={includeReplay}
            data-testid="feedback-include-replay"
            hints={t("feedback::replay::hint")}
            label={t("feedback::replay::label")}
            onChange={setIncludeReplay}
          />
        )}
      </div>
    );
    actions = (
      <>
        {closeButton}

        <Button
          appearance="moderate"
          brand="neutral"
          data-testid="feedback-back"
          onClick={() => setChosen(false)}
        >
          {t("feedback::buttons::back")}
        </Button>

        <Button data-testid="feedback-send" disabled={text.trim() === ""} onClick={submit}>
          {t("feedback::buttons::send")}
        </Button>
      </>
    );
  }

  return (
    <Modal
      isOpen={visible}
      size="lg"
      title={state.status === "sent" ? t("feedback::sentTitle") : t("feedback::title")}
      onClose={onHide}
    >
      {body}

      <div className="mt-6 flex justify-end gap-2">{actions}</div>
    </Modal>
  );
};
