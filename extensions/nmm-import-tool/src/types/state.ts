export type ImportStep = "start" | "setup" | "working" | "review";

/** `session.modimport` */
export interface IModImportSessionState {
  /** the dialog's current step; `undefined` while it's closed */
  importStep: ImportStep | undefined;
  /** never written: a leftover default kept so the stored shape doesn't change */
  importedMods: { [id: string]: unknown };
  selectFolder: boolean;
  /** never written: a leftover default kept so the stored shape doesn't change */
  selectedProfile: string | undefined;
}

declare module "@nexusmods/vortex-api" {
  namespace types {
    interface ISessionState {
      modimport: IModImportSessionState;
    }
  }
}
