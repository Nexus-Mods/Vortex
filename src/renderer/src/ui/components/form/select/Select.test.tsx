import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { Select } from "./Select";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const getSelect = () => screen.getByRole("combobox");

const options = (
  <>
    <option value="a">Apple</option>
    <option value="b">Banana</option>
  </>
);

// --- Tests ---

describe("Select", () => {
  describe("rendering", () => {
    it("renders a select with the given options", () => {
      render(
        <Select id="fruit" label="Fruit">
          {options}
        </Select>,
      );
      expect(getSelect()).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Apple" })).toBeInTheDocument();
    });

    it("renders its label via FormField", () => {
      render(
        <Select id="fruit" label="Fruit">
          {options}
        </Select>,
      );
      expect(screen.getByText("Fruit")).toBeInTheDocument();
    });

    it("renders the dropdown chevron icon", () => {
      render(
        <Select id="fruit" label="Fruit">
          {options}
        </Select>,
      );
      expect(screen.getByRole("presentation")).toBeInTheDocument();
    });
  });

  describe("interactions", () => {
    it("reflects a controlled value", () => {
      render(
        <Select id="fruit" label="Fruit" value="b" onChange={() => undefined}>
          {options}
        </Select>,
      );
      expect(getSelect()).toHaveValue("b");
    });

    it("calls onChange when a new option is selected", async () => {
      const onChange = vi.fn();
      render(
        <Select id="fruit" label="Fruit" onChange={onChange}>
          {options}
        </Select>,
      );
      await userEvent.selectOptions(getSelect(), "b");
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe("error state", () => {
    it("marks the select invalid and shows the message", () => {
      render(
        <Select errorMessage="Pick one" id="fruit" label="Fruit">
          {options}
        </Select>,
      );
      expect(getSelect()).toHaveAttribute("aria-invalid", "true");
      expect(getSelect()).toHaveAttribute("aria-describedby", "fruit_error");
      expect(screen.getByText("Pick one")).toBeInTheDocument();
    });
  });

  describe("disabled / required", () => {
    it("disables the select", () => {
      render(
        <Select disabled={true} id="fruit" label="Fruit">
          {options}
        </Select>,
      );
      expect(getSelect()).toBeDisabled();
    });

    it("shows the required label when required", () => {
      render(
        <Select id="fruit" label="Fruit" required={true}>
          {options}
        </Select>,
      );
      expect(screen.getByText(/\(Required\)/)).toBeInTheDocument();
    });
  });
});
