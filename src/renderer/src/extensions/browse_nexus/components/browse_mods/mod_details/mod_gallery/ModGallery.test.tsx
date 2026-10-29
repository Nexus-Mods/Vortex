import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { ModGallery } from "./ModGallery";

// The user's adult content setting isn't needed here.
vi.mock("react-redux", () => ({ useSelector: () => undefined }));
vi.mock("@/extensions/nexus_integration/selectors", () => ({ userInfo: () => undefined }));

describe("ModGallery", () => {
  it("shows its picture whole in a 16:9 frame, as the list's cards do", () => {
    const { container } = render(
      <ModGallery images={[{ src: "tall.png", thumbnail: "tall.png" }]} isAdult={false} />,
    );
    const img = container.querySelector("img")!;

    expect(img.closest(".nxm-image")).toHaveClass("nxm-image-mod");
    expect(img).toHaveClass("nxm-image-media-contain");
  });

  it("shows the strip of thumbnails even with only one picture", () => {
    const { getByRole } = render(
      <ModGallery images={[{ src: "farm.png", thumbnail: "farm.png" }]} isAdult={false} />,
    );

    expect(getByRole("toolbar", { name: "Images" })).toBeInTheDocument();
  });

  it("fills the strip to five with still placeholders when the mod has fewer pictures", () => {
    const { container } = render(
      <ModGallery
        images={[
          { src: "a.png", thumbnail: "a.png" },
          { src: "b.png", thumbnail: "b.png" },
        ]}
        isAdult={false}
      />,
    );
    const placeholders = container.querySelectorAll("[data-gallery-placeholder]");

    expect(placeholders).toHaveLength(3);
    expect(placeholders[0]).not.toHaveClass("animate-pulse");
  });

  it("pulses the placeholders while the mod's pictures load", () => {
    const { container } = render(
      <ModGallery images={[{ src: "a.png", thumbnail: "a.png" }]} isAdult={false} isLoading />,
    );
    const placeholders = container.querySelectorAll("[data-gallery-placeholder]");

    expect(placeholders).toHaveLength(4);
    expect(placeholders[0]).toHaveClass("animate-pulse");
  });

  it("keeps the picture's place while loading with nothing to show yet", () => {
    const { container } = render(<ModGallery images={[]} isAdult={false} isLoading />);

    expect(container.querySelectorAll("[data-gallery-placeholder]")).toHaveLength(6);
  });

  it("spins in the picture's place while the mod's pictures load, then shows it", () => {
    const images = [{ src: "farm.png", thumbnail: "farm-thumb.png" }];
    const { container, rerender } = render(
      <ModGallery images={images} isAdult={false} isLoading />,
    );
    const large = () => container.querySelector(".nxm-image");

    expect(large()?.querySelector(".nxm-image-spinner")).toBeInTheDocument();
    expect(large()?.querySelector("img")).not.toHaveAttribute("src");

    rerender(<ModGallery images={images} isAdult={false} />);
    expect(large()?.querySelector("img")).toHaveAttribute("src", "farm.png");
  });

  it("fills a placeholder's slot in place when its picture arrives, so it stays under the tile", () => {
    const thumb = { src: "a.png", thumbnail: "a.png" };
    const { container, rerender } = render(
      <ModGallery images={[thumb]} isAdult={false} isLoading />,
    );
    const slot = container.querySelectorAll("[data-gallery-placeholder]")[0];

    rerender(<ModGallery images={[thumb, { src: "b.png", thumbnail: "b.png" }]} isAdult={false} />);

    expect(slot.isConnected).toBe(true);
    expect(slot.querySelector("button")).toBeInTheDocument();
    expect(slot).not.toHaveClass("animate-pulse");
  });

  it("frames each thumbnail over its slot's background, rather than adding its own", () => {
    const { getByRole } = render(
      <ModGallery images={[{ src: "a.png", thumbnail: "a.png" }]} isAdult={false} />,
    );
    const frame = getByRole("button", { name: /^Image/ }).querySelector(".nxm-image");

    expect(frame).toHaveClass("bg-transparent");
    expect(frame?.querySelector(".nxm-image-frame")).toBeInTheDocument();
  });

  it("fades the thumbnails in one after another, those past the strip with the last", () => {
    const images = Array.from({ length: 7 }, (_, index) => ({
      src: `${index}.png`,
      thumbnail: `${index}-thumb.png`,
    }));
    const { getAllByRole } = render(<ModGallery images={images} isAdult={false} />);
    const thumbnails = getAllByRole("button", { name: /^Image/ });

    expect(thumbnails[0]).toHaveClass("animate-fade-in");
    expect(thumbnails.map((thumbnail) => thumbnail.style.animationDelay)).toEqual([
      "0ms",
      "60ms",
      "120ms",
      "180ms",
      "240ms",
      "240ms",
      "240ms",
    ]);
  });

  it("names its picture by the title its author gave it", () => {
    const { container } = render(
      <ModGallery
        images={[{ src: "farm.png", thumbnail: "farm.png", title: "The farm in spring" }]}
        isAdult={false}
      />,
    );

    expect(container.querySelector("img")).toHaveAttribute("alt", "The farm in spring");
  });
});
