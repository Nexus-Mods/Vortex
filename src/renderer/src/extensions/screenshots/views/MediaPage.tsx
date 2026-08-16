import { mdiCog, mdiOpenInNew, mdiRefresh } from "@mdi/js";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";

import { setOpenMainPage, setSettingsPage } from "@/actions";
import { type IExtensionApi } from "@/types/api";
import { Button } from "@/ui/components/button/Button";
import { Listing } from "@/ui/components/listing/Listing";
import { TabBar } from "@/ui/components/tabs/TabBar";
import { TabButton } from "@/ui/components/tabs/TabButton";
import { TabPanel } from "@/ui/components/tabs/TabPanel";
import { TabProvider } from "@/ui/components/tabs/Tabs.context";
import { Typography } from "@/ui/components/typography/Typography";
import { Page } from "@/views/components/Page/Page";
import { PageHeader } from "@/views/components/Page/PageHeader";
import { PageScroll } from "@/views/components/Page/PageScroll";

import MediaListItem from "../components/MediaListItem";
import MediaListItemSkeleton from "../components/MediaListItemSkeleton";
import useGameMedia from "../hooks/GameMediaHook";
import type { GameMediaItem } from "../util/mediaTypes";
import MediaPageNoResults from "./MediaPageNoResults";
import MediaSingleView from "./MediaSingleView";

interface IMediaPageProps {
  api: IExtensionApi;
  active?: boolean;
}

export default function MediaPage({ active, api }: IMediaPageProps) {
  const { t } = useTranslation(["media_page", "common"]);
  const dispatch = useDispatch();
  const [selected, setSelected] = useState<GameMediaItem | null>(null);
  const [tab, setTab] = useState<string>("all");

  const { isLoading, isError, error, allSources, items, forceCollect, game, disabledSources } =
    useGameMedia();

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
    <Page active={active} id="health-check-page" scrollable={false}>
      <PageHeader
        pictogramName="camera"
        subtitle={t("Screenshots and videos from your selected game.")}
        title={t("Media")}
      >
        <div className="flex shrink-0 items-center gap-x-2">
          <Button
            appearance="subdued"
            brand="neutral"
            disabled={isLoading}
            leftIconPath={mdiRefresh}
            size="sm"
            title={"Refresh"}
            onClick={refreshAll}
          />

          <Button
            appearance="subdued"
            brand="neutral"
            leftIconPath={mdiCog}
            size="sm"
            title={"Settings"}
            onClick={openSettings}
          />
        </div>
      </PageHeader>

      <PageScroll className="space-y-2 p-6">
        {/* The actual page content */}
        <TabProvider tab={tab} tabListId="game-media-tabs" onSetSelectedTab={setTab}>
          <TabBar className="mb-2">
            <TabButton count={items?.length ?? 0} name="All" panelId="all" />

            {!!allSources &&
              Object.entries(allSources)
                .filter(([k]) => !disabledSources?.includes(k))
                .map(([k, s]) => (
                  <TabButton
                    count={items?.filter((i) => i.sourceId === k).length ?? 0}
                    key={k}
                    name={s.name}
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
              {t("All screenshots and videos for {{game}}.", {
                game: game.name,
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
              skeletonCount={12}
              SkeletonTile={() => <MediaListItemSkeleton />}
            >
              {items?.map((i) => (
                <MediaListItem
                  item={i}
                  key={`${i.sourceId}:${i.name}`}
                  t={t}
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
                      {allSources[k]?.description ?? `Media from ${allSources[k]?.name}`}
                    </Typography>

                    <Button
                      appearance="subdued"
                      brand="neutral"
                      leftIconPath={mdiOpenInNew}
                      size="sm"
                      title="Open Folder"
                      onClick={() => window.api.shell.openUrl(allSources[k].path)}
                    >
                      Open Folder
                    </Button>
                  </div>

                  <Listing
                    appendLoader={true}
                    className="grid grid-cols-[repeat(auto-fit,minmax(240px,0.2fr))] gap-4"
                    customNoResults={
                      <MediaPageNoResults openSettings={openSettings} refresh={refreshAll} />
                    }
                    entityCount={items?.filter((i) => i.sourceId === k).length ?? 0}
                    errorTitle={error?.message}
                    isError={isError}
                    isLoading={isLoading}
                    skeletonCount={12}
                  >
                    {items
                      ?.filter((i) => i.sourceId === k)
                      .map((i) => (
                        <MediaListItem
                          item={i}
                          key={`${i.sourceId}:${i.name}`}
                          t={t}
                          onClick={() => setSelected(i)}
                        />
                      ))}
                  </Listing>
                </TabPanel>
              ))}
        </TabProvider>
      </PageScroll>
    </Page>
  );
}
