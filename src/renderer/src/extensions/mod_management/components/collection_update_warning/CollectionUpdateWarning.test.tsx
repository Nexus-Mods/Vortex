import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it } from "vitest";

import { settleTransitions } from "@/test-utils/transitions";

import {
  askCollectionUpdate,
  type CollectionUpdateChoice,
  type CollectionUpdatePrompt,
} from "../../util/collection_update_prompt/collectionUpdatePrompt";
import { CollectionUpdateWarning } from "./CollectionUpdateWarning";

// --- Helpers ---

const single: CollectionUpdatePrompt = {
  kind: "single",
  collectionNames: ["Immersive and Adult", "Second Pack "],
};

const batch = (hasNonCollectionMods: boolean): CollectionUpdatePrompt => ({
  kind: "batch",
  collectionNames: ["Immersive and Adult"],
  hasNonCollectionMods,
});

/** Shows the prompt and returns the user's eventual choice, set once they answer. */
const showPrompt = async (prompt: CollectionUpdatePrompt) => {
  const outcome: { choice?: CollectionUpdateChoice } = {};

  render(<CollectionUpdateWarning />);

  await act(async () => {
    void askCollectionUpdate(prompt).then((choice) => {
      outcome.choice = choice;
    });
  });

  await screen.findByTestId("collection-update-confirm");

  return outcome;
};

// --- Tests ---

describe("CollectionUpdateWarning", () => {
  it("renders nothing while no prompt is waiting", () => {
    render(<CollectionUpdateWarning />);

    expect(screen.queryByTestId("collection-update-confirm")).not.toBeInTheDocument();
  });

  it("lists the collections, trimmed", async () => {
    await showPrompt(single);

    expect(screen.getByText("Immersive and Adult")).toBeInTheDocument();
    expect(screen.getByText("Second Pack")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("collection-update-cancel"));
    await settleTransitions();
  });

  it("keeps the confirm button disabled until the box is ticked", async () => {
    await showPrompt(single);

    expect(screen.getByTestId("collection-update-confirm")).toBeDisabled();

    await userEvent.click(screen.getByRole("checkbox"));

    expect(screen.getByTestId("collection-update-confirm")).toBeEnabled();

    await userEvent.click(screen.getByTestId("collection-update-cancel"));
    await settleTransitions();
  });

  it("never disables Cancel", async () => {
    await showPrompt(single);

    expect(screen.getByTestId("collection-update-cancel")).toBeEnabled();

    await userEvent.click(screen.getByTestId("collection-update-cancel"));
    await settleTransitions();
  });

  it("answers all once the box is ticked and the user confirms", async () => {
    const outcome = await showPrompt(single);

    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByTestId("collection-update-confirm"));

    expect(outcome.choice).toBe("all");

    await settleTransitions();
  });

  it("answers cancel when the user cancels", async () => {
    const outcome = await showPrompt(single);

    await userEvent.click(screen.getByTestId("collection-update-cancel"));

    expect(outcome.choice).toBe("cancel");

    await settleTransitions();
  });

  it("answers cancel when the user closes the dialog", async () => {
    const outcome = await showPrompt(single);

    await userEvent.keyboard("{Escape}");

    expect(outcome.choice).toBe("cancel");

    await settleTransitions();
  });

  it("offers the non-collection option when the batch has such mods", async () => {
    const outcome = await showPrompt(batch(true));

    expect(screen.getByTestId("collection-update-confirm")).toBeDisabled();
    expect(screen.getByTestId("collection-update-non-collection")).toBeEnabled();

    await userEvent.click(screen.getByTestId("collection-update-non-collection"));

    expect(outcome.choice).toBe("non-collection");

    await settleTransitions();
  });

  it("leaves out the non-collection option when every mod is in a collection", async () => {
    await showPrompt(batch(false));

    expect(screen.queryByTestId("collection-update-non-collection")).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId("collection-update-cancel"));
    await settleTransitions();
  });

  it("starts the next prompt with the box unticked", async () => {
    await showPrompt(single);
    await userEvent.click(screen.getByRole("checkbox"));

    await act(async () => {
      void askCollectionUpdate(single);
    });
    await userEvent.click(screen.getByTestId("collection-update-cancel"));
    await settleTransitions();

    expect(screen.getByRole("checkbox")).not.toBeChecked();

    await userEvent.click(screen.getByTestId("collection-update-cancel"));
    await settleTransitions();
  });
});
