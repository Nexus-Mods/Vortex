import { cleanup, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TFunction } from "i18next";
import React from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeCategory } from "@/test-utils/builders";

import type { ICategoriesTreeEntry } from "../types/ICategoriesTreeEntry";
import buildCategoryTree from "../util/buildCategoryTree";
import CategoryListItem from "./CategoryListItem";

afterEach(() => {
  cleanup();
});

const t = ((k: string) => k) as TFunction;

// mark the given ids as expanded, the way CategoryTreeDataHook's applyExpand does
const withExpanded = (nodes: ICategoriesTreeEntry[], ids: Set<string>): ICategoriesTreeEntry[] =>
  nodes.map((node) => ({
    ...node,
    expanded: ids.has(node.categoryId),
    children: withExpanded(node.children, ids),
  }));

// root > child > grandchild > leaf, with root and child expanded so the
// grandchild is visible and (having a child of its own) shows an expand button
const makeNestedTree = (): ICategoriesTreeEntry => {
  const categories = {
    root: makeCategory({ name: "Root" }),
    child: makeCategory({ name: "Child", parentCategory: "root" }),
    grandchild: makeCategory({ name: "Grandchild", parentCategory: "child" }),
    leaf: makeCategory({ name: "Leaf", parentCategory: "grandchild" }),
  };
  const [root] = withExpanded(buildCategoryTree(categories, {}), new Set(["root", "child"]));
  return root;
};

const renderTree = (root: ICategoriesTreeEntry) => {
  const expand = vi.fn();
  render(
    <DndProvider backend={HTML5Backend}>
      <CategoryListItem
        category={root}
        createSubcategory={vi.fn()}
        expand={expand}
        moveCategory={vi.fn()}
        remove={vi.fn()}
        renameCategory={vi.fn()}
        t={t}
      />
    </DndProvider>,
  );
  // expand buttons render in document order: root, child, grandchild
  const expandButtons = document.querySelectorAll(".nxm-category-expand");
  return { expand, expandButtons };
};

describe("CategoryListItem nested expand/collapse", () => {
  it("expand button on a depth-1 child toggles that child", async () => {
    const { expand, expandButtons } = renderTree(makeNestedTree());
    expect(expandButtons).toHaveLength(3);

    await userEvent.setup().click(expandButtons[1]);

    expect(expand).toHaveBeenCalledExactlyOnceWith("child");
  });

  it("expand button on a depth-2 grandchild toggles that grandchild, not its parent", async () => {
    const { expand, expandButtons } = renderTree(makeNestedTree());
    expect(expandButtons).toHaveLength(3);

    await userEvent.setup().click(expandButtons[2]);

    expect(expand).toHaveBeenCalledExactlyOnceWith("grandchild");
  });
});
