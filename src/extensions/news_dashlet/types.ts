export interface IExtra {
  id: string;
  value: any;
  icon?: string;
  text?: string;
}

export interface IModListItem {
  name: string;
  summary: string;
  category: string;
  author: string;
  imageUrl: string;
  link: string;
  extra: IExtra[];
}

export interface IListItem {
  name: string | React.ReactChild[];
  summary: string | React.ReactChild[];
  category?: string;
  imageUrl: string;
  link: string;
  extra: IExtra[];
}
