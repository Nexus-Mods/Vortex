import type { IMod } from "../../mod_management/types/IMod";
import type { ICategoriesTreeEntry } from "../types/ICategoriesTreeEntry";
import type { ICategory } from "../types/ICategoryDictionary";

export default function buildCategoryTree(
  categories: { [categoryId: string]: ICategory },
  modsByCategory: { [categoryId: string]: IMod[] },
  parentId?: string,
  customSort?: (lhs: string, rhs: string) => number,
): ICategoriesTreeEntry[] {
  // Sort with custom or base sorting
  const sortFunc = (lhs: string, rhs: string) =>
    customSort !== undefined ? customSort(lhs, rhs) : categories[lhs].order - categories[rhs].order;

  const childIds = Object.keys(categories)
    .filter((id) => categories[id].parentCategory === parentId)
    .sort(sortFunc);

  return childIds.map((categoryId) => {
    const children = buildCategoryTree(categories, modsByCategory, categoryId, customSort);
    const directModCount = modsByCategory[categoryId]?.length ?? 0;
    const nestedModCount =
      directModCount + children.reduce((sum, child) => sum + child.nestedModCount, 0);
    const subCategoryCount = children.length;
    return {
      categoryId,
      title: categories[categoryId].name,
      expanded: false,
      parentId: categories[categoryId].parentCategory,
      order: categories[categoryId].order,
      directModCount,
      nestedModCount,
      subCategoryCount,
      children,
    };
  });
}
