/**
 * FeedbackModal Demo Component
 * Demonstrates opening on the pick step and on one sentiment
 */

import React, { useState } from "react";

import { Button } from "@/ui/components/button/Button";
import { Typography } from "@/ui/components/typography/Typography";

import { type FeedbackSentiment, FeedbackModal } from "./FeedbackModal";

const positive = {
  title: "Glad you're enjoying it",
  body: "Help us understand what's working by telling us what you liked.",
  reasons: [
    { key: "easy_to_find", label: "Easy to find mods" },
    { key: "fast", label: "Fast and responsive" },
    { key: "other", label: "Other" },
  ],
};

const negative = {
  title: "Thanks for letting us know",
  body: "Help us improve browsing by telling us what went wrong.",
  reasons: [
    { key: "not_found", label: "Couldn't find what I was looking for" },
    { key: "slow", label: "Slow or unresponsive" },
    { key: "other", label: "Other" },
  ],
};

const pick = {
  heading: "How's the browsing experience?",
  body: "Help us understand what's working by telling us what you liked.",
  positiveLabel: "I like it",
  negativeLabel: "I don't like it",
};

export const FeedbackModalDemo = () => {
  const [opened, setOpened] = useState<{ sentiment?: FeedbackSentiment }>();
  const [last, setLast] = useState("Nothing yet");

  const close = (outcome: string) => {
    setLast(outcome);
    setOpened(undefined);
  };

  return (
    <div className="space-y-8">
      <div className="rounded-sm bg-surface-mid p-4">
        <Typography as="h2" typographyType="heading-sm">
          FeedbackModal
        </Typography>

        <Typography appearance="subdued">
          A thumbs up or down with optional reasons. Opens on a pick step, or straight on one
          sentiment&apos;s reasons. The caller passes all wording and does its own tracking; closing
          gives nothing, only Skip and Send feedback do.
        </Typography>
      </div>

      <div className="flex flex-wrap gap-4">
        <Button appearance="subdued" brand="neutral" onClick={() => setOpened({})}>
          Open on the pick step
        </Button>

        <Button
          appearance="subdued"
          brand="neutral"
          onClick={() => setOpened({ sentiment: "positive" })}
        >
          Open on positive
        </Button>

        <Button
          appearance="subdued"
          brand="neutral"
          onClick={() => setOpened({ sentiment: "negative" })}
        >
          Open on negative
        </Button>
      </div>

      <Typography appearance="subdued" typographyType="body-sm">
        Last outcome: {last}
      </Typography>

      <FeedbackModal
        isOpen={!!opened}
        negative={negative}
        pick={pick}
        positive={positive}
        preselectedSentiment={opened?.sentiment}
        sendLabel="Send feedback"
        skipLabel="Skip"
        onDismiss={() => close("Dismissed")}
        onSend={({ sentiment, reasons }) =>
          close(`Sent ${sentiment}: ${reasons.join(", ") || "no reasons"}`)
        }
        onSkip={(sentiment) => close(`Skipped ${sentiment}`)}
      />
    </div>
  );
};
