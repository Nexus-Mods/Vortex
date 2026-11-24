import { type KeyboardEvent, type RefObject, useLayoutEffect, useRef } from "react";

import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import { hasModifierKey } from "@/ui/utils/hasModifierKey";

import type { SelectionInput } from "../browse_mods_tracking/browseModsTracker";

/** Which mod each key picks from the list itself, rather than from a mod. */
const FROM_LIST: Partial<Record<string, "first" | "last">> = {
  ArrowDown: "first",
  Home: "first",
  ArrowUp: "last",
  End: "last",
};

/** Which mod each key picks from what's after the last card, such as Load more. */
const FROM_AFTER_LAST: Partial<Record<string, "first" | "last">> = {
  ArrowUp: "last",
  Home: "first",
  End: "last",
};

/** Which mod each key moves to from the one at `at`, of the mods up to `last`. */
const FROM_CARD: Partial<Record<string, (at: number, last: number) => number>> = {
  ArrowDown: (at) => at + 1,
  ArrowUp: (at) => at - 1,
  Home: () => 0,
  End: (_, last) => last,
};

interface IModListKeyboardOptions {
  /** The cards rendered, by their mods' index; the virtualiser leaves the rest out. */
  cards: ReadonlyMap<number, HTMLElement>;
  /** The mods loaded so far, in order. */
  mods: ModSummary[];
  /** Which search they're from; a change drops a focus still waiting. */
  searchKey: string;
  /** Whether the first page is loading, when the keys do nothing. */
  isLoading: boolean;
  /** Picks another mod, by id, told how it was picked. */
  onSelectMod: (id: string, input: SelectionInput) => void;
  /** Moves focus into the details pane, for Right from a card. */
  onFocusDetails: () => void;
  /** Something after the last card, such as Load more, that Down moves focus to and Up back from. */
  afterLastCardRef?: RefObject<HTMLElement>;
  /** Called as Down moves focus past the last card, which it passed rather than stopped on. */
  onPassLastCard?: () => void;
}

/**
 * The mod list's keys: Up, Down, Home and End pick a mod, from the list itself or a card, and
 * Right moves focus into the details. Down from the last card moves focus to what's after it,
 * while there's something there. From that, Up picks the last mod again, and Home and End pick
 * the first and last. A mod picked from the keyboard is focused
 * once its card renders, unless the search changes first. Returns the list's `onKeyDown`.
 */
export const useModListKeyboard = ({
  cards,
  mods,
  searchKey,
  isLoading,
  onSelectMod,
  onFocusDetails,
  afterLastCardRef,
  onPassLastCard,
}: IModListKeyboardOptions) => {
  const focusTargetRef = useRef<number>();
  const shownSearchRef = useRef(searchKey);

  useLayoutEffect(() => {
    if (shownSearchRef.current !== searchKey) {
      shownSearchRef.current = searchKey;
      focusTargetRef.current = undefined;
    }
  }, [searchKey]);

  /** Focuses the card the keyboard last moved to, once it's rendered, and forgets it. */
  const focusTarget = () => {
    if (focusTargetRef.current === undefined) {
      return;
    }

    const card = cards.get(focusTargetRef.current);

    if (card) {
      card.focus();
      focusTargetRef.current = undefined;
    }
  };

  useLayoutEffect(focusTarget);

  /** Picks the mod at `index` and focuses it. */
  const moveTo = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();

    if (!mods[index]) {
      return;
    }

    focusTargetRef.current = index;
    onSelectMod(mods[index].id, "keyboard");
    focusTarget();
  };

  /** Picks the first or last mod, as `ends` says for the key, if it says anything. */
  const moveToEnd = (
    event: KeyboardEvent<HTMLDivElement>,
    ends: Partial<Record<string, "first" | "last">>,
  ) => {
    const end = ends[event.key];

    if (end) {
      moveTo(event, end === "last" ? mods.length - 1 : 0);
    }
  };

  /** Moves from the card at `at`: past the last card, to another, or into the details. */
  const moveFromCard = (event: KeyboardEvent<HTMLDivElement>, at: number) => {
    const last = mods.length - 1;
    const afterLastCard = afterLastCardRef?.current;

    if (event.key === "ArrowDown" && at === last && afterLastCard) {
      event.preventDefault();
      afterLastCard.focus();
      onPassLastCard?.();
      return;
    }

    const step = FROM_CARD[event.key];

    if (step) {
      moveTo(event, Math.min(Math.max(step(at, last), 0), last));
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      onFocusDetails();
    }
  };

  return (event: KeyboardEvent<HTMLDivElement>) => {
    if (hasModifierKey(event) || !mods.length || isLoading) {
      return;
    }

    if (event.target === event.currentTarget) {
      moveToEnd(event, FROM_LIST);
      return;
    }

    if (event.target === afterLastCardRef?.current) {
      moveToEnd(event, FROM_AFTER_LAST);
      return;
    }

    const at =
      event.target instanceof HTMLElement
        ? event.target.closest<HTMLElement>("[data-index]")?.dataset.index
        : undefined;

    if (at !== undefined) {
      moveFromCard(event, Number(at));
    }
  };
};
