import { describe, it, expect } from "vitest";

import * as actions from "../actions/category";
import type { ICategory, ICategoryState } from "../types/ICategoryDictionary";
import { categoryReducer } from "./category";

function category(name: string, order = 0, parentCategory = ""): ICategory {
  return { name, order, parentCategory };
}

describe("loadCategories", () => {
  it("replaces existing categories", () => {
    const input: ICategoryState = { game1: { cat1old: category("Cat1 name", 0) } };
    const categories = {
      cat1new: category("Cat1 name", 0),
      cat2new: category("Cat2 name", 2),
      cat12new: category("Cat12 name", 1, "cat1new"),
    };
    const result = categoryReducer.reducers.LOAD_CATEGORIES(
      input,
      actions.loadCategories("game1", categories).payload,
    );
    expect(result).toEqual({ game1: categories });
  });

  it("leaves other games alone", () => {
    const input: ICategoryState = { game1: { cat1: category("Cat1 name", 0) } };
    const categories = {
      cat1: category("Cat1 name game2", 0),
    };
    const result = categoryReducer.reducers.LOAD_CATEGORIES(
      input,
      actions.loadCategories("game2", categories).payload,
    );
    expect(result).toEqual({ ...input, game2: categories });
  });
});

describe("renameCategory", () => {
  it("renames the category", () => {
    const input: ICategoryState = { game1: { cat1: category("Old name") } };
    const result = categoryReducer.reducers.RENAME_CATEGORY(
      input,
      actions.renameCategory("game1", "cat1", "New name").payload,
    );
    expect(result).toEqual({ game1: { cat1: category("New name") } });
  });
  it("does nothing if the category doesn't exist", () => {
    const input: ICategoryState = { game1: { cat1: category("Old name") } };
    const result = categoryReducer.reducers.RENAME_CATEGORY(
      input,
      actions.renameCategory("game1", "cat2", "New name").payload,
    );
    expect(result).toEqual({ game1: { cat1: category("Old name") } });
  });
  it("affects only the right game", () => {
    const input: ICategoryState = {
      game1: { cat1: category("Old name") },
      game2: { cat1: category("Old name") },
    };
    const result = categoryReducer.reducers.RENAME_CATEGORY(
      input,
      actions.renameCategory("game1", "cat1", "New name").payload,
    );
    expect(result).toEqual({
      game1: { cat1: category("New name") },
      game2: { cat1: category("Old name") },
    });
  });
});
