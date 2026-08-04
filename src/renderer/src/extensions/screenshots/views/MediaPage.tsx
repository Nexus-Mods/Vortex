import { mdiCog } from "@mdi/js";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";

import { setOpenMainPage, setSettingsPage } from "@/actions";
import { type IExtensionApi } from "@/types/api";
import { Button } from "@/ui/components/button/Button";
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

        <div className="flex flex-wrap gap-4 overflow-auto">
          {!isLoading && items?.map((i) => <img className="w-46" key={i.id} src={i.path} />)}
        </div>

        <Button onClick={void forceCollect}>Force Collect</Button>

        {JSON.stringify({ discovery, items, allSources }, null, 2)}
      </PageScroll>
    </Page>
  );
}
