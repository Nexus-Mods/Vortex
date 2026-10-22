import { GameId } from "@vortex/shared";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { useDisplayOptionsAction } from "@/ui/components/display_options/useDisplayOptionsAction.hook";
import { Picker } from "@/ui/components/picker/Picker";
import { PopoverPanelGroup } from "@/ui/components/popover/PopoverPanelGroup";
import { PopoverPanelGroupItem } from "@/ui/components/popover/PopoverPanelGroupItem";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import { type IToolbarAction, ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";
import { Typography } from "@/ui/components/typography/Typography";
import { type IViewPickerView, ViewPicker } from "@/ui/components/view_picker/ViewPicker";
import { useGameArt } from "@/views/components/game_art/GameArt.context";
import { PageContent } from "@/views/components/Page/PageContent";

import { Search } from "../../../../gamemode_management/components/search/Search";

/** Games whose hero art can stand in for the open game's, so design can try it over each. */
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

/**
 * The bar over Browse's mods, a static wireframe (LAZ-1346): its views, then the results count,
 * search, filter and view options. Its views and search are its own for now, as nothing reads
 * them yet. The view options hold the game art's stand-in, so they're there only while the game
 * art is on. Like `PageHeader` it leaves `pr-scrollbar` for the scroll region's gutter below.
 */
export const BrowseModsBar = () => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [view, setView] = useState("trending");
  const { isEnabled: showsGameArt, previewGame, setPreviewGame } = useGameArt();

  const views: IViewPickerView[] = [
    { id: "trending", label: t("Trending") },
    { id: "popular", label: t("Most popular") },
    { id: "new", label: t("New") },
    {
      id: "custom",
      label: t("My custom view"),
      actions: [
        [
          { label: t("Rename view"), icon: "edit", onClick: () => undefined },
          { label: t("Edit view options"), icon: "tune", onClick: () => undefined },
          { label: t("Delete view"), icon: "delete", onClick: () => undefined },
        ],
      ],
    },
  ];

  const displayOptions = useDisplayOptionsAction({
    label: t("View options"),
    canReset: !!previewGame,
    children: (
      <PopoverPanelGroup>
        <PopoverPanelGroupItem passive label={t("Background art")}>
          <Picker<GameId | null>
            button={{ size: "sm" }}
            options={[
              { label: t("This game"), value: null },
              ...HERO_GAMES.map((game) => ({ label: game.name, value: game.id })),
            ]}
            value={previewGame ?? null}
            onChange={(gameId) => setPreviewGame(gameId ?? undefined)}
          />
        </PopoverPanelGroupItem>
      </PopoverPanelGroup>
    ),
    onReset: () => setPreviewGame(undefined),
  });

  const filter: IToolbarAction = {
    id: "filter",
    label: t("Filter"),
    icon: "filter_list",
    onClick: () => undefined,
  };

  return (
    <div className="border-b border-stroke-weak bg-surface-low pr-scrollbar">
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
            <ToolbarGroup actions={showsGameArt ? [filter, displayOptions] : [filter]} />
          </Toolbar>

          <Button appearance="weak" aria-label={t("More")} brand="neutral" leftIcon="more_horiz" />
        </div>
      </PageContent>
    </div>
  );
};
