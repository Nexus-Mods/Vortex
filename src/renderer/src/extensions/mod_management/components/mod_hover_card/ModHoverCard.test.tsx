import { fireEvent, render, screen, within } from "@testing-library/react";
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
      <ModHoverCard mod={mod(attributes, archiveId)} name="Row name" />
    </Provider>,
  );

// The mod's thumbnail, which the card renders as its trigger.
const thumbnail = () => document.querySelector<HTMLElement>(".nxm-image-mod")!;

const openCard = async () => {
  await userEvent.hover(thumbnail());
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

  it("shows the fallback icon for an author who didn't upload it, as the avatar is the uploader's", async () => {
    renderCard({
      shortDescription: "Horses.",
      author: "Someone",
      uploader: "tsptds",
      uploaderAvatar: "https://avatars.nexusmods.com/1/100",
    });

    const card = await openCard();

    expect(within(card).getByText("Someone")).toBeInTheDocument();
    expect(card.querySelector("img")).toBeNull();
    expect(card.querySelector(".nxm-image-avatar .nxm-image-fallback")).not.toBeNull();
  });

  it("leaves out the size without its archive", async () => {
    renderCard({ shortDescription: "Horses." }, "removed");

    expect(within(await openCard()).queryByText(/GB/)).toBeNull();
  });

  it("shows a card for a mod with neither a picture nor a description, the icon in its place", async () => {
    renderCard({ modName: "HorsePower", author: "tsptds" });

    const card = await openCard();

    expect(within(card).getByText("HorsePower")).toBeInTheDocument();
    expect(card.querySelector(".nxm-image-mod .nxm-image-fallback")).not.toBeNull();
  });

  describe("its thumbnail", () => {
    const img = () => thumbnail().querySelector("img");
    const fallback = () => thumbnail().querySelector(".nxm-image-fallback");

    it("shows the picture's thumbnail", () => {
      renderCard({ pictureUrl: PICTURE });

      expect(img()).toHaveAttribute(
        "src",
        "https://staticdelivery.nexusmods.com/mods/110/images/thumbnails/1/1-1.png",
      );
    });

    it("shows the fallback icon, not the full picture, when the thumbnail fails", () => {
      renderCard({ pictureUrl: PICTURE });

      fireEvent.error(img()!);

      expect(img()).toBeNull();
      expect(fallback()).not.toBeNull();
    });

    it("shows the fallback icon for a picture without a thumbnail, or no picture", () => {
      const { unmount } = renderCard({ pictureUrl: "https://media.nexusmods.com/4/2/42f2.webp" });
      expect(fallback()).not.toBeNull();
      unmount();

      renderCard({});
      expect(fallback()).not.toBeNull();
    });
  });
});
