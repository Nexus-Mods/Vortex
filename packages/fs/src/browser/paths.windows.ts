import type { OSPathBase, PathProvider, QualifiedPath } from "./paths";

/** @public */
export type WindowsPathBase = OSPathBase;

/** @public */
export interface WindowsPathProvider extends PathProvider<WindowsPathBase> {
  readonly platform: "windows";

  enumerateDrives(): Promise<QualifiedPath>;
}
