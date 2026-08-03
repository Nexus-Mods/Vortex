import { screen, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import CategoryListItem from "./CategoryListItem";

vi.mock("react-dnd", () => ({
  // eslint-disable-next-line @eslint-react/component-hook-factories
  useDrag: () => [{ isDragging: false }, vi.fn()],
  // eslint-disable-next-line @eslint-react/component-hook-factories
  useDrop: () => [{ isOver: false, canDrop: false }, vi.fn()],
}));

const mockCategory = {
  categoryId: "1",
  expanded: false,
  parentId: undefined,
  title: "A",
  order: 0,
  directModCount: 0,
  nestedModCount: 0,
  subCategoryCount: 0,
  children: [],
};

const renderComponent = (props: Partial<React.ComponentProps<typeof CategoryListItem>> = {}) => {
  const t = vi.fn();
  const expand = vi.fn();
  const remove = vi.fn();
  const createSubcategory = vi.fn();
  const renameCategory = vi.fn();
  const moveCategory = vi.fn();

  const allProps: React.ComponentProps<typeof CategoryListItem> = {
    t,
    category: mockCategory,
    expand,
    remove,
    createSubcategory,
    renameCategory,
    moveCategory,
    ...props,
  };

  render(<CategoryListItem {...allProps} />);

  return { t, expand, remove, createSubcategory, renameCategory, moveCategory };
};

describe("CategoryListItem", () => {
  it("expand button is hidden on childless categories", () => {
    renderComponent();
    expect(screen.queryByTestId("category-expand")).not.toBeInTheDocument();
  });

  it("expand button is visible on categories with children", () => {
    renderComponent({
      category: { ...mockCategory, children: [{ ...mockCategory, title: "B", categoryId: "2" }] },
    });
    expect(screen.getByTestId("category-expand")).toBeInTheDocument();
  });

  it("expand button opens children", async () => {
    const { expand } = renderComponent({
      category: { ...mockCategory, children: [{ ...mockCategory, title: "B", categoryId: "2" }] },
    });
    await userEvent.setup().click(screen.getByTestId("category-expand"));
    expect(expand).toHaveBeenCalled();
  });

  it("delete button deletes category", async () => {
    const { remove } = renderComponent();
    await userEvent.click(screen.getByTestId("category-delete"));
    expect(remove).toHaveBeenCalled();
  });

  it("renames category", async () => {
    const user = userEvent.setup();
    const { renameCategory } = renderComponent();
    await user.click(screen.getByTestId("category-rename"));
    const input = screen.getByTestId("category-rename-input");
    await user.clear(input);
    await user.type(input, "New category name");
    await user.click(screen.getByTestId("category-rename-save"));
    expect(renameCategory).toHaveBeenCalledWith("1", "New category name");
  });

  it("creates a subcategory", async () => {
    const user = userEvent.setup();
    const { createSubcategory } = renderComponent();
    await user.click(screen.getByTestId("category-add-subcategory"));
    await user.type(screen.getByTestId("category-subcategory-input"), "New category name");
    await user.click(screen.getByTestId("category-subcategory-save"));
    expect(createSubcategory).toHaveBeenCalledWith("New category name", 0, "1");
  });
});
