import numeral from "numeral";
import React, { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useDisplayOptionsAction } from "@/ui/components/display_options/useDisplayOptionsAction.hook";
import { SplitButton, SplitButtonAction } from "@/ui/components/split_button/SplitButton";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import { type IToolbarAction, ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";
import { useToolbarAnalytics } from "@/ui/components/toolbar/useToolbarAnalytics.hook";
import { Typography } from "@/ui/components/typography/Typography";
import { PageContent } from "@/views/components/Page/PageContent";

// import { Search } from "../../../../gamemode_management/components/search/Search";
import type { TimeRangeSource } from "../../../hooks/browse_mods_tracking/browseModsTracker";
import { useBrowseModsTracker } from "../../../hooks/browse_mods_tracking/BrowseModsTracking.context";
import type { IBrowseModsPanelRefs } from "../../../hooks/use_browse_mods_views/useBrowseModsViews.hook";
import { type IModSearch } from "../../../hooks/use_mod_search/useModSearch.hook";
import { type IModFilters, isPreset, PRESET_SORTS } from "../../../util/mod_views/modViews";
import { ModFilters, ModTimeRangeMenu, timeRanges } from "../mod_filters/ModFilters";
import { ModSortOptions } from "../mod_sort_options/ModSortOptions";

interface IBrowseModsBarProps {
  /** The active game's mod search, its presets, sorts and total. */
  search: IModSearch;
  /** The views to pick from, as `useBrowseModsViews` has them. */
  viewPicker: ReactNode;
  /** The Filter menu and View options, for a view's menu to open. */
  panelRefs: IBrowseModsPanelRefs;
}

/**
 * The bar over Browse's mods: its views, results count, the time range while one is on, filter and
 * view options. Counts each change, and the toolbar's clicks.
 */
export const BrowseModsBar = ({ search, viewPicker, panelRefs }: IBrowseModsBarProps) => {
  const { t } = useTranslation();
  // const [search, setSearch] = useState("");
  const tracker = useBrowseModsTracker();
  const toolbarTracking = useToolbarAnalytics("browse_mods");
  const view = search.trackedView;
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

  const filter: IToolbarAction = {
    id: "filter",
    panelHandle: panelRefs.filters,
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
      if (!isPreset(view)) {
        return;
      }

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
        {viewPicker}

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
            <ToolbarGroup
              actions={[
                filter,
                { ...displayOptions, id: "view-options", panelHandle: panelRefs.viewOptions },
              ]}
            />
          </Toolbar>
        </div>
      </PageContent>
    </div>
  );
};
