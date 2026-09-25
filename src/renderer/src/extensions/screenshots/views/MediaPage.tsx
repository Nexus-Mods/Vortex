import { mdiCogOutline, mdiOpenInNew, mdiRefresh } from "@mdi/js";
import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";

import { setOpenMainPage, setSettingsPage } from "@/actions";
import { type IExtensionApi } from "@/types/api";
import { Button } from "@/ui/components/button/Button";
import { Listing } from "@/ui/components/listing/Listing";
import { Pagination } from "@/ui/components/pagination/Pagination";
import { TabBar } from "@/ui/components/tabs/TabBar";
import { TabButton } from "@/ui/components/tabs/TabButton";
import { TabPanel } from "@/ui/components/tabs/TabPanel";
import { TabProvider } from "@/ui/components/tabs/Tabs.context";
import { Typography } from "@/ui/components/typography/Typography";
import { Page } from "@/views/components/Page/Page";
import { PageHeader } from "@/views/components/Page/PageHeader";
import { PageScroll } from "@/views/components/Page/PageScroll";

import { BetaBadge } from "../components/BetaBadge";
import MediaListItem from "../components/MediaListItem";
import MediaListItemSkeleton from "../components/MediaListItemSkeleton";
import useGameMedia from "../hooks/GameMediaHook";
import type { GameMediaItem } from "../util/mediaTypes";
import { resolveTString } from "../util/resolveTString";
import MediaPageNoResults from "./MediaPageNoResults";
import MediaSingleView from "./MediaSingleView";

interface IMediaPageProps {
  api: IExtensionApi;
  active?: boolean;
}

export default function MediaPage({ active, api }: IMediaPageProps) {
  const { t } = useTranslation("media_page");
  const dispatch = useDispatch();
  const [selected, setSelected] = useState<GameMediaItem | null>(null);
  const [tab, setTab] = useState<string>("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    isLoading,
    isError,
    error,
    allSources,
    items,
    forceCollect,
    game,
    disabledSources,
    bySource,
    pageItems,
    page,
    setPage,
    total,
    pageSize,
  } = useGameMedia(tab);

  const refreshAll = () => void forceCollect();

  const openSettings = () => {
    dispatch(setOpenMainPage("game_settings", false));
    dispatch(setSettingsPage("Media"));
  };

  if (selected) {
    return (
      <MediaSingleView
        active={active}
        api={api}
        entry={selected}
        source={allSources[selected.sourceId]}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <Page active={active} id="media-page" scrollable={false}>
      <PageHeader
        customTitle={(compact) => (
          <div className="flex items-center gap-x-1.5">
            <Typography
              appearance={compact ? "subdued" : "moderate"}
              as="h2"
              className="transition-colors"
              typographyType="heading-xs"
            >
              {t("shared::title")}
            </Typography>

            <BetaBadge isSubdued={compact} />
          </div>
        )}
        pictogramName="camera"
        subtitle={t("shared::subtitle")}
        // title={t("shared::title")}
      >
        <div className="flex shrink-0 items-center gap-x-2">
          <Button
            appearance="weak"
            brand="neutral"
            data-testid={"refresh-media"}
            disabled={isLoading}
            leftIconPath={mdiRefresh}
            size="sm"
            title={t("common:::refresh")}
            onClick={refreshAll}
          />

          <Button
            appearance="weak"
            brand="neutral"
            data-testid={"open-media-settings"}
            leftIconPath={mdiCogOutline}
            size="sm"
            title={t("common:::settings")}
            onClick={openSettings}
          />
        </div>
      </PageHeader>

      <PageScroll className="space-y-2 p-6" ref={scrollRef}>
        {/* The actual page content */}
        <TabProvider tab={tab} tabListId="game-media-tabs" onSetSelectedTab={setTab}>
          <TabBar className="mb-2">
            <TabButton count={items?.length ?? 0} name={t("listing::all_tab")} panelId="all" />

            {!!allSources &&
              Object.entries(allSources)
                .filter(([k]) => !disabledSources?.includes(k))
                .map(([k, s]) => (
                  <TabButton
                    count={bySource[k]?.length ?? 0}
                    key={k}
                    name={resolveTString(t, s.name)}
                    panelId={k}
                  />
                ))}
          </TabBar>

          <TabPanel id="all">
            <Typography
              appearance="subdued"
              brand="neutral-translucent"
              className="mb-2"
              typographyType="body-sm"
            >
              {t("listing::all_subtitle", {
                game: game?.name ?? "Unknown Game",
              })}
            </Typography>

            <Listing
              appendLoader={true}
              className="grid grid-cols-[repeat(auto-fit,minmax(240px,0.2fr))] gap-4"
              customNoResults={
                <MediaPageNoResults
                  disabledSources={disabledSources}
                  openSettings={openSettings}
                  refresh={refreshAll}
                />
              }
              entityCount={items?.length ?? 0}
              errorTitle={error?.message}
              isError={isError}
              isLoading={isLoading}
              skeletonCount={24}
              SkeletonTile={MediaListItemSkeleton}
            >
              {pageItems?.map((i) => (
                <MediaListItem
                  game={game}
                  item={i}
                  key={`${i.sourceId}:${i.name}`}
                  onClick={() => setSelected(i)}
                />
              ))}
            </Listing>
          </TabPanel>

          {!!allSources &&
            Object.keys(allSources)
              .filter((k) => !disabledSources?.includes(k))
              .map((k) => (
                <TabPanel id={k} key={`source-tab-${k}`}>
                  <div className="my-1 flex items-center justify-between">
                    <Typography
                      appearance="subdued"
                      brand="neutral-translucent"
                      className="mb-2"
                      typographyType="body-sm"
                    >
                      {resolveTString(t, allSources[k]?.description) ??
                        t("shared::media_from", { source: resolveTString(t, allSources[k]?.name) })}
                    </Typography>

                    <Button
                      appearance="subdued"
                      brand="neutral"
                      leftIconPath={mdiOpenInNew}
                      size="sm"
                      title={t("listing::actions::open_folder")}
                      onClick={() => window.api.shell.openFile(allSources[k].path)}
                    >
                      {t("listing::actions::open_folder")}
                    </Button>
                  </div>

                  <Listing
                    appendLoader={true}
                    className="grid grid-cols-[repeat(auto-fit,minmax(240px,0.2fr))] gap-4"
                    customNoResults={
                      <MediaPageNoResults openSettings={openSettings} refresh={refreshAll} />
                    }
                    entityCount={bySource[k]?.length ?? 0}
                    errorTitle={error?.message}
                    isError={isError}
                    isLoading={isLoading}
                    skeletonCount={24}
                    SkeletonTile={MediaListItemSkeleton}
                  >
                    {pageItems?.map((i) => (
                      <MediaListItem
                        game={game}
                        item={i}
                        key={`${i.sourceId}:${i.name}`}
                        onClick={() => setSelected(i)}
                      />
                    ))}
                  </Listing>
                </TabPanel>
              ))}
        </TabProvider>

        <Pagination
          currentPage={page}
          recordsPerPage={pageSize}
          scrollRef={scrollRef}
          totalRecords={total}
          onPaginationUpdate={setPage}
        />
      </PageScroll>
    </Page>
  );
}
