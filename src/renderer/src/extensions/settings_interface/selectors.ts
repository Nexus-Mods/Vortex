import type { IState } from "@/types/IState";

/** Whether the game art shows, as the user has it set. */
export const showsGameArt = (state: IState) => state.settings.interface.showGameArt;

/** The last page open on Home and in each game. */
export const lastPages = (state: IState) => state.settings.interface.lastPages;
