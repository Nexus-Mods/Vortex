export interface IBannerOptions {
  onClick?: () => void;
  condition?: (props: any) => boolean;
  props?: { [key: string]: (state: any) => any };
}
