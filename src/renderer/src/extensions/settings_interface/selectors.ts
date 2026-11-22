import type { IState } from "@/types/IState";

/** Whether the game art shows, as the user has it set. */
export const showsGameArt = (state: IState) => state.settings.interface.showGameArt;

/** The page last open on Home and in each game, for the spine to return to. */
export const lastPages = (state: IState) => state.settings.interface.lastPage;
