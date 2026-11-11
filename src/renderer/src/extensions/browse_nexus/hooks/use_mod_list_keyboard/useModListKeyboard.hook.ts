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

/** Which mod each key moves to from the one at `at`, of the mods up to `last`. */
const FROM_CARD: Partial<Record<string, (at: number, last: number) => number>> = {
  ArrowDown: (at) => at + 1,
  ArrowUp: (at) => at - 1,
  Home: () => 0,
  End: (_, last) => last,
};

interface IModListKeyboardOptions {
  /** The list's scroller, which the cards render in. */
  scrollRef: RefObject<HTMLDivElement>;
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
}

/**
 * The mod list's keys: Up, Down, Home and End pick a mod, from the list itself or a card, and
 * Right moves focus into the details. A mod picked from the keyboard is focused once its card
 * renders, unless the search changes first. Returns the list's `onKeyDown`.
 */
export const useModListKeyboard = ({
  scrollRef,
  mods,
  searchKey,
  isLoading,
  onSelectMod,
  onFocusDetails,
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

    const card = scrollRef.current?.querySelector<HTMLElement>(
      `[data-index="${focusTargetRef.current}"] [data-mod-card]`,
    );

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

  return (event: KeyboardEvent<HTMLDivElement>) => {
    if (hasModifierKey(event) || !mods.length || isLoading) {
      return;
    }

    const last = mods.length - 1;
    const at =
      event.target instanceof HTMLElement
        ? event.target.closest<HTMLElement>("[data-index]")?.dataset.index
        : undefined;

    if (event.target === event.currentTarget) {
      const end = FROM_LIST[event.key];

      if (end) {
        moveTo(event, end === "last" ? last : 0);
      }

      return;
    }

    const step = at === undefined ? undefined : FROM_CARD[event.key];

    if (step) {
      moveTo(event, Math.min(Math.max(step(Number(at), last), 0), last));
      return;
    }

    if (event.key === "ArrowRight" && at !== undefined) {
      event.preventDefault();
      onFocusDetails();
    }
  };
};
