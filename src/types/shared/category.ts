export interface ICategoryDictionary {
  [categoryId: string]: ICategory;
}

export interface ICategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  order: number;
  collapsed: boolean;
  color: string;
  [key: string]: any;
}