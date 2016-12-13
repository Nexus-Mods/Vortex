
export interface IChildren {
  rootId: number;
  title: string;
  expanded: boolean;
}

export interface ICategoryTree {
  rootId: number;
  title: string;
  expanded: boolean;
  children: IChildren[];
}
