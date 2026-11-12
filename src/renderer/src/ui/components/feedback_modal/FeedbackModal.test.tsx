import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { settleTransitions } from "@/test-utils/transitions";

import { type FeedbackSentiment, FeedbackModal, type IFeedbackModalProps } from "./FeedbackModal";

const renderModal = ({ preselectedSentiment }: { preselectedSentiment?: FeedbackSentiment }) => {
  const onSend = vi.fn();
  const onSkip = vi.fn();
  const onDismiss = vi.fn();
  const props: IFeedbackModalProps = {
    isOpen: true,
    positive: {
      title: "Up title",
      body: "Up body",
      reasons: [
        { key: "easy", label: "Easy" },
        { key: "other", label: "Other" },
      ],
    },
    negative: {
      title: "Down title",
      body: "Down body",
      reasons: [
        { key: "search", label: "Search" },
        { key: "slow", label: "Slow" },
        { key: "other", label: "Other" },
      ],
    },
    pick: { heading: "Heading", body: "Pick body", positiveLabel: "Good", negativeLabel: "Bad" },
    skipLabel: "Skip",
    sendLabel: "Send",
    onSend,
    onSkip,
    onDismiss,
    preselectedSentiment,
  };
  const { rerender } = render(<FeedbackModal {...props} />);
  return { onSend, onSkip, onDismiss, rerender, props };
};

describe("FeedbackModal", () => {
  it("opens preselected on a sentiment with its reasons and no thumbs", async () => {
    renderModal({ preselectedSentiment: "negative" });
    expect(await screen.findByTestId("feedback-modal-reason-slow")).toBeInTheDocument();
    expect(screen.queryByTestId("feedback-modal-positive")).toBeNull();
  });

  it("sends the sentiment and ticked reasons in listed order", async () => {
    const { onSend } = renderModal({ preselectedSentiment: "negative" });
    await userEvent.click(screen.getByTestId("feedback-modal-reason-slow"));
    await userEvent.click(screen.getByTestId("feedback-modal-reason-search"));
    await userEvent.click(screen.getByTestId("feedback-modal-send"));
    expect(onSend).toHaveBeenCalledWith({ sentiment: "negative", reasons: ["search", "slow"] });
  });

  it("dismisses, not skips, when closed while opened on a sentiment", async () => {
    const { onSkip, onDismiss } = renderModal({ preselectedSentiment: "positive" });
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onDismiss).toHaveBeenCalled();
    expect(onSkip).not.toHaveBeenCalled();
  });

  it("skips with the sentiment from the skip button", async () => {
    const { onSkip } = renderModal({ preselectedSentiment: "positive" });
    await userEvent.click(screen.getByTestId("feedback-modal-skip"));
    expect(onSkip).toHaveBeenCalledWith("positive");
  });

  it("shows no reasons on the pick step until a sentiment is picked", async () => {
    renderModal({});
    expect(screen.queryByTestId("feedback-modal-send")).toBeNull();
    await userEvent.click(screen.getByTestId("feedback-modal-positive"));
    expect(screen.getByTestId("feedback-modal-positive")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("feedback-modal-reason-easy")).toBeInTheDocument();
  });

  it("keeps the pick step's body once a sentiment is picked", async () => {
    renderModal({});
    await userEvent.click(screen.getByTestId("feedback-modal-negative"));
    expect(screen.getByTestId("feedback-modal-body")).toHaveTextContent("Pick body");
  });

  it("shows the sentiment's body when opened on it", async () => {
    renderModal({ preselectedSentiment: "negative" });
    expect(screen.getByTestId("feedback-modal-body")).toHaveTextContent("Down body");
    await settleTransitions();
  });

  it("swaps reasons and clears ticks when the sentiment changes", async () => {
    const { onSend } = renderModal({});
    await userEvent.click(screen.getByTestId("feedback-modal-positive"));
    await userEvent.click(screen.getByTestId("feedback-modal-reason-easy"));
    await userEvent.click(screen.getByTestId("feedback-modal-negative"));
    await userEvent.click(screen.getByTestId("feedback-modal-send"));
    expect(onSend).toHaveBeenCalledWith({ sentiment: "negative", reasons: [] });
  });

  it("dismisses when closed on the pick step without a sentiment", async () => {
    const { onDismiss, onSkip } = renderModal({});
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onDismiss).toHaveBeenCalled();
    expect(onSkip).not.toHaveBeenCalled();
  });

  it("dismisses, not skips, when closed after picking", async () => {
    const { onSkip, onDismiss } = renderModal({});
    await userEvent.click(screen.getByTestId("feedback-modal-negative"));
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onDismiss).toHaveBeenCalled();
    expect(onSkip).not.toHaveBeenCalled();
  });

  it("starts clean when opened again", async () => {
    const { rerender, props } = renderModal({});
    await userEvent.click(screen.getByTestId("feedback-modal-positive"));
    await userEvent.click(screen.getByTestId("feedback-modal-reason-easy"));
    rerender(<FeedbackModal {...props} isOpen={false} />);
    rerender(<FeedbackModal {...props} isOpen />);
    expect(screen.queryByTestId("feedback-modal-send")).toBeNull();
  });
});
