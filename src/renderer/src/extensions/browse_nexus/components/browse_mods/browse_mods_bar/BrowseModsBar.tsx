import numeral from "numeral";
import React from "react";
import { useTranslation } from "react-i18next";

import { useDisplayOptionsAction } from "@/ui/components/display_options/useDisplayOptionsAction.hook";
import { SplitButton, SplitButtonAction } from "@/ui/components/split_button/SplitButton";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import { type IToolbarAction, ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";
import { useToolbarAnalytics } from "@/ui/components/toolbar/useToolbarAnalytics.hook";
import { Typography } from "@/ui/components/typography/Typography";
import { type IViewPickerView, ViewPicker } from "@/ui/components/view_picker/ViewPicker";
import { PageContent } from "@/views/components/Page/PageContent";

// import { Search } from "../../../../gamemode_management/components/search/Search";
import type { TimeRangeSource } from "../../../hooks/browse_mods_tracking/browseModsTracker";
import { useBrowseModsTracker } from "../../../hooks/browse_mods_tracking/BrowseModsTracking.context";
import {
  type IModFilters,
  type IModSearch,
  type ModPreset,
  PRESET_SORTS,
} from "../../../hooks/use_mod_search/useModSearch.hook";
import { ModFilters, ModTimeRangeMenu, timeRanges } from "../mod_filters/ModFilters";
import { ModSortOptions } from "../mod_sort_options/ModSortOptions";

/** The views that are presets, each sorting the mods its own way. */
const PRESETS: readonly string[] = ["trending", "popular", "new"] satisfies ModPreset[];

const isPreset = (view: string): view is ModPreset => PRESETS.includes(view);

interface IBrowseModsBarProps {
  /** The active game's mod search, its presets, sorts and total. */
  search: IModSearch;
}

/**
 * The bar over Browse's mods: views, results count, the time range while one is on, then filter
 * and view options. The time range's label opens the time ranges and its ✕ clears it. Custom
 * views and search are commented out until views can be saved and the search takes a term.
 * Counts each change, and the toolbar's clicks.
 */
export const BrowseModsBar = ({ search }: IBrowseModsBarProps) => {
  const { t } = useTranslation();
  // const [search, setSearch] = useState("");
  const tracker = useBrowseModsTracker();
  const toolbarTracking = useToolbarAnalytics("browse_mods");
  const view = search.preset;

  /** Picks a view, sorting the mods by its preset. */
  const selectView = (id: string) => {
    if (isPreset(id)) {
      search.selectPreset(id);
      tracker.trackViewSelected({ view: id, previous_view: view });
    }
  };

  /** Changes some filters, from wherever they were changed; any already as asked are left be. */
  const changeFilters = (change: Partial<IModFilters>, source: TimeRangeSource) => {
    const changed: Partial<IModFilters> = Object.fromEntries(
      Object.entries(change).filter(
        ([key, value]) => value !== search.filters[key as keyof IModFilters],
      ),
    );

    if (!Object.keys(changed).length) {
      return;
    }

    search.setFilters(changed);

    if (changed.timeRange) {
      tracker.trackTimeRangeChanged({
        view,
        time_range: changed.timeRange,
        previous_time_range: search.filters.timeRange,
        source,
      });
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
    id: "filter",
    label: t("Filter"),
    icon: "filter_list",
    hasPip: !!search.activeFilterCount,
    panelRole: "menu",
    panel: ({ dismiss }) => (
      <ModFilters
        changedCount={search.changedFilterCount}
        filters={search.filters}
        onChange={(change) => changeFilters(change, "filter_menu")}
        onReset={() => {
          search.resetFilters();
          tracker.trackFiltersReset({ view, filter_count: search.changedFilterCount });
        }}
        onSelect={dismiss}
      />
    ),
  };

  const timeRange = timeRanges(t).find(({ value }) => value === search.filters.timeRange);

  const displayOptions = useDisplayOptionsAction({
    label: t("View options"),
    canReset: search.canResetSort,
    children: (
      <ModSortOptions
        sort={search.sort}
        onChange={(change) => {
          const sort = { ...search.sort, ...change };

          if (sort.field === search.sort.field && sort.direction === search.sort.direction) {
            return;
          }

          search.setSort(change);
          tracker.trackSortChanged({
            view,
            sort_field: sort.field,
            sort_direction: sort.direction,
            is_reset: false,
          });
        }}
      />
    ),
    onReset: () => {
      search.resetSort();
      tracker.trackSortChanged({
        view,
        sort_field: PRESET_SORTS[view].field,
        sort_direction: PRESET_SORTS[view].direction,
        is_reset: true,
      });
    },
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
                  onClick={() => changeFilters({ timeRange: "all" }, "applied_filter_clear")}
                />
              }
              appearance="subdued"
              brand="neutral"
              leftIcon="calendar_today"
              panel={({ close }) => (
                <ModTimeRangeMenu
                  timeRange={search.filters.timeRange}
                  onChange={(timeRange) => changeFilters({ timeRange }, "applied_filter")}
                  onSelect={close}
                />
              )}
              panelRole="menu"
              size="sm"
            >
              {timeRange?.short}
            </SplitButton>
          )}

          {/* <Search placeholder={t("Search mods...")} value={search} onChange={setSearch} /> */}

          <Toolbar tracking={toolbarTracking}>
            <ToolbarGroup actions={[filter, { ...displayOptions, id: "view-options" }]} />
          </Toolbar>
        </div>
      </PageContent>
    </div>
  );
};
