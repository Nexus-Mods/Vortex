export interface IReducerAction<T> {
  type: keyof T;
  value: any;
}
export type StateReducerType<T> = React.Reducer<T, IReducerAction<T>[]>;

export interface IEditStarterInfo {
  id: string;
  gameId: string;
  isGame: boolean;
  iconPath: string;
  iconOutPath: string;
  name: string;
  exePath: string;
  commandLine: string;
  workingDirectory: string;
  environment: { [key: string]: string };
  shell: boolean;
  detach: boolean;
  onStart?: 'hide' | 'hide_recover' | 'close';
  defaultPrimary?: boolean;
  exclusive?: boolean;
}
