import { screen, cleanup, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import CategoryList from "./CategoryList";

type UseCategoryTreeResult = ReturnType<typeof useCategoryTree>;

vi.mock("react-dnd", () => ({
  // eslint-disable-next-line @eslint-react/component-hook-factories
  useDrag: () => [{ isDragging: false }, vi.fn()],
  // eslint-disable-next-line @eslint-react/component-hook-factories
  useDrop: () => [{ isOver: false, canDrop: false }, vi.fn()],
}));

vi.mock("../hooks/CategoryTreeHook", () => ({
  default: vi.fn(),
}));

import useCategoryTree from "../hooks/CategoryTreeHook";

const mockedUseCategoryTree = vi.mocked(useCategoryTree);

const mockData = [
  {
    categoryId: "c1",
    title: "Category 1",
    children: [],
    expanded: false,
    parentId: undefined,
    order: 0,
    directModCount: 0,
    nestedModCount: 0,
    subCategoryCount: 0,
  },
  {
    categoryId: "c2",
    title: "Category 2",
    children: [],
    expanded: false,
    parentId: undefined,
    order: 1,
    directModCount: 0,
    nestedModCount: 0,
    subCategoryCount: 0,
  },
];

const baseHookProps: UseCategoryTreeResult = {
  t: (k: string) => k,
  filteredTreeData: mockData,
  searchString: "",
  setSearchString: vi.fn(),
  isFetching: false,
  isFetchError: false,
  toolbarActions: [],
  toggleExpand: vi.fn(),
  createCategory: vi.fn(),
  removeCategory: vi.fn(),
  moveCategory: vi.fn(),
  importCategoriesFromNexusMods: vi.fn().mockResolvedValue(undefined),
  startCreateParentCategory: vi.fn(),
  addParentVisible: false,
  newParentCategoryName: "",
  setNewParentCategoryName: vi.fn(),
  clearFetchError: vi.fn(),
  onRenameCategory: vi.fn(),
  sortAlphabetically: undefined,
  treeData: [],
  nonEmptyCategories: undefined,
  expandedTreeData: [],
  expanded: undefined,
  showEmpty: false,
  toggleEmpty: undefined,
  expandAll: undefined,
  collapseAll: undefined,
  setExpanded: vi.fn(),
  fetchError: {
    title: "",
    detail: "",
  },
  setFetchError: vi.fn(),
  setIsFetching: vi.fn(),
  setIsFetchError: vi.fn(),
};

afterEach(() => {
  cleanup();
});

describe("CategoryList", () => {
  it("calls setSearchString when searching", async () => {
    const setSearchString = vi.fn();

    mockedUseCategoryTree.mockImplementation(() => {
      const [searchStringState, setSearchStringState] = useState("");
      return {
        ...baseHookProps,
        searchString: searchStringState,
        setSearchString: (value: string) => {
          setSearchStringState(value);
          setSearchString(value);
        },
        filteredTreeData: mockData,
      };
    });
    const user = userEvent.setup();
    render(<CategoryList />);
    const searchInput = screen.getByDisplayValue("");
    expect(searchInput).toBeInTheDocument();
    await user.clear(searchInput);
    await user.type(searchInput, "category 2");
    expect(setSearchString).toHaveBeenLastCalledWith("category 2");
  });

  it("shows skeleton when fetching", () => {
    mockedUseCategoryTree.mockReturnValue({
      ...baseHookProps,
      isFetching: true,
      filteredTreeData: [],
    });
    render(<CategoryList />);

    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    expect(screen.queryByText("Category 1")).not.toBeInTheDocument();
  });

  it("show fetch error and can retry", async () => {
    const importCategoriesFromNexusMods = vi.fn().mockResolvedValue(undefined);
    mockedUseCategoryTree.mockReturnValue({
      ...baseHookProps,
      importCategoriesFromNexusMods,
      isFetchError: true,
      fetchError: { title: "Failed", detail: "Something blew up" },
      filteredTreeData: [],
    });
    render(<CategoryList />);

    expect(screen.getByText("Failed")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(importCategoriesFromNexusMods).toHaveBeenCalled();
  });

  it("adds new parent category", async () => {
    const createCategory = vi.fn();
    const startCreateParentCategory = vi.fn();
    mockedUseCategoryTree.mockReturnValue({
      ...baseHookProps,
      createCategory,
      startCreateParentCategory,
      addParentVisible: true,
      newParentCategoryName: "New Parent",
    });
    render(<CategoryList />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(createCategory).toHaveBeenCalledWith("New Parent", 0, undefined);
    expect(startCreateParentCategory).toHaveBeenCalled();
  });
});
