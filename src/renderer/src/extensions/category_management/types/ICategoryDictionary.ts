export interface ICategory {
  name: string;
  parentCategory: string;
  order: number;
}

export interface ICategoryDictionary {
  [id: string]: ICategory;
}

export interface ICategoryState {
  [gameId: string]: ICategoryDictionary;
}
