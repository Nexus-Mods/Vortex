import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect } from "vitest";

import { CharacterCount } from "./CharacterCount";

const count = () => screen.getByLabelText("remaining character count");

describe("CharacterCount", () => {
  it("hides the count while more than half are left", () => {
    render(<CharacterCount length={9} maxLength={20} />);
    expect(count()).toHaveClass("nxm-field-character-count-hidden");
  });

  it("shows the characters left out of the max once half are left", () => {
    render(<CharacterCount length={10} maxLength={20} />);
    expect(count()).toHaveTextContent("10 / 20");
    expect(count()).toHaveClass("nxm-field-character-count");
    expect(count()).not.toHaveClass(
      "nxm-field-character-count-hidden",
      "nxm-field-character-count-warning",
      "nxm-field-character-count-danger",
    );
  });

  it("warns with a quarter left", () => {
    render(<CharacterCount length={15} maxLength={20} />);
    expect(count()).toHaveClass("nxm-field-character-count-warning");
    expect(count()).not.toHaveClass("nxm-field-character-count-danger");
  });

  it("counts none left, not below, for a value over the max", () => {
    render(<CharacterCount length={28} maxLength={20} />);
    expect(count()).toHaveTextContent("0 / 20");
    expect(count()).toHaveClass("nxm-field-character-count-danger");
  });

  it("turns to danger with a tenth left", () => {
    render(<CharacterCount length={18} maxLength={20} />);
    expect(count()).toHaveClass("nxm-field-character-count-danger");
    expect(count()).not.toHaveClass("nxm-field-character-count-warning");
  });
});
