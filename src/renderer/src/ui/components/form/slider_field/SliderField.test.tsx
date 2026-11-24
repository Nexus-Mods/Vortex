import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { SliderField, type ISliderFieldProps } from "./SliderField";

const renderField = (props: Partial<ISliderFieldProps> = {}) =>
  render(<SliderField label="Volume" max={10} min={0} value={3} onChange={vi.fn()} {...props} />);

const getSlider = () => screen.getByRole("slider", { name: "Volume" });

describe("SliderField", () => {
  it("names the slider and gives it its range and value", () => {
    renderField();

    expect(getSlider()).toHaveAttribute("min", "0");
    expect(getSlider()).toHaveAttribute("max", "10");
    expect(getSlider()).toHaveValue("3");
  });

  it("still names the slider when the label is hidden", () => {
    renderField({ hideLabel: true });

    expect(getSlider()).toBeInTheDocument();
    expect(screen.getByText("Volume")).toHaveClass("sr-only");
  });

  it("reports the new value as a number", () => {
    const onChange = vi.fn();
    renderField({ onChange });

    fireEvent.change(getSlider(), { target: { value: "7" } });

    expect(onChange).toHaveBeenCalledWith(7);
  });

  it("shows the value in words and reads it out in place of the number", () => {
    renderField({ valueText: "Quiet" });

    expect(screen.getByText("Quiet")).toBeInTheDocument();
    expect(getSlider()).toHaveAttribute("aria-valuetext", "Quiet");
  });

  it("describes the slider with its hints", () => {
    renderField({ hints: "Applies to every game." });

    const describedBy = getSlider().getAttribute("aria-describedby") ?? "";
    const texts = describedBy.split(" ").map((id) => document.getElementById(id)?.textContent);
    expect(texts).toContain("Applies to every game.");
  });

  it("can be disabled", () => {
    renderField({ disabled: true });

    expect(getSlider()).toBeDisabled();
  });
});
