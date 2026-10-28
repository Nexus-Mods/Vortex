import { render } from "@testing-library/react";
import React from "react";
import { useSelector } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModBackdrop } from "./ModBackdrop";

// react-redux is mocked so the user's adult content preference can be set directly.
vi.mock("react-redux", () => ({ useSelector: vi.fn() }));
vi.mock("@/extensions/nexus_integration/selectors", () => ({ userInfo: () => undefined }));

const setUserInfo = (value: { adultBlurImages?: boolean } | undefined) =>
  (useSelector as unknown as ReturnType<typeof vi.fn>).mockReturnValue(value);

const shown = (container: HTMLElement) => container.querySelector("img")?.getAttribute("src");

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

  it("shows no picture for an adult mod that has no blurred one", () => {
    const { container } = render(<ModBackdrop isAdult src="picture.png" />);

    expect(container.querySelector("img")).toBeNull();
  });
});
