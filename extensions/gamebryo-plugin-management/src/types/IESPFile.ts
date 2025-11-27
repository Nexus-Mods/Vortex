export interface IESPFile  {
  // setLightFlag(enabled: boolean): void;
  isMaster: boolean;
  isLight: boolean;
  isMedium: boolean;
  isDummy: boolean;
  author: string;
  description: string;
  masterList: string[];
  revision: number;
}