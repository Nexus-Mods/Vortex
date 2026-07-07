import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { describe, it, expect, afterEach } from "vitest";

import { FormField } from "./FormField";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

// the FormField root always carries the min-w-0 utility
const getRoot = () => document.querySelector(".min-w-0");

// --- Tests ---

describe("FormField", () => {
  describe("label", () => {
    it("renders the label text", () => {
      render(<FormField label="Username" />);
      expect(screen.getByText("Username")).toBeInTheDocument();
    });

    it("visually hides the label with sr-only when hideLabel", () => {
      render(<FormField hideLabel={true} label="Username" />);
      expect(document.querySelector("label")).toHaveClass("sr-only");
    });

    it("renders the required hint when showRequiredLabel", () => {
      render(<FormField label="Username" showRequiredLabel={true} />);
      expect(screen.getByText(/\(Required\)/)).toBeInTheDocument();
    });
  });

  describe("children", () => {
    it("renders the field children", () => {
      render(
        <FormField label="Username">
          <input data-testid="field" />
        </FormField>,
      );
      expect(screen.getByTestId("field")).toBeInTheDocument();
    });
  });

  describe("errors", () => {
    it("renders an error message with the derived id", () => {
      render(<FormField errorMessage="Required field" id="username" label="Username" />);
      const error = screen.getByText("Required field");
      expect(error).toBeInTheDocument();
      expect(error).toHaveAttribute("id", "username_error");
    });

    it("hides the error when hideErrors", () => {
      render(<FormField errorMessage="Required field" hideErrors={true} label="Username" />);
      expect(screen.queryByText("Required field")).not.toBeInTheDocument();
    });
  });

  describe("hints", () => {
    it("renders a single hint string", () => {
      render(<FormField hints="Helpful hint" label="Username" />);
      expect(screen.getByText("Helpful hint")).toBeInTheDocument();
    });

    it("renders multiple hints as list items", () => {
      render(<FormField hints={["First", "Second"]} label="Username" />);
      expect(screen.getByText("First")).toBeInTheDocument();
      expect(screen.getByText("Second")).toBeInTheDocument();
    });
  });

  describe("character counter", () => {
    it("shows remaining characters out of the max", () => {
      render(<FormField inputLength={4} label="Username" maxLength={10} />);
      expect(screen.getByLabelText("remaining character count")).toHaveTextContent("6 / 10");
    });
  });

  describe("disabled", () => {
    it("makes the container non-interactive", () => {
      render(<FormField disabled={true} label="Username" />);
      expect(getRoot()).toHaveClass("pointer-events-none", "opacity-40");
    });
  });

  it("merges a custom className on the container", () => {
    render(<FormField className="my-class" label="Username" />);
    expect(getRoot()).toHaveClass("min-w-0", "my-class");
  });
});
