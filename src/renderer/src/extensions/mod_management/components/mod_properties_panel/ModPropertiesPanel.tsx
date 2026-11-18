import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { NoResults } from "@/ui/components/no_results/NoResults";
import { TabBar } from "@/ui/components/tabs/TabBar";
import { TabButton } from "@/ui/components/tabs/TabButton";
import { TabPanel } from "@/ui/components/tabs/TabPanel";
import { TabProvider } from "@/ui/components/tabs/Tabs.context";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

import type {
  IRegisteredDetails,
  ModPropertiesTab,
  IModProperties,
} from "../../hooks/use_mod_properties/useModProperties.hook";
import { useModProperties } from "../../hooks/use_mod_properties/useModProperties.hook";
import {
  RegisteredModsVersionsProvider,
  useExternalDataVersions,
} from "../../hooks/use_registered_mods_columns/useRegisteredModsColumns.hook";
import type { IMod } from "../../types/IMod";
import type { IModWithState } from "../../types/IModProps";
import { ModPropertiesCard } from "../mod_properties_card/ModPropertiesCard";
import { ModPropertySection } from "../mod_property_section/ModPropertySection";

interface IModPropertiesPanelProps {
  /** The selected mods, whose properties it works out and shows. */
  mods: IModWithState[];
  /** The collections each mod is in, by mod id. */
  memberships: { [modId: string]: IMod[] };
  /** The fields extensions registered for the legacy details pane. */
  registered: IRegisteredDetails;
  onClose: () => void;
  /** Classes for its frame, which the page sizes and places. */
  className?: string;
}

const TABS: ModPropertiesTab[] = ["general", "advanced"];

/** The sections on a tab, ruled off from each other. */
const sectionsOn = (properties: IModProperties, tab: ModPropertiesTab) =>
  properties.sections
    .filter((section) => section.tab === tab)
    .map((section) => <ModPropertySection key={section.id} section={section} />);

/**
 * The selected mods' properties, beside the new Mods table, some of them to change. One mod's are
 * on two tabs: General, headed by its card, and Advanced, left out while it has nothing. Several
 * mods show their count and what they can all change, and none an empty state. The tab the user
 * picked stays as the selection changes, falling back to General where it's gone.
 */
export const ModPropertiesPanel = ({
  mods,
  memberships,
  registered,
  onClose,
  className,
}: IModPropertiesPanelProps) => {
  const { t } = useTranslation("mod_management");
  const { detailsOnly, values } = registered;
  // Its extension fields that aren't columns are worked out again as it opens, before they're
  // drawn, as no one heard of a change to their data while it was closed, nor since the table
  // stopped showing one as a column; quietly, as the table doesn't show them.
  useState(() => detailsOnly.forEach(({ id }) => values.invalidate(id, { quietly: true })));
  // Worked out here, only while the panel is mounted, as it reads a mod's INI edits from disk and
  // each change re-renders only the panel, not the table.
  const properties = useModProperties(mods, memberships, registered);
  // The data outside the mods of those fields, which the table doesn't hear of, listened for only
  // while it's open. A change draws only the panel again, not telling the table, which doesn't
  // show them. It's only ever beside the new table.
  const versions = useExternalDataVersions(detailsOnly, true, values, true);
  const [picked, setPicked] = useState<ModPropertiesTab>("general");

  // Each written out, so the strings can be found.
  const tabLabels: Record<ModPropertiesTab, string> = {
    general: t("modsTable::properties::general"),
    advanced: t("modsTable::properties::advanced"),
  };

  const tabs = TABS.filter(
    (id) =>
      (id === "general" && properties.card !== undefined) ||
      properties.sections.some((section) => section.tab === id),
  );
  const tab = tabs.includes(picked) ? picked : "general";

  const closeButton = (
    <Button
      appearance="weak"
      brand="neutral"
      className="ml-auto"
      data-testid="mod-properties-close"
      leftIcon="close"
      size="sm"
      title={t("modsTable::properties::close")}
      onClick={onClose}
    />
  );

  const body = () => {
    if (properties.count === 0) {
      return (
        <div className="flex items-start gap-x-2">
          <div className="flex-1" data-testid="mod-properties-empty">
            <NoResults icon="info" title={t("modsTable::properties::noSelection")} />
          </div>

          {closeButton}
        </div>
      );
    }

    // What they can all change, under their count: there's no card or tab to tell them apart.
    if (properties.count > 1) {
      return (
        <>
          <div className="flex items-center gap-x-2 pb-4">
            <Typography appearance="moderate" data-testid="mod-properties-count">
              {t("modsTable::properties::count", { count: properties.count })}
            </Typography>

            {closeButton}
          </div>

          {/* General's then Advanced's, in one run, as there are no tabs to put them on. */}
          <div className="flex flex-col divide-y divide-stroke-weak">
            {sectionsOn(properties, "general")}
            {sectionsOn(properties, "advanced")}
          </div>
        </>
      );
    }

    return (
      <TabProvider
        tab={tab}
        tabListId="mod-properties"
        tabType="secondary"
        onSetSelectedTab={(next) => setPicked(next as ModPropertiesTab)}
      >
        <div className="flex items-center gap-x-1 pb-4">
          <TabBar className="min-w-0 flex-1">
            {tabs.map((id) => (
              <TabButton
                // Picked out from the panel, whose colour a selected secondary tab otherwise takes.
                className="aria-selected:bg-surface-translucent-low aria-selected:text-neutral-strong"
                key={id}
                name={tabLabels[id]}
                panelId={id}
              />
            ))}
          </TabBar>

          {closeButton}
        </div>

        {tabs.map((id) => (
          <TabPanel className="flex flex-col divide-y divide-stroke-weak" id={id} key={id}>
            {id === "general" && !!properties.card && (
              <div className="pb-4">
                <ModPropertiesCard card={properties.card} />
              </div>
            )}

            {sectionsOn(properties, id)}
          </TabPanel>
        ))}
      </TabProvider>
    );
  };

  return (
    <aside
      aria-label={t("modsTable::properties::label")}
      className={joinClasses(["flex min-h-0 flex-col overflow-y-auto px-5 pb-4", className])}
      data-testid="mod-properties-panel"
    >
      <RegisteredModsVersionsProvider versions={versions}>{body()}</RegisteredModsVersionsProvider>
    </aside>
  );
};
