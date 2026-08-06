import React from "react";

import type { IExtensionApi } from "@/types/api";
import { Button } from "@/ui/components/button/Button";
import { Page } from "@/views/components/Page/Page";
import { PageHeader } from "@/views/components/Page/PageHeader";

import type { MediaItem } from "../util/mediaTypes";

interface IMediaSingleViewProps {
  active?: boolean;
  api: IExtensionApi;
  content: MediaItem;
  entry: MediaItem;
  onBack: () => void;
}

export default function MediaSingleView({ api, active, onBack, entry }: IMediaSingleViewProps) {
  const t = api.translate;

  return (
    <Page active={active} id="health-check-page" scrollable={false}>
      <PageHeader
        pictogramName="camera"
        subtitle={t("Screenshots and videos from your selected game.")}
        title={t("Media")}
      />

      <div className="grid grid-cols-[80%_20%] gap-2">
        <div>
          {entry.type === "image" && <img className="w-full" src={entry.path} />}

          {entry.type === "video" && <video />}
        </div>

        <div className="rounded-sm bg-surface-mid p-2">
          <Button onClick={onBack}>Go Back</Button>
        </div>
      </div>
    </Page>
  );
}
