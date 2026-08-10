export interface ICategoriesTreeEntry {
  categoryId: string;
  expanded: boolean;
  parentId: string;
  title: string;
  order: number;
  directModCount: number;
  nestedModCount: number;
  subCategoryCount: number;
  children: ICategoriesTreeEntry[];
}
