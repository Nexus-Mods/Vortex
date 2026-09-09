import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";

import { Image } from "./Image";

// --- Helpers ---

const renderComponent = (props: Partial<React.ComponentProps<typeof Image>> = {}) => {
  const onError = vi.fn();

  const { rerender } = render(<Image alt="A mod" src="mod.png" onError={onError} {...props} />);

  return { onError, rerender };
};

const getImg = () => document.querySelector("img");
const getContainer = () => getImg()?.parentElement ?? null;
const getSpinner = () => document.querySelector(".nxm-image-spinner");

afterEach(() => {
  vi.restoreAllMocks();
});

// --- Tests ---

describe("Image", () => {
  describe("rendering", () => {
    it("renders an img with the given src and alt", () => {
      renderComponent();
      expect(screen.getByRole("img", { name: "A mod" })).toHaveAttribute("src", "mod.png");
    });

    it("renders children inside the container", () => {
      renderComponent({ children: <span data-testid="badge" /> });
      expect(screen.getByTestId("badge")).toBeInTheDocument();
    });
  });

  describe("loading", () => {
    it("shows a spinner while the image is still coming", () => {
      renderComponent();
      expect(getSpinner()).toBeInTheDocument();
    });

    it("holds the image back until it has loaded", () => {
      renderComponent();
      expect(getImg()).toHaveClass("nxm-image-media-pending");
    });

    it("fades the image in and drops the spinner once it loads", () => {
      renderComponent();
      fireEvent.load(getImg() as Element);

      expect(getImg()).not.toHaveClass("nxm-image-media-pending");
      expect(getSpinner()).not.toBeInTheDocument();
    });

    it("passes a caller's onLoad through", () => {
      const onLoad = vi.fn();
      renderComponent({ onLoad });

      fireEvent.load(getImg() as Element);

      expect(onLoad).toHaveBeenCalledOnce();
    });

    it("waits for nothing when there is no src", () => {
      renderComponent({ src: undefined });
      expect(getSpinner()).not.toBeInTheDocument();
    });

    it("drops the spinner when the image fails instead of spinning forever", () => {
      renderComponent({ src: "bad.png" });
      fireEvent.error(getImg() as Element);

      expect(getSpinner()).not.toBeInTheDocument();
    });

    it("waits again when pointed at a different image", () => {
      const { rerender } = renderComponent();
      fireEvent.load(getImg() as Element);
      expect(getImg()).not.toHaveClass("nxm-image-media-pending");

      rerender(<Image alt="A mod" src="other.png" />);

      expect(getImg()).toHaveClass("nxm-image-media-pending");
      expect(getSpinner()).toBeInTheDocument();
    });

    it("waits when the caller says a source is on its way", () => {
      // With no src there is nothing here to wait on, so only the caller knows.
      renderComponent({ isLoading: true, src: undefined });
      expect(getSpinner()).toBeInTheDocument();
    });

    it("stops waiting once a caller-declared source has loaded", () => {
      const { rerender } = renderComponent({ isLoading: true, src: undefined });
      expect(getSpinner()).toBeInTheDocument();

      rerender(<Image alt="A mod" src="mod.png" />);
      fireEvent.load(getImg() as Element);

      expect(getSpinner()).not.toBeInTheDocument();
    });

    it("gives up rather than spinning on when a declared source fails", () => {
      renderComponent({ isLoading: true, src: "bad.png" });
      fireEvent.error(getImg() as Element);

      expect(getSpinner()).not.toBeInTheDocument();
    });

    // A cached image can be `complete` before React attaches onLoad, and that load event
    // is then never seen — without this the image would stay faded out for good.
    it("settles an image that was already complete when it mounted", () => {
      vi.spyOn(window.HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
      vi.spyOn(window.HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(64);

      renderComponent();

      expect(getImg()).not.toHaveClass("nxm-image-media-pending");
      expect(getSpinner()).not.toBeInTheDocument();
    });
  });

  describe("error fallback", () => {
    it("swaps to a broken-image icon when the image fails to load", () => {
      renderComponent({ src: "bad.png" });
      fireEvent.error(getImg() as Element);
      expect(getImg()).toBeNull();
      // the fallback Icon exposes the alt text as its accessible name
      expect(screen.getByRole("img", { name: "A mod" }).tagName).toBe("svg");
    });

    it("calls a caller-provided onError handler", () => {
      const { onError } = renderComponent({ src: "bad.png" });
      fireEvent.error(getImg() as Element);
      expect(onError).toHaveBeenCalledOnce();
    });
  });

  describe("styling", () => {
    it("applies the blur class when isBlurred", () => {
      renderComponent({ isBlurred: true });
      expect(getImg()).toHaveClass("nxm-image-media-blurred");
    });

    it('fills the frame for fit="cover"', () => {
      renderComponent({ fit: "cover" });
      expect(getImg()).toHaveClass("nxm-image-media-cover");
    });

    it('applies the aspect class for imageType="collection"', () => {
      renderComponent({ imageType: "collection" });
      expect(getContainer()).toHaveClass("nxm-image-collection");
    });

    it('applies the aspect class for imageType="game"', () => {
      renderComponent({ imageType: "game" });
      expect(getContainer()).toHaveClass("nxm-image-game");
    });

    it("merges className on the container and imageClassName on the img", () => {
      renderComponent({ className: "my-container", imageClassName: "my-img" });
      expect(getContainer()).toHaveClass("my-container");
      expect(getImg()).toHaveClass("my-img");
    });
  });
});
