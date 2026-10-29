import numeral from "numeral";
import React from "react";
import { useTranslation } from "react-i18next";

import { useDisplayOptionsAction } from "@/ui/components/display_options/useDisplayOptionsAction.hook";
import { SplitButton, SplitButtonAction } from "@/ui/components/split_button/SplitButton";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import { type IToolbarAction, ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";
import { Typography } from "@/ui/components/typography/Typography";
import { type IViewPickerView, ViewPicker } from "@/ui/components/view_picker/ViewPicker";
import { PageContent } from "@/views/components/Page/PageContent";

// import { Search } from "../../../../gamemode_management/components/search/Search";
import type { IModSearch, ModPreset } from "../../../hooks/use_mod_search/useModSearch.hook";
import { ModFilters, timeRanges } from "../mod_filters/ModFilters";
import { ModSortOptions } from "../mod_sort_options/ModSortOptions";

/** The views that are presets, each sorting the mods its own way. */
const PRESETS: readonly string[] = ["trending", "popular", "new"] satisfies ModPreset[];

const isPreset = (view: string): view is ModPreset => PRESETS.includes(view);

interface IBrowseModsBarProps {
  /** The active game's mod search, its presets, sorts and total. */
  search: IModSearch;
}

/**
 * The bar over Browse's mods: its views, then the results count, the time range while one is on,
 * search, filter and view options. Picking a view sorts the mods by its preset, the filter
 * narrows which it shows, with a pip while any filter is on, and the view options change how the
 * open one sorts, as the mods table's do its views. The time range shows as a split button whose
 * ✕ takes it back to all time. The custom view and adding one are commented out until views can
 * be saved, and search until the mod search takes a term. Like `PageHeader` it leaves
 * `pr-scrollbar` for the scroll region's gutter below.
 */
export const BrowseModsBar = ({ search }: IBrowseModsBarProps) => {
  const { t } = useTranslation();
  // const [search, setSearch] = useState("");

  /** Picks a view, sorting the mods by its preset. */
  const selectView = (id: string) => {
    if (isPreset(id)) {
      search.selectPreset(id);
    }
  };

  const views: IViewPickerView[] = [
    { id: "trending", label: t("Trending") },
    { id: "popular", label: t("Most popular") },
    { id: "new", label: t("New releases") },
    // {
    //   id: "custom",
    //   label: t("My custom view"),
    //   actions: [
    //     [
    //       { label: t("Rename view"), icon: "edit", onClick: () => undefined },
    //       { label: t("Edit view options"), icon: "tune", onClick: () => undefined },
    //       { label: t("Delete view"), icon: "delete", onClick: () => undefined },
    //     ],
    //   ],
    // },
  ];

  const filter: IToolbarAction = {
    label: t("Filter"),
    icon: "filter_list",
    hasPip: !!search.activeFilterCount,
    panelRole: "menu",
    panel: ({ dismiss }) => (
      <ModFilters
        activeCount={search.activeFilterCount}
        filters={search.filters}
        onChange={search.setFilters}
        onReset={search.resetFilters}
        onSelect={dismiss}
      />
    ),
  };

  const timeRange = timeRanges(t).find(({ value }) => value === search.filters.timeRange);

  const displayOptions = useDisplayOptionsAction({
    label: t("View options"),
    canReset: search.canResetSort,
    children: <ModSortOptions sort={search.sort} onChange={search.setSort} />,
    onReset: search.resetSort,
  });

  return (
    <div className="border-b border-stroke-weak bg-surface-low pr-scrollbar">
      <PageContent isFullWidth className="flex items-center justify-between gap-x-4 px-6 py-3">
        <ViewPicker
          className="min-w-0 flex-1"
          label={t("Views")}
          selectedView={search.preset}
          views={views}
          // onAddView={() => undefined}
          onSelectView={selectView}
        />

        <div className="flex shrink-0 items-center gap-x-4">
          <Typography appearance="subdued" brand="neutral-translucent" typographyType="body-sm">
            {t("{{total}} results", {
              count: search.totalCount,
              total: numeral(search.totalCount).format("0,0"),
            })}
          </Typography>

          {search.filters.timeRange !== "all" && (
            <SplitButton
              action={
                <SplitButtonAction
                  icon="close"
                  label={t("Remove time range filter")}
                  onClick={() => search.setFilters({ timeRange: "all" })}
                />
              }
              appearance="subdued"
              brand="neutral"
              leftIcon="calendar_today"
              size="sm"
            >
              {timeRange?.short}
            </SplitButton>
          )}

          {/* <Search placeholder={t("Search mods...")} value={search} onChange={setSearch} /> */}

          <Toolbar>
            <ToolbarGroup actions={[filter, displayOptions]} />
          </Toolbar>
        </div>
      </PageContent>
    </div>
  );
};
