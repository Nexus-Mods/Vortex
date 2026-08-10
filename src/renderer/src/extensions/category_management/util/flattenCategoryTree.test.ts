import { describe, expect, it } from "vitest";

import type { ICategoriesTreeEntry } from "../types/ICategoriesTreeEntry";
import { flattenTreeToIDs } from "./flattenCategoryTree";

describe("flattenTreeToIDs", () => {
  it("flattens multiple layers of nesting and returns all IDs", () => {
    const categories: ICategoriesTreeEntry[] = [
      {
        categoryId: "grand",
        title: "Grand",
        order: 0,
        children: [
          {
            categoryId: "parent",
            title: "Parent",
            order: 0,
            children: [
              {
                categoryId: "child",
                title: "Child",
                order: 0,
                children: [],
                expanded: false,
                parentId: undefined,
                nestedModCount: 0,
                subCategoryCount: 0,
                directModCount: 1,
              },
            ],
            expanded: false,
            parentId: undefined,
            nestedModCount: 1,
            subCategoryCount: 1,
            directModCount: 0,
          },
        ],
        expanded: false,
        parentId: undefined,
        nestedModCount: 1,
        subCategoryCount: 1,
        directModCount: 0,
      },
    ];
    const flattened = flattenTreeToIDs(categories);
    expect(flattened).toEqual(["grand", "parent", "child"]);
  });
});
