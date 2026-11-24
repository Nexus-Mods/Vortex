import { fireEvent, render } from "@testing-library/react";
import React from "react";
import { useSelector } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModBackdrop } from "./ModBackdrop";

// react-redux is mocked so the user's adult content preference can be set directly.
vi.mock("react-redux", () => ({ useSelector: vi.fn() }));
vi.mock("@/extensions/nexus_integration/selectors", () => ({ userInfo: () => undefined }));

const setUserInfo = (value: { adultBlurImages?: boolean } | undefined) =>
  (useSelector as unknown as ReturnType<typeof vi.fn>).mockReturnValue(value);

/** The pictures stacked in the backdrop, bottom first. */
const pictures = (container: HTMLElement) => [...container.querySelectorAll("img")];

/** The picture on top, the one the backdrop is showing or fading in. */
const shown = (container: HTMLElement) => pictures(container).at(-1)?.getAttribute("src");

describe("ModBackdrop", () => {
  beforeEach(() => {
    setUserInfo(undefined);
  });

  it("shows the picture of a mod that isn't adult", () => {
    const { container } = render(
      <ModBackdrop blurredSrc="blurred.png" isAdult={false} src="picture.png" />,
    );

    expect(shown(container)).toBe("picture.png");
  });

  it("shows an adult mod's blurred picture to someone logged out", () => {
    const { container } = render(
      <ModBackdrop isAdult blurredSrc="blurred.png" src="picture.png" />,
    );

    expect(shown(container)).toBe("blurred.png");
  });

  it("shows an adult mod's picture to someone who's opted into seeing it", () => {
    setUserInfo({ adultBlurImages: false });

    const { container } = render(
      <ModBackdrop isAdult blurredSrc="blurred.png" src="picture.png" />,
    );

    expect(shown(container)).toBe("picture.png");
  });

  it("fades a new picture in over the last once it's loaded, then lets the last go", () => {
    const { container, rerender } = render(<ModBackdrop isAdult={false} src="a.png" />);
    fireEvent.load(pictures(container)[0]);

    rerender(<ModBackdrop isAdult={false} src="b.png" />);
    const [last, next] = pictures(container);

    expect(last).toHaveAttribute("src", "a.png");
    expect(next).toHaveAttribute("src", "b.png");
    expect(next).toHaveClass("opacity-0");

    fireEvent.load(next);
    expect(next).not.toHaveClass("opacity-0");

    fireEvent.transitionEnd(next);
    expect(pictures(container).map((picture) => picture.getAttribute("src"))).toEqual(["b.png"]);
  });

  it("fades a picture in afresh when it comes back", () => {
    const { container, rerender } = render(<ModBackdrop isAdult={false} src="a.png" />);
    fireEvent.load(pictures(container)[0]);
    rerender(<ModBackdrop isAdult={false} src="b.png" />);

    rerender(<ModBackdrop isAdult={false} src="a.png" />);

    expect(pictures(container).map((picture) => picture.getAttribute("src"))).toEqual([
      "a.png",
      "b.png",
      "a.png",
    ]);
    expect(pictures(container).at(-1)).toHaveClass("opacity-0");
  });

  it("shows no picture for an adult mod that has no blurred one", () => {
    const { container } = render(<ModBackdrop isAdult src="picture.png" />);

    expect(container.querySelector("img")).toBeNull();
  });
});
