import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { Image } from "./Image";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const getImg = () => document.querySelector("img");
const getContainer = () => document.querySelector("img")?.parentElement ?? null;

// --- Tests ---

describe("Image", () => {
  describe("rendering", () => {
    it("renders an img with the given src and alt", () => {
      render(<Image alt="A mod" src="mod.png" />);
      const img = screen.getByRole("img", { name: "A mod" });
      expect(img).toHaveAttribute("src", "mod.png");
    });

    it("renders children inside the container", () => {
      render(
        <Image alt="A mod" src="mod.png">
          <span data-testid="badge" />
        </Image>,
      );
      expect(screen.getByTestId("badge")).toBeInTheDocument();
    });
  });

  describe("error fallback", () => {
    it("swaps to a broken-image icon when the image fails to load", () => {
      const { container } = render(<Image alt="A mod" src="bad.png" />);
      fireEvent.error(container.querySelector("img") as Element);
      expect(container.querySelector("img")).toBeNull();
      // the fallback Icon exposes the alt text as its accessible name
      expect(screen.getByRole("img", { name: "A mod" }).tagName).toBe("svg");
    });

    it("calls a caller-provided onError handler", () => {
      const onError = vi.fn();
      const { container } = render(<Image alt="A mod" src="bad.png" onError={onError} />);
      fireEvent.error(container.querySelector("img") as Element);
      expect(onError).toHaveBeenCalledOnce();
    });
  });

  describe("styling", () => {
    it("applies the blur class when isBlurred", () => {
      render(<Image alt="A mod" isBlurred={true} src="mod.png" />);
      expect(getImg()).toHaveClass("blur-xl");
    });

    it('uses object-cover for fit="cover"', () => {
      render(<Image alt="A mod" fit="cover" src="mod.png" />);
      expect(getImg()).toHaveClass("object-cover");
    });

    it('applies the aspect class for imageType="collection"', () => {
      render(<Image alt="A mod" imageType="collection" src="mod.png" />);
      expect(getContainer()).toHaveClass("aspect-collection");
    });

    it("merges className on the container and imageClassName on the img", () => {
      render(<Image alt="A mod" className="my-container" imageClassName="my-img" src="mod.png" />);
      expect(getContainer()).toHaveClass("my-container");
      expect(getImg()).toHaveClass("my-img");
    });
  });
});
