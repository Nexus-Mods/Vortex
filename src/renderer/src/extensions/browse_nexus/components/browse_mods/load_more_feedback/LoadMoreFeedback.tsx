import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import type { FeedbackSentiment } from "@/ui/components/feedback_modal/FeedbackModal";
import { Icon } from "@/ui/components/icon/Icon";
import { Typography } from "@/ui/components/typography/Typography";

interface ILoadMoreFeedbackProps {
  /** Whether feedback has been given on this device. */
  hasGiven: boolean;
  /** Called with the sentiment a thumb picks. */
  onVote: (sentiment: FeedbackSentiment) => void;
}

/**
 * The line under Load more asking how browsing is going, with a thumb for each sentiment. Once a
 * thumb here has led to feedback it says thanks, for as long as the row stays; if feedback was
 * given elsewhere, it isn't shown.
 */
export const LoadMoreFeedback = ({ hasGiven, onVote }: ILoadMoreFeedbackProps) => {
  const { t } = useTranslation();
  const [votedHere, setVotedHere] = useState(false);

  if (votedHere && hasGiven) {
    return (
      <div
        className="flex items-center justify-center gap-x-2"
        data-testid="load-more-feedback-thanks"
      >
        <Icon className="text-success-strong" name="check" size="sm" />

        <Typography appearance="subdued" brand="neutral-translucent" typographyType="body-sm">
          {t("Thanks for your feedback")}
        </Typography>
      </div>
    );
  }

  if (hasGiven) {
    return null;
  }

  const vote = (sentiment: FeedbackSentiment) => {
    setVotedHere(true);
    onVote(sentiment);
  };

  return (
    <div className="flex items-center justify-center gap-x-2">
      <Icon className="text-neutral-subdued" name="reviews" size="sm" />

      <Typography appearance="subdued" brand="neutral-translucent" typographyType="body-sm">
        {t("How's the browsing experience?")}
      </Typography>

      <Button
        appearance="subdued"
        aria-label={t("I like it")}
        brand="neutral"
        data-testid="load-more-feedback-positive"
        leftIcon="thumb_up"
        size="sm"
        onClick={() => vote("positive")}
      />

      <Button
        appearance="subdued"
        aria-label={t("I don't like it")}
        brand="neutral"
        data-testid="load-more-feedback-negative"
        leftIcon="thumb_down"
        size="sm"
        onClick={() => vote("negative")}
      />
    </div>
  );
};
