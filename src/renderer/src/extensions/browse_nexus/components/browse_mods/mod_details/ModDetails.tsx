import { useQuery } from "@tanstack/react-query";
import numeral from "numeral";
import React, { forwardRef, type KeyboardEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { NEXUS_BASE_URL } from "@/extensions/nexus_integration/constants";
import { modQuery } from "@/extensions/nexus_integration/queries/mod/mod.query";
import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { Author } from "@/ui/components/author/Author";
import { Button } from "@/ui/components/button/Button";
import { BBCode } from "@/ui/components/prose/bbcode/BBCode";
import { TabBar } from "@/ui/components/tabs/TabBar";
import { TabButton } from "@/ui/components/tabs/TabButton";
import { TabPanel } from "@/ui/components/tabs/TabPanel";
import { TabProvider } from "@/ui/components/tabs/Tabs.context";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { Typography } from "@/ui/components/typography/Typography";
import { hasModifierKey } from "@/ui/utils/hasModifierKey";
import { useRelativeTime } from "@/util/useRelativeTime";

import { type IGalleryImage, ModGallery } from "./mod_gallery/ModGallery";
import { ModTags } from "./mod_tags/ModTags";
import { ModDetailsDescriptionSkeleton } from "./ModDetailsDescription.skeleton";

// const placeholderClass =
//   "flex items-center justify-center rounded-sm border border-dashed border-stroke-moderate p-4 text-center";

interface IModDetailsProps {
  api: IExtensionApi;
  /** The mod picked in the list. */
  mod: ModSummary;
  /** The mod's pictures, the first shown large to begin with. */
  gallery: IGalleryImage[];
  /** Told the picture now shown large, whenever another is picked. */
  onPick: (image: IGalleryImage) => void;
  /** Asked to move focus back to the list, on Left. */
  onFocusList?: () => void;
}

/** What uses Left itself in the details, so it doesn't leave them there. */
const OWNS_LEFT = 'input, textarea, select, [contenteditable="true"], [role="tablist"]';

/**
 * The picked mod's details: gallery, stats, author, pills and description. Shows the
 * search's result at once, and the tags and description once the mod's own query has them.
 */
export const ModDetails = forwardRef<HTMLDivElement, IModDetailsProps>(
  ({ api, mod, gallery, onPick, onFocusList }, ref) => {
    const { t } = useTranslation();
    const details = useQuery(modQuery(api, mod.id));
    const tags = details.data?.tags ?? [];
    const [tab, setTab] = useState("details");
    const updated = useRelativeTime(new Date(mod.updated_at).getTime(), t);
    const created = useRelativeTime(new Date(mod.created_at).getTime(), t);

    /**
     * Left leaves the details for the list, unless what's focused has used the key or uses Left
     * itself, as the tabs and text fields do.
     */
    const leaveOnLeft = (event: KeyboardEvent<HTMLDivElement>) => {
      const target = event.target instanceof Element ? event.target : undefined;

      if (event.key !== "ArrowLeft" || event.defaultPrevented || hasModifierKey(event)) {
        return;
      }

      if (!onFocusList || target?.closest(OWNS_LEFT)) {
        return;
      }

      event.preventDefault();
      onFocusList();
    };

    const stats = [
      { label: t("Endorsements"), value: numeral(mod.endorsements).format("0a") },
      { label: t("Unique DLs"), value: numeral(mod.unique_downloads).format("0a") },
      { label: t("Total DLs"), value: numeral(mod.downloads).format("0a") },
      { label: t("Updated"), value: updated },
      { label: t("Created"), value: created },
      { label: t("File size"), value: numeral(mod.file_size_kilobytes * 1024).format("0.0b") },
    ];

    return (
      <div
        aria-label={t("Mod details")}
        className="flex min-h-0 min-w-0 flex-1 flex-col has-[>:focus-visible]:outline-2 has-[>:focus-visible]:-outline-offset-2 has-[>:focus-visible]:outline-focus-subdued"
        role="region"
        onKeyDown={leaveOnLeft}
      >
        <TabProvider
          tab={tab}
          tabListId="browse-mod-details-tabs"
          tabType="secondary"
          onSetSelectedTab={setTab}
        >
          <div className="flex scrollbar-gutter-stable items-start gap-x-4 overflow-hidden px-6 pt-6 pb-3">
            <TabBar className="min-w-0 flex-1">
              <TabButton name={t("Details")} panelId="details" />

              {/* <TabButton name={t("Files")} panelId="files" /> */}

              {/* <TabButton name={t("Comments")} panelId="comments" /> */}
            </TabBar>

            {/* <Button leftIcon="download" size="sm">
                {t("1-click install")}
              </Button> */}

            <Tooltip content={t("Open mod page")}>
              <Button
                appearance="moderate"
                aria-label={t("Open mod page")}
                brand="neutral"
                leftIcon="open_in_new"
                onClick={() =>
                  window.api.shell.openUrl(
                    [NEXUS_BASE_URL, mod.game.domain_name, "mods", mod.game_scoped_id].join("/"),
                  )
                }
              />
            </Tooltip>
          </div>

          <div
            className="flex min-h-0 flex-1 scrollbar-gutter-stable flex-col overflow-y-auto scroll-fade px-6 pb-9 backdrop-dim-source scroll-fade-9 focus-visible:outline-none"
            ref={ref}
            tabIndex={-1}
          >
            <TabPanel id="details">
              <div className="flex flex-col gap-y-3">
                <ModGallery
                  images={gallery}
                  isAdult={mod.adult}
                  isLoading={details.isPending}
                  key={mod.id}
                  onPick={onPick}
                />

                <div className="@container border-y border-stroke-weak py-4">
                  <div className="grid grid-cols-3 gap-2 @2xl:grid-cols-6">
                    {stats.map(({ label, value }) => (
                      <div className="min-w-0 justify-self-center" key={label}>
                        <Typography
                          appearance="subdued"
                          brand="neutral-translucent"
                          typographyType="body-sm"
                        >
                          {label}
                        </Typography>

                        <Typography appearance="moderate" className="font-medium">
                          {value}
                        </Typography>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
                  <Typography
                    appearance="moderate"
                    as="div"
                    brand="neutral-translucent"
                    typographyType="body-sm"
                  >
                    <Author name={mod.author.name} />
                  </Typography>

                  <span aria-hidden className="mx-1 h-5.5 w-px bg-stroke-weak" />

                  <ModTags
                    category={mod.category?.name}
                    isAdult={mod.adult}
                    isLoading={details.isPending}
                    tags={tags}
                  />
                </div>

                <div className="pt-6">
                  {details.isPending && <ModDetailsDescriptionSkeleton />}

                  {details.isError && !details.data && (
                    <Typography appearance="subdued" brand="neutral-translucent">
                      {t("The mod's description couldn't be loaded.")}
                    </Typography>
                  )}

                  {!!details.data?.description && (
                    <BBCode
                      bbcode={details.data.description}
                      className="text-neutral-strong"
                      isFromAdultContent={mod.adult}
                    />
                  )}
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
