import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { type IGalleryImage, ModGallery } from "./ModGallery";

// The user's adult content setting isn't needed here.
vi.mock("react-redux", () => ({ useSelector: () => undefined }));
vi.mock("@/extensions/nexus_integration/selectors", () => ({ userInfo: () => undefined }));

/** A picture in each size the API sends, named for `name`. */
const picture = (name: string, title?: string): IGalleryImage => ({
  url: `${name}.png`,
  large_thumbnail_url: `${name}-large.png`,
  thumbnail_url: `${name}-thumb.png`,
  blurred_large_thumbnail_url: `${name}-blurred-large.png`,
  blurred_thumbnail_url: `${name}-blurred.png`,
  title,
});

describe("ModGallery", () => {
  it("shows its picture whole in a 16:9 frame, as the list's cards do", () => {
    const { container } = render(<ModGallery images={[picture("tall")]} isAdult={false} />);
    const img = container.querySelector("img")!;

    expect(img.closest(".nxm-image")).toHaveClass("nxm-image-mod");
    expect(img).toHaveClass("nxm-image-media-contain");
  });

  it("shows the strip of thumbnails even with only one picture", () => {
    const { getByRole } = render(<ModGallery images={[picture("farm")]} isAdult={false} />);

    expect(getByRole("toolbar", { name: "Images" })).toBeInTheDocument();
  });

  it("fills the strip to five with still placeholders when the mod has fewer pictures", () => {
    const { container } = render(
      <ModGallery images={[picture("a"), picture("b")]} isAdult={false} />,
    );
    const placeholders = container.querySelectorAll("[data-gallery-placeholder]");

    expect(placeholders).toHaveLength(3);
    expect(placeholders[0]).not.toHaveClass("animate-pulse");
  });

  it("pulses the placeholders while the mod's pictures load", () => {
    const { container } = render(<ModGallery images={[picture("a")]} isAdult={false} isLoading />);
    const placeholders = container.querySelectorAll("[data-gallery-placeholder]");

    expect(placeholders).toHaveLength(4);
    expect(placeholders[0]).toHaveClass("animate-pulse");
  });

  it("keeps the picture's place while loading with nothing to show yet", () => {
    const { container } = render(<ModGallery images={[]} isAdult={false} isLoading />);

    expect(container.querySelectorAll("[data-gallery-placeholder]")).toHaveLength(6);
  });

  it("spins in the picture's place while the mod's pictures load, then shows it", () => {
    const images = [picture("farm")];
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
    const thumb = picture("a");
    const { container, rerender } = render(
      <ModGallery images={[thumb]} isAdult={false} isLoading />,
    );
    const slot = container.querySelectorAll("[data-gallery-placeholder]")[0];

    rerender(<ModGallery images={[thumb, picture("b")]} isAdult={false} />);

    expect(slot.isConnected).toBe(true);
    expect(slot.querySelector("button")).toBeInTheDocument();
    expect(slot).not.toHaveClass("animate-pulse");
  });

  it("frames each thumbnail over its slot's background, rather than adding its own", () => {
    const { getByRole } = render(<ModGallery images={[picture("a")]} isAdult={false} />);
    const frame = getByRole("button", { name: /^Image/ }).querySelector(".nxm-image");

    expect(frame).toHaveClass("bg-transparent");
    expect(frame?.querySelector(".nxm-image-frame")).toBeInTheDocument();
  });

  it("fades the thumbnails in one after another, those past the strip with the last", () => {
    const images = Array.from({ length: 7 }, (_, index) => picture(`${index}`));
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

  it("shows the server's blurred pictures for an adult mod, blurring them no further", () => {
    const images = [picture("a"), picture("b")];
    const { container, rerender } = render(<ModGallery isAdult images={images} />);
    const sources = () =>
      [...container.querySelectorAll("img")].map((img) => img.getAttribute("src"));

    expect(sources()).toEqual(["a-blurred-large.png", "a-blurred.png", "b-blurred.png"]);
    expect(container.querySelector(".nxm-image-media-blurred")).not.toBeInTheDocument();

    rerender(<ModGallery images={images} isAdult={false} />);

    expect(sources()).toEqual(["a.png", "a-thumb.png", "b-thumb.png"]);
  });

  it("names its picture by the title its author gave it", () => {
    const { container } = render(
      <ModGallery images={[picture("farm", "The farm in spring")]} isAdult={false} />,
    );

    expect(container.querySelector("img")).toHaveAttribute("alt", "The farm in spring");
  });
});
