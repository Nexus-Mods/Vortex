export interface ICurrentTutorial {
  tutorialId: number;
  isOpen: boolean;
}

export interface ITutorialsSessionState {
  currentTutorial: ICurrentTutorial;
}

declare module "@nexusmods/vortex-api" {
  namespace types {
    interface ISessionState {
      tutorials: ITutorialsSessionState;
    }
  }
}
