import numeral from "numeral";
import React, { forwardRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import { Author } from "@/ui/components/author/Author";
import { Button } from "@/ui/components/button/Button";
import { Pill } from "@/ui/components/pill/Pill";
import { TabBar } from "@/ui/components/tabs/TabBar";
import { TabButton } from "@/ui/components/tabs/TabButton";
import { TabPanel } from "@/ui/components/tabs/TabPanel";
import { TabProvider } from "@/ui/components/tabs/Tabs.context";
import { Typography } from "@/ui/components/typography/Typography";
import { useRelativeTime } from "@/util/useRelativeTime";

import { type IGalleryImage, ModGallery } from "./mod_gallery/ModGallery";

// const placeholderClass =
//   "flex items-center justify-center rounded-sm border border-dashed border-stroke-moderate p-4 text-center";

interface IModDetailsProps {
  /** The mod picked in the list. */
  mod: ModSummary;
  /** The mod's pictures, the first shown large to begin with. */
  gallery: IGalleryImage[];
  /** Told the picture now shown large, whenever another is picked. */
  onPick: (image: IGalleryImage) => void;
}

/**
 * The selected mod's details (LAZ-1346), for the mod picked in the list. Its files and comments
 * tabs are commented out until there's an API for them, and its tags until the mod search
 * returns them. It fills the right half of the page and scrolls on its own, so the list beside
 * it keeps its place; what scrolls fades out into its bottom padding. It has no background of
 * its own: the picture picked in its gallery lies behind the page's body, which blurs it.
 */
export const ModDetails = forwardRef<HTMLDivElement, IModDetailsProps>(
  ({ mod, gallery, onPick }, ref) => {
    const { t } = useTranslation();
    const [tab, setTab] = useState("details");
    const updated = useRelativeTime(new Date(mod.updated_at).getTime(), t);
    const created = useRelativeTime(new Date(mod.created_at).getTime(), t);

    const stats = [
      { label: t("Endorsements"), value: numeral(mod.endorsements).format("0a") },
      { label: t("Unique DLs"), value: numeral(mod.unique_downloads).format("0a") },
      { label: t("Total DLs"), value: numeral(mod.downloads).format("0a") },
      { label: t("Updated"), value: updated },
      { label: t("Created"), value: created },
      { label: t("File size"), value: numeral(mod.file_size_kilobytes * 1024).format("0.0b") },
    ];

    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col" ref={ref}>
        <TabProvider
          tab={tab}
          tabListId="browse-mod-details-tabs"
          tabType="secondary"
          onSetSelectedTab={setTab}
        >
          <div className="flex min-h-0 flex-1 scrollbar-gutter-stable flex-col gap-y-3 overflow-y-auto scroll-fade p-6 pb-9 scroll-fade-9">
            <div className="flex items-start gap-x-4">
              <TabBar className="min-w-0 flex-1">
                <TabButton name={t("Details")} panelId="details" />

                {/* <TabButton name={t("Files")} panelId="files" /> */}

                {/* <TabButton name={t("Comments")} panelId="comments" /> */}
              </TabBar>

              <Button leftIcon="download" size="sm">
                {t("1-click install")}
              </Button>
            </div>

            <TabPanel id="details">
              <div className="flex flex-col gap-y-3">
                <ModGallery images={gallery} isAdult={mod.adult} key={mod.id} onPick={onPick} />

                <div className="flex flex-wrap items-center gap-2">
                  <Typography
                    appearance="moderate"
                    as="div"
                    brand="neutral-translucent"
                    typographyType="body-sm"
                  >
                    <Author name={mod.author.name} />
                  </Typography>

                  <span aria-hidden className="h-5.5 w-px bg-stroke-weak" />

                  <div className="flex flex-wrap gap-1">
                    {mod.adult && (
                      <Pill brand="danger" icon={{ name: "fiber_manual_record", filled: true }}>
                        {t("Adult")}
                      </Pill>
                    )}

                    {!!mod.category && <Pill>{mod.category.name}</Pill>}

                    {/* <Pill>{t("+10 more")}</Pill> */}
                  </div>
                </div>

                <div className="flex flex-col gap-y-1">
                  <Typography
                    appearance="moderate"
                    as="h3"
                    className="font-medium"
                    typographyType="body-xl"
                  >
                    {mod.name}
                  </Typography>

                  <Typography appearance="subdued">{mod.summary}</Typography>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-stroke-weak pt-4 pb-2">
                  {stats.map(({ label, value }) => (
                    <div className="min-w-24 flex-1" key={label}>
                      <Typography appearance="moderate" className="font-medium">
                        {value}
                      </Typography>

                      <Typography
                        appearance="subdued"
                        brand="neutral-translucent"
                        typographyType="body-sm"
                      >
                        {label}
                      </Typography>
                    </div>
                  ))}
                </div>
              </div>
            </TabPanel>

            {/* <TabPanel id="files">
              <div className={placeholderClass}>{t("The mod's files will go here")}</div>
            </TabPanel> */}

            {/* <TabPanel id="comments">
              <div className={placeholderClass}>{t("The mod's comments will go here")}</div>
            </TabPanel> */}
          </div>
        </TabProvider>
      </div>
    );
  },
);

ModDetails.displayName = "ModDetails";
