import type { OSPathBase, PathProvider } from "./paths";

/** @public */
export const XDG = {
  data: "XDG_DATA_HOME",
  config: "XDG_CONFIG_HOME",
  state: "XDG_STATE_HOME",
  cache: "XDG_CACHE_HOME",
  runtime: "XDG_RUNTIME_DIR",
} as const;

/** @public */
export type XDGBase = (typeof XDG)[keyof typeof XDG];

/** @public */
export type LinuxPathBase = OSPathBase | XDGBase;

/** @public */
export interface ILinuxPathProvider extends PathProvider<LinuxPathBase> {
  readonly platform: "linux";
}
