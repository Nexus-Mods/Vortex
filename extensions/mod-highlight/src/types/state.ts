/** `session.modhighlight` */
export interface IModHighlightSessionState {
  /** ids of the mods the batch highlighter applies to */
  selectedMods: string[];
  displayBatchHighlighter: boolean;
}

declare module "@nexusmods/vortex-api" {
  namespace types {
    interface ISessionState {
      modhighlight: IModHighlightSessionState;
    }
  }
}
