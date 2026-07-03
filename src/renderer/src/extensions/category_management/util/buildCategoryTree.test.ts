import { describe, it, expect } from "vitest";

import { makeMod } from "@/test-utils/builders";

import type { ICategory } from "../types/ICategoryDictionary";
import buildCategoryTree from "./buildCategoryTree";

describe("buildCategoryTree", () => {
  it("sorts top-level categories by `order`", () => {
    const categories: Record<string, ICategory> = {
      a: { name: "A", parentCategory: undefined, order: 2 },
      b: { name: "B", parentCategory: undefined, order: 1 },
    };

    const tree = buildCategoryTree(categories, {});
    expect(tree.map((t) => t.categoryId)).toEqual(["b", "a"]);
  });

  it("nest children under the correct parentId", () => {
    const categories: Record<string, ICategory> = {
      p: { name: "P", parentCategory: undefined, order: 0 },
      c: { name: "C", parentCategory: "p", order: 0 },
    };

    const tree = buildCategoryTree(categories, {});
    expect(tree.length).toBe(1);
    expect(tree[0].children.map((ch) => ch.categoryId)).toEqual(["c"]);
  });

  it("rolls up directModCount vs nestedModCount correctly", () => {
    const categories: Record<string, ICategory> = {
      parent: { name: "Parent", parentCategory: undefined, order: 0 },
      child: { name: "Child", parentCategory: "parent", order: 0 },
      grand: { name: "Grand", parentCategory: "child", order: 0 },
    };

    const modsByCategory = {
      grand: [makeMod(), makeMod()],
    };

    const tree = buildCategoryTree(categories, modsByCategory);
    const parentNode = tree[0];
    const childNode = parentNode.children[0];
    const grandNode = childNode.children[0];

    expect(grandNode.directModCount).toBe(2);
    expect(grandNode.nestedModCount).toBe(2);
    expect(childNode.directModCount).toBe(0);
    expect(childNode.nestedModCount).toBe(2);
    expect(parentNode.directModCount).toBe(0);
    expect(parentNode.nestedModCount).toBe(2);
  });

  it("respects a provided customSort", () => {
    const categories: Record<string, ICategory> = {
      a: { name: "A", parentCategory: undefined, order: 2 },
      b: { name: "B", parentCategory: undefined, order: 1 },
    };

    const tree = buildCategoryTree(categories, {}, undefined, (l, r) => r.localeCompare(l));
    expect(tree.map((t) => t.categoryId)).toEqual(["b", "a"]);
  });

  it("handles empty input and categories with no mods", () => {
    const empty = buildCategoryTree({}, {});
    expect(empty).toEqual([]);

    const categories: Record<string, ICategory> = {
      lone: { name: "Lone", parentCategory: undefined, order: 0 },
    };
    const tree = buildCategoryTree(categories, {});
    expect(tree[0].directModCount).toBe(0);
    expect(tree[0].nestedModCount).toBe(0);
  });

  it("handles mods with categories that don't exist", () => {
    const modsByCategory = {
      fake: [makeMod(), makeMod()],
    };

    const categories: Record<string, ICategory> = {
      real: { name: "Real", parentCategory: undefined, order: 0 },
    };

    const tree = buildCategoryTree(categories, modsByCategory);

    expect(tree.length).toBe(1);
    expect(tree[0].directModCount).toBe(0);
    expect(tree[0].nestedModCount).toBe(0);
  });
});
