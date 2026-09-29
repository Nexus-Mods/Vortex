import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect } from "vitest";

import { CharacterCount } from "./CharacterCount";

const count = () => screen.getByLabelText("remaining character count");

describe("CharacterCount", () => {
  it("shows the characters left out of the max", () => {
    render(<CharacterCount length={4} maxLength={20} />);
    expect(count()).toHaveTextContent("16 / 20");
    expect(count()).toHaveClass("nxm-field-character-count");
    expect(count()).not.toHaveClass(
      "nxm-field-character-count-warning",
      "nxm-field-character-count-danger",
    );
  });

  it("warns with a quarter left", () => {
    render(<CharacterCount length={15} maxLength={20} />);
    expect(count()).toHaveClass("nxm-field-character-count-warning");
    expect(count()).not.toHaveClass("nxm-field-character-count-danger");
  });

  it("turns to danger with a tenth left", () => {
    render(<CharacterCount length={18} maxLength={20} />);
    expect(count()).toHaveClass("nxm-field-character-count-danger");
    expect(count()).not.toHaveClass("nxm-field-character-count-warning");
  });
});
