import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { ModPropertyLabel } from "./ModPropertyLabel";

describe("ModPropertyLabel", () => {
  it("lays its value out as the definition of its label", () => {
    render(
      <ModPropertyLabel label="Version" testId="mod-property-version">
        <span data-testid="value">1.0</span>
      </ModPropertyLabel>,
    );

    const field = screen.getByTestId("mod-property-version");
    expect(field.querySelector("dt")).toHaveTextContent("Version");
    expect(field.querySelector("dd")).toContainElement(screen.getByTestId("value"));
  });
});
