import type { OSPathBase, PathProvider, QualifiedPath } from "./paths";

/** @public */
export const XDG = {
  data: "XDG_DATA_HOME",
  config: "XDG_CONFIG_HOME",
  state: "XDG_STATE_HOME",
  cache: "XDG_CACHE_HOME",
  runtime: "XDG_RUNTIME_DIR",
} as const;

/** @public */
export const XDGSet = {
  data: "XDG_DATA_DIRS",
  config: "XDG_CONFIG_DIRS",
} as const;

/** @public */
export type XDGBase = (typeof XDG)[keyof typeof XDG];

/** @public */
export type XDGSetBase = (typeof XDGSet)[keyof typeof XDGSet];

/** @public */
export type LinuxPathBase = OSPathBase | XDGBase;

/** @public */
export interface LinuxPathProvider extends PathProvider<LinuxPathBase> {
  readonly platform: "linux";

  /** Returns a path according to the XDG Base Directory Specification */
  fromXDGBase(base: XDGBase): Promise<QualifiedPath>;

  /** Returns multiple paths according to the XDG Base Directory Specification */
  fromXDGSetBase(base: XDGSetBase): Promise<QualifiedPath[]>;
}
