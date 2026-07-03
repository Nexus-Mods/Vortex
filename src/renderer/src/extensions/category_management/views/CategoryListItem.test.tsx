import { screen, cleanup, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import CategoryListItem from "./CategoryListItem";

// eslint-disable-next-line @eslint-react/component-hook-factories
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

vi.mock("react-dnd", () => ({
  // eslint-disable-next-line @eslint-react/component-hook-factories
  useDrag: () => [{ isDragging: false }, vi.fn()],
  // eslint-disable-next-line @eslint-react/component-hook-factories
  useDrop: () => [{ isOver: false, canDrop: false }, vi.fn()],
}));

afterEach(() => {
  cleanup();
});

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
    const expand = document.querySelector(".nxm-category-expand");
    expect(expand).toBeNull();
  });

  it("expand button is visible on categories with children", () => {
    renderComponent({
      category: { ...mockCategory, children: [{ ...mockCategory, title: "B", categoryId: "2" }] },
    });
    const expand = document.querySelector(".nxm-category-expand");
    expect(expand).toBeInTheDocument();
  });

  it("expand button opens children", async () => {
    const { expand } = renderComponent({
      category: { ...mockCategory, children: [{ ...mockCategory, title: "B", categoryId: "2" }] },
    });
    const expandButton = document.querySelector(".nxm-category-expand");
    expect(expandButton).toBeInTheDocument();
    await userEvent.setup().click(expandButton);
    expect(expand).toHaveBeenCalled();
  });

  it("delete button deletes category", async () => {
    const { remove } = renderComponent();
    const deleteButton = screen.getByRole("button", { name: "Delete" });
    expect(deleteButton).toBeInTheDocument();
    await userEvent.click(deleteButton);
    expect(remove).toHaveBeenCalled();
  });

  it("renames category", async () => {
    const user = userEvent.setup();
    const { renameCategory } = renderComponent();
    const renameButton = screen.getByRole("button", { name: "Edit" });
    expect(renameButton).toBeInTheDocument();
    await user.click(renameButton);
    const input = screen.getByDisplayValue("A");
    await user.clear(input);
    await user.type(input, "New category name");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(renameCategory).toHaveBeenCalledWith("1", "New category name");
  });

  it("creates a subcategory", async () => {
    const user = userEvent.setup();
    const { createSubcategory } = renderComponent();
    const subCategoryButton = screen.getByRole("button", { name: "New Sub-Category" });
    expect(subCategoryButton).toBeInTheDocument();
    await user.click(subCategoryButton);
    const input = screen.getByDisplayValue("");
    await user.type(input, "New category name");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(createSubcategory).toHaveBeenCalledWith("New category name", 0, "1");
  });
});
