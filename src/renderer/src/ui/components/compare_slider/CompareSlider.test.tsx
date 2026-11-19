import { fireEvent, render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { CompareSlider, type ICompareSliderPicture } from "./CompareSlider";

// No one is logged in, so an adult mod's pictures are blurred.
vi.mock("react-redux", () => ({ useSelector: () => undefined }));
vi.mock("@/extensions/nexus_integration/selectors", () => ({ userInfo: () => undefined }));

/** A picture named for `name`, with the server's blurred version. */
const picture = (name: string): ICompareSliderPicture => ({
  src: `${name}.png`,
  blurredSrc: `${name}-blurred-large.png`,
});

const renderSlider = (isAdult = false) => {
  const view = render(
    <CompareSlider after={picture("after")} before={picture("before")} isAdult={isAdult} />,
  );
  const sources = [...view.container.querySelectorAll("img")].map((img) => img.getAttribute("src"));
  const beforeLayer = () => view.getByTestId("compare-slider-before");
  const afterLayer = () => view.getByTestId("compare-slider-after");

  return { ...view, sources, beforeLayer, afterLayer, slider: view.getByRole("slider") };
};

describe("CompareSlider", () => {
  it("shows each picture on its own side of the divider, so neither shows through, half way at first", () => {
    const { sources, beforeLayer, afterLayer, slider, getByTestId } = renderSlider();

    expect(sources).toEqual(["after.png", "before.png"]);
    expect(getByTestId("compare-slider-before-label")).toBeInTheDocument();
    expect(getByTestId("compare-slider-after-label")).toBeInTheDocument();
    expect(beforeLayer().style.clipPath).toBe("inset(0 50% 0 0)");
    expect(afterLayer().style.clipPath).toBe("inset(0 0 0 50%)");
    expect(slider).toHaveValue("50");
  });

  it("moves the divider with its range input, named and valued for screen readers", () => {
    const { beforeLayer, afterLayer, slider } = renderSlider();

    fireEvent.change(slider, { target: { value: "30" } });

    expect(beforeLayer().style.clipPath).toBe("inset(0 70% 0 0)");
    expect(afterLayer().style.clipPath).toBe("inset(0 0 0 30%)");
    expect(slider).toHaveValue("30");
    expect(slider).toHaveAccessibleName();
    expect(slider).toHaveAttribute("aria-valuetext");
  });

  it("shows the server's blurred versions of both pictures for an adult mod", () => {
    expect(renderSlider(true).sources).toEqual([
      "after-blurred-large.png",
      "before-blurred-large.png",
    ]);
  });
});
