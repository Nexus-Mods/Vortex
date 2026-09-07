import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Provider } from "react-redux";
import { describe, it, expect, vi } from "vitest";

import { showUsageInstruction } from "@/actions";

import { UsageAlert } from "./UsageAlert";

// --- Helpers ---

/** Only what the hint reads and writes: the usage flags, and somewhere to dispatch. */
const makeStore = (usage: { [usageId: string]: boolean }) => ({
  getState: () => ({ settings: { interface: { usage } } }),
  subscribe: () => () => undefined,
  dispatch: vi.fn(),
});

const renderHint = (usage: { [usageId: string]: boolean } = {}) => {
  const store = makeStore(usage);

  render(
    <Provider store={store as never}>
      <UsageAlert infoId="table-multiselect">You can select more than one</UsageAlert>
    </Provider>,
  );

  return store;
};

const queryHint = () => screen.queryByText("You can select more than one");

// --- Tests ---

describe("UsageAlert", () => {
  it("shows the hint to someone who has never dismissed it", () => {
    renderHint();
    expect(queryHint()).toBeInTheDocument();
  });

  it("shows the hint while its flag is set", () => {
    renderHint({ "table-multiselect": true });
    expect(queryHint()).toBeInTheDocument();
  });

  it("stays away once it has been dismissed", () => {
    // The decision outlives the session, so a restart mustn't bring the hint back.
    renderHint({ "table-multiselect": false });
    expect(queryHint()).not.toBeInTheDocument();
  });

  it("leaves other hints alone", () => {
    renderHint({ "some-other-hint": false });
    expect(queryHint()).toBeInTheDocument();
  });

  it("records the dismissal against its own id", async () => {
    const store = renderHint();

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(store.dispatch).toHaveBeenCalledWith(showUsageInstruction("table-multiselect", false));
  });

  it("hides the hint as it is dismissed, without waiting for the store", async () => {
    // The store is a spy here, so nothing comes back — the bar has to go on its own.
    renderHint();

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(queryHint()).not.toBeInTheDocument();
  });
});
