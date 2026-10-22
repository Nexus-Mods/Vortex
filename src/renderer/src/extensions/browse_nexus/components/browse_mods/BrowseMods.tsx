import { mdiDeleteOutline, mdiDotsHorizontal, mdiFilterVariant, mdiPencil, mdiTune } from "@mdi/js";
import { GameId } from "@vortex/shared";
import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { useDisplayOptionsAction } from "@/ui/components/display_options/useDisplayOptionsAction.hook";
import { Pagination } from "@/ui/components/pagination/Pagination";
import { Picker } from "@/ui/components/picker/Picker";
import { PopoverPanelGroup } from "@/ui/components/popover/PopoverPanelGroup";
import { PopoverPanelGroupItem } from "@/ui/components/popover/PopoverPanelGroupItem";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import { ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";
import { Typography } from "@/ui/components/typography/Typography";
import { type IViewPickerView, ViewPicker } from "@/ui/components/view_picker/ViewPicker";
import { PageContent } from "@/views/components/Page/PageContent";
import { PageScroll } from "@/views/components/Page/PageScroll";

import { Search } from "../../../gamemode_management/components/search/Search";
import { ModCard } from "./mod_card/ModCard";
import { ModDetails } from "./mod_details/ModDetails";
import { STATIC_MODS } from "./staticMods";

/** Games whose hero art can stand in for the active game's, so design can try it over each. */
const HERO_GAMES = [
  { id: GameId(8969), name: "Crimson Desert" },
  { id: GameId(3474), name: "Baldur's Gate 3" },
  { id: GameId(3333), name: "Cyberpunk 2077" },
  { id: GameId(4333), name: "Elden Ring" },
  { id: GameId(1151), name: "Fallout 4" },
  { id: GameId(5113), name: "Hogwarts Legacy" },
  { id: GameId(7286), name: "Kingdom Come: Deliverance II" },
  { id: GameId(6993), name: "Monster Hunter Wilds" },
  { id: GameId(1704), name: "Skyrim Special Edition" },
  { id: GameId(1303), name: "Stardew Valley" },
  { id: GameId(4187), name: "Starfield" },
  { id: GameId(952), name: "The Witcher 3: Wild Hunt" },
];

const DEFAULT_HERO_GAME = HERO_GAMES[0].id;

/** A game's hero art on the Nexus Mods image CDN. */
const heroUrl = (gameId: GameId) =>
  `https://images.nexusmods.com/images/games/v2/${gameId}/hero.jpg`;

/** The results count the bar shows, for the pagination to page through. */
const STATIC_RESULTS = 121867;

/**
 * The active game's mods, a static wireframe (LAZ-1346): its parts with no component yet
 * are placeholders that say what they will be. Its own scroll region sits under the bar of
 * views, search and filters, so the bar stays put; like `PageHeader` it leaves `pr-scrollbar`
 * for the scroll region's gutter. Under the bar, the mods and `ModDetails` are halves that
 * scroll on their own; the mods scroll over a game's hero art, its feature held in their
 * bottom right corner and fading into the surface towards the top.
 */
export const BrowseMods = () => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [view, setView] = useState("trending");
  const [page, setPage] = useState(1);
  const [activeMod, setActiveMod] = useState(STATIC_MODS[0].name);
  const [heroGame, setHeroGame] = useState(DEFAULT_HERO_GAME);
  const active = STATIC_MODS.find((mod) => mod.name === activeMod) ?? STATIC_MODS[0];
  const scrollRef = useRef<HTMLDivElement>(null);

  const views: IViewPickerView[] = [
    { id: "trending", label: t("Trending") },
    { id: "popular", label: t("Most popular") },
    { id: "new", label: t("New") },
    {
      id: "custom",
      label: t("My custom view"),
      actions: [
        [
          { label: t("Rename view"), iconPath: mdiPencil, onClick: () => undefined },
          { label: t("Edit view options"), iconPath: mdiTune, onClick: () => undefined },
          { label: t("Delete view"), iconPath: mdiDeleteOutline, onClick: () => undefined },
        ],
      ],
    },
  ];

  const displayOptions = useDisplayOptionsAction({
    label: t("View options"),
    canReset: heroGame !== DEFAULT_HERO_GAME,
    children: (
      <PopoverPanelGroup>
        <PopoverPanelGroupItem passive label={t("Background art")}>
          <Picker<GameId>
            button={{ size: "sm" }}
            options={HERO_GAMES.map((game) => ({ label: game.name, value: game.id }))}
            value={heroGame}
            onChange={setHeroGame}
          />
        </PopoverPanelGroupItem>
      </PopoverPanelGroup>
    ),
    onReset: () => setHeroGame(DEFAULT_HERO_GAME),
  });

  const filter = {
    id: "filter",
    label: t("Filter"),
    iconPath: mdiFilterVariant,
    onClick: () => undefined,
  };

  return (
    <>
      <div className="border-b border-stroke-weak pr-scrollbar">
        <PageContent isFullWidth className="flex items-center justify-between gap-x-3 px-6 py-2">
          <ViewPicker
            className="min-w-0 flex-1"
            label={t("Views")}
            selectedView={view}
            views={views}
            onAddView={() => undefined}
            onSelectView={setView}
          />

          <div className="flex shrink-0 items-center gap-x-3">
            <Typography appearance="moderate" brand="neutral-translucent" typographyType="body-sm">
              {t("121,867 results")}
            </Typography>

            <Search placeholder={t("Search mods...")} value={search} onChange={setSearch} />

            <Toolbar>
              <ToolbarGroup actions={[filter, displayOptions]} />
            </Toolbar>

            <Button
              appearance="weak"
              aria-label={t("More")}
              brand="neutral"
              leftIconPath={mdiDotsHorizontal}
            />
          </div>
        </PageContent>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="relative isolate flex min-w-0 flex-1 flex-col">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute bottom-0 -left-1/4 w-[200%]">
              <img alt="" className="w-full" src={heroUrl(heroGame)} />

              <div className="absolute inset-0 bg-linear-to-t from-surface-low/75 to-surface-low to-70%" />
            </div>
          </div>

          <PageScroll isFullWidth className="flex flex-col gap-y-3.5 p-6" ref={scrollRef}>
            {STATIC_MODS.map((mod) => (
              <ModCard
                isActive={mod.name === activeMod}
                key={mod.name}
                mod={mod}
                onSelect={() => setActiveMod(mod.name)}
              />
            ))}

            <Pagination
              currentPage={page}
              recordsPerPage={STATIC_MODS.length}
              scrollRef={scrollRef}
              totalRecords={STATIC_RESULTS}
              onPaginationUpdate={setPage}
            />
          </PageScroll>
        </div>

        <ModDetails mod={active} />
      </div>
    </>
  );
};
