import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { Image } from "./Image";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const renderComponent = (props: Partial<React.ComponentProps<typeof Image>> = {}) => {
  const onError = vi.fn();

  render(<Image alt="A mod" src="mod.png" onError={onError} {...props} />);

  return { onError };
};

const getImg = () => document.querySelector("img");
const getContainer = () => getImg()?.parentElement ?? null;

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
      expect(getImg()).toHaveClass("blur-xl");
    });

    it('uses object-cover for fit="cover"', () => {
      renderComponent({ fit: "cover" });
      expect(getImg()).toHaveClass("object-cover");
    });

    it('applies the aspect class for imageType="collection"', () => {
      renderComponent({ imageType: "collection" });
      expect(getContainer()).toHaveClass("aspect-collection");
    });

    it("merges className on the container and imageClassName on the img", () => {
      renderComponent({ className: "my-container", imageClassName: "my-img" });
      expect(getContainer()).toHaveClass("my-container");
      expect(getImg()).toHaveClass("my-img");
    });
  });
});
