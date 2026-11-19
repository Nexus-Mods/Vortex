import React, { useState } from "react";

import { Button } from "@/ui/components/button/Button";
import { CheckboxField } from "@/ui/components/form/checkbox_field/CheckboxField";
import { Icon } from "@/ui/components/icon/Icon";
import { Modal } from "@/ui/components/modal/Modal";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

export type FeedbackSentiment = "positive" | "negative";

export interface IFeedbackReason {
  /** Stable key, sent in events. */
  key: string;
  /** The checkbox's label. */
  label: string;
}

export interface IFeedbackSentimentContent {
  /** The modal's heading when it opens on this sentiment. */
  title: string;
  /** The line under the heading when it opens on this sentiment. */
  body: string;
  /** The checkboxes, in order. */
  reasons: IFeedbackReason[];
}

export interface IFeedbackPickContent {
  /** The modal's heading on the pick step, kept once a sentiment is picked. */
  heading: string;
  /** The line under the heading on the pick step, kept once a sentiment is picked. */
  body: string;
  /** The positive thumb button's label. */
  positiveLabel: string;
  /** The negative thumb button's label. */
  negativeLabel: string;
}

interface IFeedbackModalBaseProps {
  /** Whether the modal is showing; each time it opens it starts clean. */
  isOpen: boolean;
  /** The skip button's label. */
  skipLabel: string;
  /** The send button's label. */
  sendLabel: string;
  /** Send feedback, with the sentiment and the ticked reasons' keys in their listed order. */
  onSend: (feedback: { sentiment: FeedbackSentiment; reasons: string[] }) => void;
  /** The Skip button, once a sentiment is picked or opened on. */
  onSkip: (sentiment: FeedbackSentiment) => void;
  /** Closed with the X, Escape or a click outside, which gives nothing. */
  onDismiss: () => void;
}

/** Opened on the pick step: both sentiments and the pick step's wording. */
interface IFeedbackPickProps {
  /** Unset, so it opens on the pick step. */
  preselectedSentiment?: undefined;
  /** The thumbs-up content. */
  positive: IFeedbackSentimentContent;
  /** The thumbs-down content. */
  negative: IFeedbackSentimentContent;
  /** The pick step's heading, body and thumb labels. */
  pick: IFeedbackPickContent;
}

/** Opened straight on one sentiment's reasons, with no thumb buttons: that sentiment's content. */
type IFeedbackPreselectedProps =
  | ({ preselectedSentiment: "positive"; positive: IFeedbackSentimentContent } & Partial<
      Omit<IFeedbackPickProps, "preselectedSentiment" | "positive">
    >)
  | ({ preselectedSentiment: "negative"; negative: IFeedbackSentimentContent } & Partial<
      Omit<IFeedbackPickProps, "preselectedSentiment" | "negative">
    >);

export type IFeedbackModalProps = IFeedbackModalBaseProps &
  (IFeedbackPickProps | IFeedbackPreselectedProps);

interface IThumbButtonProps {
  /** Whether this is the sentiment picked. */
  isPicked: boolean;
  /** Its thumb. */
  icon: "thumb_up" | "thumb_down";
  /** What it says under the thumb. */
  label: string;
  /** A `data-testid` for it. */
  testId: string;
  /** Picks its sentiment. */
  onPick: () => void;
}

/** One sentiment's large thumb on the pick step: orange while picked. */
const ThumbButton = ({ isPicked, icon, label, testId, onPick }: IThumbButtonProps) => (
  <button
    aria-pressed={isPicked}
    className={joinClasses([
      "flex flex-1 flex-col items-center gap-y-2 rounded-sm border py-2 focus-ring",
      isPicked
        ? "border-primary-moderate bg-primary-700/20 text-primary-strong"
        : "border-stroke-weak bg-surface-mid text-neutral-subdued hover:text-neutral-moderate",
    ])}
    data-testid={testId}
    type="button"
    onClick={onPick}
  >
    <Icon name={icon} size="lg" />

    <Typography as="span" brand="none" typographyType="body-sm">
      {label}
    </Typography>
  </button>
);

/**
 * The modal's contents, which it unmounts when closed, so each open starts on the preselected
 * sentiment with nothing ticked.
 */
const FeedbackModalContent = ({
  positive,
  negative,
  pick,
  preselectedSentiment,
  skipLabel,
  sendLabel,
  onSend,
  onSkip,
}: Omit<IFeedbackModalProps, "isOpen" | "onDismiss">) => {
  const [sentiment, setSentiment] = useState<FeedbackSentiment | undefined>(preselectedSentiment);
  const [ticked, setTicked] = useState<string[]>([]);

  const content = sentiment && { positive, negative }[sentiment];

  const pickSentiment = (picked: FeedbackSentiment) => {
    setSentiment(picked);
    setTicked([]);
  };

  return (
    <div className="flex flex-col gap-y-4">
      <Typography appearance="subdued" data-testid="feedback-modal-body" typographyType="body-sm">
        {preselectedSentiment ? content?.body : pick?.body}
      </Typography>

      {!preselectedSentiment && pick && (
        <div className="flex gap-x-4">
          <ThumbButton
            icon="thumb_up"
            isPicked={sentiment === "positive"}
            label={pick.positiveLabel}
            testId="feedback-modal-positive"
            onPick={() => pickSentiment("positive")}
          />

          <ThumbButton
            icon="thumb_down"
            isPicked={sentiment === "negative"}
            label={pick.negativeLabel}
            testId="feedback-modal-negative"
            onPick={() => pickSentiment("negative")}
          />
        </div>
      )}

      {sentiment && content && (
        <>
          {!preselectedSentiment && <div className="h-px bg-stroke-weak" />}

          <div className="space-y-2">
            {content.reasons.map((reason) => (
              <CheckboxField
                checked={ticked.includes(reason.key)}
                data-testid={`feedback-modal-reason-${reason.key}`}
                key={reason.key}
                label={reason.label}
                onChange={(isChecked) =>
                  setTicked((prev) =>
                    isChecked ? [...prev, reason.key] : prev.filter((key) => key !== reason.key),
                  )
                }
              />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-x-2">
            <Button
              appearance="moderate"
              brand="neutral"
              className="w-full"
              data-testid="feedback-modal-skip"
              onClick={() => onSkip(sentiment)}
            >
              {skipLabel}
            </Button>

            <Button
              className="w-full"
              data-testid="feedback-modal-send"
              onClick={() =>
                onSend({
                  sentiment,
                  reasons: content.reasons
                    .map((reason) => reason.key)
                    .filter((key) => ticked.includes(key)),
                })
              }
            >
              {sendLabel}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export const FeedbackModal = ({ isOpen, onDismiss, ...props }: IFeedbackModalProps) => {
  const { positive, negative, pick, preselectedSentiment } = props;

  return (
    <Modal
      isOpen={isOpen}
      size="sm"
      title={
        preselectedSentiment ? { positive, negative }[preselectedSentiment]?.title : pick?.heading
      }
      onClose={onDismiss}
    >
      <FeedbackModalContent {...props} />
    </Modal>
  );
};
