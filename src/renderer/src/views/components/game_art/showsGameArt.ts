import type { IState } from "@/types/IState";

/** Whether the game art shows: on unless the user turned it off, so on for older settings. */
export const showsGameArt = (state: IState) => state.settings.interface.showGameArt !== false;
