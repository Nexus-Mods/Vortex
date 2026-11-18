import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import type { IModPropertySection } from "../../hooks/use_mod_properties/useModProperties.hook";
import { ModPropertySection } from "./ModPropertySection";

const section = (layout: IModPropertySection["layout"]): IModPropertySection => ({
  id: "times",
  tab: "general",
  layout,
  properties: [
    { kind: "value", id: "version", label: "Version", value: "1.0" },
    { kind: "value", id: "variant", label: "Variant", value: "Lite" },
  ],
});

describe("ModPropertySection", () => {
  it("draws each of its properties, in order", () => {
    render(<ModPropertySection section={section("list")} />);

    const fields = screen.getAllByTestId(/^mod-property-v/);
    expect(fields.map((field) => field.dataset.testid)).toEqual([
      "mod-property-version",
      "mod-property-variant",
    ]);
  });

  it("lays a grid's out two to a row", () => {
    render(<ModPropertySection section={section("grid")} />);

    expect(screen.getByTestId("mod-property-section-times")).toHaveClass("grid-cols-2");
  });
});
