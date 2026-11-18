import { describe, expect, it } from "vitest";

import type { ITableAttribute } from "@/types/ITableAttribute";

import { isShownAsRegistered } from "./shownAsRegistered";

const attribute = (fields: Partial<ITableAttribute>) =>
  ({ id: "extra", name: "Extra", placement: "detail", edit: {}, ...fields }) as ITableAttribute;

describe("isShownAsRegistered", () => {
  it("draws a field with a value or a renderer of its own", () => {
    expect(isShownAsRegistered(attribute({ calc: () => "" }))).toBe(true);
    expect(isShownAsRegistered(attribute({ customRenderer: () => null }))).toBe(true);
  });

  it("leaves out a field with nothing to draw it by", () => {
    expect(isShownAsRegistered(attribute({}))).toBe(false);
  });

  // Category is drawn as the panel's own field, from the mod, not from its registered value.
  it("leaves out a field the panel shows as its own", () => {
    expect(isShownAsRegistered(attribute({ id: "category-detail", calc: () => "" }))).toBe(false);
  });
});
