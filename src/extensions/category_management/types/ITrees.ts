export interface ICategoriesTree {
  categoryId: string;
  expanded: boolean;
  parentId: string;
  subtitle: string;
  title: string;
  order: number;
  modCount: number;
  children: ICategoriesTree[];
}
