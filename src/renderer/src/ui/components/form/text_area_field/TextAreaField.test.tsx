import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { TextAreaField, type ITextAreaFieldProps } from "./TextAreaField";

const renderField = (props: Partial<ITextAreaFieldProps> = {}) =>
  render(<TextAreaField label="Notes" {...props} />);

const getTextArea = () => screen.getByRole<HTMLTextAreaElement>("textbox", { name: /Notes/ });

const getLabel = () => getTextArea().labels[0];

/** The text of every element the text area's aria-describedby points at, in order. */
const descriptions = () =>
  (getTextArea().getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent);

describe("TextAreaField", () => {
  it("names the text area with its label, and focuses it when the label is clicked", async () => {
    renderField();

    await userEvent.click(getLabel());

    expect(getTextArea()).toHaveFocus();
  });

  it("still names the text area when the label is hidden", () => {
    renderField({ hideLabel: true });

    expect(getLabel()).toHaveClass("sr-only");
    expect(getTextArea()).toBeInTheDocument();
  });

  it("is a multi-line text area that reports what is typed", async () => {
    const onChange = vi.fn();
    renderField({ onChange });

    await userEvent.type(getTextArea(), "one{Enter}two");

    expect(getTextArea()).toHaveValue("one\ntwo");
    expect(onChange).toHaveBeenCalled();
  });

  it("marks the text area invalid and reads the error out", () => {
    renderField({ errorMessage: "Too long" });

    expect(getTextArea()).toHaveAttribute("aria-invalid", "true");
    expect(descriptions()).toEqual(["Too long"]);
  });

  it("reads each hint out, in order", () => {
    renderField({ hints: ["First hint", "Second hint"] });

    expect(descriptions()).toEqual(["First hint", "Second hint"]);
  });

  it("can be disabled", () => {
    renderField({ disabled: true });

    expect(getTextArea()).toBeDisabled();
  });
});
