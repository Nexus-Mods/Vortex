import { mdiCircleMedium, mdiDownload } from "@mdi/js";
import numeral from "numeral";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Author } from "@/ui/components/author/Author";
import { Button } from "@/ui/components/button/Button";
import { Pill } from "@/ui/components/pill/Pill";
import { TabBar } from "@/ui/components/tabs/TabBar";
import { TabButton } from "@/ui/components/tabs/TabButton";
import { TabPanel } from "@/ui/components/tabs/TabPanel";
import { TabProvider } from "@/ui/components/tabs/Tabs.context";
import { Typography } from "@/ui/components/typography/Typography";
import { useRelativeTime } from "@/util/useRelativeTime";

import { type IStaticMod, MOD_IMAGES, STATIC_MODS } from "../staticMods";
import { type IGalleryImage, ModGallery } from "./mod_gallery/ModGallery";

/** Skyrim SE screenshots from Nexus Mods, standing in for the selected mod's gallery. */
const STATIC_SCREENSHOTS = [
  "250116957-1745777127.jpg",
  "56492487-1564931448.png",
  "180634026-1782633084.jpg",
  "66238536-1776153857.jpg",
  "66238536-1778202756.jpg",
];

const SCREENSHOTS = "https://staticdelivery.nexusmods.com/images/1704";

/** A stand-in gallery: the mod's own picture, then screenshots and the other mods' pictures. */
const galleryFor = (mod: IStaticMod): IGalleryImage[] => [
  { src: `${MOD_IMAGES}/${mod.image}`, thumbnail: `${MOD_IMAGES}/thumbnails/${mod.image}` },
  ...STATIC_SCREENSHOTS.map((image) => ({
    src: `${SCREENSHOTS}/${image}`,
    thumbnail: `${SCREENSHOTS}/thumbnails/${image}`,
  })),
  ...STATIC_MODS.filter((other) => other.image !== mod.image).map((other) => ({
    src: `${MOD_IMAGES}/${other.image}`,
    thumbnail: `${MOD_IMAGES}/thumbnails/${other.image}`,
  })),
];

const placeholderClass =
  "flex items-center justify-center rounded-sm border border-dashed border-stroke-moderate p-4 text-center";

interface IModDetailsProps {
  /** The mod picked in the list. */
  mod: IStaticMod;
}

/**
 * The selected mod's details, files and comments, a static wireframe (LAZ-1346) showing
 * the mod picked in the list; its gallery, "+10 more" tag and unique downloads are stand-ins.
 * It fills the right half of the page, top to bottom, and scrolls on its own, so the list
 * beside it keeps its place; what scrolls fades out into its bottom padding. The picture picked
 * in the gallery, blurred and dimmed, is its background, fading into its surface further down.
 */
export const ModDetails = ({ mod }: IModDetailsProps) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState("details");
  const [picked, setPicked] = useState<{ mod: string; image: IGalleryImage }>();
  const gallery = useMemo(() => galleryFor(mod), [mod]);
  const shown = picked?.mod === mod.name ? picked.image : gallery[0];
  const updated = useRelativeTime(new Date(mod.updatedAt).getTime(), t);
  const created = useRelativeTime(new Date(mod.createdAt).getTime(), t);

  const stats = [
    { label: t("Endorsements"), value: numeral(mod.endorsements).format("0a") },
    { label: t("Unique DLs"), value: "—" },
    { label: t("Total DLs"), value: numeral(mod.downloads).format("0a") },
    { label: t("Updated"), value: updated },
    { label: t("Created"), value: created },
    { label: t("File size"), value: numeral(mod.fileSize * 1024).format("0.0b") },
  ];

  return (
    <div className="relative isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-l border-stroke-weak bg-surface-low shadow-sm">
      {!!shown && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 mask-b-from-40% mask-b-to-80%"
        >
          <img alt="" className="size-full scale-110 object-cover blur-3xl" src={shown.src} />

          <div className="absolute inset-0 bg-surface-low/75" />
        </div>
      )}

      <TabProvider
        tab={tab}
        tabListId="browse-mod-details-tabs"
        tabType="secondary"
        onSetSelectedTab={setTab}
      >
        <div className="flex min-h-0 flex-1 scrollbar-gutter-stable flex-col gap-y-3 overflow-y-auto p-6 pb-9">
          <div className="flex items-start gap-x-4">
            <TabBar className="min-w-0 flex-1">
              <TabButton name={t("Details")} panelId="details" />

              <TabButton name={t("Files")} panelId="files" />

              <TabButton name={t("Comments")} panelId="comments" />
            </TabBar>

            <Button leftIconPath={mdiDownload} size="sm">
              {t("1-click install")}
            </Button>
          </div>

          <TabPanel id="details">
            <div className="flex flex-col gap-y-3">
              <ModGallery
                images={gallery}
                isAdult={!!mod.isAdult}
                key={mod.name}
                onPick={(image) => setPicked({ mod: mod.name, image })}
              />

              <div className="flex flex-wrap items-center gap-2">
                <Typography
                  appearance="moderate"
                  as="div"
                  brand="neutral-translucent"
                  typographyType="body-sm"
                >
                  <Author name={mod.author} />
                </Typography>

                <span aria-hidden className="h-5.5 w-px bg-stroke-weak" />

                <div className="flex flex-wrap gap-1">
                  {mod.isAdult && (
                    <Pill brand="danger" iconPath={mdiCircleMedium}>
                      {t("Adult")}
                    </Pill>
                  )}

                  <Pill>{mod.category}</Pill>

                  <Pill>{t("+10 more")}</Pill>
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

          <TabPanel id="files">
            <div className={placeholderClass}>{t("The mod's files will go here")}</div>
          </TabPanel>

          <TabPanel id="comments">
            <div className={placeholderClass}>{t("The mod's comments will go here")}</div>
          </TabPanel>
        </div>
      </TabProvider>

      <div className="pointer-events-none absolute right-(--scrollbar-size) bottom-0 left-0 h-9 bg-linear-to-b from-transparent to-surface-low" />
    </div>
  );
};
