import { mdiCog } from "@mdi/js";
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
import { Page } from "@/views/components/Page/Page";
import { PageHeader } from "@/views/components/Page/PageHeader";
import { PageScroll } from "@/views/components/Page/PageScroll";

import useGameMedia from "../hooks/GameMediaHook";
import type { MediaItem } from "../util/mediaTypes";
import MediaSingleView from "./MediaSingleView";

interface IMediaPageProps {
  api: IExtensionApi;
  active?: boolean;
}

export default function MediaPage({ active, api }: IMediaPageProps) {
  const { t } = useTranslation(["media_page", "common"]);
  const dispatch = useDispatch();
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [tab, setTab] = useState<string>("all");

  const { isLoading, isError, error, allSources, items, discovery, forceCollect } = useGameMedia();

  if (selected) {
    return (
      <MediaSingleView
        active={active}
        api={api}
        content={selected}
        entry={selected}
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
            leftIconPath={mdiCog}
            size="sm"
            title={"Settings"}
            onClick={() => {
              dispatch(setOpenMainPage("game_settings", false));
              dispatch(setSettingsPage("Media"));
            }}
          />
        </div>
      </PageHeader>

      <PageScroll className="space-y-6 p-6 whitespace-pre">
        {/* The actual page content */}
        {isError && <div>{error?.message}</div>}

        {isLoading && <>Loading</>}

        <TabProvider tab={tab} tabListId="" onSetSelectedTab={setTab}>
          <TabBar>
            <TabButton count={items?.length ?? 0} name="All" panelId="all" />

            {!!allSources &&
              Object.entries(allSources).map(([k, s]) => (
                <TabButton
                  count={items?.filter((i) => i.sourceId === k).length ?? 0}
                  key={k}
                  name={s.name}
                  panelId={k}
                />
              ))}
          </TabBar>

          <TabPanel id="all">
            <Listing
              appendLoader={true}
              className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5"
              entityCount={items?.length ?? 0}
              isLoading={isLoading}
              skeletonCount={12}
            >
              {items?.map((i) => (
                <div key={`${i.sourceId}:${i.name}`} title={i.name}>
                  <img key={i.id} src={i.thumbnailPath ?? i.path} />
                </div>
              ))}
            </Listing>
          </TabPanel>

          {!!allSources &&
            Object.keys(allSources).map((k) => (
              <TabPanel id={k} key={`source-tab-${k}`}>
                <Listing
                  appendLoader={true}
                  className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5"
                  entityCount={items?.filter((i) => i.sourceId === k).length ?? 0}
                  isLoading={isLoading}
                  skeletonCount={12}
                >
                  {items
                    ?.filter((i) => i.sourceId === k)
                    .map((i) => (
                      <div key={`${i.sourceId}:${i.name}`} title={i.name}>
                        <img key={i.id} src={i.thumbnailPath ?? i.path} />
                      </div>
                    ))}
                </Listing>
              </TabPanel>
            ))}
        </TabProvider>

        <Button onClick={void forceCollect}>Force Collect</Button>

        {JSON.stringify({ discovery, items, allSources }, null, 2)}
      </PageScroll>
    </Page>
  );
}
