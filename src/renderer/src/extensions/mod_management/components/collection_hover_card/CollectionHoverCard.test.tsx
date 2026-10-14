import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { makeModsTableStore } from "@/test-utils/modsTableStore";

import type { IMod } from "../../types/IMod";
import { CollectionHoverCard } from "./CollectionHoverCard";

const GB = 1024 ** 3;

// Two of its three mods installed, each from an archive; one other mod outside it.
const MODS = {
  a: { id: "a", type: "", archiveId: "archive-a", attributes: {} },
  b: { id: "b", type: "", archiveId: "archive-b", attributes: {} },
  other: { id: "other", type: "", archiveId: "archive-other", attributes: {} },
};

const collection = (attributes: object) =>
  ({
    id: "coll",
    type: "collection",
    attributes: { name: "Immersive & Adult", ...attributes },
    rules: ["a", "b", "missing"].map((id) => ({ type: "requires", reference: { id } })),
  }) as unknown as IMod;

const renderCard = (attributes: object) =>
  render(
    <Provider
      store={makeModsTableStore({
        mods: { ...MODS, coll: collection(attributes) },
        downloads: {
          "archive-a": { size: 2 * GB },
          "archive-b": { size: 1 * GB },
          "archive-other": { size: 9 * GB },
        },
      })}
    >
      <CollectionHoverCard collection={collection(attributes)} />
    </Provider>,
  );

// The collection's cover, which the card renders as its trigger.
const cover = () => document.querySelector<HTMLElement>(".nxm-image-collection")!;

const openCard = async () => {
  await userEvent.hover(cover());
  return screen.findByRole("tooltip");
};

describe("CollectionHoverCard", () => {
  it("shows the collection's cover, name and summary, laid out as a collection's", async () => {
    renderCard({ pictureUrl: "https://example.com/cover.png", shortDescription: "Most endorsed." });

    const card = await openCard();

    expect(card.querySelector(".nxm-hover-card-collection")).not.toBeNull();
    expect(card.querySelector("img")).toHaveAttribute("src", "https://example.com/cover.png");
    expect(within(card).getByText("Immersive & Adult")).toBeInTheDocument();
    expect(within(card).getByText("Most endorsed.")).toBeInTheDocument();
  });

  it("shows its curator, its mods, and the size of those installed", async () => {
    renderCard({ shortDescription: "Most endorsed.", author: "canliberk", uploader: "canliberk" });

    const card = await openCard();

    expect(within(card).getByText("canliberk")).toBeInTheDocument();
    // the test `t` leaves the count uninterpolated
    expect(within(card).getByText("{{count}} mods")).toBeInTheDocument();
    expect(within(card).getByText("3.00 GB")).toBeInTheDocument();
  });

  it("shows a card for a collection with neither a cover nor a summary, the icon in its place", async () => {
    renderCard({});

    const card = await openCard();

    expect(within(card).getByText("Immersive & Adult")).toBeInTheDocument();
    expect(card.querySelector(".nxm-image-collection .nxm-image-fallback")).not.toBeNull();
  });
});
