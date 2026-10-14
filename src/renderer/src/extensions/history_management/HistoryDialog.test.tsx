import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { settleTransitions } from "@/test-utils/transitions";

import { HistoryDialog } from "./HistoryDialog";
import type { IHistoryEvent, IHistoryStack, Revertability } from "./types";

// Reads the game for each row; unknown games just leave that cell empty.
vi.mock("../gamemode_management/util/getGame", () => ({ getGame: () => undefined }));

// The info panel is its own connected control with its own state.
vi.mock("../../controls/Usage", () => ({ default: () => null }));

const events: IHistoryEvent[] = [
  { id: "old", type: "t", data: {}, gameId: "g", timestamp: 1 },
  { id: "new", type: "t", data: {}, gameId: "g", timestamp: 2 },
];

const makeStack = (revertability: Revertability = "yes"): IHistoryStack => ({
  size: 10,
  describe: (event) => `Did ${event.id}`,
  describeRevert: () => "Undo it",
  canRevert: () => revertability,
  revert: vi.fn(() => Promise.resolve()),
});

const renderDialog = (overrides: Partial<React.ComponentProps<typeof HistoryDialog>> = {}) => {
  const props = {
    t: ((key: string) => key) as never,
    events,
    stacks: { main: makeStack() },
    stackToShow: "main",
    onClose: vi.fn(),
    onReverted: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  } as React.ComponentProps<typeof HistoryDialog>;

  render(<HistoryDialog {...props} />);

  return props;
};

describe("HistoryDialog", () => {
  it("renders nothing when there is no stack to show", () => {
    renderDialog({ stackToShow: "missing", events: undefined });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lists the events newest first", async () => {
    renderDialog();

    const rows = screen.getAllByTestId("history-event");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Did new");
    expect(rows[1]).toHaveTextContent("Did old");

    await settleTransitions();
  });

  it("closes through the Close button", async () => {
    const { onClose } = renderDialog();

    await userEvent.click(screen.getByTestId("history-close"));

    expect(onClose).toHaveBeenCalledOnce();

    await settleTransitions();
  });

  it("reverts the event of the clicked row", async () => {
    const stack = makeStack();
    const { onReverted } = renderDialog({ stacks: { main: stack } });

    await userEvent.click(screen.getAllByTestId("history-revert")[0]);

    expect(onReverted).toHaveBeenCalledWith("main", expect.objectContaining({ id: "new" }));
    expect(stack.revert).toHaveBeenCalledWith(expect.objectContaining({ id: "new" }));

    await settleTransitions();
  });

  it("disables the revert button for an event that can no longer be reverted", async () => {
    renderDialog({ stacks: { main: makeStack("invalid") } });

    for (const button of screen.getAllByTestId("history-revert")) {
      expect(button).toBeDisabled();
    }

    await settleTransitions();
  });
});
