import { getErrorMessageOrDefault, type LogWindowMinutes } from "@vortex/shared";
import type {
  FeedbackSendFailure,
  FeedbackSendResult,
  IFeedbackScreenshot,
  IFeedbackSendRequest,
} from "@vortex/shared/ipc";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "react-redux";

import { useExtensionContext } from "@/ExtensionProvider";
import { getAccessToken } from "@/extensions/nexus_integration/util/oauthSession";
import { flushPendingDiffs } from "@/store/persistDiffMiddleware";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { log } from "@/util/log";

import { buildFeedbackRequest } from "../util/collectFeedback";
import { newFeedbackId } from "../util/feedbackIds";

export type FeedbackFailure = FeedbackSendFailure;

export type SendState =
  | { status: "editing" }
  | { status: "sending"; sent: number; total: number }
  | { status: "sent"; feedbackId: string }
  | { status: "failed"; reason: FeedbackFailure; message: string };

export interface IFeedbackForm {
  text: string;
  includeSupportData: boolean;
  logWindowMinutes: LogWindowMinutes;
  screenshot: IFeedbackScreenshot | undefined;
  /** Whether the recording main put aside as the dialog opened goes too. */
  includeReplay: boolean;
}

export interface ISendFeedbackControls {
  state: SendState;
  send: (form: IFeedbackForm) => void;
  /** Back to the form after a failure, with what the user wrote still there. */
  edit: () => void;
}

interface IFeedbackIdentity {
  feedbackId: string;
  createdAt: Date;
}

/** The request one feedback was sent as, and the form it was built from. */
interface ISentFeedback {
  form: IFeedbackForm;
  request: IFeedbackSendRequest;
}

/** How often the dialog asks main how far a send has got. */
const PROGRESS_POLL_MS = 250;

/** Whether two sends are of the same feedback. The screenshot is compared by reference. */
const isSameForm = (lhs: IFeedbackForm, rhs: IFeedbackForm): boolean =>
  lhs.text === rhs.text &&
  lhs.includeSupportData === rhs.includeSupportData &&
  lhs.logWindowMinutes === rhs.logWindowMinutes &&
  lhs.screenshot === rhs.screenshot &&
  lhs.includeReplay === rhs.includeReplay;

/**
 * Has main send the request with the user's login. Main reports a refused login rather than
 * renewing it, since the login lives here: it is renewed once and the feedback sent again, which
 * picks up where the refused attempt stopped.
 */
async function sendWithLogin(
  api: IExtensionApi,
  request: IFeedbackSendRequest,
): Promise<FeedbackSendResult> {
  const token = await getAccessToken(api);
  if (token === undefined) {
    return { status: "failed", reason: "unauthorized", message: "Not logged in to Nexus Mods." };
  }

  // main reads the persisted state itself, so the changes still waiting to be sent go first
  flushPendingDiffs();

  const result = await window.api.feedback.send(request, token);
  if (result.status !== "failed" || result.reason !== "unauthorized") {
    return result;
  }

  let fresh: string | undefined;
  try {
    fresh = await getAccessToken(api, token);
  } catch {
    fresh = undefined;
  }
  return fresh === undefined || fresh === token ? result : window.api.feedback.send(request, fresh);
}

/**
 * Sends one feedback for as long as the dialog is open. Main builds the feedback's records on
 * the first send and keeps them, so a retry sends exactly the records the failed attempt did and
 * skips what was stored already. Once the user changes the form after a failure, the old id may
 * already hold some of the old records, so the changed feedback gets an id of its own. Closing the
 * dialog stops a send in progress.
 */
export function useSendFeedback(visible: boolean): ISendFeedbackControls {
  const store = useStore<IState>();
  const extensions = useExtensionContext();
  const [state, setState] = useState<SendState>({ status: "editing" });

  // Reset as the dialog opens, during render rather than in an effect, so its first frame doesn't
  // show how the last feedback ended. Not on close, which would change the dialog as it fades out.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setState({ status: "editing" });
    }
  }

  const identityRef = useRef<IFeedbackIdentity | undefined>(undefined);
  const sentRef = useRef<ISentFeedback | undefined>(undefined);
  /** Counts sends, so an earlier one that ends late leaves the dialog alone. */
  const attemptRef = useRef(0);

  useEffect(() => {
    if (!visible) {
      return;
    }

    identityRef.current = { feedbackId: newFeedbackId(), createdAt: new Date() };
    sentRef.current = undefined;

    return () => {
      const identity = identityRef.current;
      if (identity !== undefined) {
        void window.api.feedback.discard(identity.feedbackId);
      }
      window.api.feedback.releaseReplay();
      attemptRef.current += 1;
      identityRef.current = undefined;
      sentRef.current = undefined;
    };
  }, [visible]);

  const send = useCallback(
    (form: IFeedbackForm) => {
      let identity = identityRef.current;
      if (identity === undefined) {
        return;
      }

      if (sentRef.current !== undefined && !isSameForm(sentRef.current.form, form)) {
        void window.api.feedback.discard(identity.feedbackId);
        // the logs still cover the time before the dialog opened, so the creation time stays
        identity = { feedbackId: newFeedbackId(), createdAt: identity.createdAt };
        identityRef.current = identity;
        sentRef.current = undefined;
      }
      const current = identity;
      const request =
        sentRef.current?.request ?? buildFeedbackRequest(store.getState(), { ...current, ...form });
      sentRef.current = { form, request };

      const attempt = ++attemptRef.current;
      const isCurrent = () => attemptRef.current === attempt;

      setState({ status: "sending", sent: 0, total: 0 });
      const poll = setInterval(() => {
        void window.api.feedback
          .progress(current.feedbackId)
          .then((progress) => {
            if (progress !== null && progress.total > 0 && isCurrent()) {
              setState({ status: "sending", ...progress });
            }
          })
          // progress is only shown; the send itself reports how it ended
          .catch(() => undefined);
      }, PROGRESS_POLL_MS);

      void sendWithLogin(extensions.getApi(), request)
        .catch(
          (err: unknown): FeedbackSendResult => ({
            status: "failed",
            reason: "unknown",
            message: getErrorMessageOrDefault(err),
          }),
        )
        .then((result) => {
          clearInterval(poll);
          if (result.status === "canceled") {
            return;
          }
          if (result.status === "failed") {
            log("warn", "failed to send feedback", {
              feedbackId: current.feedbackId,
              reason: result.reason,
              error: result.message,
            });
            if (isCurrent()) {
              setState({ status: "failed", reason: result.reason, message: result.message });
            }
            return;
          }

          // The dialog shows the ID once; this keeps it findable after the dialog is closed. No
          // timer, so it stays in the notification list until the user dismisses it.
          const { feedbackId } = current;
          extensions.getApi().sendNotification?.({
            id: `feedback-sent-${feedbackId}`,
            type: "success",
            title: "Feedback sent",
            message: "Quote this ID if you contact the team: {{feedbackId}}",
            replace: { feedbackId },
            actions: [
              {
                title: "Copy ID",
                action: () => void window.api.clipboard.writeText(feedbackId),
              },
            ],
          });
          if (isCurrent()) {
            setState({ status: "sent", feedbackId });
          }
        });
    },
    [extensions, store],
  );

  const edit = useCallback(() => {
    setState((prev) => (prev.status === "failed" ? { status: "editing" } : prev));
  }, []);

  return { state, send, edit };
}
