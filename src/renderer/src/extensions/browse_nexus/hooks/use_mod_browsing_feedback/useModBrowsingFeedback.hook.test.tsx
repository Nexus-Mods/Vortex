import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Provider } from "react-redux";
import { combineReducers, createStore } from "redux";
import { describe, expect, it, vi } from "vitest";

import { browseModsTracking } from "@/test-utils/browseModsTracking";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { FeedbackSentiment } from "@/ui/components/feedback_modal/FeedbackModal";

import { modBrowsingReducer } from "../../reducers/mod_browsing/modBrowsing";
import { useModBrowsingFeedback } from "./useModBrowsingFeedback.hook";

/** The search the feedback is counted with. */
const BROWSING = {
  view: "trending",
  sort_field: "endorsements",
  sort_direction: "desc",
  has_search: false,
  time_range: "7",
  adult: "exclude",
  pages_loaded: 2,
} as const;

const setup = () => {
  const tracking = browseModsTracking();
  const sendNotification = vi.fn();
  const api = { sendNotification } as unknown as IExtensionApi;
  const store = createStore(
    combineReducers({
      persistent: combineReducers({
        modBrowsing: (state = modBrowsingReducer.defaults, action: any) =>
          modBrowsingReducer.reducers[action.type]?.(state, action.payload) ?? state,
      }),
    }),
  );

  const Host = () => {
    const { hasGiven, open, modal } = useModBrowsingFeedback(api, BROWSING);
    return (
      <>
        <span data-testid="has-given">{String(hasGiven)}</span>
        <button data-testid="open-toolbar" onClick={() => open("toolbar")} />
        <button
          data-testid="open-load-more-positive"
          onClick={() => open("load_more", "positive" as FeedbackSentiment)}
        />
        <button
          data-testid="open-load-more-negative"
          onClick={() => open("load_more", "negative" as FeedbackSentiment)}
        />
        {modal}
      </>
    );
  };

  render(
    <Provider store={store}>
      <tracking.wrapper>
        <Host />
      </tracking.wrapper>
    </Provider>,
  );

  return { ...tracking, sendNotification, store };
};

describe("useModBrowsingFeedback", () => {
  it("counts a toolbar vote and its reasons, and thanks the user", async () => {
    const user = userEvent.setup();
    const { tracked, sendNotification, store } = setup();

    await user.click(screen.getByTestId("open-toolbar"));
    await user.click(screen.getByTestId("feedback-modal-positive"));
    await user.click(screen.getByTestId("feedback-modal-reason-fast"));
    await user.click(screen.getByTestId("feedback-modal-send"));

    expect(store.getState().persistent.modBrowsing.hasGivenFeedback).toBe(true);
    expect(screen.getByTestId("has-given").textContent).toBe("true");
    expect(tracked("browse_mods_feedback_given").map(({ properties }) => properties)).toEqual([
      { ...BROWSING, sentiment: "positive", source: "toolbar", reasons: ["fast"] },
    ]);
    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "browse-mods-feedback-sent",
        type: "success",
        displayMS: 3000,
      }),
    );
  });

  it("counts a Load more vote without a toast", async () => {
    const user = userEvent.setup();
    const { tracked, sendNotification } = setup();

    await user.click(screen.getByTestId("open-load-more-negative"));
    await user.click(screen.getByTestId("feedback-modal-send"));

    expect(tracked("browse_mods_feedback_given").map(({ properties }) => properties)).toEqual([
      { ...BROWSING, sentiment: "negative", source: "load_more", reasons: [] },
    ]);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("counts only the vote when skipped", async () => {
    const user = userEvent.setup();
    const { tracked, sendNotification, store } = setup();

    await user.click(screen.getByTestId("open-load-more-positive"));
    await user.click(screen.getByTestId("feedback-modal-skip"));

    expect(store.getState().persistent.modBrowsing.hasGivenFeedback).toBe(true);
    expect(tracked("browse_mods_feedback_given").map(({ properties }) => properties)).toEqual([
      { ...BROWSING, sentiment: "positive", source: "load_more" },
    ]);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("thanks the user for a toolbar skip too", async () => {
    const user = userEvent.setup();
    const { tracked, sendNotification } = setup();

    await user.click(screen.getByTestId("open-toolbar"));
    await user.click(screen.getByTestId("feedback-modal-negative"));
    await user.click(screen.getByTestId("feedback-modal-skip"));

    expect(tracked("browse_mods_feedback_given").map(({ properties }) => properties)).toEqual([
      { ...BROWSING, sentiment: "negative", source: "toolbar" },
    ]);
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ id: "browse-mods-feedback-sent", type: "success" }),
    );
  });

  it("counts nothing when closed after a sentiment is chosen", async () => {
    const user = userEvent.setup();
    const { tracked, store } = setup();

    await user.click(screen.getByTestId("open-load-more-positive"));
    await user.click(screen.getByRole("button", { name: /close/i }));

    expect(store.getState().persistent.modBrowsing.hasGivenFeedback).toBe(false);
    expect(tracked()).toHaveLength(0);
  });

  it("counts nothing when closed on the pick step", async () => {
    const user = userEvent.setup();
    const { tracked, store } = setup();

    await user.click(screen.getByTestId("open-toolbar"));
    await user.click(screen.getByRole("button", { name: /close/i }));

    expect(store.getState().persistent.modBrowsing.hasGivenFeedback).toBe(false);
    expect(tracked()).toHaveLength(0);
  });
});
