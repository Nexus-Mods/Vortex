declare module 'simple-vdf' {
  export function parse(text: string): Object;
  export function stringify(obj: Object, pretty?: boolean): string;
  export function dump(obj: Object, pretty?: boolean): string;
}