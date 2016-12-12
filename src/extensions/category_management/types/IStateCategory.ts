
export interface IStateCategory {
  title: string;
  expanded: boolean;
  children: [{ title: string, expanded: boolean }];
}
