import React, { type KeyboardEvent, type RefObject, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Listing } from "@/ui/components/listing/Listing";
import { Pagination } from "@/ui/components/pagination/Pagination";
import { hasModifierKey } from "@/ui/utils/hasModifierKey";
import { rovingFocus } from "@/ui/utils/roving_focus/rovingFocus";
import { PageScroll } from "@/views/components/Page/PageScroll";

import { ModCard } from "../mod_card/ModCard";
import { type IStaticMod, STATIC_RESULTS } from "../staticMods";

/** The tabbable controls a details pane can take focus at, first in order. */
const TABBABLE =
  'button:not([disabled]):not([tabindex="-1"]), [href], [tabindex]:not([tabindex="-1"])';

interface IModListProps {
  /** The mods, in order. */
  mods: IStaticMod[];
  /** The name of the mod the details pane shows. */
  activeMod: string;
  /** Shows another mod in the details pane, by name. */
  onSelectMod: (name: string) => void;
  /** The details pane, for Right to move focus into. */
  detailsRef: RefObject<HTMLDivElement>;
}

/**
 * Browse's list of mods, a static wireframe (LAZ-1346), in its own scroll region with the
 * pagination after it. One Tab stop, the open mod: Up and Down open the mod before or after it,
 * stopping at the ends, and Home and End the first and last, focus going with them; Right moves
 * focus into the details. Tab keeps its own order, the list, then the pagination, then the
 * details. Its scrollbar stops where the rule beside it does.
 */
export const ModList = ({ mods, activeMod, onSelectMod, detailsRef }: IModListProps) => {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const isOnCard = rovingFocus(event, {
      orientation: "vertical",
      itemSelector: "[data-mod-card]",
      onMove: (index) => onSelectMod(mods[index].name),
    });

    if (isOnCard || event.key !== "ArrowRight" || hasModifierKey(event)) {
      return;
    }

    const fromCard =
      event.target instanceof HTMLElement && !!event.target.closest("[data-mod-card]");
    const target = detailsRef.current?.querySelector<HTMLElement>(TABBABLE);

    if (fromCard && target) {
      event.preventDefault();
      target.focus();
    }
  };

  return (
    <div className="scrollbar-inset-6 mr-1 flex min-w-0 flex-1 flex-col">
      <PageScroll
        isFullWidth
        className="flex flex-col gap-y-3.5 py-6 pr-5 pl-6"
        ref={scrollRef}
        onKeyDown={onKeyDown}
      >
        <Listing
          additionalContent={
            <Pagination
              currentPage={page}
              recordsPerPage={mods.length}
              scrollRef={scrollRef}
              totalRecords={STATIC_RESULTS}
              onPaginationUpdate={setPage}
            />
          }
          className="flex flex-col gap-y-3.5"
          entityCount={mods.length}
          noResultsTitle={t("No mods found")}
        >
          {mods.map((mod) => (
            <ModCard
              isActive={mod.name === activeMod}
              key={mod.name}
              mod={mod}
              tabIndex={mod.name === activeMod ? 0 : -1}
              onSelect={() => onSelectMod(mod.name)}
            />
          ))}
        </Listing>
      </PageScroll>
    </div>
  );
};
