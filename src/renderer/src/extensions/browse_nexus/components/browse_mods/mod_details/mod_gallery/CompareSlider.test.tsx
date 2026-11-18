import { fireEvent, render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { ModImage } from "@/extensions/nexus_integration/queries/mod/mod.query";

import { CompareSlider } from "./CompareSlider";

// No one is logged in, so an adult mod's pictures are blurred.
vi.mock("react-redux", () => ({ useSelector: () => undefined }));
vi.mock("@/extensions/nexus_integration/selectors", () => ({ userInfo: () => undefined }));

/** A picture in each size the API sends, named for `name`. */
const picture = (name: string): ModImage => ({
  url: `${name}.png`,
  large_thumbnail_url: `${name}-large.png`,
  thumbnail_url: `${name}-thumb.png`,
  blurred_large_thumbnail_url: `${name}-blurred-large.png`,
  blurred_thumbnail_url: `${name}-blurred.png`,
});

const renderSlider = (isAdult = false) => {
  const view = render(
    <CompareSlider after={picture("after")} before={picture("before")} isAdult={isAdult} />,
  );
  const sources = [...view.container.querySelectorAll("img")].map((img) => img.getAttribute("src"));
  const beforeLayer = () => view.getByAltText("Before").closest<HTMLElement>("div")!;

  return { ...view, sources, beforeLayer, slider: view.getByRole("slider") };
};

describe("CompareSlider", () => {
  it("shows the before picture over the after picture as far as the divider, half way at first", () => {
    const { sources, beforeLayer, slider, getByText } = renderSlider();

    expect(sources).toEqual(["after.png", "before.png"]);
    expect(getByText("Before")).toBeInTheDocument();
    expect(getByText("After")).toBeInTheDocument();
    expect(beforeLayer().style.clipPath).toBe("inset(0 50% 0 0)");
    expect(slider).toHaveValue("50");
  });

  it("moves the divider with its range input, named and valued for screen readers", () => {
    const { beforeLayer, slider } = renderSlider();

    fireEvent.change(slider, { target: { value: "30" } });

    expect(beforeLayer().style.clipPath).toBe("inset(0 70% 0 0)");
    expect(slider).toHaveValue("30");
    expect(slider).toHaveAccessibleName("Before and after comparison");
    expect(slider).toHaveAttribute("aria-valuetext");
  });

  it("shows the server's blurred versions of both pictures for an adult mod", () => {
    expect(renderSlider(true).sources).toEqual([
      "after-blurred-large.png",
      "before-blurred-large.png",
    ]);
  });
});
