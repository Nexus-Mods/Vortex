declare module "lz4js" {
  export function compress(src: Uint8Array): Uint8Array;
  export function decompress(src: Uint8Array, maxSize?: number): Uint8Array;
}
