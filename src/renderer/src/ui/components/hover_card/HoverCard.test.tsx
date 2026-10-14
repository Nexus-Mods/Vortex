import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

// jsdom loads no pictures, so the colour is whatever the picture is called.
vi.mock("@/ui/components/image/useImageColour.hook", () => ({
  useImageColour: (src: string | undefined) => (src ? "rgb(1 2 3)" : undefined),
}));

import { HoverCard } from "./HoverCard";

const renderCard = (props: Partial<React.ComponentProps<typeof HoverCard>> = {}) =>
  render(
    <HoverCard title="Forgotten Dungeons" {...props}>
      <span>Thumbnail</span>
    </HoverCard>,
  );

// The card opens after its delay, which findBy's own wait outlasts.
const openCard = async () => {
  await userEvent.hover(screen.getByText("Thumbnail"));
  return screen.findByRole("tooltip");
};

describe("HoverCard", () => {
  it("shows its title, description and footer on hover", async () => {
    renderCard({ description: "Adds 50 dungeons.", footer: <span>12 GB</span> });

    const card = await openCard();

    expect(within(card).getByText("Forgotten Dungeons")).toBeInTheDocument();
    expect(within(card).getByText("Adds 50 dungeons.")).toBeInTheDocument();
    expect(within(card).getByText("12 GB")).toBeInTheDocument();
  });

  it("shows its picture, the card and its beak tinted in its colour", async () => {
    renderCard({ image: "https://example.com/a.png" });

    const card = await openCard();

    expect(card.querySelector("img")).toHaveAttribute("src", "https://example.com/a.png");
    expect(card.querySelector(".nxm-hover-card-tooltip")).toHaveStyle({
      "--nxm-hover-card-tint": "rgb(1 2 3)",
    });
    expect(card.querySelector(".nxm-hover-card-tooltip .nxm-overlay-arrow")).not.toBeNull();
  });

  it("shows the fallback icon, untinted, without a picture", async () => {
    renderCard({ description: "Adds 50 dungeons." });

    const card = await openCard();

    expect(card.querySelector("img")).toBeNull();
    expect(card.querySelector(".nxm-image-fallback")).not.toBeNull();
    expect(
      card
        .querySelector<HTMLElement>(".nxm-hover-card-tooltip")
        ?.style.getPropertyValue("--nxm-hover-card-tint"),
    ).toBe("");
  });

  it("shows nothing while disabled", async () => {
    renderCard({ disabled: true });

    await userEvent.hover(screen.getByText("Thumbnail"));
    await new Promise((resolve) => setTimeout(resolve, 600));

    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("lays a collection's card out wider, its cover beside its title", async () => {
    renderCard({
      description: "Most endorsed.",
      image: "https://example.com/cover.png",
      imageType: "collection",
    });

    const card = await openCard();
    const body = card.querySelector(".nxm-hover-card");

    expect(body).toHaveClass("nxm-hover-card-collection");
    expect(body?.querySelector(".nxm-image-collection")?.nextElementSibling).toHaveTextContent(
      "Forgotten Dungeons",
    );
  });
});
