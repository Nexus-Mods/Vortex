declare module "lz4js" {
  export function decompressBlock(
    src: Buffer | Uint8Array,
    dst: Buffer | Uint8Array,
    sIndex: number,
    sLength: number,
    dIndex: number,
  ): number;
}
