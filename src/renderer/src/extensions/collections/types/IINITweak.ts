export type TweakArray = IINITweak[];
export interface IINITweak {
  fileName: string;
  sourcePath?: string;
  enabled?: boolean;
}
