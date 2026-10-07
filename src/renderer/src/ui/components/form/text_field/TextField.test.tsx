import { mdiMagnify } from "@mdi/js";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";
import { describe, it, expect, vi } from "vitest";

import { TextField, type ITextFieldProps } from "./TextField";

const renderField = (props: Partial<ITextFieldProps> = {}) =>
  render(<TextField label="Name" {...props} />);

const getInput = () => screen.getByRole("textbox", { name: /Name/ });

/** The text of every element the input's aria-describedby points at, in order. */
const descriptions = () =>
  (getInput().getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent);

describe("TextField", () => {
  describe("label", () => {
    it("names the input, and focuses it when clicked", async () => {
      renderField();

      await userEvent.click(screen.getByText("Name"));

      expect(getInput()).toHaveFocus();
    });

    it("still names the input when hidden", () => {
      renderField({ hideLabel: true });
      expect(screen.getByText("Name")).toHaveClass("sr-only");
      expect(getInput()).toBeInTheDocument();
    });

    it("shows (Required) for a required input", () => {
      renderField({ required: true });
      expect(screen.getByRole("textbox", { name: "Name (Required)" })).toBeRequired();
    });

    it("lets showRequiredLabel override required", () => {
      renderField({ required: true, showRequiredLabel: false });
      expect(screen.getByRole("textbox", { name: "Name" })).toBeRequired();
    });
  });

  describe("hints and errors", () => {
    it("describes the input with its hints", () => {
      renderField({ hints: ["First", "Second"] });
      expect(descriptions()).toEqual(["First", "Second"]);
    });

    it("marks the input invalid and describes it with the error first", () => {
      renderField({ errorMessage: "Too short", hints: "A hint" });
      expect(getInput()).toHaveAttribute("aria-invalid", "true");
      expect(descriptions()).toEqual(["Too short", "A hint"]);
    });

    it("hides the error on screen but not from screen readers with hideErrors", () => {
      renderField({ errorMessage: "Too short", hideErrors: true });
      expect(screen.getByText("Too short")).toHaveClass("sr-only");
      expect(descriptions()).toEqual(["Too short"]);
    });
  });

  describe("character count", () => {
    const count = () => screen.getByLabelText("remaining character count");

    it("counts down as the user types", async () => {
      renderField({ maxLength: 10 });
      expect(count()).toHaveTextContent("10 / 10");

      await userEvent.type(getInput(), "abc");

      expect(count()).toHaveTextContent("7 / 10");
    });

    it("follows a controlled value set from outside", async () => {
      const Controlled = () => {
        const [value, setValue] = useState("abc");

        return (
          <>
            <TextField label="Name" maxLength={10} value={value} onChange={() => undefined} />
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

    it("isn't one of the input's descriptions", () => {
      renderField({ maxLength: 10 });
      expect(getInput()).not.toHaveAttribute("aria-describedby");
    });
  });

  it("disables the input and marks the label disabled", () => {
    renderField({ disabled: true });
    expect(getInput()).toBeDisabled();
    expect(screen.getByText("Name")).toHaveAttribute("data-disabled");
  });

  it("passes the change event through", async () => {
    const onChange = vi.fn();
    renderField({ onChange });

    await userEvent.type(getInput(), "a");

    expect(onChange.mock.calls[0][0].target.value).toBe("a");
  });

  it("puts className on the input and fieldClassName on the field", () => {
    renderField({ className: "input-class", fieldClassName: "field-class" });
    expect(getInput()).toHaveClass("nxm-input", "input-class");
    expect(getInput().closest(".nxm-field")).toHaveClass("field-class");
  });

  it("wraps the input in a container, with no icon unless given one", () => {
    renderField();
    expect(getInput().parentElement).toHaveClass("nxm-field-control");
    expect(document.querySelector(".nxm-input-icon")).toBeNull();
  });

  it("draws leftIconPath in the container, before the input", () => {
    renderField({ leftIconPath: mdiMagnify });
    expect(getInput().previousElementSibling).toHaveClass("nxm-input-icon");
  });
});
