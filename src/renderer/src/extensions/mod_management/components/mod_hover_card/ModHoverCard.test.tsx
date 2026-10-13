import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { describe, expect, it } from "vitest";

import type { IMod } from "../../types/IMod";
import { ModHoverCard } from "./ModHoverCard";

const PICTURE = "https://staticdelivery.nexusmods.com/mods/110/images/1/1-1.png";

const mod = (attributes: object, archiveId = "archive") =>
  ({ id: "a", type: "", state: "installed", archiveId, attributes }) as unknown as IMod;

const renderCard = (attributes: object, archiveId?: string) =>
  render(
    <Provider
      store={createStore(() => ({
        persistent: { downloads: { files: { archive: { size: 12 * 1024 ** 3 } } } },
      }))}
    >
      <ModHoverCard mod={mod(attributes, archiveId)} name="Row name">
        <span>Thumbnail</span>
      </ModHoverCard>
    </Provider>,
  );

const openCard = async () => {
  await userEvent.hover(screen.getByText("Thumbnail"));
  return screen.findByRole("tooltip");
};

describe("ModHoverCard", () => {
  it("shows the mod page's picture, title and description", async () => {
    renderCard({ pictureUrl: PICTURE, modName: "HorsePower", shortDescription: "Horses." });

    const card = await openCard();

    // The thumbnail, wide enough for the card.
    expect(card.querySelector("img")).toHaveAttribute(
      "src",
      "https://staticdelivery.nexusmods.com/mods/110/images/thumbnails/1/1-1.png",
    );
    expect(within(card).getByText("HorsePower")).toBeInTheDocument();
    expect(within(card).getByText("Horses.")).toBeInTheDocument();
  });

  it("takes the row's name for a mod without its page's title", async () => {
    renderCard({ shortDescription: "Horses." });

    expect(within(await openCard()).getByText("Row name")).toBeInTheDocument();
  });

  it("shows the author with their avatar, as they uploaded it, and the archive's size", async () => {
    renderCard({
      shortDescription: "Horses.",
      author: "tsptds",
      uploader: "tsptds",
      uploaderAvatar: "https://avatars.nexusmods.com/1/100",
    });

    const card = await openCard();

    expect(within(card).getByText("tsptds")).toBeInTheDocument();
    expect(card.querySelector('img[src="https://avatars.nexusmods.com/1/100"]')).not.toBeNull();
    expect(within(card).getByText("12.00 GB")).toBeInTheDocument();
  });

  it("leaves out the avatar of an author who didn't upload it, as it's the uploader's", async () => {
    renderCard({
      shortDescription: "Horses.",
      author: "Someone",
      uploader: "tsptds",
      uploaderAvatar: "https://avatars.nexusmods.com/1/100",
    });

    const card = await openCard();

    expect(within(card).getByText("Someone")).toBeInTheDocument();
    expect(card.querySelector("img")).toBeNull();
  });

  it("leaves out the size without its archive", async () => {
    renderCard({ shortDescription: "Horses." }, "removed");

    expect(within(await openCard()).queryByText(/GB/)).toBeNull();
  });

  it("shows no card with neither a picture nor a description", async () => {
    renderCard({ modName: "HorsePower", author: "tsptds" });

    await userEvent.hover(screen.getByText("Thumbnail"));
    await new Promise((resolve) => setTimeout(resolve, 600));

    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
