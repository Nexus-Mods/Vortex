import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { LoadMoreFeedback } from "./LoadMoreFeedback";

describe("LoadMoreFeedback", () => {
  it("votes the sentiment clicked", async () => {
    const onVote = vi.fn();
    render(<LoadMoreFeedback hasGiven={false} onVote={onVote} />);

    await userEvent.click(screen.getByTestId("load-more-feedback-negative"));

    expect(onVote).toHaveBeenCalledWith("negative");
  });

  it("thanks them once the vote from here has been given", async () => {
    const { rerender } = render(<LoadMoreFeedback hasGiven={false} onVote={vi.fn()} />);

    await userEvent.click(screen.getByTestId("load-more-feedback-positive"));
    rerender(<LoadMoreFeedback hasGiven onVote={vi.fn()} />);

    expect(screen.getByTestId("load-more-feedback-thanks")).toBeInTheDocument();
  });

  it("shows nothing when feedback was given elsewhere", () => {
    const { container } = render(<LoadMoreFeedback hasGiven onVote={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows nothing on a fresh mount after the thanks", async () => {
    const { rerender, unmount } = render(<LoadMoreFeedback hasGiven={false} onVote={vi.fn()} />);
    await userEvent.click(screen.getByTestId("load-more-feedback-positive"));
    rerender(<LoadMoreFeedback hasGiven onVote={vi.fn()} />);
    unmount();

    const { container } = render(<LoadMoreFeedback hasGiven onVote={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });
});
