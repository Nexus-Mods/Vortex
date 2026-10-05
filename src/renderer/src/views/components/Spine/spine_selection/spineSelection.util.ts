import type { IMainPage } from "../../../../types/IMainPage";

export type SpineSelection =
  | { type: "home" }
  | { type: "game"; gameId: string }
  | { type: "downloads" };

interface ISpineSelectionInput {
  /** The open page's id, or "" before one is open. */
  mainPage: string;
  /** The group of each registered page, by id. */
  pageGroups: Map<string, IMainPage["group"]>;
  activeGameId: string | undefined;
  /** The selection last derived, or undefined when the spine has just mounted. */
  previous: SpineSelection | undefined;
}

const isSameSelection = (a: SpineSelection, b: SpineSelection): boolean =>
  a.type === b.type && (a.type !== "game" || (b.type === "game" && a.gameId === b.gameId));

/**
 * The spine item for the open page: the active game for a per-game page, Downloads
 * for the downloads page, Home for any other. A hidden or unknown page keeps the
 * previous selection. A spine that has just mounted starts in the active game,
 * whatever is open, as when switching from the classic layout.
 *
 * Hands back `previous` itself when nothing changed, so effects keyed on the
 * selection don't run again.
 */
export const deriveSpineSelection = ({
  mainPage,
  pageGroups,
  activeGameId,
  previous,
}: ISpineSelectionInput): SpineSelection => {
  const inGame: SpineSelection =
    activeGameId !== undefined ? { type: "game", gameId: activeGameId } : { type: "home" };
  const group = mainPage ? pageGroups.get(mainPage) : undefined;

  let next: SpineSelection;
  if (previous === undefined) {
    next = inGame;
  } else if (mainPage === "Downloads") {
    next = { type: "downloads" };
  } else if (group === "per-game") {
    next = inGame;
  } else if (group !== undefined && group !== "hidden") {
    next = { type: "home" };
  } else {
    next = previous.type === "game" ? inGame : previous;
  }

  return previous !== undefined && isSameSelection(previous, next) ? previous : next;
};
