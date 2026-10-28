import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import { type IToolbarAction, ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";
import { Typography } from "@/ui/components/typography/Typography";
import { type IViewPickerView, ViewPicker } from "@/ui/components/view_picker/ViewPicker";
import { PageContent } from "@/views/components/Page/PageContent";

import { Search } from "../../../../gamemode_management/components/search/Search";

/**
 * The bar over Browse's mods, a static wireframe (LAZ-1346): its views, then the results count,
 * search and filter. Its views and search are its own for now, as nothing reads them yet. Like
 * `PageHeader` it leaves `pr-scrollbar` for the scroll region's gutter below.
 */
export const BrowseModsBar = () => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [view, setView] = useState("trending");

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
            <ToolbarGroup actions={[filter]} />
          </Toolbar>

          <Button appearance="weak" aria-label={t("More")} brand="neutral" leftIcon="more_horiz" />
        </div>
      </PageContent>
    </div>
  );
};
