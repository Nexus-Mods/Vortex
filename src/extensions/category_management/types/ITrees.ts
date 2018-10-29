import { TreeItem } from 'react-sortable-tree';

export interface ICategoriesTree extends TreeItem {
  categoryId: string;
  expanded: boolean;
  parentId: string;
  subtitle: string;
  title: string;
  order: number;
  modCount: number;
  children: ICategoriesTree[];
}
