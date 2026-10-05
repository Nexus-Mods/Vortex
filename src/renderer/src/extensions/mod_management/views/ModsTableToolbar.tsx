import { mdiFilterVariant, mdiMagnify, mdiPlus, mdiTune } from "@mdi/js";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { TabBar } from "@/ui/components/tabs/TabBar";
import { TabButton } from "@/ui/components/tabs/TabButton";
import { TabProvider } from "@/ui/components/tabs/Tabs.context";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import { ToolbarButton } from "@/ui/components/toolbar/ToolbarButton";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";
import { ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";

/**
 * The new Mods table's tabs and actions, in its sticky head. Placeholders for now: the
 * tabs only change which is selected, and the buttons do nothing.
 */
export const ModsTableToolbar = () => {
  const { t } = useTranslation(["common"]);
  const [tab, setTab] = useState("collections");

  const actions = useMemo<IToolbarAction[]>(
    () => [
      { iconPath: mdiFilterVariant, label: t("Filter") },
      { iconPath: mdiTune, label: t("View options") },
      { iconPath: mdiMagnify, label: t("Search") },
    ],
    [t],
  );

  return (
    <>
      <div className="flex min-w-0 items-center gap-x-1">
        <TabProvider
          tab={tab}
          tabListId="mods-table-tabs"
          tabType="secondary"
          onSetSelectedTab={setTab}
        >
          <TabBar>
            <TabButton name={t("All mods")} panelId="all" />

            <TabButton name={t("Updates available")} panelId="updates" />

            <TabButton name={t("Collections")} panelId="collections" />

            <TabButton name={t("Author")} panelId="author" />
          </TabBar>
        </TabProvider>

        {/* Adds a tab, so it sits with them rather than in the toolbar. */}
        <ToolbarButton
          appearance="weak"
          brand="neutral"
          label={t("Add tab")}
          leftIconPath={mdiPlus}
        />
      </div>

      {/* flex-1, so the actions that don't fit go to its overflow menu. */}
      <Toolbar className="min-w-0 flex-1 justify-end">
        <ToolbarGroup actions={actions} />
      </Toolbar>
    </>
  );
};
