declare module "simple-vdf" {
  /** A VDF node is either a leaf value or a nested block; the parser never produces arrays. */
  export type VDFValue = string | VDFObject;

  export interface VDFObject {
    [key: string]: VDFValue;
  }

  export function parse(text: string): VDFObject;
  export function stringify(obj: VDFObject, pretty?: boolean): string;
  export function dump(obj: VDFObject, pretty?: boolean): string;
}
