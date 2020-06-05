export interface IDynDivOptions {
  onClick?: () => void;
  condition?: (props: any) => boolean;
  props?: { [key: string]: (state: any) => any };
}
