import React, { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import {
  FeedbackModal,
  type FeedbackSentiment,
} from "@/ui/components/feedback_modal/FeedbackModal";

import { setHasGivenFeedback } from "../../actions/modBrowsing";
import type { FeedbackSource, ISearchEventProps } from "../browse_mods_tracking/browseModsTracker";
import { useBrowseModsTracker } from "../browse_mods_tracking/BrowseModsTracking.context";

/** Whether mod browsing feedback has been given on this device. */
const hasGivenFeedback = (state: IState) => state.persistent.modBrowsing.hasGivenFeedback;

/** How long its toast shows: up to 5s is shown as a toast, longer goes to notifications. */
const TOAST_MS = 3000;

interface IOpenFeedback {
  /** Where it was opened from. */
  source: FeedbackSource;
  /** The sentiment it opened on, when not picked in the modal. */
  sentiment?: FeedbackSentiment;
}

/**
 * Browse's feedback: whether the user has given it on this device, `open` to ask for it, and the
 * `modal` for the caller to render once. `browsing` is the search it's counted with.
 */
export const useModBrowsingFeedback = (
  api: IExtensionApi,
  browsing: ISearchEventProps & { pages_loaded: number },
): {
  hasGiven: boolean;
  open: (source: FeedbackSource, sentiment?: FeedbackSentiment) => void;
  modal: ReactNode;
} => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const tracker = useBrowseModsTracker();
  const hasGiven = useSelector(hasGivenFeedback);
  const [opened, setOpened] = useState<IOpenFeedback>();

  const close = () => setOpened(undefined);

  /**
   * Skip or Send: remembers it was given, counts it with the reasons when sent, and from the
   * toolbar, where nothing else on screen says so, thanks the user in a toast.
   */
  const give = (sentiment: FeedbackSentiment, reasons?: string[]) => {
    if (!opened) {
      return;
    }

    dispatch(setHasGivenFeedback(true));
    tracker.trackFeedbackGiven({ ...browsing, sentiment, source: opened.source, reasons });

    if (opened.source === "toolbar") {
      api.sendNotification?.({
        id: "browse-mods-feedback-sent",
        type: "success",
        message: t("Thanks! This helps us improve."),
        displayMS: TOAST_MS,
      });
    }

    close();
  };

  return {
    hasGiven,
    open: (source, sentiment) => setOpened({ source, sentiment }),
    modal: (
      <FeedbackModal
        isOpen={!!opened}
        negative={{
          title: t("Thanks for letting us know"),
          body: t("Help us improve browsing by telling us what went wrong."),
          reasons: [
            { key: "not_found", label: t("Couldn't find what I was looking for") },
            { key: "search_and_filters", label: t("Search or filters didn't work as expected") },
            { key: "not_enough_info", label: t("Not enough information to choose a mod") },
            { key: "install_confusing", label: t("Installing or updating was confusing") },
            { key: "slow", label: t("Slow or unresponsive") },
            { key: "other", label: t("Other") },
          ],
        }}
        pick={{
          heading: t("How's the browsing experience?"),
          body: t("Help us understand what's working by telling us what you liked."),
          positiveLabel: t("I like it"),
          negativeLabel: t("I don't like it"),
        }}
        positive={{
          title: t("Glad you're enjoying it"),
          body: t("Help us understand what's working by telling us what you liked."),
          reasons: [
            { key: "easy_to_find", label: t("Easy to find mods") },
            { key: "search_and_filters", label: t("Useful search and filters") },
            { key: "clear_details", label: t("Clear mod details") },
            { key: "install_in_vortex", label: t("Installing without leaving Vortex") },
            { key: "fast", label: t("Fast and responsive") },
            { key: "other", label: t("Other") },
          ],
        }}
        preselectedSentiment={opened?.sentiment}
        sendLabel={t("Send feedback")}
        skipLabel={t("Skip")}
        onDismiss={close}
        onSend={({ sentiment, reasons }) => give(sentiment, reasons)}
        onSkip={(sentiment) => give(sentiment)}
      />
    ),
  };
};
