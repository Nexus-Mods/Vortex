import type { OSPathBase, PathProvider, QualifiedPath } from "./paths";

/**
 * Bases supported by all OS path providers.
 * @public */
export const WindowsPath = {
  /** `%USERPROFILE%/AppData` */
  appData: "appData",
  /** `%USERPROFILE%/Documents` also known as "My Documents" */
  documents: "documents",
  /** `%USERPROFILE%/Documents/My Games` */
  myGames: "my games",
} as const;

/** @public */
export type WindowsPathBase = OSPathBase | (typeof WindowsPath)[keyof typeof WindowsPath];

/** @public */
export interface WindowsPathProvider extends PathProvider<WindowsPathBase> {
  readonly platform: "windows";

  /** Returns the drive-letter roots available on the host. */
  enumerateDrives(): Promise<QualifiedPath[]>;
}
