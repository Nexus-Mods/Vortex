import { fireEvent, render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { ProseImage } from "./ProseImage";

// The user's adult content setting is unknown, so adult images blur, as they do logged out.
vi.mock("react-redux", () => ({ useSelector: () => undefined }));
vi.mock("@/extensions/nexus_integration/selectors", () => ({ userInfo: () => undefined }));

const NEXUS = "https://staticdelivery.nexusmods.com/mods/1704/images/a.png";

const image = (container: HTMLElement) => container.querySelector("img");

describe("ProseImage", () => {
  it("shows an image from Nexus Mods, lazily and without a referrer", () => {
    const { container } = render(<ProseImage alt="A" src={NEXUS} />);

    expect(image(container)).toHaveAttribute("src", NEXUS);
    expect(image(container)).toHaveAttribute("alt", "A");
    expect(image(container)).toHaveAttribute("loading", "lazy");
    expect(image(container)).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(image(container)).not.toHaveClass("nxm-image-media-blurred");
    expect(container.querySelector(".nxm-image")).not.toHaveClass("nxm-image-styled");
  });

  it("shows nothing for an image from elsewhere", () => {
    const { container } = render(<ProseImage src="file:///C:/a.png" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows an https image from any site when allowed, as for content we trust", () => {
    const github = "https://github.com/user-attachments/assets/a.png";
    const { container } = render(<ProseImage allowAnyDomain src={github} />);

    expect(image(container)).toHaveAttribute("src", github);
    expect(image(container)).toHaveAttribute("loading", "lazy");
  });

  it("still shows nothing for an http image, when any domain is allowed", () => {
    const { container } = render(<ProseImage allowAnyDomain src="http://example.com/a.png" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("still shows nothing for an image that isn't on the web, when any domain is allowed", () => {
    const { container } = render(<ProseImage allowAnyDomain src="file:///C:/a.png" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("blurs an adult image", () => {
    const { container } = render(<ProseImage isFromAdultContent src={NEXUS} />);

    expect(image(container)).toHaveClass("nxm-image-media-blurred");
  });

  it("takes the image's own size once it loads", () => {
    const { container } = render(<ProseImage src={NEXUS} />);
    const img = image(container)!;
    Object.defineProperty(img, "naturalWidth", { value: 640 });
    Object.defineProperty(img, "naturalHeight", { value: 360 });

    fireEvent.load(img);

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.getPropertyValue("--prose-image-width")).toBe("640px");
    expect(wrapper.style.getPropertyValue("--prose-image-ratio")).toBe(`${640 / 360}`);
  });

  it("takes the size it's given, capped, and never wider than the text", () => {
    const { container } = render(<ProseImage height={2000} src={NEXUS} width={9000} />);

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.getPropertyValue("--prose-image-width")).toBe("3600px");
    expect(wrapper.style.getPropertyValue("--prose-image-ratio")).toBe(`${3600 / 2000}`);
    expect(container.querySelector(".nxm-image")).toHaveClass("max-w-full");
  });

  it("sits in the text, unless it's put on a side", () => {
    const { container, rerender } = render(<ProseImage src={NEXUS} />);
    expect(container.firstElementChild).not.toHaveClass("block");

    rerender(<ProseImage align="right" src={NEXUS} />);
    expect(container.firstElementChild).toHaveClass("block", "text-right");
  });
});
