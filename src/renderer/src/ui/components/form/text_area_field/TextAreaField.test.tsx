import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";
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

  it("shows two identical hints, without a duplicate key", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderField({ hints: ["Same", "Same"] });

    expect(descriptions()).toEqual(["Same", "Same"]);
    expect(consoleError).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it("shows (Required) for a required text area, unless showRequiredLabel says not to", () => {
    const { unmount } = renderField({ required: true });
    expect(screen.getByRole("textbox", { name: "Notes (Required)" })).toBeRequired();
    unmount();

    renderField({ required: true, showRequiredLabel: false });
    expect(screen.getByRole("textbox", { name: "Notes" })).toBeRequired();
  });

  it("hides the error on screen but not from screen readers with hideErrors", () => {
    renderField({ errorMessage: "Too long", hideErrors: true });

    expect(screen.getByText("Too long")).toHaveClass("sr-only");
    expect(descriptions()).toEqual(["Too long"]);
  });

  describe("character count", () => {
    const count = () => screen.getByLabelText("remaining character count");

    it("counts down as the user types", async () => {
      renderField({ maxLength: 10 });
      expect(count()).toHaveTextContent("10 / 10");

      await userEvent.type(getTextArea(), "abc");

      expect(count()).toHaveTextContent("7 / 10");
    });

    it("follows a controlled value set from outside", async () => {
      const Controlled = () => {
        const [value, setValue] = useState("abc");

        return (
          <>
            <TextAreaField label="Notes" maxLength={10} value={value} onChange={() => undefined} />
            <button type="button" onClick={() => setValue("")}>
              Clear
            </button>
          </>
        );
      };
      render(<Controlled />);
      expect(count()).toHaveTextContent("7 / 10");

      await userEvent.click(screen.getByText("Clear"));

      expect(count()).toHaveTextContent("10 / 10");
    });
  });

  it("puts className on the text area and fieldClassName on the field", () => {
    renderField({ className: "area-class", fieldClassName: "field-class" });

    expect(getTextArea()).toHaveClass("nxm-textarea", "area-class");
    expect(getTextArea().closest(".nxm-field")).toHaveClass("field-class");
  });

  it("can be disabled", () => {
    renderField({ disabled: true });

    expect(getTextArea()).toBeDisabled();
  });
});
